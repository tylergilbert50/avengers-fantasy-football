/**
 * Turns ESPN's raw league blob into the shapes this site actually renders.
 *
 * Pure functions, no I/O — safe to import from anywhere, and easy to test
 * against a saved fixture.
 */

const EMPTY_RECORD = Object.freeze({
  wins: 0,
  losses: 0,
  ties: 0,
  percentage: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  streakLength: 0,
  streakType: 'NONE',
})

function round(value, places = 2) {
  const factor = 10 ** places
  return Math.round((Number(value) || 0) * factor) / factor
}

/**
 * ESPN renamed team fields in 2023: newer seasons carry `name`, older ones
 * carry `location` + `nickname`. Support both so past seasons render.
 */
export function teamName(team) {
  const modern = String(team?.name ?? '').trim()
  if (modern) return modern
  const legacy = [team?.location, team?.nickname].filter(Boolean).join(' ').trim()
  return legacy || team?.abbrev || `Team ${team?.id ?? '?'}`
}

function memberDisplayName(member) {
  const full = [member?.firstName, member?.lastName].filter(Boolean).join(' ').trim()
  return full || String(member?.displayName ?? '').trim() || 'Unknown manager'
}

/** SWID -> manager. ESPN keys team owners by these GUIDs. */
export function indexMembers(raw) {
  const index = new Map()
  for (const member of raw?.members ?? []) {
    if (!member?.id) continue
    index.set(member.id, {
      id: member.id,
      name: memberDisplayName(member),
      handle: String(member.displayName ?? '').trim() || null,
      isLeagueManager: Boolean(member.isLeagueManager),
    })
  }
  return index
}

function normalizeRecordBlock(block) {
  const source = { ...EMPTY_RECORD, ...(block ?? {}) }
  const wins = Number(source.wins) || 0
  const losses = Number(source.losses) || 0
  const ties = Number(source.ties) || 0
  const gamesPlayed = wins + losses + ties
  const pointsFor = round(source.pointsFor)
  const pointsAgainst = round(source.pointsAgainst)

  return {
    wins,
    losses,
    ties,
    gamesPlayed,
    // ESPN sends `percentage` already, but it is absent on some historical
    // payloads — recompute so the field is always trustworthy.
    winPct: gamesPlayed > 0 ? round((wins + ties / 2) / gamesPlayed, 4) : 0,
    pointsFor,
    pointsAgainst,
    pointsDifferential: round(pointsFor - pointsAgainst),
    pointsForPerGame: gamesPlayed > 0 ? round(pointsFor / gamesPlayed) : 0,
    pointsAgainstPerGame: gamesPlayed > 0 ? round(pointsAgainst / gamesPlayed) : 0,
    streak: {
      length: Number(source.streakLength) || 0,
      type: source.streakType ?? 'NONE',
    },
  }
}

/** "5-2-1" or "5-2" when there are no ties. */
export function formatRecord(record) {
  if (!record) return '0-0'
  return record.ties > 0
    ? `${record.wins}-${record.losses}-${record.ties}`
    : `${record.wins}-${record.losses}`
}

export function normalizeTeam(team, membersById = new Map()) {
  const ownerIds = team?.owners ?? []
  const managers = ownerIds
    .map((id) => membersById.get(id))
    .filter(Boolean)

  const overall = normalizeRecordBlock(team?.record?.overall)
  // `team.points` is the same number as record.overall.pointsFor, but survives
  // on a few payload shapes where the record block is missing.
  if (overall.pointsFor === 0 && Number(team?.points) > 0) {
    overall.pointsFor = round(team.points)
    overall.pointsDifferential = round(overall.pointsFor - overall.pointsAgainst)
  }

  return {
    id: team?.id,
    abbrev: team?.abbrev ?? null,
    name: teamName(team),
    logo: team?.logo ?? null,
    divisionId: team?.divisionId ?? 0,
    managers,
    managerNames: managers.map((m) => m.name).join(' & ') || 'Unclaimed',
    primaryOwnerId: team?.primaryOwner ?? ownerIds[0] ?? null,
    record: overall,
    recordLabel: formatRecord(overall),
    home: normalizeRecordBlock(team?.record?.home),
    away: normalizeRecordBlock(team?.record?.away),
    playoffSeed: Number(team?.playoffSeed) || null,
    finalRank: Number(team?.rankCalculatedFinal) || null,
    projectedRank: Number(team?.currentProjectedRank) || null,
    waiverRank: Number(team?.waiverRank) || null,
  }
}

/**
 * Has anything actually been played yet?
 *
 * A preseason payload has every record at 0-0 with nothing scored, which is the
 * state the league sits in from the draft until week 1 kicks off.
 */
export function hasPlayedGames(teams = []) {
  return teams.some((team) => team.record?.gamesPlayed > 0 || team.record?.pointsFor > 0)
}

/** Sorts after everyone with a place, without producing NaN against itself. */
const UNPLACED = Number.MAX_SAFE_INTEGER

/** Where this team's manager finished last season, by whichever owner we know. */
function priorRank(team, rankByOwner) {
  for (const manager of team.managers ?? []) {
    const rank = rankByOwner.get(manager.id)
    if (rank != null) return rank
  }
  return rankByOwner.get(team.primaryOwnerId) ?? UNPLACED
}

/**
 * ESPN's `playoffSeed` is the league's own live ranking and already applies the
 * league's configured tiebreakers, so prefer it. Some payloads leave it at 0
 * (preseason, or history endpoints) — fall back to win% then points for.
 *
 * `priorFinish` covers the case none of those can: before week 1, every record
 * is 0-0 and every seed is 0, so all three rules tie and the table falls back
 * to ESPN's team-id order — an arbitrary list that still reads like a ranking.
 * Handed last season's finishing places, the preseason table stands in those
 * instead, and the first played week takes the order back.
 */
export function sortStandings(teams, { priorFinish } = {}) {
  const seeded = teams.every((team) => team.playoffSeed > 0)
  const carried = priorFinish?.rankByOwner?.size ? priorFinish.rankByOwner : null
  const sorted = [...teams]

  sorted.sort((a, b) => {
    // A manager who wasn't here last season has no place to hold and goes to
    // the bottom, in name order alongside anyone else new.
    if (carried) {
      return priorRank(a, carried) - priorRank(b, carried) || a.name.localeCompare(b.name)
    }
    if (seeded) return a.playoffSeed - b.playoffSeed
    if (b.record.winPct !== a.record.winPct) return b.record.winPct - a.record.winPct
    return b.record.pointsFor - a.record.pointsFor
  })

  return sorted.map((team, index) => ({ ...team, rank: index + 1 }))
}

export function normalizeSettings(raw) {
  const settings = raw?.settings ?? {}
  const schedule = settings.scheduleSettings ?? {}
  return {
    name: settings.name ?? `League ${raw?.id ?? ''}`.trim(),
    size: Number(settings.size) || (raw?.teams?.length ?? 0),
    regularSeasonMatchups: Number(schedule.matchupPeriodCount) || null,
    playoffTeamCount: Number(schedule.playoffTeamCount) || null,
    divisions: (settings.scheduleSettings?.divisions ?? []).map((division) => ({
      id: division.id,
      name: division.name,
      size: division.size,
    })),
  }
}

export function normalizeStatus(raw) {
  const status = raw?.status ?? {}
  return {
    isActive: Boolean(status.isActive),
    currentMatchupPeriod: Number(status.currentMatchupPeriod) || null,
    latestScoringPeriod: Number(status.latestScoringPeriod) || null,
    firstScoringPeriod: Number(status.firstScoringPeriod) || null,
    finalScoringPeriod: Number(status.finalScoringPeriod) || null,
    previousSeasons: (status.previousSeasons ?? []).slice().sort((a, b) => b - a),
  }
}

/**
 * The main entry point: raw ESPN league -> everything the site needs.
 *
 * `priorFinish` is last season's finishing order — `{ season, rankByOwner }` —
 * and is only used while nothing has been played, to stop the preseason table
 * from presenting ESPN's team-id order as a standing. See sortStandings.
 *
 * @returns {{
 *   leagueId: number, season: number, settings: object, status: object,
 *   managers: object[], teams: object[], standings: object[],
 *   standingsFrom: number|null, fetchedAt: string
 * }}
 */
export function normalizeLeague(raw, { priorFinish } = {}) {
  const membersById = indexMembers(raw)
  const teams = (raw?.teams ?? []).map((team) => normalizeTeam(team, membersById))

  const carried =
    !hasPlayedGames(teams) && priorFinish?.rankByOwner?.size ? priorFinish : null
  const standings = sortStandings(teams, { priorFinish: carried })

  // Managers get their team stapled on, so a "meet the managers" view doesn't
  // have to cross-reference two lists.
  const teamByOwner = new Map()
  for (const team of standings) {
    for (const manager of team.managers) teamByOwner.set(manager.id, team)
  }

  const managers = [...membersById.values()].map((manager) => {
    const team = teamByOwner.get(manager.id) ?? null
    return {
      ...manager,
      teamId: team?.id ?? null,
      teamName: team?.name ?? null,
      teamAbbrev: team?.abbrev ?? null,
      record: team?.record ?? null,
      recordLabel: team?.recordLabel ?? null,
      rank: team?.rank ?? null,
    }
  })

  managers.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.name.localeCompare(b.name))

  return {
    leagueId: raw?.id ?? null,
    season: raw?.seasonId ?? null,
    scoringPeriodId: raw?.scoringPeriodId ?? null,
    settings: normalizeSettings(raw),
    status: normalizeStatus(raw),
    managers,
    teams,
    standings,
    // The season the order was borrowed from, when it isn't this one's results.
    standingsFrom: carried?.season ?? null,
    fetchedAt: new Date().toISOString(),
  }
}

/** Schedule entries -> matchups, with team objects resolved. */
export function normalizeMatchups(raw, { week } = {}) {
  const membersById = indexMembers(raw)
  const teamsById = new Map(
    (raw?.teams ?? []).map((team) => {
      const normalized = normalizeTeam(team, membersById)
      return [normalized.id, normalized]
    }),
  )

  const side = (entry) => {
    if (!entry) return null
    const team = teamsById.get(entry.teamId) ?? null
    return {
      teamId: entry.teamId,
      name: team?.name ?? `Team ${entry.teamId}`,
      abbrev: team?.abbrev ?? null,
      logo: team?.logo ?? null,
      managerNames: team?.managerNames ?? null,
      points: round(entry.totalPoints),
    }
  }

  const matchups = (raw?.schedule ?? [])
    .filter((entry) => week == null || entry.matchupPeriodId === week)
    .map((entry) => {
      const home = side(entry.home)
      const away = side(entry.away)
      return {
        id: entry.id,
        week: entry.matchupPeriodId,
        playoffTier: entry.playoffTierType ?? 'NONE',
        // Odd-sized leagues produce bye entries with no away side.
        isBye: !away,
        winner: entry.winner ?? 'UNDECIDED',
        isComplete: Boolean(entry.winner) && entry.winner !== 'UNDECIDED',
        home,
        away,
        margin: home && away ? round(Math.abs(home.points - away.points)) : null,
      }
    })

  matchups.sort((a, b) => a.week - b.week || a.id - b.id)
  return matchups
}
