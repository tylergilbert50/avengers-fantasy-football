import { useCallback, useMemo, useState } from 'react'
import { useTrades } from '../hooks/useEspn.js'
import './comic.css'
import './TradesPage.css'

/**
 * Shared empty fallbacks. A fresh `[]` on every render would be a new identity
 * each time, which is enough to re-run the season filter's memo forever.
 */
const NO_TRADES = []
const NO_SEASONS = []

/** "284.7" reads better than "284.70" on a page full of them. */
function points(value) {
  return Number(value ?? 0).toFixed(1)
}

function percent(value) {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

/** Signed, because the whole point of the column is which way it went. */
function net(value) {
  const rounded = Number(value ?? 0)
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${points(Math.abs(rounded))}`
}

/**
 * One side of a trade: who, what they got, and what it did for them.
 *
 * `outcome` drives the colouring — won, lost, or neither, which is what a FAAB
 * deal and a tie both are.
 */
function TradeSide({ side, outcome, showPoints }) {
  return (
    <div className={`th-side th-side-${outcome}`}>
      <div className="th-side-head">
        <span className="th-manager">{side.manager}</span>
        {showPoints && (
          <span className="th-points">
            {points(side.points)}
            <span className="th-points-unit">pts</span>
          </span>
        )}
      </div>

      {side.players.length > 0 ? (
        <ul className="th-players">
          {side.players.map((player) => (
            <li key={player.playerId} className="th-player">
              <span className="th-player-name">{player.player}</span>
              {showPoints && (
                <span className="th-player-line">
                  {points(player.points)} · {player.started} {player.started === 1 ? 'start' : 'starts'}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="th-faab">FAAB — amount not recorded</p>
      )}
    </div>
  )
}

function Trade({ trade }) {
  const winning = trade.scoreable && trade.winner != null
  const verdict = trade.isFaabDeal
    ? 'FAAB deal'
    : !trade.scoreable
      ? 'Not scored'
      : trade.winner == null
        ? 'Dead even'
        : `${trade.sides.find((side) => side.teamId === trade.winner)?.manager} by ${points(trade.margin)}`

  return (
    <article className={`th-trade${trade.isFaabDeal ? ' is-faab' : ''}`}>
      <header className="th-trade-head">
        <span className="th-when">
          {trade.season} · Week {trade.week}
        </span>
        <span className={`th-verdict${winning ? ' is-won' : ''}${trade.isFaabDeal ? ' is-faab' : ''}`}>
          {verdict}
        </span>
      </header>

      <div className="th-sides">
        {trade.sides.map((side) => (
          <TradeSide
            key={side.teamId}
            side={side}
            showPoints={!trade.isFaabDeal}
            outcome={
              !winning ? 'none' : side.teamId === trade.winner ? 'won' : 'lost'
            }
          />
        ))}
      </div>
    </article>
  )
}

/** The superlatives, as cover blurbs. */
function Highlights({ highlights }) {
  const { biggestFleecing: fleece, bestTrader, worstTrader, busiest } = highlights ?? {}
  const cards = [
    bestTrader && {
      key: 'best',
      label: 'Best trader',
      value: bestTrader.manager,
      detail: `${bestTrader.record} · ${percent(bestTrader.winPct)}`,
    },
    worstTrader && {
      key: 'worst',
      label: 'Worst trader',
      value: worstTrader.manager,
      detail: `${worstTrader.record} · ${percent(worstTrader.winPct)}`,
    },
    fleece && {
      key: 'fleece',
      label: 'Biggest fleecing',
      value: fleece.winner,
      detail: `${points(fleece.margin)} over ${fleece.loser} · ${fleece.season}`,
    },
    busiest && {
      key: 'busiest',
      label: 'Most active',
      value: busiest.manager,
      detail: `${busiest.trades} trades`,
    },
  ].filter(Boolean)

  if (!cards.length) return null

  return (
    <div className="th-highlights">
      {cards.map((card) => (
        <div key={card.key} className="th-highlight">
          <span className="th-highlight-label">{card.label}</span>
          <span className="th-highlight-value">{card.value}</span>
          <span className="th-highlight-detail">{card.detail}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * The sortable columns, in table order.
 *
 * `value` is what the column sorts on, which isn't always what it prints: W–L
 * is two numbers in one cell and sorts on wins, with fewer losses breaking the
 * tie below. Manager has no entry — the name column stays put, since sorting
 * the league alphabetically answers nothing anyone asked.
 */
const COLUMNS = [
  { key: 'record', label: 'W–L', value: (row) => row.won },
  { key: 'winPct', label: 'Win%', value: (row) => row.winPct },
  { key: 'net', label: 'Net pts', value: (row) => row.net },
  { key: 'trades', label: 'Trades', value: (row) => row.trades },
  {
    key: 'faabDeals',
    label: 'FAAB',
    value: (row) => row.faabDeals,
    // Which direction the column counts isn't guessable from four letters, and
    // the two directions are opposites.
    hint: 'Players bought for FAAB. Selling one for FAAB doesn’t count here.',
  },
]

/** Where the table opens: the league's own order, best trader first. */
const DEFAULT_SORT = { key: 'winPct', direction: 'desc' }

function sortStats(stats, { key, direction }) {
  const column = COLUMNS.find((entry) => entry.key === key)
  if (!column) return stats
  const factor = direction === 'asc' ? 1 : -1

  return [...stats].sort((a, b) => {
    const left = column.value(a)
    const right = column.value(b)

    // A manager with no decided trades has no win rate to rank, and belongs at
    // the bottom whichever way the column is pointing — flipping the sort
    // shouldn't promote the people it has nothing to say about.
    if (left == null && right == null) return 0
    if (left == null) return 1
    if (right == null) return -1

    if (left !== right) return (left - right) * factor
    // Fixed tie-breaks, so rows that draw on the sorted column still come out
    // in a stable, defensible order rather than however the array happened to be.
    return b.won - a.won || a.lost - b.lost || b.net - a.net || a.manager.localeCompare(b.manager)
  })
}

function StatsTable({ stats, sort, onSort, selected, onSelect }) {
  const rows = useMemo(() => sortStats(stats, sort), [stats, sort])

  return (
    <div className="table-wrap th-table-wrap">
      <table className="th-table">
        <caption className="sr-only">
          Trading record by manager. Every column but the name can be sorted, and
          picking a row filters the trades below to that manager.
        </caption>
        <thead>
          <tr>
            <th scope="col">Manager</th>
            {COLUMNS.map((column) => {
              const active = sort.key === column.key
              return (
                <th
                  key={column.key}
                  scope="col"
                  className="th-num"
                  // What tells a screen reader the column is sorted, and which
                  // way; the button below is what makes it operable.
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    type="button"
                    className={`th-sort${active ? ' is-active' : ''}${active && sort.direction === 'asc' ? ' is-asc' : ''}`}
                    onClick={() => onSort(column.key)}
                    title={column.hint}
                  >
                    {column.label}
                    {column.hint && <span className="sr-only"> — {column.hint}</span>}
                    <span className="th-sort-arrow" aria-hidden="true" />
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const active = selected === row.manager
            return (
              // The whole row is the target — the name is just where the cursor
              // naturally lands. Clicking the same manager again clears it.
              <tr
                key={row.manager}
                className={`th-row${active ? ' is-selected' : ''}`}
                onClick={() => onSelect(row.manager)}
              >
                <th scope="row" className="th-name">
                  {/* A real button so the row is reachable by keyboard and
                      announced as a toggle; its own click stops here rather
                      than bubbling to the row and undoing itself. */}
                  <button
                    type="button"
                    className="th-row-btn"
                    aria-pressed={active}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelect(row.manager)
                    }}
                  >
                    {row.manager}
                  </button>
                </th>
                <td className="th-num">{row.won + row.lost > 0 ? row.record : '—'}</td>
                <td className="th-num">{percent(row.winPct)}</td>
                <td className={`th-num th-net${row.net > 0 ? ' is-up' : row.net < 0 ? ' is-down' : ''}`}>
                  {net(row.net)}
                </td>
                <td className="th-num">{row.trades}</td>
                <td className="th-num th-dim">{row.faabDeals || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function TradesPage({ onBack }) {
  const { data, error, isLoading, refresh } = useTrades()

  // Null until someone picks: the page opens on the newest season with trades
  // in it, which isn't known until the data lands. Held this way rather than
  // set from an effect so there is no first paint showing the wrong season.
  const [chosen, setChosen] = useState(null)
  const [sort, setSort] = useState(DEFAULT_SORT)
  // Null when the list is showing everybody. Set by clicking a row in the
  // record table; clicking the same row again puts it back.
  const [manager, setManager] = useState(null)

  const toggleManager = useCallback((name) => {
    setManager((current) => (current === name ? null : name))
  }, [])

  // A fresh column starts on the way round that flatters it — most of these
  // read as "who has the most" — and clicking the one already sorted flips it.
  const toggleSort = useCallback((key) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
        : { key, direction: 'desc' },
    )
  }, [])

  const trades = data?.trades ?? NO_TRADES
  const seasons = data?.seasons ?? NO_SEASONS
  const season = chosen ?? (seasons.length ? String(seasons[0]) : 'all')
  const shown = useMemo(
    () =>
      trades.filter(
        (trade) =>
          (season === 'all' || trade.season === Number(season)) &&
          (manager == null || trade.sides.some((side) => side.manager === manager)),
      ),
    [trades, season, manager],
  )

  // "Daniel’s 2019 trades", "Every trade" — the heading has to follow both
  // filters or it claims more than the list underneath it is showing.
  const heading = manager
    ? `${manager}${manager.endsWith('s') ? '’' : '’s'} ${season === 'all' ? 'trades' : `${season} trades`}`
    : season === 'all'
      ? 'Every trade'
      : `${season} trades`

  return (
    <div className="page-shell is-trades">
      <div className="page-inner">
        <header className="page-head">
          <button type="button" className="back" onClick={onBack}>
            <span className="back-arrow" aria-hidden="true" />
            Back
          </button>
          <div className="title-block">
            <h1 className="title">Trade History</h1>
            <p className="page-sub">
              {trades.length ? (
                <>
                  <span>{data.highlights.totalTrades} trades</span>
                  <span className="sub-sep" aria-hidden="true">·</span>
                  <span>
                    {seasons[seasons.length - 1]}–{seasons[0]}
                  </span>
                </>
              ) : (
                <span>Every deal ever made</span>
              )}
            </p>
          </div>
        </header>

        {isLoading && <p className="state">Working the phones…</p>}

        {error && (
          <div className="state state-error" role="alert">
            <p className="state-title">Couldn’t load the trades.</p>
            <p className="state-detail">{error.message}</p>
            <button type="button" className="retry" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && trades.length === 0 && (
          <p className="state">No trades on record yet.</p>
        )}

        {trades.length > 0 && (
          <>
            <Highlights highlights={data.highlights} />

            <section className="th-section">
              <StatsTable
                stats={data.stats}
                sort={sort}
                onSort={toggleSort}
                selected={manager}
                onSelect={toggleManager}
              />
              <p className="th-table-hint">Tap a manager to see only their trades.</p>
            </section>

            <section className="th-section">
              <div className="th-section-head">
                {/* The heading follows the filter: "Every trade" over a single
                    season's worth of cards would be claiming too much. */}
                <h2 className="th-heading">{heading}</h2>
                <div className="th-filter">
                  {manager && (
                    <button
                      type="button"
                      className="th-clear"
                      onClick={() => setManager(null)}
                    >
                      {manager}
                      <span className="th-clear-x" aria-hidden="true">×</span>
                      <span className="sr-only"> — clear manager filter</span>
                    </button>
                  )}
                  <label className="sr-only" htmlFor="th-season">Season</label>
                  <select
                    id="th-season"
                    className="th-select"
                    value={season}
                    onChange={(event) => setChosen(event.target.value)}
                  >
                    <option value="all">All seasons</option>
                    {seasons.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              {shown.length === 0 ? (
                <p className="state">
                  {manager
                    ? `No trades for ${manager} in ${season === 'all' ? 'the record' : season}.`
                    : 'No trades that season.'}
                </p>
              ) : (
                <div className="th-list">
                  {shown.map((trade) => (
                    <Trade key={trade.id} trade={trade} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
