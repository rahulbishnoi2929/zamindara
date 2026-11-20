-- Batch B: dispatch rounds, a wider search, and ringing again.
-- Design: docs/BATCH_B_DESIGN.md.
--
-- Until now dispatch_job asked the same top five on every call, and
-- `on conflict do nothing` made every call after the first a no-op: nobody
-- else was ever asked, and an offer never ended. For a "now" job that means
-- a farmer whose five captains are asleep waits for nobody.
--
-- Now, for a "now" job (open offers for later days are untouched):
--   * a round lasts 90 seconds; the next call closes it and asks the next
--     five not yet asked;
--   * after three rounds, or once everyone eligible has been asked, the
--     search is exhausted and the farmer is told;
--   * he may widen it by 10 km at a time, to +30 km, three rounds each;
--   * an offer unanswered after 30 seconds rings once more.
-- The farmer's app drives the clock with a sync pass every 30 seconds while
-- it is open and he has a "now" job searching.

alter table public.jobs
  add column search_extra_km integer not null default 0
    constraint jobs_search_extra_sane check (search_extra_km between 0 and 30),
  add column search_exhausted_at timestamptz;

comment on column public.jobs.search_extra_km is
  'How far past each captain''s own radius this job is offered, in km. Raised by the farmer with widen_search.';
comment on column public.jobs.search_exhausted_at is
  'Set when a "now" job''s rounds ran out with nobody accepting. Cleared by widen_search.';

alter table public.job_dispatch
  add column repinged_at timestamptz;

comment on column public.job_dispatch.repinged_at is
  'When this offer was rung a second time, unanswered after 30 seconds. Once per offer.';

-- ---------------------------------------------------------------------------
-- eligible_captains, as in 0036, plus p_extra_km. The signature changes, so
-- it is dropped and created; every caller passes it by position or name
-- without the new argument, and gets 0.
-- ---------------------------------------------------------------------------
drop function public.eligible_captains(uuid, uuid, timestamptz, integer);

create function public.eligible_captains(
  p_field_id     uuid,
  p_service_id   uuid,
  p_starts_at    timestamptz default now(),
  p_limit        integer default 5,
  -- Batch B: how far past his own radius the farmer has asked us to look.
  p_extra_km     integer default 0
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
      and extensions.st_dwithin(lc.at, f.centroid, (c.service_radius_km + p_extra_km) * 1000)
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

-- ---------------------------------------------------------------------------
-- dispatch_job_offer: 0019's guards, unchanged, then rounds.
-- (Renamed from dispatch_job in 0024; dispatch_job still wraps it with the
-- auto_dispatch switch.)
-- ---------------------------------------------------------------------------
create or replace function public.dispatch_job_offer(
  p_job_id uuid,
  p_limit   integer default 5
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  me        uuid := auth.uid();
  j         public.jobs;
  fld       public.fields;
  rnd       integer;
  last_rnd  integer;
  offered   integer;
  open_jobs integer;
  recent    integer;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into j from public.jobs where id = p_job_id;
  if j.id is null then
    raise exception 'no such job' using errcode = 'P0002';
  end if;
  if j.farmer_id <> me then
    raise exception 'only the farmer who posted the job can dispatch it'
      using errcode = '42501';
  end if;
  if j.status <> 'searching' then
    raise exception 'job is not searching' using errcode = '55006';
  end if;

  select * into fld from public.fields where id = j.field_id;
  if not fld.confirmed_by_owner then
    raise exception 'the field has not been confirmed by its owner'
      using errcode = '55006';
  end if;

  select count(*)::integer into open_jobs
  from public.jobs
  where farmer_id = me and status = 'searching' and id <> p_job_id;
  if open_jobs >= 5 then
    raise exception 'too many requests open at once' using errcode = '54000';
  end if;

  select count(*)::integer into recent
  from public.jobs
  where farmer_id = me and created_at > now() - interval '1 hour';
  if recent > 20 then
    raise exception 'too many requests in one hour' using errcode = '54000';
  end if;

  select coalesce(max(round), 0) into last_rnd
  from public.job_dispatch where job_id = p_job_id;

  if j.dispatch_mode = 'instant' then
    -- Close the round that has had its 90 seconds.
    update public.job_dispatch
    set response = 'timed_out', responded_at = now()
    where job_id = p_job_id and response = 'pending'
      and sent_at < now() - interval '90 seconds';

    -- A round still running: let it run.
    if exists (select 1 from public.job_dispatch
               where job_id = p_job_id and response = 'pending') then
      return 0;
    end if;

    -- Three rounds per widening.
    if j.search_exhausted_at is not null
       or last_rnd >= 3 * (1 + j.search_extra_km / 10) then
      update public.jobs set search_exhausted_at = coalesce(search_exhausted_at, now())
      where id = p_job_id;
      return 0;
    end if;
  elsif last_rnd > 0 then
    -- A job for a later day: one round of pings, then claim_open_offers
    -- (0037) lists it quietly to everyone else eligible.
    return 0;
  end if;

  rnd := last_rnd + 1;

  -- The best captains not yet asked about this job.
  insert into public.job_dispatch (job_id, captain_id, round, rank, distance_km, match_score)
  select p_job_id, e.captain_id, rnd,
         row_number() over (order by e.match_score desc, e.distance_km asc),
         e.distance_km, e.match_score
  from public.eligible_captains(j.field_id, j.service_id, public.job_starts_at(j), 1000, j.search_extra_km) e
  where not exists (
    select 1 from public.job_dispatch d where d.job_id = p_job_id and d.captain_id = e.captain_id
  )
  order by e.match_score desc, e.distance_km asc
  limit p_limit
  on conflict (job_id, captain_id) do nothing;

  get diagnostics offered = row_count;

  -- Everyone eligible has had their chance and nobody is left to ask.
  if offered = 0 and j.dispatch_mode = 'instant' and last_rnd > 0 then
    update public.jobs set search_exhausted_at = coalesce(search_exhausted_at, now())
    where id = p_job_id;
  end if;

  return offered;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- The farmer asks captains farther away: +10 km, to +30, three more rounds.
-- ---------------------------------------------------------------------------
create function public.widen_search(p_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  j     public.jobs;
  wider integer;
begin
  select * into j from public.jobs where id = p_job_id;
  if j.id is null or auth.uid() is null or j.farmer_id <> auth.uid() then
    raise exception 'not your job' using errcode = '42501';
  end if;
  if j.status <> 'searching' or j.dispatch_mode <> 'instant' then
    raise exception 'only a "now" job still searching can be widened' using errcode = '55006';
  end if;
  if j.search_extra_km >= 30 then
    raise exception 'already searching as wide as allowed' using errcode = '22023';
  end if;

  update public.jobs
  set search_extra_km = search_extra_km + 10, search_exhausted_at = null
  where id = p_job_id
  returning search_extra_km into wider;
  return wider;
end;
$fn$;

revoke execute on function public.widen_search(uuid) from public, anon;
grant execute on function public.widen_search(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Ring again: offers unanswered for 30 seconds, once each. Returns how many,
-- and the farmer's app then calls notify-dispatch, which rings every pending
-- offer on the job. Obeys auto_dispatch like the rest.
-- ---------------------------------------------------------------------------
create function public.repeat_ping_due(p_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  n integer;
begin
  if not exists (select 1 from public.jobs
                 where id = p_job_id and farmer_id = auth.uid() and auth.uid() is not null) then
    raise exception 'not your job' using errcode = '42501';
  end if;
  if not coalesce((select auto_dispatch from public.app_config), false) then
    return 0;
  end if;

  update public.job_dispatch d
  set repinged_at = now()
  from public.jobs j
  where d.job_id = p_job_id and j.id = d.job_id
    and j.status = 'searching' and j.dispatch_mode = 'instant'
    and d.response = 'pending' and d.repinged_at is null
    and d.sent_at < now() - interval '30 seconds';
  get diagnostics n = row_count;
  return n;
end;
$fn$;

revoke execute on function public.repeat_ping_due(uuid) from public, anon;
grant execute on function public.repeat_ping_due(uuid) to authenticated, service_role;
