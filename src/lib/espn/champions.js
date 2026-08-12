/**
 * Who won each season, and what they won it with.
 *
 * Pure functions over already-normalized seasons — the same bundle the record
 * book is built from — so the shaping is testable without the network.
 *
 * ESPN settles the title two ways. `rankCalculatedFinal` is stamped on the team
 * once the bracket is over, and the bracket itself is in the schedule. The
 * final rank is preferred because it survives seasons whose schedule ESPN has
 * stopped serving; the bracket is the fallback for the reverse case, a season
 * whose games are there but whose ranks came back as zeroes.
 */

import { playerSlug } from './draft.js'

/** Games from the title bracket that were actually played, oldest first. */
function bracketGames(matchups = []) {
  return matchups.filter(
    (matchup) =>
      matchup.playoffTier === 'WINNERS_BRACKET' && matchup.isComplete && !matchup.isBye,
  )
}

/**
 * The season's champion, or null if it hasn't been decided — which is the
 * normal state of the season currently being played.
 */
export function findChampion(season = {}) {
  const teams = season.teams ?? []

  const ranked = teams.find((team) => team.finalRank === 1)
  if (ranked) return ranked

  const games = bracketGames(season.matchups)
  const final = games[games.length - 1]
  if (!final) return null

  const winnerId = final.winner === 'HOME' ? final.home?.teamId : final.away?.teamId
  return teams.find((team) => team.id === winnerId) ?? null
}

/** The last bracket game this team played — the one that settled it. */
function titleGame(matchups, teamId) {
  const games = bracketGames(matchups).filter(
    (matchup) => matchup.home?.teamId === teamId || matchup.away?.teamId === teamId,
  )
  const final = games[games.length - 1]
  if (!final) return null

  const [team, opponent] =
    final.home?.teamId === teamId ? [final.home, final.away] : [final.away, final.home]

  return {
    week: final.week,
    points: team?.points ?? null,
    opponent: opponent?.name ?? null,
    opponentManager: opponent?.managerNames ?? null,
    opponentPoints: opponent?.points ?? null,
    margin: final.margin,
  }
}

/**
 * One season's champion, flattened into what the page renders.
 *
 * The record is the regular season's — ESPN's `record.overall` stops at the
 * bracket — which is the point of the line: a champion can and does arrive
 * there with a losing record.
 */
function shapeChampion(season) {
  const team = findChampion(season)
  if (!team) return null

  const record = team.record ?? {}

  return {
    season: season.season,
    team: {
      id: team.id,
      name: team.name,
      abbrev: team.abbrev,
      logo: team.logo,
    },
    manager: team.managerNames,
    // Same slug rules as the draft artwork, so a portrait is matched by
    // dropping a file named after the manager into the assets folder.
    managerSlug: playerSlug(team.managerNames),
    record: {
      wins: record.wins ?? 0,
      losses: record.losses ?? 0,
      ties: record.ties ?? 0,
      gamesPlayed: record.gamesPlayed ?? 0,
      label: team.recordLabel ?? '0-0',
      pointsFor: record.pointsFor ?? 0,
      pointsPerWeek: record.pointsForPerGame ?? 0,
    },
    seed: team.playoffSeed ?? null,
    titleGame: titleGame(season.matchups ?? [], team.id),
  }
}

/**
 * Every settled season, newest first.
 *
 * `issue` numbers the champions in the order they were won, so the comic covers
 * cut for them can be named by the issue they are. Seasons still being played
 * have no champion and drop out rather than appearing blank.
 *
 * @param {object[]} seasons  `{ season, teams, matchups }`, in any order
 */
export function buildChampions(seasons = []) {
  return [...seasons]
    .sort((a, b) => a.season - b.season)
    .map(shapeChampion)
    .filter(Boolean)
    .map((champion, index) => ({ ...champion, issue: index + 1 }))
    .reverse()
}
