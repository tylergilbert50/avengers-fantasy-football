/**
 * Who won a game, for the games the score doesn't settle.
 *
 * ESPN stamps a winner on every matchup, and it is the only thing that knows
 * how the league breaks a tie: 2021 week 6 finished 118.36 apiece and ESPN has
 * it as Andrew's win, not a draw. Reading that flag rather than comparing the
 * two totals is what keeps the record the league keeps.
 *
 * Checked against all 420 games ESPN still serves: the flag and the score agree
 * on every other one, so this only ever changes a game that finished level. The
 * playoff bracket already works this way — see `seasonFinishes` in merge.js.
 *
 * Seasons ESPN has dropped come from the workbook, which carries no flag; those
 * fall back to the score, which is all it ever recorded.
 */

/**
 * How one side of a game finished, as the key the record buckets are named by.
 *
 * @param {object} game  a history game: `a`/`b` owners, `ap`/`bp` points, and
 *                       `winner` where ESPN settled it
 * @param {'a' | 'b'} side
 * @returns {'wins' | 'losses' | 'ties'}
 */
export function sideOutcome(game = {}, side) {
  if (game.winner) return game.winner === side ? 'wins' : 'losses'

  const [forPoints, againstPoints] = side === 'a' ? [game.ap, game.bp] : [game.bp, game.ap]
  if (forPoints > againstPoints) return 'wins'
  if (forPoints < againstPoints) return 'losses'
  return 'ties'
}
