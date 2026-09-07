# The managers' poll

A power-ranking vote. Every manager ranks all ten of them, best first, and the
points make a table. It runs twice over: once before the season starts, then
every week of it.

## The preseason poll

The season opens with one ballot, cast before a game has been played. It exists
because the weekly poll can't run yet — ranking ten managers at 0-0 is ranking
them on nothing — but the league's guess at the pecking order is worth having
on the record precisely because nothing has happened to justify it.

| | |
| --- | --- |
| **Opens** | The morning after the draft — before that there are no rosters to rank, only names |
| **Closes** | 12:00 PM the Wednesday before the season's first kickoff |
| **Filed as** | Week 1 |
| **Then** | The table stands until the first weekly poll opens, the Tuesday after week 1 is played |

Both dates are league fixtures, so they live with the draft and the trade
deadline in `src/lib/schedule/calendar.js` as `PRESEASON_POLL`. **They have to
be moved when the season rolls over**, the same as `WEEK_1` — and `npm test`
fails if they aren't: it checks the deadline still falls on a Wednesday at noon,
after the draft, in week 1's own week. Left stale, the poll would close before
anybody could vote in it.

**Filing it under week 1 is deliberate.** The weekly poll never uses that week,
and putting the preseason ballot there is what gives the week 2 table its trend
column: managers move against the league's preseason guess rather than against
nothing. The preseason table itself has no Trend column — there is no poll
behind it to have moved from, and filling that in would be inventing the data.

## The weekly poll: the rules, as built

| | |
| --- | --- |
| **Opens** | Tuesday 12:00 AM, league time |
| **Closes** | Thursday 12:00 PM, league time |
| **League time** | `America/Chicago` unless `POLL_TIMEZONE` says otherwise |
| **Weeks** | The week 2 poll through the last regular season week |
| **Not week 1** | A ballot cast before any games have been played would rank ten managers at 0-0 on nothing, so the first *weekly* poll is the one that opens after week 1 — the stretch before it belongs to the preseason poll above |
| **Ballot** | All ten managers, by real name, A–Z |
| **Scoring** | A first-place vote is worth 10 points, a last-place vote 1 |
| **Ties** | Broken on first-place votes, then on name |
| **While open** | You see the ballot, or your own ballot back if you've voted |
| **Once closed** | You see the table, until the next poll opens on Tuesday |
| **The table** | Rank, manager, and poll points — plus Trend, places moved since last week's poll. Records are the standings' job; `recordLabel` is still on every row of the response, just not drawn |

The week a ballot counts for is decided by the server from ESPN's current
matchup period, stepping past it when that week's games are all final — which
is exactly the state Tuesday morning opens into. A submitted ballot carries
rankings and nothing else, so a doctored request can't aim a vote at a week
that has already been settled.

## Setting it up

Votes have to live somewhere shared, which is the one part of the site that
isn't ESPN. Any Postgres with a REST endpoint works; these steps are Supabase.

**1. Make a project** at [supabase.com](https://supabase.com) — the free tier is
far more than ten ballots a week needs.

**2. Run this in the SQL editor:**

```sql
create table poll_votes (
  id          bigint generated always as identity primary key,
  season      int  not null,
  week        int  not null,
  voter_id    uuid not null,
  ip_hash     text not null,
  ballot      jsonb not null,
  created_at  timestamptz not null default now(),

  -- This is what actually stops a second ballot. The check in the handler is
  -- for a friendly message; this is for two tabs pressing submit at once.
  constraint poll_votes_one_per_voter unique (season, week, voter_id)
);

create index poll_votes_week_idx on poll_votes (season, week);

-- Nothing but our server ever talks to this table, and it does so with the
-- service key. Row-level security on with no policies means a leaked anon key
-- reads nothing.
alter table poll_votes enable row level security;
```

**3. Copy two values** from **Project Settings → API**: the project URL, and the
`service_role` key (**not** the anon key).

**4. Put them in `.env`** for local work:

```bash
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
POLL_IP_SALT=<paste the output of the command below>
```

Generate the salt once and keep it — changing it makes every address the poll
has already seen look new:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

**5. Set the same three in Netlify** under **Site configuration → Environment
variables**.

Until they exist, `/api/poll` answers 503 with a message saying so, and the page
shows it. Nothing else on the site is affected.

### The service key

It bypasses row-level security, so it never goes near the browser. It is read in
`src/lib/poll/config.js`, used only in `src/lib/poll/store.js`, and both are
reached exclusively through `/api/poll*`. Don't import either from a component.

## Optional settings

| Variable | Default | What it does |
| --- | --- | --- |
| `POLL_TIMEZONE` | `America/Chicago` | The zone the Tuesday–Thursday window is measured in |
| `POLL_MAX_VOTES_PER_IP` | `1` | Ballots allowed from one network per week; `0` turns the address check off |

## What stops a second vote — and what doesn't

Two things, neither of them a login:

1. **A cookie.** The first ballot mints a voter id and sets it `HttpOnly` for
   400 days. That id is what the unique index keys on.
2. **The network address**, stored as a salted SHA-256 hash and never in the
   clear. By default one ballot per address per week.

This is honest about what it is: it stops the accidental double vote and the
casual second one. It does not stop someone determined — a different device on
mobile data is a different address and a fresh cookie.

It also has a cost worth knowing about: **two managers on the same wifi share an
address**, so the second one is turned away with "a ballot has already come from
this network this week". If that happens, raise `POLL_MAX_VOTES_PER_IP` to 2, or
set it to `0` to rely on the cookie alone.

If the poll ever needs to be tamper-proof rather than tidy, the fix is
identity — a code per manager, or Supabase Auth — and the schema above already
has the column to hang it on: `voter_id` becomes the manager's id instead of the
browser's, and nothing else changes.

## Endpoints

### `GET /api/poll`

```jsonc
{
  "season": 2026, "week": 2,
  "isOpen": false,
  // 'open' | 'closed' | 'not-started' (before the preseason poll opens) | 'season-over'
  "phase": "closed",
  // The season's opening ballot rather than a weekly one. The page drops the
  // Trend column on it, and names it "Preseason" instead of "Week 1".
  "isPreseason": false,
  "opensAt": "2026-09-15T05:00:00.000Z",   // next Tuesday, when closed
  "closesAt": "2026-09-17T17:00:00.000Z",
  "timezone": "CDT",
  // The week the table below belongs to. The same as `week`, except once the
  // season is over and the year's last poll is what's still on the page.
  "resultsWeek": 2,
  "managers": [ { "id": "{SWID}", "name": "Andrew Casazza", "teamName": "Punisher's Arsenal",
                  "teamId": 4, "recordLabel": "0-0" } ],
  "hasVoted": false,
  "yourBallot": null,
  // Null while voting is open — the ballot is what's on show then.
  "results": [ { "id": "{SWID}", "name": "Andrew Casazza", "rank": 1, "points": 18,
                 "firstPlaceVotes": 1, "trend": 2, "recordLabel": "0-0" } ],
  "voteCount": 2
}
```

`trend` is places moved since last week: positive is a climb, `null` means there
was no poll to move against.

### `POST /api/poll/vote`

```jsonc
{ "ballot": ["{SWID-best}", "{SWID-second}", "…all ten, in order"] }
```

Answers with the same shape as the GET, plus a `Set-Cookie`. The refusals:

| Status | When |
| --- | --- |
| 400 | The ballot isn't all ten managers, exactly once each |
| 405 | Anything other than POST |
| 409 | Voting is closed, the preseason poll hasn't opened yet, the season is over, or this voter has already voted |
| 503 | The database isn't configured |

## Testing

`npm test` covers both windows (including a daylight-saving week and the
preseason handover to the first weekly poll), which week a ballot is for, and
the scoring. No network and no database, so it runs in CI.

The parts that need a database were checked against a stand-in PostgREST server
rather than mocks — worth repeating if the store changes.
