#!/usr/bin/env node
/**
 * The league history, folded out of a hand-made game log where the answers are
 * countable by eye — and then sanity-checked against the real one.
 *
 *   npm test
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import ARCHIVE from '../src/lib/history/archive.js'
import { awardsFor, STAN_LEE_AWARD } from '../src/lib/history/awards.js'
import { managerProfile, weekExtremes } from '../src/lib/history/manager.js'
import { mergeHistory, seasonFinishes, seasonGames } from '../src/lib/history/merge.js'
import {
  bestWeeks,
  playedWeeks,
  positionName,
  seasonsToFetch,
  weekEntries,
} from '../src/lib/history/players.js'
import {
  allTimeTable,
  gamesBySeason,
  headToHead,
  recordLabel,
  seasonSummaries,
  shortLabels,
  sortRows,
  winPct,
} from '../src/lib/history/summary.js'

const game = (season, week, a, ap, b, bp, type = 'R') => ({ season, week, type, a, ap, b, bp })

const DATA = {
  seasons: [2021, 2022],
  owners: [
    { name: 'Ann Adams', status: 'Active' },
    { name: 'Bob Brown', status: 'Active' },
    { name: 'Cal Clark', status: 'Retired' },
  ],
  titles: [
    { season: 2021, champion: 'Ann Adams', sacko: 'Cal Clark' },
    { season: 2022, champion: 'Ann Adams', sacko: 'Bob Brown' },
  ],
  finances: [{ season: 2021, buyIn: 20, first: 180, second: 20 }],
  divisions: [{ season: 2021, owner: 'Ann Adams', division: 'Shield', finish: 1 }],
  games: [
    game(2021, 1, 'Ann Adams', 120, 'Bob Brown', 100),
    game(2021, 2, 'Ann Adams', 90, 'Cal Clark', 110),
    game(2021, 3, 'Bob Brown', 100, 'Cal Clark', 100), // a tie
    game(2021, 16, 'Ann Adams', 150, 'Cal Clark', 120, 'P'),
    game(2022, 1, 'Bob Brown', 80, 'Ann Adams', 130),
  ],
}

// ---------- the arithmetic ----------

test('a record reads the way it is written', () => {
  assert.equal(recordLabel({ wins: 3, losses: 7 }), '3-7')
  assert.equal(recordLabel({ wins: 3, losses: 7, ties: 1 }), '3-7-1')
  assert.equal(recordLabel(), '0-0')
})

test('a tie is worth half a win', () => {
  assert.equal(winPct({ wins: 1, losses: 1 }), 0.5)
  assert.equal(winPct({ wins: 0, losses: 1, ties: 1 }), 0.25)
  assert.equal(winPct(), 0, 'nobody who has never played is undefeated')
})

// ---------- the all-time table ----------

const table = allTimeTable(DATA)
const byName = Object.fromEntries(table.map((row) => [row.name, row]))

test('everyone who has played is in the table', () => {
  assert.deepEqual(new Set(table.map((row) => row.name)), new Set(['Ann Adams', 'Bob Brown', 'Cal Clark']))
})

test('a retired owner keeps their record', () => {
  assert.equal(byName['Cal Clark'].status, 'Retired')
  assert.equal(byName['Cal Clark'].recordLabel, '1-0-1')
})

test('retired owners can be left out, and the ranks close up behind them', () => {
  const current = allTimeTable(DATA, { retired: false })

  assert.deepEqual(current.map((row) => row.name), ['Ann Adams', 'Bob Brown'])
  // Cal ranked first of the three; dropping him must renumber rather than
  // leave the table starting at 2.
  assert.deepEqual(current.map((row) => row.rank), [1, 2])
})

test('leaving retired owners out changes nobody’s record', () => {
  const current = allTimeTable(DATA, { retired: false })
  const ann = current.find((row) => row.name === 'Ann Adams')

  // Her two games against Cal still count — he played them.
  assert.equal(ann.recordLabel, byName['Ann Adams'].recordLabel)
  assert.equal(ann.games, 4)
})

test('the playoffs are counted apart from the regular season', () => {
  // Ann: regular 2-1, plus one playoff win.
  assert.equal(byName['Ann Adams'].recordLabel, '2-1')
  assert.equal(byName['Ann Adams'].playoffLabel, '1-0')
})

test('points count every game, playoffs included', () => {
  // Ann scored 120 + 90 + 130 + 150.
  assert.equal(byName['Ann Adams'].pointsFor, 490)
  assert.equal(byName['Ann Adams'].games, 4)
  assert.equal(byName['Ann Adams'].pointsForPerGame, 122.5)
})

test('points against are the other side of the same games', () => {
  assert.equal(byName['Ann Adams'].pointsAgainst, 100 + 110 + 80 + 120)
})

test('titles and sackos are tallied', () => {
  assert.equal(byName['Ann Adams'].titles, 2)
  assert.equal(byName['Ann Adams'].sackos, 0)
  assert.equal(byName['Cal Clark'].sackos, 1)
  assert.equal(byName['Bob Brown'].sackos, 1)
})

test('seasons played are the ones they actually appear in', () => {
  assert.deepEqual(byName['Cal Clark'].seasons, [2021])
  assert.equal(byName['Cal Clark'].seasonCount, 1)
  assert.deepEqual(byName['Ann Adams'].seasons, [2021, 2022])
})

test('the table is ordered by win rate, not by wins', () => {
  // Cal's 1-0-1 is .750 and leads Ann's 2-1 (.667) despite half the wins —
  // which is the point of ranking a table where owners have played different
  // numbers of seasons.
  assert.deepEqual(table.map((row) => row.name), ['Cal Clark', 'Ann Adams', 'Bob Brown'])
  assert.deepEqual(table.map((row) => row.rank), [1, 2, 3])
})

// ---------- head to head ----------

const h2h = headToHead(DATA)

test('a head-to-head is the mirror of its opposite', () => {
  assert.deepEqual(h2h.get('Ann Adams', 'Bob Brown'), { wins: 2, losses: 0, ties: 0 })
  assert.deepEqual(h2h.get('Bob Brown', 'Ann Adams'), { wins: 0, losses: 2, ties: 0 })
})

test('playoff meetings count in the head-to-head', () => {
  assert.deepEqual(h2h.get('Ann Adams', 'Cal Clark'), { wins: 1, losses: 1, ties: 0 })
})

test('a tie shows on both sides', () => {
  assert.deepEqual(h2h.get('Bob Brown', 'Cal Clark'), { wins: 0, losses: 0, ties: 1 })
})

test('nobody plays themselves, and an unmet pair is 0-0', () => {
  assert.equal(h2h.get('Ann Adams', 'Ann Adams'), null)
  assert.deepEqual(h2h.get('Ann Adams', 'Nobody At All'), { wins: 0, losses: 0, ties: 0 })
})

// ---------- short labels ----------

test('short labels are initials where initials will do', () => {
  const labels = shortLabels(['Connor Bowser', 'Tyler Gilbert'])
  assert.equal(labels.get('Connor Bowser'), 'CB')
  assert.equal(labels.get('Tyler Gilbert'), 'TG')
})

test('a clash widens both names, not just the second', () => {
  // Danny Stiles and Drew Sherrow are both DS, which is how a head-to-head
  // grid ends up with two identical columns.
  const labels = shortLabels(['Danny Stiles', 'Drew Sherrow'])
  assert.equal(labels.get('Danny Stiles'), 'DaS')
  assert.equal(labels.get('Drew Sherrow'), 'DrS')
})

test('a clash only widens the names that clash', () => {
  const labels = shortLabels(['Danny Stiles', 'Drew Sherrow', 'Connor Bowser'])
  assert.equal(labels.get('Connor Bowser'), 'CB')
})

test('every label in the real league is unique', () => {
  const names = allTimeTable(ARCHIVE).map((row) => row.name)
  const labels = [...shortLabels(names).values()]
  assert.equal(new Set(labels).size, names.length, labels.join(' '))
})

test('no names, no labels', () => {
  assert.equal(shortLabels([]).size, 0)
  assert.equal(shortLabels().size, 0)
})

test('a one-word name still gets a label', () => {
  assert.equal(shortLabels(['Prince']).get('Prince'), 'P')
})

// ---------- seasons ----------

test('seasons come back newest first, with their title and their dues', () => {
  const seasons = seasonSummaries(DATA)
  assert.deepEqual(seasons.map((entry) => entry.season), [2022, 2021])

  const [, first] = seasons
  assert.equal(first.champion, 'Ann Adams')
  assert.equal(first.sacko, 'Cal Clark')
  assert.equal(first.buyIn, 20)
  assert.equal(first.games, 4)
  assert.equal(first.divisions.length, 1)
})

test('the game log groups by season, newest first, weeks in order', () => {
  const log = gamesBySeason(DATA)
  assert.deepEqual(log.map((entry) => entry.season), [2022, 2021])
  assert.deepEqual(log[1].games.map((entry) => entry.week), [1, 2, 3, 16])
})

test('an empty history does not throw', () => {
  assert.deepEqual(allTimeTable(), [])
  assert.deepEqual(seasonSummaries(), [])
  assert.deepEqual(gamesBySeason(), [])
  assert.deepEqual(headToHead().get('a', 'b'), { wins: 0, losses: 0, ties: 0 })
})

// ---------- against the real workbook ----------

test('the extracted history is the shape the page expects', () => {
  assert.deepEqual(ARCHIVE.seasons, [2021, 2022, 2023, 2024, 2025])
  assert.equal(ARCHIVE.games.length, 375)
  assert.ok(ARCHIVE.games.every((entry) => entry.a && entry.b && entry.type))
  assert.ok(
    ARCHIVE.games.every((entry) => typeof entry.ap === 'number' && typeof entry.bp === 'number'),
    'every game has both scores',
  )
})

test('the placement rows were kept out of the games', () => {
  // The workbook records final standings as 1-0 "games"; counting them would
  // hand everybody a fistful of one-point wins.
  assert.ok(!ARCHIVE.games.some((entry) => entry.ap === 1 && entry.bp === 0))
  assert.equal(ARCHIVE.placements.length, 20)
})

test('every game is a regular season or playoff game', () => {
  assert.deepEqual(new Set(ARCHIVE.games.map((entry) => entry.type)), new Set(['R', 'P']))
})

test('the real table agrees with the league it came from', () => {
  const real = allTimeTable(ARCHIVE)
  const brett = real.find((row) => row.name === 'Brett Gilbert')

  assert.equal(real.length, 13, 'thirteen owners have played')
  assert.equal(brett.seasonCount, 5)
  assert.equal(brett.titles, 1, '2025')
  assert.equal(brett.sackos, 2, '2022 and 2023')

  // Every game is counted twice, once for each side.
  const games = real.reduce((total, row) => total + row.games, 0)
  assert.equal(games, ARCHIVE.games.length * 2)
})

// ---------- the live merge ----------

const team = (id, manager, extra = {}) => ({ id, managerNames: manager, ...extra })
const matchup = (week, home, homePts, away, awayPts, tier = 'NONE') => ({
  week,
  playoffTier: tier,
  isBye: false,
  isComplete: true,
  // ESPN stamps this on every played game, so the fixture does too.
  winner: homePts >= awayPts ? 'HOME' : 'AWAY',
  home: { teamId: home, points: homePts },
  away: { teamId: away, points: awayPts },
})

const LIVE_SEASON = {
  season: 2026,
  teams: [team(1, 'Ann Adams', { finalRank: 1 }), team(2, 'Bob Brown')],
  matchups: [
    matchup(1, 1, 120, 2, 100),
    matchup(2, 2, 90, 1, 95),
    matchup(16, 1, 150, 2, 140, 'WINNERS_BRACKET'),
    matchup(16, 2, 80, 1, 70, 'WINNERS_CONSOLATION_LADDER'),
    { ...matchup(3, 1, 0, 2, 0), isComplete: false },
    { week: 4, playoffTier: 'NONE', isBye: true, isComplete: true, home: { teamId: 1, points: 100 } },
  ],
}

test('a season becomes games, played ones only', () => {
  const games = seasonGames(LIVE_SEASON)
  assert.equal(games.length, 3, 'the unplayed game and the bye are not results')
  assert.deepEqual(games.map((entry) => entry.week), [1, 2, 16])
})

test('consolation games are left out, the way the workbook has them', () => {
  const games = seasonGames(LIVE_SEASON)
  assert.ok(!games.some((entry) => entry.week === 16 && entry.ap === 80))
})

test('a bracket game is marked as one', () => {
  const games = seasonGames(LIVE_SEASON)
  assert.equal(games.find((entry) => entry.week === 16).type, 'P')
  assert.equal(games.find((entry) => entry.week === 1).type, 'R')
})

test('the live season is added to the archive rather than replacing it', () => {
  const merged = mergeHistory({ archive: DATA, live: [LIVE_SEASON] })

  assert.deepEqual(merged.seasons, [2021, 2022, 2026])
  assert.equal(merged.games.length, DATA.games.length + 3)
})

test('ESPN wins for a season it still serves', () => {
  // The archive has 2021 with Ann beating Bob 120-100; ESPN says 130-100.
  const live = [{
    season: 2021,
    teams: [team(1, 'Ann Adams'), team(2, 'Bob Brown')],
    matchups: [matchup(1, 1, 130, 2, 100)],
  }]
  const merged = mergeHistory({ archive: DATA, live })
  const games = merged.games.filter((entry) => entry.season === 2021)

  assert.equal(games.length, 1, 'the whole season comes from ESPN, not just the game it has')
  assert.equal(games[0].ap, 130)
})

test('a season ESPN has dropped is still the archive’s', () => {
  const merged = mergeHistory({ archive: DATA, live: [LIVE_SEASON] })

  assert.equal(merged.games.filter((entry) => entry.season === 2021).length, 4)
  assert.deepEqual(merged.archivedSeasons, [2021, 2022])
})

test('a season with nothing played yet does not blank the archive', () => {
  const preseason = { season: 2026, teams: [team(1, 'Ann Adams')], matchups: [] }
  const merged = mergeHistory({ archive: DATA, live: [preseason] })

  assert.deepEqual(merged.seasons, [2021, 2022])
  assert.equal(merged.games.length, DATA.games.length)
})

test('an owner ESPN has forgotten gets their name back from the archive', () => {
  // ESPN reports a team it no longer has an owner for; the workbook remembers.
  const live = [{
    season: 2021,
    teams: [team(1, 'Ann Adams'), team(2, 'Unclaimed')],
    matchups: [matchup(1, 1, 120, 2, 100)],
  }]
  const merged = mergeHistory({ archive: DATA, live })

  assert.equal(merged.games[0].b, 'Bob Brown')
})

test('champions come from ESPN, sackos from the workbook', () => {
  const merged = mergeHistory({ archive: DATA, live: [LIVE_SEASON] })
  const title = merged.titles.find((entry) => entry.season === 2026)

  assert.equal(title.champion, 'Ann Adams', 'ESPN stamps the winner')
  assert.equal(title.sacko, null, 'nothing in the payload picks the league’s sacko')
  // And the archive's own titles survive untouched.
  assert.equal(merged.titles.find((entry) => entry.season === 2021).sacko, 'Cal Clark')
})

test('who is active is read from the newest season, not a status column', () => {
  const merged = mergeHistory({ archive: DATA, live: [LIVE_SEASON] })
  const status = Object.fromEntries(merged.owners.map((entry) => [entry.name, entry.status]))

  // Cal is in the archive as retired and is not in 2026 — still retired.
  assert.equal(status['Cal Clark'], 'Retired')
  assert.equal(status['Ann Adams'], 'Active')
  assert.equal(status['Bob Brown'], 'Active')
})

test('an owner who stops playing retires on their own', () => {
  const withoutBob = {
    ...LIVE_SEASON,
    teams: [team(1, 'Ann Adams')],
    matchups: [matchup(1, 1, 120, 1, 100)],
  }
  const merged = mergeHistory({ archive: DATA, live: [withoutBob] })
  const status = Object.fromEntries(merged.owners.map((entry) => [entry.name, entry.status]))

  assert.equal(status['Bob Brown'], 'Retired', 'no team this season, no longer in the league')
})

test('with no live season at all, the archive stands on its own', () => {
  const merged = mergeHistory({ archive: DATA, live: [] })

  assert.deepEqual(merged.seasons, [2021, 2022])
  assert.equal(merged.games.length, DATA.games.length)
  // Falls back to the workbook's own column when there is no roster to read.
  const status = Object.fromEntries(merged.owners.map((entry) => [entry.name, entry.status]))
  assert.equal(status['Cal Clark'], 'Retired')
  assert.equal(status['Ann Adams'], 'Active')
})

test('an empty merge does not throw', () => {
  const merged = mergeHistory()
  assert.deepEqual(merged.games, [])
  assert.deepEqual(merged.seasons, [])
})

// ---------- best player weeks ----------

const week = (season, wk, player, score, extra = {}) => ({ season, week: wk, player, score, ...extra })

test('a week of ESPN players becomes history entries', () => {
  const entries = weekEntries({
    season: 2026,
    week: 3,
    players: [
      { teamId: 1, player: 'Ja’Marr Chase', positionId: 3, score: 41.2 },
      { teamId: 2, player: 'Josh Allen', positionId: 1, score: 33.8 },
    ],
    owners: new Map([[1, 'Ann Adams'], [2, 'Bob Brown']]),
  })

  assert.deepEqual(entries[0], {
    season: 2026, week: 3, player: 'Ja’Marr Chase', score: 41.2, position: 'WR', manager: 'Ann Adams',
  })
  assert.equal(entries[1].position, 'QB')
})

test('an unknown position is left blank rather than shown as a number', () => {
  assert.equal(positionName(3), 'WR')
  assert.equal(positionName(99), '')
  assert.equal(positionName(), '')
})

test('the best weeks are the biggest, whatever the source', () => {
  const best = bestWeeks({
    archive: [week(2021, 1, 'Old Timer', 40)],
    live: [week(2026, 2, 'New Kid', 55), week(2026, 3, 'Middling', 45)],
  })
  assert.deepEqual(best.map((entry) => entry.player), ['New Kid', 'Middling', 'Old Timer'])
})

test('the same performance from both sources is counted once, ESPN’s version', () => {
  const best = bestWeeks({
    archive: [week(2024, 5, 'Ja’Marr Chase', 55.1, { manager: 'Old Note' })],
    live: [week(2024, 5, 'Ja’Marr Chase', 55.4, { manager: 'Daniel Dixon' })],
  })

  assert.equal(best.length, 1)
  assert.equal(best[0].score, 55.4, 'ESPN is the authority on a score')
  assert.equal(best[0].manager, 'Daniel Dixon')
})

test('the list is capped', () => {
  const many = Array.from({ length: 60 }, (_, i) => week(2026, i + 1, `Player ${i}`, i))
  assert.equal(bestWeeks({ live: many }).length, 40)
  assert.equal(bestWeeks({ live: many, limit: 5 }).length, 5)
})

test('a week with no score at all is not a best week', () => {
  const best = bestWeeks({ live: [week(2026, 1, 'Ghost', null), week(2026, 2, 'Real', 10)] })
  assert.deepEqual(best.map((entry) => entry.player), ['Real'])
})

test('only the seasons the archive misses are fetched, newest first', () => {
  const wanted = seasonsToFetch({
    seasons: [2021, 2022, 2023, 2024, 2025, 2026],
    archive: [week(2021, 1, 'A', 10), week(2023, 1, 'B', 10)],
  })
  assert.deepEqual(wanted, [2026, 2025, 2024, 2022])
})

test('with nothing archived, every season is fetched', () => {
  assert.deepEqual(seasonsToFetch({ seasons: [2025, 2026] }), [2026, 2025])
  assert.deepEqual(seasonsToFetch(), [])
})

test('only weeks that were played are worth asking about', () => {
  const games = [
    { season: 2026, week: 1 }, { season: 2026, week: 1 }, { season: 2026, week: 2 },
    { season: 2025, week: 9 },
  ]
  assert.deepEqual(playedWeeks(games, 2026), [1, 2], 'deduplicated, and week 3 has not happened')
  assert.deepEqual(playedWeeks(games, 2024), [])
})

// ---------- sorting the table ----------

const SORTABLE = allTimeTable({
  owners: [],
  titles: [{ season: 2021, champion: 'Bob Brown', sacko: 'Ann Adams' }],
  games: [
    game(2021, 1, 'Ann Adams', 200, 'Bob Brown', 100),
    game(2021, 2, 'Ann Adams', 200, 'Cal Clark', 100),
    game(2021, 3, 'Bob Brown', 150, 'Cal Clark', 100),
    game(2021, 16, 'Bob Brown', 150, 'Cal Clark', 100, 'P'),
  ],
})

const order = (key, direction) => sortRows(SORTABLE, key, direction).map((row) => row.name)

test('a column sorts descending and ascending', () => {
  // Ann 2-0, Bob 1-1, Cal 0-2.
  assert.deepEqual(order('record', 'desc'), ['Ann Adams', 'Bob Brown', 'Cal Clark'])
  assert.deepEqual(order('record', 'asc'), ['Cal Clark', 'Bob Brown', 'Ann Adams'])
})

test('points sort on the average, not the total', () => {
  assert.deepEqual(order('pointsForPerGame', 'desc'), ['Ann Adams', 'Bob Brown', 'Cal Clark'])
  assert.deepEqual(order('pointsAgainstPerGame', 'asc')[0], 'Ann Adams')
})

test('a record sorts by wins rather than by its own text', () => {
  // "2-0" against "1-1" alphabetically would put Bob first.
  assert.equal(order('record', 'desc')[0], 'Ann Adams')
})

test('playoffs sort on games won there, not on the regular season', () => {
  assert.equal(order('playoffs', 'desc')[0], 'Bob Brown')
})

test('titles and sackos sort', () => {
  assert.equal(order('titles', 'desc')[0], 'Bob Brown')
  assert.equal(order('sackos', 'desc')[0], 'Ann Adams')
})

test('a column where everyone ties still comes back in a settled order', () => {
  // Nobody has two titles; the rest of the table must not shuffle.
  const first = order('titles', 'desc')
  assert.deepEqual(order('titles', 'desc'), first)
  // Behind the tie it falls back to win rate, so Ann leads Cal.
  assert.deepEqual(first.slice(1), ['Ann Adams', 'Cal Clark'])
})

test('sorting leaves the table it was given alone', () => {
  const before = SORTABLE.map((row) => row.name)
  sortRows(SORTABLE, 'sackos', 'asc')
  assert.deepEqual(SORTABLE.map((row) => row.name), before)
})

test('an unknown column falls back to win rate rather than throwing', () => {
  assert.deepEqual(order('nonsense', 'desc'), order('winPct', 'desc'))
  assert.deepEqual(sortRows(), [])
})

// ---------- one manager's career ----------

const CAREER = {
  games: [
    // 2021: Ann 2-0 in the regular season, then wins a bracket game.
    game(2021, 1, 'Ann Adams', 120, 'Bob Brown', 100),
    game(2021, 1, 'Cal Clark', 90, 'Dee Day', 80),
    game(2021, 2, 'Ann Adams', 130, 'Cal Clark', 140),
    game(2021, 2, 'Bob Brown', 70, 'Dee Day', 110),
    game(2021, 16, 'Ann Adams', 150, 'Cal Clark', 120, 'P'),
    // 2022: Ann 0-1, no bracket.
    game(2022, 1, 'Ann Adams', 60, 'Bob Brown', 95),
    game(2022, 1, 'Cal Clark', 100, 'Dee Day', 105),
  ],
  finishes: [
    { season: 2021, owner: 'Ann Adams', rank: 1 },
    { season: 2022, owner: 'Ann Adams', rank: 8 },
  ],
  titles: [{ season: 2021, champion: 'Ann Adams', sacko: 'Bob Brown' }],
  owners: [{ name: 'Ann Adams', status: 'Active' }],
}

const ANN = managerProfile(CAREER, 'Ann Adams')

test('a profile carries the season record, apart from the bracket', () => {
  assert.equal(ANN.recordLabel, '1-2', 'the playoff win is not a regular season win')
  assert.equal(ANN.playoffLabel, '1-0')
  assert.equal(ANN.playoffAppearances, 1)
})

test('a season row knows whether it reached the playoffs', () => {
  assert.deepEqual(
    ANN.seasons.map((season) => [season.season, season.recordLabel, season.madePlayoffs]),
    [[2021, '1-1', true], [2022, '0-1', false]],
  )
})

test('season averages are of the games that count', () => {
  const [first] = ANN.seasons
  // She scored 120 and 130 in the regular season and faced 100 and 140. The
  // 150 she put up in the bracket is not part of the average.
  assert.equal(first.pointsForPerGame, 125)
  assert.equal(first.pointsAgainstPerGame, 120)
})

test('finishes come from the final rankings, in season order', () => {
  assert.deepEqual(ANN.finishes, [{ season: 2021, rank: 1 }, { season: 2022, rank: 8 }])
})

test('a top week is being highest in the league, not just winning', () => {
  const { top, bottom } = weekExtremes(CAREER.games, 'Ann Adams')

  // 2021 week 1: her 120 is the best of the four scores — one top week.
  // 2021 week 2: she scored 130 and won nothing, Cal's 140 took it.
  // 2022 week 1: her 60 is the worst of the four — one bottom week, in a week
  // she also lost, which is the point of counting the league and not the game.
  assert.equal(top, 1)
  assert.equal(bottom, 1)

  // Bob's 70 was the worst of 2021 week 2; his 95 in 2022 was not the worst.
  assert.equal(weekExtremes(CAREER.games, 'Bob Brown').bottom, 1)
  assert.equal(weekExtremes(CAREER.games, 'Bob Brown').top, 0)
})

test('a week too small to have a top and a bottom is not counted', () => {
  // The 2021 bracket week has one game in it: two scores, so its "winner of the
  // week" would just be the winner of the game.
  const onlyBracket = { ...CAREER, games: CAREER.games.filter((entry) => entry.type === 'P') }
  assert.deepEqual(weekExtremes(onlyBracket.games, 'Ann Adams'), { top: 0, bottom: 0 })
})

test('a manager who never played has no profile', () => {
  assert.equal(managerProfile(CAREER, 'Nobody At All'), null)
  assert.equal(managerProfile(CAREER, ''), null)
  assert.equal(managerProfile(), null)
})

test('two spellings of one manager are one manager', () => {
  // ESPN lowercases some names; the workbook does not. Left alone that is two
  // people, one of whom has never played.
  const merged = mergeHistory({
    archive: {
      games: [game(2021, 1, 'Travis Wolfe', 100, 'Ann Adams', 90)],
      titles: [{ season: 2021, champion: 'Ann Adams', sacko: 'Travis Wolfe' }],
      owners: [{ name: 'Travis Wolfe', status: 'Retired' }],
    },
    live: [{
      season: 2022,
      teams: [team(1, 'travis wolfe'), team(2, 'Ann Adams')],
      matchups: [matchup(1, 1, 110, 2, 95)],
    }],
  })

  const names = allTimeTable(merged).map((row) => row.name)
  assert.equal(names.filter((name) => name.toLowerCase() === 'travis wolfe').length, 1)
  assert.ok(names.includes('Travis Wolfe'), 'the better-cased spelling is the one kept')

  const travis = allTimeTable(merged).find((row) => row.name === 'Travis Wolfe')
  assert.equal(travis.games, 2, 'both seasons are his')
  assert.equal(travis.sackos, 1)
})

test('the rank is against the managers still in the league', () => {
  const withRetired = {
    ...CAREER,
    owners: [
      { name: 'Ann Adams', status: 'Active' },
      { name: 'Bob Brown', status: 'Active' },
      { name: 'Cal Clark', status: 'Retired' },
      { name: 'Dee Day', status: 'Active' },
    ],
  }

  const ann = managerProfile(withRetired, 'Ann Adams')
  // Cal is out of the pool, so it is a field of three rather than four.
  assert.equal(ann.of, 3)
  assert.ok(ann.rank >= 1 && ann.rank <= 3)
})

test('a retired manager keeps their profile but has no rank', () => {
  const withRetired = {
    ...CAREER,
    owners: [{ name: 'Cal Clark', status: 'Retired' }, { name: 'Ann Adams', status: 'Active' }],
  }

  const cal = managerProfile(withRetired, 'Cal Clark')
  assert.ok(cal, 'the file is still there')
  // Beat Dee, beat Ann, lost to Dee the year after.
  assert.equal(cal.recordLabel, '2-1')
  assert.equal(cal.rank, null, 'not ranked against a league he is not in')
})

// ---------- awards ----------

const HAND_AWARDS = [
  {
    id: 'stan-lee',
    name: 'Stan Lee Award',
    winners: [
      { manager: 'Ann Adams', season: 2023 },
      { manager: 'Ann Adams', season: 2021 },
      { manager: 'Bob Brown' },
    ],
  },
]

test('an award only appears for the managers who won it', () => {
  assert.equal(awardsFor('Ann Adams', HAND_AWARDS).length, 1)
  assert.equal(awardsFor('Bob Brown', HAND_AWARDS).length, 1)
  assert.deepEqual(awardsFor('Cal Clark', HAND_AWARDS), [], 'no empty trophy cabinet')
  assert.deepEqual(awardsFor(null, HAND_AWARDS), [])
})

test('winning twice is one award with both years, newest first', () => {
  const [award] = awardsFor('Ann Adams', HAND_AWARDS)
  assert.equal(award.count, 2)
  assert.deepEqual(award.seasons, [2023, 2021])
})

test('an award with no year recorded still counts', () => {
  const [award] = awardsFor('Bob Brown', HAND_AWARDS)
  assert.equal(award.count, 1)
  assert.deepEqual(award.seasons, [], 'nothing invented for a year nobody wrote down')
})

test('the name is matched however it is cased', () => {
  assert.equal(awardsFor('ann adams', HAND_AWARDS).length, 1)
})

test('the real roll is the three managers it says it is', () => {
  const winners = new Set(STAN_LEE_AWARD.map((entry) => entry.manager))
  assert.deepEqual(winners, new Set(['Andrew Casazza', 'Brett Gilbert', 'Tyler Gilbert']))

  // Every name has to match the league's spelling or it will never show.
  const league = new Set(allTimeTable(ARCHIVE).map((row) => row.name))
  for (const name of winners) {
    assert.ok(league.has(name), `${name} is not a manager the league has heard of`)
  }
})

// ---------- where everyone finished ----------

/** The 2021 bracket, which is the case the league's rule was explained with. */
const SEEDED = [
  team(1, 'Brett', { playoffSeed: 1 }),
  team(2, 'Tyler', { playoffSeed: 2 }),
  team(3, 'Connor', { playoffSeed: 3 }),
  team(4, 'Jake', { playoffSeed: 4 }),
  team(5, 'Jeremy', { playoffSeed: 5 }),
  team(6, 'Drew', { playoffSeed: 6 }),
  team(7, 'Josh', { playoffSeed: 7 }),
  team(8, 'Andrew', { playoffSeed: 8 }),
  team(9, 'Daniel', { playoffSeed: 9 }),
  team(10, 'Travis', { playoffSeed: 10 }),
]

const BRACKET = [
  // Round one: 4 beats 5, 3 beats 6. Seeds 1 and 2 have byes.
  matchup(15, 4, 178.9, 5, 107.36, 'WINNERS_BRACKET'),
  matchup(15, 3, 110.44, 6, 93.2, 'WINNERS_BRACKET'),
  // Semi-finals: 4 knocks out 1, 3 knocks out 2.
  matchup(16, 1, 91.76, 4, 111.92, 'WINNERS_BRACKET'),
  matchup(16, 2, 111.68, 3, 131.44, 'WINNERS_BRACKET'),
  // Final: 3 beats 4.
  matchup(17, 3, 157.68, 4, 134.86, 'WINNERS_BRACKET'),
  // The consolation bracket, which changes nothing.
  matchup(15, 7, 142.08, 8, 103.18, 'LOSERS_CONSOLATION_LADDER'),
  matchup(16, 10, 173.3, 9, 113.1, 'LOSERS_CONSOLATION_LADDER'),
  matchup(17, 10, 126.84, 7, 100.0, 'LOSERS_CONSOLATION_LADDER'),
]

const PLACINGS = seasonFinishes({ season: 2021, teams: SEEDED, matchups: BRACKET })
const placed = Object.fromEntries(PLACINGS.map((entry) => [entry.owner, entry.rank]))

test('the bracket settles the top of the table', () => {
  assert.equal(placed.Connor, 1, 'won it')
  assert.equal(placed.Jake, 2, 'lost the final')
})

test('teams knocked out together are split by seed, not by score', () => {
  // Both went out in the semi-finals. ESPN puts Tyler third on points; the
  // league puts Brett there because he went in as the higher seed.
  assert.equal(placed.Brett, 3)
  assert.equal(placed.Tyler, 4)
})

test('going out later beats going out early', () => {
  assert.equal(placed.Jeremy, 5)
  assert.equal(placed.Drew, 6)
})

test('the consolation bracket moves nobody', () => {
  // Travis won both his consolation games and is still last; Josh lost his and
  // is still seventh. They finish where the regular season left them.
  assert.equal(placed.Josh, 7)
  assert.equal(placed.Andrew, 8)
  assert.equal(placed.Daniel, 9)
  assert.equal(placed.Travis, 10)
})

test('the playoff field is read off the bracket, not the seed numbers', () => {
  // 2025 really did happen this way: the 7 seed was in the bracket and won it,
  // while the 6 seed never played a bracket game at all.
  const odd = seasonFinishes({
    season: 2025,
    teams: [
      team(1, 'Connor', { playoffSeed: 1 }),
      team(2, 'Jeremy', { playoffSeed: 2 }),
      team(6, 'Andrew', { playoffSeed: 6 }),
      team(7, 'Brett', { playoffSeed: 7 }),
    ],
    matchups: [
      matchup(16, 2, 120.72, 7, 167.3, 'WINNERS_BRACKET'),
      matchup(17, 1, 109.56, 7, 125.44, 'WINNERS_BRACKET'),
    ],
  })
  const rank = Object.fromEntries(odd.map((entry) => [entry.owner, entry.rank]))

  assert.equal(rank.Brett, 1, 'the 7 seed won it')
  assert.equal(rank.Connor, 2, 'lost the final')
  assert.equal(rank.Jeremy, 3, 'out in the round before')
  assert.equal(rank.Andrew, 4, 'the 6 seed watched, so he is behind everyone who played')
})

test('a season with no bracket has no finishes', () => {
  assert.deepEqual(seasonFinishes({ season: 2026, teams: SEEDED, matchups: [] }), [])
  assert.deepEqual(
    seasonFinishes({
      season: 2026,
      teams: SEEDED,
      matchups: [{ ...matchup(15, 1, 0, 2, 0, 'WINNERS_BRACKET'), isComplete: false }],
    }),
    [],
  )
  assert.deepEqual(seasonFinishes(), [])
})

test('every place is given out exactly once', () => {
  assert.deepEqual(PLACINGS.map((entry) => entry.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})
