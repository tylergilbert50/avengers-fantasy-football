# Championship comic covers

One cover per title, named after the season it was won:

    2021-200.webp  2021-400.webp  2021-800.webp
    2025-200.webp  2025-400.webp  2025-800.webp

The number after the season is the file's pixel width, and the three of them
become a `srcset`: a phone at 3x takes the 800, a laptop at 1x takes the 200.
That matters because the shelf draws a cover at roughly 190px, and a browser
asked to squeeze a big scan that far down does it with a cheap filter — the
artwork comes out visibly pixelated on exactly the screens with the fewest
pixels to spare. A plain `2021.webp` with no width still works; it just leaves
the shrinking to the browser.

Drop the files in and the Champions page picks them up on the next build — no
code change. `.webp`, `.png` and `.jpg` all work. A season with no cover here
shows a blank issue ("cover to come") in its place, so the shelf never has a gap
in the run.

Portrait proportions, please — they are shown at 2:3 and cropped from the top,
so a cover with its title lettering up top survives the crop.

To cut the set from a full-resolution scan (`npm i --no-save sharp` first):

```js
for (const w of [200, 400, 800]) {
  await sharp('2026-full.png')
    .resize({ width: w, kernel: 'lanczos3', withoutEnlargement: true })
    .sharpen({ sigma: 0.6, m1: 0.8, m2: 2 })   // puts back the ink edges any downscale softens
    .webp({ quality: 92, effort: 6 })
    .toFile(`2026-${w}.webp`)
}
```
