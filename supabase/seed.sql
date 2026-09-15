insert into public.football_teams (external_id, name, short_name)
values (3, 'Arsenal', 'ARS')
on conflict (external_id) do update
set name = excluded.name,
    short_name = excluded.short_name,
    updated_at = now();

with arsenal as (
  select id from public.football_teams where external_id = 3
)
insert into public.football_players (external_id, team_id, name, position, price, status, total_points)
select *
from (
  values
    (101, (select id from arsenal), 'David Raya', 'GKP', 5.5, 'a', 0),
    (102, (select id from arsenal), 'William Saliba', 'DEF', 6.0, 'a', 0),
    (103, (select id from arsenal), 'Gabriel Magalhães', 'DEF', 6.0, 'a', 0),
    (104, (select id from arsenal), 'Martin Ødegaard', 'MID', 8.5, 'a', 0),
    (105, (select id from arsenal), 'Bukayo Saka', 'MID', 10.0, 'a', 0),
    (106, (select id from arsenal), 'Kai Havertz', 'FWD', 8.0, 'a', 0)
) as seed_players (external_id, team_id, name, position, price, status, total_points)
on conflict (external_id) do update
set team_id = excluded.team_id,
    name = excluded.name,
    position = excluded.position,
    price = excluded.price,
    status = excluded.status,
    total_points = excluded.total_points,
    updated_at = now();
