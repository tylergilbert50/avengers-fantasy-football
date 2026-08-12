/**
 * Server-side ESPN fetch. Never import this from browser code: it attaches the
 * private-league cookies.
 */

import { FIRST_MODERN_SEASON } from './config.js'
import { ESPN_BASE, leagueHistoryUrl, leagueUrl } from './endpoints.js'

export class EspnApiError extends Error {
  constructor(message, { status = 502, cause } = {}) {
    super(message)
    this.name = 'EspnApiError'
    this.status = status
    this.cause = cause
  }
}

// ESPN 403s a bare `node-fetch`-looking user agent often enough to be annoying.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function buildCookieHeader({ espnS2, swid }) {
  if (!espnS2 || !swid) return null
  // Real espn_s2 values contain %-escapes already. Encoding an
  // already-encoded value produces %25xx and a silent 401, so only encode
  // when the value looks raw.
  const s2 = /%[0-9A-Fa-f]{2}/.test(espnS2) ? espnS2 : encodeURIComponent(espnS2)
  return `espn_s2=${s2}; SWID=${swid}`
}

function describeHttpError(status, { leagueId, season, hasCredentials }) {
  if (status === 401) {
    return hasCredentials
      ? `ESPN rejected the credentials for league ${leagueId} (401). The espn_s2 / SWID cookies have most likely expired — grab fresh ones.`
      : `League ${leagueId} is private (401). Set ESPN_S2 and ESPN_SWID, or make the league public in ESPN's league settings.`
  }
  if (status === 403) {
    return `ESPN refused the request for league ${leagueId} (403). The credentials may not have access to this league.`
  }
  if (status === 404) {
    return `ESPN has no league ${leagueId} for season ${season} (404). Check ESPN_LEAGUE_ID, and that the league existed that year.`
  }
  if (status === 429) {
    return 'ESPN is rate limiting us (429). Back off and retry in a minute.'
  }
  return `ESPN returned HTTP ${status} for league ${leagueId} (season ${season}).`
}

async function requestJson(url, { cookie, signal, filter } = {}) {
  const headers = { accept: 'application/json', 'user-agent': USER_AGENT }
  if (cookie) headers.cookie = cookie
  // ESPN's server-side filtering rides on this header rather than the query.
  if (filter) headers['x-fantasy-filter'] = JSON.stringify(filter)

  let response
  try {
    response = await fetch(url, { headers, signal, redirect: 'follow' })
  } catch (error) {
    throw new EspnApiError(`Could not reach ESPN: ${error.message}`, { cause: error })
  }

  if (!response.ok) {
    const error = new EspnApiError(`HTTP ${response.status}`, { status: response.status })
    error.httpStatus = response.status
    throw error
  }

  try {
    return await response.json()
  } catch (error) {
    throw new EspnApiError('ESPN returned a non-JSON body (usually an auth redirect).', {
      cause: error,
    })
  }
}

/**
 * playerId -> { name, positionId } for one season.
 *
 * Draft records carry ids only. The league's own player view rejects a lookup
 * this size (400s past a few dozen ids), so this uses the season-wide player
 * list instead: one request, every player that year, and the map is built and
 * the payload dropped straight away. Callers are expected to memoize the map,
 * not the response — the response is over a megabyte for older seasons.
 */
export async function fetchPlayerNames({ season, ids = [], espnS2, swid, signal }) {
  const cookie = buildCookieHeader({ espnS2, swid })
  const url = `${ESPN_BASE}/seasons/${season}/players?view=players_wl`

  // The filter header is not optional: without it this endpoint answers with a
  // short default slice and most ids come back unresolved. Asking for the ids
  // outright is also what keeps the response from being the entire player
  // universe for that year.
  const filter = ids.length
    ? { players: { filterIds: { value: ids }, limit: Math.max(ids.length, 100) } }
    : null

  const payload = await requestJson(url, { cookie, signal, filter })
  const list = Array.isArray(payload) ? payload : (payload?.players ?? [])

  const names = new Map()
  for (const entry of list) {
    // The shape differs between the season list and the league view.
    const player = entry?.player ?? entry
    const id = entry?.id ?? player?.id
    if (id == null) continue
    names.set(id, { name: player?.fullName ?? null, positionId: player?.defaultPositionId ?? null })
  }
  return names
}

/** ESPN's lineup slots for players who didn't start. */
const BENCH = 20
const INJURED_RESERVE = 21

/**
 * Every player who started in one week, with what they scored.
 *
 * Player scores only exist per scoring period — there is no season-wide view of
 * them — so this is one request per week, and each is close to a megabyte. The
 * caller is expected to keep the handful of numbers it wants and drop the
 * payload, never to memoize the response itself.
 *
 * @returns {Promise<Array<{ teamId: number, playerId: number, player: string,
 *   positionId: number, score: number }>>}
 */
export async function fetchPlayerWeek({ leagueId, season, week, espnS2, swid, signal }) {
  const cookie = buildCookieHeader({ espnS2, swid })
  const url = leagueUrl({ leagueId, season, views: ['mBoxscore'], scoringPeriodId: week })
  const payload = await requestJson(url, { cookie, signal })

  const players = []
  for (const entry of payload?.schedule ?? []) {
    for (const side of [entry?.home, entry?.away]) {
      // Only the sides ESPN filled in for this scoring period carry a roster.
      for (const slot of side?.rosterForCurrentScoringPeriod?.entries ?? []) {
        if (slot.lineupSlotId === BENCH || slot.lineupSlotId === INJURED_RESERVE) continue
        const player = slot.playerPoolEntry?.player
        if (!player?.fullName) continue

        players.push({
          teamId: side.teamId,
          playerId: slot.playerId ?? player.id,
          player: player.fullName,
          positionId: player.defaultPositionId ?? null,
          score: Math.round((Number(slot.playerPoolEntry?.appliedStatTotal) || 0) * 100) / 100,
        })
      }
    }
  }
  return players
}

/**
 * Everyone rostered in one week — bench included — with what they scored.
 *
 * The same request `fetchPlayerWeek` makes, kept whole. Trades need the players
 * who *didn't* start just as much as the ones who did: a benched player is
 * still evidence of who owned him that week, which is what turns a run of weeks
 * into an ownership timeline, and sitting on the bench is exactly the outcome
 * the trade verdict is trying to catch.
 *
 * Note that the week's roster has to come from `mBoxscore`. The cheaper-looking
 * `mRoster&scoringPeriodId=N` reports that week's lineup slots correctly but
 * pairs them with an `appliedStatTotal` that is not that week's score, which
 * would silently inflate every total.
 *
 * As with `fetchPlayerWeek`, each response is close to a megabyte: keep the
 * handful of fields wanted here and drop the payload, never memoize the
 * response itself.
 *
 * @returns {Promise<Array<{ teamId: number, playerId: number, player: string,
 *   positionId: number, slot: number, score: number }>>}
 */
export async function fetchRosterWeek({ leagueId, season, week, espnS2, swid, signal }) {
  const cookie = buildCookieHeader({ espnS2, swid })
  const url = leagueUrl({ leagueId, season, views: ['mBoxscore'], scoringPeriodId: week })
  const payload = await requestJson(url, { cookie, signal })

  const entries = []
  for (const entry of payload?.schedule ?? []) {
    for (const side of [entry?.home, entry?.away]) {
      for (const slot of side?.rosterForCurrentScoringPeriod?.entries ?? []) {
        const player = slot.playerPoolEntry?.player
        if (!player?.fullName) continue

        entries.push({
          teamId: side.teamId,
          playerId: slot.playerId ?? player.id,
          player: player.fullName,
          positionId: player.defaultPositionId ?? null,
          slot: slot.lineupSlotId ?? null,
          score: Math.round((Number(slot.playerPoolEntry?.appliedStatTotal) || 0) * 100) / 100,
        })
      }
    }
  }
  return entries
}

/**
 * When each scoring period started, from the season's pro football schedule.
 *
 * Only ever a tie-breaker — see `tradeWeekFor` in src/lib/trades/build.js for
 * why a trade's week is read off the rosters rather than off the clock.
 */
export async function fetchWeekStarts({ season, espnS2, swid, signal }) {
  const cookie = buildCookieHeader({ espnS2, swid })
  const payload = await requestJson(`${ESPN_BASE}/seasons/${season}?view=proTeamSchedules_wl`, {
    cookie,
    signal,
  })

  const earliest = new Map()
  for (const team of payload?.settings?.proTeams ?? []) {
    for (const [period, games] of Object.entries(team?.proGamesByScoringPeriod ?? {})) {
      const week = Number(period)
      for (const game of games ?? []) {
        const current = earliest.get(week)
        if (game?.date != null && (current == null || game.date < current)) earliest.set(week, game.date)
      }
    }
  }

  return [...earliest.entries()]
    .map(([week, startsAt]) => ({ week, startsAt }))
    .sort((a, b) => a.week - b.week)
}

/**
 * Fetches the raw league blob.
 *
 * Seasons older than the current one are served by the `leagueHistory`
 * endpoint, which wraps the league in an array. We try the modern endpoint
 * first and fall back, since ESPN is inconsistent about which one answers for
 * the most recently completed season.
 *
 * @returns {Promise<object>} the raw ESPN league object
 */
export async function fetchLeagueRaw({
  leagueId,
  season,
  views,
  scoringPeriodId,
  espnS2,
  swid,
  signal,
}) {
  const cookie = buildCookieHeader({ espnS2, swid })
  const hasCredentials = Boolean(cookie)
  const useHistoryFirst = season < FIRST_MODERN_SEASON

  const attempts = useHistoryFirst
    ? [{ history: true }, { history: false }]
    : [{ history: false }, { history: true }]

  let lastError = null

  for (const attempt of attempts) {
    const url = attempt.history
      ? leagueHistoryUrl({ leagueId, season, views })
      : leagueUrl({ leagueId, season, views, scoringPeriodId })

    try {
      const payload = await requestJson(url, { cookie, signal })
      const league = Array.isArray(payload) ? payload[0] : payload
      if (!league || typeof league !== 'object') {
        throw new EspnApiError('ESPN returned an empty league payload.')
      }
      return league
    } catch (error) {
      lastError = error
      // Only a 404 is worth retrying against the other endpoint; auth and rate
      // limit failures will fail the same way twice.
      if (error.httpStatus !== 404) break
    }
  }

  if (lastError?.httpStatus) {
    throw new EspnApiError(
      describeHttpError(lastError.httpStatus, { leagueId, season, hasCredentials }),
      { status: lastError.httpStatus === 429 ? 429 : 502 },
    )
  }
  throw lastError ?? new EspnApiError('Unknown ESPN failure.')
}
