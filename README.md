# New Avengers Fantasy Football

### 🌐 [avengersfantasyfootball.com](https://avengersfantasyfootball.com/)

This is the source for the New Avengers fantasy football league's website. It's a
personal project for our league, not a template or a package, so it isn't set up
for anyone else to use.

## What's on the site

- **Standings & Schedule**: live from ESPN
- **Champions**: every title winner, with covers
- **Managers**: a profile for each manager, plus head-to-head records
- **Managers' Poll**: the weekly power-ranking vote (and the preseason one)
- **Records**: all-time highs and lows
- **Draft History**
- **History Sheet**: the all-time table and best player weeks
- **Trade History**: every trade, scored by who won it
- **Waiver History**: who works the wire and what they found

## How it's built

React + Vite on the front end, with Netlify Functions in `netlify/functions/` for
the `/api/*` routes. League data comes live from the ESPN Fantasy API. Poll votes
are stored in Supabase.

Secrets live in `.env` locally (gitignored) and in Netlify's environment
variables in production. `.env.example` lists the keys.

## Running it locally

```bash
npm install
npm run dev        # http://localhost:5173, /api routes included
npm test           # no network needed
npm run espn:check # confirm ESPN is reachable
```

## Yearly chores

**When a season ends**
- `npm run trades:import`: archives the finished season's trades and waivers
- Update the AFFL League History Database workbook (the Sacko, etc.), then run
  `python scripts/history/import.py "path/to/AFFL League History Database.xlsx"`

**Before the next season**
- Update `WEEK_1` and the preseason poll dates in `src/lib/schedule/calendar.js`
  (`npm test` fails if they're stale)
- Refresh `ESPN_S2` / `ESPN_SWID` in Netlify if ESPN starts returning 401s

## Notes

More detail lives in [docs/espn.md](docs/espn.md) (ESPN endpoints and data
shapes) and [docs/poll.md](docs/poll.md) (poll schema and the double-vote rules).
