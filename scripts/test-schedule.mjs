#!/usr/bin/env node
/**
 * The league calendar: week dates, and the fixtures the league sets itself.
 *
 *   npm test
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildWeeks,
  keyDates,
  WEEK_1,
  upcomingWeek,
  weekDateLabel,
  weekOf,
  weekStart,
} from '../src/lib/schedule/calendar.js'
import { zonedParts } from '../src/lib/time.js'

const CT = 'America/Chicago'

test('week 1 begins on the day the league says', () => {
  assert.equal(weekStart(1), WEEK_1)
})

test('each week is seven days after the last', () => {
  assert.equal(weekStart(3), '2026-09-28')
})

test('a week date is a calendar date, carrying no time to drift', () => {
  assert.match(weekStart(5), /^\d{4}-\d{2}-\d{2}$/)
  // Formatted without a timezone, so it reads the same wherever it is read.
  assert.equal(weekDateLabel('2026-09-14', 'en-US'), 'Sep 14')
})

test('the season rolls into the following months without drifting', () => {
  // Week 12 is 11 weeks after 14 September, straddling the end of daylight
  // saving — the failure this replaced had it landing an hour early.
  assert.equal(weekStart(12), '2026-11-30')
  assert.equal(weekStart(14), '2026-12-14')
})

/** Midday Central on that calendar day. */
const noonCT = (date) => new Date(`${date}T17:00:00Z`)

test('a date maps back to its week', () => {
  assert.equal(weekOf(noonCT('2026-09-14')), 1)
  assert.equal(weekOf(noonCT('2026-10-26')), 7)
  assert.equal(weekOf(noonCT('2026-11-01')), 7, 'the last day of the week still counts')
  assert.equal(weekOf(noonCT('2026-11-02')), 8, 'the next one rolls over')
})

test('there is no week before the season, or after the last one', () => {
  assert.equal(weekOf(noonCT('2026-08-29')), null, 'draft night')
  assert.equal(weekOf(noonCT('2026-12-21'), { weeks: 14 }), null)
})

test('the key dates come back in the order they happen', () => {
  const dates = keyDates(new Date('2026-08-01T12:00:00Z'))
  assert.deepEqual(dates.map((entry) => entry.id), ['draft', 'kickoff', 'trade-deadline'])
  assert.ok(dates.every((entry) => entry.past === false))
})

test('a date knows once it has gone by', () => {
  const dates = keyDates(new Date('2026-10-01T12:00:00Z'))
  const by = Object.fromEntries(dates.map((entry) => [entry.id, entry.past]))
  assert.deepEqual(by, { draft: true, kickoff: true, 'trade-deadline': false })
})

test('draft night is 7:30 in the evening, league time', () => {
  const draft = keyDates().find((entry) => entry.id === 'draft')
  const parts = zonedParts(new Date(draft.at), CT)
  assert.deepEqual([parts.month, parts.day, parts.hour, parts.minute], [8, 29, 19, 30])
  assert.equal(draft.hasTime, true)
})

test('the trade deadline is 11:00 in the morning, after the clocks change', () => {
  const deadline = keyDates().find((entry) => entry.id === 'trade-deadline')
  const parts = zonedParts(new Date(deadline.at), CT)
  assert.deepEqual([parts.month, parts.day, parts.hour, parts.minute], [11, 26, 11, 0])
  // Central Standard by late November, so 11:00 local is 17:00 UTC.
  assert.equal(new Date(deadline.at).getUTCHours(), 17)
})

test('a week with no hour of its own does not invent one', () => {
  assert.equal(keyDates().find((entry) => entry.id === 'kickoff').hasTime, false)
})

// ---------- the weeks ----------

const game = (week) => ({ week, home: { name: 'A' }, away: { name: 'B' } })

test('every week of the season is listed, games or no games', () => {
  const weeks = buildWeeks({
    matchups: [game(1), game(1), game(2)],
    regularSeasonWeeks: 14,
    finalWeek: 17,
  })

  assert.equal(weeks.length, 17)
  assert.equal(weeks[0].games.length, 2)
  assert.equal(weeks[2].games.length, 0, 'week 3 is on the calendar before ESPN draws it')
})

test('the weeks past the regular season are marked as the playoffs', () => {
  const weeks = buildWeeks({ regularSeasonWeeks: 14, finalWeek: 17 })
  assert.deepEqual(weeks.filter((entry) => entry.isPlayoff).map((entry) => entry.week), [15, 16, 17])
})

test('the current week is marked, and only that one', () => {
  const weeks = buildWeeks({ regularSeasonWeeks: 14, currentWeek: 6 })
  assert.deepEqual(weeks.filter((entry) => entry.isCurrent).map((entry) => entry.week), [6])
})

test('a season ESPN has no bracket for still ends at the regular season', () => {
  const weeks = buildWeeks({ regularSeasonWeeks: 14, finalWeek: null })
  assert.equal(weeks.length, 14)
})

// ---------- unrolling the season a week at a time ----------

const played = (week) => ({ week, isComplete: true })
const upcoming = (week) => ({ week, isComplete: false })

test('before a ball is kicked, only week 1 is posted', () => {
  const matchups = [upcoming(1), upcoming(1)]
  const next = upcomingWeek({ currentMatchupPeriod: 1, matchups })
  const weeks = buildWeeks({ matchups, regularSeasonWeeks: 14, finalWeek: 17, throughWeek: next })

  assert.deepEqual(weeks.map((entry) => entry.week), [1])
})

test('the next week goes up once the one before it has finished', () => {
  const matchups = [played(1), played(1), upcoming(2)]
  const next = upcomingWeek({ currentMatchupPeriod: 1, matchups })
  const weeks = buildWeeks({ matchups, regularSeasonWeeks: 14, finalWeek: 17, throughWeek: next })

  assert.deepEqual(weeks.map((entry) => entry.week), [1, 2])
})

test('a week still being played does not post the next one', () => {
  // Sunday afternoon: some of week 3 is final, some isn't.
  const matchups = [played(3), upcoming(3)]
  assert.equal(upcomingWeek({ currentMatchupPeriod: 3, matchups }), 3)
})

test('weeks already played stay up rather than being replaced', () => {
  const weeks = buildWeeks({ regularSeasonWeeks: 14, finalWeek: 17, throughWeek: 6 })
  assert.deepEqual(weeks.map((entry) => entry.week), [1, 2, 3, 4, 5, 6])
})

test('unrolling never runs past the end of the season', () => {
  const weeks = buildWeeks({ regularSeasonWeeks: 14, finalWeek: 17, throughWeek: 25 })
  assert.equal(weeks.length, 17)
})

test('a week is always posted, even with nothing to go on', () => {
  assert.equal(buildWeeks({ throughWeek: 0 }).length, 1)
  assert.equal(buildWeeks({ throughWeek: null }).length, 14, 'no limit posts the whole season')
})
