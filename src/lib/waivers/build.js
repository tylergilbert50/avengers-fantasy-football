/**
 * The waiver wire, from two sources that don't overlap.
 *
 * ESPN states some of this outright and hides the rest, so the page is built
 * from both halves rather than picking one:
 *
 *   1. **Counted, exact.** Every team carries a `transactionCounter` with the
 *      season's `acquisitions`, `drops`, `acquisitionBudgetSpent` and a
 *      per-week `matchupAcquisitionTotals`. These are ESPN's own tallies and
 *      are complete — they are what the activity table reports.
 *
 *   2. **Named, reconstructed.** The counters carry no player names, so the
 *      pickups themselves come from the weekly ownership timeline: a player on
 *      a roster this week who was on nobody's last week was added. That
 *      recovers about three quarters of them and, more to the point, is the
 *      only way to say what a pickup went on to score.
 *
 * The quarter it misses are players added and dropped inside the same week,
 * who never appear in a Sunday snapshot. So the counts and the list disagree on
 * purpose: the table reports what ESPN counted, the list shows what can be
 * named, and neither is quietly presented as the other.
 *
 * What is nowhere to be found is what anything cost. The league runs a $200
 * FAAB budget, but ESPN publishes only the season total per team — no
 * per-transaction bid — so a pickup can be named and scored but never priced.
 * For the same reason a waiver claim can't be told apart from a free-agent add;
 * "pickup" here means both.
 *
 * Pure functions over already-fetched pieces, like the trade builder it borrows
 * its timeline from.
 */

import { buildTimeline, isStarterSlot } from '../trades/build.js'

function round(value, places = 2) {
  const factor = 10 ** places
  return Math.round((Number(value) || 0) * factor) / factor
}

/**
 * ESPN's per-team tallies for one season.
 *
 * @param {object} raw  a league blob fetched with `mTeam`
 * @param {Array<{id: number, manager: string}>} teams
 */
export function seasonCounters({ raw, season, teams = [] }) {
  const byTeam = new Map(teams.map((team) => [team.id, team]))
  const budget = raw?.settings?.acquisitionSettings?.acquisitionBudget ?? null

  return (raw?.teams ?? []).map((team) => {
    const counter = team?.transactionCounter ?? {}
    const spent = Number(counter.acquisitionBudgetSpent) || 0
    return {
      season,
      teamId: team.id,
      manager: byTeam.get(team.id)?.manager ?? 'Unknown manager',
      adds: Number(counter.acquisitions) || 0,
      drops: Number(counter.drops) || 0,
      spent,
      budget,
      // What they finished the year still holding. Worth its own field: the
      // managers who never spend are as interesting as the ones who max out.
      remaining: budget == null ? null : Math.max(0, budget - spent),
      movesToIR: Number(counter.moveToIR) || 0,
      // ESPN keys this by matchup period, which is the week the adds happened in.
      addsByWeek: Object.entries(counter.matchupAcquisitionTotals ?? {})
        .map(([week, count]) => ({ week: Number(week), count: Number(count) || 0 }))
        .sort((a, b) => a.week - b.week),
    }
  })
}

/**
 * Every pickup the weekly rosters can name, with what it went on to score.
 *
 * A player is picked up when he turns up on a roster having been on nobody's
 * the week before — anyone arriving from another team came by trade, which is
 * the trade builder's business and not counted here.
 *
 * Scoring matches the trade page exactly, so the two are comparable: points
 * from the pickup week onward, only while the player stayed on that roster, and
 * only in weeks he was actually started.
 */
export function buildSeasonPickups({ season, weeks = [], teams = [] }) {
  const timeline = buildTimeline(weeks)
  const byTeam = new Map(teams.map((team) => [team.id, team]))

  const pickups = []
  const drops = []

  for (let i = 1; i < timeline.weeks.length; i += 1) {
    const previous = timeline.weeks[i - 1]
    const week = timeline.weeks[i]
    const before = timeline.rosterAt(previous)
    const now = timeline.rosterAt(week)

    for (const [playerId, record] of now) {
      if (before.has(playerId)) continue
      pickups.push({ playerId, teamId: record.teamId, week })
    }

    for (const [playerId, record] of before) {
      if (now.has(playerId)) continue
      drops.push({ playerId, teamId: record.teamId, week })
    }
  }

  const scored = pickups.map((pickup) => {
    let points = 0
    let started = 0
    let heldWeeks = 0

    for (const week of timeline.weeks) {
      if (week < pickup.week) continue
      const at = timeline.at(week, pickup.playerId)
      if (!at || at.teamId !== pickup.teamId) continue
      heldWeeks += 1
      if (!isStarterSlot(at.slot)) continue
      started += 1
      points += at.score
    }

    return {
      id: `${season}-${pickup.week}-${pickup.teamId}-${pickup.playerId}`,
      season,
      week: pickup.week,
      teamId: pickup.teamId,
      manager: byTeam.get(pickup.teamId)?.manager ?? 'Unknown manager',
      playerId: pickup.playerId,
      player: timeline.names.get(pickup.playerId) ?? `Player ${pickup.playerId}`,
      points: round(points),
      started,
      heldWeeks,
    }
  })

  return {
    pickups: scored.sort((a, b) => b.points - a.points),
    dropCount: drops.length,
  }
}

/** Best first, which is the only order this list is ever read in. */
export function sortPickups(pickups = []) {
  return [...pickups].sort(
    (a, b) => b.points - a.points || b.started - a.started || a.season - b.season || a.week - b.week,
  )
}

/**
 * The activity table: one row per manager, every season added together.
 *
 * Adds, drops and FAAB come from ESPN's counters and are exact. The best pickup
 * comes from the reconstructed list, so a manager whose best one happened to
 * fall in the missing quarter shows their second best — worth knowing, and the
 * reason the two never share a column.
 */
export function buildWaiverStats({ counters = [], pickups = [] }) {
  const managers = new Map()

  const entry = (manager) => {
    if (!managers.has(manager)) {
      managers.set(manager, {
        manager,
        seasons: new Set(),
        adds: 0,
        drops: 0,
        spent: 0,
        budget: 0,
        movesToIR: 0,
        bestPickup: null,
        pickupPoints: 0,
        namedPickups: 0,
      })
    }
    return managers.get(manager)
  }

  for (const counter of counters) {
    const record = entry(counter.manager)
    record.seasons.add(counter.season)
    record.adds += counter.adds
    record.drops += counter.drops
    record.spent += counter.spent
    record.budget += counter.budget ?? 0
    record.movesToIR += counter.movesToIR
  }

  for (const pickup of pickups) {
    const record = entry(pickup.manager)
    record.namedPickups += 1
    record.pickupPoints = round(record.pickupPoints + pickup.points)
    if (!record.bestPickup || pickup.points > record.bestPickup.points) {
      record.bestPickup = {
        player: pickup.player,
        points: pickup.points,
        season: pickup.season,
        week: pickup.week,
      }
    }
  }

  const table = [...managers.values()].map((record) => ({
    manager: record.manager,
    seasons: record.seasons.size,
    adds: record.adds,
    drops: record.drops,
    spent: record.spent,
    budget: record.budget,
    remaining: Math.max(0, record.budget - record.spent),
    // Spend as a share of the budgets they were given, so a manager who played
    // three seasons isn't flattered against one who played five.
    spentPct: record.budget > 0 ? round(record.spent / record.budget, 4) : null,
    addsPerSeason: record.seasons.size > 0 ? round(record.adds / record.seasons.size, 1) : 0,
    movesToIR: record.movesToIR,
    namedPickups: record.namedPickups,
    pickupPoints: round(record.pickupPoints),
    bestPickup: record.bestPickup,
  }))

  table.sort((a, b) => b.adds - a.adds || b.spent - a.spent || a.manager.localeCompare(b.manager))
  return table
}

/**
 * A pickup nobody ever started tells you a roster spot changed hands and
 * nothing else. They are counted, never listed: two thirds of the log would
 * otherwise be identical rows reading nil points off nil starts.
 */
export function startedPickups(pickups = []) {
  return pickups.filter((pickup) => pickup.started > 0)
}

/**
 * Seasons a manager must have played before being called the biggest spender.
 * One season at 200/200 is a full budget, not a habit.
 */
export const MIN_SEASONS_FOR_TITLE = 2

/** The blurbs above the table. */
export function waiverHighlights({ counters = [], pickups = [], stats = [] }) {
  const best = sortPickups(pickups)[0] ?? null
  const busiest = [...stats].sort((a, b) => b.adds - a.adds)[0] ?? null

  const spenders = stats.filter(
    (row) => row.spentPct != null && row.seasons >= MIN_SEASONS_FOR_TITLE,
  )
  const biggest = [...spenders].sort((a, b) => b.spentPct - a.spentPct || b.spent - a.spent)[0] ?? null

  return {
    totalAdds: counters.reduce((sum, counter) => sum + counter.adds, 0),
    totalDrops: counters.reduce((sum, counter) => sum + counter.drops, 0),
    totalSpent: counters.reduce((sum, counter) => sum + counter.spent, 0),
    namedPickups: pickups.length,
    startedPickups: startedPickups(pickups).length,
    bestPickup: best
      ? {
          player: best.player,
          points: best.points,
          started: best.started,
          season: best.season,
          week: best.week,
          manager: best.manager,
        }
      : null,
    busiest: busiest ? { manager: busiest.manager, adds: busiest.adds } : null,
    biggestSpender: biggest
      ? { manager: biggest.manager, spent: biggest.spent, spentPct: biggest.spentPct }
      : null,
  }
}
