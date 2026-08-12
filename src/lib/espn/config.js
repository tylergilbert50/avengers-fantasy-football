/**
 * Configuration + season helpers for the ESPN Fantasy integration.
 *
 * Everything here is server-side only. The league id is deliberately read from
 * the environment rather than the request so the deployed function can never be
 * used as an open proxy that replays our private-league cookies at someone
 * else's league.
 */

/** ESPN labels a season by the calendar year it starts in. */
export function currentSeason(now = new Date()) {
  // Offseason (Feb-May) still belongs to the season that just finished.
  return now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
}

/** The first season ESPN serves from the modern `seasons/{year}` endpoint. */
export const FIRST_MODERN_SEASON = 2018

export function isValidSeason(value) {
  const season = Number(value)
  return Number.isInteger(season) && season >= 2000 && season <= currentSeason() + 1
}

/**
 * Reads ESPN settings out of an environment bag.
 *
 * @param {Record<string, string | undefined>} env
 */
export function readEspnEnv(env = {}) {
  const leagueId = (env.ESPN_LEAGUE_ID ?? '').trim()
  const season = (env.ESPN_SEASON ?? '').trim()
  const espnS2 = (env.ESPN_S2 ?? '').trim()
  const swid = normalizeSwid(env.ESPN_SWID ?? '')

  return {
    leagueId,
    defaultSeason: isValidSeason(season) ? Number(season) : currentSeason(),
    espnS2: espnS2 || null,
    swid: swid || null,
    hasCredentials: Boolean(espnS2 && swid),
  }
}

/** ESPN expects the SWID wrapped in braces; people usually paste it without. */
export function normalizeSwid(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  return value.startsWith('{') ? value : `{${value.replace(/^\{|\}$/g, '')}}`
}

export class EspnConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = 'EspnConfigError'
    this.status = 500
  }
}

export function assertConfigured(config) {
  if (!config.leagueId) {
    throw new EspnConfigError(
      'ESPN_LEAGUE_ID is not set. Copy .env.example to .env and fill it in (see docs/espn.md).',
    )
  }
  if (!/^\d+$/.test(config.leagueId)) {
    throw new EspnConfigError(`ESPN_LEAGUE_ID must be numeric, got "${config.leagueId}".`)
  }
  return config
}
