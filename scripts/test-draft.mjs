#!/usr/bin/env node
/**
 * Draft board shaping, from hand-made payloads.
 *
 *   npm test
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { byRound, draftRecapUrl, normalizeDraft, playerSlug } from '../src/lib/espn/draft.js'

const TEAMS = [
  { id: 1, name: 'Team One', managerNames: 'Ann Adams' },
  { id: 2, name: 'Team Two', managerNames: 'Bob Brown' },
]

const PLAYERS = new Map([
  [10, { name: "Ja'Marr Chase", positionId: 3 }],
  [11, { name: 'Christian McCaffrey', positionId: 2 }],
  [12, { name: 'Amon-Ra St. Brown', positionId: 3 }],
])

function pick(overall, round, inRound, playerId, teamId, extra = {}) {
  return {
    overallPickNumber: overall,
    roundId: round,
    roundPickNumber: inRound,
    playerId,
    teamId,
    keeper: false,
    ...extra,
  }
}

const RAW = {
  draftDetail: {
    drafted: true,
    inProgress: false,
    // Deliberately out of order: the shaping has to sort them.
    picks: [
      pick(3, 2, 1, 12, 1),
      pick(1, 1, 1, 10, 1),
      pick(2, 1, 2, 11, 2),
      pick(4, 2, 2, -1, 2), // an undrafted placeholder
    ],
  },
  settings: { draftSettings: { type: 'SNAKE', date: 1724459400000 } },
}

const draft = normalizeDraft({ raw: RAW, teams: TEAMS, players: PLAYERS, leagueId: 42, season: 2025 })

test('picks come back in draft order', () => {
  assert.deepEqual(draft.picks.map((p) => p.overall), [1, 2, 3])
})

test('placeholder picks are dropped', () => {
  assert.equal(draft.pickCount, 3, 'the playerId -1 row is not a pick')
  assert.ok(draft.picks.every((p) => p.playerId > 0))
})

test('slots read the way people say them', () => {
  assert.deepEqual(draft.picks.map((p) => p.label), ['1.01', '1.02', '2.01'])
})

test('players, positions and managers are resolved', () => {
  const [first] = draft.picks
  assert.equal(first.player, "Ja'Marr Chase")
  assert.equal(first.position, 'WR')
  assert.equal(first.manager, 'Ann Adams')
})

test('the top pick is the first overall, not the first in the array', () => {
  assert.equal(draft.topPick.overall, 1)
  assert.equal(draft.topPick.player, "Ja'Marr Chase")
})

test('the first round is separated out', () => {
  assert.deepEqual(draft.firstRound.map((p) => p.label), ['1.01', '1.02'])
})

test('an unknown player id degrades to a readable placeholder', () => {
  const d = normalizeDraft({
    raw: { draftDetail: { drafted: true, picks: [pick(1, 1, 1, 999, 1)] } },
    teams: TEAMS, players: PLAYERS, leagueId: 42, season: 2025,
  })
  assert.equal(d.picks[0].player, 'Player 999')
  assert.equal(d.picks[0].position, '', 'no position rather than a raw id')
})

test('a season with nothing drafted yields no picks and is not complete', () => {
  const d = normalizeDraft({
    raw: { draftDetail: { drafted: false, picks: [pick(1, 1, 1, -1, 1)] } },
    teams: TEAMS, players: PLAYERS, leagueId: 42, season: 2026,
  })
  assert.equal(d.pickCount, 0)
  assert.equal(d.isComplete, false)
  assert.equal(d.topPick, null)
  assert.equal(d.rounds, 0)
})

test('an empty payload does not throw', () => {
  const d = normalizeDraft({ raw: {}, teams: [], players: new Map(), leagueId: 42, season: 2020 })
  assert.equal(d.pickCount, 0)
  assert.equal(d.topPick, null)
})

test('rounds group in order', () => {
  const grouped = byRound(draft.picks)
  assert.deepEqual(grouped.map((g) => g.round), [1, 2])
  assert.equal(grouped[0].picks.length, 2)
})

test('apostrophes close up in slugs so artwork can be matched by name', () => {
  assert.equal(playerSlug("Ja'Marr Chase"), 'jamarr-chase')
  assert.equal(playerSlug('Christian McCaffrey'), 'christian-mccaffrey')
  assert.equal(playerSlug('Amon-Ra St. Brown'), 'amon-ra-st-brown')
  assert.equal(playerSlug("D'Andre Swift"), 'dandre-swift')
  assert.equal(playerSlug(null), '')
})

test('the recap url carries the league and the season', () => {
  const url = new URL(draftRecapUrl({ leagueId: 42, season: 2024 }))
  assert.equal(url.origin + url.pathname, 'https://fantasy.espn.com/football/league/draftrecap')
  assert.equal(url.searchParams.get('leagueId'), '42')
  assert.equal(url.searchParams.get('seasonId'), '2024')
  assert.equal(draftRecapUrl({ leagueId: null, season: 2024 }), null)
})

test('an offline draft is still a draft', () => {
  const d = normalizeDraft({
    raw: { ...RAW, settings: { draftSettings: { type: 'OFFLINE' } } },
    teams: TEAMS, players: PLAYERS, leagueId: 42, season: 2023,
  })
  assert.equal(d.type, 'OFFLINE')
  assert.equal(d.pickCount, 3)
})
