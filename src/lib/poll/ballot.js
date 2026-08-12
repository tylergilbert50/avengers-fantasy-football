/**
 * The ballot, and what the votes add up to.
 *
 * A ballot is an ordered list of manager ids, best first. Scoring is the way
 * every press poll does it: with ten managers a first-place vote is worth ten
 * points and a last-place vote one, so a manager everybody has mid-table
 * finishes above one who is loved and hated in equal measure.
 *
 * Pure functions — no clock, no network — so the maths can be checked against
 * hand-made ballots.
 */

/**
 * Who is on the ballot, in the order it is shown: managers by their real name,
 * A to Z. Not team names, which change weekly and would reshuffle the list.
 *
 * ESPN keys managers by the SWID on their account, which survives them renaming
 * the team or the season rolling over, so that is what a ballot records.
 */
export function ballotManagers(league) {
  return (league?.managers ?? [])
    .filter((manager) => manager.teamId != null)
    .map((manager) => ({
      id: manager.id,
      name: manager.name,
      teamName: manager.teamName,
      teamId: manager.teamId,
      recordLabel: manager.recordLabel ?? '0-0',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Is this submitted ballot usable? It has to rank every manager exactly once —
 * a partial or padded ballot would quietly distort the points.
 *
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateBallot(ballot, managers) {
  if (!Array.isArray(ballot)) return { ok: false, error: 'A ballot must be a list of managers.' }

  const expected = new Set(managers.map((manager) => manager.id))
  if (ballot.length !== expected.size) {
    return { ok: false, error: `Rank all ${expected.size} managers before submitting.` }
  }

  const seen = new Set()
  for (const id of ballot) {
    if (!expected.has(id)) return { ok: false, error: 'That ballot has someone on it who is not in the league.' }
    if (seen.has(id)) return { ok: false, error: 'That ballot ranks the same manager twice.' }
    seen.add(id)
  }

  return { ok: true }
}

/** A first-place vote is worth one point per manager on the ballot, last one. */
export function pointsFor(index, size) {
  return size - index
}

/**
 * The standings the votes make.
 *
 * Ties break on first-place votes and then on name, so the order is stable —
 * two managers on the same points don't swap places on every reload.
 */
export function tally(votes = [], managers = []) {
  const totals = new Map(
    managers.map((manager) => [manager.id, { ...manager, points: 0, firstPlaceVotes: 0 }]),
  )

  for (const vote of votes) {
    const ballot = vote?.ballot ?? []
    ballot.forEach((id, index) => {
      const row = totals.get(id)
      if (!row) return // a manager who has since left the league
      row.points += pointsFor(index, managers.length)
      if (index === 0) row.firstPlaceVotes += 1
    })
  }

  return [...totals.values()]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.firstPlaceVotes - a.firstPlaceVotes ||
        a.name.localeCompare(b.name),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

/**
 * Movement against last week's poll: positive is a climb, null is a manager who
 * wasn't ranked last week (or a first poll, where nobody was).
 */
export function withTrend(current = [], previous = []) {
  const before = new Map(previous.map((row) => [row.id, row.rank]))

  return current.map((row) => {
    const was = before.get(row.id)
    return { ...row, trend: was == null ? null : was - row.rank }
  })
}
