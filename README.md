# North Bank Fantasy

An unofficial Arsenal supporter fantasy league.

North Bank Fantasy is a private, shared multiplayer fantasy app for **5 managers** using an Arsenal-only player pool.

## Stack

- React + TypeScript (Vite)
- Supabase (Auth, Postgres, RLS, Edge Functions)
- Mobile-first dark UI with Arsenal-inspired colors

## Features implemented

- Email/password user accounts
- Private league join by invite code (`NORTHBANK`)
- 5-manager snake draft room
- No duplicate player ownership (DB-enforced)
- Arsenal player list with search/filter
- Roster shape enforcement (1 GK, 1 DEF, 2 MID, 1 FWD)
- Captain + vice-captain support
- Automatic points ingestion support via Supabase Edge Function
- Weekly leaderboard
- Waiver claim flow + transaction history
- Commissioner controls (draft open/close/complete, waiver processing)

## Quick start (local)

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Set values in `.env`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

4. Run app:

```bash
npm run dev
```

## Supabase setup

1. Create a Supabase project.
2. Run SQL migration in `supabase/migrations/20260915175000_init_north_bank_fantasy.sql`.
3. Deploy Edge Function:

```bash
supabase functions deploy sync-arsenal-data
```

4. Set Edge Function secrets:

```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

5. Schedule automatic updates (recommended hourly) by invoking:

- `POST /functions/v1/sync-arsenal-data`

Use Supabase Scheduled Functions or an external scheduler.

## Database schema highlights

- `profiles` – user profile metadata linked to `auth.users`
- `leagues` – private league config + commissioner
- `league_members` – 5 managers with fixed draft positions
- `players` – Arsenal-only FPL player pool
- `gameweeks`, `player_gameweek_stats` – official gameweek points/minutes
- `drafts`, `draft_picks` – snake draft state and picks
- `rosters` – active ownership (partial unique index blocks duplicates)
- `captain_choices` – captain and vice-captain per gameweek
- `waiver_claims`, `transactions` – transfers/waiver pipeline and logs

## Tests

Run focused tests:

```bash
npm test
```

Included tests validate:

- Snake draft turn ordering
- Roster position limits
- Captain/vice-captain points logic

## Build

```bash
npm run build
```

## Deploy frontend

Deploy to Vercel/Netlify/Cloudflare Pages using:

- Build command: `npm run build`
- Output directory: `dist`
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
