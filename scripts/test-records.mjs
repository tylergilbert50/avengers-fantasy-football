#!/usr/bin/env node
/**
 * The record book, built from hand-made seasons where the right answer is known.
 *
 *   npm test
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { boxscoreUrl, buildRecords, collectGames, managerLabels, streaks } from '../src/lib/espn/records.js'

const ANN = { id: 'ann', name: 'Ann Adams' }
const BOB = { id: 'bob', name: 'Bob Brown' }
const CAL = { id: 'cal', name: 'Cal Adams' }
/** Same first name as ANN, different person — the case short labels must split. */
const ANN2 = { id: 'ann2', name: 'Ann Baker' }

function team(id, manager, { pf = 0, pa = 0, games = 0 } = {}) {
  return {
    id,
    name: `Team ${id}`,
    abbrev: `T${id}`,
    managers: [manager],
    primaryOwnerId: manager.id,
    record: {
      pointsFor: pf,
      pointsAgainst: pa,
      gamesPlayed: games,
      pointsForPerGame: games ? pf / games : 0,
      pointsAgainstPerGame: games ? pa / games : 0,
    },
  }
}

function game(week, homeId, homePts, awayId, awayPts, extra = {}) {
  return {
    week,
    playoffTier: 'NONE',
    isBye: false,
    isComplete: true,
    winner: homePts > awayPts ? 'HOME' : homePts < awayPts ? 'AWAY' : 'TIE',
    home: { teamId: homeId, points: homePts },
    away: { teamId: awayId, points: awayPts },
    ...extra,
  }
}

const SEASONS = [
  {
    season: 2024,
    leagueId: 42,
    teams: [team(1, ANN, { pf: 300, pa: 250, games: 2 }), team(2, BOB, { pf: 250, pa: 300, games: 2 })],
    matchups: [game(1, 1, 150.5, 2, 100.25), game(2, 1, 149.5, 2, 149.75)],
  },
  {
    season: 2025,
    leagueId: 42,
    teams: [team(1, ANN, { pf: 400, pa: 100, games: 2 }), team(2, BOB, { pf: 100, pa: 400, games: 2 })],
    matchups: [game(1, 1, 200, 2, 50), game(2, 2, 50, 1, 200)],
  },
]

const groupsById = Object.fromEntries(buildRecords(SEASONS).map((g) => [g.id, g]))

test('every category is produced', () => {
  assert.equal(Object.keys(groupsById).length, 12)
  for (const [id, group] of Object.entries(groupsById)) {
    assert.ok(group.title, `${id} has a title`)
    assert.ok(group.columns.length >= 3, `${id} has columns`)
  }
})

test('highest and lowest single week pick the right games', () => {
  const high = groupsById['highest-week'].rows
  assert.equal(high[0].primary, 'Ann')
  assert.equal(high[0].cells[0], '200.00')
  const low = groupsById['lowest-week'].rows
  assert.equal(low[0].cells[0], '50.00')
})

test('combined score adds both sides', () => {
  // 149.5 + 149.75 = 299.25 is the highest combined here.
  assert.equal(groupsById['highest-combined'].rows[0].cells[0], '299.25')
  assert.equal(groupsById['lowest-combined'].rows[0].cells[0], '250.00')
})

test('margins are absolute, and the smallest margin finds the close game', () => {
  assert.equal(groupsById['largest-margin'].rows[0].cells[0], '150.00')
  assert.equal(groupsById['smallest-margin'].rows[0].cells[0], '0.25')
})

test('the winner is named first in matchup rows', () => {
  // Week 2 of 2024: away (Bob) won by 0.25.
  assert.equal(groupsById['smallest-margin'].rows[0].primary, 'Bob vs Ann')
})

test('season totals come from the season record, not the game log', () => {
  const high = groupsById['highest-season-pf'].rows[0]
  assert.equal(high.primary, 'Ann')
  assert.equal(high.cells[1], '400.00')
  assert.equal(high.cells[2], '2025')
  assert.equal(groupsById['lowest-season-pf'].rows[0].cells[1], '100.00')
  assert.equal(groupsById['highest-season-pa'].rows[0].cells[1], '400.00')
  assert.equal(groupsById['lowest-season-pa'].rows[0].cells[1], '100.00')
})

test('a season nobody has played is left out of season totals', () => {
  const withEmpty = [...SEASONS, { season: 2026, leagueId: 42, teams: [team(1, ANN)], matchups: [] }]
  const rows = buildRecords(withEmpty).find((g) => g.id === 'lowest-season-pf').rows
  assert.ok(rows.every((row) => row.cells[2] !== '2026'), '2026 has no games and must not rank')
})

test('streaks run across season boundaries', () => {
  // Ann wins 2024 W1, loses W2, then wins both of 2025.
  const wins = streaks(collectGames(SEASONS, managerLabels(SEASONS)), 'W')
  const ann = wins.find((row) => row.primary === 'Ann')
  assert.equal(ann.cells[0], '2')
  assert.equal(ann.cells[1], 'W1 2025 – W2 2025')
})

test('a tie ends a streak rather than extending it', () => {
  const tied = [{
    season: 2030, leagueId: 42,
    teams: [team(1, ANN, { games: 3 }), team(2, BOB, { games: 3 })],
    matchups: [game(1, 1, 100, 2, 90), game(2, 1, 80, 2, 80), game(3, 1, 100, 2, 90)],
  }]
  const wins = streaks(collectGames(tied, managerLabels(tied)), 'W')
  const ann = wins.filter((row) => row.primary === 'Ann')
  assert.equal(ann[0].cells[0], '1', 'the tie must split the two wins apart')
})

test('unplayed 0-0 pairings are not counted as games', () => {
  const withBlank = [{
    season: 2031, leagueId: 42,
    teams: [team(1, ANN, { games: 1 }), team(2, BOB, { games: 1 })],
    matchups: [game(1, 1, 100, 2, 90), game(2, 1, 0, 2, 0)],
  }]
  assert.equal(collectGames(withBlank, managerLabels(withBlank)).length, 1)
})

test('postseason games are excluded from every category', () => {
  const withPlayoffs = [{
    season: 2040, leagueId: 42, regularSeasonWeeks: 2,
    teams: [team(1, ANN, { pf: 100, games: 2 }), team(2, BOB, { pf: 90, games: 2 })],
    matchups: [
      game(1, 1, 120, 2, 90),
      game(2, 1, 110, 2, 95),
      // The three postseason shapes ESPN produces. None may appear.
      game(3, 1, 400, 2, 10, { playoffTier: 'WINNERS_BRACKET' }),
      game(4, 1, 5, 2, 6, { playoffTier: 'LOSERS_CONSOLATION_LADDER' }),
      game(5, 1, 300, 2, 20, { playoffTier: 'WINNERS_CONSOLATION_LADDER' }),
    ],
  }]
  const games = collectGames(withPlayoffs, managerLabels(withPlayoffs))
  assert.equal(games.length, 2, 'only the two regular-season weeks survive')

  const groups = Object.fromEntries(buildRecords(withPlayoffs).map((g) => [g.id, g]))
  assert.equal(groups['highest-week'].rows[0].cells[0], '120.00', '400 was a playoff game')
  assert.equal(groups['lowest-week'].rows[0].cells[0], '90.00', '5 was a consolation game')
  assert.equal(groups['largest-margin'].rows[0].cells[0], '30.00', 'not the 390 blowout')
  assert.equal(groups['smallest-margin'].rows[0].cells[0], '15.00', 'not the 1-point consolation')
})

test('an untagged game past the regular season is still excluded', () => {
  // Belt and braces: ESPN occasionally leaves a consolation game as NONE.
  const untagged = [{
    season: 2041, leagueId: 42, regularSeasonWeeks: 2,
    teams: [team(1, ANN, { games: 2 }), team(2, BOB, { games: 2 })],
    matchups: [game(1, 1, 120, 2, 90), game(2, 1, 110, 2, 95), game(3, 1, 999, 2, 10)],
  }]
  const games = collectGames(untagged, managerLabels(untagged))
  assert.equal(games.length, 2, 'week 3 is past the 2-week regular season')
})

test('a streak carries across the postseason into the next year', () => {
  // Ann wins both regular-season weeks of 2042, loses the playoff, then wins
  // the opener of 2043. The playoff loss must neither break nor count.
  const across = [
    {
      season: 2042, leagueId: 42, regularSeasonWeeks: 2,
      teams: [team(1, ANN, { games: 2 }), team(2, BOB, { games: 2 })],
      matchups: [
        game(1, 1, 120, 2, 90),
        game(2, 1, 110, 2, 95),
        game(3, 1, 50, 2, 150, { playoffTier: 'WINNERS_BRACKET' }),
      ],
    },
    {
      season: 2043, leagueId: 42, regularSeasonWeeks: 2,
      teams: [team(1, ANN, { games: 1 }), team(2, BOB, { games: 1 })],
      matchups: [game(1, 1, 130, 2, 80)],
    },
  ]
  const wins = streaks(collectGames(across, managerLabels(across)), 'W')
  const ann = wins.find((row) => row.primary === 'Ann')
  assert.equal(ann.cells[0], '3', 'two from 2042 plus one from 2043')
  assert.equal(ann.cells[1], 'W1 2042 – W1 2043')
})

test('byes and unfinished games are skipped', () => {
  const messy = [{
    season: 2032, leagueId: 42,
    teams: [team(1, ANN, { games: 1 }), team(2, BOB, { games: 1 })],
    matchups: [
      game(1, 1, 120, 2, 90),
      { week: 2, isBye: true, isComplete: true, home: { teamId: 1, points: 90 }, away: null },
      { ...game(3, 1, 10, 2, 5), isComplete: false },
    ],
  }]
  assert.equal(collectGames(messy, managerLabels(messy)).length, 1)
})

test('managers keep one identity even when the team is renamed', () => {
  const renamed = [
    { season: 2024, leagueId: 42, teams: [{ ...team(1, ANN, { pf: 100, games: 1 }), name: 'Old Name' }],
      matchups: [] },
    { season: 2025, leagueId: 42, teams: [{ ...team(1, ANN, { pf: 200, games: 1 }), name: 'Brand New Name' }],
      matchups: [] },
  ]
  const rows = buildRecords(renamed).find((g) => g.id === 'highest-season-pf').rows
  assert.deepEqual(rows.map((r) => r.primary), ['Ann', 'Ann'])
})

test('managers sharing a first name are told apart by last initial', () => {
  const shared = [{ season: 2025, leagueId: 42, teams: [team(1, ANN), team(3, ANN2)], matchups: [] }]
  const labels = managerLabels(shared)
  assert.equal(labels.get('ann').short, 'Ann A.')
  assert.equal(labels.get('ann2').short, 'Ann B.')
})

test('a first name nobody else has stays a bare first name', () => {
  const distinct = [{ season: 2025, leagueId: 42, teams: [team(1, ANN), team(3, CAL)], matchups: [] }]
  const labels = managerLabels(distinct)
  assert.equal(labels.get('ann').short, 'Ann', 'Adams is shared but the first names differ')
  assert.equal(labels.get('cal').short, 'Cal')
})

test('matchup rows link to the ESPN box score, season rows do not', () => {
  for (const id of ['highest-week', 'lowest-week', 'highest-combined', 'largest-margin']) {
    assert.ok(groupsById[id].rows.every((row) => row.link), `${id} rows link`)
  }
  for (const id of ['highest-season-pf', 'win-streaks', 'lose-streaks']) {
    assert.ok(groupsById[id].rows.every((row) => row.link === null), `${id} rows do not link`)
  }
})

test('the box score url carries league, season and week', () => {
  const url = new URL(boxscoreUrl({ leagueId: 42, season: 2025, week: 3, teamId: 7 }))
  assert.equal(url.searchParams.get('leagueId'), '42')
  assert.equal(url.searchParams.get('seasonId'), '2025')
  assert.equal(url.searchParams.get('matchupPeriodId'), '3')
  assert.equal(url.searchParams.get('scoringPeriodId'), '3')
  assert.equal(url.searchParams.get('teamId'), '7')
})

test('no category ever returns more than five rows', () => {
  const many = [{
    season: 2025, leagueId: 42,
    teams: Array.from({ length: 8 }, (_, i) => team(i + 1, { id: `m${i}`, name: `M${i} L${i}` }, { pf: i * 10, games: 1 })),
    matchups: Array.from({ length: 8 }, (_, i) => game(i + 1, 1, 100 + i, 2, 50 + i)),
  }]
  for (const group of buildRecords(many)) {
    assert.ok(group.rows.length <= 5, `${group.id} returned ${group.rows.length}`)
  }
})

test('an empty league produces empty groups rather than throwing', () => {
  const groups = buildRecords([])
  assert.equal(groups.length, 12)
  assert.ok(groups.every((g) => g.rows.length === 0))
})
