import { useMemo } from 'react'
import { useHistory } from '../hooks/useEspn.js'
import { playerSlug } from '../lib/espn/draft.js'
import { headToHeadSeries } from '../lib/history/matchup.js'
import { portraitFor } from '../lib/portraits.js'
import './comic.css'
import './HeadToHeadPage.css'

/** "Brett Gilbert" -> "BG", for a manager with no portrait on file. */
function initials(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

/**
 * What to call the two of them.
 *
 * First names, the way the league does — unless that would print the same word
 * twice, which in a league with two Gilberts it nearly does. A pairing that
 * collides falls back to both full names rather than to one of them.
 */
function labelsFor(nameA, nameB) {
  const first = (name) => String(name ?? '').split(/\s+/)[0] || 'Manager'
  const [a, b] = [first(nameA), first(nameB)]
  return a.toLowerCase() === b.toLowerCase() ? [nameA, nameB] : [a, b]
}

/** "2022 · wk 4" — when a game happened, in the space a note has. */
function when(entry) {
  return entry ? `${entry.season} · wk ${entry.week}` : null
}

function points(value, places = 1) {
  return value == null ? '—' : value.toFixed(places)
}

/**
 * The burst the two corners meet in.
 *
 * Drawn as one polygon rather than an image so it takes the page's ink and gold
 * and stays sharp at any size, the same way the footballs on a manager's page
 * do.
 */
function VersusBurst() {
  const spikes = 14
  const outline = Array.from({ length: spikes * 2 }, (_, i) => {
    const radius = i % 2 ? 30 : 47
    const angle = (Math.PI * i) / spikes - Math.PI / 2
    return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`
  }).join(' ')

  return (
    <svg className="h2h-burst" viewBox="0 0 100 100" aria-hidden="true">
      <polygon
        points={outline}
        fill="var(--gold)"
        stroke="var(--ink)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <text x="50" y="51" className="h2h-burst-text" dominantBaseline="central" textAnchor="middle">
        VS
      </text>
    </svg>
  )
}

/**
 * One manager's corner: their face and their name, and nothing else.
 *
 * Every number on the page is a fact about the pair rather than about one of
 * them — the record between them is one figure, not two — so it all sits in the
 * middle or below. A corner only has to say who is standing in it.
 */
function Corner({ name, label }) {
  const portrait = portraitFor(name)

  return (
    <div className="h2h-corner">
      {portrait ? (
        // Decorative: the name is right underneath in real text.
        <img className="h2h-face" src={portrait} alt="" />
      ) : (
        <span className="h2h-face h2h-face-empty" aria-hidden="true">
          {initials(name)}
        </span>
      )}
      <span className="h2h-corner-name">{label}</span>
      <span className="sr-only">{name}</span>
    </div>
  )
}

/** A number in its own panel, borrowed from a manager's page. */
function Stat({ label, value, note }) {
  return (
    <div className="h2h-stat">
      <span className="h2h-stat-label">{label}</span>
      <span className="h2h-stat-value">{value}</span>
      {note && <span className="h2h-stat-note">{note}</span>}
    </div>
  )
}

export default function HeadToHeadPage({ pair }) {
  const { data: history, error, isLoading, refresh } = useHistory()

  // The slugs name the two managers; the history knows who they are. Retired
  // managers resolve too — a rivalry doesn't end when one of them leaves.
  const [nameA, nameB] = useMemo(() => {
    const owners = (history?.owners ?? []).map((owner) => owner.name)
    const find = (slug) => owners.find((name) => playerSlug(name) === slug) ?? null
    return [find(pair?.[0]), find(pair?.[1])]
  }, [history, pair])

  const series = useMemo(
    () => (history && nameA && nameB ? headToHeadSeries(history, nameA, nameB) : null),
    [history, nameA, nameB],
  )

  const [labelA, labelB] = labelsFor(nameA, nameB)
  const played = series?.played ?? 0

  /**
   * "Connor · 2021 wk 5" — who owns one of the series' figures, and when they
   * set it. A performance names its own side; a game names the side that won
   * it, which for a margin is the same question.
   */
  const credit = (entry) => {
    if (!entry) return null
    const side = entry.side ?? entry.won
    return `${side === 'a' ? labelA : labelB} · ${when(entry)}`
  }

  return (
    <div className="page-shell is-h2h">
      <div className="page-inner">
        <header className="page-head">
          <div className="title-block">
            <h1 className="title h2h-title">
              {nameA && nameB ? (
                <>
                  {labelA}
                  <span className="h2h-title-vs">vs</span>
                  {labelB}
                </>
              ) : (
                'Head to Head'
              )}
            </h1>
            <p className="page-sub">
              {played > 0 ? (
                <>
                  <span>
                    {series.seasons[0]}
                    {series.seasons.length > 1 ? `–${series.seasons.at(-1)}` : ''}
                  </span>
                  <span className="sub-sep" aria-hidden="true">·</span>
                  <span>Regular season</span>
                </>
              ) : (
                <span>Regular season</span>
              )}
            </p>
          </div>
        </header>

        {error && (
          <div className="state state-error" role="alert">
            <p className="state-title">Couldn’t load this matchup.</p>
            <p className="state-detail">{error.message}</p>
            <button type="button" className="retry" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && (!nameA || !nameB) && (
          <p className="state">That pairing isn’t two managers who have played in this league.</p>
        )}

        {series && (
          <>
            {/* Cells separated by the card's own black showing through the gap,
                so the dividers survive the card narrowing on a phone. */}
            <div className="h2h-card">
              <Corner name={nameA} label={labelA} />

              {/* The one number the whole page is about, read left to right in
                  the order the two of them are stood in. */}
              <div className="h2h-versus">
                <VersusBurst />
                <span className="h2h-tally" aria-hidden="true">
                  {series.a.wins}–{series.b.wins}
                  {series.a.ties > 0 && `–${series.a.ties}`}
                </span>
                <span className="sr-only">
                  {labelA} {series.a.recordLabel} against {labelB}
                </span>
              </div>

              <Corner name={nameB} label={labelB} />
            </div>

            {played === 0 && (
              <p className="state h2h-empty">
                These two have never met in a regular-season game.
              </p>
            )}
          </>
        )}

        {series && played > 0 && (
          <>
            <h2 className="title h2h-section">The Series</h2>

            {/* Every one of these belongs to the series rather than to one of
                them, so each says whose it is underneath rather than being
                printed twice, once per manager. */}
            <div className="h2h-stats">
              <Stat
                label="Highest score"
                value={points(series.highestScore?.points)}
                note={credit(series.highestScore)}
              />
              <Stat
                label="Meetings"
                value={played}
                note={`${series.seasons.length} ${series.seasons.length === 1 ? 'season' : 'seasons'}`}
              />
              <Stat
                label="Biggest margin"
                value={points(series.widest?.margin)}
                note={credit(series.widest)}
              />
              <Stat
                label="Lowest score"
                value={points(series.lowestScore?.points)}
                note={credit(series.lowestScore)}
              />
              <Stat
                label="Active streak"
                value={series.streak ? series.streak.count : '—'}
                note={
                  series.streak ? (series.streak.side === 'a' ? labelA : labelB) : 'they last drew'
                }
              />
              <Stat
                label="Lowest margin"
                value={points(series.closest?.margin)}
                note={credit(series.closest)}
              />
            </div>

            <h2 className="title h2h-section">Every Meeting</h2>

            <div className="table-wrap h2h-table-wrap">
              <table className="h2h-log">
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col">Wk</th>
                    <th scope="col" className="h2h-num">{labelA}</th>
                    <th scope="col" className="h2h-num">{labelB}</th>
                    <th scope="col" className="h2h-num">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {series.games.map((game) => (
                    <tr key={`${game.season}-${game.week}`}>
                      <td className="h2h-year-cell">{game.season}</td>
                      <td className="h2h-week-cell">{game.week}</td>
                      {/* The winning score is the heavier of the two and the
                          losing one steps back, so a result reads down the
                          column without a wash of colour behind it. */}
                      <td className={`h2h-num ${game.won === 'a' ? 'h2h-won' : 'h2h-lost'}`}>
                        {game.points.toFixed(1)}
                        {game.won === 'a' && <span className="sr-only"> — won</span>}
                      </td>
                      <td className={`h2h-num ${game.won === 'b' ? 'h2h-won' : 'h2h-lost'}`}>
                        {game.against.toFixed(1)}
                        {game.won === 'b' && <span className="sr-only"> — won</span>}
                      </td>
                      <td className="h2h-num h2h-margin">
                        {game.won === null ? 'tie' : game.margin.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
