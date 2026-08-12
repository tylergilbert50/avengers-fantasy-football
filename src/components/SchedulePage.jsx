import { useMemo } from 'react'
import { useLeague, useMatchups } from '../hooks/useEspn.js'
import { buildWeeks, keyDates, upcomingWeek, weekDateLabel } from '../lib/schedule/calendar.js'
import './comic.css'
import './SchedulePage.css'

/**
 * A moment in the reader's own timezone.
 *
 * The league sets its dates in Central, but a draft is somewhere to be at a
 * particular hour — so the hour shown is the reader's, the one their phone will
 * agree with. The league's zone is named once at the foot of the page.
 */
function momentLabel(iso, { withTime }) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(iso))
}

/** The dates the league sets itself, which ESPN knows nothing about. */
export function KeyDates({ dates }) {
  return (
    <ol className="sc-dates">
      {dates.map((entry) => (
        <li key={entry.id} className={`sc-date${entry.past ? ' is-past' : ''}`}>
          <span className="sc-date-label">{entry.label}</span>
          <span className="sc-date-when">
            {momentLabel(entry.at, { withTime: entry.hasTime })}
          </span>
          {/* Only once it has happened — there is nothing to say beforehand
              that the date itself doesn't already say. */}
          {entry.past && <span className="sc-date-note">Done</span>}
        </li>
      ))}
    </ol>
  )
}

/** One matchup. Scored once it has been played, a fixture until then. */
function Game({ game }) {
  if (game.isBye) {
    return (
      <li className="sc-game is-bye">
        <span className="sc-side">
          <span className="sc-team">{game.home?.name}</span>
          <span className="sc-manager">{game.home?.managerNames}</span>
        </span>
        <span className="sc-bye">Bye</span>
      </li>
    )
  }

  const homeWon = game.winner === 'HOME'
  const awayWon = game.winner === 'AWAY'

  return (
    <li className="sc-game">
      <span className={`sc-side${awayWon ? ' is-won' : ''}`}>
        <span className="sc-team">{game.away?.name}</span>
        <span className="sc-manager">{game.away?.managerNames}</span>
      </span>

      {game.isComplete ? (
        <span className="sc-score">
          <span className={awayWon ? 'is-won' : ''}>{game.away?.points?.toFixed(1)}</span>
          <span className="sc-dash" aria-hidden="true">–</span>
          <span className={homeWon ? 'is-won' : ''}>{game.home?.points?.toFixed(1)}</span>
        </span>
      ) : (
        <span className="sc-vs">vs</span>
      )}

      <span className={`sc-side sc-side-home${homeWon ? ' is-won' : ''}`}>
        <span className="sc-team">{game.home?.name}</span>
        <span className="sc-manager">{game.home?.managerNames}</span>
      </span>
    </li>
  )
}

/** One week of the season. */
export function ScheduleWeek({ entry }) {
  return (
    <section className={`sc-week${entry.isCurrent ? ' is-current' : ''}`}>
      <header className="sc-week-head">
        <h2 className="sc-week-title">
          {entry.isPlayoff ? `Playoffs · Week ${entry.week}` : `Week ${entry.week}`}
        </h2>
        <p className="sc-week-date">
          {weekDateLabel(entry.date)}
          {entry.isCurrent && <span className="sc-now">Now</span>}
        </p>
      </header>

      {entry.games.length > 0 ? (
        <ol className="sc-games">
          {entry.games.map((game) => (
            <Game key={game.id} game={game} />
          ))}
        </ol>
      ) : (
        // The playoff weeks exist on the calendar long before ESPN draws a
        // bracket for them.
        <p className="sc-empty">
          {entry.isPlayoff ? 'Bracket set once the regular season ends' : 'Not scheduled yet'}
        </p>
      )}
    </section>
  )
}

export default function SchedulePage({ onBack }) {
  const { data: league, error: leagueError, isLoading: leagueLoading, refresh } = useLeague()
  const { data: schedule, error: scheduleError, isLoading: scheduleLoading } = useMatchups()

  const error = leagueError ?? scheduleError
  const isLoading = leagueLoading || scheduleLoading

  const dates = useMemo(() => keyDates(), [])

  const weeks = useMemo(() => {
    const matchups = schedule?.matchups ?? []
    // The season is posted a week at a time: the next one goes up once the
    // week before it has been played out, so week 1 stands alone until it does.
    const next = upcomingWeek({
      currentMatchupPeriod: schedule?.currentMatchupPeriod,
      matchups,
    })

    return buildWeeks({
      matchups,
      regularSeasonWeeks: league?.settings?.regularSeasonMatchups ?? 14,
      // ESPN counts the playoff weeks in its scoring periods, so this is where
      // the season actually ends.
      finalWeek: league?.status?.finalScoringPeriod ?? null,
      currentWeek: next,
      throughWeek: next,
    })
  }, [schedule, league])

  return (
    <div className="page-shell is-schedule">
      <div className="page-inner">
        <header className="page-head">
          <button type="button" className="back" onClick={onBack}>
            <span className="back-arrow" aria-hidden="true" />
            Back
          </button>
          <div className="title-block">
            <h1 className="title">Schedule</h1>
            <p className="page-sub">
              {league ? (
                <>
                  <span>{league.settings?.name ?? 'League'}</span>
                  <span className="sub-sep" aria-hidden="true">·</span>
                  <span>{league.season} season</span>
                </>
              ) : (
                <span>The season, week by week</span>
              )}
            </p>
          </div>
        </header>

        <KeyDates dates={dates} />

        {isLoading && <p className="state">Pinning up the fixtures…</p>}

        {error && (
          <div className="state state-error" role="alert">
            <p className="state-title">Couldn’t load the schedule.</p>
            <p className="state-detail">{error.message}</p>
            <button type="button" className="retry" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && weeks.map((entry) => (
          <ScheduleWeek key={entry.week} entry={entry} />
        ))}

      </div>
    </div>
  )
}
