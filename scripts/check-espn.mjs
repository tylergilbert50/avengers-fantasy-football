#!/usr/bin/env node
/**
 * Smoke test for the ESPN connection.
 *
 *   npm run espn:check
 *   npm run espn:check -- --season 2024
 *
 * Hits ESPN with whatever is in .env, runs the real normalizers, and prints the
 * standings. If this works, the site's /api routes will work.
 */

import { loadDotEnv } from './load-env.mjs'
import { assertConfigured, readEspnEnv } from '../src/lib/espn/config.js'
import { LEAGUE_VIEWS } from '../src/lib/espn/endpoints.js'
import { fetchLeagueRaw } from '../src/lib/espn/fetchLeague.js'
import { normalizeLeague } from '../src/lib/espn/normalize.js'

loadDotEnv()

function arg(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index > -1 ? process.argv[index + 1] : undefined
}

function pad(value, width, align = 'left') {
  const text = String(value ?? '')
  const short = text.length > width ? `${text.slice(0, width - 1)}…` : text
  return align === 'right' ? short.padStart(width) : short.padEnd(width)
}

async function main() {
  let config
  try {
    config = assertConfigured(readEspnEnv(process.env))
  } catch (error) {
    console.error(`\n  ✗ ${error.message}\n`)
    process.exit(1)
  }

  const season = Number(arg('season')) || config.defaultSeason

  console.log(`\n  league  ${config.leagueId}`)
  console.log(`  season  ${season}`)
  console.log(`  auth    ${config.hasCredentials ? 'espn_s2 + SWID present' : 'none (public league)'}\n`)

  const raw = await fetchLeagueRaw({
    leagueId: config.leagueId,
    season,
    views: LEAGUE_VIEWS,
    espnS2: config.espnS2,
    swid: config.swid,
  })

  const league = normalizeLeague(raw)

  console.log(`  ${league.settings.name} — ${league.settings.size} teams`)
  if (league.status.currentMatchupPeriod) {
    console.log(`  week ${league.status.currentMatchupPeriod}`)
  }
  console.log()

  const header = [
    pad('#', 3, 'right'),
    pad('Team', 24),
    pad('Manager', 20),
    pad('Rec', 8),
    pad('PF', 8, 'right'),
    pad('PA', 8, 'right'),
    pad('Diff', 8, 'right'),
  ].join('  ')
  console.log(`  ${header}`)
  console.log(`  ${'-'.repeat(header.length)}`)

  for (const team of league.standings) {
    console.log(
      `  ${[
        pad(team.rank, 3, 'right'),
        pad(team.name, 24),
        pad(team.managerNames, 20),
        pad(team.recordLabel, 8),
        pad(team.record.pointsFor.toFixed(1), 8, 'right'),
        pad(team.record.pointsAgainst.toFixed(1), 8, 'right'),
        pad(team.record.pointsDifferential.toFixed(1), 8, 'right'),
      ].join('  ')}`,
    )
  }

  console.log(`\n  ✓ ${league.managers.length} managers, ${league.teams.length} teams\n`)
}

main().catch((error) => {
  console.error(`\n  ✗ ${error.message}\n`)
  process.exit(1)
})
