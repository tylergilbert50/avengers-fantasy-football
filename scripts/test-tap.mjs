#!/usr/bin/env node
/**
 * Tap recognition, driven through the exact event sequences a browser produces.
 *
 *   npm test
 *
 * The point of these is the counts: one press must open a page exactly once,
 * and a scroll that happens to end on a button must not open anything.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  REFIRE_LOCK_MS,
  TAP_HOLD_MS,
  TAP_SLOP_PX,
  createTapRecognizer,
} from '../src/lib/tap.js'

/** A recognizer plus a clock you can wind forward. */
function harness() {
  let clock = 1000
  const opened = []
  const tap = createTapRecognizer((value) => opened.push(value), () => clock)
  return {
    opened,
    tap,
    wait(ms) {
      clock += ms
    },
    down(x, y, pointerType = 'touch') {
      tap.pointerDown({ clientX: x, clientY: y, pointerType })
    },
    up(x, y, value = 'standings') {
      return tap.pointerUp({ clientX: x, clientY: y }, value)
    },
  }
}

test('a touch tap opens the page exactly once', () => {
  const h = harness()
  h.down(100, 100)
  h.wait(60)
  h.up(100, 100)
  assert.deepEqual(h.opened, ['standings'])
})

test('the click a browser synthesizes after the tap does not open it twice', () => {
  const h = harness()
  h.down(100, 100)
  h.wait(60)
  h.up(100, 100)
  h.wait(30) // browsers fire click a beat after pointerup
  h.tap.click('standings')
  assert.equal(h.opened.length, 1, 'the follow-up click must be swallowed')
})

test('a touch that never produces a click still opens the page', () => {
  // This is the bug: the browser declines to synthesize a click at all.
  const h = harness()
  h.down(100, 100)
  h.wait(60)
  h.up(100, 100)
  assert.equal(h.opened.length, 1, 'pointerup alone has to be enough')
})

test('a mouse click opens the page once, and pointerup does not double it', () => {
  const h = harness()
  h.down(100, 100, 'mouse')
  h.wait(30)
  assert.equal(h.up(100, 100), false, 'mouse pointerup is ignored')
  h.tap.click('standings')
  assert.deepEqual(h.opened, ['standings'])
})

test('a keyboard press — click with no pointer at all — still opens the page', () => {
  const h = harness()
  h.tap.click('standings')
  assert.deepEqual(h.opened, ['standings'])
})

test('a scroll that ends on a panel does not open it', () => {
  const h = harness()
  h.down(100, 300)
  h.wait(120)
  h.up(100, 300 - (TAP_SLOP_PX + 20)) // finger dragged upward
  assert.deepEqual(h.opened, [], 'that was a scroll, not a tap')
})

test('drift within the slop still counts as a tap', () => {
  const h = harness()
  h.down(100, 100)
  h.wait(50)
  h.up(100 + TAP_SLOP_PX - 4, 100 + 3)
  assert.equal(h.opened.length, 1)
})

test('a press-and-hold does not open the page', () => {
  const h = harness()
  h.down(100, 100)
  h.wait(TAP_HOLD_MS + 50)
  h.up(100, 100)
  assert.deepEqual(h.opened, [])
})

test('a cancelled touch opens nothing', () => {
  const h = harness()
  h.down(100, 100)
  h.wait(40)
  h.tap.pointerCancel()
  h.up(100, 100)
  assert.deepEqual(h.opened, [])
})

test('two deliberate taps open two pages', () => {
  const h = harness()
  h.down(100, 100)
  h.wait(50)
  h.up(100, 100, 'standings')
  h.wait(REFIRE_LOCK_MS + 50)
  h.down(100, 400)
  h.wait(50)
  h.up(100, 400, 'records')
  assert.deepEqual(h.opened, ['standings', 'records'])
})

test('the very first press is never swallowed by the lock', () => {
  // A lock initialised to 0 rather than -Infinity would eat the first press
  // on a machine whose clock is near zero.
  const opened = []
  const tap = createTapRecognizer((v) => opened.push(v), () => 0)
  tap.pointerDown({ clientX: 5, clientY: 5, pointerType: 'touch' })
  tap.pointerUp({ clientX: 5, clientY: 5 }, 'standings')
  assert.deepEqual(opened, ['standings'])
})
