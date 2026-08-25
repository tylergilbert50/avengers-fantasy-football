/**
 * All-time league records, computed from every season ESPN still serves.
 *
 * Pure functions over already-normalized seasons, so the whole thing is
 * testable without touching the network.
 *
 * Two decisions worth knowing about, because they change the numbers:
 *
 *  - Teams are identified by their **manager**, not their team name or team id.
 *    Names change every year — half the league renamed between 2025 and 2026 —
 *    so a record book keyed on them would credit the same person under several
 *    identities. The SWID behind an owner is stable.
 *
 *  - **The regular season only.** Playoff, consolation and toilet-bowl games
 *    are left out of every category. Streaks are computed from what remains, so
 *    a run carries straight from the last regular-season week of one year into
 *    the first of the next — the postseason in between neither extends a streak
 *    nor breaks it, because those games aren't there at all.
 *
 *  - **Season-long** totals use ESPN's own season record, which already counts
 *    the regular season only, and is what the standings page shows — so the two
 *    pages agree.
 */

const TOP_N = 5

function round(value, places = 2) {
  const factor = 10 ** places
  return Math.round((Number(value) || 0) * factor) / factor
}

/**
 * ESPN's box score for one matchup. `teamId` just decides which side the page
 * opens focused on.
 */
export function boxscoreUrl({ leagueId, season, week, teamId }) {
  if (!leagueId || !season || !week) return null
  const url = new URL('https://fantasy.espn.com/football/boxscore')
  url.searchParams.set('leagueId', String(leagueId))
  url.searchParams.set('matchupPeriodId', String(week))
  url.searchParams.set('scoringPeriodId', String(week))
  url.searchParams.set('seasonId', String(season))
  if (teamId != null) url.searchParams.set('teamId', String(teamId))
  return url.toString()
}

/**
 * Manager display names, shortened to first names where that is unambiguous
 * and first name + last initial where it isn't. Record tables are narrow and
 * the same people appear over and over.
 */
export function managerLabels(seasons) {
  const byId = new Map()
  for (const { teams = [] } of seasons) {
    for (const team of teams) {
      for (const manager of team.managers ?? []) {
        if (manager?.id && !byId.has(manager.id)) byId.set(manager.id, manager.name)
      }
    }
  }

  const firstNameCount = new Map()
  for (const name of byId.values()) {
    const first = name.split(/\s+/)[0]
    firstNameCount.set(first, (firstNameCount.get(first) ?? 0) + 1)
  }

  const labels = new Map()
  for (const [id, name] of byId) {
    const [first, ...rest] = name.split(/\s+/)
    const unique = (firstNameCount.get(first) ?? 0) <= 1
    labels.set(id, {
      full: name,
      short: unique || rest.length === 0 ? first : `${first} ${rest.at(-1)[0]}.`,
    })
  }
  return labels
}

/** teamId -> manager label, per season. Teams move between managers over time. */
function teamLabelIndex(season, labels) {
  const index = new Map()
  for (const team of season.teams ?? []) {
    const ownerId = team.primaryOwnerId ?? team.managers?.[0]?.id ?? null
    const label = ownerId ? labels.get(ownerId) : null
    index.set(team.id, {
      ownerId,
      short: label?.short ?? team.abbrev ?? team.name ?? 'Unknown',
      full: label?.full ?? team.name ?? 'Unknown',
      teamName: team.name,
    })
  }
  return index
}

/**
 * Is this a regular-season game?
 *
 * Two independent signals, and a game has to satisfy both. ESPN tags every
 * postseason matchup with a playoff tier — winners' bracket, and both
 * consolation ladders — leaving the regular season as `NONE`. The week number
 * is checked against the league's own regular-season length as well, so a
 * consolation game that ESPN forgets to tag still can't slip in.
 */
function isRegularSeason(matchup, regularSeasonWeeks) {
  if ((matchup.playoffTier ?? 'NONE') !== 'NONE') return false
  if (regularSeasonWeeks > 0 && matchup.week > regularSeasonWeeks) return false
  return true
}

/**
 * Every completed regular-season game, flattened and in chronological order.
 * Playoff games never enter, so nothing downstream has to think about them.
 */
export function collectGames(seasons, labels) {
  const games = []
  for (const entry of seasons) {
    const index = teamLabelIndex(entry, labels)
    for (const matchup of entry.matchups ?? []) {
      if (matchup.isBye || !matchup.isComplete) continue
      if (!matchup.home || !matchup.away) continue
      if (!isRegularSeason(matchup, entry.regularSeasonWeeks)) continue
      // A 0-0 pairing is ESPN carrying an unplayed slot, not a real game.
      if (!(matchup.home.points > 0) && !(matchup.away.points > 0)) continue

      games.push({
        season: entry.season,
        leagueId: entry.leagueId,
        week: matchup.week,
        playoffTier: matchup.playoffTier,
        home: { ...index.get(matchup.home.teamId), teamId: matchup.home.teamId, points: round(matchup.home.points) },
        away: { ...index.get(matchup.away.teamId), teamId: matchup.away.teamId, points: round(matchup.away.points) },
        winner: matchup.winner,
      })
    }
  }
  games.sort((a, b) => a.season - b.season || a.week - b.week)
  return games
}

/** One entry per team per game — the unit single-week records are drawn from. */
function teamWeeks(games) {
  const rows = []
  for (const game of games) {
    for (const [side, other] of [[game.home, game.away], [game.away, game.home]]) {
      rows.push({
        season: game.season,
        leagueId: game.leagueId,
        week: game.week,
        team: side,
        opponent: other,
        points: side.points,
      })
    }
  }
  return rows
}

const weekLabel = (row) => `W${row.week} ${row.season}`

function take(list, compare, limit = TOP_N) {
  return [...list].sort(compare).slice(0, limit)
}

function gameRow(game, { rank, valueCells }) {
  const winnerFirst = game.winner === 'AWAY' ? [game.away, game.home] : [game.home, game.away]
  return {
    rank,
    primary: `${winnerFirst[0].short} vs ${winnerFirst[1].short}`,
    cells: valueCells,
    link: boxscoreUrl({
      leagueId: game.leagueId,
      season: game.season,
      week: game.week,
      teamId: winnerFirst[0].teamId,
    }),
  }
}

/**
 * Longest runs of the same result per manager, in chronological order across
 * every season. A tie ends a run rather than extending it.
 */
export function streaks(games, outcome) {
  const perManager = new Map()
  for (const game of games) {
    // A game that finished level is whatever ESPN says it is: 2021 week 6 was
    // 118.36 apiece and ESPN awards it to the home team, so it extends a run
    // here the same way it does in the history log. See history/results.js.
    const decided =
      game.home.points !== game.away.points
        ? null
        : game.winner === 'HOME'
          ? game.home
          : game.winner === 'AWAY'
            ? game.away
            : null
    const tie = !decided && game.home.points === game.away.points

    for (const [side, other] of [[game.home, game.away], [game.away, game.home]]) {
      const key = side.ownerId ?? `team:${side.teamId}`
      if (!perManager.has(key)) perManager.set(key, { label: side.short, games: [] })
      perManager.get(key).games.push({
        season: game.season,
        week: game.week,
        result: decided
          ? decided === side ? 'W' : 'L'
          : tie ? 'T' : side.points > other.points ? 'W' : 'L',
      })
    }
  }

  const runs = []
  for (const { label, games: list } of perManager.values()) {
    let run = null
    for (const game of list) {
      if (game.result === outcome) {
        run = run ?? { label, from: game, length: 0 }
        run.length += 1
        run.to = game
      } else if (run) {
        runs.push(run)
        run = null
      }
    }
    if (run) runs.push(run)
  }

  return take(runs, (a, b) => b.length - a.length || b.to.season - a.to.season)
    .map((run, i) => ({
      rank: i + 1,
      primary: run.label,
      cells: [
        String(run.length),
        run.from.season === run.to.season && run.from.week === run.to.week
          ? weekLabel(run.from)
          : `${weekLabel(run.from)} – ${weekLabel(run.to)}`,
      ],
      link: null,
    }))
}

/** Season-long totals, from ESPN's own regular-season record. */
function seasonTotals(seasons, labels) {
  const rows = []
  for (const entry of seasons) {
    const index = teamLabelIndex(entry, labels)
    for (const team of entry.teams ?? []) {
      const record = team.record ?? {}
      if (!(record.gamesPlayed > 0)) continue
      rows.push({
        season: entry.season,
        label: index.get(team.id)?.short ?? team.name,
        pointsFor: round(record.pointsFor),
        pointsAgainst: round(record.pointsAgainst),
        perGameFor: round(record.pointsForPerGame),
        perGameAgainst: round(record.pointsAgainstPerGame),
      })
    }
  }
  return rows
}

const fixed = (n) => (Number.isFinite(n) ? n.toFixed(2) : '—')

/**
 * The whole record book.
 *
 * @param {{season:number, leagueId:number, teams:object[], matchups:object[]}[]} seasons
 * @returns {{id:string,title:string,columns:string[],rows:object[]}[]}
 */
export function buildRecords(seasons) {
  const labels = managerLabels(seasons)
  const games = collectGames(seasons, labels)
  const weeks = teamWeeks(games)
  const totals = seasonTotals(seasons, labels)

  const weekGroup = (id, title, compare) => ({
    id,
    title,
    columns: ['Team', 'Score', 'Opponent / Year'],
    rows: take(weeks, compare).map((row, i) => ({
      rank: i + 1,
      primary: row.team.short,
      cells: [fixed(row.points), `${row.opponent.short} · ${row.season}`],
      link: boxscoreUrl({
        leagueId: row.leagueId,
        season: row.season,
        week: row.week,
        teamId: row.team.teamId,
      }),
    })),
  })

  const gameGroup = (id, title, compare, value) => ({
    id,
    title,
    columns: ['Winner vs Loser', 'Score', 'Year'],
    rows: take(games, compare).map((game, i) =>
      gameRow(game, { rank: i + 1, valueCells: [value(game), String(game.season)] }),
    ),
  })

  const seasonGroup = (id, title, perGameLabel, totalLabel, key, perKey, compare) => ({
    id,
    title,
    columns: ['Team', perGameLabel, totalLabel, 'Year'],
    rows: take(totals, compare).map((row, i) => ({
      rank: i + 1,
      primary: row.label,
      cells: [fixed(row[perKey]), fixed(row[key]), String(row.season)],
      link: null,
    })),
  })

  const combined = (game) => round(game.home.points + game.away.points)
  const margin = (game) => round(Math.abs(game.home.points - game.away.points))

  return [
    weekGroup('highest-week', 'Highest Scoring Week', (a, b) => b.points - a.points),
    weekGroup('lowest-week', 'Lowest Scoring Week', (a, b) => a.points - b.points),

    gameGroup('highest-combined', 'Highest Combined Score',
      (a, b) => combined(b) - combined(a), (g) => fixed(combined(g))),
    gameGroup('lowest-combined', 'Lowest Combined Score',
      (a, b) => combined(a) - combined(b), (g) => fixed(combined(g))),

    gameGroup('largest-margin', 'Largest Margin of Victory',
      (a, b) => margin(b) - margin(a), (g) => fixed(margin(g))),
    gameGroup('smallest-margin', 'Smallest Margin of Victory',
      (a, b) => margin(a) - margin(b), (g) => fixed(margin(g))),

    seasonGroup('highest-season-pf', 'Highest Seasonal Points Total', 'PPG', 'Points',
      'pointsFor', 'perGameFor', (a, b) => b.pointsFor - a.pointsFor),
    seasonGroup('lowest-season-pf', 'Lowest Seasonal Points Total', 'PPG', 'Points',
      'pointsFor', 'perGameFor', (a, b) => a.pointsFor - b.pointsFor),

    seasonGroup('highest-season-pa', 'Highest Seasonal Points Against', 'PAPG', 'Pts Against',
      'pointsAgainst', 'perGameAgainst', (a, b) => b.pointsAgainst - a.pointsAgainst),
    seasonGroup('lowest-season-pa', 'Lowest Seasonal Points Against', 'PAPG', 'Pts Against',
      'pointsAgainst', 'perGameAgainst', (a, b) => a.pointsAgainst - b.pointsAgainst),

    {
      id: 'win-streaks',
      title: 'Longest Winning Streaks',
      columns: ['Team', 'Games', 'Span'],
      rows: streaks(games, 'W'),
    },
    {
      id: 'lose-streaks',
      title: 'Longest Losing Streaks',
      columns: ['Team', 'Games', 'Span'],
      rows: streaks(games, 'L'),
    },
  ]
}
