#!/usr/bin/env node
/**
 * Trade reconstruction and scoring, from hand-made payloads.
 *
 *   npm test
 *
 * The interesting cases are all about what ESPN *doesn't* say: a side paid in
 * FAAB leaves no roster entry at all, and a player traded and later dropped
 * leaves none either. Telling those two apart from ordinary waiver churn is
 * the whole job, so most of what follows is about the difference.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  approximateWeek,
  buildSeasonTrades,
  buildTradeStats,
  buildTimeline,
  isStarterSlot,
  sortTrades,
  tradeAcquisitions,
  tradeHighlights,
} from '../src/lib/trades/build.js'

const TEAMS = [
  { id: 1, manager: 'Ann Adams', name: 'Team One' },
  { id: 2, manager: 'Bob Brown', name: 'Team Two' },
  { id: 3, manager: 'Cal Clark', name: 'Team Three' },
]

const WR = 4 // any starting slot
const BENCH = 20

/** A weekly roster row. */
function on(playerId, teamId, { slot = WR, score = 0, player } = {}) {
  return { playerId, teamId, slot, score, player: player ?? `Player ${playerId}` }
}

/** Weeks 1..n, each taking a list of rows. */
function weeksOf(...rows) {
  return rows.map((entries, index) => ({ week: index + 1, entries }))
}

test('a starting slot is anything that is not the bench or IR', () => {
  assert.equal(isStarterSlot(WR), true)
  assert.equal(isStarterSlot(0), true, 'QB is slot 0, which is falsy but starting')
  assert.equal(isStarterSlot(BENCH), false)
  assert.equal(isStarterSlot(21), false)
  assert.equal(isStarterSlot(null), false)
})

test('acquisitions are read off the roster, trades only', () => {
  const raw = {
    teams: [
      {
        id: 1,
        roster: {
          entries: [
            { playerId: 10, acquisitionType: 'TRADE', acquisitionDate: 500, playerPoolEntry: { player: { fullName: 'Traded Guy' } } },
            { playerId: 11, acquisitionType: 'ADD', acquisitionDate: 501 },
            { playerId: 12, acquisitionType: 'DRAFT', acquisitionDate: 100 },
            { playerId: 13, acquisitionType: 'TRADE', acquisitionDate: null },
          ],
        },
      },
    ],
  }
  const found = tradeAcquisitions(raw)
  assert.equal(found.length, 1, 'adds, drafts and undated rows are not trades')
  assert.deepEqual(found[0], { timestamp: 500, teamId: 1, playerId: 10, player: 'Traded Guy' })
})

test('an empty payload yields nothing rather than throwing', () => {
  assert.deepEqual(tradeAcquisitions({}), [])
  assert.deepEqual(buildSeasonTrades({ season: 2025 }), [])
})

test('the timeline answers who held a player in a week', () => {
  const timeline = buildTimeline(weeksOf([on(10, 1)], [on(10, 2)]))
  assert.deepEqual(timeline.weeks, [1, 2])
  assert.equal(timeline.teamAt(1, 10), 1)
  assert.equal(timeline.teamAt(2, 10), 2)
  assert.equal(timeline.teamAt(2, 99), null, 'an unknown player is absent, not a crash')
})

// ---------- the ordinary case ----------

const SWAP = buildSeasonTrades({
  season: 2025,
  teams: TEAMS,
  // Both halves share the millisecond, which is what identifies the trade.
  acquisitions: [
    { timestamp: 1000, teamId: 1, playerId: 20, player: 'Incoming Star' },
    { timestamp: 1000, teamId: 2, playerId: 21, player: 'Outgoing Dud' },
  ],
  weeks: weeksOf(
    [on(20, 2), on(21, 1)],
    [on(20, 1, { score: 30 }), on(21, 2, { score: 5 })],
    [on(20, 1, { score: 20 }), on(21, 2, { score: 5 })],
  ),
})

test('a two-sided trade is scored from the trade week onward', () => {
  assert.equal(SWAP.length, 1)
  const [trade] = SWAP
  assert.equal(trade.week, 2, 'the week the players turned up on their new teams')
  assert.equal(trade.scoreable, true)
  assert.equal(trade.isFaabDeal, false)
  assert.equal(trade.winner, 1)
  assert.equal(trade.margin, 40, '50 against 10')
})

test('the winning side is listed first', () => {
  assert.deepEqual(SWAP[0].sides.map((side) => side.manager), ['Ann Adams', 'Bob Brown'])
})

test('points before the trade belong to nobody', () => {
  // Week 1 is the pre-trade week and its scores are ignored by construction:
  // the totals above are 30+20 and 5+5, with week 1 contributing nothing.
  assert.equal(SWAP[0].sides[0].points, 50)
  assert.equal(SWAP[0].sides[1].points, 10)
})

test('benched weeks score nothing but still count as held', () => {
  const [trade] = buildSeasonTrades({
    season: 2025,
    teams: TEAMS,
    acquisitions: [
      { timestamp: 1, teamId: 1, playerId: 30 },
      { timestamp: 1, teamId: 2, playerId: 31 },
    ],
    weeks: weeksOf(
      [on(30, 2), on(31, 1)],
      [on(30, 1, { slot: BENCH, score: 99 }), on(31, 2, { score: 4 })],
    ),
  })
  const benched = trade.sides.find((side) => side.teamId === 1)
  assert.equal(benched.points, 0, 'a 99-point week on the bench did nothing for the team')
  assert.equal(benched.players[0].started, 0)
  assert.equal(benched.players[0].heldWeeks, 1)
})

test('points stop when the player is traded on again', () => {
  const [trade] = buildSeasonTrades({
    season: 2025,
    teams: TEAMS,
    acquisitions: [
      { timestamp: 1, teamId: 1, playerId: 40 },
      { timestamp: 1, teamId: 2, playerId: 41 },
    ],
    weeks: weeksOf(
      [on(40, 2), on(41, 1)],
      [on(40, 1, { score: 10 }), on(41, 2, { score: 1 })],
      // Flipped on to a third team: those weeks are no longer team 1's.
      [on(40, 3, { score: 100 }), on(41, 2, { score: 1 })],
    ),
  })
  assert.equal(trade.sides.find((side) => side.teamId === 1).points, 10)
})

// ---------- the FAAB case ----------

const FAAB = buildSeasonTrades({
  season: 2025,
  teams: TEAMS,
  acquisitions: [{ timestamp: 2000, teamId: 1, playerId: 50, player: 'Bought Player' }],
  weeks: weeksOf(
    [on(50, 2)],
    [on(50, 1, { score: 40 })],
  ),
})

test('a side that received nobody is a FAAB deal, and is never scored', () => {
  assert.equal(FAAB.length, 1)
  const [trade] = FAAB
  assert.equal(trade.isFaabDeal, true)
  assert.equal(trade.scoreable, false)
  assert.equal(trade.winner, null, 'nobody wins a deal one side was paid for in FAAB')
  assert.equal(trade.margin, 0)
})

test('the FAAB side is still named, from who held the player before', () => {
  const [trade] = FAAB
  assert.equal(trade.sides.length, 2)
  const paid = trade.sides.find((side) => side.players.length === 0)
  assert.equal(paid.manager, 'Bob Brown')
})

// ---------- recovering a dropped player ----------

test('a player traded away and later dropped is recovered from the timeline', () => {
  const [trade] = buildSeasonTrades({
    season: 2025,
    teams: TEAMS,
    // ESPN only remembers team 1's half: team 2's return was dropped, so no
    // end-of-season roster carries it.
    acquisitions: [{ timestamp: 3000, teamId: 1, playerId: 60, player: 'Kept Player' }],
    weeks: weeksOf(
      [on(60, 2), on(61, 1, { player: 'Dropped Player' })],
      [on(60, 1, { score: 20 }), on(61, 2, { score: 3, player: 'Dropped Player' })],
      // Week 3: player 61 is gone from the league entirely.
      [on(60, 1, { score: 20 })],
    ),
  })

  assert.equal(trade.isFaabDeal, false, 'they did get a player, it just did not survive')
  assert.equal(trade.scoreable, true)
  const recovered = trade.sides.find((side) => side.teamId === 2)
  assert.deepEqual(recovered.players.map((p) => p.player), ['Dropped Player'])
  assert.equal(recovered.points, 3)
})

test('KNOWN LIMIT: a same-week drop and claim looks exactly like a return', () => {
  // The one thing a roster diff genuinely cannot resolve. Team 1 bought a
  // player for FAAB; in the same week team 1 dropped someone unrelated and team
  // 2 claimed him off waivers. Nothing in the readable data distinguishes that
  // from team 2 having been paid in players.
  //
  // Asserted rather than hidden so the day a better signal turns up — an
  // authenticated transaction log would do it — this test is what fails and
  // says so.
  const [trade] = buildSeasonTrades({
    season: 2025,
    teams: TEAMS,
    acquisitions: [{ timestamp: 4000, teamId: 1, playerId: 70, player: 'Bought Player' }],
    weeks: weeksOf(
      [on(70, 2), on(71, 1, { player: 'Waiver Churn' })],
      [on(70, 1, { score: 9 }), on(71, 2, { player: 'Waiver Churn' })],
    ),
  })

  const other = trade.sides.find((side) => side.teamId === 2)
  assert.deepEqual(other.players.map((p) => p.player), ['Waiver Churn'])
  assert.equal(trade.isFaabDeal, false, 'read as a player trade, though it was a FAAB deal')
})

test('a player with a trade record of his own is never claimed by another deal', () => {
  const trades = buildSeasonTrades({
    season: 2025,
    teams: TEAMS,
    acquisitions: [
      // Deal A, one-sided in the records.
      { timestamp: 5000, teamId: 1, playerId: 80, player: 'Deal A Player' },
      // Deal B, a fortnight later, moves 81 the other way. Deal A must not
      // absorb him even though he crosses between the same two teams.
      { timestamp: 6000, teamId: 2, playerId: 81, player: 'Deal B Player' },
      { timestamp: 6000, teamId: 1, playerId: 82, player: 'Deal B Return' },
    ],
    weeks: weeksOf(
      [on(80, 2), on(81, 1), on(82, 2)],
      [on(80, 1), on(81, 1), on(82, 2)],
      [on(80, 1), on(81, 2), on(82, 1)],
    ),
  })

  const dealA = trades.find((trade) => trade.id.endsWith('5000'))
  const paid = dealA.sides.find((side) => side.teamId === 2)
  assert.equal(paid.players.length, 0, 'deal A was a FAAB deal; deal B is separate')
  assert.equal(dealA.isFaabDeal, true)
})

test('two trades between the same teams in the same week stay separate', () => {
  const trades = buildSeasonTrades({
    season: 2025,
    teams: TEAMS,
    acquisitions: [
      { timestamp: 7000, teamId: 1, playerId: 90, player: 'First In' },
      { timestamp: 7000, teamId: 2, playerId: 91, player: 'First Out' },
      { timestamp: 7001, teamId: 1, playerId: 92, player: 'Second In' },
      { timestamp: 7001, teamId: 2, playerId: 93, player: 'Second Out' },
    ],
    weeks: weeksOf(
      [on(90, 2), on(91, 1), on(92, 2), on(93, 1)],
      [on(90, 1), on(91, 2), on(92, 1), on(93, 2)],
    ),
  })

  assert.equal(trades.length, 2, 'a millisecond apart is two deals, not one')
  for (const trade of trades) {
    for (const side of trade.sides) {
      assert.equal(side.players.length, 1, 'neither deal swallows the other’s players')
    }
  }
})

// ---------- weeks ----------

test('the trade week is read off the rosters, not the clock', () => {
  const starts = [
    { week: 1, startsAt: 0 },
    { week: 2, startsAt: 100 },
    { week: 3, startsAt: 200 },
  ]
  // A timestamp that looks like week 2 by kickoff, but the players do not
  // actually change hands until week 3.
  const [trade] = buildSeasonTrades({
    season: 2025,
    teams: TEAMS,
    weekStarts: starts,
    acquisitions: [
      { timestamp: 150, teamId: 1, playerId: 100 },
      { timestamp: 150, teamId: 2, playerId: 101 },
    ],
    weeks: weeksOf(
      [on(100, 2), on(101, 1)],
      [on(100, 2), on(101, 1)],
      [on(100, 1), on(101, 2)],
    ),
  })
  assert.equal(approximateWeek(150, starts), 2, 'the clock says week 2')
  assert.equal(trade.week, 3, 'the rosters say week 3, and they win')
})

// ---------- stats ----------

const STAT_TRADES = [
  ...SWAP,
  ...FAAB,
  ...buildSeasonTrades({
    season: 2024,
    teams: TEAMS,
    acquisitions: [
      { timestamp: 8000, teamId: 2, playerId: 110 },
      { timestamp: 8000, teamId: 1, playerId: 111 },
    ],
    weeks: weeksOf(
      [on(110, 1), on(111, 2)],
      [on(110, 2, { score: 50 }), on(111, 1, { score: 1 })],
    ),
  }),
]

test('the leaderboard counts FAAB deals as trades but not as results', () => {
  const stats = buildTradeStats(STAT_TRADES)
  const ann = stats.find((row) => row.manager === 'Ann Adams')

  assert.equal(ann.trades, 3, 'two swaps and the FAAB deal')
  assert.equal(ann.faabDeals, 1)
  assert.equal(ann.scored, 2, 'the FAAB deal is not a result either way')
  assert.equal(ann.record, '1-1')
  assert.equal(ann.winPct, 0.5)
})

test('only the manager who spent the FAAB is counted as having done so', () => {
  const stats = buildTradeStats(FAAB)
  // Ann took the player and paid for him; Bob took the money.
  const buyer = stats.find((row) => row.manager === 'Ann Adams')
  const seller = stats.find((row) => row.manager === 'Bob Brown')

  assert.equal(buyer.faabDeals, 1, 'bought a player for FAAB')
  assert.equal(seller.faabDeals, 0, 'sold one for FAAB, which is the opposite')
  // Both were still party to a trade, which the trades column keeps.
  assert.equal(buyer.trades, 1)
  assert.equal(seller.trades, 1)
})

test('net points are what came in against what went out', () => {
  const stats = buildTradeStats(STAT_TRADES)
  const ann = stats.find((row) => row.manager === 'Ann Adams')
  // Won 50 to 10, then lost 1 to 50.
  assert.equal(ann.pointsIn, 51)
  assert.equal(ann.pointsOut, 60)
  assert.equal(ann.net, -9)
})

test('a manager with no decided trades has no win rate to report', () => {
  const stats = buildTradeStats(FAAB)
  for (const row of stats) {
    assert.equal(row.winPct, null)
    assert.equal(row.scored, 0)
  }
})

test('highlights need a real sample before naming a best or worst', () => {
  const highlights = tradeHighlights(STAT_TRADES, buildTradeStats(STAT_TRADES))
  assert.equal(highlights.totalTrades, 3)
  assert.equal(highlights.faabDeals, 1)
  assert.equal(highlights.scoredTrades, 2)
  assert.equal(highlights.bestTrader, null, 'two decided trades is not a record')
  assert.equal(highlights.biggestFleecing.margin, 49)
})

test('trades sort newest first', () => {
  const sorted = sortTrades(STAT_TRADES)
  assert.deepEqual(sorted.map((trade) => trade.season), [2025, 2025, 2024])
})
