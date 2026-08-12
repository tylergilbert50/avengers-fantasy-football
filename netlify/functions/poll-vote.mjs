import { cacheHeaders, handlePollVote, runRoute } from '../../src/lib/espn/handlers.js'

/**
 * Netlify puts the real caller in `x-nf-client-connection-ip`; everything else
 * on the way in can be set by the caller, so it is only a fallback for running
 * this file somewhere else.
 */
function clientIp(request, context) {
  return (
    request.headers.get('x-nf-client-connection-ip') ||
    context?.ip ||
    (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  )
}

export default async (request, context) => {
  const params = new URL(request.url).searchParams
  const body = await request.json().catch(() => null)

  const { status, body: payload, cacheSeconds, headers } = await runRoute(handlePollVote, {
    env: process.env,
    params,
    method: request.method,
    headers: Object.fromEntries(request.headers),
    body,
    ip: clientIp(request, context),
  })

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...cacheHeaders(cacheSeconds),
      ...(headers ?? {}),
    },
  })
}

export const config = { path: '/api/poll/vote' }
