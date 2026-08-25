import { useRecords } from '../hooks/useEspn.js'
import './comic.css'
import './RecordsPage.css'

/** "1st", "2nd", "3rd" — the rank disc is decorative, this is what's announced. */
function ordinal(n) {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/**
 * One record category. Groups arrive from the API already shaped — title,
 * column labels and rows — so every category renders through here rather than
 * needing twelve hand-written tables.
 */
export function RecordGroup({ group, tilt = 0 }) {
  // Rank disc, the team label, then one track per value column. Built as a
  // string because `repeat()` can't take a custom property for its count.
  //
  // Declared once on the container, not per row. Every row and the header take
  // their tracks from it via `subgrid`, so a `max-content` column is measured
  // across the whole group instead of separately inside each row — which is
  // what let the headings and the values drift out of line.
  const columns = `1.9rem minmax(0, 1fr) repeat(${group.columns.length - 1}, max-content)`

  return (
    <section className="rec-group" style={{ '--tilt': `${tilt}deg` }}>
      <h2 className="rec-title">{group.title}</h2>

      <div className="rec-rows" style={{ '--tpl': columns }}>
        <div className="rec-cols" aria-hidden="true">
          <span />
          {group.columns.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        {group.rows.length === 0 && <p className="rec-empty">Not enough games yet.</p>}

        {group.rows.map((row) => {
          const cells = (
            <>
              <span className={`rank-badge${row.rank <= 3 ? ` rank-${row.rank}` : ''}`} aria-hidden="true">
                {row.rank}
              </span>
              <span className="rec-primary">
                <span className="sr-only">{ordinal(row.rank)}: </span>
                {row.primary}
              </span>
              {row.cells.map((cell, i) => (
                // The trailing cell is context — year, opponent, span — rather
                // than a number to compare, and is toned down for it. Marked
                // with a class rather than picked out by :last-child, because
                // linked rows carry a hidden screen-reader span after it and
                // that positional match silently missed them.
                <span
                  key={i}
                  className={`rec-cell${i === row.cells.length - 1 ? ' rec-context' : ''}`}
                >
                  {cell}
                </span>
              ))}
            </>
          )

          // Rows that have a box score are the link themselves rather than
          // carrying one, so the whole strip is the target.
          return row.link ? (
            <a
              key={row.rank}
              className="rec-row is-link"
              href={row.link}
              target="_blank"
              rel="noreferrer noopener"
            >
              {cells}
              <span className="sr-only">— open this matchup on ESPN</span>
            </a>
          ) : (
            <div key={row.rank} className="rec-row">
              {cells}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function RecordsPage() {
  const { data, error, isLoading, refresh } = useRecords()
  const groups = data?.groups ?? []

  const seasons = data?.seasons ?? []
  const span = seasons.length
    ? seasons.length === 1
      ? `${seasons[0]}`
      : `${seasons[0]}–${seasons[seasons.length - 1]}`
    : null

  return (
    <div className="page-shell is-records">
      <div className="page-inner">
        <header className="page-head">
          <div className="title-block">
            <h1 className="title">
              <span className="title-small">The Hall of</span> Records
            </h1>
            <p className="page-sub">
              {span ? (
                <>
                  <span>{data.leagueName ?? 'League'}</span>
                  <span className="sub-sep" aria-hidden="true">·</span>
                  <span>{span}</span>
                </>
              ) : (
                <span>All-time</span>
              )}
            </p>
          </div>
        </header>

        {isLoading && <p className="state">Digging through the archives…</p>}

        {error && (
          <div className="state state-error" role="alert">
            <p className="state-title">Couldn’t load the records.</p>
            <p className="state-detail">{error.message}</p>
            <button type="button" className="retry" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && groups.length === 0 && (
          <p className="state">No seasons to draw records from yet.</p>
        )}

        {groups.length > 0 && (
          <div className="rec-grid">
            {groups.map((group, i) => (
              // Alternating tilt, so the panels look laid down by hand rather
              // than snapped to a grid.
              <RecordGroup key={group.id} group={group} tilt={i % 2 === 0 ? -0.3 : 0.3} />
            ))}
          </div>
        )}

        {/* Only worth a line when something is actually missing — ESPN drops
            older seasons without warning, and a silently short record book
            would be misleading. */}
        {data?.missingSeasons?.length > 0 && (
          <p className="page-foot">{data.missingSeasons.join(', ')} unavailable</p>
        )}
      </div>
    </div>
  )
}
