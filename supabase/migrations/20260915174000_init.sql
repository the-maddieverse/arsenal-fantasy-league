create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 3 and 80),
  commissioner_id uuid not null references public.profiles(id) on delete restrict,
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{6,12}$'),
  registration_open boolean not null default true,
  budget_million numeric(4,1) not null default 45.0 check (budget_million between 35.0 and 65.0),
  starting_gameweek_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_commissioner boolean not null default false,
  created_at timestamptz not null default now(),
  unique (league_id, profile_id)
);

create table if not exists public.football_teams (
  id uuid primary key default gen_random_uuid(),
  external_id integer not null unique,
  name text not null,
  short_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.football_players (
  id uuid primary key default gen_random_uuid(),
  external_id integer not null unique,
  team_id uuid not null references public.football_teams(id) on delete restrict,
  name text not null,
  position text not null check (position in ('GKP', 'DEF', 'MID', 'FWD')),
  price numeric(4,1) not null check (price > 0),
  status text,
  total_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gameweeks (
  id uuid primary key default gen_random_uuid(),
  external_id integer not null unique,
  name text not null,
  deadline_at timestamptz not null,
  is_current boolean not null default false,
  is_finished boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leagues
  add constraint leagues_starting_gameweek_id_fkey
  foreign key (starting_gameweek_id) references public.gameweeks(id) on delete restrict;

create table if not exists public.player_gameweek_points (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.football_players(id) on delete cascade,
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  points integer not null,
  minutes integer not null default 0,
  status text,
  imported_at timestamptz not null default now(),
  unique (player_id, gameweek_id)
);

create table if not exists public.manager_squads (
  id uuid primary key default gen_random_uuid(),
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  valid_from_gameweek_id uuid references public.gameweeks(id) on delete restrict,
  captain_player_id uuid references public.football_players(id),
  vice_captain_player_id uuid references public.football_players(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (captain_player_id is null or vice_captain_player_id is null or captain_player_id <> vice_captain_player_id)
);

create unique index if not exists manager_squads_one_active_per_member_idx
  on public.manager_squads(league_member_id) where is_active;

create table if not exists public.squad_players (
  id uuid primary key default gen_random_uuid(),
  manager_squad_id uuid not null references public.manager_squads(id) on delete cascade,
  player_id uuid not null references public.football_players(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (manager_squad_id, player_id)
);

create table if not exists public.gameweek_squad_snapshots (
  id uuid primary key default gen_random_uuid(),
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  captain_player_id uuid references public.football_players(id),
  vice_captain_player_id uuid references public.football_players(id),
  created_at timestamptz not null default now(),
  unique (league_member_id, gameweek_id)
);

create table if not exists public.snapshot_players (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.gameweek_squad_snapshots(id) on delete cascade,
  player_id uuid not null references public.football_players(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (snapshot_id, player_id)
);

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  from_player_id uuid not null references public.football_players(id) on delete restrict,
  to_player_id uuid not null references public.football_players(id) on delete restrict,
  requested_at timestamptz not null default now(),
  applies_to_gameweek_id uuid not null references public.gameweeks(id) on delete restrict,
  penalty_points integer not null default 0 check (penalty_points >= 0),
  created_at timestamptz not null default now(),
  check (from_player_id <> to_player_id)
);

create table if not exists public.manager_gameweek_scores (
  id uuid primary key default gen_random_uuid(),
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  raw_points integer not null default 0,
  captain_bonus_points integer not null default 0,
  transfer_penalty_points integer not null default 0,
  gameweek_points integer not null default 0,
  total_points integer not null default 0,
  gameweek_win boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_member_id, gameweek_id)
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete cascade,
  source text not null check (source in ('manual', 'scheduled', 'post-match', 'in-play', 'finalize')),
  status text not null check (status in ('running', 'success', 'failed')),
  message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists league_members_profile_idx on public.league_members(profile_id);
create index if not exists football_players_team_idx on public.football_players(team_id);
create index if not exists player_gameweek_points_gameweek_idx on public.player_gameweek_points(gameweek_id);
create index if not exists squad_players_squad_idx on public.squad_players(manager_squad_id);
create index if not exists transfers_member_gameweek_idx on public.transfers(league_member_id, applies_to_gameweek_id);
create index if not exists manager_gameweek_scores_member_idx on public.manager_gameweek_scores(league_member_id);
create index if not exists sync_runs_league_created_idx on public.sync_runs(league_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_profiles before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at_leagues before update on public.leagues for each row execute function public.set_updated_at();
create trigger set_updated_at_football_teams before update on public.football_teams for each row execute function public.set_updated_at();
create trigger set_updated_at_football_players before update on public.football_players for each row execute function public.set_updated_at();
create trigger set_updated_at_gameweeks before update on public.gameweeks for each row execute function public.set_updated_at();
create trigger set_updated_at_manager_squads before update on public.manager_squads for each row execute function public.set_updated_at();
create trigger set_updated_at_manager_gameweek_scores before update on public.manager_gameweek_scores for each row execute function public.set_updated_at();

create or replace function public.prevent_transfer_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Transfers are immutable';
end;
$$;

create trigger prevent_transfer_updates before update or delete on public.transfers
for each row execute function public.prevent_transfer_mutation();

create or replace function public.validate_captaincy_in_squad()
returns trigger
language plpgsql
as $$
declare
  captain_in_squad boolean;
  vice_in_squad boolean;
begin
  if new.captain_player_id is null and new.vice_captain_player_id is null then
    return new;
  end if;

  if new.captain_player_id is not null then
    select exists (
      select 1 from public.squad_players sp
      where sp.manager_squad_id = new.id and sp.player_id = new.captain_player_id
    ) into captain_in_squad;
    if not captain_in_squad then
      raise exception 'Captain must be selected from squad players';
    end if;
  end if;

  if new.vice_captain_player_id is not null then
    select exists (
      select 1 from public.squad_players sp
      where sp.manager_squad_id = new.id and sp.player_id = new.vice_captain_player_id
    ) into vice_in_squad;
    if not vice_in_squad then
      raise exception 'Vice captain must be selected from squad players';
    end if;
  end if;

  return new;
end;
$$;

create constraint trigger validate_captaincy_on_squads
after insert or update on public.manager_squads
deferrable initially deferred
for each row execute function public.validate_captaincy_in_squad();

create or replace function public.league_started(league_row public.leagues)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.gameweeks gw
    where gw.id = league_row.starting_gameweek_id and gw.deadline_at <= now()
  );
$$;

create or replace function public.prevent_starting_gameweek_change_after_start()
returns trigger
language plpgsql
as $$
begin
  if old.starting_gameweek_id is distinct from new.starting_gameweek_id and public.league_started(old) then
    raise exception 'Cannot change starting gameweek once the first counted gameweek has begun';
  end if;
  return new;
end;
$$;

create trigger prevent_starting_gw_change
before update on public.leagues
for each row execute function public.prevent_starting_gameweek_change_after_start();

create or replace function public.is_league_member(league uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.league_members lm
    where lm.league_id = league and lm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_commissioner(league uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.leagues l
    where l.id = league and l.commissioner_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.football_teams enable row level security;
alter table public.football_players enable row level security;
alter table public.gameweeks enable row level security;
alter table public.player_gameweek_points enable row level security;
alter table public.manager_squads enable row level security;
alter table public.squad_players enable row level security;
alter table public.gameweek_squad_snapshots enable row level security;
alter table public.snapshot_players enable row level security;
alter table public.transfers enable row level security;
alter table public.manager_gameweek_scores enable row level security;
alter table public.sync_runs enable row level security;

create policy profiles_self_read on public.profiles for select using (id = auth.uid());
create policy profiles_self_upsert on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy leagues_member_read on public.leagues for select using (public.is_league_member(id));
create policy leagues_create on public.leagues for insert with check (commissioner_id = auth.uid());
create policy leagues_commissioner_update on public.leagues for update using (commissioner_id = auth.uid()) with check (commissioner_id = auth.uid());

create policy members_league_read on public.league_members for select using (public.is_league_member(league_id));
create policy members_join_open on public.league_members for insert with check (
  profile_id = auth.uid() and exists (
    select 1 from public.leagues l where l.id = league_id and l.registration_open = true
  )
);
create policy members_commissioner_manage on public.league_members for delete using (public.is_commissioner(league_id));

create policy football_teams_read on public.football_teams for select to authenticated using (true);
create policy football_players_read on public.football_players for select to authenticated using (true);
create policy gameweeks_read on public.gameweeks for select to authenticated using (true);
create policy player_points_read on public.player_gameweek_points for select to authenticated using (true);

create policy squads_read on public.manager_squads for select using (
  exists (
    select 1 from public.league_members lm where lm.id = league_member_id and public.is_league_member(lm.league_id)
  )
);
create policy squads_write_self on public.manager_squads for insert with check (
  exists (
    select 1 from public.league_members lm where lm.id = league_member_id and lm.profile_id = auth.uid()
  )
);
create policy squads_update_self on public.manager_squads for update using (
  exists (
    select 1 from public.league_members lm where lm.id = league_member_id and lm.profile_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.league_members lm where lm.id = league_member_id and lm.profile_id = auth.uid()
  )
);

create policy squad_players_read on public.squad_players for select using (
  exists (
    select 1 from public.manager_squads ms
    join public.league_members lm on lm.id = ms.league_member_id
    where ms.id = manager_squad_id and public.is_league_member(lm.league_id)
  )
);
create policy squad_players_write on public.squad_players for all using (
  exists (
    select 1 from public.manager_squads ms
    join public.league_members lm on lm.id = ms.league_member_id
    where ms.id = manager_squad_id and lm.profile_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.manager_squads ms
    join public.league_members lm on lm.id = ms.league_member_id
    where ms.id = manager_squad_id and lm.profile_id = auth.uid()
  )
);

create policy snapshots_read on public.gameweek_squad_snapshots for select using (
  exists (
    select 1 from public.league_members lm where lm.id = league_member_id and public.is_league_member(lm.league_id)
  )
);
create policy snapshot_players_read on public.snapshot_players for select using (
  exists (
    select 1
    from public.gameweek_squad_snapshots gss
    join public.league_members lm on lm.id = gss.league_member_id
    where gss.id = snapshot_id and public.is_league_member(lm.league_id)
  )
);

create policy transfers_read on public.transfers for select using (
  exists (
    select 1 from public.league_members lm where lm.id = league_member_id and public.is_league_member(lm.league_id)
  )
);
create policy transfers_insert_self on public.transfers for insert with check (
  exists (
    select 1 from public.league_members lm where lm.id = league_member_id and lm.profile_id = auth.uid()
  )
);

create policy scores_read on public.manager_gameweek_scores for select using (
  exists (
    select 1 from public.league_members lm where lm.id = league_member_id and public.is_league_member(lm.league_id)
  )
);

create policy sync_runs_read on public.sync_runs for select using (
  league_id is null or public.is_league_member(league_id)
);
create policy sync_runs_commissioner_insert on public.sync_runs for insert with check (
  league_id is null or public.is_commissioner(league_id)
);
