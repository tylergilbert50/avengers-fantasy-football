/**
 * Minimal .env reader so the CLI scripts work without adding a dotenv
 * dependency. Vite and Netlify each load .env themselves; this is only for
 * `node scripts/*.mjs`.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadDotEnv(cwd = process.cwd()) {
  let contents
  try {
    contents = readFileSync(resolve(cwd, '.env'), 'utf8')
  } catch {
    return process.env
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match || line.trimStart().startsWith('#')) continue

    const [, key, rawValue] = match
    // Strip matched surrounding quotes, then trailing comments on bare values.
    const value = /^(['"])(.*)\1$/.test(rawValue.trim())
      ? rawValue.trim().slice(1, -1)
      : rawValue.replace(/\s+#.*$/, '').trim()

    // Real environment variables win over the file.
    if (process.env[key] === undefined) process.env[key] = value
  }

  return process.env
}
