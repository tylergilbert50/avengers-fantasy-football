/**
 * A stale-while-revalidate cache for our own /api responses.
 *
 * Everything this site draws is a slow-moving read: who the managers are, a
 * standings table, seasons that finished years ago. Waiting on the network to
 * draw them again is waiting for an answer we already have — so the last good
 * payload is shown straight away and a fresh one is fetched behind it.
 *
 * Two layers, both cheap:
 *   - a Map, so a second page asking for the same thing this visit pays nothing
 *   - localStorage, so the first page of the *next* visit pays nothing either
 *
 * Nothing here is load-bearing. Every path falls back to a plain fetch, which
 * is what a browser with storage switched off gets.
 */

/** Bumped when a payload's shape changes; older entries then simply miss. */
const VERSION = 1
const PREFIX = 'afl:cache:'
const KEY_PREFIX = `${PREFIX}v${VERSION}:`

/** Older than a day and we'd rather wait for the truth than show the past. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

/** A payload bigger than this isn't worth spending the 5MB quota on. */
const MAX_CHARS = 512 * 1024

const memory = new Map()
const inflight = new Map()
const session = new Map()

/**
 * How long a session entry is worth drawing. Long enough to cover the walk
 * from the cover to a panel, short enough that a tab left open all morning
 * doesn't paint yesterday's poll before correcting itself.
 */
const SESSION_MAX_AGE_MS = 60 * 1000

/**
 * The other cache: memory only, and only for a minute.
 *
 * For a payload that can't be filed on disk — one that turns over on a
 * deadline, or that knows who this browser is — but that still shouldn't be
 * fetched twice in the same breath. The poll is the case: the copy warmed
 * while the cover was turning is seconds old by the time the panel is
 * clicked, and fetching it again is the wait that this saves. It is never
 * written to localStorage, so the next visit always asks the server.
 */
export function readSession(key) {
  const entry = session.get(key)
  if (!entry) return null

  if (Date.now() - entry.at > SESSION_MAX_AGE_MS) {
    session.delete(key)
    return null
  }
  return entry.data
}

/** Keeps `data` for the next minute of this visit, and no longer. */
export function writeSession(key, data) {
  session.set(key, { at: Date.now(), data })
}

/** localStorage, or null where reaching for it throws (private mode, policy). */
function disk() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** The last payload stored under `key`, or null if there isn't a usable one. */
export function readCache(key) {
  if (memory.has(key)) return memory.get(key)

  const store = disk()
  if (!store) return null

  try {
    const raw = store.getItem(KEY_PREFIX + key)
    if (!raw) return null

    const entry = JSON.parse(raw)
    if (!entry || typeof entry.at !== 'number' || Date.now() - entry.at > MAX_AGE_MS) {
      store.removeItem(KEY_PREFIX + key)
      return null
    }

    memory.set(key, entry.data)
    return entry.data
  } catch {
    // Corrupt or unreadable: treat it as a miss and let the fetch decide.
    return null
  }
}

/** Drops everything this cache owns, old versions included. */
function evict(store) {
  try {
    for (const key of Object.keys(store)) {
      if (key.startsWith(PREFIX)) store.removeItem(key)
    }
  } catch {
    // Nothing to do about it; the memory layer still works.
  }
}

/** Keeps `data` for next time. Failing to is never an error worth raising. */
export function writeCache(key, data) {
  memory.set(key, data)

  const store = disk()
  if (!store) return

  let raw
  try {
    raw = JSON.stringify({ at: Date.now(), data })
  } catch {
    return // not serializable — the memory layer still has it
  }
  if (raw.length > MAX_CHARS) return

  try {
    store.setItem(KEY_PREFIX + key, raw)
  } catch {
    // Out of room. Our own stale entries are the first thing that should go.
    evict(store)
    try {
      store.setItem(KEY_PREFIX + key, raw)
    } catch {
      // Still no. It lives in memory for this visit and that's enough.
    }
  }
}

/**
 * Runs `start` unless a request for the same key is already in the air, in
 * which case that one is joined.
 *
 * This is what makes a prefetch free: the page that opens a moment later waits
 * on the request already running instead of firing a second one.
 */
export function shared(key, start) {
  const pending = inflight.get(key)
  if (pending) return pending

  const done = () => {
    if (inflight.get(key) === tracked) inflight.delete(key)
  }
  const tracked = start().then(
    (value) => {
      done()
      return value
    },
    (error) => {
      done()
      throw error
    },
  )

  inflight.set(key, tracked)
  return tracked
}
