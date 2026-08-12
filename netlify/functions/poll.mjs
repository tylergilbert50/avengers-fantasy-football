import { cacheHeaders, handlePoll, runRoute } from '../../src/lib/espn/handlers.js'

export default async (request) => {
  const params = new URL(request.url).searchParams
  const { status, body, cacheSeconds, headers } = await runRoute(handlePoll, {
    env: process.env,
    params,
    method: request.method,
    // The cookie is in here: it is how the poll knows this browser has voted.
    headers: Object.fromEntries(request.headers),
  })

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...cacheHeaders(cacheSeconds),
      ...(headers ?? {}),
    },
  })
}

export const config = { path: '/api/poll' }
