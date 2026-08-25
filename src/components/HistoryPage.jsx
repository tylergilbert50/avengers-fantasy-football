import { useMemo, useState } from 'react'
import { useHistory } from '../hooks/useEspn.js'
import {
  allTimeTable,
  headToHead,
  recordLabel,
  shortLabels,
  sortRows,
} from '../lib/history/summary.js'
import './comic.css'
import './HistoryPage.css'

/** The columns you can reorder the table by, and what they read as. */
const COLUMNS = [
  { key: 'record', label: 'Record' },
  { key: 'winPct', label: 'Win%' },
  { key: 'pointsForPerGame', label: 'PF/g' },
  { key: 'pointsAgainstPerGame', label: 'PA/g' },
  { key: 'playoffs', label: 'Playoffs' },
  { key: 'titles', label: 'Titles' },
  { key: 'sackos', label: 'Sackos' },
]

/** Every owner who has ever played, retired ones included. */
export function AllTime({ rows }) {
  const [sort, setSort] = useState({ key: 'winPct', direction: 'desc' })

  // A new column opens on descending — the first question of any of these is
  // who has the most — and clicking the one you are already on turns it over.
  const sortBy = (key) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
        : { key, direction: 'desc' },
    )

  const sorted = useMemo(() => sortRows(rows, sort.key, sort.direction), [rows, sort])

  const heading = (column) => {
    const on = sort.key === column.key
    return (
      <th
        key={column.key}
        scope="col"
        className="col-num"
        // The arrow is the only visible mark, so this is what a screen reader
        // has to go on.
        aria-sort={on ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button type="button" className="hs-sort" onClick={() => sortBy(column.key)}>
          {column.label}
          {/* Drawn rather than typed: every triangle in Unicode has an emoji
              presentation waiting to hijack it on a phone. */}
          <span className={`hs-caret${on ? ` is-${sort.direction}` : ''}`} aria-hidden="true" />
        </button>
      </th>
    )
  }

  return (
    <div className="table-wrap">
      <table className="hs-table">
        <thead>
          <tr>
            <th scope="col" className="col-rank">#</th>
            <th scope="col" className="col-name">Owner</th>
            <th scope="col" className="col-num">Szn</th>
            {COLUMNS.map(heading)}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={row.name}>
              <td className="col-rank">
                <span className="rank-badge" aria-hidden="true">{index + 1}</span>
                <span className="sr-only">{index + 1}</span>
              </td>
              <td className="col-name">
                <span className="hs-name">{row.name}</span>
              </td>
              <td className="col-num">{row.seasonCount}</td>
              <td className="col-num">{row.recordLabel}</td>
              <td className="col-num">{row.winPct.toFixed(3).replace(/^0/, '')}</td>
              <td className="col-num">{row.pointsForPerGame.toFixed(1)}</td>
              <td className="col-num">{row.pointsAgainstPerGame.toFixed(1)}</td>
              <td className="col-num">{row.playoffLabel}</td>
              <td className="col-num hs-strong">{row.titles || '—'}</td>
              <td className="col-num hs-strong">{row.sackos || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Who has beaten whom, everything ever played. */
export function HeadToHead({ owners, records }) {
  // Danny Stiles and Drew Sherrow are both "DS" on initials alone, so the
  // heads are widened until every column is its own.
  const labels = shortLabels(owners)

  return (
    <div className="table-wrap">
      <table className="hs-table hs-grid">
        <thead>
          <tr>
            <th scope="col" className="col-name">
              <span className="sr-only">Owner</span>
            </th>
            {owners.map((owner) => (
              <th key={owner} scope="col" className="col-num">
                <abbr title={owner}>{labels.get(owner)}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {owners.map((owner) => (
            <tr key={owner}>
              <th scope="row" className="col-name">{owner}</th>
              {owners.map((opponent) => {
                const record = records.get(owner, opponent)
                if (!record) {
                  return <td key={opponent} className="col-num hs-self" aria-hidden="true" />
                }
                const played = record.wins + record.losses + record.ties
                const winning = record.wins > record.losses
                const losing = record.wins < record.losses
                return (
                  <td
                    key={opponent}
                    className={`col-num${winning ? ' hs-up' : ''}${losing ? ' hs-down' : ''}`}
                  >
                    {played === 0 ? '—' : recordLabel(record)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The biggest single weeks any one player has ever put up. */
export function BestWeeks({ players }) {
  const [top, rest] = [players.slice(0, 10), players.slice(10)]

  const row = (entry, index) => (
    <li key={`${entry.player}-${entry.season}-${entry.week}`} className="hs-week">
      <span className="hs-week-rank" aria-hidden="true">{index + 1}</span>
      <span className="hs-week-player">
        {entry.player}
        {entry.position && <span className="hs-pos">{entry.position}</span>}
      </span>
      <span className="hs-week-owner">{entry.manager}</span>
      <span className="hs-week-when">{entry.season} · wk {entry.week}</span>
      <span className="hs-week-score">{entry.score.toFixed(1)}</span>
    </li>
  )

  return (
    <div className="hs-panel">
      <ol className="hs-weeks">{top.map(row)}</ol>
      {rest.length > 0 && (
        <details className="hs-more">
          <summary>The next {rest.length}</summary>
          <ol className="hs-weeks">{rest.map((entry, index) => row(entry, index + 10))}</ol>
        </details>
      )}
    </div>
  )
}

/** Stable, so the memos below aren't invalidated by a fresh literal each render. */
const NOTHING_YET = { seasons: [], games: [], owners: [], topPlayers: [] }

const SECTIONS = [
  { id: 'all-time', label: 'All-time' },
  { id: 'h2h', label: 'Head to head' },
  { id: 'weeks', label: 'Best weeks' },
]

export default function HistoryPage() {
  const [section, setSection] = useState('all-time')
  const { data, error, isLoading, refresh } = useHistory()

  // Every view is folded from the one payload — a few hundred games — rather
  // than the server sending four shapes of the same facts.
  const history = data ?? NOTHING_YET
  const table = useMemo(
    // Owners still in the league. Retired ones are kept out of the table and
    // the grid — they aren't playing — but the game log keeps every game they
    // played, because a log missing one side of a fixture isn't a log.
    () => allTimeTable(history, { retired: false }),
    [history],
  )
  const records = useMemo(() => headToHead(history), [history])

  // Ordered by the all-time table, so the grid reads the same way round.
  const owners = useMemo(() => table.map((row) => row.name), [table])

  const ready = !isLoading && !error && history.games.length > 0

  return (
    <div className="page-shell is-history">
      <div className="page-inner">
        <header className="page-head">
          <div className="title-block">
            <h1 className="title">
              <span className="title-small">The</span> History Sheet
            </h1>
            <p className="page-sub">
              {ready ? (
                <>
                  <span>{history.seasons[0]}–{history.seasons.at(-1)}</span>
                  <span className="sub-sep" aria-hidden="true">·</span>
                  <span>{history.games.length} games</span>
                  <span className="sub-sep" aria-hidden="true">·</span>
                  <span>{table.length} owners</span>
                </>
              ) : (
                <span>Every game ever played</span>
              )}
            </p>
          </div>
        </header>

        {isLoading && <p className="state">Opening the ledger…</p>}

        {error && (
          <div className="state state-error" role="alert">
            <p className="state-title">Couldn’t load the history.</p>
            <p className="state-detail">{error.message}</p>
            <button type="button" className="retry" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {ready && (
          <>
            {/* Four views of one dataset. Tabs rather than one long page: the
                game log alone is hundreds of rows, and nobody scrolls past it
                to reach the head-to-head grid. */}
            <nav className="hs-tabs" aria-label="History sections">
              {SECTIONS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`hs-tab${section === entry.id ? ' is-on' : ''}`}
                  aria-pressed={section === entry.id}
                  onClick={() => setSection(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </nav>

            {section === 'all-time' && <AllTime rows={table} />}
            {section === 'h2h' && <HeadToHead owners={owners} records={records} />}
            {section === 'weeks' && <BestWeeks players={history.topPlayers} />}

          </>
        )}
      </div>
    </div>
  )
}
