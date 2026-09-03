/**
 * Championship comic covers, resolved by the season they were cut for —
 * src/assets/champion-covers/2024-800.webp is 2024's.
 *
 * The folder is scanned rather than listed out, so dropping a file in is the
 * whole job. A season can ship one file (2024.webp) or the same artwork at
 * several widths (2024-200.webp, 2024-400.webp, 2024-800.webp), which become a
 * srcset so a desktop at 1x downloads a cover already its own size instead of
 * asking the browser to squeeze an 800px scan into 190px — the squeeze is what
 * looked pixelated. A season with no file simply has no cover.
 */

const FILES = (() => {
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
   a fifth of the 66rem shelf — about 190px — on a desktop.

   Shared with the warm below rather than written twice: the warm only lands in
   the cache the page can use if it asks for the same candidate the shelf will. */
export const COVER_SIZES = '(max-width: 560px) 45vw, (max-width: 900px) 30vw, 190px'

/** The cover cut for a season, or null while it hasn't been drawn yet. */
export function coverFor(season) {
  return FILES[String(season)] ?? null
}

/**
 * Pulls every cover into the browser cache ahead of time.
 *
 * The shelf is a wall of artwork, and a cover fetched only once the page opens
 * spends its first moment as an empty frame. Fetching them while the comic
 * cover is still being turned means the shelf arrives whole. Idle-time work: it
 * must never compete with the page turn.
 *
 * srcset and sizes are set the same way the shelf sets them, so the browser
 * warms the width it will actually ask for — warming the 800 and rendering the
 * 200 would be two downloads and no cache hit.
 */
export function warmCovers() {
  if (typeof Image === 'undefined') return

  const load = () => {
    for (const cover of Object.values(FILES)) {
      const image = new Image()
      if ('fetchPriority' in image) image.fetchPriority = 'low'
      image.decoding = 'async'
      image.sizes = COVER_SIZES
      if (cover.srcSet) image.srcset = cover.srcSet
      image.src = cover.src
    }
  }

  if (typeof requestIdleCallback === 'function') requestIdleCallback(load, { timeout: 3000 })
  else setTimeout(load, 1000)
}
