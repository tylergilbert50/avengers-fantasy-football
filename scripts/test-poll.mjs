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
  PRESEASON_WEEK,
  pollWindow,
  preseasonWindow,
  resolvePollWeek,
  upcomingWeek,
  zonedParts,
} from '../src/lib/poll/schedule.js'
import { ballotManagers, tally, validateBallot, withTrend } from '../src/lib/poll/ballot.js'
import { KEY_DATES, PRESEASON_POLL, WEEK_1 } from '../src/lib/schedule/calendar.js'
import { leagueMoment } from '../src/lib/time.js'

const CT = 'America/Chicago'

/** A moment written as Central wall-clock time, so the tests read as the rule does. */
function central(text) {
  // September 2025 is CDT (UTC-5); January is CST (UTC-6).
  return new Date(text)
}

// ---------- the window ----------

test('the poll is open from Wednesday at 10am', () => {
  // Wed 3 Sep 2025, 10:00 CDT
  assert.equal(pollWindow(central('2025-09-03T15:00:00Z'), CT).isOpen, true)
  // ...and not a minute before it
  assert.equal(pollWindow(central('2025-09-03T14:59:00Z'), CT).isOpen, false)
})

test('the poll closes at Thursday noon', () => {
  // Thu 4 Sep 2025, 11:59 CDT
  assert.equal(pollWindow(central('2025-09-04T16:59:00Z'), CT).isOpen, true)
  // Thu 4 Sep 2025, 12:00 CDT — shut
  assert.equal(pollWindow(central('2025-09-04T17:00:00Z'), CT).isOpen, false)
})

test('Friday through Tuesday is closed', () => {
  // Fri, Sun, Mon — and the Tuesday, which is now the last day shut.
  for (const moment of [
    '2025-09-05T18:00:00Z',
    '2025-09-07T18:00:00Z',
    '2025-09-08T18:00:00Z',
    '2025-09-09T18:00:00Z',
  ]) {
    assert.equal(pollWindow(central(moment), CT).isOpen, false, moment)
  }
})

test('an open window says when it shuts', () => {
  const window = pollWindow(central('2025-09-03T20:00:00Z'), CT) // Wednesday afternoon
  assert.equal(window.isOpen, true)
  assert.deepEqual(zonedParts(new Date(window.opensAt), CT), {
    year: 2025, month: 9, day: 3, hour: 10, minute: 0, second: 0, weekday: 3,
  })
  assert.deepEqual(zonedParts(new Date(window.closesAt), CT), {
    year: 2025, month: 9, day: 4, hour: 12, minute: 0, second: 0, weekday: 4,
  })
})

test('a closed window points at the next one, not the one just gone', () => {
  const window = pollWindow(central('2025-09-06T18:00:00Z'), CT) // Saturday
  assert.equal(window.isOpen, false)
  const opens = zonedParts(new Date(window.opensAt), CT)
  assert.equal(opens.weekday, 3, 'Wednesday')
  assert.equal(opens.day, 10, 'the Wednesday after, not the one before')
  assert.equal(opens.hour, 10)
})

test('the window holds its hours across a daylight saving change', () => {
  // The Sunday between these two is when the US clocks go back.
  const before = pollWindow(central('2025-10-29T16:00:00Z'), CT)
  const after = pollWindow(central('2025-11-05T17:00:00Z'), CT)

  for (const window of [before, after]) {
    assert.equal(window.isOpen, true)
    assert.equal(zonedParts(new Date(window.opensAt), CT).hour, 10)
    assert.equal(zonedParts(new Date(window.closesAt), CT).hour, 12)
  }
  // The clocks going back means the same local 10am is a different instant:
  // 15:00 UTC while it is CDT, 16:00 UTC once it is CST. A fixed offset would
  // have given the same hour twice.
  assert.equal(new Date(before.opensAt).getUTCHours(), 15)
  assert.equal(new Date(after.opensAt).getUTCHours(), 16)
})

test('a window is 14 hours of Wednesday and 12 of Thursday', () => {
  const window = pollWindow(central('2025-09-03T16:00:00Z'), CT)
  const hours = (new Date(window.closesAt) - new Date(window.opensAt)) / 3_600_000
  assert.equal(hours, 26)
})

// ---------- the preseason poll ----------

const PRESEASON_OPENS = leagueMoment(PRESEASON_POLL.opens.date, PRESEASON_POLL.opens.time, CT)
const PRESEASON_CLOSES = leagueMoment(PRESEASON_POLL.closes.date, PRESEASON_POLL.closes.time, CT)

test('the preseason poll is shut before the draft and open after it', () => {
  const draft = KEY_DATES.find((entry) => entry.id === 'draft')
  const draftAt = leagueMoment(draft.date, draft.time, CT)

  assert.ok(PRESEASON_OPENS > draftAt, 'opens after the draft, not before it')
  assert.equal(preseasonWindow(new Date(draftAt.getTime() - 60_000), CT).phase, 'not-started')
  assert.equal(preseasonWindow(new Date(PRESEASON_OPENS.getTime() - 60_000), CT).phase, 'not-started')
  assert.equal(preseasonWindow(PRESEASON_OPENS, CT).phase, 'open')
})

test('the preseason poll closes at noon, and not a minute before', () => {
  assert.equal(preseasonWindow(new Date(PRESEASON_CLOSES.getTime() - 60_000), CT).isOpen, true)
  assert.equal(preseasonWindow(PRESEASON_CLOSES, CT).isOpen, false)
  assert.equal(preseasonWindow(PRESEASON_CLOSES, CT).phase, 'closed')

  const closes = zonedParts(PRESEASON_CLOSES, CT)
  assert.equal(closes.weekday, 3, 'a Wednesday')
  assert.equal(closes.hour, 12)
  assert.equal(closes.minute, 0)
})

test('the deadline sits in the gap between the draft and week 1', () => {
  // The guard on a season rolled forward: if WEEK_1 moves and the preseason
  // dates do not, the poll would close after games had been played (or, worse,
  // have closed already) and this is what says so.
  const week1 = leagueMoment(WEEK_1, '00:00', CT)
  const days = (week1 - PRESEASON_CLOSES) / 86_400_000

  assert.ok(PRESEASON_CLOSES < week1, 'the poll shuts before week 1')
  assert.ok(days <= 7, `the deadline is week 1's own week, not an earlier one (${days} days)`)
  assert.ok(PRESEASON_OPENS < PRESEASON_CLOSES, 'opens before it closes')
})

test('a shut preseason poll points at the first weekly one, not another preseason', () => {
  const after = preseasonWindow(new Date(PRESEASON_CLOSES.getTime() + 3_600_000), CT)
  const opens = zonedParts(new Date(after.opensAt), CT)

  assert.equal(opens.weekday, 3, 'Wednesday')
  assert.equal(opens.hour, 10)
  // The Wednesday after the one the deadline fell in — the Wednesday that
  // follows week 1's Monday night game, not the one the poll shut on.
  assert.ok(new Date(after.opensAt) > leagueMoment(WEEK_1, '00:00', CT), 'after week 1 is played')
  assert.equal(zonedParts(new Date(after.closesAt), CT).weekday, 4, 'shutting Thursday')
  assert.equal(zonedParts(new Date(after.closesAt), CT).hour, 12)
})

test('the preseason ballot is filed under week 1, which the weekly poll never uses', () => {
  // So the week 2 table has something to show movement against.
  assert.equal(PRESEASON_WEEK, 1)
  assert.ok(PRESEASON_WEEK < FIRST_POLL_WEEK)
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
