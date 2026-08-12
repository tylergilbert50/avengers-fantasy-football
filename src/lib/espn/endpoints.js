/**
 * URL builders for ESPN's (undocumented) Fantasy v3 API.
 *
 * ESPN moved the read host to lm-api-reads.fantasy.espn.com in April 2024; the
 * old fantasy.espn.com host still redirects but is rate limited harder.
 */

export const ESPN_BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl'

/**
 * Views are ESPN's way of selecting which chunks of the league blob come back.
 * Only these are allowed through from a request, so a caller can't probe for
 * arbitrary views using our credentials.
 */
export const ALLOWED_VIEWS = Object.freeze([
  'mTeam',
  'mRoster',
  'mMatchup',
  'mMatchupScore',
  'mSettings',
  'mStandings',
  'mScoreboard',
  'mBoxscore',
  'mDraftDetail',
  'mPendingTransactions',
])

export const LEAGUE_VIEWS = Object.freeze(['mTeam', 'mSettings', 'mStandings'])
export const MATCHUP_VIEWS = Object.freeze(['mMatchupScore', 'mTeam'])

export function sanitizeViews(views, fallback) {
  const list = (Array.isArray(views) ? views : [views]).filter(Boolean)
  const allowed = list.filter((view) => ALLOWED_VIEWS.includes(view))
  return allowed.length > 0 ? allowed : [...fallback]
}

/** Current-season endpoint. Works for 2018+. */
export function leagueUrl({ season, leagueId, views = [], scoringPeriodId }) {
  const url = new URL(`${ESPN_BASE}/seasons/${season}/segments/0/leagues/${leagueId}`)
  for (const view of views) url.searchParams.append('view', view)
  if (scoringPeriodId != null) url.searchParams.set('scoringPeriodId', String(scoringPeriodId))
  return url.toString()
}

/**
 * Historical endpoint. Needed for older seasons, and returns an *array* with a
 * single league object rather than the object directly.
 */
export function leagueHistoryUrl({ season, leagueId, views = [] }) {
  const url = new URL(`${ESPN_BASE}/leagueHistory/${leagueId}`)
  url.searchParams.set('seasonId', String(season))
  for (const view of views) url.searchParams.append('view', view)
  return url.toString()
}
