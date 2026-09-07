/**
 * When the poll is open, and which week it is for.
 *
 * The weekly window is Tuesday 00:00 to Thursday 12:00 in the league's own
 * timezone — the gap between one NFL week ending on Monday night and the next
 * kicking off on Thursday. It is deliberately *not* the viewer's timezone: the
 * poll has to open and close at one moment for everybody, not at ten different
 * ones.
 *
 * The preseason poll is the exception, and `preseasonWindow` is where it lives:
 * one ballot a year, on a fixed deadline rather than a repeating rule.
 *
 * Pure functions over a clock you pass in, so every edge (a Thursday at 11:59,
 * a Sunday, a DST week) is testable without waiting for one.
 */

import { PRESEASON_POLL, upcomingWeek } from '../schedule/calendar.js'
import { fromZoned, LEAGUE_TIMEZONE, leagueMoment, zonedParts } from '../time.js'

export { timezoneLabel, zonedParts } from '../time.js'
// Which week is next is a fact about the season, not about the poll — the
// schedule page unrolls itself with the same answer.
export { upcomingWeek } from '../schedule/calendar.js'

/** Override with POLL_TIMEZONE if the league ever moves. */
export const DEFAULT_TIMEZONE = LEAGUE_TIMEZONE

const OPENS_WEEKDAY = 2 // Tuesday
const CLOSES_WEEKDAY = 4 // Thursday
const CLOSES_HOUR = 12

/** The Tuesday 00:00 that opened the cycle `now` sits in. */
function cycleStart(now, timeZone) {
  const parts = zonedParts(now, timeZone)
  const sinceTuesday = (parts.weekday - OPENS_WEEKDAY + 7) % 7
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - sinceTuesday))

  return fromZoned(
    { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate() },
    timeZone,
  )
}

const DAY_MS = 86_400_000

/** The Thursday noon that closes the cycle this Tuesday opened. */
function closesFor(opens, timeZone) {
  const thursday = zonedParts(new Date(opens.getTime() + (CLOSES_WEEKDAY - OPENS_WEEKDAY) * DAY_MS), timeZone)
  return fromZoned({ ...thursday, hour: CLOSES_HOUR, minute: 0 }, timeZone)
}

/** The Tuesday after this one. */
function nextCycle(opens, timeZone) {
  const tuesday = zonedParts(new Date(opens.getTime() + 7 * DAY_MS), timeZone)
  return fromZoned({ ...tuesday, hour: 0, minute: 0 }, timeZone)
}

/**
 * The window that matters right now: the one voting is open in, or — once
 * Thursday noon has passed — the next one, so the page can say when the poll
 * comes back rather than only that it has gone.
 *
 * @returns {{ isOpen: boolean, opensAt: string, closesAt: string }} ISO instants
 */
export function pollWindow(now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const opens = cycleStart(now, timeZone)
  const closes = closesFor(opens, timeZone)

  if (now.getTime() < closes.getTime()) {
    return { isOpen: true, opensAt: opens.toISOString(), closesAt: closes.toISOString() }
  }

  const nextOpens = nextCycle(opens, timeZone)
  return {
    isOpen: false,
    opensAt: nextOpens.toISOString(),
    closesAt: closesFor(nextOpens, timeZone).toISOString(),
  }
}

/**
 * The week the preseason ballot is filed under.
 *
 * Week 1 is free — the weekly poll's first ballot is week 2, for the reason
 * below — and it is the right drawer rather than merely an empty one: filing
 * the preseason there is what makes the week 2 table show movement against the
 * league's preseason guess instead of against nothing at all.
 */
export const PRESEASON_WEEK = 1

/**
 * The preseason poll's state right now.
 *
 * Deliberately not a cycle. There is one of these a season and it has to be
 * shut before kickoff, so it is a pair of instants read off the league
 * calendar — and, once it has closed, a pointer at the first *weekly* poll,
 * since the preseason one never comes round again.
 *
 * @returns {{ phase: 'not-started'|'open'|'closed', isOpen: boolean,
 *             opensAt: string, closesAt: string }}
 */
export function preseasonWindow(now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const opens = leagueMoment(PRESEASON_POLL.opens.date, PRESEASON_POLL.opens.time, timeZone)
  const closes = leagueMoment(PRESEASON_POLL.closes.date, PRESEASON_POLL.closes.time, timeZone)
  const span = { opensAt: opens.toISOString(), closesAt: closes.toISOString() }

  // Before the draft there are no rosters to rank, only names.
  if (now.getTime() < opens.getTime()) return { phase: 'not-started', isOpen: false, ...span }
  if (now.getTime() < closes.getTime()) return { phase: 'open', isOpen: true, ...span }

  // Shut. What comes next is not another preseason poll but the first weekly
  // one, which opens the Tuesday after week 1 has been played — and since the
  // preseason closes on the Wednesday before kickoff, that is exactly the
  // Tuesday after the one it closed in.
  const nextOpens = nextCycle(cycleStart(closes, timeZone), timeZone)
  return {
    phase: 'closed',
    isOpen: false,
    opensAt: nextOpens.toISOString(),
    closesAt: closesFor(nextOpens, timeZone).toISOString(),
  }
}

/**
 * The first week there is anything to vote on.
 *
 * A *weekly* poll for week 1 would be cast before a single game had been
 * played — ten managers at 0-0, ranked on nothing. So the first weekly ballot
 * is the one that opens once week 1 is in the books, the week 2 poll, and the
 * stretch before it belongs to the preseason poll above.
 */
export const FIRST_POLL_WEEK = 2

/**
 * Which week the ballot is for, or null when there isn't one — either the
 * season hasn't given us a week 1 to judge yet, or the regular season is done.
 * Callers that need to tell those apart compare against `upcomingWeek`.
 *
 * @returns {number|null}
 */
export function resolvePollWeek({ currentMatchupPeriod, matchups = [], regularSeasonWeeks }) {
  const week = upcomingWeek({ currentMatchupPeriod, matchups })
  if (week < FIRST_POLL_WEEK) return null

  const last = Number(regularSeasonWeeks) || 0
  if (last > 0 && week > last) return null
  return week
}

