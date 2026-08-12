#!/usr/bin/env node
/**
 * The poll's clock and its arithmetic, from moments and ballots where the right
 * answer is known.
 *
 *   npm test
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FIRST_POLL_WEEK,
  pollWindow,
  resolvePollWeek,
  upcomingWeek,
  zonedParts,
} from '../src/lib/poll/schedule.js'
import { ballotManagers, tally, validateBallot, withTrend } from '../src/lib/poll/ballot.js'

const CT = 'America/Chicago'

/** A moment written as Central wall-clock time, so the tests read as the rule does. */
function central(text) {
  // September 2025 is CDT (UTC-5); January is CST (UTC-6).
  return new Date(text)
}

// ---------- the window ----------

test('the poll is open from Tuesday midnight', () => {
  // Tue 2 Sep 2025, 00:00 CDT
  assert.equal(pollWindow(central('2025-09-02T05:00:00Z'), CT).isOpen, true)
  // ...and not a minute before it
  assert.equal(pollWindow(central('2025-09-02T04:59:00Z'), CT).isOpen, false)
})

test('the poll closes at Thursday noon', () => {
  // Thu 4 Sep 2025, 11:59 CDT
  assert.equal(pollWindow(central('2025-09-04T16:59:00Z'), CT).isOpen, true)
  // Thu 4 Sep 2025, 12:00 CDT — shut
  assert.equal(pollWindow(central('2025-09-04T17:00:00Z'), CT).isOpen, false)
})

test('the weekend and Monday are closed', () => {
  for (const moment of ['2025-09-05T18:00:00Z', '2025-09-07T18:00:00Z', '2025-09-08T18:00:00Z']) {
    assert.equal(pollWindow(central(moment), CT).isOpen, false, moment)
  }
})

test('an open window says when it shuts', () => {
  const window = pollWindow(central('2025-09-03T15:00:00Z'), CT) // Wednesday
  assert.equal(window.isOpen, true)
  assert.deepEqual(zonedParts(new Date(window.opensAt), CT), {
    year: 2025, month: 9, day: 2, hour: 0, minute: 0, second: 0, weekday: 2,
  })
  assert.deepEqual(zonedParts(new Date(window.closesAt), CT), {
    year: 2025, month: 9, day: 4, hour: 12, minute: 0, second: 0, weekday: 4,
  })
})

test('a closed window points at the next one, not the one just gone', () => {
  const window = pollWindow(central('2025-09-06T18:00:00Z'), CT) // Saturday
  assert.equal(window.isOpen, false)
  const opens = zonedParts(new Date(window.opensAt), CT)
  assert.equal(opens.weekday, 2, 'Tuesday')
  assert.equal(opens.day, 9, 'the Tuesday after, not the one before')
  assert.equal(opens.hour, 0)
})

test('the window holds its hours across a daylight saving change', () => {
  // The Sunday between these two is when the US clocks go back.
  const before = pollWindow(central('2025-10-29T15:00:00Z'), CT)
  const after = pollWindow(central('2025-11-05T15:00:00Z'), CT)

  for (const window of [before, after]) {
    assert.equal(window.isOpen, true)
    assert.equal(zonedParts(new Date(window.opensAt), CT).hour, 0)
    assert.equal(zonedParts(new Date(window.closesAt), CT).hour, 12)
  }
  // The clocks going back means the same local midnight is a different instant:
  // 05:00 UTC while it is CDT, 06:00 UTC once it is CST. A fixed offset would
  // have given the same hour twice.
  assert.equal(new Date(before.opensAt).getUTCHours(), 5)
  assert.equal(new Date(after.opensAt).getUTCHours(), 6)
})

test('a week is 24 hours of Tuesday, 24 of Wednesday and 12 of Thursday', () => {
  const window = pollWindow(central('2025-09-02T06:00:00Z'), CT)
  const hours = (new Date(window.closesAt) - new Date(window.opensAt)) / 3_600_000
  assert.equal(hours, 60)
})

// ---------- which week ----------

const done = (week) => ({ week, isComplete: true })
const live = (week) => ({ week, isComplete: false })

test('the ballot is for the week whose games are next', () => {
  assert.equal(
    resolvePollWeek({ currentMatchupPeriod: 3, matchups: [live(3), live(3)], regularSeasonWeeks: 14 }),
    3,
  )
})

test('a week already in the books is stepped past', () => {
  // Tuesday morning: ESPN can still be pointing at the week that just ended.
  assert.equal(
    resolvePollWeek({ currentMatchupPeriod: 3, matchups: [done(3), done(3)], regularSeasonWeeks: 14 }),
    4,
  )
})

test('there is no poll before week 1 has been played', () => {
  // Nobody has a record to be ranked on yet.
  assert.equal(resolvePollWeek({ currentMatchupPeriod: 1, matchups: [], regularSeasonWeeks: 14 }), null)
  assert.equal(
    resolvePollWeek({ currentMatchupPeriod: 1, matchups: [live(1)], regularSeasonWeeks: 14 }),
    null,
  )
})

test('the season’s first poll is the one after week 1', () => {
  assert.equal(
    resolvePollWeek({ currentMatchupPeriod: 1, matchups: [done(1), done(1)], regularSeasonWeeks: 14 }),
    FIRST_POLL_WEEK,
  )
  assert.equal(FIRST_POLL_WEEK, 2)
})

test('there is no poll once the regular season is done', () => {
  assert.equal(
    resolvePollWeek({ currentMatchupPeriod: 14, matchups: [done(14)], regularSeasonWeeks: 14 }),
    null,
  )
  assert.equal(resolvePollWeek({ currentMatchupPeriod: 15, regularSeasonWeeks: 14 }), null)
})

test('the two ends of the season are told apart by the upcoming week', () => {
  // Both give resolvePollWeek null; only this separates "too early" from "over".
  assert.ok(upcomingWeek({ currentMatchupPeriod: 1, matchups: [] }) < FIRST_POLL_WEEK)
  assert.ok(upcomingWeek({ currentMatchupPeriod: 15, matchups: [] }) > 14)
})

// ---------- the ballot ----------

const LEAGUE = {
  managers: [
    { id: 'tyler', name: 'Tyler Gilbert', teamId: 9, teamName: 'Jarvis', recordLabel: '0-0' },
    { id: 'brett', name: 'Brett Gilbert', teamId: 1, teamName: 'The Mask', recordLabel: '0-0' },
    { id: 'ann', name: 'Ann Adams', teamId: 3, teamName: 'Ann’s Team', recordLabel: '0-0' },
    // No team: a league member who isn't playing this year.
    { id: 'ghost', name: 'Aaron Ghost', teamId: null, teamName: null },
  ],
}

const MANAGERS = ballotManagers(LEAGUE)

test('the ballot is managers by real name, A to Z', () => {
  assert.deepEqual(MANAGERS.map((m) => m.name), ['Ann Adams', 'Brett Gilbert', 'Tyler Gilbert'])
})

test('someone without a team this season is not on the ballot', () => {
  assert.ok(!MANAGERS.some((m) => m.id === 'ghost'))
})

test('a ballot has to rank everyone, once', () => {
  assert.equal(validateBallot(['ann', 'brett', 'tyler'], MANAGERS).ok, true)
  assert.equal(validateBallot(['ann', 'brett'], MANAGERS).ok, false, 'short')
  assert.equal(validateBallot(['ann', 'brett', 'brett'], MANAGERS).ok, false, 'duplicate')
  assert.equal(validateBallot(['ann', 'brett', 'nobody'], MANAGERS).ok, false, 'stranger')
  assert.equal(validateBallot('ann', MANAGERS).ok, false, 'not a list')
})

test('first place is worth one point per manager, last place one', () => {
  const rows = tally([{ ballot: ['ann', 'brett', 'tyler'] }], MANAGERS)
  assert.deepEqual(rows.map((row) => [row.id, row.points]), [
    ['ann', 3], ['brett', 2], ['tyler', 1],
  ])
  assert.deepEqual(rows.map((row) => row.rank), [1, 2, 3])
})

test('the winner is the one everybody rates, not the one somebody loves', () => {
  const rows = tally(
    [
      { ballot: ['tyler', 'brett', 'ann'] },
      { ballot: ['brett', 'ann', 'tyler'] },
      { ballot: ['brett', 'ann', 'tyler'] },
    ],
    MANAGERS,
  )
  assert.equal(rows[0].id, 'brett')
  assert.equal(rows[0].firstPlaceVotes, 2)
})

test('a tie breaks on first-place votes, then on name', () => {
  const rows = tally(
    [{ ballot: ['ann', 'brett', 'tyler'] }, { ballot: ['brett', 'tyler', 'ann'] }],
    MANAGERS,
  )
  // ann 3+1=4, brett 2+3=5, tyler 1+2=3
  assert.deepEqual(rows.map((row) => row.id), ['brett', 'ann', 'tyler'])
})

test('a manager nobody ranked still appears, on zero', () => {
  const rows = tally([], MANAGERS)
  assert.equal(rows.length, 3)
  assert.ok(rows.every((row) => row.points === 0))
})

test('a ballot naming someone who has left is counted for the rest', () => {
  const rows = tally([{ ballot: ['ann', 'gone', 'brett', 'tyler'] }], MANAGERS)
  assert.equal(rows.find((row) => row.id === 'ann').points, 3)
})

test('trend is movement against last week, and null with nothing to compare', () => {
  const previous = tally([{ ballot: ['tyler', 'brett', 'ann'] }], MANAGERS)
  const current = tally([{ ballot: ['ann', 'brett', 'tyler'] }], MANAGERS)
  const rows = withTrend(current, previous)

  assert.deepEqual(
    rows.map((row) => [row.id, row.trend]),
    [['ann', 2], ['brett', 0], ['tyler', -2]],
  )
  assert.ok(withTrend(current, []).every((row) => row.trend === null))
})
