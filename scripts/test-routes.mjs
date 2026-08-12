#!/usr/bin/env node
/**
 * That production can actually load what development serves.
 *
 * The two runtimes reach the handlers by different roads: the dev middleware
 * looks them up in ROUTES, the Netlify functions import them by name. A handler
 * registered in ROUTES but not exported works perfectly in `npm run dev` and
 * fails at import time on the deployed site — which is exactly what happened to
 * the poll. Importing every function here is what makes that a test failure
 * instead of a deploy failure.
 *
 *   npm test
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

import { ROUTES } from '../src/lib/espn/handlers.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const functionsDir = join(root, 'netlify', 'functions')

const files = (await readdir(functionsDir)).filter((name) => name.endsWith('.mjs'))
const functions = await Promise.all(
  files.map(async (name) => ({
    name,
    module: await import(pathToFileURL(join(functionsDir, name)).href),
  })),
)

test('every route is a handler', () => {
  for (const [path, handler] of Object.entries(ROUTES)) {
    assert.equal(typeof handler, 'function', `${path} is not wired to a function`)
  }
})

test('every Netlify function imports, and exports a handler and a path', () => {
  assert.ok(functions.length > 0, 'no functions found')

  for (const { name, module } of functions) {
    assert.equal(typeof module.default, 'function', `${name} has no default export`)
    assert.equal(typeof module.config?.path, 'string', `${name} declares no path`)
  }
})

test('the two runtimes serve the same set of paths', () => {
  const deployed = functions.map(({ module }) => module.config.path).sort()
  const local = Object.keys(ROUTES).sort()

  assert.deepEqual(
    deployed,
    local,
    'a route exists in one runtime but not the other — add the missing function or ROUTES entry',
  )
})
