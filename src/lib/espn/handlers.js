/**
 * Framework-agnostic request handlers.
 *
 * Both the Netlify function (production) and the Vite dev middleware (local)
 * call these, so the two environments can't drift apart. Handlers take a plain
 * bag of inputs and return `{ status, body, cacheSeconds }` — no Request or
 * Response objects, no Netlify types.
 */

import { assertConfigured, isValidSeason, readEspnEnv } from './config.js'
import { LEAGUE_VIEWS, MATCHUP_VIEWS } from './endpoints.js'
import { fetchLeagueRaw, fetchPlayerNames, fetchPlayerWeek } from './fetchLeague.js'
import { normalizeLeague, normalizeMatchups } from './normalize.js'
import { buildRecords } from './records.js'
import { buildChampions } from './champions.js'
import { normalizeDraft } from './draft.js'
import { HISTORY_VIEWS, loadLeague, memoized, resolveSeason } from './season.js'
import { handlePoll, handlePollVote } from '../poll/handlers.js'
import archive from '../history/archive.js'
import { mergeHistory } from '../history/merge.js'
import { bestWeeks, playedWeeks, seasonsToFetch, weekEntries } from '../history/players.js'
import tradeArchive from '../trades/archive.js'
import { buildTradeStats, sortTrades, tradeHighlights } from '../trades/build.js'
import waiverArchive from '../waivers/archive.js'
import { buildWaiverStats, sortPickups, startedPickups, waiverHighlights } from '../waivers/build.js'
import { loadSeasonActivity } from '../season/activity.js'

export { clearEspnCache } from './season.js'
// Re-exported so every adapter can keep importing its handler from one place,
// the way the Netlify functions do.
export { handlePoll, handlePollVote } from '../poll/handlers.js'

/** How long the CDN may serve a cached copy. Scores move slowly enough. */
export const CACHE_SECONDS = 300

function resolveWeek(params) {
  const requested = params.get('week')
  if (requested == null || requested === '') return null
  const week = Number(requested)
  if (!Number.isInteger(week) || week < 1 || week > 25) {
    const error = new Error(`Invalid week "${requested}".`)
    error.status = 400
    throw error
  }
  return week
}

/** GET /api/league — managers, standings, records, points for/against. */
export async function handleLeague({ env, params }) {
  const { raw } = await loadLeague({ env, params, views: LEAGUE_VIEWS })
  return { status: 200, body: normalizeLeague(raw), cacheSeconds: CACHE_SECONDS }
}

/** GET /api/matchups?week=3 — the schedule, scored. */
export async function handleMatchups({ env, params }) {
  const week = resolveWeek(params)
  const { raw, season } = await loadLeague({ env, params, views: MATCHUP_VIEWS })

  return {
    status: 200,
    body: {
      leagueId: raw?.id ?? null,
      season,
      week,
      currentMatchupPeriod: raw?.status?.currentMatchupPeriod ?? null,
      matchups: normalizeMatchups(raw, { week }),
      fetchedAt: new Date().toISOString(),
    },
    cacheSeconds: CACHE_SECONDS,
  }
}

/** History reaches back years, and years don't change. Cache it far harder. */
export const HISTORY_CACHE_SECONDS = 1800

/**
 * Every season the league has played, normalized.
 *
 * Shared by the pages that read across seasons rather than at one. They are
 * fetched together rather than one per browser request: the calculations need
 * all of them at once, and doing it here means one warm response instead of the
 * client making six calls and doing the maths itself. Both pages ask for the
 * same views, so the second of them to be opened is served entirely from the
 * memo.
 */
async function loadHistory({ env, params }) {
  const config = assertConfigured(readEspnEnv(env))
  const current = resolveSeason(params, config)

  // The current season lists the ones before it, so one cheap request tells us
  // how far back the league actually goes.
  const head = await memoized(`${config.leagueId}:${current}:${LEAGUE_VIEWS.join(',')}`, () =>
    fetchLeagueRaw({
      leagueId: config.leagueId,
      season: current,
      views: LEAGUE_VIEWS,
      espnS2: config.espnS2,
      swid: config.swid,
    }),
  )

  const previous = (head?.status?.previousSeasons ?? []).filter(isValidSeason)
  const seasons = [...new Set([...previous, current])].sort((a, b) => a - b)

  const loaded = await Promise.all(
    seasons.map(async (season) => {
      try {
        const raw = await memoized(`${config.leagueId}:${season}:${HISTORY_VIEWS.join(',')}`, () =>
          fetchLeagueRaw({
            leagueId: config.leagueId,
            season,
            views: HISTORY_VIEWS,
            espnS2: config.espnS2,
            swid: config.swid,
          }),
        )
        const league = normalizeLeague(raw)
        return {
          season,
          leagueId: raw?.id ?? config.leagueId,
          teams: league.teams,
          matchups: normalizeMatchups(raw),
          // Records cover the regular season only; this is the second signal
          // used to tell those weeks from the postseason.
          regularSeasonWeeks: league.settings?.regularSeasonMatchups ?? null,
        }
      } catch {
        // One unreadable season shouldn't take the whole page down — ESPN drops
        // older years without warning. Note it and carry on.
        return { season, leagueId: config.leagueId, teams: [], matchups: [], failed: true }
      }
    }),
  )

  return {
    config,
    leagueName: normalizeLeague(head).settings?.name ?? null,
    usable: loaded.filter((entry) => !entry.failed),
    missingSeasons: loaded.filter((entry) => entry.failed).map((entry) => entry.season),
  }
}

/** GET /api/records — all-time records across every season ESPN still serves. */
export async function handleRecords({ env, params }) {
  const { config, leagueName, usable, missingSeasons } = await loadHistory({ env, params })

  return {
    status: 200,
    body: {
      leagueId: config.leagueId,
      leagueName,
      seasons: usable.map((entry) => entry.season),
      missingSeasons,
      groups: buildRecords(usable),
      fetchedAt: new Date().toISOString(),
    },
    cacheSeconds: HISTORY_CACHE_SECONDS,
  }
}

/**
 * GET /api/history — the league's whole record, live.
 *
 * ESPN for every season it still serves, so the page keeps up with itself as
 * weeks are played; the workbook underneath for the seasons and the facts ESPN
 * can't give us. See src/lib/history/merge.js for which is which.
 */
export async function handleHistory({ env, params }) {
  const { config, leagueName, usable, missingSeasons } = await loadHistory({ env, params })

  const merged = mergeHistory({
    archive,
    live: usable.map((entry) => ({
      season: entry.season,
      teams: entry.teams,
      matchups: entry.matchups,
    })),
  })

  const topPlayers = await loadPlayerWeeks({ config, seasons: usable, games: merged.games })

  return {
    status: 200,
    body: {
      leagueId: config.leagueId,
      leagueName,
      ...merged,
      topPlayers,
      missingSeasons,
      fetchedAt: new Date().toISOString(),
    },
    cacheSeconds: HISTORY_CACHE_SECONDS,
  }
}

/**
 * How many week requests one response may make.
 *
 * Each is close to a megabyte and takes about a quarter of a second, so this is
 * the brake. Five seasons' worth: the archive covers everything to 2023, which
 * leaves years of headroom before the cap can bite. Measured cold at 34 weeks:
 * 1.3s for the whole response, against a 10s function timeout.
 *
 * Seasons are taken newest first, so a budget that does run out runs out on the
 * oldest — the years least likely to hold a record nobody has seen.
 */
const PLAYER_WEEK_BUDGET = 90

/** How many of those are in flight at once. Enough to be quick, few enough not to get rate limited. */
const PLAYER_WEEK_CONCURRENCY = 6

/**
 * The best player weeks, from the archive plus every season it doesn't cover.
 *
 * The extracted numbers are memoized, never the response they came from — a
 * week of boxscores is a megabyte, and all we keep from it is a name and a
 * score per starter.
 */
async function loadPlayerWeeks({ config, seasons = [], games = [] }) {
  const archived = archive.topPlayers ?? []
  const wanted = seasonsToFetch({ seasons: seasons.map((entry) => entry.season), archive: archived })

  const jobs = []
  for (const season of wanted) {
    const owners = new Map(
      (seasons.find((entry) => entry.season === season)?.teams ?? [])
        .map((team) => [team.id, team.managerNames]),
    )
    for (const week of playedWeeks(games, season)) {
      if (jobs.length >= PLAYER_WEEK_BUDGET) break
      jobs.push({ season, week, owners })
    }
  }

  const live = []
  for (let i = 0; i < jobs.length; i += PLAYER_WEEK_CONCURRENCY) {
    const batch = jobs.slice(i, i + PLAYER_WEEK_CONCURRENCY)
    const results = await Promise.all(
      batch.map(async ({ season, week, owners }) => {
        try {
          const players = await memoized(`players:${config.leagueId}:${season}:${week}`, () =>
            fetchPlayerWeek({
              leagueId: config.leagueId,
              season,
              week,
              espnS2: config.espnS2,
              swid: config.swid,
            }),
          )
          return weekEntries({ season, week, players, owners })
        } catch {
          // One unreadable week shouldn't cost the whole list.
          return []
        }
      }),
    )
    for (const entries of results) live.push(...entries)
  }

  return bestWeeks({ archive: archived, live })
}

/**
 * GET /api/champions — who won each season, newest first.
 *
 * The season being played has no champion yet and simply isn't in the list, so
 * the page's headline champion is the reigning one until the bracket settles.
 */
export async function handleChampions({ env, params }) {
  const { config, leagueName, usable, missingSeasons } = await loadHistory({ env, params })

  return {
    status: 200,
    body: {
      leagueId: config.leagueId,
      leagueName,
      seasons: usable.map((entry) => entry.season),
      missingSeasons,
      champions: buildChampions(usable),
      fetchedAt: new Date().toISOString(),
    },
    cacheSeconds: HISTORY_CACHE_SECONDS,
  }
}

const DRAFT_VIEWS = Object.freeze(['mDraftDetail', 'mTeam', 'mSettings'])

/** Past drafts never change. */
export const DRAFT_CACHE_SECONDS = 1800

/** GET /api/draft — every season's draft board, newest first. */
export async function handleDraft({ env, params }) {
  const config = assertConfigured(readEspnEnv(env))
  const current = resolveSeason(params, config)

  const head = await memoized(`${config.leagueId}:${current}:${LEAGUE_VIEWS.join(',')}`, () =>
    fetchLeagueRaw({
      leagueId: config.leagueId,
      season: current,
      views: LEAGUE_VIEWS,
      espnS2: config.espnS2,
      swid: config.swid,
    }),
  )

  const previous = (head?.status?.previousSeasons ?? []).filter(isValidSeason)
  const seasons = [...new Set([...previous, current])].sort((a, b) => b - a)

  const drafts = await Promise.all(
    seasons.map(async (season) => {
      try {
        const raw = await memoized(`${config.leagueId}:${season}:${DRAFT_VIEWS.join(',')}`, () =>
          fetchLeagueRaw({
            leagueId: config.leagueId,
            season,
            views: DRAFT_VIEWS,
            espnS2: config.espnS2,
            swid: config.swid,
          }),
        )

        // Only the ids this draft actually used, and the map is memoized
        // rather than the response it came from.
        const ids = [...new Set((raw?.draftDetail?.picks ?? [])
          .map((pick) => pick.playerId)
          .filter((id) => id > 0))]
        const players = await memoized(`players:${season}:${ids.length}`, () =>
          fetchPlayerNames({ season, ids, espnS2: config.espnS2, swid: config.swid }),
        )

        return normalizeDraft({
          raw,
          teams: normalizeLeague(raw).teams,
          players,
          leagueId: config.leagueId,
          season,
        })
      } catch {
        // One season ESPN won't serve shouldn't empty the whole page.
        return { season, failed: true, picks: [], firstRound: [], pickCount: 0, rounds: 0 }
      }
    }),
  )

  return {
    status: 200,
    body: {
      leagueId: config.leagueId,
      leagueName: normalizeLeague(head).settings?.name ?? null,
      drafts: drafts.filter((draft) => !draft.failed && draft.pickCount > 0),
      pendingSeasons: drafts.filter((draft) => !draft.failed && draft.pickCount === 0)
        .map((draft) => draft.season),
      missingSeasons: drafts.filter((draft) => draft.failed).map((draft) => draft.season),
      fetchedAt: new Date().toISOString(),
    },
    cacheSeconds: DRAFT_CACHE_SECONDS,
  }
}

/** Finished trades are as fixed as finished drafts. */
export const TRADES_CACHE_SECONDS = 1800

/**
 * GET /api/trades — every trade the league has made, with a verdict.
 *
 * Seasons that are over come from the archive: rebuilding one costs a weekly
 * roster read per week, and the answer cannot change, so it is computed once by
 * scripts/trades/import.mjs. Only the season being played is read live, which
 * is what lets a trade made this week show up with the rest.
 *
 * A finished season the archive has never seen is reported rather than fetched.
 * Quietly pulling it would turn one forgotten import into eighty-odd requests
 * on a cold response; saying so leaves the fix obvious and the page fast.
 */
export async function handleTrades({ env, params }) {
  const config = assertConfigured(readEspnEnv(env))
  const season = resolveSeason(params, config)

  const head = await memoized(`${config.leagueId}:${season}:${LEAGUE_VIEWS.join(',')}`, () =>
    fetchLeagueRaw({
      leagueId: config.leagueId,
      season,
      views: LEAGUE_VIEWS,
      espnS2: config.espnS2,
      swid: config.swid,
    }),
  )

  const archived = tradeArchive.trades ?? []
  const archivedSeasons = new Set(tradeArchive.seasons ?? [])

  let live = []
  let liveFailed = false
  try {
    const result = await loadSeasonActivity({ config, season, memoize: memoized })
    live = result.trades
  } catch {
    // The live season failing shouldn't cost the other five.
    liveFailed = true
  }

  // The archive should never hold the live season, but a re-import run mid-season
  // could put it there; the live read is the fresher of the two either way.
  const trades = sortTrades([
    ...archived.filter((trade) => trade.season !== season),
    ...live,
  ])

  const stats = buildTradeStats(trades)
  const previous = (head?.status?.previousSeasons ?? []).filter(isValidSeason)

  return {
    status: 200,
    body: {
      leagueId: config.leagueId,
      leagueName: normalizeLeague(head).settings?.name ?? null,
      liveSeason: season,
      seasons: [...new Set(trades.map((trade) => trade.season))].sort((a, b) => b - a),
      trades,
      stats,
      highlights: tradeHighlights(trades, stats),
      // Finished seasons nobody has imported yet — see scripts/trades/import.mjs.
      unarchivedSeasons: previous.filter((year) => !archivedSeasons.has(year)),
      liveFailed,
      fetchedAt: new Date().toISOString(),
    },
    cacheSeconds: TRADES_CACHE_SECONDS,
  }
}

/** As fixed as the trades, and read from the same weekly rosters. */
export const WAIVERS_CACHE_SECONDS = 1800

/**
 * GET /api/waivers — the wire: who works it, and what they found on it.
 *
 * Same shape as /api/trades, for the same reason: completed seasons come from
 * an archive computed once, and only the live season is read from ESPN. The two
 * routes share a loader, so a request that has already warmed one finds the
 * other's league blob in the memo.
 */
export async function handleWaivers({ env, params }) {
  const config = assertConfigured(readEspnEnv(env))
  const season = resolveSeason(params, config)

  const head = await memoized(`${config.leagueId}:${season}:${LEAGUE_VIEWS.join(',')}`, () =>
    fetchLeagueRaw({
      leagueId: config.leagueId,
      season,
      views: LEAGUE_VIEWS,
      espnS2: config.espnS2,
      swid: config.swid,
    }),
  )

  const archivedSeasons = new Set(waiverArchive.seasons ?? [])

  let live = { pickups: [], counters: [] }
  let liveFailed = false
  try {
    const result = await loadSeasonActivity({ config, season, memoize: memoized })
    live = { pickups: result.pickups, counters: result.counters }
  } catch {
    liveFailed = true
  }

  const pickups = sortPickups([
    ...(waiverArchive.pickups ?? []).filter((pickup) => pickup.season !== season),
    ...live.pickups,
  ])
  const counters = [
    ...(waiverArchive.counters ?? []).filter((counter) => counter.season !== season),
    ...live.counters,
  ]

  // Stats are built from every pickup, so a manager's totals stay honest, but
  // only the ones that reached a lineup are sent: the rest are two thirds of the
  // rows, all of them nil points off nil starts, and a quarter of a megabyte.
  const stats = buildWaiverStats({ counters, pickups })
  const previous = (head?.status?.previousSeasons ?? []).filter(isValidSeason)

  return {
    status: 200,
    body: {
      leagueId: config.leagueId,
      leagueName: normalizeLeague(head).settings?.name ?? null,
      liveSeason: season,
      // A season nobody has added anyone in yet is not worth a filter option —
      // which is the state of the live season until its first week is played.
      seasons: [...new Set(counters.filter((counter) => counter.adds > 0).map((counter) => counter.season))]
        .sort((a, b) => b - a),
      pickups: startedPickups(pickups),
      counters,
      stats,
      highlights: waiverHighlights({ counters, pickups, stats }),
      unarchivedSeasons: previous.filter((year) => !archivedSeasons.has(year)),
      liveFailed,
      fetchedAt: new Date().toISOString(),
    },
    cacheSeconds: WAIVERS_CACHE_SECONDS,
  }
}

export const ROUTES = Object.freeze({
  '/api/league': handleLeague,
  '/api/matchups': handleMatchups,
  '/api/records': handleRecords,
  '/api/draft': handleDraft,
  '/api/champions': handleChampions,
  '/api/history': handleHistory,
  '/api/trades': handleTrades,
  '/api/waivers': handleWaivers,
  '/api/poll': handlePoll,
  '/api/poll/vote': handlePollVote,
})

/**
 * Runs a route and converts any throw into a JSON error body. Callers get a
 * result they can always serialize.
 *
 * `request` carries whatever the adapter could tell us about the call: always
 * `env` and `params`, plus `method`, `headers`, `body` and `ip` for the routes
 * that write. Handlers may answer with `headers` of their own — the poll sets a
 * cookie that way.
 */
export async function runRoute(handler, request) {
  try {
    return await handler(request)
  } catch (error) {
    const status = error?.status ?? 502
    return {
      status,
      body: {
        error: error?.name ?? 'Error',
        message: error?.message ?? 'Unexpected failure talking to ESPN.',
      },
      cacheSeconds: 0,
    }
  }
}

/** Cache headers. Netlify honours `Netlify-CDN-Cache-Control` on its edge. */
export function cacheHeaders(cacheSeconds) {
  if (!cacheSeconds) {
    return { 'cache-control': 'no-store' }
  }
  return {
    'cache-control': 'public, max-age=0, must-revalidate',
    'netlify-cdn-cache-control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 4}`,
  }
}
