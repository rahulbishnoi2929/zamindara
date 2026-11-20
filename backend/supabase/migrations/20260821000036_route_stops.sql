-- Stage 4.7: a migrant combine's route, as dated stops.
--
-- A combine from Ganganagar follows the harvest north: Sirsa this week,
-- Fazilka the next. captains.planned_route (text[]) was meant to hold that,
-- but a list of names has no dates and no place on a map, so dispatch could
-- never use it. Nothing writes or reads it; it stays, because an installed
-- APK might, and is no longer the place for this.
--
-- One deviation from the design note, which said (captain, region, dates):
-- regions have no boundary (02_regions.sql; seeded without one), so a region
-- cannot say whether a field is in reach. A stop is a named place on the
-- map instead, the same kind of point as his base.

comment on column public.captains.planned_route is
  'Superseded by captain_route_stops (4.7). Not written; kept for installed builds.';

create table public.captain_route_stops (
  id          uuid primary key default gen_random_uuid(),
  captain_id  uuid not null default auth.uid()
              references public.captains(profile_id) on delete cascade on update cascade,
  place       text not null,
  location    geography(Point, 4326) not null,
  from_date   date not null,
  to_date     date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint route_stop_place check (length(btrim(place)) between 1 and 80),
  constraint route_stop_dates check (to_date >= from_date and to_date - from_date <= 120)
);

create index captain_route_stops_location_idx on public.captain_route_stops using gist (location);
create index captain_route_stops_captain_idx on public.captain_route_stops (captain_id, from_date);

create trigger captain_route_stops_touch
  before update on public.captain_route_stops
  for each row execute function public.touch_updated_at();

-- He cannot be in two places on one day. Without this, which stop wins is
-- an accident of row order.
create function public.route_stops_no_overlap()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if exists (
    select 1 from public.captain_route_stops s
    where s.captain_id = new.captain_id
      and s.id <> new.id
      and s.from_date <= new.to_date
      and new.from_date <= s.to_date
  ) then
    raise exception 'that overlaps another stop on your route' using errcode = '23P01';
  end if;
  return new;
end;
$fn$;

create trigger captain_route_stops_no_overlap
  before insert or update on public.captain_route_stops
  for each row execute function public.route_stops_no_overlap();

alter table public.captain_route_stops enable row level security;

-- His own route is his to write. Farmers do not see it: where a man will be
-- with a machine worth lakhs is his business until he takes a job.
create policy captain_route_stops_own on public.captain_route_stops
  for all to authenticated
  using (captain_id = auth.uid())
  with check (captain_id = auth.uid());

create policy captain_route_stops_read_staff on public.captain_route_stops
  for select to authenticated
  using (public.is_admin());

-- eligible_captains as in 0034, with where he will be (marked 4.7) in
-- place of where he is.
create or replace function public.eligible_captains(
  p_field_id     uuid,
  p_service_id   uuid,
  p_starts_at    timestamptz default now(),
  p_limit        integer default 5
)
returns table (
  captain_id   uuid,
  distance_km  numeric,
  rating_avg   numeric,
  queue_load   integer,
  match_score  numeric
)
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  with field as (
    select centroid, area_sqm from public.fields where id = p_field_id
  ),
  -- 4.7: where each captain will be. For work more than twelve hours out, a
  -- route stop covering that day says where he will be, and wins over where
  -- he is now. Otherwise, as before: online, at his live location. Two
  -- branches rather than one coalesce so each keeps its spatial index
  -- (see 0018).
  later as (
    select p_starts_at > now() + interval '12 hours' as yes,
           (p_starts_at at time zone 'Asia/Kolkata')::date as day
  ),
  located as (
    select c.profile_id, c.current_location as at
    from public.captains c
    cross join field f
    cross join later lt
    where c.is_online
      and c.current_location is not null
      and extensions.st_dwithin(c.current_location, f.centroid, 200000)
      and not (lt.yes and exists (
        select 1 from public.captain_route_stops rs
        where rs.captain_id = c.profile_id and lt.day between rs.from_date and rs.to_date
      ))
    union all
    select rs.captain_id, rs.location
    from public.captain_route_stops rs
    cross join field f
    cross join later lt
    where lt.yes
      and lt.day between rs.from_date and rs.to_date
      and extensions.st_dwithin(rs.location, f.centroid, 200000)
  ),
  lead_hours as (
    select greatest(0, extract(epoch from (p_starts_at - now())) / 3600)::numeric as available
  ),
  candidates as (
    select
      c.profile_id,
      public.road_km(lc.at, f.centroid) as km,
      c.rating_avg,
      -- 4.6: per machine.
      (
        coalesce((
          select min(per_machine.n)
          from (
            select count(j.id)::integer as n
            from public.captain_machines cm2
            join public.services s2
              on s2.id = p_service_id and s2.machine_type_id = cm2.machine_type_id
            left join public.jobs j
              on j.machine_id = cm2.id
             and j.status in ('accepted', 'en_route', 'in_progress')
            where cm2.captain_id = c.profile_id and cm2.is_active
            group by cm2.id
          ) per_machine
        ), 0)
        + (
          select count(*)::integer
          from public.jobs j
          where j.captain_id = c.profile_id
            and j.machine_id is null
            and j.status in ('accepted', 'en_route', 'in_progress')
        )
      ) as queue_load,
      (
        select count(*) filter (where d.response = 'accepted')::numeric
             / nullif(count(*) filter (
                 where d.response in ('accepted', 'declined', 'timed_out')
               ), 0)
        from public.job_dispatch d
        where d.captain_id = c.profile_id
      ) as accept_rate
    from located lc
    join public.captains c on c.profile_id = lc.profile_id
    cross join field f
    cross join lead_hours l
    where c.verification = 'verified'
      and extensions.st_dwithin(lc.at, f.centroid, c.service_radius_km * 1000)
      and exists (
        select 1
        from public.captain_services cs
        join public.services s on s.id = cs.service_id
        join public.captain_machines cm
          on cm.captain_id = c.profile_id
         and cm.machine_type_id = s.machine_type_id
         and cm.is_active
        where cs.captain_id = c.profile_id
          and cs.service_id = p_service_id
          and cs.is_active
          and (cm.ownership = 'owned' or cm.lead_time_hours <= l.available)
          and (cs.min_area_sqm is null or cs.min_area_sqm <= f.area_sqm)
      )
  )
  select
    profile_id,
    km,
    rating_avg,
    queue_load,
    round((
        (1 - least(km, 50) / 50) * 0.40
      + (coalesce(rating_avg, 3.5) / 5)  * 0.30
      + (1 - least(queue_load, 8)::numeric / 8) * 0.20
      + coalesce(accept_rate, 0.5) * 0.10
    )::numeric, 3) as match_score
  from candidates
  order by match_score desc, km asc
  limit p_limit;
$fn$;
