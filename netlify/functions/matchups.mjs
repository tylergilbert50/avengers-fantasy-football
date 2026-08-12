import { cacheHeaders, handleMatchups, runRoute } from '../../src/lib/espn/handlers.js'

export default async (request) => {
  const params = new URL(request.url).searchParams
  const { status, body, cacheSeconds } = await runRoute(handleMatchups, {
    env: process.env,
    params,
  })

  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cacheHeaders(cacheSeconds) },
  })
}

export const config = { path: '/api/matchups' }
