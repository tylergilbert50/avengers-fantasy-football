import { useDraft } from '../hooks/useEspn.js'
import './comic.css'
import './DraftPage.css'

/**
 * Artwork for the number-one picks, keyed by the same slug the API sends.
 *
 * Resolved by scanning the folder rather than by an import list, so dropping
 * `jamarr-chase.webp` into src/assets/draft-picks/ is the whole job — no code
 * to touch, and a player with no file simply renders without art.
 */
const PICK_ART = Object.fromEntries(
  Object.entries(
    import.meta.glob('../assets/draft-picks/*.{webp,png,jpg,jpeg}', {
      eager: true,
      import: 'default',
    }),
  ).map(([path, src]) => [path.split('/').pop().replace(/\.[^.]+$/, ''), src]),
)

function DraftPick({ pick, className = '' }) {
  return (
    <div className={`dp-pick ${className}`}>
      <span className="dp-slot">{pick.label}</span>
      <span className="dp-player">
        {pick.player}
        {pick.position && <span className="dp-pos">{pick.position}</span>}
      </span>
      <span className="dp-manager">{pick.manager}</span>
    </div>
  )
}

/** One season's board: the headline pick, then the first round. */
export function DraftSeason({ draft }) {
  const top = draft.topPick
  const art = top ? PICK_ART[top.slug] : null

  return (
    <section className="dp-season">
      <header className="dp-head">
        <h2 className="dp-year">{draft.season}</h2>
        <p className="dp-meta">
          {draft.rounds} rounds · {draft.pickCount} picks
        </p>
      </header>

      {top && (
        <div className="dp-hero">
          {/* Art is decorative — the pick is spelled out beside it. */}
          {art ? (
            <img className="dp-art" src={art} alt="" />
          ) : (
            <span className="dp-art dp-art-empty" aria-hidden="true">
              {top.position || '1.01'}
            </span>
          )}
          <div className="dp-hero-text">
            <span className="dp-hero-label">First overall</span>
            <span className="dp-hero-player">{top.player}</span>
            <span className="dp-hero-manager">taken by {top.manager}</span>
          </div>
        </div>
      )}

      <div className="dp-round">
        <h3 className="dp-round-title">Round 1</h3>
        {draft.firstRound.map((pick) => (
          <DraftPick key={pick.overall} pick={pick} />
        ))}
      </div>

      {/* Round 1 only. Six seasons of full boards is a thousand rows, and the
          first round is the part anyone re-reads — the rest is on ESPN, which
          is what the recap link below is for. */}

      {draft.recapUrl && (
        <a className="dp-recap" href={draft.recapUrl} target="_blank" rel="noreferrer noopener">
          {draft.season} draft recap on ESPN
        </a>
      )}
    </section>
  )
}

export default function DraftPage({ onBack }) {
  const { data, error, isLoading, refresh } = useDraft()
  const drafts = data?.drafts ?? []

  return (
    <div className="page-shell is-draft">
      <div className="page-inner">
        <header className="page-head">
          <button type="button" className="back" onClick={onBack}>
            <span className="back-arrow" aria-hidden="true" />
            Back
          </button>
          <div className="title-block">
            <h1 className="title">Draft History</h1>
            <p className="page-sub">
              {drafts.length ? (
                <>
                  <span>{data.leagueName ?? 'League'}</span>
                  <span className="sub-sep" aria-hidden="true">·</span>
                  <span>
                    {drafts.length === 1
                      ? drafts[0].season
                      : `${drafts[drafts.length - 1].season}–${drafts[0].season}`}
                  </span>
                </>
              ) : (
                <span>Every draft</span>
              )}
            </p>
          </div>
        </header>

        {isLoading && <p className="state">Opening the draft room…</p>}

        {error && (
          <div className="state state-error" role="alert">
            <p className="state-title">Couldn’t load the drafts.</p>
            <p className="state-detail">{error.message}</p>
            <button type="button" className="retry" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && drafts.length === 0 && (
          <p className="state">No completed drafts yet.</p>
        )}

        {drafts.map((draft) => (
          <DraftSeason key={draft.season} draft={draft} />
        ))}
      </div>
    </div>
  )
}
