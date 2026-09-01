import { useMemo } from 'react'
import { useHistory, useLeague } from '../hooks/useEspn.js'
import { playerSlug } from '../lib/espn/draft.js'
import { awardsFor } from '../lib/history/awards.js'
import { managerProfile } from '../lib/history/manager.js'
import { portraitFor } from '../lib/portraits.js'
import stanLeeArt from '../assets/awards/stan-lee.webp'
import './comic.css'
import './ManagerPage.css'

function firstName(name) {
  return String(name ?? '').split(/\s+/)[0] || 'Manager'
}

function initials(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

/** A number in its own panel: label on the ink bar, figure on the paper. */
function Stat({ label, value, note }) {
  return (
    <div className="mp-stat">
      <span className="mp-stat-label">{label}</span>
      <span className="mp-stat-value">{value}</span>
      {note && <span className="mp-stat-note">{note}</span>}
    </div>
  )
}

/**
 * A count sat inside a football.
 *
 * Drawn as one path rather than an image so it takes the page's ink colour and
 * stays sharp at any size.
 */
function Football({ label, value }) {
  return (
    <div className="mp-ball">
      <svg className="mp-ball-art" viewBox="0 0 120 78" role="img" aria-label={`${value} ${label}`}>
        <path
          d="M60 3C89 3 117 21 117 39C117 57 89 75 60 75C31 75 3 57 3 39C3 21 31 3 60 3Z"
          fill="var(--paper)"
          stroke="var(--ink)"
          strokeWidth="5"
        />
        {/* The seams at each end, as on a real one. */}
        <path d="M13 25V53M107 25V53" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
        <text x="60" y="41" className="mp-ball-value" dominantBaseline="central" textAnchor="middle">
          {value}
        </text>
      </svg>
      <span className="mp-ball-label">{label}</span>
    </div>
  )
}

/** The artwork each award is presented with, by the id in awards.js. */
const AWARD_ART = { 'stan-lee': stanLeeArt }

/**
 * An award the league gave out by hand.
 *
 * Only shown to the managers who have one, so the shelf is never an empty
 * cabinet — a profile without awards simply doesn't have this section.
 */
function Award({ award }) {
  return (
    <li className="mp-award">
      {AWARD_ART[award.id] && (
        // Decorative: the award is named beside it.
        <img className="mp-award-art" src={AWARD_ART[award.id]} alt="" />
      )}
      <span className="mp-award-text">
        <span className="mp-award-name">{award.name}</span>
        <span className="mp-award-when">
          {award.seasons.length > 0
            ? award.seasons.join(' · ')
            : award.count > 1 ? `Won ${award.count} times` : 'Winner'}
        </span>
      </span>
    </li>
  )
}

const PLACE_COLOURS = { 1: '#ffc61a', 2: '#ccd1d7', 3: '#c9813f' }

/**
 * Where they finished, season by season.
 *
 * Drawn rather than charted with a library: it is ten rows and a handful of
 * points, and the axis runs the wrong way up — first place at the top — which
 * is most of what a chart library would be asked to undo.
 */
export function CareerFinishes({ finishes, places = 10 }) {
  const width = 620
  const height = 340
  const pad = { top: 46, right: 24, bottom: 16, left: 46 }
  const DOT = 18

  const rows = Array.from({ length: places }, (_, i) => i + 1)
  const step = (height - pad.top - pad.bottom) / (places - 1)
  const y = (rank) => pad.top + (rank - 1) * step

  // The plot is inset by a dot's width at each end, so the first and last
  // seasons sit clear of the axis numbers rather than half on top of them.
  const plotLeft = pad.left + DOT + 6
  const plotRight = width - pad.right - DOT
  const span = finishes.length > 1 ? (plotRight - plotLeft) / (finishes.length - 1) : 0
  const x = (index) =>
    finishes.length > 1 ? plotLeft + index * span : (plotLeft + plotRight) / 2

  const line = finishes.map((entry, i) => `${x(i)},${y(entry.rank)}`).join(' ')

  return (
    <svg
      className="mp-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={finishes.map((entry) => `${entry.season}: finished ${entry.rank}`).join('. ')}
    >
      {rows.map((rank) => (
        <g key={rank}>
          <line
            x1={pad.left} y1={y(rank)} x2={width - pad.right} y2={y(rank)}
            stroke="rgba(0,0,0,0.14)" strokeWidth="2"
          />
          <text x={pad.left - 10} y={y(rank)} className="mp-axis" dominantBaseline="central" textAnchor="end">
            {rank}
          </text>
        </g>
      ))}

      {finishes.map((entry, i) => (
        <text key={entry.season} x={x(i)} y={pad.top - 28} className="mp-year" textAnchor="middle">
          {entry.season}
        </text>
      ))}

      {finishes.length > 1 && (
        <polyline
          points={line} fill="none" stroke="var(--ink)" strokeWidth="4"
          strokeDasharray="8 8" strokeLinecap="round"
        />
      )}

      {finishes.map((entry, i) => (
        <g key={entry.season}>
          <circle
            cx={x(i)} cy={y(entry.rank)} r={DOT}
            fill={PLACE_COLOURS[entry.rank] ?? 'var(--ink)'}
            stroke="var(--ink)" strokeWidth="4"
          />
          <text
            x={x(i)} y={y(entry.rank)} className="mp-dot" dominantBaseline="central"
            textAnchor="middle" fill={entry.rank <= 3 ? 'var(--ink)' : 'var(--paper)'}
          >
            {entry.rank}
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function ManagerPage({ slug }) {
  const { data: history, error, isLoading, refresh } = useHistory()
  const { data: league } = useLeague()

  // The slug names the manager; the history knows who that is.
  const name = useMemo(() => {
    const names = (history?.owners ?? []).map((owner) => owner.name)
    return names.find((entry) => playerSlug(entry) === slug) ?? null
  }, [history, slug])

  const profile = useMemo(
    () => (history && name ? managerProfile(history, name) : null),
    [history, name],
  )

  // The team they are running now, which only the current season knows.
  const teamName = useMemo(
    () => (league?.managers ?? []).find((manager) => manager.name === name)?.teamName ?? null,
    [league, name],
  )

  const portrait = portraitFor(name)
  const places = league?.settings?.size || 10
  const awards = useMemo(() => awardsFor(name), [name])

  return (
    <div className="page-shell is-manager">
      <div className="page-inner">
        <header className="page-head">
          <div className="title-block">
            <h1 className="title">{profile ? firstName(profile.name) : 'Manager'}</h1>
            <p className="page-sub">
              {profile ? (
                <>
                  <span>{teamName ?? profile.name}</span>
                  <span className="sub-sep" aria-hidden="true">·</span>
                  <span>
                    {profile.seasonCount} {profile.seasonCount === 1 ? 'season' : 'seasons'}
                  </span>
                </>
              ) : (
                <span>The file</span>
              )}
            </p>
          </div>
        </header>

        {error && (
          <div className="state state-error" role="alert">
            <p className="state-title">Couldn’t load this manager.</p>
            <p className="state-detail">{error.message}</p>
            <button type="button" className="retry" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && !profile && (
          <p className="state">No manager by that name has played in this league.</p>
        )}

        {profile && (
          <>
            {/* Cells are separated by the card's own background showing through
                the gap, so the dividers survive them rewrapping on a phone. */}
            <div className="mp-card">
              <div className="mp-cell mp-cell-face">
                {portrait ? (
                  <img className="mp-face" src={portrait} alt="" />
                ) : (
                  <span className="mp-face mp-face-empty" aria-hidden="true">
                    {initials(profile.name)}
                  </span>
                )}
                <span className="sr-only">{profile.name}</span>
              </div>

              <div className="mp-cell mp-cell-honours">
                <Stat label="Championships" value={profile.titles} />
                <Stat label="Playoff runs" value={profile.playoffAppearances} />
                <Stat label="Playoff record" value={profile.playoffLabel} />
              </div>
            </div>

            {awards.length > 0 && (
              <ol className="mp-awards">
                {awards.map((award) => (
                  <Award key={award.id} award={award} />
                ))}
              </ol>
            )}

            <h2 className="title mp-section">Career Stats</h2>

            <div className="mp-career">
              <Stat label="Record" value={profile.recordLabel} />
              <Stat
                label="Winning %"
                value={`${(profile.winPct * 100).toFixed(1)}%`}
                // Retired managers aren't ranked against a league they're no
                // longer in, so there is nothing to say here for them.
                note={profile.rank ? `Rank #${profile.rank}` : null}
              />
              <div className="mp-balls">
                <Football label="#1 weeks" value={profile.topWeeks} />
                <Football label={`#${places} weeks`} value={profile.bottomWeeks} />
              </div>
            </div>

            <div className="table-wrap mp-table-wrap">
              <table className="mp-seasons">
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col">W–L</th>
                    <th scope="col">Playoffs</th>
                    <th scope="col" className="mp-num">Avg PF</th>
                    <th scope="col" className="mp-num">Avg PA</th>
                    <th scope="col" className="mp-num">Finish</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.seasons.map((season) => (
                    <tr key={season.season}>
                      <td className="mp-year-cell">{season.season}</td>
                      <td className="mp-record">
                        {season.wins}–{season.losses}
                        {season.ties > 0 && `–${season.ties}`}
                      </td>
                      <td>
                        {season.madePlayoffs ? (
                          <span className="mp-yes">
                            <span aria-hidden="true">Made it</span>
                            <span className="sr-only">made the playoffs</span>
                          </span>
                        ) : (
                          <span className="mp-no" aria-label="missed the playoffs">—</span>
                        )}
                      </td>
                      <td className="mp-num">{season.pointsForPerGame.toFixed(1)}</td>
                      <td className="mp-num">{season.pointsAgainstPerGame.toFixed(1)}</td>
                      <td className="mp-num">
                        {season.finish ? (
                          <span
                            className={`rank-badge${season.finish <= 3 ? ` rank-${season.finish}` : ''}`}
                          >
                            {season.finish}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {profile.finishes.length > 0 && (
              <>
                <h2 className="title mp-section">Career Finishes</h2>
                <div className="mp-chart-wrap">
                  <CareerFinishes finishes={profile.finishes} places={places} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
