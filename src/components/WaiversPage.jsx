import { useCallback, useMemo, useState } from 'react'
import { useWaivers } from '../hooks/useEspn.js'
import './comic.css'
import './WaiversPage.css'

/** Stable empties, so the season filter's memo isn't re-run on every render. */
const NO_PICKUPS = []
const NO_SEASONS = []

function points(value) {
  return Number(value ?? 0).toFixed(1)
}

function money(value) {
  return `$${Math.round(Number(value) || 0)}`
}

function percent(value) {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

/**
 * The activity columns. Manager stays put; everything else sorts.
 *
 * Adds, drops and FAAB are ESPN's own counts and are complete. "Best" comes
 * from the reconstructed pickup list, so it sorts on the points rather than the
 * name — and is blank for a manager whose pickups all went unstarted.
 */
const COLUMNS = [
  { key: 'adds', label: 'Adds', value: (row) => row.adds },
  { key: 'drops', label: 'Drops', value: (row) => row.drops },
  { key: 'spent', label: 'FAAB', value: (row) => row.spent, hint: 'Total FAAB spent across every season played.' },
  {
    key: 'spentPct',
    label: 'Used',
    value: (row) => row.spentPct,
    hint: 'Share of the budgets they were given, so a short career isn’t flattered.',
  },
  {
    key: 'bestPickup',
    label: 'Best pickup',
    value: (row) => row.bestPickup?.points ?? null,
    align: 'left',
  },
]

/**
 * The pickup columns. All five sort, including the two names — grouping the
 * list by manager is half of what anyone opens it to do.
 */
const PICKUP_COLUMNS = [
  { key: 'week', label: 'Week', value: (row) => row.week },
  { key: 'player', label: 'Player', value: (row) => row.player, type: 'text', align: 'left' },
  { key: 'points', label: 'Points', value: (row) => row.points },
  { key: 'started', label: 'Starts', value: (row) => row.started },
  { key: 'manager', label: 'Manager', value: (row) => row.manager, type: 'text', align: 'left' },
]

const DEFAULT_SORT = { key: 'adds', direction: 'desc' }
const DEFAULT_PICKUP_SORT = { key: 'points', direction: 'desc' }

/**
 * Where a header click lands.
 *
 * Clicking the sorted column flips it; a fresh one opens the way round that
 * reads as an answer — most first for a number, A–Z for a name.
 */
function nextSort(current, key, columns) {
  if (current.key === key) {
    return { key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
  }
  const column = columns.find((entry) => entry.key === key)
  return { key, direction: column?.type === 'text' ? 'asc' : 'desc' }
}

/**
 * Sorts a table's rows.
 *
 * `tiebreak` is fixed rather than reversed with the column, so rows that draw
 * still come out in a defensible order instead of however the array happened to
 * be built.
 */
function sortRows({ rows, columns, sort, tiebreak }) {
  const column = columns.find((entry) => entry.key === sort.key)
  if (!column) return rows
  const factor = sort.direction === 'asc' ? 1 : -1

  return [...rows].sort((a, b) => {
    const left = column.value(a)
    const right = column.value(b)

    // Nothing to rank sits at the bottom either way round.
    if (left == null && right == null) return 0
    if (left == null) return 1
    if (right == null) return -1

    const compared =
      column.type === 'text' ? String(left).localeCompare(String(right)) : left - right
    if (compared !== 0) return compared * factor
    return tiebreak(a, b)
  })
}

/**
 * A sortable column heading.
 *
 * A real button inside the `th` so it is reachable by keyboard and announced as
 * pressable, with `aria-sort` left on the cell where screen readers look for it.
 */
function SortHeader({ column, sort, onSort }) {
  const active = sort.key === column.key
  const left = column.align === 'left'

  return (
    <th
      scope="col"
      className={left ? '' : 'wv-num'}
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className={`wv-sort${left ? ' is-left' : ''}${active ? ' is-active' : ''}${active && sort.direction === 'asc' ? ' is-asc' : ''}`}
        onClick={() => onSort(column.key)}
        title={column.hint}
      >
        {column.label}
        {column.hint && <span className="sr-only"> — {column.hint}</span>}
        <span className="wv-sort-arrow" aria-hidden="true" />
      </button>
    </th>
  )
}

function StatsTable({ stats, sort, onSort }) {
  const rows = useMemo(
    () =>
      sortRows({
        rows: stats,
        columns: COLUMNS,
        sort,
        tiebreak: (a, b) => b.adds - a.adds || b.spent - a.spent || a.manager.localeCompare(b.manager),
      }),
    [stats, sort],
  )

  return (
    <div className="table-wrap wv-table-wrap">
      <table className="wv-table">
        <caption className="sr-only">
          Waiver activity by manager. Every column but the name can be sorted.
        </caption>
        <thead>
          <tr>
            <th scope="col">Manager</th>
            {COLUMNS.map((column) => (
              <SortHeader key={column.key} column={column} sort={sort} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.manager}>
              <th scope="row" className="wv-name">{row.manager}</th>
              <td className="wv-num">{row.adds}</td>
              <td className="wv-num wv-dim">{row.drops}</td>
              <td className="wv-num">{money(row.spent)}</td>
              <td className="wv-num">{percent(row.spentPct)}</td>
              <td className="wv-best">
                {row.bestPickup ? (
                  <>
                    <span className="wv-best-player">{row.bestPickup.player}</span>
                    <span className="wv-best-line">
                      {points(row.bestPickup.points)} · {row.bestPickup.season} week {row.bestPickup.week}
                    </span>
                  </>
                ) : (
                  <span className="wv-dim">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Highlights({ highlights }) {
  const { bestPickup, biggestSpender, busiest } = highlights ?? {}
  const cards = [
    bestPickup && {
      key: 'best',
      label: 'Best pickup',
      value: bestPickup.player,
      detail: `${points(bestPickup.points)} for ${bestPickup.manager} · ${bestPickup.season} week ${bestPickup.week}`,
    },
    busiest && {
      key: 'busy',
      label: 'Most active',
      value: busiest.manager,
      detail: `${busiest.adds} adds`,
    },
    biggestSpender && {
      key: 'spender',
      label: 'Biggest spender',
      value: biggestSpender.manager,
      detail: `${money(biggestSpender.spent)} · ${percent(biggestSpender.spentPct)} of budget`,
    },
  ].filter(Boolean)

  if (!cards.length) return null

  return (
    <div className="wv-highlights">
      {cards.map((card) => (
        <div key={card.key} className="wv-highlight">
          <span className="wv-highlight-label">{card.label}</span>
          <span className="wv-highlight-value">{card.value}</span>
          <span className="wv-highlight-detail">{card.detail}</span>
        </div>
      ))}
    </div>
  )
}

function PickupTable({ pickups, sort, onSort }) {
  const rows = useMemo(
    () =>
      sortRows({
        rows: pickups,
        columns: PICKUP_COLUMNS,
        sort,
        tiebreak: (a, b) => b.points - a.points || a.player.localeCompare(b.player),
      }),
    [pickups, sort],
  )

  return (
    <div className="table-wrap wv-table-wrap">
      <table className="wv-table wv-pickups">
        <caption className="sr-only">Waiver pickups. Every column can be sorted.</caption>
        <thead>
          <tr>
            {PICKUP_COLUMNS.map((column) => (
              <SortHeader key={column.key} column={column} sort={sort} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((pickup) => (
            <tr key={pickup.id}>
              <td className="wv-num wv-dim">{pickup.week}</td>
              <th scope="row" className="wv-name">{pickup.player}</th>
              <td className="wv-num wv-points">{points(pickup.points)}</td>
              <td className="wv-num wv-dim">{pickup.started}</td>
              <td className="wv-manager">{pickup.manager}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function WaiversPage({ onBack }) {
  const { data, error, isLoading, refresh } = useWaivers()

  // Null until someone picks, so the page can open on the newest season without
  // a first paint showing the wrong one.
  const [chosen, setChosen] = useState(null)
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [pickupSort, setPickupSort] = useState(DEFAULT_PICKUP_SORT)

  const toggleSort = useCallback((key) => setSort((current) => nextSort(current, key, COLUMNS)), [])
  const togglePickupSort = useCallback(
    (key) => setPickupSort((current) => nextSort(current, key, PICKUP_COLUMNS)),
    [],
  )

  const pickups = data?.pickups ?? NO_PICKUPS
  const seasons = data?.seasons ?? NO_SEASONS
  const season = chosen ?? (seasons.length ? String(seasons[0]) : 'all')

  const shown = useMemo(
    () => (season === 'all' ? pickups : pickups.filter((pickup) => pickup.season === Number(season))),
    [pickups, season],
  )

  return (
    <div className="page-shell is-waivers">
      <div className="page-inner">
        <header className="page-head">
          <button type="button" className="back" onClick={onBack}>
            <span className="back-arrow" aria-hidden="true" />
            Back
          </button>
          <div className="title-block">
            <h1 className="title">Waiver History</h1>
            <p className="page-sub">
              {seasons.length ? (
                <>
                  <span>{data.highlights.totalAdds} adds</span>
                  <span className="sub-sep" aria-hidden="true">·</span>
                  <span>{money(data.highlights.totalSpent)} spent</span>
                  <span className="sub-sep" aria-hidden="true">·</span>
                  <span>
                    {seasons[seasons.length - 1]}–{seasons[0]}
                  </span>
                </>
              ) : (
                <span>Every pickup ever made</span>
              )}
            </p>
          </div>
        </header>

        {isLoading && <p className="state">Checking the wire…</p>}

        {error && (
          <div className="state state-error" role="alert">
            <p className="state-title">Couldn’t load the waiver history.</p>
            <p className="state-detail">{error.message}</p>
            <button type="button" className="retry" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && seasons.length === 0 && (
          <p className="state">No waiver activity on record yet.</p>
        )}

        {seasons.length > 0 && (
          <>
            <Highlights highlights={data.highlights} />

            <section className="wv-section">
              <StatsTable stats={data.stats} sort={sort} onSort={toggleSort} />
            </section>

            <section className="wv-section">
              <div className="wv-section-head">
                <h2 className="wv-heading">
                  {season === 'all' ? 'Every pickup' : `${season} pickups`}
                </h2>
                <div className="wv-filter">
                  <label className="sr-only" htmlFor="wv-season">Season</label>
                  <select
                    id="wv-season"
                    className="wv-select"
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

              {shown.length > 0 ? (
                <PickupTable pickups={shown} sort={pickupSort} onSort={togglePickupSort} />
              ) : (
                <p className="state">Nothing started off the wire that season.</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
