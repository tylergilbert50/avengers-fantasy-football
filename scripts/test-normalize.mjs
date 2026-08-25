#!/usr/bin/env node
/**
 * Runs the normalizers against a saved fixture. No network, no credentials.
 *
 *   npm test
 *
 * Uses node:test so there is no test-runner dependency to install.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { currentSeason, normalizeSwid, readEspnEnv } from '../src/lib/espn/config.js'
import { normalizeLeague, normalizeMatchups, formatRecord } from '../src/lib/espn/normalize.js'

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/lib/espn/__fixtures__/league.json', import.meta.url)), 'utf8'),
)

test('normalizeLeague reads league metadata', () => {
  const league = normalizeLeague(fixture)
  assert.equal(league.leagueId, 123456)
  assert.equal(league.season, 2025)
  assert.equal(league.settings.name, 'New Avengers')
  assert.equal(league.settings.size, 4)
  assert.equal(league.status.currentMatchupPeriod, 4)
  assert.deepEqual(league.status.previousSeasons, [2024, 2023, 2022])
})

test('standings sort by ESPN playoff seed and get a rank', () => {
  const { standings } = normalizeLeague(fixture)
  assert.deepEqual(
    standings.map((t) => t.id),
    [2, 1, 3, 4],
  )
  assert.deepEqual(
    standings.map((t) => t.rank),
    [1, 2, 3, 4],
  )
})

test('standings fall back to win% then points for when seeds are absent', () => {
  const unseeded = {
    ...fixture,
    teams: fixture.teams.map((team) => ({ ...team, playoffSeed: 0 })),
  }
  const { standings } = normalizeLeague(unseeded)
  // 4-0, then 3-1, then 1-2-1, then 0-4.
  assert.deepEqual(
    standings.map((t) => t.id),
    [2, 1, 3, 4],
  )
})

/** The fixture as it sits between the draft and week 1: no seeds, no results. */
const preseason = {
  ...fixture,
  teams: fixture.teams.map((team) => ({ ...team, points: 0, playoffSeed: 0, record: {} })),
}

/** Last season, by owner: Jo won it, Tyler second, Sam & co third. */
const priorFinish = {
  season: 2024,
  rankByOwner: new Map([['{DDD}', 1], ['{AAA}', 2], ['{BBB}', 3]]),
}

test("the preseason table stands in last season's finishing order", () => {
  const league = normalizeLeague(preseason, { priorFinish })
  assert.deepEqual(
    league.standings.map((t) => t.id),
    [3, 1, 2, 4],
  )
  assert.deepEqual(
    league.standings.map((t) => t.rank),
    [1, 2, 3, 4],
  )
  // The unclaimed team's owner never finished anywhere, so it goes last.
  assert.equal(league.standings[3].id, 4)
  assert.equal(league.standingsFrom, 2024)
})

test('managers who were not here last season sort together, by name', () => {
  const league = normalizeLeague(preseason, {
    priorFinish: { season: 2024, rankByOwner: new Map([['{DDD}', 1]]) },
  })
  assert.deepEqual(
    league.standings.map((t) => t.name),
    ['THR', "Cap's Shield", 'Unclaimed Squad', "Widow's Bite"],
  )
})

test('the first played week takes the order back from last season', () => {
  const league = normalizeLeague(fixture, { priorFinish })
  // Seeded and played, so ESPN's own ranking wins and nothing is borrowed.
  assert.deepEqual(
    league.standings.map((t) => t.id),
    [2, 1, 3, 4],
  )
  assert.equal(league.standingsFrom, null)
})

test("a preseason with nothing to borrow keeps ESPN's order", () => {
  const league = normalizeLeague(preseason)
  assert.equal(league.standingsFrom, null)
  assert.deepEqual(
    league.standings.map((t) => t.id),
    [1, 2, 3, 4],
  )
})

test('records carry wins, points for, points against and differential', () => {
  const { standings } = normalizeLeague(fixture)
  const cap = standings.find((t) => t.id === 1)

  assert.equal(cap.record.wins, 3)
  assert.equal(cap.record.losses, 1)
  assert.equal(cap.record.gamesPlayed, 4)
  assert.equal(cap.record.pointsFor, 402.5)
  assert.equal(cap.record.pointsAgainst, 380.25)
  assert.equal(cap.record.pointsDifferential, 22.25)
  assert.equal(cap.record.pointsForPerGame, 100.63)
  assert.equal(cap.recordLabel, '3-1')
  assert.deepEqual(cap.record.streak, { length: 2, type: 'WIN' })
})

test('ties count as half a win and show in the record label', () => {
  const { standings } = normalizeLeague(fixture)
  const thor = standings.find((t) => t.id === 3)
  assert.equal(thor.recordLabel, '1-2-1')
  assert.equal(thor.record.winPct, 0.375) // (1 + 0.5) / 4
  assert.equal(formatRecord({ wins: 5, losses: 2, ties: 0 }), '5-2')
})

test('team names handle both the modern and legacy ESPN shapes', () => {
  const { teams } = normalizeLeague(fixture)
  assert.equal(teams.find((t) => t.id === 1).name, "Cap's Shield") // `name`
  assert.equal(teams.find((t) => t.id === 2).name, "Widow's Bite") // location + nickname
  assert.equal(teams.find((t) => t.id === 3).name, 'THR') // abbrev fallback
})

test('managers resolve from owner SWIDs, including co-managers', () => {
  const league = normalizeLeague(fixture)
  const widow = league.teams.find((t) => t.id === 2)

  assert.equal(widow.managers.length, 2)
  assert.equal(widow.managerNames, 'Sam R & quietcornerback')
  // A member with no first/last name falls back to the display name.
  assert.equal(widow.managers[1].name, 'quietcornerback')

  const tyler = league.managers.find((m) => m.id === '{AAA}')
  assert.equal(tyler.name, 'Tyler G')
  assert.equal(tyler.isLeagueManager, true)
  assert.equal(tyler.teamName, "Cap's Shield")
  assert.equal(tyler.rank, 2)
})

test('a team with no owners is marked unclaimed rather than crashing', () => {
  const { teams } = normalizeLeague(fixture)
  const orphan = teams.find((t) => t.id === 4)
  assert.deepEqual(orphan.managers, [])
  assert.equal(orphan.managerNames, 'Unclaimed')
})

test('managers are ordered by standing', () => {
  const { managers } = normalizeLeague(fixture)
  assert.deepEqual(
    managers.map((m) => m.rank),
    [1, 1, 2, 3],
  )
})

test('normalizeMatchups resolves teams and computes margins', () => {
  const matchups = normalizeMatchups(fixture)
  assert.equal(matchups.length, 3)

  const first = matchups[0]
  assert.equal(first.week, 1)
  assert.equal(first.home.name, "Cap's Shield")
  assert.equal(first.away.name, "Widow's Bite")
  assert.equal(first.away.points, 110.25)
  assert.equal(first.margin, 14.75)
  assert.equal(first.isComplete, true)
  assert.equal(first.isBye, false)
})

test('normalizeMatchups filters by week and handles byes', () => {
  const week2 = normalizeMatchups(fixture, { week: 2 })
  assert.equal(week2.length, 1)
  assert.equal(week2[0].isBye, true)
  assert.equal(week2[0].away, null)
  assert.equal(week2[0].margin, null)
  assert.equal(week2[0].isComplete, false)
})

test('normalizeLeague survives an empty payload', () => {
  const league = normalizeLeague({})
  assert.deepEqual(league.teams, [])
  assert.deepEqual(league.standings, [])
  assert.deepEqual(league.managers, [])
})

test('currentSeason rolls over in June', () => {
  // Built from local-time parts on purpose: currentSeason reads getMonth(),
  // so a UTC-midnight boundary date would land in the previous month here.
  assert.equal(currentSeason(new Date(2026, 7, 2)), 2026) // August
  assert.equal(currentSeason(new Date(2026, 0, 15)), 2025) // January
  assert.equal(currentSeason(new Date(2026, 5, 1)), 2026) // first day of June
  assert.equal(currentSeason(new Date(2026, 4, 31)), 2025) // last day of May
})

test('SWID gets braces whether or not they were pasted', () => {
  assert.equal(normalizeSwid('ABC-123'), '{ABC-123}')
  assert.equal(normalizeSwid('{ABC-123}'), '{ABC-123}')
  assert.equal(normalizeSwid(''), '')
})

test('readEspnEnv defaults the season and detects credentials', () => {
  const bare = readEspnEnv({ ESPN_LEAGUE_ID: '999' })
  assert.equal(bare.leagueId, '999')
  assert.equal(bare.defaultSeason, currentSeason())
  assert.equal(bare.hasCredentials, false)

  const full = readEspnEnv({ ESPN_LEAGUE_ID: '999', ESPN_SEASON: '2024', ESPN_S2: 'x', ESPN_SWID: 'y' })
  assert.equal(full.defaultSeason, 2024)
  assert.equal(full.hasCredentials, true)
  assert.equal(full.swid, '{y}')
})
