/**
 * The league's history, from the two places it lives.
 *
 * ESPN is the system of record and is read live, so the history sheet keeps up
 * on its own: a week's games appear once they're final, and the all-time table,
 * the head-to-head grid and the game log all move with them.
 *
 * The workbook still has three things ESPN can't give us, which is why it is
 * merged underneath rather than retired:
 *
 *  - **Sackos.** Not last place. ESPN's final ranking names a different owner
 *    every single season, so the title is decided by something the payload
 *    doesn't model.
 *  - **Who was behind a team.** ESPN forgets an owner who left mid-season and
 *    reports "Unclaimed" — 2023's CPU Team was Jake Meadors, and the workbook
 *    is the only thing that still knows it.
 *  - **Seasons ESPN has dropped.** It stops serving old years without warning.
 *
 * Where the two disagree on a score, ESPN wins: the differences are all
 * transcription slips of a tenth or two, none of which change a result.
 */

/** ESPN's tiers. Consolation games are excluded, the way the workbook has them. */
const PLAYOFF_TIER = 'WINNERS_BRACKET'
const NO_OWNER = 'unclaimed'

function key(name) {
  return String(name ?? '').trim().toLowerCase()
}

function isUnknown(name) {
  return !name || key(name) === NO_OWNER
}

/**
 * One side of one fixture.
 *
 * Keyed on a single owner rather than the pair, because the whole point is to
 * find a game where the other name is the one we're missing — a key built from
 * both would need the answer to look up the answer.
 */
function sideKey(season, week, name) {
  return `${season}|${week}|${key(name)}`
}

/**
 * ESPN's verdict on a game the score doesn't settle.
 *
 * Only consulted when the two totals are equal, so the flag can never
 * contradict a score — it only breaks a draw. See results.js.
 */
function decided(matchup) {
  if (matchup.home?.points !== matchup.away?.points) return null
  if (matchup.winner === 'HOME') return 'a'
  if (matchup.winner === 'AWAY') return 'b'
  return null
}

/**
 * One season of ESPN matchups as history games.
 *
 * Only games that have been played: a fixture with no result yet is on the
 * schedule page, not in the record.
 */
export function seasonGames({ season, teams = [], matchups = [] }) {
  const owner = new Map(teams.map((team) => [team.id, team.managerNames]))

  return matchups
    .filter((matchup) => matchup.isComplete && !matchup.isBye)
    .filter((matchup) => matchup.playoffTier === 'NONE' || matchup.playoffTier === PLAYOFF_TIER)
    .map((matchup) => {
      const winner = decided(matchup)
      return {
        season,
        week: matchup.week,
        type: matchup.playoffTier === PLAYOFF_TIER ? 'P' : 'R',
        a: owner.get(matchup.home?.teamId) ?? null,
        ap: matchup.home?.points ?? null,
        b: owner.get(matchup.away?.teamId) ?? null,
        bp: matchup.away?.points ?? null,
        ...(winner ? { winner } : {}),
      }
    })
}

/**
 * Puts a name back on a side ESPN has forgotten.
 *
 * Found through the side ESPN still knows: whoever the workbook has that owner
 * playing that week is who the other team was. Two unknown sides can't be
 * recovered, and aren't guessed at.
 */
function named(game, archiveBySide) {
  const missing = [isUnknown(game.a), isUnknown(game.b)]
  if (!missing[0] && !missing[1]) return game
  if (missing[0] && missing[1]) return game

  const [known, unknownSide] = missing[0] ? [game.b, 'a'] : [game.a, 'b']
  const fixture = archiveBySide.get(sideKey(game.season, game.week, known))
  if (!fixture) return game

  const opponent = key(fixture.a) === key(known) ? fixture.b : fixture.a
  return { ...game, [unknownSide]: opponent }
}

/**
 * One spelling per person.
 *
 * ESPN has Travis Wolfe down as "travis wolfe" and the workbook as "Travis
 * Wolfe". Left alone that is two managers: one who played fourteen games, and
 * one who has never played and holds a sacko. The best-cased spelling wins,
 * which is the one a person typed rather than the one a form lowercased.
 */
function canonicalNames(names = []) {
  const cased = (name) => (String(name).match(/[A-Z]/g) ?? []).length

  const best = new Map()
  for (const name of names) {
    if (!name) continue
    const id = key(name)
    if (!best.has(id) || cased(name) > cased(best.get(id))) best.set(id, name)
  }
  return (name) => (name ? (best.get(key(name)) ?? name) : name)
}

/**
 * @param {object} archive  the workbook's own record
 * @param {object[]} live   `{ season, teams, matchups }` per season, from ESPN
 */
export function mergeHistory({ archive = {}, live = [] } = {}) {
  const archiveGames = archive.games ?? []

  // Indexed by each side separately, so a game can be found from the one owner
  // ESPN still names — which is how an unclaimed side gets its name back.
  const archiveBySide = new Map()
  for (const game of archiveGames) {
    archiveBySide.set(sideKey(game.season, game.week, game.a), game)
    archiveBySide.set(sideKey(game.season, game.week, game.b), game)
  }

  const liveGames = []
  const liveSeasons = new Set()
  for (const season of live) {
    const games = seasonGames(season)
    if (games.length === 0) continue // a season that hasn't kicked off yet
    liveSeasons.add(season.season)
    for (const game of games) liveGames.push(named(game, archiveBySide))
  }

  // ESPN for every season it still serves, the workbook for the rest.
  const merged = [
    ...archiveGames.filter((game) => !liveSeasons.has(game.season)),
    ...liveGames,
  ].sort((a, b) => a.season - b.season || a.week - b.week)

  const titles = mergeTitles({ archive, live })
  const placings = finishes(live)

  // Settled before anything counts anybody: every later step groups by name,
  // and two spellings of one manager would be two managers.
  const canonical = canonicalNames([
    ...merged.flatMap((game) => [game.a, game.b]),
    ...titles.flatMap((title) => [title.champion, title.sacko]),
    ...placings.map((entry) => entry.owner),
    ...(archive.owners ?? []).map((owner) => owner.name),
  ])

  const games = merged.map((game) => ({ ...game, a: canonical(game.a), b: canonical(game.b) }))

  return {
    seasons: [...new Set(games.map((game) => game.season))].sort(),
    games,
    titles: titles.map((title) => ({
      ...title,
      champion: canonical(title.champion),
      sacko: canonical(title.sacko),
    })),
    finishes: placings.map((entry) => ({ ...entry, owner: canonical(entry.owner) })),
    owners: owners({ archive, live, games }),
    topPlayers: archive.topPlayers ?? [],
    // What the workbook is still carrying on its own, so the page can say so.
    archivedSeasons: [...new Set(archiveGames.map((game) => game.season))]
      .filter((season) => !liveSeasons.has(season))
      .sort(),
  }
}

/**
 * Where everyone finished, by the league's rules rather than ESPN's.
 *
 * ESPN's `rankCalculatedFinal` settles the placings with the consolation
 * bracket and orders knocked-out teams by what they scored on the way out. The
 * league does neither:
 *
 *  - **The consolation bracket doesn't count.** Winning it doesn't move you;
 *    finish tenth in the regular season and you finished tenth.
 *  - **Knocked-out teams are ordered by seed, not by score.** In 2021 ESPN put
 *    Perfectly Balanced third on points; the league has I Am Inevitable third,
 *    because he went into the same round as the higher seed.
 *
 * Who was actually in the playoffs is read off the bracket rather than from the
 * seed numbers — in 2025 the bracket contains the 7 seed and not the 6.
 */
export function seasonFinishes({ season, teams = [], matchups = [] } = {}) {
  const bracket = (matchups ?? []).filter(
    (matchup) => matchup.playoffTier === PLAYOFF_TIER && matchup.isComplete && !matchup.isBye,
  )
  // Nothing has been settled yet, so nobody has finished anywhere.
  if (bracket.length === 0) return []

  const seed = new Map(teams.map((team) => [team.id, Number(team.playoffSeed) || Infinity]))
  const owner = new Map(teams.map((team) => [team.id, team.managerNames]))
  const bySeed = (a, b) => (seed.get(a) ?? Infinity) - (seed.get(b) ?? Infinity)

  // The week each team went out, and everyone the bracket touched.
  const knockedOutIn = new Map()
  const inPlayoffs = new Set()
  for (const matchup of bracket) {
    // ESPN's flag decides it, since only ESPN knows how the league breaks a
    // tie; the score is the fallback for a game that never got one.
    const homeWon =
      matchup.winner === 'HOME' ||
      (matchup.winner !== 'AWAY' && (matchup.home?.points ?? 0) >= (matchup.away?.points ?? 0))

    const [winner, loser] = homeWon
      ? [matchup.home?.teamId, matchup.away?.teamId]
      : [matchup.away?.teamId, matchup.home?.teamId]

    inPlayoffs.add(winner).add(loser)
    knockedOutIn.set(loser, Math.max(knockedOutIn.get(loser) ?? 0, matchup.week))
  }

  // Whoever the bracket never knocked out won it.
  const champion = [...inPlayoffs].find((id) => !knockedOutIn.has(id))

  const order = [
    ...(champion == null ? [] : [champion]),
    // Out later is better; out in the same round is settled by seed.
    ...[...knockedOutIn.keys()].sort(
      (a, b) => knockedOutIn.get(b) - knockedOutIn.get(a) || bySeed(a, b),
    ),
    // Everyone else keeps the order the regular season left them in.
    ...teams.map((team) => team.id).filter((id) => !inPlayoffs.has(id)).sort(bySeed),
  ]

  return order
    .map((id, index) => ({ season, owner: owner.get(id), rank: index + 1 }))
    .filter((entry) => entry.owner && !isUnknown(entry.owner))
}

function finishes(live = []) {
  return live
    .flatMap((season) => seasonFinishes(season))
    .sort((a, b) => a.season - b.season || a.rank - b.rank)
}

/**
 * Champions come from ESPN, which stamps the winner on the team; sackos only
 * from the workbook, because nothing in the payload picks the same owner the
 * league does.
 */
function mergeTitles({ archive = {}, live = [] }) {
  const titles = new Map()

  for (const entry of archive.titles ?? []) {
    titles.set(entry.season, { ...entry })
  }

  for (const season of live) {
    const champion = (season.teams ?? []).find((team) => team.finalRank === 1)
    if (!champion) continue
    const entry = titles.get(season.season) ?? { season: season.season, sacko: null }
    titles.set(season.season, { ...entry, champion: champion.managerNames })
  }

  return [...titles.values()].sort((a, b) => a.season - b.season)
}

/**
 * Who is still in the league, worked out from who has a team in the newest
 * season rather than from a status column — so an owner who leaves drops out
 * on their own, without the workbook being touched.
 */
function owners({ archive = {}, live = [], games = [] }) {
  const newest = [...live].sort((a, b) => b.season - a.season)[0]
  const current = new Set(
    (newest?.teams ?? []).map((team) => key(team.managerNames)).filter((name) => name !== NO_OWNER),
  )

  // Fall back to the workbook's own column when there is no live season to ask.
  const archived = new Map((archive.owners ?? []).map((owner) => [key(owner.name), owner.status]))

  const seen = new Map()
  for (const game of games) {
    for (const name of [game.a, game.b]) {
      if (!name || key(name) === NO_OWNER) continue
      if (!seen.has(key(name))) seen.set(key(name), name)
    }
  }

  return [...seen.entries()].map(([id, name]) => ({
    name,
    status: current.size > 0
      ? (current.has(id) ? 'Active' : 'Retired')
      : (archived.get(id) ?? 'Retired'),
  }))
}
