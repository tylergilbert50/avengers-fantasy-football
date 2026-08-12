# Manager portraits

Drop a portrait here named after the manager, and any page that shows a face
picks it up on the next build — no code change. The name is slugified the same
way the draft artwork is, from the name ESPN has on the account:

    Brett Gilbert    -> brett-gilbert.webp
    Danny Stiles     -> danny-stiles.webp
    Jeremy Stojakovich -> jeremy-stojakovich.webp

`.webp`, `.png` and `.jpg` all work. A first-name-only file (`brett.webp`) is
matched as a fallback, and a manager with no file at all gets their initials in
the frame instead.

Square, please — they are shown as a circle. The artwork here is drawn out to
the edge of its own circle on black, which is what the gold ring is seating.
