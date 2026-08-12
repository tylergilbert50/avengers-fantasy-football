/**
 * The league's own calendar.
 *
 * ESPN knows who plays whom in which week, but not when the league does
 * anything — there is no draft time, no deadline and no week dates in its
 * payload. Those are the league's, so they live here, written as wall-clock
 * league time and turned into real instants for display.
 *
 * Everything else on the page is derived from `WEEK_1`: week n begins seven
 * days after week n-1, which is the only rule the NFL calendar needs.
 */

import { leagueMoment, zonedParts } from '../time.js'

export const SEASON = 2026

/**
 * The Monday week 1 begins, as given by the league.
 *
 * Note this is a Monday, while NFL week 1 of 2026 runs Thursday 10 September
 * to Monday 14 September — so every week's date below is the *end* of that
 * week's slate if the league meant kickoff. One line to change if so.
 */
export const WEEK_1 = '2026-09-14'

/** The fixtures on the league's own calendar, in the order they happen. */
export const KEY_DATES = [
  {
    id: 'draft',
    label: 'Draft Night',
    date: '2026-08-29',
    time: '19:30',
  },
  {
    id: 'kickoff',
    label: 'Week 1',
    date: WEEK_1,
  },
  {
    id: 'trade-deadline',
    label: 'Trade Deadline',
    date: '2026-11-26',
    time: '11:00',
  },
]

const DAY_MS = 86_400_000

/** "2026-09-14" -> a UTC midnight, purely as a way to count days. */
function asDayNumber(date) {
  const [year, month, day] = String(date).split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function asDateString(dayNumber) {
  return new Date(dayNumber).toISOString().slice(0, 10)
}

/**
 * The day a week begins, as a plain calendar date — "2026-09-28".
 *
 * Deliberately not an instant. A week is a day on a calendar, and giving it a
 * moment invites two bugs that both bit here: seven-day arithmetic in
 * milliseconds slides an hour when the clocks change in November, and any
 * moment lands on a different date somewhere in the world. A date string has
 * neither problem, and `weekDateLabel` formats it without a timezone.
 */
export function weekStart(week, week1 = WEEK_1) {
  return asDateString(asDayNumber(week1) + (Number(week) - 1) * 7 * DAY_MS)
}

/** "2026-09-28" -> "Sep 28", the same everywhere it is read. */
export function weekDateLabel(date, locale = undefined) {
  return new Intl.DateTimeFormat(locale, {
    // The date carries no zone, so formatting it must not apply one.
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  }).format(new Date(asDayNumber(date)))
}

/** Which week a moment falls in, or null before the season / after week `weeks`. */
export function weekOf(date, { weeks, week1 = WEEK_1 } = {}) {
  // Which calendar day it is in Nashville, not wherever the reader is.
  const local = zonedParts(date)
  const elapsed = Date.UTC(local.year, local.month - 1, local.day) - asDayNumber(week1)
  if (elapsed < 0) return null

  const week = Math.floor(elapsed / (7 * DAY_MS)) + 1
  return weeks && week > weeks ? null : week
}

/** The key dates as instants, newest last, each knowing whether it has passed. */
export function keyDates(now = new Date(), dates = KEY_DATES) {
  return dates
    .map((entry) => {
      const at = leagueMoment(entry.date, entry.time ?? '12:00')
      return {
        ...entry,
        at: at.toISOString(),
        // Whether a time was given at all: a draft has an hour, a week doesn't,
        // and the page shouldn't invent "12:00 PM" for the ones that don't.
        hasTime: Boolean(entry.time),
        past: at.getTime() < now.getTime(),
      }
    })
    .sort((a, b) => new Date(a.at) - new Date(b.at))
}

/**
 * The week whose games are next.
 *
 * ESPN's `currentMatchupPeriod` is that week — except on Tuesday morning, where
 * it can still be pointing at the week that just finished for a few hours after
 * the Monday night game. A period whose games are all in the books is behind
 * us, so step past it.
 */
export function upcomingWeek({ currentMatchupPeriod, matchups = [] }) {
  const current = Number(currentMatchupPeriod) || 1
  const played = matchups.filter((matchup) => matchup.week === current)
  const finished = played.length > 0 && played.every((matchup) => matchup.isComplete)
  return finished ? current + 1 : current
}

/**
 * The season as weeks, each with its date and its games.
 *
 * `throughWeek` stops the list there, which is how the page unrolls the season
 * a week at a time rather than posting all seventeen up front: the next week
 * appears once the one before it has been played out.
 */
export function buildWeeks({
  matchups = [],
  regularSeasonWeeks = 14,
  finalWeek = null,
  currentWeek = null,
  throughWeek = null,
  week1 = WEEK_1,
} = {}) {
  const season = Math.max(Number(finalWeek) || 0, Number(regularSeasonWeeks) || 0)
  const last = throughWeek == null ? season : Math.min(season, Math.max(1, Number(throughWeek)))
  const byWeek = new Map()
  for (const matchup of matchups) {
    if (!byWeek.has(matchup.week)) byWeek.set(matchup.week, [])
    byWeek.get(matchup.week).push(matchup)
  }

  const weeks = []
  for (let week = 1; week <= last; week += 1) {
    weeks.push({
      week,
      date: weekStart(week, week1),
      isPlayoff: week > regularSeasonWeeks,
      isCurrent: currentWeek != null && week === Number(currentWeek),
      games: byWeek.get(week) ?? [],
    })
  }
  return weeks
}
