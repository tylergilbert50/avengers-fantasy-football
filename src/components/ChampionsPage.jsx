import { useChampions } from '../hooks/useEspn.js'
import hammerImg from '../assets/hammer.webp'
import { portraitFor } from '../lib/portraits.js'
import './comic.css'
import './ChampionsPage.css'

/**
 * Championship comic covers, keyed by the season they were cut for —
 * src/assets/champion-covers/2024.webp is 2024's. Seasons whose cover hasn't
 * been drawn yet fall back to a blank issue, so the shelf stays full.
 */
const COVERS = Object.fromEntries(
  Object.entries(
    import.meta.glob('../assets/champion-covers/*.{webp,png,jpg,jpeg}', {
      eager: true,
      import: 'default',
    }),
  ).map(([path, src]) => [path.split('/').pop().replace(/\.[^.]+$/, ''), src]),
)

/**
 * Confetti, thrown once here rather than randomly per render so it lands in the
 * same place every visit. Positions are percentages of the trophy card and hug
 * its edges, where a piece crossing the artwork can't hide a number or a name.
 */
const CONFETTI = [
  { left: '2%', top: '14%', rotate: -28, color: '#e8425f' },
  { left: '9%', top: '76%', rotate: 34, color: '#f0c000' },
  { left: '20%', top: '94%', rotate: -12, color: '#8b5cf6' },
  { left: '30%', top: '5%', rotate: 52, color: '#f0c000' },
  { left: '47%', top: '96%', rotate: -40, color: '#e8425f' },
  { left: '55%', top: '3%', rotate: 18, color: '#4aa3f0' },
  { left: '66%', top: '93%', rotate: -55, color: '#f0c000' },
  { left: '73%', top: '7%', rotate: 40, color: '#8b5cf6' },
  { left: '93%', top: '84%', rotate: -22, color: '#e8425f' },
  { left: '97%', top: '26%', rotate: 62, color: '#4aa3f0' },
]

/** "Brett Gilbert" -> "BG". The stand-in when there's no portrait on file. */
function initials(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function firstName(name) {
  return String(name ?? '').split(/\s+/)[0] || 'Champion'
}

/** One decimal, the way a weekly average is quoted. */
function points(value) {
  return Number.isFinite(value) ? value.toFixed(1) : '—'
}

/** The reigning champion, blown up: the trophy, the face, and the numbers. */
export function ChampionHero({ champion }) {
  const portrait = portraitFor(champion.manager)

  return (
    <div className="ch-hero">
      {/* The confetti is positioned against this frame rather than the whole
          hero, so its percentages mean the card and nothing below it. */}
      <div className="ch-card-frame">
        {CONFETTI.map((piece, i) => (
          <span
            key={i}
            className="ch-confetti"
            aria-hidden="true"
            style={{
              left: piece.left,
              top: piece.top,
              background: piece.color,
              transform: `rotate(${piece.rotate}deg)`,
            }}
          />
        ))}

        <div className="ch-card">
          <div className="ch-cell ch-cell-trophy">
            {/* The league's actual trophy. Decorative — the title above says
                what it is being handed for. */}
            <img className="ch-trophy" src={hammerImg} alt="" />
          </div>

          <div className="ch-cell ch-cell-face">
            {portrait ? (
              <img className="ch-portrait" src={portrait} alt="" />
            ) : (
              <span className="ch-portrait ch-portrait-empty" aria-hidden="true">
                {initials(champion.manager)}
              </span>
            )}
            <span className="ch-name">{firstName(champion.manager)}</span>
            <span className="ch-team">{champion.team.name}</span>
          </div>

          <div className="ch-cell ch-cell-stats">
            <h2 className="ch-stats-title">Statistics</h2>
            <dl className="ch-stats">
              <div className="ch-stat">
                <dt>Record</dt>
                {/* The regular season's, which is the joke: a champion can
                    arrive there from the seven seed with a losing record. */}
                <dd>{champion.record.label}</dd>
              </div>
              <div className="ch-stat">
                <dt>Points per week</dt>
                <dd>{points(champion.record.pointsPerWeek)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

/** One issue on the shelf: the cover cut for that title, and who it was for. */
export function ChampionCover({ champion }) {
  const cover = COVERS[String(champion.season)]

  return (
    <li className="ch-issue">
      {cover ? (
        // Decorative: the caption underneath carries the season, the team and
        // the manager as real text.
        <img className="ch-cover" src={cover} alt="" />
      ) : (
        <span className="ch-cover ch-cover-empty" aria-hidden="true">
          <span className="ch-cover-issue">Issue #{champion.issue}</span>
          <span className="ch-cover-mark">?</span>
          <span className="ch-cover-soon">Cover to come</span>
        </span>
      )}
      <div className="ch-issue-caption">
        <span className="ch-issue-year">{champion.season}</span>
        <span className="ch-issue-team">{champion.team.name}</span>
        <span className="ch-issue-manager">{champion.manager}</span>
      </div>
    </li>
  )
}

export default function ChampionsPage({ onBack }) {
  const { data, error, isLoading, refresh } = useChampions()
  const champions = data?.champions ?? []
  // The list arrives newest first, so the reigning champion is the headline and
  // the shelf below runs the other way — first title on the left.
  const [reigning] = champions
  const shelf = [...champions].reverse()

  return (
    <div className="page-shell is-champions">
      <div className="page-inner">
        <header className="page-head">
          <button type="button" className="back" onClick={onBack}>
            <span className="back-arrow" aria-hidden="true" />
            Back
          </button>
          <div className="title-block">
            <h1 className="title">{reigning ? `${reigning.season} Champion` : 'Champions'}</h1>
            <p className="page-sub">
              {reigning ? (
                <>
                  <span>{data.leagueName ?? 'League'}</span>
                  <span className="sub-sep" aria-hidden="true">·</span>
                  <span>{champions.length} titles awarded</span>
                </>
              ) : (
                <span>Every title ever won</span>
              )}
            </p>
          </div>
        </header>

        {isLoading && <p className="state">Polishing the trophy…</p>}

        {error && (
          <div className="state state-error" role="alert">
            <p className="state-title">Couldn’t load the champions.</p>
            <p className="state-detail">{error.message}</p>
            <button type="button" className="retry" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && champions.length === 0 && (
          <p className="state">No title has been settled yet.</p>
        )}

        {reigning && <ChampionHero champion={reigning} />}

        {shelf.length > 0 && (
          <section className="ch-past">
            <h2 className="title ch-past-title">Past Champions</h2>
            <ol className="ch-shelf">
              {shelf.map((champion) => (
                <ChampionCover key={champion.season} champion={champion} />
              ))}
            </ol>
          </section>
        )}

        {data?.missingSeasons?.length > 0 && (
          <p className="page-foot">{data.missingSeasons.join(', ')} unavailable</p>
        )}
      </div>
    </div>
  )
}
