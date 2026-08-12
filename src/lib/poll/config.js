/**
 * Poll configuration. Server-side only — the service key here can read and
 * write every row in the database, so it must never reach the browser. All poll
 * access goes through our own /api routes for that reason.
 */

import { DEFAULT_TIMEZONE } from './schedule.js'

/** How long a browser is remembered as having voted. Longer than a season. */
export const VOTER_COOKIE = 'nafl_voter'
export const VOTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 400

function positiveInt(value, fallback) {
  const raw = String(value ?? '').trim()
  if (raw === '') return fallback
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

/**
 * @param {Record<string, string | undefined>} env
 */
export function readPollEnv(env = {}) {
  // Supabase's dashboard shows the REST endpoint with `/rest/v1/` on the end,
  // which is what gets copied. The store builds that path itself, so take it
  // off rather than reaching `/rest/v1/rest/v1/poll_votes` and 404ing.
  const url = (env.SUPABASE_URL ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '')
  const key = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

  return {
    url,
    key,
    // Raw addresses are never stored — see hashIp. Without a salt the hash of a
    // home IP is trivially reversible by trying every address.
    ipSalt: (env.POLL_IP_SALT ?? '').trim(),
    // Housemates and anyone on the same office wifi share an address, so this
    // is a knob rather than a rule: raise it if a real voter gets turned away,
    // or set it to 0 to stop checking addresses at all.
    maxVotesPerIp: positiveInt(env.POLL_MAX_VOTES_PER_IP, 1),
    timeZone: (env.POLL_TIMEZONE ?? '').trim() || DEFAULT_TIMEZONE,
    configured: Boolean(url && key),

    // Test mode. Setting a week pins the poll to it and ignores both the
    // calendar and the season, so the ballot can be driven in August. The page
    // says so in a banner whenever it is on — a poll that looks real but isn't
    // would collect real ballots into a week that never happens.
    testWeek: positiveInt(env.POLL_TEST_WEEK, 0) || null,
    testPhase:
      (env.POLL_TEST_PHASE ?? '').trim().toLowerCase() === 'closed' ? 'closed' : 'open',
  }
}

export class PollConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PollConfigError'
    // 503 rather than 500: the site is fine, this one feature isn't plugged in.
    this.status = 503
  }
}

export function assertPollConfigured(config) {
  if (!config.configured) {
    throw new PollConfigError(
      'The poll has no database yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see docs/poll.md).',
    )
  }
  if (!config.ipSalt) {
    throw new PollConfigError('POLL_IP_SALT is not set. Generate one (see docs/poll.md) — voter addresses are hashed with it.')
  }
  return config
}
