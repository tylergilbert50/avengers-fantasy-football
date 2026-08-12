# ESPN Fantasy data

How league data gets from ESPN into the site.

## Setup

1. `cp .env.example .env`
2. Put your league id in `ESPN_LEAGUE_ID`. It's the number in your league URL:
   `https://fantasy.espn.com/football/league?leagueId=123456` → `123456`
3. If the league is **private**, also set `ESPN_S2` and `ESPN_SWID` (see below).
4. `npm run espn:check` — prints the standings table. If that works, the site works.

For the deployed site, set the same variables in Netlify under
**Site configuration → Environment variables**.

### Public vs private leagues

A public league needs no credentials. You can make yours public in ESPN under
*League Settings → Basic Settings → Make League Viewable to Public*, which is
the lowest-maintenance option.

For a private league, sign in at fantasy.espn.com in Chrome, then
**DevTools → Application → Cookies → https://fantasy.espn.com** and copy the
`espn_s2` and `SWID` values. Paste them raw — the code handles the URL-encoding
and the braces around SWID either way. **These cookies are your ESPN login**;
they're gitignored, and they expire roughly annually, at which point
`/api/league` starts returning a 401 with a message saying so.

## Architecture

ESPN's API sends no CORS headers, so the browser can't call it directly. Private
leagues also need cookies that must never reach the client. Everything therefore
goes through our own `/api` routes:

```
browser → /api/league → Netlify Function → ESPN
             (src/lib/api.js)  (netlify/functions/league.mjs)
```

In development, a Vite middleware plugin serves the same `/api` routes from the
same handler functions, so `npm run dev` works without the Netlify CLI and dev
can't drift from production.

| File | Role |
| --- | --- |
| `src/lib/espn/config.js` | Env parsing, season resolution, SWID normalizing |
| `src/lib/espn/endpoints.js` | ESPN URL builders, allowed `view` list |
| `src/lib/espn/fetchLeague.js` | The HTTP call + error mapping (**server only**) |
| `src/lib/espn/normalize.js` | Raw ESPN blob → the shapes we render (pure) |
| `src/lib/espn/handlers.js` | Route logic + caching, shared by both runtimes |
| `netlify/functions/*.mjs` | Production adapter |
| `vite-plugin-espn-dev.js` | Development adapter |
| `src/lib/api.js` | Browser fetch client |
| `src/hooks/useEspn.js` | React hooks |

The league id comes from the environment, never from the request — otherwise the
deployed function would happily replay our private cookies against anyone's
league. `season` and `week` *are* accepted from the request, and validated.

## Endpoints

### `GET /api/league?season=2026`

`season` is optional and defaults to the current NFL season.

```jsonc
{
  "leagueId": 123456,
  "season": 2026,
  "settings": { "name": "New Avengers", "size": 12, "playoffTeamCount": 6, ... },
  "status": { "currentMatchupPeriod": 4, "isActive": true, "previousSeasons": [2025, 2024] },
  "managers": [
    { "id": "{SWID}", "name": "Tyler G", "isLeagueManager": true,
      "teamId": 1, "teamName": "Cap's Shield", "recordLabel": "3-1", "rank": 2 }
  ],
  "standings": [
    {
      "id": 2, "rank": 1, "name": "Widow's Bite", "abbrev": "WID", "logo": "https://…",
      "managerNames": "Sam R & Jo P",
      "managers": [ { "id": "{SWID}", "name": "Sam R" } ],
      "recordLabel": "4-0",
      "record": {
        "wins": 4, "losses": 0, "ties": 0, "gamesPlayed": 4, "winPct": 1,
        "pointsFor": 455.75, "pointsAgainst": 350.1, "pointsDifferential": 105.65,
        "pointsForPerGame": 113.94, "pointsAgainstPerGame": 87.53,
        "streak": { "length": 4, "type": "WIN" }
      },
      "playoffSeed": 1, "finalRank": null, "projectedRank": 1
    }
  ],
  "teams": [ /* same shape, unsorted, no `rank` */ ],
  "fetchedAt": "2026-08-02T20:57:00.000Z"
}
```

`standings` is `teams` sorted and ranked; prefer it for display.

### `GET /api/matchups?season=2026&week=3`

Omit `week` for the whole season.

```jsonc
{
  "season": 2026, "week": 3, "currentMatchupPeriod": 4,
  "matchups": [
    { "id": 1, "week": 3, "playoffTier": "NONE", "isBye": false,
      "winner": "AWAY", "isComplete": true, "margin": 14.75,
      "home": { "teamId": 1, "name": "Cap's Shield", "points": 95.5, "managerNames": "Tyler G" },
      "away": { "teamId": 2, "name": "Widow's Bite", "points": 110.25, "managerNames": "Sam R" } }
  ]
}
```

Byes (odd-sized leagues) come through with `isBye: true` and `away: null`.

### `GET /api/champions?season=2026`

Who won each season, newest first. `season` names the season to read the
league's history *from*, not the one to return — every season the league has
played comes back either way.

```jsonc
{
  "leagueName": "Avengers Fantasy Football League",
  "seasons": [2021, 2022, 2023, 2024, 2025, 2026],
  "missingSeasons": [],
  "champions": [
    { "season": 2025, "issue": 5,
      "team": { "id": 1, "name": "Anyone Can Wear The Mask", "abbrev": "BRET", "logo": "https://…" },
      "manager": "Brett Gilbert", "managerSlug": "brett-gilbert",
      // The regular season's, which is the point: ESPN's `record.overall`
      // stops at the bracket, and a champion can arrive with a losing one.
      "record": { "wins": 6, "losses": 8, "ties": 0, "gamesPlayed": 14,
                  "label": "6-8", "pointsFor": 1783.7, "pointsPerWeek": 127.41 },
      "seed": 7,
      "titleGame": { "week": 17, "points": 125.44, "opponent": "Genius, Plaiboi, Champion",
                     "opponentManager": "Connor Bowser", "opponentPoints": 109.56, "margin": 15.88 }
    }
  ]
}
```

The title is read from ESPN's `rankCalculatedFinal`, falling back to the winner
of the last played bracket game. The season being played has neither yet, so it
simply isn't in the list — the reigning champion stays the headline until the
next bracket settles.

`GET /api/records` and `GET /api/draft` work the same way: one request, every
season, computed server-side. Their shapes are in `records.js` and `draft.js`.

### `GET /api/trades`

The odd one out, because ESPN won't serve its transaction log to an anonymous
caller at all — not even for seasons long finished. Trades are rebuilt instead
from roster acquisition stamps plus a week-by-week ownership timeline, and
scored on the points each side's new players put up *in a starting lineup* from
the trade onward. Finished seasons are precomputed into `src/lib/trades/
archive.js`, so a request fetches only the season being played.

See the README's **Trade history** section for the reconstruction in full,
including why FAAB deals carry no verdict; the shapes are in
`src/lib/trades/build.js`.

### `GET /api/waivers`

Reads the same weekly rosters as `/api/trades` — both go through
`src/lib/season/activity.js`, so whichever is asked for first pays for them and
the other is served from the memo. Returns ESPN's exact per-team counts (adds,
drops, FAAB spent) alongside the pickups the timeline can name, which is about
three quarters of them. See the README's **Waiver history** section for what the
other quarter is and why no pickup carries a price.

## Using it in React

```jsx
import { useLeague } from './hooks/useEspn.js'

function Standings() {
  const { data, error, isLoading, refresh } = useLeague()

  if (isLoading) return <p>Loading…</p>
  if (error) return <p>{error.message} <button onClick={refresh}>Retry</button></p>

  return (
    <table>
      <tbody>
        {data.standings.map((team) => (
          <tr key={team.id}>
            <td>{team.rank}</td>
            <td>{team.name}</td>
            <td>{team.managerNames}</td>
            <td>{team.recordLabel}</td>
            <td>{team.record.pointsFor.toFixed(1)}</td>
            <td>{team.record.pointsAgainst.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

`useMatchups({ week })` works the same way.

## Caching

Responses carry `Netlify-CDN-Cache-Control: s-maxage=300, stale-while-revalidate=1200`,
so Netlify's edge serves a cached copy for 5 minutes and refreshes in the
background for 20 more. Each function instance also memoizes for 60 seconds, so a
burst of visitors hits ESPN once. Both knobs are in `src/lib/espn/handlers.js`.

Bumping the CDN window is the fix if ESPN starts rate limiting (429).

## Adding another view

ESPN packs the league in "views" — `mRoster` (rosters/players), `mDraftDetail`,
`mTransactions2`, `mBoxscore`. To surface one:

1. Add it to `ALLOWED_VIEWS` in `endpoints.js` if it isn't there.
2. Write a normalizer in `normalize.js` and a fixture case in
   `src/lib/espn/__fixtures__/league.json`.
3. Add a handler in `handlers.js`, register it in `ROUTES`, and add the matching
   `netlify/functions/<name>.mjs` (four lines — copy `league.mjs`).

Calling several views at once sometimes returns different data than requesting
them separately, so check the raw payload when a field looks wrong:

```bash
curl -s "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/segments/0/leagues/$ESPN_LEAGUE_ID?view=mTeam" | jq .
```

## Testing

`npm test` runs the normalizers against `src/lib/espn/__fixtures__/league.json`
with `node --test`. No network and no credentials, so it runs in CI. The fixture
deliberately includes the awkward cases: a legacy `location`/`nickname` team, a
team with no `name` at all, co-managers, an unowned team, a tie, and a bye week.
