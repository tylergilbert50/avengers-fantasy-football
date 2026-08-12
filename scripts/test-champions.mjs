#!/usr/bin/env node
/**
 * Champions, built from hand-made seasons where the winner is known.
 *
 *   npm test
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { buildChampions, findChampion } from '../src/lib/espn/champions.js'

function team(id, name, manager, { wins = 0, losses = 0, pf = 0, games = 14, ...rest } = {}) {
  return {
    id,
    name,
    abbrev: name.slice(0, 3).toUpperCase(),
    logo: null,
    managerNames: manager,
    recordLabel: `${wins}-${losses}`,
    record: {
      wins,
      losses,
      ties: 0,
      gamesPlayed: games,
      pointsFor: pf,
      pointsForPerGame: games ? pf / games : 0,
    },
    playoffSeed: null,
    finalRank: null,
    ...rest,
  }
}

function bracket(week, home, homePts, away, awayPts) {
  return {
    week,
    playoffTier: 'WINNERS_BRACKET',
    isBye: false,
    isComplete: true,
    winner: homePts > awayPts ? 'HOME' : 'AWAY',
    margin: Math.abs(homePts - awayPts),
    home: { teamId: home.id, name: home.name, managerNames: home.managerNames, points: homePts },
    away: { teamId: away.id, name: away.name, managerNames: away.managerNames, points: awayPts },
  }
}

const SIX = team(1, 'Anyone Can Wear The Mask', 'Brett Gilbert', {
  wins: 6, losses: 8, pf: 1783.7, playoffSeed: 7, finalRank: 1,
})
const TEN = team(2, 'Genius, Plaiboi, Champion', 'Connor Bowser', {
  wins: 10, losses: 4, pf: 1777.16, playoffSeed: 1, finalRank: 2,
})

const SEASON_2025 = {
  season: 2025,
  teams: [TEN, SIX],
  matchups: [
    { week: 1, playoffTier: 'NONE', isComplete: true, isBye: false, winner: 'HOME',
      home: { teamId: 2, points: 100 }, away: { teamId: 1, points: 90 } },
    bracket(16, SIX, 167.3, TEN, 120.72),
    bracket(17, TEN, 109.56, SIX, 125.44),
  ],
}

test('the champion is the team ESPN ranked first, not the best record', () => {
  const champion = findChampion(SEASON_2025)
  assert.equal(champion.id, 1)
  assert.equal(champion.managerNames, 'Brett Gilbert')
})

test('a season with no final rank falls back to the last bracket game', () => {
  const unranked = {
    ...SEASON_2025,
    teams: SEASON_2025.teams.map((entry) => ({ ...entry, finalRank: null })),
  }
  assert.equal(findChampion(unranked).id, 1, 'the away side won the last game')
})

test('a season still being played has no champion', () => {
  assert.equal(findChampion({ season: 2026, teams: [team(1, 'A', 'Ann')], matchups: [] }), null)
  assert.equal(findChampion({}), null)
})

test('an undecided bracket game is not a title', () => {
  const midBracket = {
    season: 2026,
    teams: [{ ...SIX, finalRank: null }, { ...TEN, finalRank: null }],
    matchups: [{ ...bracket(16, SIX, 0, TEN, 0), isComplete: false, winner: 'UNDECIDED' }],
  }
  assert.equal(findChampion(midBracket), null)
})

const [champion] = buildChampions([SEASON_2025])

test('the record shown is the regular season it got there with', () => {
  assert.equal(champion.record.label, '6-8')
  assert.equal(champion.record.gamesPlayed, 14)
  assert.equal(champion.record.pointsPerWeek.toFixed(1), '127.4')
})

test('the manager slug matches the artwork file convention', () => {
  assert.equal(champion.managerSlug, 'brett-gilbert')
})

test('the title game is the last one, with the opponent resolved', () => {
  assert.equal(champion.titleGame.week, 17)
  assert.equal(champion.titleGame.points, 125.44)
  assert.equal(champion.titleGame.opponent, 'Genius, Plaiboi, Champion')
  assert.equal(champion.titleGame.opponentPoints, 109.56)
})

test('champions come back newest first, numbered in the order they were won', () => {
  const earlier = { ...SEASON_2025, season: 2023 }
  const middle = { ...SEASON_2025, season: 2024 }
  // Deliberately out of order: the shaping has to sort them.
  const all = buildChampions([middle, SEASON_2025, earlier])

  assert.deepEqual(all.map((entry) => entry.season), [2025, 2024, 2023])
  assert.deepEqual(all.map((entry) => entry.issue), [3, 2, 1])
})

test('a season nobody won drops out rather than appearing blank', () => {
  const all = buildChampions([SEASON_2025, { season: 2026, teams: [], matchups: [] }])
  assert.deepEqual(all.map((entry) => entry.season), [2025])
  assert.equal(all[0].issue, 1, 'the unplayed season does not take an issue number')
})

test('an empty league does not throw', () => {
  assert.deepEqual(buildChampions([]), [])
  assert.deepEqual(buildChampions(), [])
})
