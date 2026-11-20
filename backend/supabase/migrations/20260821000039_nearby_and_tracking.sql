-- Batch C: "available now" for farmers, and the captain's position on a live job.
--
-- Both read where captains are, so both go through functions that reveal
-- only what the reader needs:
--   * a farmer asking about his own field learns how many idle machines of
--     each type could come to it now: counts, never who or where;
--   * a farmer whose job is on the way learns where that one captain is,
--     only while the job is en route or in progress.
--
-- The live position is NOT written to captains.current_location, which any
-- signed-in user can read for a verified captain (captains_read, 0011).
-- Tracking every minute into that column would turn an existing exposure
-- into a live map of every captain. It goes to its own table, with no
-- policies at all: functions are the only door.

-- ---------------------------------------------------------------------------
-- "Combine available now": idle machines that can reach this field
-- ---------------------------------------------------------------------------
create function public.available_nearby(p_field_id uuid)
returns table (machine_code text, captains integer)
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
begin
  if auth.uid() is null or not exists (
    select 1 from public.fields where id = p_field_id and owner_id = auth.uid()
  ) then
    raise exception 'not your field' using errcode = '42501';
  end if;

  return query
  select mt.code::text, count(distinct c.profile_id)::integer
  from public.fields f
  join public.captains c
    on c.verification = 'verified'
   and c.is_online
   and c.current_location is not null
   and extensions.st_dwithin(c.current_location, f.centroid, c.service_radius_km * 1000)
  join public.captain_machines cm on cm.captain_id = c.profile_id and cm.is_active
  join public.machine_types mt on mt.id = cm.machine_type_id
  where f.id = p_field_id
    and c.profile_id <> auth.uid()
    -- Idle: nothing live on this machine.
    and not exists (
      select 1 from public.jobs j
      where j.machine_id = cm.id and j.status in ('accepted', 'en_route', 'in_progress')
    )
  group by mt.code;
end;
$fn$;

revoke execute on function public.available_nearby(uuid) from public, anon;
grant execute on function public.available_nearby(uuid) to authenticated, service_role;

comment on function public.available_nearby(uuid) is
  'For the field''s owner: how many verified, online captains with an idle machine of each type can reach it now. Counts only.';

-- ---------------------------------------------------------------------------
-- Where the captain is, on a live job
-- ---------------------------------------------------------------------------
create table public.job_locations (
  job_id     uuid primary key references public.jobs(id) on delete cascade,
  location   geography(Point, 4326) not null,
  updated_at timestamptz not null default now()
);

-- No policies: nobody reads or writes this table directly.
alter table public.job_locations enable row level security;
revoke all on public.job_locations from anon, authenticated;

comment on table public.job_locations is
  'The captain''s last position on a job he is driving to or working. Read only through job_captain_location, by that job''s farmer.';

create function public.report_job_location(p_job_id uuid, p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $fn$
begin
  if not exists (
    select 1 from public.jobs
    where id = p_job_id and captain_id = auth.uid() and auth.uid() is not null
      and status in ('en_route', 'in_progress')
  ) then
    raise exception 'not a live job of yours' using errcode = '42501';
  end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'not a position' using errcode = '22023';
  end if;

  insert into public.job_locations (job_id, location, updated_at)
  values (p_job_id, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::geography, now())
  on conflict (job_id) do update set location = excluded.location, updated_at = excluded.updated_at;
end;
$fn$;

revoke execute on function public.report_job_location(uuid, double precision, double precision) from public, anon;
grant execute on function public.report_job_location(uuid, double precision, double precision) to authenticated, service_role;

-- For the job's farmer: how far his captain is (road estimate, as dispatch
-- uses), and when that was. Nothing once the job is done, and nothing older
-- than half an hour: a stale dot is worse than none.
create function public.job_captain_location(p_job_id uuid)
returns table (lat double precision, lng double precision, km numeric, seen_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
begin
  if not exists (
    select 1 from public.jobs where id = p_job_id and farmer_id = auth.uid() and auth.uid() is not null
  ) then
    raise exception 'not your job' using errcode = '42501';
  end if;

  return query
  select extensions.st_y(l.location::geometry), extensions.st_x(l.location::geometry),
         round(public.road_km(l.location, f.centroid)::numeric, 1), l.updated_at
  from public.jobs j
  join public.job_locations l on l.job_id = j.id
  join public.fields f on f.id = j.field_id
  where j.id = p_job_id
    and j.status in ('en_route', 'in_progress')
    and l.updated_at > now() - interval '30 minutes';
end;
$fn$;

revoke execute on function public.job_captain_location(uuid) from public, anon;
grant execute on function public.job_captain_location(uuid) to authenticated, service_role;
