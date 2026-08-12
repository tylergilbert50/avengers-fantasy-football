# New Avengers Fantasy Football

League site for the New Avengers fantasy football league. React + Vite, deployed
to Netlify, with live data pulled from the ESPN Fantasy API.

## Getting started

```bash
npm install
cp .env.example .env    # then add your ESPN_LEAGUE_ID
npm run espn:check      # verify the ESPN connection
npm run dev             # http://localhost:5173
```

`npm run dev` serves the `/api` routes too, so no extra tooling is needed
locally.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server, including the `/api` routes |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built site (no `/api` routes) |
| `npm test` | Normalizer, records, draft, champion, trade, waiver and poll tests — no network needed |
| `npm run espn:check` | Hit ESPN with your `.env` and print the standings |
| `npm run trades:import` | Recompute the trade and waiver archives for completed seasons |
| `npm run lint` | Oxlint |

## ESPN data

The site reads managers, standings, records, and points for/against from ESPN
through two of our own endpoints:

- `GET /api/league` — managers, standings, records, PF/PA
- `GET /api/matchups?week=3` — the scored schedule

In React:

```jsx
import { useLeague } from './hooks/useEspn.js'

const { data, error, isLoading } = useLeague()
```

**See [docs/espn.md](docs/espn.md)** for setup (including private leagues), the
full response shapes, caching, and how to add more ESPN views.

## The history sheet

The all-time table, the head-to-head grid and the best player weeks — served by
`GET /api/history` and **kept current on its own**. ESPN is read live for every
season it still serves, so a week's results join the record as soon as they're
final; nothing has to be re-imported for the tables to move.

Player scores are the expensive part: ESPN only holds them a week at a time, so
the best-weeks list costs one request per week for any season the workbook
doesn't already cover. Bounded to 90 weeks per response, six in flight at a
time, and only for weeks that were actually played — measured cold at 1.3s for
34 weeks, against a 10s function timeout. The extracted numbers are memoized,
never the megabyte of boxscore they came from.

The **AFFL League History Database** workbook is merged underneath, for the
three things ESPN can't tell us:

| | |
| --- | --- |
| **Sackos** | Not last place — ESPN's final ranking names a different owner every season, so the title is decided by something its payload doesn't model |
| **Player weeks to 2023** | Kept so those seasons cost no requests at all |
| **Forgotten owners** | ESPN reports "Unclaimed" for a team whose owner left mid-season; 2023's CPU Team was Jake Meadors, and only the workbook still knows |
| **Dropped seasons** | ESPN stops serving old years without warning |

Where the two disagree on a score, ESPN wins — the differences are transcription
slips of a tenth or two, none of which change a result. Who counts as a current
owner is read from the newest season's roster, so someone who stops playing
retires on their own.

Re-run the import whenever the workbook is updated — for a new season's sacko,
or to refresh the player weeks:

```bash
python scripts/history/import.py "path/to/AFFL League History Database.xlsx"
```

It needs Python 3 and nothing else — an xlsx is a zip of XML — and rewrites
`src/lib/history/archive.js` (47 KB, server-side only). Most of the workbook's
sheets are calculators rather than data, so the import takes the recorded facts
and everything else is computed from them.

## Trade history

Every trade the league has made, who won it, and the record of who trades well
— served by `GET /api/trades`.

ESPN has a real transaction log and will not show it to us: the endpoints that
carry it (`mTransactions2`, the league's `communication` topics) return nothing
at all without a league member's cookies, for past seasons as well as the
current one. So trades are **reconstructed** from two things ESPN does serve
anonymously:

| | |
| --- | --- |
| **Acquisition records** | Every roster entry carries `acquisitionType: 'TRADE'` and an exact millisecond `acquisitionDate`. Both halves of a trade share that timestamp, so grouping on it recovers the deals — no two have ever collided |
| **Weekly rosters** | `mBoxscore` for a week lists every rostered player with the team holding him, his lineup slot, and what he scored. Week by week that is a full ownership timeline |

The first alone isn't enough: it only sees players still on a roster when the
season ended, and a third of this league's trades look one-sided through it. The
timeline fills in the rest, and is also what makes a trade scoreable.

**A trade is won** by the side whose incoming players scored more from the trade
week onward — counting only weeks they were actually **started**, and only while
they stayed on that roster. A player who arrives and then rides the bench did
nothing for the manager who wanted him, which is the thing being measured.

**FAAB deals are listed but never scored.** The league runs a $200 FAAB budget
and player-for-FAAB trades are common — 13 of the 86 on record. ESPN exposes no
money field anywhere readable (the per-team `acquisitionBudgetSpent` is a
saturated season total that can't be split from waiver spending), so one side
scores zero by construction and no verdict would be honest. They appear in the
list marked as FAAB and sit out of every won/lost figure.

One case stays genuinely ambiguous: a player dropped by one side and claimed off
waivers by the other in the same week is indistinguishable from a player sent
back in the trade. `scripts/test-trades.mjs` asserts that behaviour rather than
hiding it, so a better signal would announce itself by failing that test.

Rebuilding a season costs a roster read per week, so finished seasons are
precomputed and only the live one is fetched per request — see **Keeping the
archives current** below.

## Waiver history

Who works the wire and what they found on it — served by `GET /api/waivers`,
and built from the same weekly rosters the trades use, so it costs no extra
requests.

Two sources that don't overlap, kept deliberately apart:

| | |
| --- | --- |
| **Counted, exact** | Every team carries a `transactionCounter` with the season's adds, drops, FAAB spent and a per-week breakdown. These are ESPN's own tallies and are complete — they're what the activity table reports |
| **Named, reconstructed** | The counters carry no player names, so the pickups come from the weekly ownership timeline: on a roster this week, on nobody's last week. That recovers **about three quarters** of them, and is the only way to say what a pickup went on to score |

The missing quarter are players added and dropped inside the same week, who
never appear in a Sunday snapshot. So the counts and the list disagree on
purpose — 1,621 adds counted against 1,215 named. Anyone arriving from *another*
roster came by trade and isn't counted here.

Pickups are scored the same way trades are (points from the pickup week onward,
while still on that roster, only in weeks actually started) so the two pages are
comparable. Only pickups that reached a lineup are listed: the rest are two
thirds of the rows, all reading nil points off nil starts.

**What nothing can tell us is the price.** ESPN publishes only the season total
per team, never a per-transaction bid, so a pickup can be named and scored but
never costed. For the same reason a waiver claim can't be told apart from a
free-agent add — "pickup" means both.

## Keeping the archives current

Both histories are rebuilt from weekly rosters — one request per week, about a
megabyte each — which is the only expensive thing this site does. Finished
seasons can't change, so they're computed once and written to disk; only the
season being played is read live.

**Re-run the import when a season ends:**

```bash
npm run trades:import              # every completed season
npm run trades:import -- --seasons 2025
```

One pass writes both `src/lib/trades/archive.js` (~100 KB) and
`src/lib/waivers/archive.js` (~355 KB), server-side only. A finished season the
archives have never seen is reported in `unarchivedSeasons` rather than fetched,
so one forgotten import can't turn a cold response into eighty requests — but
that season's trades and pickups will be missing from the page until it's run.

## The managers' poll

The one part of the site that isn't read-only. Managers rank the league between
Tuesday midnight and Thursday noon, starting the week after week 1 is played,
and the results stand until the next poll opens. Votes live in Supabase; set
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `POLL_IP_SALT` to switch it on.

**See [docs/poll.md](docs/poll.md)** for the schema, the setup steps, and an
honest account of what the double-vote check does and doesn't stop.

## Deploying

Netlify builds from `netlify.toml`. Set `ESPN_LEAGUE_ID` (and `ESPN_S2` /
`ESPN_SWID` for a private league) under **Site configuration → Environment
variables**. The `netlify/functions/*.mjs` files declare their own routes, so no
redirect config is needed for the API.
