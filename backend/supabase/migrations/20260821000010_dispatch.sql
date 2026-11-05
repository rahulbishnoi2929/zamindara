-- Dispatch and pricing.
--
-- All of this lives in the database rather than the client for one reason:
-- it decides who gets work and what a farmer pays. A client cannot be
-- trusted with either.

-- Road distance is approximated as straight-line x 1.3. For a 5 km
-- threshold that is accurate enough, and it avoids a paid routing API on the
-- critical path. Calibrate against real trips in season one; upgrade only if
-- disputes appear. See docs/TECH_ARCHITECTURE.md.
create or replace function public.road_km(a geography, b geography)
returns numeric
language sql
immutable
as $fn$
  select round((extensions.st_distance(a, b) / 1000 * 1.3)::numeric, 2);
$fn$;

-- ---------------------------------------------------------------------------
-- Which captains can do this job?
--
-- Filters on: online, verified, offers the service, has the machine, and the
-- field falls inside his declared service radius.
--
-- The owned/arrangeable rule is enforced here rather than in the app: an
-- arrangeable machine only qualifies when the job is far enough ahead to
-- clear its lead time. A captain who needs a day to borrow his cousin's
-- rotavator must not be pinged for work starting in an hour.
-- ---------------------------------------------------------------------------
create or replace function public.eligible_captains(
  p_field_id     uuid,
  p_service_id   uuid,
  p_starts_at    timestamptz default now(),
  p_limit        integer default 10
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
      -- Uses the GiST index, so this stays a seek as the table grows.
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

-- ---------------------------------------------------------------------------
-- What should this job cost?
--
-- The platform does not set prices; the captain does. This computes and
-- records what was agreed, and adds the distance surcharge.
-- ---------------------------------------------------------------------------
create or replace function public.quote_job(
  p_field_id   uuid,
  p_service_id uuid,
  p_captain_id uuid
)
returns table (
  rate          numeric,
  rate_unit     public.pricing_unit,
  area_sqm      double precision,
  subtotal      numeric,
  distance_km   numeric,
  travel_charge numeric,
  total         numeric
)
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  with f as (
    select fl.area_sqm, fl.centroid, coalesce(r.free_travel_km, 5) as free_km
    from public.fields fl
    left join public.regions r on r.id = fl.region_id
    where fl.id = p_field_id
  ),
  c as (
    select cp.current_location, cp.base_location
    from public.captains cp
    where cp.profile_id = p_captain_id
  ),
  priced as (
    select
      cs.rate,
      cs.rate_unit,
      f.area_sqm,
      mt.travel_rate_per_km,
      f.free_km,
      public.road_km(
        coalesce(c.current_location, c.base_location), f.centroid
      ) as km
    from public.captain_services cs
    join public.services s on s.id = cs.service_id
    join public.machine_types mt on mt.id = s.machine_type_id
    cross join f
    cross join c
    where cs.captain_id = p_captain_id
      and cs.service_id = p_service_id
  )
  select
    p.rate,
    p.rate_unit,
    p.area_sqm,
    sub.subtotal,
    p.km,
    travel.charge,
    -- Null, not the travel charge on its own. An hourly job's total is not
    -- knowable before the work is done, and `coalesce(subtotal, 0) + travel`
    -- quietly turned "we cannot say yet" into "₹800" — a number made
    -- entirely of the drive out.
    case when sub.subtotal is null then null
         else round(sub.subtotal + travel.charge, 2)
    end as total
  from priced p
  cross join lateral (
    select case p.rate_unit
      -- Per-killa is the common case: area divided by the unit, times rate.
      when 'per_killa' then round((p.area_sqm / public.sqm_per_unit('killa') * p.rate)::numeric, 2)
      -- Hourly and daily cannot be known before the work is done, so the
      -- quote carries the rate and the final amount is entered on completion.
      when 'per_hour'  then null
      when 'per_day'   then null
      when 'per_job'   then round(p.rate, 2)
    end as subtotal
  ) sub
  cross join lateral (
    select round((greatest(p.km - p.free_km, 0) * p.travel_rate_per_km)::numeric, 2) as charge
  ) travel;
$fn$;

-- Rate guidance: a range from recent nearby work, never a single number.
-- The platform takes no position on price; it only shows what has been paid.
-- Lat/lng rather than a geography, because the caller is a phone: this is
-- the one guidance query the app itself makes, and supabase-js cannot pass a
-- PostGIS type. Nothing in SQL calls it, so there is no second signature to
-- keep.
create or replace function public.rate_guidance(
  p_service_id uuid,
  p_lat        double precision,
  p_lng        double precision,
  p_radius_km  numeric default 20,
  p_days       integer default 120
)
returns table (low numeric, high numeric, sample_size integer)
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  -- The rate that was actually realised, not the one we predicted. Reading
  -- quoted_rate here made guidance learn from its own guesses: a farmer who
  -- negotiated 1200 down to 900 still fed 1200 to the next farmer, so the
  -- guide could never fall and nothing it said came from money changing
  -- hands. final_amount is what was taken; travel is subtracted because it
  -- is a distance charge, not a work rate, and 4046.8564224 m² is one killa.
  select
    percentile_cont(0.25) within group (
      order by (j.final_amount - j.travel_charge) / (j.area_sqm / 4046.8564224)
    )::numeric(10,2),
    percentile_cont(0.75) within group (
      order by (j.final_amount - j.travel_charge) / (j.area_sqm / 4046.8564224)
    )::numeric(10,2),
    count(*)::integer
  from public.jobs j
  join public.fields f on f.id = j.field_id
  where j.service_id = p_service_id
    and j.status = 'completed'
    and j.final_amount is not null
    -- A job that ended with no money named, or at less than the travel to
    -- reach it, says nothing about the going rate.
    and j.final_amount > j.travel_charge
    and j.quoted_unit = 'per_killa'
    and j.completed_at > now() - make_interval(days => p_days)
    and extensions.st_dwithin(
      f.centroid,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000
    );
$fn$;

-- ---------------------------------------------------------------------------
-- Accepting a job. First captain wins.
--
-- v1 broadcasts to the top five simultaneously, so two captains can tap
-- accept in the same second. The predicate on status inside the UPDATE makes
-- that safe: the row lock serialises them, and the second one matches zero
-- rows because the status has already moved off searching.
--
-- Sequential offers would be fairer to captains and too slow for a farmer
-- whose crop is shattering. Revisit once there is liquidity.
-- ---------------------------------------------------------------------------
create or replace function public.accept_job(p_job_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  me      uuid := auth.uid();
  claimed public.jobs;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Membership, not pending-ness. When the first captain accepts, every other
  -- pending row is marked timed_out — so testing for 'pending' here told a
  -- captain who merely lost the race that the job was never offered to him.
  -- Wrong, and insulting to someone who answered in three seconds. Losing the
  -- race is handled below, with its own message.
  if not exists (
    select 1 from public.job_dispatch
    where job_id = p_job_id and captain_id = me
  ) then
    raise exception 'this job was not offered to you' using errcode = '42501';
  end if;

  update public.jobs
  set status      = 'accepted',
      captain_id  = me,
      accepted_at = now()
  where id = p_job_id
    and status = 'searching'
  returning * into claimed;

  if claimed.id is null then
    -- Someone else got there first. Not an error the captain caused.
    update public.job_dispatch
    set response = 'timed_out', responded_at = now()
    where job_id = p_job_id and captain_id = me and response = 'pending';

    raise exception 'job already taken' using errcode = '55006';
  end if;

  -- The price becomes real here, and this is the only moment it can.
  --
  -- The farmer posted against district guidance — a range midpoint, with no
  -- travel in it, because at posting time there is no captain and so no
  -- distance. travel_charge was therefore 0 on every job ever created, and
  -- the distance surcharge this product promised from day one existed in the
  -- pricing library, in machine_types.travel_rate_per_km and in
  -- regions.free_travel_km, and was applied to nothing.
  --
  -- Now that a captain has taken it, all three unknowns are known: whose
  -- rate, how far, and which machine. quote_job answers them together.
  --
  -- Informative, not binding: v1 moves no money, and the amount actually
  -- taken is typed in on completion. What this buys is a captain 25 km out
  -- who can see he is paid for the drive, and a farmer who is not surprised
  -- by it afterwards.
  update public.jobs j
  set quoted_rate     = q.rate,
      quoted_unit     = q.rate_unit,
      quoted_subtotal = q.subtotal,
      travel_charge   = q.travel_charge,
      quoted_total    = q.total
  from public.quote_job(claimed.field_id, claimed.service_id, me) q
  where j.id = claimed.id;

  -- Hand back the priced row, not the one read before pricing.
  select * into claimed from public.jobs where id = claimed.id;

  -- The CASE yields text, and Postgres will not implicitly cast text into an
  -- enum here. Without the explicit cast this raises 42804 on every single
  -- accept — the whole dispatch path, dead on the first job.
  update public.job_dispatch
  set response = (
        case when captain_id = me then 'accepted' else 'timed_out' end
      )::public.dispatch_response,
      responded_at = now()
  where job_id = p_job_id and response = 'pending';

  return claimed;
end;
$fn$;
