create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text not null default 'An unofficial Arsenal supporter fantasy league.',
  invite_code text not null unique,
  commissioner_id uuid not null references public.profiles(id) on delete restrict,
  is_private boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  manager_name text not null,
  draft_position int not null check (draft_position between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (league_id, user_id),
  unique (league_id, manager_name),
  unique (league_id, draft_position)
);

create table if not exists public.players (
  id bigint primary key,
  name text not null,
  position text not null check (position in ('GK', 'DEF', 'MID', 'FWD')),
  team_short_name text not null,
  now_cost int not null default 0,
  selected_by_percent numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.gameweeks (
  id int primary key,
  deadline_time timestamptz,
  finished boolean not null default false,
  data_checked_at timestamptz not null default now()
);

create table if not exists public.player_gameweek_stats (
  player_id bigint not null references public.players(id) on delete cascade,
  gameweek_id int not null references public.gameweeks(id) on delete cascade,
  minutes int not null default 0,
  points int not null default 0,
  goals int not null default 0,
  assists int not null default 0,
  clean_sheets int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (player_id, gameweek_id)
);

create table if not exists public.drafts (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed', 'complete')),
  current_pick int not null default 1,
  rounds int not null default 5 check (rounds = 5),
  updated_at timestamptz not null default now()
);

create table if not exists public.draft_picks (
  id bigserial primary key,
  league_id uuid not null references public.leagues(id) on delete cascade,
  round_number int not null check (round_number between 1 and 5),
  pick_in_round int not null check (pick_in_round between 1 and 5),
  overall_pick int not null check (overall_pick between 1 and 25),
  manager_id uuid not null references public.profiles(id) on delete cascade,
  player_id bigint not null references public.players(id) on delete restrict,
  drafted_at timestamptz not null default now(),
  unique (league_id, overall_pick),
  unique (league_id, player_id)
);

create table if not exists public.rosters (
  id bigserial primary key,
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  player_id bigint not null references public.players(id) on delete restrict,
  acquired_via text not null check (acquired_via in ('draft', 'transfer', 'waiver')),
  acquired_at timestamptz not null default now(),
  dropped_at timestamptz,
  unique (league_id, user_id, player_id, acquired_at)
);

create unique index if not exists rosters_active_player_uniq
  on public.rosters(league_id, player_id)
  where dropped_at is null;

create table if not exists public.captain_choices (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  gameweek_id int not null references public.gameweeks(id) on delete cascade,
  captain_player_id bigint not null references public.players(id) on delete restrict,
  vice_captain_player_id bigint not null references public.players(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id, gameweek_id),
  check (captain_player_id <> vice_captain_player_id)
);

create table if not exists public.waiver_claims (
  id bigserial primary key,
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  add_player_id bigint not null references public.players(id) on delete restrict,
  drop_player_id bigint references public.players(id) on delete restrict,
  priority int not null check (priority between 1 and 5),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.transactions (
  id bigserial primary key,
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('draft', 'waiver_add', 'waiver_drop', 'captain_update', 'commissioner_action')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_user_league()
returns uuid
language sql
stable
as $$
  select lm.league_id
  from public.league_members lm
  where lm.user_id = auth.uid()
  order by lm.created_at asc
  limit 1;
$$;

create or replace function public.expected_manager_for_pick(p_league_id uuid, p_pick int)
returns uuid
language plpgsql
stable
as $$
declare
  manager_count int;
  round_number int;
  pick_in_round int;
  draft_pos int;
  manager_id uuid;
begin
  select count(*) into manager_count from public.league_members where league_id = p_league_id;
  if manager_count <> 5 then
    raise exception 'League must have exactly 5 managers before drafting';
  end if;

  round_number := ((p_pick - 1) / manager_count) + 1;
  pick_in_round := ((p_pick - 1) % manager_count) + 1;

  if mod(round_number, 2) = 1 then
    draft_pos := pick_in_round;
  else
    draft_pos := manager_count - pick_in_round + 1;
  end if;

  select lm.user_id into manager_id
  from public.league_members lm
  where lm.league_id = p_league_id
    and lm.draft_position = draft_pos;

  return manager_id;
end;
$$;

create or replace function public.join_league_by_code(p_invite_code text, p_manager_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  league_rec public.leagues;
  taken_positions int[];
  chosen_position int;
  existing_count int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into league_rec
  from public.leagues
  where invite_code = upper(trim(p_invite_code));

  if league_rec.id is null then
    if upper(trim(p_invite_code)) = 'NORTHBANK' then
      insert into public.leagues (name, invite_code, commissioner_id)
      values ('North Bank Fantasy', 'NORTHBANK', auth.uid())
      returning * into league_rec;
    else
      raise exception 'Invalid invite code';
    end if;
  end if;

  if exists (
    select 1 from public.league_members
    where league_id = league_rec.id and user_id = auth.uid()
  ) then
    return league_rec.id;
  end if;

  select count(*) into existing_count from public.league_members where league_id = league_rec.id;
  if existing_count >= 5 then
    raise exception 'League is already full';
  end if;

  select array_agg(draft_position order by draft_position)
  into taken_positions
  from public.league_members
  where league_id = league_rec.id;

  for chosen_position in 1..5 loop
    if taken_positions is null or not chosen_position = any(taken_positions) then
      exit;
    end if;
  end loop;

  insert into public.league_members (league_id, user_id, manager_name, draft_position)
  values (league_rec.id, auth.uid(), trim(p_manager_name), chosen_position);

  insert into public.transactions (league_id, user_id, transaction_type, details)
  values (league_rec.id, auth.uid(), 'commissioner_action', jsonb_build_object('action', 'joined_league', 'manager_name', trim(p_manager_name)));

  insert into public.drafts (league_id)
  values (league_rec.id)
  on conflict (league_id) do nothing;

  return league_rec.id;
end;
$$;

create or replace function public.make_draft_pick(p_league_id uuid, p_player_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_row public.drafts;
  manager_id uuid;
  my_team_count int;
  player_position text;
  existing_pos_count int;
  pick_no int;
  round_number int;
  pick_in_round int;
  pos_limit int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into draft_row from public.drafts where league_id = p_league_id for update;
  if draft_row.league_id is null then
    raise exception 'Draft not initialized';
  end if;

  if draft_row.status <> 'open' then
    raise exception 'Draft is not open';
  end if;

  if not exists (
    select 1 from public.league_members lm
    where lm.league_id = p_league_id and lm.user_id = auth.uid()
  ) then
    raise exception 'You are not in this league';
  end if;

  manager_id := public.expected_manager_for_pick(p_league_id, draft_row.current_pick);
  if manager_id <> auth.uid() then
    raise exception 'It is not your turn';
  end if;

  if exists (
    select 1 from public.rosters r
    where r.league_id = p_league_id
      and r.player_id = p_player_id
      and r.dropped_at is null
  ) then
    raise exception 'Player already drafted';
  end if;

  select position into player_position from public.players where id = p_player_id;
  if player_position is null then
    raise exception 'Unknown player';
  end if;

  select count(*) into my_team_count
  from public.rosters r
  where r.league_id = p_league_id and r.user_id = auth.uid() and r.dropped_at is null;

  if my_team_count >= 5 then
    raise exception 'Roster is full';
  end if;

  pos_limit := case player_position
    when 'GK' then 1
    when 'DEF' then 1
    when 'MID' then 2
    when 'FWD' then 1
    else 0
  end;

  select count(*) into existing_pos_count
  from public.rosters r
  join public.players p on p.id = r.player_id
  where r.league_id = p_league_id
    and r.user_id = auth.uid()
    and r.dropped_at is null
    and p.position = player_position;

  if existing_pos_count >= pos_limit then
    raise exception 'Roster already has maximum for %', player_position;
  end if;

  pick_no := draft_row.current_pick;
  round_number := ((pick_no - 1) / 5) + 1;
  pick_in_round := ((pick_no - 1) % 5) + 1;

  insert into public.draft_picks (league_id, round_number, pick_in_round, overall_pick, manager_id, player_id)
  values (p_league_id, round_number, pick_in_round, pick_no, auth.uid(), p_player_id);

  insert into public.rosters (league_id, user_id, player_id, acquired_via)
  values (p_league_id, auth.uid(), p_player_id, 'draft');

  insert into public.transactions (league_id, user_id, transaction_type, details)
  values (
    p_league_id,
    auth.uid(),
    'draft',
    jsonb_build_object('player_id', p_player_id, 'overall_pick', pick_no, 'round', round_number)
  );

  update public.drafts
  set current_pick = current_pick + 1,
      status = case when current_pick + 1 > 25 then 'complete' else status end,
      updated_at = now()
  where league_id = p_league_id;

  return p_player_id;
end;
$$;

create or replace function public.process_waiver_claim(p_claim_id bigint, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  claim public.waiver_claims;
  is_commissioner boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into claim from public.waiver_claims where id = p_claim_id for update;
  if claim.id is null then
    raise exception 'Claim not found';
  end if;

  select exists(
    select 1 from public.leagues l where l.id = claim.league_id and l.commissioner_id = auth.uid()
  ) into is_commissioner;

  if not is_commissioner then
    raise exception 'Only commissioner can process claims';
  end if;

  if claim.status <> 'pending' then
    raise exception 'Claim already processed';
  end if;

  if p_approve then
    if claim.drop_player_id is not null then
      update public.rosters
      set dropped_at = now()
      where league_id = claim.league_id
        and user_id = claim.user_id
        and player_id = claim.drop_player_id
        and dropped_at is null;

      insert into public.transactions (league_id, user_id, transaction_type, details)
      values (claim.league_id, claim.user_id, 'waiver_drop', jsonb_build_object('player_id', claim.drop_player_id, 'claim_id', claim.id));
    end if;

    insert into public.rosters (league_id, user_id, player_id, acquired_via)
    values (claim.league_id, claim.user_id, claim.add_player_id, 'waiver');

    insert into public.transactions (league_id, user_id, transaction_type, details)
    values (claim.league_id, claim.user_id, 'waiver_add', jsonb_build_object('player_id', claim.add_player_id, 'claim_id', claim.id));
  end if;

  update public.waiver_claims
  set status = case when p_approve then 'approved' else 'rejected' end,
      processed_at = now(),
      processed_by = auth.uid()
  where id = claim.id;
end;
$$;

create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.on_auth_user_created();

insert into public.leagues (name, invite_code, commissioner_id)
select 'North Bank Fantasy', 'NORTHBANK', p.id
from public.profiles p
order by p.created_at asc
limit 1
on conflict (invite_code) do nothing;

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.players enable row level security;
alter table public.gameweeks enable row level security;
alter table public.player_gameweek_stats enable row level security;
alter table public.drafts enable row level security;
alter table public.draft_picks enable row level security;
alter table public.rosters enable row level security;
alter table public.captain_choices enable row level security;
alter table public.waiver_claims enable row level security;
alter table public.transactions enable row level security;

create policy "Profiles are readable by authenticated users" on public.profiles
for select to authenticated using (true);

create policy "Users can update own profile" on public.profiles
for update to authenticated using (auth.uid() = id);

create policy "Members can read leagues" on public.leagues
for select to authenticated using (
  exists (
    select 1 from public.league_members lm
    where lm.league_id = leagues.id and lm.user_id = auth.uid()
  )
);

create policy "Commissioner can update league" on public.leagues
for update to authenticated using (commissioner_id = auth.uid());

create policy "Members can read members" on public.league_members
for select to authenticated using (
  exists (
    select 1 from public.league_members lm
    where lm.league_id = league_members.league_id and lm.user_id = auth.uid()
  )
);

create policy "Users can insert own membership" on public.league_members
for insert to authenticated with check (auth.uid() = user_id);

create policy "Members can read players" on public.players
for select to authenticated using (
  exists (
    select 1 from public.league_members lm
    where lm.user_id = auth.uid()
  )
);

create policy "Members can read gameweeks" on public.gameweeks
for select to authenticated using (exists (select 1 from public.league_members lm where lm.user_id = auth.uid()));

create policy "Members can read player stats" on public.player_gameweek_stats
for select to authenticated using (exists (select 1 from public.league_members lm where lm.user_id = auth.uid()));

create policy "Members can read drafts" on public.drafts
for select to authenticated using (
  exists (
    select 1 from public.league_members lm
    where lm.league_id = drafts.league_id and lm.user_id = auth.uid()
  )
);

create policy "Members can read draft picks" on public.draft_picks
for select to authenticated using (
  exists (
    select 1 from public.league_members lm
    where lm.league_id = draft_picks.league_id and lm.user_id = auth.uid()
  )
);

create policy "Members can read rosters" on public.rosters
for select to authenticated using (
  exists (
    select 1 from public.league_members lm
    where lm.league_id = rosters.league_id and lm.user_id = auth.uid()
  )
);

create policy "Members can manage own captains" on public.captain_choices
for all to authenticated using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Members can read claims" on public.waiver_claims
for select to authenticated using (
  exists (
    select 1 from public.league_members lm
    where lm.league_id = waiver_claims.league_id and lm.user_id = auth.uid()
  )
);

create policy "Members can insert own claims" on public.waiver_claims
for insert to authenticated with check (auth.uid() = user_id);

create policy "Members can read transactions" on public.transactions
for select to authenticated using (
  exists (
    select 1 from public.league_members lm
    where lm.league_id = transactions.league_id and lm.user_id = auth.uid()
  )
);

grant execute on function public.join_league_by_code(text, text) to authenticated;
grant execute on function public.make_draft_pick(uuid, bigint) to authenticated;
grant execute on function public.process_waiver_claim(bigint, boolean) to authenticated;
