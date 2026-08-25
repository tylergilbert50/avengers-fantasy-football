import { useCallback, useState } from 'react'
import { usePoll } from '../hooks/useEspn.js'
import { submitBallot } from '../lib/api.js'
import './comic.css'
import './PollPage.css'

/** "1st", "2nd", "3rd" — the rank disc is decorative, this is what's announced. */
function ordinal(n) {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/**
 * A deadline in the reader's own timezone.
 *
 * The rule is written in league time — "Tuesday to Thursday noon, Central" —
 * but the moment it lands is the same everywhere, so the clock beside it is the
 * reader's. A manager in another state should see the hour their own phone will
 * agree with, not do the conversion themselves.
 */
function whenLabel(iso) {
  if (!iso) return ''
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** The results table, once voting has shut. */
export function PollResults({ rows, week, voteCount }) {
  return (
    <>
      <div className="table-wrap">
        <table className="poll-table">
          <caption className="sr-only">
            Week {week} managers’ poll, from {voteCount} {voteCount === 1 ? 'ballot' : 'ballots'}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="col-rank">#</th>
              <th scope="col" className="col-name">Manager</th>
              <th scope="col" className="col-num">Record</th>
              <th scope="col" className="col-num">Trend</th>
              <th scope="col" className="col-num">Poll pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="col-rank">
                  {/* Every disc the same: a poll is a running order, not a
                      podium — third place this week is nobody's bronze. */}
                  <span className="rank-badge" aria-hidden="true">
                    {row.rank}
                  </span>
                  <span className="sr-only">{ordinal(row.rank)}</span>
                </td>
                <td className="col-name">
                  <span className="pp-name">{row.name}</span>
                  <span className="pp-team">{row.teamName}</span>
                </td>
                <td className="col-num">{row.recordLabel}</td>
                <td className="col-num">
                  <Trend value={row.trend} />
                </td>
                <td className="col-num pp-points">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="page-foot">
        {voteCount === 0
          ? 'Nobody voted this week'
          : `${voteCount} ${voteCount === 1 ? 'ballot' : 'ballots'} counted`}
      </p>
    </>
  )
}

/**
 * Movement since last week, drawn rather than typed: every triangle in Unicode
 * has an emoji presentation waiting to hijack it on a phone.
 */
function Trend({ value }) {
  if (value == null || value === 0) {
    return (
      <span className="pp-trend pp-trend-flat">
        <span aria-hidden="true">–</span>
        <span className="sr-only">{value === 0 ? 'no change' : 'not ranked last week'}</span>
      </span>
    )
  }

  const up = value > 0
  return (
    <span className={`pp-trend ${up ? 'pp-trend-up' : 'pp-trend-down'}`}>
      <span className="pp-arrow" aria-hidden="true" />
      <span aria-hidden="true">{Math.abs(value)}</span>
      <span className="sr-only">
        {up ? `up ${value}` : `down ${Math.abs(value)}`} from last week
      </span>
    </span>
  )
}

/**
 * The ballot: every manager, by real name, A to Z.
 *
 * Ranking is by tapping in the order you rate them rather than by dragging.
 * Drag-and-drop of ten rows is miserable on a phone and worse with a keyboard;
 * tapping is one gesture, works everywhere, and keeps the list in its
 * alphabetical order so nobody loses their place mid-vote.
 */
export function Ballot({ managers, onSubmit, isSending, error }) {
  const [order, setOrder] = useState([])

  const toggle = useCallback((id) => {
    setOrder((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )
  }, [])

  const remaining = managers.length - order.length

  return (
    <div className="pp-ballot">
      <div className="pp-ballot-head">
        <p className="pp-progress" role="status">
          {remaining === 0
            ? 'All ranked. Lock it in.'
            : `${order.length} of ${managers.length} ranked`}
        </p>
      </div>

      <ol className="pp-choices">
        {managers.map((manager) => {
          const position = order.indexOf(manager.id)
          const ranked = position > -1

          return (
            <li key={manager.id}>
              <button
                type="button"
                className={`pp-choice${ranked ? ' is-ranked' : ''}`}
                onClick={() => toggle(manager.id)}
                aria-pressed={ranked}
              >
                <span className={`pp-slot${ranked ? ' is-filled' : ''}`} aria-hidden="true">
                  {ranked ? position + 1 : ''}
                </span>
                <span className="pp-choice-text">
                  <span className="pp-name">{manager.name}</span>
                  <span className="pp-team">{manager.teamName}</span>
                </span>
                <span className="sr-only">
                  {ranked ? `ranked ${ordinal(position + 1)}, tap to remove` : 'tap to rank next'}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {error && (
        <p className="pp-error" role="alert">
          {error}
        </p>
      )}

      <div className="pp-actions">
        <button
          type="button"
          className="pp-clear"
          onClick={() => setOrder([])}
          disabled={order.length === 0 || isSending}
        >
          Start over
        </button>
        <button
          type="button"
          className="pp-submit"
          onClick={() => onSubmit(order)}
          disabled={remaining !== 0 || isSending}
        >
          {isSending ? 'Sending…' : 'Vote'}
        </button>
      </div>
    </div>
  )
}

/** What you sent, once you've sent it. */
function Receipt({ managers, ballot, closesAt }) {
  const byId = new Map(managers.map((manager) => [manager.id, manager]))

  return (
    <div className="pp-receipt">
      <p className="state pp-thanks">Ballot in. Results post {whenLabel(closesAt)}.</p>
      <ol className="pp-your-ballot">
        {ballot.map((id, index) => (
          <li key={id}>
            <span className="pp-slot is-filled" aria-hidden="true">{index + 1}</span>
            <span className="pp-name">{byId.get(id)?.name ?? 'Unknown'}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function PollPage() {
  const { data, error, isLoading, refresh } = usePoll()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(null)
  const [voteError, setVoteError] = useState(null)

  const poll = sent ?? data

  const cast = useCallback(async (ballot) => {
    setSending(true)
    setVoteError(null)
    try {
      setSent(await submitBallot({ ballot }))
    } catch (failure) {
      setVoteError(failure.message)
    } finally {
      setSending(false)
    }
  }, [])

  // Once the season is over there is no week to vote in, but the last poll of
  // the year is still the one on the page — so the heading follows the table.
  const week = poll?.week ?? poll?.resultsWeek ?? null
  const hasVoted = Boolean(poll?.hasVoted)

  return (
    <div className="page-shell is-poll">
      <div className="page-inner">
        <header className="page-head">
          <div className="title-block">
            <h1 className="title">
              <span className="title-small">{week ? `Week ${week}` : 'The'}</span> Managers’ Poll
            </h1>
            {/* Nothing under the title before the season starts — the caption
                box below already says it, and out of season the open/close
                clock is meaningless anyway: the next calendar Tuesday isn't
                when the poll comes back. */}
            {poll?.phase !== 'not-started' && (
              <p className="page-sub">
                {!poll && <span>Rank the league</span>}

                {poll?.phase === 'season-over' && <span>Final poll of the season</span>}

                {(poll?.phase === 'open' || poll?.phase === 'closed') && (
                  <>
                    <span>{poll.isOpen ? 'Voting open' : 'Voting closed'}</span>
                    <span className="sub-sep" aria-hidden="true">·</span>
                    <span>
                      {poll.isOpen
                        ? `Closes ${whenLabel(poll.closesAt)}`
                        : `Opens ${whenLabel(poll.opensAt)}`}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
        </header>

        {poll?.testing && (
          <p className="pp-test" role="status">
            <strong>Test mode</strong> — POLL_TEST_WEEK is set, so this poll ignores the calendar
            and the season. Ballots cast here are real rows in week {poll.week}.
          </p>
        )}

        {isLoading && <p className="state">Counting the ballots…</p>}

        {error && (
          <div className="state state-error" role="alert">
            <p className="state-title">Couldn’t load the poll.</p>
            <p className="state-detail">{error.message}</p>
            <button type="button" className="retry" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {poll?.phase === 'not-started' && (
          <p className="state">The first poll opens once week 1 has been played.</p>
        )}

        {poll?.phase === 'season-over' && (
          <p className="state pp-thanks">
            The regular season is over — this is where it finished. The poll is back when the next
            one starts.
          </p>
        )}

        {poll?.isOpen && !hasVoted && (
          <Ballot managers={poll.managers} onSubmit={cast} isSending={sending} error={voteError} />
        )}

        {poll?.isOpen && hasVoted && (
          <Receipt managers={poll.managers} ballot={poll.yourBallot ?? []} closesAt={poll.closesAt} />
        )}

        {!poll?.isOpen && poll?.results && (
          <PollResults rows={poll.results} week={poll.resultsWeek} voteCount={poll.voteCount} />
        )}

        {poll && (
          <p className="pp-rule">
            Every week, the poll opens Tuesday at 12:00 AM and closes Thursday at 12:00 PM{' '}
            {poll.timezone}.
          </p>
        )}
      </div>
    </div>
  )
}
