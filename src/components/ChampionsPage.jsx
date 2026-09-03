import { useChampions } from '../hooks/useEspn.js'
import hammerImg from '../assets/hammer.webp'
import { portraitFor } from '../lib/portraits.js'
import './comic.css'
import './ChampionsPage.css'

/**
 * Championship comic covers, keyed by the season they were cut for —
 * src/assets/champion-covers/2024-800.webp is 2024's. A season can ship one
 * file (2024.webp) or the same artwork at several widths (2024-200.webp,
 * 2024-400.webp, 2024-800.webp), which become a srcset so a desktop at 1x
 * downloads a cover already its own size instead of asking the browser to
 * squeeze a 800px scan into 190px — the squeeze is what looked pixelated.
 * Seasons whose cover hasn't been drawn yet fall back to a blank issue, so the
 * shelf stays full.
 */
const COVERS = (() => {
  const shelf = {}

  for (const [path, src] of Object.entries(
    import.meta.glob('../assets/champion-covers/*.{webp,png,jpg,jpeg}', {
      eager: true,
      import: 'default',
    }),
  )) {
    const name = path.split('/').pop().replace(/\.[^.]+$/, '')
    const [, season, width] = /^(\d{4})(?:-(\d+))?$/.exec(name) ?? []
    if (!season) continue
    ;(shelf[season] ??= []).push({ src, width: Number(width) || 0 })
  }

  return Object.fromEntries(
    Object.entries(shelf).map(([season, files]) => {
      // Widest last: it is both the default src for a browser that ignores
      // srcset and the top of the ladder for one that doesn't.
      const sized = files.filter((f) => f.width).sort((a, b) => a.width - b.width)
      const widest = sized.at(-1) ?? files[0]
      return [
        season,
        {
          src: widest.src,
          srcSet: sized.length > 1 ? sized.map((f) => `${f.src} ${f.width}w`).join(', ') : undefined,
        },
      ]
    }),
  )
})()

/* What a cover actually measures on screen, so the browser can pick a width
   before it knows the layout: two to a row on a phone, three on a tablet, and
   a fifth of the 66rem shelf — about 190px — on a desktop. */
const COVER_SIZES = '(max-width: 560px) 45vw, (max-width: 900px) 30vw, 190px'

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
        <img
          className="ch-cover"
          src={cover.src}
          srcSet={cover.srcSet}
          sizes={COVER_SIZES}
          alt=""
        />
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

export default function ChampionsPage() {
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

        {error && (
          <div className="state state-error" role="alert">
            <p className="state-title">Couldn’t load the champions.</p>
            <p className="state-detail">{error.message}</p>
            <button type="button" className="retry" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {/* No loading line: the shelf is warmed during the arrival, so it is
            all but always drawn from the cache the moment the page opens. On
            the rare cold read the header stands on its own for a beat, which
            reads better than a page that announces it is working. */}
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
