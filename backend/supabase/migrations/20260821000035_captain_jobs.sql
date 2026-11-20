-- Stage 4.3: a captain logs a job he booked by phone, and measures the
-- field when he gets there.
--
-- Most work in Fazilka is booked by a phone call to a captain the farmer
-- already knows. If the app cannot hold that job, the captain's real queue
-- lives in his head and the app shows half of it.
--
-- The founder's three steps (4.1, 4.2) — find or create the farmer, create
-- the job on a declared field, put it in a captain's queue — are moved into
-- internal functions, unchanged except that the staff check is lifted out.
-- The founder functions keep their names, signatures and grants and call
-- them; captain_create_job calls them with its own checks instead.

-- ---------------------------------------------------------------------------
-- Internal: the founder's bodies, verbatim minus `perform require_staff()`.
-- Not callable from a phone.
-- ---------------------------------------------------------------------------

create function public.farmer_by_phone(p_phone text, p_name text, p_village text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  found  uuid;
begin
  if length(digits) = 10 then
    digits := '91' || digits;
  end if;
  if digits !~ '^91[0-9]{10}$' then
    raise exception 'not a ten-digit Indian mobile number' using errcode = '22023';
  end if;

  select id into found from public.profiles where right(phone, 10) = right(digits, 10);
  if found is not null then
    return found;
  end if;

  insert into public.profiles (id, phone, full_name, village, role, placeholder)
  values (gen_random_uuid(), digits, btrim(p_name), nullif(btrim(p_village), ''), 'farmer', true)
  returning id into found;
  return found;
end;
$fn$;

create function public.create_declared_job(
  p_farmer         uuid,
  p_service_code   text,
  p_area_sqm       double precision,
  p_lat            double precision,
  p_lng            double precision,
  p_is_immediate   boolean default true,
  p_scheduled_date date default null,
  p_window         public.job_window default 'any'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  svc   uuid;
  half  double precision;
  dlat  double precision;
  dlng  double precision;
  fld   uuid;
  job   uuid;
  vill  text;
begin

  select id into svc from public.services where code = p_service_code;
  if svc is null then
    raise exception 'no such service' using errcode = 'P0002';
  end if;
  select village into vill from public.profiles where id = p_farmer;
  if not found then
    raise exception 'no such farmer' using errcode = 'P0002';
  end if;

  -- Half the side of a square of that area, in degrees at this latitude.
  half := sqrt(p_area_sqm) / 2;
  dlat := half / 111320.0;
  dlng := half / (111320.0 * cos(radians(p_lat)));

  insert into public.fields (owner_id, name, boundary, capture_method, confirmed_by_owner)
  values (
    p_farmer,
    coalesce('Declared · ' || nullif(vill, ''), 'Declared field'),
    st_geographyfromtext(format(
      'SRID=4326;POLYGON((%s %s,%s %s,%s %s,%s %s,%s %s))',
      p_lng - dlng, p_lat - dlat,  p_lng + dlng, p_lat - dlat,
      p_lng + dlng, p_lat + dlat,  p_lng - dlng, p_lat + dlat,
      p_lng - dlng, p_lat - dlat)),
    'declared',
    -- The founder took it from the farmer on the phone and vouches for it.
    true
  )
  returning id into fld;

  insert into public.jobs (farmer_id, field_id, service_id, area_sqm, status,
                           is_immediate, scheduled_date, scheduled_window)
  select p_farmer, fld, svc, f.area_sqm, 'searching',
         p_is_immediate, case when p_is_immediate then null else p_scheduled_date end, p_window
  from public.fields f where f.id = fld
  returning id into job;
  return job;
end;
$fn$;

create function public.assign_job(p_job uuid, p_captain uuid)
returns public.jobs
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  j public.jobs;
begin

  if not exists (select 1 from public.captains
                 where profile_id = p_captain and verification = 'verified') then
    raise exception 'not a verified captain' using errcode = '22023';
  end if;

  update public.jobs
  set status = 'accepted', captain_id = p_captain, accepted_at = now()
  where id = p_job and status = 'searching'
  returning * into j;
  if j.id is null then
    raise exception 'job is not looking for a captain' using errcode = '55006';
  end if;

  update public.jobs t
  set quoted_rate = q.rate, quoted_unit = q.rate_unit, quoted_subtotal = q.subtotal,
      travel_charge = q.travel_charge, quoted_total = q.total
  from public.quote_job(j.field_id, j.service_id, p_captain) q
  where t.id = j.id;

  insert into public.job_dispatch (job_id, captain_id, rank, response, responded_at)
  values (p_job, p_captain, 1, 'accepted', now())
  on conflict (job_id, captain_id)
    do update set response = 'accepted', responded_at = now();
  update public.job_dispatch
  set response = 'timed_out', responded_at = now()
  where job_id = p_job and captain_id <> p_captain and response = 'pending';

  select * into j from public.jobs where id = p_job;
  return j;
end;
$fn$;

revoke execute on function public.farmer_by_phone(text, text, text) from public, anon, authenticated;
revoke execute on function public.create_declared_job(uuid, text, double precision, double precision, double precision, boolean, date, public.job_window) from public, anon, authenticated;
revoke execute on function public.assign_job(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The founder functions, now staff check + the shared body.
-- ---------------------------------------------------------------------------

create or replace function public.founder_create_farmer(p_phone text, p_name text, p_village text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.require_staff();
  return public.farmer_by_phone(p_phone, p_name, p_village);
end;
$fn$;

create or replace function public.founder_create_job(
  p_farmer         uuid,
  p_service_code   text,
  p_area_sqm       double precision,
  p_lat            double precision,
  p_lng            double precision,
  p_is_immediate   boolean default true,
  p_scheduled_date date default null,
  p_window         public.job_window default 'any'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $fn$
begin
  perform public.require_staff();
  return public.create_declared_job(p_farmer, p_service_code, p_area_sqm, p_lat, p_lng,
                                    p_is_immediate, p_scheduled_date, p_window);
end;
$fn$;

create or replace function public.founder_assign(p_job uuid, p_captain uuid)
returns public.jobs
language plpgsql
security definer
set search_path = public, extensions
as $fn$
begin
  perform public.require_staff();
  return public.assign_job(p_job, p_captain);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- The captain's own: same three steps, his checks.
-- ---------------------------------------------------------------------------

create function public.captain_create_job(
  p_phone          text,
  p_name           text,
  p_village        text,
  p_service_code   text,
  p_area_sqm       double precision,
  p_lat            double precision,
  p_lng            double precision,
  p_is_immediate   boolean default true,
  p_scheduled_date date default null,
  p_window         public.job_window default 'any'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  me     uuid := auth.uid();
  farmer uuid;
  job    uuid;
begin
  if not exists (select 1 from public.captains
                 where profile_id = me and verification = 'verified') then
    raise exception 'only a verified captain can log a job' using errcode = '42501';
  end if;
  -- Only work he actually offers, at the rate he set for it.
  if not exists (select 1 from public.captain_services cs
                 join public.services s on s.id = cs.service_id
                 where cs.captain_id = me and cs.is_active and s.code = p_service_code) then
    raise exception 'not a service you offer' using errcode = '42501';
  end if;

  farmer := public.farmer_by_phone(p_phone, p_name, p_village);
  if farmer = me then
    raise exception 'that is your own number' using errcode = '22023';
  end if;

  job := public.create_declared_job(farmer, p_service_code, p_area_sqm, p_lat, p_lng,
                                    p_is_immediate, p_scheduled_date, p_window);
  perform public.assign_job(job, me);
  return job;
end;
$fn$;

revoke execute on function public.captain_create_job(text, text, text, text, double precision, double precision, double precision, boolean, date, public.job_window) from public, anon;
grant execute on function public.captain_create_job(text, text, text, text, double precision, double precision, double precision, boolean, date, public.job_window) to authenticated;

-- On arrival he traces the real field. The declared square is replaced, the
-- server recomputes the area (derive_field_geometry), the job takes the new
-- area and is re-quoted. Only a declared field, only his job, only while it
-- is his to work: a field the farmer traced himself is never overwritten.
create function public.captain_retrace_field(
  p_job      uuid,
  p_boundary text,
  p_method   public.capture_method default 'drawn'
)
returns public.jobs
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = p_job;
  if j.id is null or j.captain_id is distinct from auth.uid()
     or j.status not in ('accepted', 'en_route', 'in_progress') then
    raise exception 'not a job you are working' using errcode = '42501';
  end if;
  if p_method = 'declared' then
    raise exception 'a re-trace is drawn or walked' using errcode = '22023';
  end if;
  if not exists (select 1 from public.fields where id = j.field_id and capture_method = 'declared') then
    raise exception 'this field was already measured' using errcode = '22023';
  end if;

  update public.fields
  set boundary = extensions.st_geographyfromtext(p_boundary),
      capture_method = p_method
  where id = j.field_id;

  update public.jobs t
  set area_sqm = f.area_sqm
  from public.fields f
  where t.id = p_job and f.id = t.field_id;

  update public.jobs t
  set quoted_rate = q.rate, quoted_unit = q.rate_unit, quoted_subtotal = q.subtotal,
      travel_charge = q.travel_charge, quoted_total = q.total
  from public.quote_job(j.field_id, j.service_id, j.captain_id) q
  where t.id = p_job;

  select * into j from public.jobs where id = p_job;
  return j;
end;
$fn$;

revoke execute on function public.captain_retrace_field(uuid, text, public.capture_method) from public, anon;
grant execute on function public.captain_retrace_field(uuid, text, public.capture_method) to authenticated;
