/**
 * Draft boards, one per season.
 *
 * Pure functions over already-fetched pieces, so the shaping is testable
 * without the network.
 *
 * ESPN's draft records carry only a `playerId` — no names — so the caller
 * resolves those separately and hands in a lookup. An unresolved id becomes a
 * readable placeholder rather than blanking the row: a draft board with a hole
 * in it is worse than one that admits it doesn't know the name.
 */

/** ESPN's position ids. Anything else shows as an empty slot rather than a number. */
const POSITIONS = Object.freeze({
  1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 7: 'P', 9: 'DT', 10: 'DE',
  11: 'LB', 12: 'CB', 13: 'S', 16: 'D/ST', 17: 'K',
})

/** ESPN's own draft recap for a season. */
export function draftRecapUrl({ leagueId, season }) {
  if (!leagueId || !season) return null
  const url = new URL('https://fantasy.espn.com/football/league/draftrecap')
  url.searchParams.set('leagueId', String(leagueId))
  url.searchParams.set('seasonId', String(season))
  return url.toString()
}

/**
 * A file-name-safe key for a player, so artwork can be matched by name without
 * anything having to list the players out. "Ja'Marr Chase" -> "jamarr-chase".
 */
export function playerSlug(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents: "Amon-Ra" keeps its dash
    // Apostrophes close up rather than becoming separators, so Ja'Marr is
    // "jamarr-chase" and not "ja-marr-chase". Same for D'Andre, Ka'imi, etc.
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * @param {object} raw           the ESPN league blob, with mDraftDetail
 * @param {object[]} teams       normalized teams for that season
 * @param {Map<number,object>} players  playerId -> { name, positionId }
 * @param {number} leagueId
 * @param {number} season
 */
export function normalizeDraft({ raw, teams = [], players = new Map(), leagueId, season }) {
  const detail = raw?.draftDetail ?? {}
  const settings = raw?.settings?.draftSettings ?? {}

  const byTeam = new Map(teams.map((team) => [team.id, team]))
  const rawPicks = [...(detail.picks ?? [])].sort(
    (a, b) => (a.overallPickNumber ?? 0) - (b.overallPickNumber ?? 0),
  )

  // ESPN seeds an undrafted season with placeholder rows carrying playerId -1.
  const drafted = rawPicks.filter((pick) => pick.playerId > 0)

  const picks = drafted.map((pick) => {
    const player = players.get(pick.playerId)
    const team = byTeam.get(pick.teamId)
    const name = player?.name ?? `Player ${pick.playerId}`
    return {
      overall: pick.overallPickNumber,
      round: pick.roundId,
      pickInRound: pick.roundPickNumber,
      // "3.07" reads as round 3, pick 7 — how everyone says it out loud.
      label: `${pick.roundId}.${String(pick.roundPickNumber).padStart(2, '0')}`,
      playerId: pick.playerId,
      player: name,
      slug: playerSlug(name),
      position: POSITIONS[player?.positionId] ?? '',
      teamId: pick.teamId,
      manager: team?.managerNames ?? 'Unclaimed',
      teamName: team?.name ?? null,
      keeper: Boolean(pick.keeper),
    }
  })

  const rounds = picks.length ? Math.max(...picks.map((pick) => pick.round)) : 0

  return {
    season,
    // OFFLINE means the draft happened elsewhere and was typed in afterwards.
    type: settings.type ?? null,
    date: settings.date ? new Date(settings.date).toISOString() : null,
    isComplete: Boolean(detail.drafted) && picks.length > 0,
    inProgress: Boolean(detail.inProgress),
    pickCount: picks.length,
    rounds,
    firstRound: picks.filter((pick) => pick.round === 1),
    picks,
    topPick: picks[0] ?? null,
    recapUrl: draftRecapUrl({ leagueId, season }),
  }
}

/** Picks grouped into rounds, for rendering a board. */
export function byRound(picks = []) {
  const rounds = new Map()
  for (const pick of picks) {
    if (!rounds.has(pick.round)) rounds.set(pick.round, [])
    rounds.get(pick.round).push(pick)
  }
  return [...rounds.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, list]) => ({ round, picks: list }))
}
