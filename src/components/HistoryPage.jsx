import { useMemo, useState } from 'react'
import { useHistory } from '../hooks/useEspn.js'
import { playerSlug } from '../lib/espn/draft.js'
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

/** Who has beaten whom, over the regular season — the bracket is left out. */
export function HeadToHead({ owners, records, onOpen }) {
  // Danny Stiles and Drew Sherrow are both "DS" on initials alone, so the
  // heads are widened until every column is its own.
  const labels = shortLabels(owners)

  const open = (owner, opponent) =>
    onOpen(`history-sheet/h2h/${playerSlug(owner)}/${playerSlug(opponent)}`)

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
                    className={`col-num hs-cell${winning ? ' hs-up' : ''}${losing ? ' hs-down' : ''}`}
                  >
                    {/* A pair who have never met have no matchup to open, so
                        that cell stays a dash rather than a button onto an
                        empty page. */}
                    {played === 0 ? (
                      <span className="hs-none">—</span>
                    ) : (
                      <button
                        type="button"
                        className="hs-h2h"
                        onClick={() => open(owner, opponent)}
                      >
                        <span aria-hidden="true">{recordLabel(record)}</span>
                        <span className="sr-only">
                          {owner} against {opponent}, {recordLabel(record)} — open the matchup
                        </span>
                      </button>
                    )}
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

/**
 * @param {string} section  which of the three views is showing, read off the
 *   hash rather than held here — so a matchup opened from the grid comes back
 *   to the grid rather than to the all-time table.
 */
export default function HistoryPage({ section = 'all-time', onOpen }) {
  const showing = SECTIONS.some((entry) => entry.id === section) ? section : 'all-time'
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
                  className={`hs-tab${showing === entry.id ? ' is-on' : ''}`}
                  aria-pressed={showing === entry.id}
                  // Replaced rather than pushed: the tabs are one page being
                  // read three ways, not three places you have been, and back
                  // out of the last one should leave the history sheet.
                  onClick={() => onOpen(`history-sheet/${entry.id}`, { replace: true })}
                >
                  {entry.label}
                </button>
              ))}
            </nav>

            {showing === 'all-time' && <AllTime rows={table} />}
            {showing === 'h2h' && (
              <HeadToHead owners={owners} records={records} onOpen={onOpen} />
            )}
            {showing === 'weeks' && <BestWeeks players={history.topPlayers} />}

          </>
        )}
      </div>
    </div>
  )
}
