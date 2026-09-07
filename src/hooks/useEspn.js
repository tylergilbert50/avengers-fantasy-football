import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchChampions,
  fetchDraft,
  fetchHistory,
  fetchLeague,
  fetchMatchups,
  fetchPoll,
  fetchRecords,
  fetchTrades,
  fetchWaivers,
} from '../lib/api.js'
import { readCache, readSession, shared, writeCache, writeSession } from '../lib/cache.js'

/** How a resource treats its key. See useResource. */
const CACHED = 'cached'
const SESSION = 'session'

const STORES = {
  [CACHED]: { read: readCache, write: writeCache },
  [SESSION]: { read: readSession, write: writeSession },
}

/**
 * Generic async-resource hook.
 * Returns { data, error, isLoading, refresh, replace }.
 *
 * `key` names the payload, and two things follow from having one. Requests
 * under the same key are shared, so a page joins a prefetch already in the air
 * rather than firing a second copy of it. And under the default CACHED store
 * the key is also a cache entry: the last payload paints immediately and the
 * fetch behind it quietly replaces it, so a page that has been opened before
 * never goes back to a loading line.
 *
 * SESSION is the same bargain on a shorter lease and in memory only, for a
 * payload that would be wrong to draw from disk tomorrow but is perfectly
 * good seconds after it was fetched. Pass no key at all and it is a plain
 * fetch.
 */
function useResource(loader, deps, key = null, store = CACHED) {
  const { read, write } = STORES[store]
  const cached = () => (key ? read(key) : null)

  const [state, setState] = useState(() => {
    const hit = cached()
    return hit
      ? { data: hit, error: null, isLoading: false }
      : { data: null, error: null, isLoading: true }
  })
  const [nonce, setNonce] = useState(0)
  // Set by `replace`. A payload handed to us is newer than the request that
  // was already in the air when it arrived, so that request must not land on
  // top of it.
  const replaced = useRef(false)

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    replaced.current = false

    // Read again rather than trusting the initial state: the key changes when
    // the season does, and a sibling page may have filled it since.
    const hit = cached()

    setState((prev) =>
      hit
        ? { data: hit, error: null, isLoading: false }
        : { ...prev, isLoading: true, error: null },
    )

    // A keyed resource shares its request, so a prefetch already in the air is
    // joined instead of repeated. That request outlives this component on
    // purpose — it finishes and fills the cache even if the page is left.
    const request = key ? shared(key, () => loader()) : loader(controller.signal)

    request
      .then((data) => {
        // Superseded by `replace` while it was in the air: older than what we
        // already hold, so it neither draws nor files.
        if (replaced.current) return
        if (key) write(key, data)
        // Filed even if the page has been left — an unmount is not a reason to
        // throw away a payload the next page will want.
        if (active) setState({ data, error: null, isLoading: false })
      })
      .catch((error) => {
        // An aborted request is a teardown, not a failure worth surfacing.
        if (!active || error.name === 'AbortError') return
        // Neither is a failed revalidation while we have something to show:
        // day-old numbers read better than an error page.
        if (hit) return
        setState({ data: null, error, isLoading: false })
      })

    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, key, store])

  /**
   * Puts a payload the page already has straight in, and files it — the reply
   * to a POST that hands back the new state. Without this the page would draw
   * what it just did, then draw the older GET behind it a moment later.
   */
  const replace = useCallback(
    (data) => {
      replaced.current = true
      if (key) write(key, data)
      setState({ data, error: null, isLoading: false })
    },
    [key, write],
  )

  return { ...state, refresh, replace }
}

/** Cache keys. One per distinct payload, so a season change is its own entry. */
const leagueKey = (season) => `league:${season ?? 'current'}`
const historyKey = (season) => `history:${season ?? 'current'}`
const championsKey = (season) => `champions:${season ?? 'current'}`
const recordsKey = (season) => `records:${season ?? 'current'}`
const draftKey = (season) => `draft:${season ?? 'current'}`
const tradesKey = (season) => `trades:${season ?? 'current'}`
const waiversKey = (season) => `waivers:${season ?? 'current'}`
const matchupsKey = (season, week) => `matchups:${season ?? 'current'}:${week ?? 'all'}`
const POLL_KEY = 'poll'

/**
 * Fetches a payload nobody has asked for yet and files it, so the page that
 * wants it later finds it already there.
 *
 * A key the cache already holds is left alone: the page that opens it will
 * paint from that entry and revalidate itself, and warming a payload nobody
 * has asked for twice in a day is a request spent on nothing. A request
 * already in the air is joined rather than repeated, so warming something
 * that is mid-flight costs nothing either.
 *
 * Failures are swallowed on purpose: the page that needs the data asks for it
 * itself and reports the failure properly.
 */
function warm(key, load, store = CACHED) {
  const { read, write } = STORES[store]
  if (read(key)) return

  shared(key, load)
    .then((data) => write(key, data))
    .catch(() => {})
}

/**
 * Runs `task` when the browser next has a moment, and within two seconds
 * whether it finds one or not. Where requestIdleCallback isn't implemented, a
 * short timeout is close enough — the point is only to let the payloads the
 * arrival actually needs go first.
 */
function whenIdle(task) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(task, { timeout: 2000 })
  else setTimeout(task, 400)
}

/**
 * Warms every payload the site draws, so no page ever opens onto a loading
 * line. Called once as the app boots, while the cover is still being turned.
 *
 * In two tiers, because firing nine requests at once only means nine slow
 * ones. First the three the arrival itself leads to: the league payload behind
 * the managers wall and the standings, the history behind every manager's
 * profile and the ledger — the slowest fetch the site makes — and the champions
 * shelf. Then, once the browser has a moment, the five pages that are a panel
 * click further off. Reading a panel takes far longer than fetching one.
 *
 * The poll is warmed with the first tier, into the session store rather than
 * the cache: it turns over on a deadline and knows whether this browser has
 * voted, so it is the one payload that must never be drawn from disk a day
 * later — but held for a minute in memory it is what makes the panel open on
 * a tally instead of on a wait.
 */
export function prefetchAll({ season } = {}) {
  warm(leagueKey(season), () => fetchLeague({ season }))
  warm(historyKey(season), () => fetchHistory({ season }))
  warm(championsKey(season), () => fetchChampions({ season }))

  warm(POLL_KEY, () => fetchPoll(), SESSION)

  whenIdle(() => {
    warm(recordsKey(season), () => fetchRecords({ season }))
    warm(matchupsKey(season), () => fetchMatchups({ season }))
    warm(draftKey(season), () => fetchDraft({ season }))
    warm(tradesKey(season), () => fetchTrades({ season }))
    warm(waiversKey(season), () => fetchWaivers({ season }))
  })
}

/**
 * League overview: managers, standings, records, PF/PA.
 *
 * @example
 * const { data, isLoading, error } = useLeague()
 * data.standings[0].record.pointsFor
 */
export function useLeague({ season } = {}) {
  return useResource((signal) => fetchLeague({ season, signal }), [season], leagueKey(season))
}

/** Scored matchups. Omit `week` for the full season schedule. */
export function useMatchups({ season, week } = {}) {
  return useResource(
    (signal) => fetchMatchups({ season, week, signal }),
    [season, week],
    matchupsKey(season, week),
  )
}

/** The all-time record book. Recomputed server-side from every season. */
export function useRecords({ season } = {}) {
  return useResource((signal) => fetchRecords({ season, signal }), [season], recordsKey(season))
}

/** Draft boards for every season the league has. */
export function useDraft({ season } = {}) {
  return useResource((signal) => fetchDraft({ season, signal }), [season], draftKey(season))
}

/** Every settled season's champion, newest first. */
export function useChampions({ season } = {}) {
  return useResource((signal) => fetchChampions({ season, signal }), [season], championsKey(season))
}

/** The league's whole record — every game, live, with the archive underneath. */
export function useHistory({ season } = {}) {
  return useResource((signal) => fetchHistory({ season, signal }), [season], historyKey(season))
}

/** Waiver activity: exact counts and FAAB, plus the pickups we can name. */
export function useWaivers({ season } = {}) {
  return useResource((signal) => fetchWaivers({ season, signal }), [season], waiversKey(season))
}

/** Every trade, with a verdict on each and the league's trading records. */
export function useTrades({ season } = {}) {
  return useResource((signal) => fetchTrades({ season, signal }), [season], tradesKey(season))
}

/**
 * This week's managers' poll.
 *
 * Never filed on disk: it turns over on a deadline, and the payload depends on
 * whether this browser has already voted — a ballot drawn from yesterday would
 * show the wrong week, or offer a vote that has already been cast. A minute in
 * memory is a different matter, and it is what the arrival's warm-up fills: the
 * panel opens on the tally it fetched while the cover was turning, and a fresh
 * copy lands behind it.
 */
export function usePoll() {
  return useResource((signal) => fetchPoll({ signal }), [], POLL_KEY, SESSION)
}
