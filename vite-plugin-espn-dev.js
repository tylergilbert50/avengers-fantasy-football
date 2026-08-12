/**
 * Serves the /api/* routes during `npm run dev` using the exact same handlers
 * the Netlify functions use, so local development doesn't require the Netlify
 * CLI and can't drift from production behaviour.
 */

import { cacheHeaders, ROUTES, runRoute } from './src/lib/espn/handlers.js'

/** Nothing we accept is bigger than a ballot; refuse anything that isn't. */
const MAX_BODY_BYTES = 64 * 1024

function readJsonBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return Promise.resolve(null)

  return new Promise((resolve) => {
    let raw = ''
    let tooBig = false

    req.on('data', (chunk) => {
      if (tooBig) return
      raw += chunk
      if (raw.length > MAX_BODY_BYTES) {
        tooBig = true
        raw = ''
      }
    })
    req.on('end', () => {
      if (tooBig || !raw) return resolve(null)
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve(null) // handlers validate the shape; a broken body is just an invalid one
      }
    })
    req.on('error', () => resolve(null))
  })
}

/** Behind Vite there is no proxy, so this is the machine on the other end. */
function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress ?? ''
}

export default function espnDevApi(env = {}) {
  return {
    name: 'espn-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        const handler = ROUTES[url.pathname]
        if (!handler) return next()

        const { status, body, cacheSeconds, headers } = await runRoute(handler, {
          env: { ...process.env, ...env },
          params: url.searchParams,
          method: req.method,
          headers: req.headers,
          body: await readJsonBody(req),
          ip: clientIp(req),
        })

        res.statusCode = status
        res.setHeader('content-type', 'application/json; charset=utf-8')
        for (const [key, value] of Object.entries(cacheHeaders(cacheSeconds))) {
          res.setHeader(key, value)
        }
        for (const [key, value] of Object.entries(headers ?? {})) {
          res.setHeader(key, value)
        }
        res.end(JSON.stringify(body))
      })
    },
  }
}
