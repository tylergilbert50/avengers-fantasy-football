/**
 * Vote storage, on Supabase's REST API (PostgREST).
 *
 * **Server only.** This carries the service-role key, which bypasses row-level
 * security — importing it from browser code would hand every visitor the keys
 * to the database.
 *
 * Talking to PostgREST over plain `fetch` rather than pulling in the Supabase
 * client keeps the site's dependency list at react + react-dom, and the two
 * queries the poll needs are a URL each.
 */

import { createHash, randomUUID } from 'node:crypto'

const TABLE = 'poll_votes'

export class PollStoreError extends Error {
  constructor(message, { status = 502, cause } = {}) {
    super(message)
    this.name = 'PollStoreError'
    this.status = status
    this.cause = cause
  }
}

/** Thrown when the database's own uniqueness rule catches a second ballot. */
export class DuplicateVoteError extends Error {
  constructor(message = 'You have already voted in this week’s poll.') {
    super(message)
    this.name = 'DuplicateVoteError'
    this.status = 409
  }
}

/**
 * Addresses are stored as a salted hash, never in the clear: the poll needs to
 * recognise one it has seen before, which a hash does, and nothing else.
 */
export function hashIp(ip, salt) {
  if (!ip) return ''
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

/** A fresh identity for a browser that has never voted here. */
export function newVoterId() {
  return randomUUID()
}

function headers(config, extra = {}) {
  return {
    apikey: config.key,
    authorization: `Bearer ${config.key}`,
    accept: 'application/json',
    ...extra,
  }
}

async function request(url, options, what) {
  let response
  try {
    response = await fetch(url, options)
  } catch (error) {
    throw new PollStoreError(`Could not reach the poll database: ${error.message}`, { cause: error })
  }

  if (!response.ok) {
    let detail = ''
    try {
      detail = (await response.json())?.message ?? ''
    } catch {
      // A non-JSON error body tells us nothing more than the status does.
    }
    const error = new PollStoreError(
      `The poll database refused to ${what} (HTTP ${response.status}${detail ? `: ${detail}` : ''}).`,
    )
    error.httpStatus = response.status
    throw error
  }

  return response
}

/**
 * Every ballot cast in one week.
 *
 * The whole week is read rather than counted in the database because the tally
 * has to happen in JS anyway — points depend on each ballot's ordering — and
 * ten ballots is nothing to carry.
 */
export async function fetchVotes({ config, season, week }) {
  if (week == null) return []

  const url =
    `${config.url}/rest/v1/${TABLE}` +
    `?season=eq.${season}&week=eq.${week}&select=voter_id,ip_hash,ballot`

  const response = await request(url, { headers: headers(config) }, 'read the votes')
  const rows = await response.json()

  return (Array.isArray(rows) ? rows : []).map((row) => ({
    voterId: row.voter_id,
    ipHash: row.ip_hash,
    ballot: Array.isArray(row.ballot) ? row.ballot : [],
  }))
}

/**
 * Records one ballot.
 *
 * The unique index on (season, week, voter_id) is what actually enforces one
 * vote each — the check before this call is for a friendly message, this is for
 * two tabs pressing submit at the same moment.
 */
export async function insertVote({ config, season, week, voterId, ipHash, ballot }) {
  const url = `${config.url}/rest/v1/${TABLE}`

  try {
    await request(
      url,
      {
        method: 'POST',
        headers: headers(config, {
          'content-type': 'application/json',
          prefer: 'return=minimal',
        }),
        body: JSON.stringify({
          season,
          week,
          voter_id: voterId,
          ip_hash: ipHash,
          ballot,
        }),
      },
      'record the vote',
    )
  } catch (error) {
    if (error.httpStatus === 409) throw new DuplicateVoteError()
    throw error
  }
}
