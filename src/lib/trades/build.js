/**
 * Trades, rebuilt from what ESPN will actually tell us.
 *
 * ESPN has a real transaction log, and it is useless to us: the endpoints that
 * serve it (`mTransactions2`, the league's `communication` topics) answer with
 * nothing at all unless the request carries a league member's cookies, and this
 * site reads the league anonymously. So trades are reconstructed instead, out
 * of two things ESPN does hand over to anyone:
 *
 *   1. Every roster entry carries `acquisitionType: 'TRADE'` and an exact
 *      millisecond `acquisitionDate`. Both halves of a trade share that
 *      timestamp to the millisecond, so grouping on it recovers the deals —
 *      no two distinct trades in this league's history collide.
 *
 *   2. `mBoxscore` for a given week lists every rostered player with the team
 *      holding them, the lineup slot they were in, and what they scored. Week
 *      by week that is a full ownership timeline.
 *
 * (1) alone is not enough, because it only sees players who were still on a
 * roster when the season ended — a third of this league's trades look
 * one-sided through it. (2) fills those in, and is also what makes the trade
 * scoreable at all.
 *
 * Pure functions over already-fetched pieces: no network here, so the shaping
 * is testable without one.
 */

/** ESPN's non-playing lineup slots. Everything else is a starting spot. */
export const BENCH_SLOT = 20
export const INJURED_RESERVE_SLOT = 21

export function isStarterSlot(slot) {
  return slot != null && slot !== BENCH_SLOT && slot !== INJURED_RESERVE_SLOT
}

function round(value, places = 2) {
  const factor = 10 ** places
  return Math.round((Number(value) || 0) * factor) / factor
}

/**
 * Weekly snapshots indexed for lookup.
 *
 * @param {Array<{week: number, entries: Array<object>}>} weeks
 */
export function buildTimeline(weeks = []) {
  const byWeek = new Map()
  const names = new Map()

  for (const { week, entries } of weeks) {
    if (week == null) continue
    const players = new Map()
    for (const entry of entries ?? []) {
      if (entry?.playerId == null) continue
      players.set(entry.playerId, {
        teamId: entry.teamId ?? null,
        slot: entry.slot ?? null,
        score: Number(entry.score) || 0,
      })
      if (entry.player) names.set(entry.playerId, entry.player)
    }
    byWeek.set(week, players)
  }

  const ordered = [...byWeek.keys()].sort((a, b) => a - b)

  return {
    weeks: ordered,
    names,
    at: (week, playerId) => byWeek.get(week)?.get(playerId) ?? null,
    teamAt: (week, playerId) => byWeek.get(week)?.get(playerId)?.teamId ?? null,
    /** Everyone rostered in a week, as [playerId, record] pairs. */
    rosterAt: (week) => byWeek.get(week) ?? new Map(),
  }
}

/**
 * Every roster entry ESPN says arrived by trade, out of a raw league blob
 * fetched with `mRoster` + `mTeam`.
 *
 * This is the season's end state, so it only sees the players who lasted —
 * which is why it is one of two inputs and not the whole story.
 */
export function tradeAcquisitions(raw) {
  const acquisitions = []
  for (const team of raw?.teams ?? []) {
    for (const entry of team?.roster?.entries ?? []) {
      if (entry?.acquisitionType !== 'TRADE') continue
      if (entry?.acquisitionDate == null || entry?.playerId == null) continue
      acquisitions.push({
        timestamp: entry.acquisitionDate,
        teamId: team.id,
        playerId: entry.playerId,
        player: entry.playerPoolEntry?.player?.fullName ?? null,
      })
    }
  }
  return acquisitions
}

/**
 * The week a trade landed in.
 *
 * Deliberately not computed from the timestamp. A trade agreed on the Tuesday
 * sits between two scoring periods, and which side of the boundary ESPN files
 * it under is not something a kickoff time can be relied on to reproduce —
 * being one week out would read the wrong roster and lose the deal entirely.
 *
 * The timeline knows exactly: the trade week is the one where the players
 * turned up on their new team. `hint` only breaks ties, for the handful of
 * players who were traded more than once in a season and so have more than one
 * boundary to choose from.
 */
function tradeWeekFor({ moves, timeline, hint }) {
  const votes = []

  for (const move of moves) {
    const boundaries = []
    for (let i = 0; i < timeline.weeks.length; i += 1) {
      const week = timeline.weeks[i]
      if (timeline.teamAt(week, move.playerId) !== move.teamId) continue
      const previous = i > 0 ? timeline.weeks[i - 1] : null
      // Arriving in the first week we can see counts: the player may have been
      // traded before the timeline starts.
      if (previous == null || timeline.teamAt(previous, move.playerId) !== move.teamId) {
        boundaries.push(week)
      }
    }
    if (!boundaries.length) continue
    boundaries.sort((a, b) => Math.abs(a - hint) - Math.abs(b - hint))
    votes.push(boundaries[0])
  }

  if (!votes.length) return hint

  // Everyone in a trade moves at the same boundary, so the popular answer is
  // the right one; the earliest wins a tie.
  const tally = new Map()
  for (const vote of votes) tally.set(vote, (tally.get(vote) ?? 0) + 1)
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
}

/**
 * A rough week for a timestamp, used only as the tie-breaker above.
 *
 * @param {number} timestamp
 * @param {Array<{week: number, startsAt: number}>} weekStarts
 */
export function approximateWeek(timestamp, weekStarts = []) {
  let week = weekStarts[0]?.week ?? 1
  for (const entry of weekStarts) {
    if (timestamp >= entry.startsAt) week = entry.week
  }
  return week
}

/**
 * The last team known to hold a player before a given week.
 *
 * Usually just the week before, but not always: a player can drop out of the
 * weekly rosters entirely for a stretch — an unplayed bye handled by a roster
 * move, or a week ESPN wouldn't serve — and stopping at the immediately
 * preceding week would lose the counterparty over a gap that means nothing.
 */
function lastTeamBefore({ timeline, playerId, week }) {
  for (let i = timeline.weeks.length - 1; i >= 0; i -= 1) {
    const candidate = timeline.weeks[i]
    if (candidate >= week) continue
    const teamId = timeline.teamAt(candidate, playerId)
    if (teamId != null) return teamId
  }
  return null
}

/**
 * What each side of a trade got out of it, in points that actually counted.
 *
 * Only weeks from the trade onward, only while the player was still on the team
 * that traded for him, and only when he was in the starting lineup — a player
 * who arrives and then sits on the bench did nothing for the team that wanted
 * him, and that is the thing being measured.
 */
function scorePlayer({ playerId, teamId, fromWeek, timeline }) {
  let points = 0
  let started = 0
  let heldWeeks = 0

  for (const week of timeline.weeks) {
    if (week < fromWeek) continue
    const at = timeline.at(week, playerId)
    if (!at || at.teamId !== teamId) continue
    heldWeeks += 1
    if (!isStarterSlot(at.slot)) continue
    started += 1
    points += at.score
  }

  return { points: round(points), started, heldWeeks }
}

/**
 * Rebuild one season's trades.
 *
 * @param {object}   input
 * @param {number}   input.season
 * @param {Array<{timestamp: number, teamId: number, playerId: number, player?: string}>} input.acquisitions
 *   every roster entry ESPN marked as acquired by trade
 * @param {Array<{week: number, entries: Array<object>}>} input.weeks  weekly rosters
 * @param {Array<{id: number, manager: string, name?: string}>} input.teams
 * @param {Array<{week: number, startsAt: number}>} input.weekStarts
 */
export function buildSeasonTrades({ season, acquisitions = [], weeks = [], teams = [], weekStarts = [] }) {
  const timeline = buildTimeline(weeks)
  const byTeam = new Map(teams.map((team) => [team.id, team]))
  const describe = (teamId) => ({
    teamId,
    manager: byTeam.get(teamId)?.manager ?? 'Unknown manager',
    team: byTeam.get(teamId)?.name ?? null,
  })

  // Every player ESPN has an acquisition record for, across the whole season.
  // Anyone in here is already accounted for by his own trade, which is what
  // keeps the reconstruction below from claiming him for someone else's.
  const recorded = new Set(acquisitions.map((acquisition) => acquisition.playerId))

  // Both halves of a trade share an exact millisecond, so the timestamp is the
  // trade's identity.
  const groups = new Map()
  for (const acquisition of acquisitions) {
    if (acquisition?.timestamp == null) continue
    if (!groups.has(acquisition.timestamp)) groups.set(acquisition.timestamp, [])
    groups.get(acquisition.timestamp).push(acquisition)
  }

  const trades = []

  for (const [timestamp, moves] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    const hint = approximateWeek(timestamp, weekStarts)
    const week = tradeWeekFor({ moves, timeline, hint })
    const previousWeek = timeline.weeks.filter((w) => w < week).pop() ?? null

    // Everyone who received a player still on their roster at season's end.
    const received = new Map()
    const add = (teamId, playerId, player) => {
      if (teamId == null) return
      if (!received.has(teamId)) received.set(teamId, new Map())
      received.get(teamId).set(playerId, player ?? timeline.names.get(playerId) ?? `Player ${playerId}`)
    }
    for (const move of moves) add(move.teamId, move.playerId, move.player)

    // The other side.
    //
    // When ESPN's own records already show two teams receiving players, the
    // trade is fully described and the timeline is not consulted at all —
    // asking it would only introduce a third party, since a player traded twice
    // in one week was held by someone irrelevant to this deal the week before.
    //
    // It is only the one-sided case that needs inference: whoever held the
    // traded players the week before is the counterparty, and the busiest such
    // team wins if the players somehow came from more than one.
    const parties = new Set(received.keys())
    if (parties.size === 1 && previousWeek != null) {
      const sources = new Map()
      for (const move of moves) {
        const from = lastTeamBefore({ timeline, playerId: move.playerId, week })
        if (from == null || parties.has(from)) continue
        sources.set(from, (sources.get(from) ?? 0) + 1)
      }
      const best = [...sources.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]
      if (best) parties.add(best[0])
    }

    // A party that received nobody either was paid in FAAB or was paid in
    // players it dropped before the season ended. Only that second case can be
    // recovered, and only from the ownership timeline.
    //
    // The search is kept deliberately narrow, because a roster diff cannot tell
    // a trade from a drop that someone else claimed the same week. A player is
    // only claimed for this trade when he moved directly between two of its
    // parties at its boundary *and* ESPN holds no acquisition record for him
    // anywhere that season — that record would mean he belongs to some other
    // deal, and a survivor never needs recovering in the first place. Sides
    // that already have their players are left exactly as ESPN reported them,
    // so two trades between the same two managers in one week stay separate.
    if (previousWeek != null) {
      // Snapshotted before anything is added, so a side filled in by this pass
      // can't then be treated as a source for another.
      const acquirers = new Set(received.keys())
      const emptyParties = [...parties].filter((teamId) => !acquirers.has(teamId))
      if (emptyParties.length) {
        for (const [playerId, before] of timeline.rosterAt(previousWeek)) {
          if (recorded.has(playerId)) continue
          if (!acquirers.has(before.teamId)) continue
          const now = timeline.teamAt(week, playerId)
          if (now == null || !emptyParties.includes(now)) continue
          add(now, playerId, timeline.names.get(playerId))
        }
      }
    }

    const sides = [...parties].map((teamId) => {
      const players = [...(received.get(teamId) ?? new Map()).entries()].map(([playerId, player]) => ({
        playerId,
        player,
        ...scorePlayer({ playerId, teamId, fromWeek: week, timeline }),
      }))
      players.sort((a, b) => b.points - a.points)
      return {
        ...describe(teamId),
        players,
        points: round(players.reduce((sum, p) => sum + p.points, 0)),
        starts: players.reduce((sum, p) => sum + p.started, 0),
      }
    })

    // A side that still has nobody after all that was paid in FAAB. The league
    // runs a $200 budget and FAAB-for-player deals are common — but ESPN
    // exposes no money field anywhere we can read, so the amount is unknown and
    // the deal cannot be judged on points: one side scores zero by
    // construction. FAAB deals are recorded and shown, and never scored.
    const isFaabDeal = sides.length > 1 && sides.some((side) => side.players.length === 0)

    // Nothing to compare against. A trade in the first week we can see has no
    // earlier roster to name the other party from.
    const counterpartyUnknown = sides.length < 2

    const scoreable = !isFaabDeal && !counterpartyUnknown && sides.length === 2

    sides.sort((a, b) => b.points - a.points)

    let winner = null
    let margin = 0
    if (scoreable) {
      const [best, worst] = sides
      margin = round(best.points - worst.points)
      winner = margin === 0 ? null : best.teamId
    }

    trades.push({
      id: `${season}-${timestamp}`,
      season,
      week,
      date: new Date(timestamp).toISOString(),
      sides,
      isFaabDeal,
      counterpartyUnknown,
      scoreable,
      winner,
      margin,
      playerCount: sides.reduce((sum, side) => sum + side.players.length, 0),
    })
  }

  return trades
}

/** Newest first, which is how the page reads them. */
export function sortTrades(trades = []) {
  return [...trades].sort((a, b) => b.season - a.season || b.week - a.week || (a.date < b.date ? 1 : -1))
}

/**
 * The league table of who trades well.
 *
 * FAAB deals are counted as trades made but left out of every won/lost figure,
 * so a manager who sells for FAAB is neither rewarded nor punished for a deal
 * that has no second column of points to compare against.
 *
 * `faabDeals` counts only the deals a manager *paid* for, so the column reads
 * as "bought a player for cash" rather than "was somehow involved in one".
 */
export function buildTradeStats(trades = []) {
  const managers = new Map()

  const entry = (side) => {
    if (!managers.has(side.manager)) {
      managers.set(side.manager, {
        manager: side.manager,
        teamIds: new Set(),
        trades: 0,
        faabDeals: 0,
        scored: 0,
        won: 0,
        lost: 0,
        tied: 0,
        pointsIn: 0,
        pointsOut: 0,
        partners: new Map(),
        biggestWin: null,
        biggestLoss: null,
      })
    }
    const record = managers.get(side.manager)
    record.teamIds.add(side.teamId)
    return record
  }

  for (const trade of trades) {
    for (const side of trade.sides) {
      const record = entry(side)
      record.trades += 1

      // Only the side that spent the money. In a FAAB deal one manager hands
      // over budget and walks away with the players, and the other does the
      // reverse — counting both would put the same number against a manager who
      // has never once bought a player and one who does nothing else. Holding
      // players in a deal with a paid-in-FAAB side is what identifies the buyer.
      if (trade.isFaabDeal && side.players.length > 0) record.faabDeals += 1

      for (const other of trade.sides) {
        if (other.teamId === side.teamId) continue
        record.partners.set(other.manager, (record.partners.get(other.manager) ?? 0) + 1)
      }

      if (!trade.scoreable) continue
      const opponent = trade.sides.find((s) => s.teamId !== side.teamId)
      record.scored += 1
      record.pointsIn = round(record.pointsIn + side.points)
      record.pointsOut = round(record.pointsOut + (opponent?.points ?? 0))

      if (trade.winner == null) {
        record.tied += 1
      } else if (trade.winner === side.teamId) {
        record.won += 1
        if (!record.biggestWin || trade.margin > record.biggestWin.margin) {
          record.biggestWin = { margin: trade.margin, tradeId: trade.id, season: trade.season, opponent: opponent?.manager ?? null }
        }
      } else {
        record.lost += 1
        if (!record.biggestLoss || trade.margin > record.biggestLoss.margin) {
          record.biggestLoss = { margin: trade.margin, tradeId: trade.id, season: trade.season, opponent: opponent?.manager ?? null }
        }
      }
    }
  }

  const table = [...managers.values()].map((record) => {
    const decided = record.won + record.lost
    const favourite = [...record.partners.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
    return {
      manager: record.manager,
      trades: record.trades,
      faabDeals: record.faabDeals,
      scored: record.scored,
      won: record.won,
      lost: record.lost,
      tied: record.tied,
      record: `${record.won}-${record.lost}${record.tied ? `-${record.tied}` : ''}`,
      winPct: decided > 0 ? round(record.won / decided, 4) : null,
      pointsIn: round(record.pointsIn),
      pointsOut: round(record.pointsOut),
      net: round(record.pointsIn - record.pointsOut),
      biggestWin: record.biggestWin,
      biggestLoss: record.biggestLoss,
      favouritePartner: favourite ? { manager: favourite[0], trades: favourite[1] } : null,
    }
  })

  // Best trader first: win rate decides it, and the manager who has actually
  // made trades outranks one who has made none.
  table.sort((a, b) => (b.winPct ?? -1) - (a.winPct ?? -1) || b.won - a.won || b.net - a.net)

  return table
}

/**
 * How many decided trades a manager needs before being called the best or the
 * worst of them. Low enough that most of the league qualifies, high enough that
 * one lucky deal in a debut season doesn't take the title off someone with a
 * decade of them.
 */
export const MIN_DECIDED_FOR_TITLE = 6

/** The handful of superlatives worth putting above the table. */
export function tradeHighlights(trades = [], stats = []) {
  const scored = trades.filter((trade) => trade.scoreable && trade.winner != null)
  const fleecing = scored.reduce((best, trade) => (!best || trade.margin > best.margin ? trade : best), null)

  const withRecord = stats.filter((row) => row.won + row.lost >= MIN_DECIDED_FOR_TITLE)
  const best = withRecord.find((row) => row.winPct != null) ?? null
  const worst = [...withRecord].reverse().find((row) => row.winPct != null) ?? null
  const busiest = [...stats].sort((a, b) => b.trades - a.trades)[0] ?? null

  return {
    totalTrades: trades.length,
    scoredTrades: trades.filter((trade) => trade.scoreable).length,
    faabDeals: trades.filter((trade) => trade.isFaabDeal).length,
    biggestFleecing: fleecing
      ? {
          tradeId: fleecing.id,
          season: fleecing.season,
          week: fleecing.week,
          margin: fleecing.margin,
          winner: fleecing.sides.find((side) => side.teamId === fleecing.winner)?.manager ?? null,
          loser: fleecing.sides.find((side) => side.teamId !== fleecing.winner)?.manager ?? null,
        }
      : null,
    bestTrader: best ? { manager: best.manager, record: best.record, winPct: best.winPct } : null,
    worstTrader: worst ? { manager: worst.manager, record: worst.record, winPct: worst.winPct } : null,
    busiest: busiest ? { manager: busiest.manager, trades: busiest.trades } : null,
  }
}
