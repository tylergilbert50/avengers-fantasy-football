import { useCallback, useEffect, useState } from 'react'
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
import { readCache, shared, writeCache } from '../lib/cache.js'

/**
 * Generic async-resource hook.
 * Returns { data, error, isLoading, refresh }.
 *
 * `cacheKey` opts the resource into the stale-while-revalidate cache: the last
 * payload paints immediately and the fetch that follows quietly replaces it, so
 * a page that has been opened before never goes back to a loading line. Leave
 * it off for anything that must be read fresh.
 */
function useResource(loader, deps, cacheKey = null) {
  const [state, setState] = useState(() => {
    const cached = cacheKey ? readCache(cacheKey) : null
    return cached
      ? { data: cached, error: null, isLoading: false }
      : { data: null, error: null, isLoading: true }
  })
  const [nonce, setNonce] = useState(0)

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    // Read again rather than trusting the initial state: the key changes when
    // the season does, and a sibling page may have filled it since.
    const cached = cacheKey ? readCache(cacheKey) : null

    setState((prev) =>
      cached
        ? { data: cached, error: null, isLoading: false }
        : { ...prev, isLoading: true, error: null },
    )

    // A cached resource shares its request, so a prefetch already in the air is
    // joined instead of repeated. That request outlives this component on
    // purpose — it finishes and fills the cache even if the page is left.
    const request = cacheKey ? shared(cacheKey, () => loader()) : loader(controller.signal)

    request
      .then((data) => {
        if (cacheKey) writeCache(cacheKey, data)
        if (active) setState({ data, error: null, isLoading: false })
      })
      .catch((error) => {
        // An aborted request is a teardown, not a failure worth surfacing.
        if (!active || error.name === 'AbortError') return
        // Neither is a failed revalidation while we have something to show:
        // day-old numbers read better than an error page.
        if (cached) return
        setState({ data: null, error, isLoading: false })
      })

    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, cacheKey])

  return { ...state, refresh }
}

/** Cache keys. One per distinct payload, so a season change is its own entry. */
const leagueKey = (season) => `league:${season ?? 'current'}`
const historyKey = (season) => `history:${season ?? 'current'}`

/**
 * Fetches a payload nobody has asked for yet and files it, so the page that
 * wants it later finds it already there.
 *
 * Failures are swallowed on purpose: the page that needs the data asks for it
 * itself and reports the failure properly. A request already in the air is
 * joined rather than repeated, so warming something twice costs nothing.
 */
function warm(key, load) {
  shared(key, load)
    .then((data) => writeCache(key, data))
    .catch(() => {})
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

/**
 * Starts the league fetch before anything asks for it.
 *
 * Called while the cover is still on screen: turning it takes a second or two,
 * which is the whole round trip, so the managers wall is drawn from a payload
 * that is already in hand. Failures are ignored — the page that needs the data
 * will ask again and report it properly.
 */
export function prefetchLeague({ season } = {}) {
  warm(leagueKey(season), () => fetchLeague({ season }))
}

/**
 * Starts the history fetch before anything asks for it.
 *
 * Every manager's profile is cut from this one payload, and it is the slowest
 * thing the site fetches — a handful of seasons of games with the best player
 * weeks read out of them. Asking for it on the way in means a face on the
 * managers wall opens onto a finished page instead of "Pulling the file…",
 * which is also why the first profile used to be the only slow one: it paid for
 * the fetch that every later profile then read out of the cache.
 */
export function prefetchHistory({ season } = {}) {
  warm(historyKey(season), () => fetchHistory({ season }))
}

/** Scored matchups. Omit `week` for the full season schedule. */
export function useMatchups({ season, week } = {}) {
  return useResource(
    (signal) => fetchMatchups({ season, week, signal }),
    [season, week],
    `matchups:${season ?? 'current'}:${week ?? 'all'}`,
  )
}

/** The all-time record book. Recomputed server-side from every season. */
export function useRecords({ season } = {}) {
  return useResource(
    (signal) => fetchRecords({ season, signal }),
    [season],
    `records:${season ?? 'current'}`,
  )
}

/** Draft boards for every season the league has. */
export function useDraft({ season } = {}) {
  return useResource(
    (signal) => fetchDraft({ season, signal }),
    [season],
    `draft:${season ?? 'current'}`,
  )
}

/** Every settled season's champion, newest first. */
export function useChampions({ season } = {}) {
  return useResource(
    (signal) => fetchChampions({ season, signal }),
    [season],
    `champions:${season ?? 'current'}`,
  )
}

/** The league's whole record — every game, live, with the archive underneath. */
export function useHistory({ season } = {}) {
  return useResource((signal) => fetchHistory({ season, signal }), [season], historyKey(season))
}

/** Waiver activity: exact counts and FAAB, plus the pickups we can name. */
export function useWaivers({ season } = {}) {
  return useResource(
    (signal) => fetchWaivers({ season, signal }),
    [season],
    `waivers:${season ?? 'current'}`,
  )
}

/** Every trade, with a verdict on each and the league's trading records. */
export function useTrades({ season } = {}) {
  return useResource(
    (signal) => fetchTrades({ season, signal }),
    [season],
    `trades:${season ?? 'current'}`,
  )
}

/**
 * This week's managers' poll.
 *
 * Never cached anywhere: it turns over on a deadline, and the payload depends
 * on whether this browser has already voted.
 */
export function usePoll() {
  return useResource((signal) => fetchPoll({ signal }), [])
}
