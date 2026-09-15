# Arsenal Fantasy League

Private, mobile-first, Arsenal-only fantasy football web app built with React + Vite + TypeScript and Supabase.

## Features

- Supabase Auth sign-up/sign-in/sign-out with display names
- Private leagues with join codes and commissioner ownership
- Arsenal-only player pool, imported from official FPL API via secure server-side edge function
- Gameweek and player point imports with idempotent upserts
- League starting gameweek support (past gameweeks excluded)
- Transfer, squad, snapshot, score, and sync run data model
- RLS-enabled PostgreSQL schema to prevent unauthorized writes
- Required public/authenticated/commissioner screens scaffolded
- Loading, error, and empty-state UI components
- Basic automated rules tests (captain fallback, transfer penalties, squad validation)

## Tech Stack

- React + Vite + TypeScript
- Supabase (Postgres + Auth + Edge Functions)
- GitHub Actions (deploy + scheduled data sync)

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

3. Fill in client-safe values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

4. Run development server:

```bash
npm run dev
```

## Database setup (Supabase)

Apply migrations in `supabase/migrations` and then run `supabase/seed.sql`.

Core tables include:

- `profiles`
- `leagues`
- `league_members`
- `football_teams`
- `football_players`
- `gameweeks`
- `player_gameweek_points`
- `manager_squads`
- `squad_players`
- `gameweek_squad_snapshots`
- `snapshot_players`
- `transfers`
- `manager_gameweek_scores`
- `sync_runs`

Highlights:

- Unique constraints stop duplicate memberships and duplicate point rows
- Partial unique index enforces one active squad per manager
- Captain/vice-captain integrity checks
- Immutable transfers via trigger
- Starting gameweek update blocked after league start
- RLS policies for member access and commissioner-only actions
- Score and imported-point protection from client-side manipulation

## Data synchronization

Edge function: `supabase/functions/sync-football-data/index.ts`

- Fetches FPL data server-side
- Filters to Arsenal players only
- Stores external player IDs
- Upserts teams, players, gameweeks, and gameweek points idempotently
- Logs each run in `sync_runs`
- Returns temporary-unavailable errors cleanly for UI handling

## Workflows

### Deploy (`.github/workflows/deploy.yml`)

Builds and deploys static frontend to GitHub Pages.

Required secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Data sync (`.github/workflows/sync-football-data.yml`)

Runs scheduled function calls (regular, pre-match windows, and manual trigger).

Required secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Tests

Run:

```bash
npm test
```

## Build

```bash
npm run build
```
