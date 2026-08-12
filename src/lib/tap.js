/**
 * Tap recognition for touch screens.
 *
 * A touch screen decides for itself whether a touch was a tap worth
 * synthesizing a `click` for, and it can decline: a stray pixel of finger drift
 * on a scrollable page, momentum still running from a previous scroll, or an
 * emulated hover state to paint first. Any of those swallows the first tap and
 * leaves the second one working — which is what "I have to tap twice" is.
 *
 * So the tap is recognised here instead: finger down, finger up in roughly the
 * same spot, soon after. `click` is still wired up as well, because mice have a
 * click that already works and keyboards produce one with no pointer involved
 * at all. Whichever of the two arrives second is dropped by the re-fire lock,
 * so a control activates exactly once per press however it was pressed.
 */

/** How far a finger may travel and still count as a tap rather than a scroll. */
export const TAP_SLOP_PX = 12
/** Longer than this is a press-and-hold, not a tap. */
export const TAP_HOLD_MS = 800
/** A second activation inside this window is the duplicate event, not a
 *  genuine second press. Comfortably longer than the gap between a pointerup
 *  and the click a browser synthesizes from it, comfortably shorter than a
 *  person deliberately pressing twice. */
export const REFIRE_LOCK_MS = 700

/**
 * @param {(value: any) => void} onActivate called once per press
 * @param {() => number} now injectable clock, for tests
 */
export function createTapRecognizer(onActivate, now = () => Date.now()) {
  let start = null
  let lastFired = -Infinity

  const fire = (value) => {
    const at = now()
    if (at - lastFired < REFIRE_LOCK_MS) return false
    lastFired = at
    onActivate(value)
    return true
  }

  return {
    pointerDown(event) {
      // A mouse already has a click that works; only touch and pen need help.
      start =
        event.pointerType === 'mouse'
          ? null
          : { x: event.clientX, y: event.clientY, at: now() }
    },

    pointerUp(event, value) {
      const from = start
      start = null
      if (!from) return false
      if (Math.hypot(event.clientX - from.x, event.clientY - from.y) > TAP_SLOP_PX) return false
      if (now() - from.at > TAP_HOLD_MS) return false
      return fire(value)
    },

    /** The browser took the touch for a scroll or gesture; forget it. */
    pointerCancel() {
      start = null
    },

    click(value) {
      return fire(value)
    },
  }
}
