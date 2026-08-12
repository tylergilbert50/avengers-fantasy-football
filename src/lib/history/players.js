/**
 * The best single weeks any one player has put up.
 *
 * ESPN only holds player scores a week at a time — there is no season-wide
 * view — so a season costs one request per week. That's affordable for the
 * years the workbook never covered, and the workbook's own list stands for the
 * ones it did.
 *
 * Pure functions; the fetching lives in the handler.
 */

/** ESPN's position ids. Anything else shows as no position rather than a number. */
const POSITIONS = Object.freeze({
  1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 7: 'P', 9: 'DT', 10: 'DE',
  11: 'LB', 12: 'CB', 13: 'S', 16: 'D/ST', 17: 'K',
})

export function positionName(positionId) {
  return POSITIONS[positionId] ?? ''
}

/** How many weeks the page shows. */
export const TOP_WEEKS = 40

/**
 * One week of ESPN player scores as history entries.
 *
 * @param {object[]} players  from fetchPlayerWeek
 * @param {Map<number,string>} owners  teamId -> manager
 */
export function weekEntries({ season, week, players = [], owners = new Map() }) {
  return players.map((entry) => ({
    season,
    week,
    player: entry.player,
    score: entry.score,
    position: positionName(entry.positionId),
    manager: owners.get(entry.teamId) ?? null,
  }))
}

/** The same performance, however it reached us. */
function fingerprint(entry) {
  return `${entry.season}|${entry.week}|${String(entry.player).toLowerCase()}`
}

/**
 * The best weeks across every source, biggest first.
 *
 * Live entries win a tie with the archive: where both have a week, ESPN's score
 * is the authoritative one, the same way it is for game scores.
 */
export function bestWeeks({ archive = [], live = [], limit = TOP_WEEKS } = {}) {
  const byPerformance = new Map()

  for (const entry of archive) byPerformance.set(fingerprint(entry), entry)
  for (const entry of live) byPerformance.set(fingerprint(entry), entry)

  return [...byPerformance.values()]
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score || a.season - b.season || a.week - b.week)
    .slice(0, limit)
}

/**
 * Which seasons still need fetching, newest first.
 *
 * A season the workbook already covers is left alone — its weeks are on file
 * and would cost seventeen requests to learn nothing. Newest first because a
 * budget that runs out should run out on the oldest season, not this one.
 */
export function seasonsToFetch({ seasons = [], archive = [] } = {}) {
  const covered = new Set(archive.map((entry) => entry.season))
  return [...seasons].filter((season) => !covered.has(season)).sort((a, b) => b - a)
}

/**
 * The weeks of a season that were actually played.
 *
 * Asking ESPN for a week nobody has played yet costs a megabyte to be told
 * nothing, so the game log decides what's worth fetching.
 */
export function playedWeeks(games = [], season) {
  return [...new Set(games.filter((game) => game.season === season).map((game) => game.week))]
    .sort((a, b) => a - b)
}
