/**
 * Browser-side client for our own /api routes.
 *
 * The browser never talks to ESPN directly: ESPN sends no CORS headers, and
 * private leagues need cookies that must not ship to the client.
 */

async function getJson(path, { signal } = {}) {
  const response = await fetch(path, { signal, headers: { accept: 'application/json' } })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    throw new Error(`Bad response from ${path} (HTTP ${response.status}).`)
  }

  if (!response.ok) {
    throw new Error(payload?.message ?? `Request to ${path} failed (HTTP ${response.status}).`)
  }
  return payload
}

function withParams(path, params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value != null && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

/** Managers, standings, records, points for / against. */
export function fetchLeague({ season, signal } = {}) {
  return getJson(withParams('/api/league', { season }), { signal })
}

/** Scored schedule. Omit `week` for the whole season. */
export function fetchMatchups({ season, week, signal } = {}) {
  return getJson(withParams('/api/matchups', { season, week }), { signal })
}

/** All-time records across every season the league has. */
export function fetchRecords({ season, signal } = {}) {
  return getJson(withParams('/api/records', { season }), { signal })
}

/** Every season's draft board. */
export function fetchDraft({ season, signal } = {}) {
  return getJson(withParams('/api/draft', { season }), { signal })
}

/** Who won each season, newest first. */
export function fetchChampions({ season, signal } = {}) {
  return getJson(withParams('/api/champions', { season }), { signal })
}

/** The league's whole record: ESPN's seasons over the workbook's archive. */
export function fetchHistory({ season, signal } = {}) {
  return getJson(withParams('/api/history', { season }), { signal })
}

/** Every trade the league has made, with who won it. */
export function fetchTrades({ season, signal } = {}) {
  return getJson(withParams('/api/trades', { season }), { signal })
}

/** The waiver wire: who works it, and what they found on it. */
export function fetchWaivers({ season, signal } = {}) {
  return getJson(withParams('/api/waivers', { season }), { signal })
}

/** This week's managers' poll: the ballot while it's open, the table once it isn't. */
export function fetchPoll({ signal } = {}) {
  return getJson('/api/poll', { signal })
}

/**
 * Casts a ballot — an array of manager ids, best first.
 *
 * The week isn't sent: the server decides which week a ballot counts for, so a
 * doctored request can't stuff a week that has already been settled.
 */
export async function submitBallot({ ballot, signal } = {}) {
  const response = await fetch('/api/poll/vote', {
    method: 'POST',
    signal,
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    // The voter cookie rides on this; it is same-origin, but say so.
    credentials: 'same-origin',
    body: JSON.stringify({ ballot }),
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    throw new Error(`Bad response from the poll (HTTP ${response.status}).`)
  }

  if (!response.ok) {
    throw new Error(payload?.message ?? `Your ballot wasn’t accepted (HTTP ${response.status}).`)
  }
  return payload
}
