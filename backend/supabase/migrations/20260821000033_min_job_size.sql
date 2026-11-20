-- Stage 4.5: a captain can set the smallest job he will take, per service.
--
-- A combine owner will not drive 20 km for one kanal of wheat. Without
-- this he is offered it anyway, declines, and the farmer waits through a
-- round of offers that was never going to land.

alter table public.captain_services
  add column min_area_sqm double precision
    constraint captain_services_min_area_sane
    check (min_area_sqm is null or (min_area_sqm > 0 and min_area_sqm < 2000000));

comment on column public.captain_services.min_area_sqm is
  'Smallest field this captain takes for this service. Null: any size.';

-- eligible_captains as in 0018, with one added condition (marked). The
-- filter sits inside the EXISTS, so it cannot be added by wrapping.
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
  lead_hours as (
    select greatest(0, extract(epoch from (p_starts_at - now())) / 3600)::numeric as available
  ),
  candidates as (
    select
      c.profile_id,
      public.road_km(c.current_location, f.centroid) as km,
      c.rating_avg,
      (
        select count(*)::integer
        from public.jobs j
        where j.captain_id = c.profile_id
          and j.status in ('accepted', 'en_route', 'in_progress')
      ) as queue_load,
      (
        select count(*) filter (where d.response = 'accepted')::numeric
             / nullif(count(*) filter (
                 where d.response in ('accepted', 'declined', 'timed_out')
               ), 0)
        from public.job_dispatch d
        where d.captain_id = c.profile_id
      ) as accept_rate
    from public.captains c
    cross join field f
    cross join lead_hours l
    where c.is_online
      and c.verification = 'verified'
      and c.current_location is not null
      and extensions.st_dwithin(c.current_location, f.centroid, 200000)
      and extensions.st_dwithin(
            c.current_location, f.centroid, c.service_radius_km * 1000
          )
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
          -- 4.5: not below the smallest job he takes.
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

-- What the farmer is told when nobody could be offered his job because it
-- is smaller than the captains nearby take: the smallest minimum among
-- them. Null when size is not the reason — somebody is eligible, or nobody
-- nearby does this work at any size. Only the farmer who posted it asks.
create function public.job_size_floor(p_job uuid)
returns double precision
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  j public.jobs;
  floor_sqm double precision;
begin
  select * into j from public.jobs where id = p_job;
  if j.id is null or j.farmer_id <> auth.uid() then
    raise exception 'not your job' using errcode = '42501';
  end if;
  if exists (select 1 from public.eligible_captains(j.field_id, j.service_id)) then
    return null;
  end if;

  select min(cs.min_area_sqm) into floor_sqm
  from public.captains c
  join public.captain_services cs on cs.captain_id = c.profile_id
  join public.fields f on f.id = j.field_id
  where cs.service_id = j.service_id
    and cs.is_active
    and cs.min_area_sqm > f.area_sqm
    and c.is_online
    and c.verification = 'verified'
    and c.current_location is not null
    and extensions.st_dwithin(c.current_location, f.centroid, c.service_radius_km * 1000);
  return floor_sqm;
end;
$fn$;

revoke execute on function public.job_size_floor(uuid) from public, anon;
grant execute on function public.job_size_floor(uuid) to authenticated;
