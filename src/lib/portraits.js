/**
 * Manager portraits, resolved by name.
 *
 * The folder is scanned rather than listed out, so dropping
 * `danny-stiles.webp` into src/assets/managers/ is the whole job — no code to
 * touch, and a manager with no file simply has no portrait.
 */

import { playerSlug } from './espn/draft.js'

const FILES = Object.fromEntries(
  Object.entries(
    import.meta.glob('../assets/managers/*.{webp,png,jpg,jpeg}', {
      eager: true,
      import: 'default',
    }),
  ).map(([path, src]) => [path.split('/').pop().replace(/\.[^.]+$/, ''), src]),
)

/**
 * "Brett Gilbert" -> the file named after him.
 *
 * Falls back to the first name alone, so `brett.webp` is found too — which
 * matters in a league with two Gilberts only because the full name is tried
 * first.
 */
export function portraitFor(name) {
  const slug = playerSlug(name)
  if (!slug) return null
  return FILES[slug] ?? FILES[slug.split('-')[0]] ?? null
}
