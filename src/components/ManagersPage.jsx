import { useMemo } from 'react'
import { useLeague } from '../hooks/useEspn.js'
import { playerSlug } from '../lib/espn/draft.js'
import { portraitFor } from '../lib/portraits.js'
import './comic.css'
import './ManagersPage.css'

/** "Brett Gilbert" -> "Brett". The league calls each other by first name. */
function firstName(name) {
  return String(name ?? '').split(/\s+/)[0] || 'Unknown'
}

/** "Brett Gilbert" -> "BG", for a manager with no portrait on file. */
function initials(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export function ManagerCard({ manager, onOpen }) {
  const portrait = portraitFor(manager.name)

  return (
    <li className="mg-card">
      {/* The whole card is the target, portrait included — a name plate alone
          is a small thing to hit on a phone. */}
      <button
        type="button"
        className="mg-open"
        onClick={() => onOpen(`managers/${playerSlug(manager.name)}`)}
      >
        {portrait ? (
          // Decorative: the name is right underneath in real text.
          <img className="mg-face" src={portrait} alt="" />
        ) : (
          <span className="mg-face mg-face-empty" aria-hidden="true">
            {initials(manager.name)}
          </span>
        )}
        <span className="mg-name">{firstName(manager.name)}</span>
        {/* The full name and the team are what tell two Gilberts apart. */}
        <span className="sr-only">
          {manager.name}
          {manager.teamName ? `, ${manager.teamName}` : ''}
        </span>
      </button>
    </li>
  )
}

export default function ManagersPage({ onOpen }) {
  const { data, error, isLoading, refresh } = useLeague()

  // Whoever has a team this season, A to Z by the name they go by — so the
  // wall keeps itself up to date as managers come and go.
  const managers = useMemo(
    () =>
      (data?.managers ?? [])
        .filter((manager) => manager.teamId != null)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  )

  return (
    <div className="page-shell is-managers">
      <div className="page-inner">
        <header className="page-head">
          <div className="title-block">
            <h1 className="title">Managers</h1>
            <p className="page-sub">
              {managers.length > 0 ? (
                <>
                  <span>{data.settings?.name ?? 'League'}</span>
                  <span className="sub-sep" aria-hidden="true">·</span>
                  <span>{managers.length} managers</span>
                </>
              ) : (
                <span>The league</span>
              )}
            </p>
          </div>
        </header>

        {/* The dashed rule from the artwork, drawn rather than imported. */}
        <div className="mg-rule" aria-hidden="true" />

        {isLoading && <p className="state">Rounding everyone up…</p>}

        {error && (
          <div className="state state-error" role="alert">
            <p className="state-title">Couldn’t load the managers.</p>
            <p className="state-detail">{error.message}</p>
            <button type="button" className="retry" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {managers.length > 0 && (
          <ol className="mg-wall">
            {managers.map((manager) => (
              <ManagerCard key={manager.id} manager={manager} onOpen={onOpen} />
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
