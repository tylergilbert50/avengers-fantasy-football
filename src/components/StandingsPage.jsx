import { useLeague } from '../hooks/useEspn.js'
import './comic.css'
import './StandingsPage.css'

function avg(value) {
  return Number.isFinite(value) ? value.toFixed(1) : '—'
}

/** "1st", "2nd", "3rd", "4th" — used for the rank column's screen-reader text. */
function ordinal(n) {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/**
 * The table on its own, taking already-loaded rows. Kept separate from the
 * fetching so it can be rendered straight from a payload in a test.
 */
export function StandingsTable({ standings }) {
  return (
    <div className="table-wrap">
      <table className="standings">
        <thead>
          <tr>
            <th scope="col" className="col-rank">#</th>
            <th scope="col" className="col-team">Team</th>
            <th scope="col" className="col-num">Record</th>
            {/* Averages, not totals, so teams stay comparable if a week is
                still being played out. */}
            <th scope="col" className="col-num">Avg PF</th>
            <th scope="col" className="col-num">Avg PA</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team) => (
            <tr key={team.id}>
              <td className="col-rank">
                <span
                  className={`rank-badge${team.rank <= 3 ? ` rank-${team.rank}` : ''}`}
                  aria-hidden="true"
                >
                  {team.rank}
                </span>
                <span className="sr-only">{ordinal(team.rank)}</span>
              </td>
              <td className="col-team">
                <span className="team-name">{team.name}</span>
                <span className="team-manager">{team.managerNames}</span>
              </td>
              <td className="col-num">{team.recordLabel}</td>
              <td className="col-num">{avg(team.record?.pointsForPerGame)}</td>
              <td className="col-num">{avg(team.record?.pointsAgainstPerGame)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function StandingsPage() {
  const { data, error, isLoading, refresh } = useLeague()
  const standings = data?.standings ?? []

  return (
    <div className="page-shell is-standings">
      <div className="page-inner">
        <header className="page-head">
          <div className="title-block">
            {/* The word gets its comic outline from a ring of hard text-shadows
                rather than -webkit-text-stroke, which centres the stroke on the
                glyph edge and eats into letterforms this heavy. */}
            <h1 className="title">Standings</h1>
            {/* Split into parts so the separator can be dropped on phones,
                where the line wraps anyway and the dot is left stranded at the
                end of the first line. */}
            <p className="page-sub">
              {data ? (
                <>
                  <span>{data.settings?.name ?? 'League'}</span>
                  <span className="sub-sep" aria-hidden="true">·</span>
                  <span>{data.season} season</span>
                </>
              ) : (
                <span>Current season</span>
              )}
            </p>
          </div>
        </header>

        {isLoading && <p className="state">Loading standings…</p>}

        {error && (
          <div className="state state-error" role="alert">
            <p className="state-title">Couldn’t load the standings.</p>
            <p className="state-detail">{error.message}</p>
            <button type="button" className="retry" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && standings.length === 0 && (
          <p className="state">No teams in this league yet.</p>
        )}

        {standings.length > 0 && <StandingsTable standings={standings} />}

        {data && (
          <p className="page-foot">
            {/* Before week 1 the rows are all 0-0 and the order is last
                season's finish, which is worth saying out loud — otherwise it
                looks like this season has somehow already been decided. */}
            {data.standingsFrom
              ? `Standing as they finished ${data.standingsFrom} — until week 1 is played`
              : `Through ${standings[0]?.record?.gamesPlayed ?? 0} games`}
          </p>
        )}
      </div>
    </div>
  )
}
