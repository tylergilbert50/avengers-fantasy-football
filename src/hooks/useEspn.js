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

/**
 * Generic async-resource hook.
 * Returns { data, error, isLoading, refresh }.
 */
function useResource(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, isLoading: true })
  const [nonce, setNonce] = useState(0)

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    loader(controller.signal)
      .then((data) => {
        if (active) setState({ data, error: null, isLoading: false })
      })
      .catch((error) => {
        // An aborted request is a teardown, not a failure worth surfacing.
        if (!active || error.name === 'AbortError') return
        setState({ data: null, error, isLoading: false })
      })

    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { ...state, refresh }
}

/**
 * League overview: managers, standings, records, PF/PA.
 *
 * @example
 * const { data, isLoading, error } = useLeague()
 * data.standings[0].record.pointsFor
 */
export function useLeague({ season } = {}) {
  return useResource((signal) => fetchLeague({ season, signal }), [season])
}

/** Scored matchups. Omit `week` for the full season schedule. */
export function useMatchups({ season, week } = {}) {
  return useResource((signal) => fetchMatchups({ season, week, signal }), [season, week])
}

/** The all-time record book. Recomputed server-side from every season. */
export function useRecords({ season } = {}) {
  return useResource((signal) => fetchRecords({ season, signal }), [season])
}

/** Draft boards for every season the league has. */
export function useDraft({ season } = {}) {
  return useResource((signal) => fetchDraft({ season, signal }), [season])
}

/** Every settled season's champion, newest first. */
export function useChampions({ season } = {}) {
  return useResource((signal) => fetchChampions({ season, signal }), [season])
}

/** The league's whole record — every game, live, with the archive underneath. */
export function useHistory({ season } = {}) {
  return useResource((signal) => fetchHistory({ season, signal }), [season])
}

/** Waiver activity: exact counts and FAAB, plus the pickups we can name. */
export function useWaivers({ season } = {}) {
  return useResource((signal) => fetchWaivers({ season, signal }), [season])
}

/** Every trade, with a verdict on each and the league's trading records. */
export function useTrades({ season } = {}) {
  return useResource((signal) => fetchTrades({ season, signal }), [season])
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
