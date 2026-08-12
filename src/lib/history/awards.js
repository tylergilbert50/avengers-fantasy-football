/**
 * Awards the league hands out itself.
 *
 * Everything else on the site is worked out from the games — a record, a title,
 * a sacko. These aren't: somebody decides them, so they are written down here
 * and nowhere else. **This file is edited by hand.** Add a line when an award
 * is given; nothing will pick it up on its own.
 *
 * The name has to be the manager's full name as ESPN spells it, which is what
 * every other page keys on: "Brett Gilbert", not "Brett".
 */

/**
 * The Stan Lee Award.
 *
 * `season` is optional — a line with no season still shows on the profile, just
 * without a year against it. Fill them in as you learn them.
 */
export const STAN_LEE_AWARD = Object.freeze([
  { manager: 'Andrew Casazza' },
  { manager: 'Brett Gilbert' },
  { manager: 'Tyler Gilbert' },
])

/** Every award, so a profile can ask one question rather than one per award. */
export const AWARDS = Object.freeze([
  {
    id: 'stan-lee',
    name: 'Stan Lee Award',
    winners: STAN_LEE_AWARD,
  },
])

function key(name) {
  return String(name ?? '').trim().toLowerCase()
}

/**
 * What this manager has won, newest season first.
 *
 * @returns {Array<{ id: string, name: string, seasons: number[] }>}
 */
export function awardsFor(name, awards = AWARDS) {
  if (!name) return []

  return awards
    .map((award) => {
      const wins = award.winners.filter((entry) => key(entry.manager) === key(name))
      return {
        id: award.id,
        name: award.name,
        count: wins.length,
        seasons: wins
          .map((entry) => entry.season)
          .filter((season) => season != null)
          .sort((a, b) => b - a),
      }
    })
    .filter((award) => award.count > 0)
}
