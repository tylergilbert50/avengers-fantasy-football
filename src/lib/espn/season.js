/**
 * Fetching one season of league data, once.
 *
 * Lives apart from the route handlers so the poll can read the same league blob
 * the standings and record book already pulled — the memo below is what makes
 * that free — without the two handler modules having to import each other.
 */

import { assertConfigured, isValidSeason, readEspnEnv } from './config.js'
import { fetchLeagueRaw } from './fetchLeague.js'

/** Simple per-instance memo so a burst of requests hits ESPN once. */
const memo = new Map()
const MEMO_TTL_MS = 60_000

export async function memoized(key, produce) {
  const hit = memo.get(key)
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.value

  const value = await produce()
  memo.set(key, { at: Date.now(), value })
  // The map is bounded by (seasons x weeks); trim anyway so a long-lived
  // instance can't grow without limit.
  if (memo.size > 50) {
    for (const [k, v] of memo) if (Date.now() - v.at >= MEMO_TTL_MS) memo.delete(k)
  }
  return value
}

export function clearEspnCache() {
  memo.clear()
}

export function resolveSeason(params, config) {
  const requested = params.get('season')
  if (requested == null || requested === '') return config.defaultSeason
  if (!isValidSeason(requested)) {
    const error = new Error(`Invalid season "${requested}".`)
    error.status = 400
    throw error
  }
  return Number(requested)
}

/** Everything a season's history needs, in one request. */
export const HISTORY_VIEWS = Object.freeze(['mMatchupScore', 'mTeam', 'mSettings', 'mStandings'])

/**
 * The raw league blob for the requested season, from the memo when it's warm.
 *
 * @returns {Promise<{ raw: object, season: number, config: object }>}
 */
export async function loadLeague({ env, params, views }) {
  const config = assertConfigured(readEspnEnv(env))
  const season = resolveSeason(params, config)

  const raw = await memoized(`${config.leagueId}:${season}:${views.join(',')}`, () =>
    fetchLeagueRaw({
      leagueId: config.leagueId,
      season,
      views,
      espnS2: config.espnS2,
      swid: config.swid,
    }),
  )

  return { raw, season, config }
}
