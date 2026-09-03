/**
 * One pairing's whole story, folded out of the same game log everything else
 * is.
 *
 * Nothing here is stored: a series is derived on the way out of the history
 * payload, so the week that lands in the record lands on every pairing it
 * touches at the same moment.
 *
 * Regular season only. A bracket meeting is a different kind of game — one
 * played once, under a seeding neither manager chose — and folding it into a
 * rivalry that is otherwise a decade of Sundays flatters whoever happened to
 * draw whom. `REGULAR` is the filter, and it is the only one.
 */

import { sideOutcome } from './results.js'
import { recordLabel, REGULAR } from './summary.js'

function key(name) {
  return String(name ?? '').trim().toLowerCase()
}

function round(value, places = 1) {
  const factor = 10 ** places
  return Math.round((Number(value) || 0) * factor) / factor
}

/** Chronological: the order the games were actually played in. */
function byWhen(a, b) {
  return a.season - b.season || a.week - b.week
}

/**
 * Every regular-season meeting between two managers, oriented so the manager
 * asked for first is always the `points` side.
 *
 * The log records whichever of them ESPN happened to call home that week, so a
 * meeting can be stored either way round. Turning them all to face the same way
 * here is what lets everything below read as one side against the other rather
 * than as a pile of games with two spellings.
 */
export function meetings(games = [], nameA, nameB) {
  const a = key(nameA)
  const b = key(nameB)
  if (!a || !b || a === b) return []

  return games
    .filter((game) => game.type === REGULAR)
    .filter((game) => {
      const pair = [key(game.a), key(game.b)]
      return pair.includes(a) && pair.includes(b)
    })
    .map((game) => {
      const side = key(game.a) === a ? 'a' : 'b'
      const [points, against] = side === 'a' ? [game.ap, game.bp] : [game.bp, game.ap]
      const result = sideOutcome(game, side)
      return {
        season: game.season,
        week: game.week,
        points: points ?? 0,
        against: against ?? 0,
        margin: round(Math.abs((points ?? 0) - (against ?? 0)), 2),
        // Who won, said as a side of the series rather than a side of the
        // fixture: 'a' is always the first manager asked for.
        won: result === 'wins' ? 'a' : result === 'losses' ? 'b' : null,
        result,
      }
    })
    .sort(byWhen)
}

/** The entry with the best `value`, or null when there are none to pick from. */
function pick(entries, value, better = (x, y) => x > y) {
  let best = null
  for (const entry of entries) {
    if (best === null || better(value(entry), value(best))) best = entry
  }
  return best
}

/**
 * One side of the series.
 *
 * Only their record: everything else the page shows is a fact about the series
 * rather than about one of them — the highest score in it, the widest margin
 * of it — and belongs to whichever of them happens to own it.
 */
function side(name, record) {
  return { name, ...record, recordLabel: recordLabel(record) }
}

/**
 * Every score either of them has put up, as its own thing.
 *
 * A meeting is one row of the log but two performances, and the highest and
 * lowest score of a series is asked of the performances, not the fixtures.
 */
function performances(entries = []) {
  return entries.flatMap((entry) => [
    { side: 'a', points: entry.points, season: entry.season, week: entry.week },
    { side: 'b', points: entry.against, season: entry.season, week: entry.week },
  ])
}

/** Who is on a run right now, counted back from the most recent meeting. */
function currentStreak(entries = []) {
  const played = [...entries].reverse()
  const latest = played[0]
  // A series that ended level is nobody's run — a tie breaks a streak rather
  // than extending it.
  if (!latest || latest.won === null) return null

  let count = 0
  for (const entry of played) {
    if (entry.won !== latest.won) break
    count += 1
  }
  return { side: latest.won, count }
}

/**
 * Everything one head-to-head page shows.
 *
 * @param {object} history  the /api/history payload
 * @param {string} nameA    one manager's full name
 * @param {string} nameB    the other's
 * @returns {object|null}   null unless both names belong to managers who played
 */
export function headToHeadSeries(history = {}, nameA, nameB) {
  if (!nameA || !nameB || key(nameA) === key(nameB)) return null

  const entries = meetings(history.games ?? [], nameA, nameB)

  // Counted once, from the first manager's side. The other's is the same
  // record read backwards, and deriving it rather than counting it again is
  // what guarantees the two halves of the page can never disagree.
  const record = { wins: 0, losses: 0, ties: 0 }
  for (const entry of entries) record[entry.result] += 1

  const scores = performances(entries)
  // The margin questions are only ever asked of a game somebody won: a tie has
  // a margin of nothing, and it isn't the closest game of a series in any
  // sense worth printing.
  const decided = entries.filter((entry) => entry.won !== null)

  return {
    a: side(nameA, record),
    b: side(nameB, { wins: record.losses, losses: record.wins, ties: record.ties }),

    // Newest first: the page reads the series backwards from the last time
    // they played, which is the meeting anyone is here about.
    games: [...entries].reverse(),
    played: entries.length,
    seasons: [...new Set(entries.map((entry) => entry.season))].sort(),

    highestScore: pick(scores, (score) => score.points),
    lowestScore: pick(scores, (score) => score.points, (x, y) => x < y),
    widest: pick(decided, (entry) => entry.margin),
    closest: pick(decided, (entry) => entry.margin, (x, y) => x < y),

    streak: currentStreak(entries),
  }
}
