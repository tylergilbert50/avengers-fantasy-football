#!/usr/bin/env node
/**
 * Waiver reconstruction and activity stats, from hand-made payloads.
 *
 *   npm test
 *
 * The thing worth pinning down is the seam: ESPN's counts are complete and the
 * named pickups are not, and the two must never be quietly swapped for one
 * another. Most of what follows is about that.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSeasonPickups,
  buildWaiverStats,
  seasonCounters,
  sortPickups,
  startedPickups,
  waiverHighlights,
} from '../src/lib/waivers/build.js'
import { tidyManagerName } from '../src/lib/season/activity.js'

const TEAMS = [
  { id: 1, manager: 'Ann Adams', name: 'Team One' },
  { id: 2, manager: 'Bob Brown', name: 'Team Two' },
]

const WR = 4
const BENCH = 20

function on(playerId, teamId, { slot = WR, score = 0, player } = {}) {
  return { playerId, teamId, slot, score, player: player ?? `Player ${playerId}` }
}

function weeksOf(...rows) {
  return rows.map((entries, index) => ({ week: index + 1, entries }))
}

// ---------- manager names ----------

test('a name typed in lower case is capitalised', () => {
  assert.equal(tidyManagerName('travis wolfe'), 'Travis Wolfe')
  assert.equal(tidyManagerName('mary-jane watson'), 'Mary-Jane Watson')
})

test('a name that carries its own capitals keeps them', () => {
  // The trap in every title-caser: this must not become "Mccoy" or "O'brien".
  assert.equal(tidyManagerName('McCoy Smith'), 'McCoy Smith')
  assert.equal(tidyManagerName("O'Brien"), "O'Brien")
  assert.equal(tidyManagerName('Brett Gilbert'), 'Brett Gilbert')
})

test('an absent name does not throw', () => {
  assert.equal(tidyManagerName(null), '')
  assert.equal(tidyManagerName(''), '')
})

// ---------- ESPN's own counters ----------

const RAW = {
  settings: { acquisitionSettings: { acquisitionBudget: 200 } },
  teams: [
    {
      id: 1,
      transactionCounter: {
        acquisitions: 40,
        drops: 38,
        acquisitionBudgetSpent: 150,
        moveToIR: 3,
        matchupAcquisitionTotals: { 3: 2, 1: 5 },
      },
    },
    { id: 2, transactionCounter: { acquisitions: 4, drops: 4, acquisitionBudgetSpent: 0 } },
  ],
}

test('counters are read straight off ESPN, budget and all', () => {
  const [ann, bob] = seasonCounters({ raw: RAW, season: 2025, teams: TEAMS })

  assert.equal(ann.manager, 'Ann Adams')
  assert.equal(ann.adds, 40)
  assert.equal(ann.drops, 38)
  assert.equal(ann.spent, 150)
  assert.equal(ann.budget, 200)
  assert.equal(ann.remaining, 50)
  assert.equal(ann.movesToIR, 3)
  assert.equal(bob.spent, 0)
  assert.equal(bob.remaining, 200, 'a manager who never bid keeps the lot')
})

test('adds-by-week come back in week order, whatever order ESPN keyed them', () => {
  const [ann] = seasonCounters({ raw: RAW, season: 2025, teams: TEAMS })
  assert.deepEqual(ann.addsByWeek, [{ week: 1, count: 5 }, { week: 3, count: 2 }])
})

test('an empty payload yields nothing rather than throwing', () => {
  assert.deepEqual(seasonCounters({ raw: {}, season: 2025, teams: [] }), [])
  assert.deepEqual(buildSeasonPickups({ season: 2025 }).pickups, [])
})

// ---------- reconstructing pickups ----------

test('a player arriving from nobody is a pickup, and is scored from that week', () => {
  const { pickups } = buildSeasonPickups({
    season: 2025,
    teams: TEAMS,
    weeks: weeksOf(
      [on(10, 1)],
      [on(10, 1), on(20, 1, { score: 15, player: 'Waiver Gem' })],
      [on(10, 1), on(20, 1, { score: 25, player: 'Waiver Gem' })],
    ),
  })

  assert.equal(pickups.length, 1)
  const [pickup] = pickups
  assert.equal(pickup.player, 'Waiver Gem')
  assert.equal(pickup.week, 2)
  assert.equal(pickup.manager, 'Ann Adams')
  assert.equal(pickup.points, 40)
  assert.equal(pickup.started, 2)
})

test('a player arriving from another team came by trade and is not a pickup', () => {
  const { pickups } = buildSeasonPickups({
    season: 2025,
    teams: TEAMS,
    weeks: weeksOf(
      [on(30, 2)],
      [on(30, 1, { score: 50 })],
    ),
  })
  assert.equal(pickups.length, 0, 'he was on a roster last week, so somebody traded him')
})

test('points stop when the pickup is dropped or moved on', () => {
  const { pickups } = buildSeasonPickups({
    season: 2025,
    teams: TEAMS,
    weeks: weeksOf(
      [on(1, 1)],
      [on(1, 1), on(40, 1, { score: 10 })],
      // Picked up by the other team: those weeks are no longer Ann's.
      [on(1, 1), on(40, 2, { score: 99 })],
    ),
  })
  assert.equal(pickups[0].points, 10)
  assert.equal(pickups[0].manager, 'Ann Adams')
})

test('a pickup left on the bench counts as picked up and nothing else', () => {
  const { pickups } = buildSeasonPickups({
    season: 2025,
    teams: TEAMS,
    weeks: weeksOf(
      [on(1, 1)],
      [on(1, 1), on(50, 1, { slot: BENCH, score: 40 })],
    ),
  })
  assert.equal(pickups[0].points, 0)
  assert.equal(pickups[0].started, 0)
  assert.equal(pickups[0].heldWeeks, 1)
})

test('drops are counted as the mirror of arrivals', () => {
  const { dropCount } = buildSeasonPickups({
    season: 2025,
    teams: TEAMS,
    weeks: weeksOf(
      [on(1, 1), on(2, 1)],
      [on(1, 1)],
    ),
  })
  assert.equal(dropCount, 1)
})

test('pickups nobody ever started are held back from the list', () => {
  const pickups = [
    { player: 'Started', points: 30, started: 3 },
    { player: 'Never played', points: 0, started: 0 },
  ]
  assert.deepEqual(startedPickups(pickups).map((p) => p.player), ['Started'])
})

test('pickups sort best first', () => {
  const sorted = sortPickups([
    { points: 10, started: 1, season: 2025, week: 3 },
    { points: 90, started: 5, season: 2024, week: 1 },
  ])
  assert.deepEqual(sorted.map((p) => p.points), [90, 10])
})

// ---------- the activity table ----------

const COUNTERS = [
  { season: 2024, manager: 'Ann Adams', adds: 30, drops: 28, spent: 200, budget: 200, movesToIR: 1, addsByWeek: [] },
  { season: 2025, manager: 'Ann Adams', adds: 10, drops: 9, spent: 100, budget: 200, movesToIR: 0, addsByWeek: [] },
  { season: 2025, manager: 'Bob Brown', adds: 5, drops: 5, spent: 20, budget: 200, movesToIR: 0, addsByWeek: [] },
]

const PICKUPS = [
  { season: 2024, manager: 'Ann Adams', player: 'Big Hit', points: 120, started: 10, week: 4 },
  { season: 2025, manager: 'Ann Adams', player: 'Small Hit', points: 20, started: 2, week: 6 },
]

test('activity totals every season a manager played', () => {
  const stats = buildWaiverStats({ counters: COUNTERS, pickups: PICKUPS })
  const ann = stats.find((row) => row.manager === 'Ann Adams')

  assert.equal(ann.seasons, 2)
  assert.equal(ann.adds, 40)
  assert.equal(ann.drops, 37)
  assert.equal(ann.spent, 300)
  assert.equal(ann.addsPerSeason, 20)
})

test('spend is measured against the budgets actually handed out', () => {
  const stats = buildWaiverStats({ counters: COUNTERS, pickups: PICKUPS })
  const ann = stats.find((row) => row.manager === 'Ann Adams')
  const bob = stats.find((row) => row.manager === 'Bob Brown')

  // Two seasons at $200 is a $400 budget, of which she spent $300.
  assert.equal(ann.budget, 400)
  assert.equal(ann.spentPct, 0.75)
  assert.equal(ann.remaining, 100)
  assert.equal(bob.spentPct, 0.1, 'one season, $20 of $200')
})

test('the best pickup is the best one, across every season', () => {
  const stats = buildWaiverStats({ counters: COUNTERS, pickups: PICKUPS })
  const ann = stats.find((row) => row.manager === 'Ann Adams')

  assert.equal(ann.bestPickup.player, 'Big Hit')
  assert.equal(ann.bestPickup.season, 2024)
  assert.equal(ann.namedPickups, 2)
  assert.equal(ann.pickupPoints, 140)
})

test('a manager with no named pickup still gets a row', () => {
  const stats = buildWaiverStats({ counters: COUNTERS, pickups: PICKUPS })
  const bob = stats.find((row) => row.manager === 'Bob Brown')

  assert.equal(bob.bestPickup, null, 'nothing to show, rather than a fabricated one')
  assert.equal(bob.adds, 5, 'but ESPN still counted his adds')
})

test('the counted adds and the named pickups are kept apart', () => {
  const highlights = waiverHighlights({
    counters: COUNTERS,
    pickups: PICKUPS,
    stats: buildWaiverStats({ counters: COUNTERS, pickups: PICKUPS }),
  })

  assert.equal(highlights.totalAdds, 45, "ESPN's count, which is complete")
  assert.equal(highlights.namedPickups, 2, 'what the weekly rosters could name, which is not')
  assert.equal(highlights.totalSpent, 320)
  assert.equal(highlights.bestPickup.player, 'Big Hit')
})

test('one season at a full budget does not make somebody the biggest spender', () => {
  const counters = [
    ...COUNTERS,
    // A single season, every dollar spent — a full budget, not a habit.
    { season: 2025, manager: 'Cal Clark', adds: 3, drops: 3, spent: 200, budget: 200, movesToIR: 0, addsByWeek: [] },
  ]
  const stats = buildWaiverStats({ counters, pickups: PICKUPS })
  const highlights = waiverHighlights({ counters, pickups: PICKUPS, stats })

  assert.equal(highlights.biggestSpender.manager, 'Ann Adams', 'two seasons at 75% beats one at 100%')
  assert.ok(stats.some((row) => row.manager === 'Cal Clark'), 'he is still in the table')
})
