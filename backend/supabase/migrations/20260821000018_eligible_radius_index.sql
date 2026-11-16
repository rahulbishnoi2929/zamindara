-- The captain search could not use the spatial index.
--
-- eligible_captains filtered with:
--
--     st_dwithin(c.current_location, f.centroid, c.service_radius_km * 1000)
--
-- and carried the comment "Uses the GiST index, so this stays a seek as the
-- table grows." That comment was wrong. The distance argument is read from
-- the candidate row, so PostGIS has no constant bound to build an index
-- search from and the planner falls back to scanning every captain and
-- computing a distance for each.
--
-- With fifteen captains that is invisible. It is also the query on the path
-- of every job posted in harvest week, when it runs for every farmer, every
-- sync pass, against every captain in the district.
--
-- The fix is to ask the question in two parts: a constant bound the index
-- can seek on, then the per-captain radius as an ordinary filter over what
-- comes back.
--
-- The constant is `captains_radius_sane`'s own maximum, so it can never
-- exclude a captain who would otherwise have matched — behaviour is
-- identical, only the plan changes.
--
-- ⚠️ Worth your decision, not mine: 200 km is the whole of Punjab, so the
-- bound is correct but not very selective. The real question is how far a
-- captain may advertise. If that is 60 km, tightening captains_radius_sane
-- to 60 makes this bound actually sharp. I have not changed it, because it
-- is a product limit rather than a performance fix.

create or replace function public.eligible_captains(
  p_field_id     uuid,
  p_service_id   uuid,
  p_starts_at    timestamptz default now(),
  -- Five, matching dispatch_job's "broadcast to the top five". The default
  -- was ten, which nothing used and which quietly disagreed with the rule
  -- written everywhere else.
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
    select centroid from public.fields where id = p_field_id
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
        -- Resolved offers only. Counting a still-pending ping as a refusal
        -- punishes a captain for being mid-decision: offer him work and his
        -- rate drops instantly, so in harvest week the busiest, most
        -- responsive captains sink below strangers with no history at all.
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
      -- Constant first: a literal distance is what lets PostGIS turn this
      -- into an index search rather than a scan. 200 km is the maximum
      -- captains_radius_sane permits, so nobody who would have matched is
      -- lost here.
      and extensions.st_dwithin(c.current_location, f.centroid, 200000)
      -- Then his own radius, as a filter on the far smaller candidate set.
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
      )
  )
  select
    profile_id,
    km,
    rating_avg,
    queue_load,
    -- ponytail: normalised over 50 km, so two captains a few hundred metres
    -- apart score almost identically and the other terms decide. Fine while
    -- one district is the whole market; revisit if ranking looks arbitrary.
    -- Distance dominates on purpose. A tractor moving 15 km burns diesel and
    -- an hour of daylight, so a nearer captain is genuinely better for
    -- everyone, including the farmer waiting for him.
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
