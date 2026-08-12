/**
 * One manager's career, folded out of the same game log everything else is.
 *
 * Nothing here is stored — a profile is derived on the way out of the history
 * payload, so a week that lands in the record lands on every profile it touches
 * at the same moment.
 */

import { allTimeTable, recordLabel, winPct } from './summary.js'

const PLAYOFF = 'P'

function key(name) {
  return String(name ?? '').trim().toLowerCase()
}

function round(value, places = 1) {
  const factor = 10 ** places
  return Math.round((Number(value) || 0) * factor) / factor
}

/** The two sides of a game as (owner, their points, the other side's points). */
function sides(game) {
  return [
    [game.a, game.ap, game.bp],
    [game.b, game.bp, game.ap],
  ]
}

/**
 * A week needs this many teams playing to have a top and a bottom worth
 * counting. It rules out a championship week where two teams are left and one
 * of them is bottom of it by definition.
 */
const ENOUGH_TEAMS = 4

/**
 * How often this manager was the highest and lowest scorer of a whole week.
 *
 * Counted across everyone who played that week rather than within their own
 * game: topping the week means outscoring the league, not just the team you
 * were drawn against.
 *
 * Playoff weeks count, which is the league's own convention — checked against
 * the profile card it keeps, where Connor's eleven top weeks only add up with
 * the bracket included.
 */
export function weekExtremes(games = [], name) {
  const weeks = new Map()

  for (const game of games) {
    const id = `${game.season}|${game.week}`
    if (!weeks.has(id)) weeks.set(id, [])
    for (const [owner, points] of sides(game)) {
      if (points == null) continue
      weeks.get(id).push({ owner, points })
    }
  }

  let top = 0
  let bottom = 0
  for (const scores of weeks.values()) {
    if (scores.length < ENOUGH_TEAMS) continue

    const highest = Math.max(...scores.map((entry) => entry.points))
    const lowest = Math.min(...scores.map((entry) => entry.points))

    for (const entry of scores) {
      if (key(entry.owner) !== key(name)) continue
      if (entry.points === highest) top += 1
      if (entry.points === lowest) bottom += 1
    }
  }

  return { top, bottom }
}

/** A manager's seasons: what they went, what they scored, how they finished. */
export function managerSeasons({ games = [], finishes = [], name }) {
  const seasons = new Map()

  const entry = (season) => {
    if (!seasons.has(season)) {
      seasons.set(season, {
        season,
        wins: 0, losses: 0, ties: 0,
        pointsFor: 0, pointsAgainst: 0, games: 0,
        madePlayoffs: false,
        finish: null,
      })
    }
    return seasons.get(season)
  }

  for (const game of games) {
    for (const [owner, forPoints, againstPoints] of sides(game)) {
      if (key(owner) !== key(name)) continue

      const season = entry(game.season)
      // A bracket game is the appearance; it isn't part of the season record,
      // which is what the standings were made of.
      if (game.type === PLAYOFF) {
        season.madePlayoffs = true
        continue
      }

      season.games += 1
      season.pointsFor += forPoints ?? 0
      season.pointsAgainst += againstPoints ?? 0
      if (forPoints > againstPoints) season.wins += 1
      else if (forPoints < againstPoints) season.losses += 1
      else season.ties += 1
    }
  }

  for (const finish of finishes) {
    if (key(finish.owner) !== key(name)) continue
    const season = seasons.get(finish.season)
    if (season) season.finish = finish.rank
  }

  return [...seasons.values()]
    .sort((a, b) => a.season - b.season)
    .map((season) => ({
      ...season,
      recordLabel: recordLabel(season),
      pointsForPerGame: season.games ? round(season.pointsFor / season.games) : 0,
      pointsAgainstPerGame: season.games ? round(season.pointsAgainst / season.games) : 0,
    }))
}

/**
 * Everything one manager's page shows.
 *
 * @param {object} history  the /api/history payload
 * @param {string} name     the manager's full name
 * @returns {object|null}   null for a name that never played
 */
export function managerProfile(history = {}, name) {
  if (!name) return null

  // Their line comes from the table of everyone who has ever played, so a
  // retired manager still has a profile.
  const table = allTimeTable(history)
  const row = table.find((entry) => key(entry.name) === key(name))
  if (!row) return null

  // The rank, though, is against the managers still in the league — the same
  // ten the history sheet ranks. A retired manager has no place in that, so
  // they get no rank rather than a misleading one.
  const current = allTimeTable(history, { retired: false })
  const standing = current.find((entry) => key(entry.name) === key(name))

  const seasons = managerSeasons({
    games: history.games ?? [],
    finishes: history.finishes ?? [],
    name: row.name,
  })

  const extremes = weekExtremes(history.games ?? [], row.name)

  return {
    name: row.name,
    status: row.status,
    titles: row.titles,
    sackos: row.sackos,
    seasonCount: row.seasonCount,

    record: row.regular,
    recordLabel: row.recordLabel,
    winPct: winPct(row.regular),
    rank: standing?.rank ?? null,
    of: current.length,

    playoff: row.playoff,
    playoffLabel: row.playoffLabel,
    playoffAppearances: seasons.filter((season) => season.madePlayoffs).length,

    pointsForPerGame: row.pointsForPerGame,
    pointsAgainstPerGame: row.pointsAgainstPerGame,

    topWeeks: extremes.top,
    bottomWeeks: extremes.bottom,

    seasons,
    // Only the seasons that were actually settled — a year in progress has no
    // finish to plot.
    finishes: seasons.filter((season) => season.finish != null)
      .map((season) => ({ season: season.season, rank: season.finish })),
  }
}
