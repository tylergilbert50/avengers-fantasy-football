/**
 * The managers' poll: reading the ballot and recording a vote.
 *
 * Two rules live here rather than in the browser, because the browser is not
 * trustworthy about either: *when* the poll is open, and *which week* a ballot
 * counts for. A submitted ballot names only its rankings; the week and the
 * clock are the server's to decide.
 */

import { normalizeLeague, normalizeMatchups } from '../espn/normalize.js'
import { HISTORY_VIEWS, loadLeague } from '../espn/season.js'
import { ballotManagers, tally, validateBallot, withTrend } from './ballot.js'
import { assertPollConfigured, readPollEnv, VOTER_COOKIE, VOTER_COOKIE_MAX_AGE } from './config.js'
import {
  FIRST_POLL_WEEK,
  pollWindow,
  resolvePollWeek,
  timezoneLabel,
  upcomingWeek,
} from './schedule.js'
import { DuplicateVoteError, fetchVotes, hashIp, insertVote, newVoterId } from './store.js'

/** Never cached: it turns over on a deadline and knows who you are. */
const NO_CACHE = 0

function readCookie(headers = {}, name) {
  const jar = headers.cookie ?? headers.Cookie ?? ''
  for (const part of String(jar).split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

/**
 * Secure is set unconditionally: Netlify is HTTPS-only, and `localhost` is
 * treated as a secure origin by every browser that matters, so the dev server
 * keeps working too.
 */
function voterCookie(voterId) {
  return [
    `${VOTER_COOKIE}=${voterId}`,
    'Path=/',
    `Max-Age=${VOTER_COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
  ].join('; ')
}

/** The league, the week the ballot is for, and whether voting is open. */
async function pollState({ env, params }) {
  const config = assertPollConfigured(readPollEnv(env))
  const { raw, season } = await loadLeague({ env, params, views: HISTORY_VIEWS })

  const league = normalizeLeague(raw)
  const matchups = normalizeMatchups(raw)

  const now = new Date()
  const window = pollWindow(now, config.timeZone)
  const regularSeasonWeeks = league.settings?.regularSeasonMatchups
  const schedule = {
    currentMatchupPeriod: league.status?.currentMatchupPeriod,
    matchups,
    regularSeasonWeeks,
  }

  // Both ends of the season leave us without a week to vote in, and the page
  // has to say which end it is standing at.
  const realWeek = resolvePollWeek(schedule)
  const realPhase =
    realWeek != null
      ? window.isOpen
        ? 'open'
        : 'closed'
      : upcomingWeek(schedule) < FIRST_POLL_WEEK
        ? 'not-started'
        : 'season-over'

  const testing = config.testWeek != null

  return {
    config,
    season,
    week: testing ? config.testWeek : realWeek,
    phase: testing ? config.testPhase : realPhase,
    testing,
    window,
    league,
    lastRegularWeek: Number(regularSeasonWeeks) || null,
    managers: ballotManagers(league),
    timezone: timezoneLabel(now, config.timeZone),
  }
}

/** The week whose result is on show. */
function resultsWeek({ week, phase, lastRegularWeek }) {
  // Nothing has been voted on yet, so there is nothing to show.
  if (phase === 'not-started') return null
  // The regular season is done: the last poll it held is the one that stands,
  // rather than the page emptying out.
  if (phase === 'season-over') return lastRegularWeek
  // While the poll is open the week's own result doesn't exist yet, and last
  // week's has had its run — the page shows the ballot instead.
  return phase === 'open' ? null : week
}

/**
 * The finished table: points, rank, and movement against the week before.
 *
 * Records come from the standings as they stand, which during the poll's own
 * week is the record each manager is carrying into it.
 */
async function buildResults({ config, season, week, managers }) {
  const [votes, previousVotes] = await Promise.all([
    fetchVotes({ config, season, week }),
    week > 1 ? fetchVotes({ config, season, week: week - 1 }) : Promise.resolve([]),
  ])

  // A week nobody voted in tallies to a full table of zeroes in alphabetical
  // order, which is a ranking as far as `withTrend` can tell — and every
  // manager would show movement against a poll that never happened. No ballots
  // means no last week to move against.
  const previous = previousVotes.length > 0 ? tally(previousVotes, managers) : []

  const rows = withTrend(tally(votes, managers), previous)
  return { rows, voteCount: votes.length }
}

function payload({ state, hasVoted, yourBallot, results, shownWeek = null }) {
  return {
    season: state.season,
    week: state.week,
    // Usually the same week; different once the season is over and the last
    // poll of the year is what's still on the page.
    resultsWeek: results ? shownWeek : null,
    leagueName: state.league.settings?.name ?? null,
    isOpen: state.phase === 'open',
    // 'open' | 'closed' | 'not-started' | 'season-over'
    phase: state.phase,
    // Drives the banner. Never quietly true: see POLL_TEST_WEEK.
    testing: state.testing,
    opensAt: state.window.opensAt,
    closesAt: state.window.closesAt,
    timezone: state.timezone,
    managers: state.managers,
    hasVoted,
    yourBallot,
    results: results?.rows ?? null,
    voteCount: results?.voteCount ?? 0,
    fetchedAt: new Date().toISOString(),
  }
}

/** GET /api/poll — the ballot, or the result, depending on the clock. */
export async function handlePoll({ env, params, headers = {} }) {
  const state = await pollState({ env, params })
  const voterId = readCookie(headers, VOTER_COOKIE)

  const shownWeek = resultsWeek(state)
  const results = shownWeek == null
    ? null
    : await buildResults({ ...state, week: shownWeek })

  // Only asked while it matters: mid-week the answer decides whether the page
  // shows a ballot or a receipt.
  let hasVoted = false
  let yourBallot = null
  if (state.window.isOpen && state.week != null && voterId) {
    const votes = await fetchVotes({ config: state.config, season: state.season, week: state.week })
    const mine = votes.find((vote) => vote.voterId === voterId)
    hasVoted = Boolean(mine)
    yourBallot = mine?.ballot ?? null
  }

  return {
    status: 200,
    body: payload({ state, hasVoted, yourBallot, results, shownWeek }),
    cacheSeconds: NO_CACHE,
  }
}

function badRequest(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}

/** POST /api/poll/vote — one ballot, once. */
export async function handlePollVote({ env, params, method, body, headers = {}, ip }) {
  if (method !== 'POST') throw badRequest('Send a ballot with POST.', 405)

  const state = await pollState({ env, params })

  if (state.phase === 'not-started') {
    throw badRequest('The season’s first poll opens once week 1 has been played.', 409)
  }
  if (state.phase === 'season-over') {
    throw badRequest('The regular season is over — there is no poll to vote in.', 409)
  }
  if (state.phase !== 'open') {
    throw badRequest('Voting is closed. The poll reopens Tuesday at midnight.', 409)
  }

  const check = validateBallot(body?.ballot, state.managers)
  if (!check.ok) throw badRequest(check.error)

  const { config, season, week } = state
  const existing = await fetchVotes({ config, season, week })

  // The cookie is the identity; the address is the backstop for someone who
  // clears it and comes straight back. Neither is proof of who a person is —
  // see docs/poll.md for what this does and doesn't stop.
  const voterId = readCookie(headers, VOTER_COOKIE) ?? newVoterId()
  const ipHash = hashIp(ip, config.ipSalt)

  if (existing.some((vote) => vote.voterId === voterId)) {
    throw new DuplicateVoteError()
  }
  if (config.maxVotesPerIp > 0 && ipHash) {
    const fromHere = existing.filter((vote) => vote.ipHash === ipHash).length
    if (fromHere >= config.maxVotesPerIp) {
      throw new DuplicateVoteError('A ballot has already come from this network this week.')
    }
  }

  await insertVote({ config, season, week, voterId, ipHash, ballot: body.ballot })

  return {
    status: 200,
    body: payload({ state, hasVoted: true, yourBallot: body.ballot, results: null }),
    cacheSeconds: NO_CACHE,
    headers: { 'set-cookie': voterCookie(voterId) },
  }
}
