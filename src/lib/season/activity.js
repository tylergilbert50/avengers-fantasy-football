/**
 * One season's roster movement, read once.
 *
 * Trades and waivers are two readings of the same expensive evidence: a week of
 * rosters is close to a megabyte, seventeen of them make a season, and both
 * features need every one. Fetching them twice would double the cost of the
 * only part of this site that is genuinely expensive, so the read lives here
 * and each builder takes what it needs from the result.
 *
 * Used by the importer (once per completed season, written to disk) and by the
 * API routes (live, for the season being played). Both go through this function
 * so a season can't be shaped differently depending on how old it is.
 */

import { fetchLeagueRaw, fetchRosterWeek, fetchWeekStarts } from '../espn/fetchLeague.js'
import { normalizeLeague } from '../espn/normalize.js'
import { buildSeasonTrades, tradeAcquisitions } from '../trades/build.js'
import { buildSeasonPickups, seasonCounters } from '../waivers/build.js'

/**
 * Rosters, the members behind them, and the settings.
 *
 * `mTeam` is also what carries each team's `transactionCounter`, and
 * `mSettings` the FAAB budget those counts are measured against — so the waiver
 * totals ride along on a request the trades already needed.
 */
export const ACTIVITY_VIEWS = Object.freeze(['mRoster', 'mTeam', 'mSettings'])

/**
 * Owners ESPN has forgotten.
 *
 * When someone leaves mid-season ESPN drops the owner and reports the team as
 * "Unclaimed", which would put a nameless column in the trade history and, more
 * awkwardly, an anonymous row on the leaderboard. The same gap is documented in
 * src/lib/history/merge.js, where the workbook is what still remembers; keyed
 * here by the team name ESPN leaves behind.
 */
const FORGOTTEN_OWNERS = Object.freeze({
  2023: { 'CPU Team 1': 'Jake Meadors' },
})

/**
 * ESPN stores a manager's name exactly as they typed it into their profile, and
 * one of them never hit shift — which puts a lower-case row in the middle of a
 * table of proper names.
 *
 * A word is only capitalised when it is *entirely* lower case, so a name
 * carrying its own capitals keeps them: a McCoy stays a McCoy rather than being
 * flattened to Mccoy by a title-caser that assumes it knows better.
 */
export function tidyManagerName(name) {
  return String(name ?? '').replace(/[^\s-]+/g, (word) =>
    word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word,
  )
}

function nameManager({ season, team }) {
  const forgotten = FORGOTTEN_OWNERS[season]?.[team.name]
  if (forgotten && team.managerNames === 'Unclaimed') return forgotten
  return tidyManagerName(team.managerNames)
}

/** How many weekly roster reads run at once. Matches the player-week fetcher. */
const WEEK_CONCURRENCY = 6

/**
 * The weeks worth reading for a season.
 *
 * Everything played, capped at 17 because week 18 carries no fantasy scoring
 * period. Both readings want the whole season: a trade is judged from its week
 * onward, and a pickup is only visible as the difference between one week's
 * rosters and the last.
 */
export function weeksToRead({ weekStarts = [], limit = 17 }) {
  const last = Math.min(limit, weekStarts.length ? Math.max(...weekStarts.map((w) => w.week)) : limit)
  const weeks = []
  for (let week = 1; week <= last; week += 1) weeks.push(week)
  return weeks
}

/**
 * Everything one season's rosters can tell us.
 *
 * @param {object} config  { leagueId, espnS2, swid }
 * @param {number} season
 * @param {(key: string, produce: Function) => Promise<any>} [memoize]
 *   optional cache for the raw league blob; the weekly rosters are never cached
 *   whole, only the few fields kept from them.
 * @returns {Promise<{season, teams, trades, pickups, counters, weeksRead, dropCount}>}
 */
export async function loadSeasonActivity({ config, season, memoize = (_key, produce) => produce() }) {
  const raw = await memoize(`${config.leagueId}:${season}:${ACTIVITY_VIEWS.join(',')}`, () =>
    fetchLeagueRaw({
      leagueId: config.leagueId,
      season,
      views: ACTIVITY_VIEWS,
      espnS2: config.espnS2,
      swid: config.swid,
    }),
  )

  const league = normalizeLeague(raw)
  const teams = league.teams.map((team) => ({
    id: team.id,
    manager: nameManager({ season, team }),
    name: team.name,
  }))

  const acquisitions = tradeAcquisitions(raw)
  const counters = seasonCounters({ raw, season, teams })

  // ESPN's own tallies are the cheap half and are already in hand. If nothing
  // has happened yet there is nothing for the weekly rosters to show either,
  // which is the ordinary state of a season that has only just started.
  const anyActivity = acquisitions.length > 0 || counters.some((entry) => entry.adds > 0)
  if (!anyActivity) {
    return { season, teams, trades: [], pickups: [], counters, weeksRead: 0, dropCount: 0 }
  }

  const weekStarts = await fetchWeekStarts({
    season,
    espnS2: config.espnS2,
    swid: config.swid,
  })

  const wanted = weeksToRead({ weekStarts })
  const weeks = []

  for (let i = 0; i < wanted.length; i += WEEK_CONCURRENCY) {
    const batch = wanted.slice(i, i + WEEK_CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (week) => {
        try {
          const entries = await fetchRosterWeek({
            leagueId: config.leagueId,
            season,
            week,
            espnS2: config.espnS2,
            swid: config.swid,
          })
          return entries.length ? { week, entries } : null
        } catch {
          // A week ESPN won't serve costs that week's evidence, not the season.
          return null
        }
      }),
    )
    for (const result of results) if (result) weeks.push(result)
  }

  weeks.sort((a, b) => a.week - b.week)

  const trades = buildSeasonTrades({ season, acquisitions, weeks, teams, weekStarts })
  const { pickups, dropCount } = buildSeasonPickups({ season, weeks, teams })

  return { season, teams, trades, pickups, counters, weeksRead: weeks.length, dropCount }
}
