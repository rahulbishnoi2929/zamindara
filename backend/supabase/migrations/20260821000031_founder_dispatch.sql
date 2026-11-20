-- Stage 4.1 and 4.2: farmers who exist before they sign up, and the
-- founder matching work by hand. Design: docs/STAGE_4_DESIGN.md.

-- Two functions used PostGIS types with no search_path of their own, so
-- they worked only when the caller's path happened to include extensions.
-- A claim (below) re-keys a profile, the cascade updates his fields, and
-- the field trigger ran under claim_profile's path and failed with "type
-- geometry does not exist". Found by the test for this migration. Pinned
-- now, so they work whoever calls them.
alter function public.derive_field_geometry() set search_path = public, extensions;
alter function public.road_km(extensions.geography, extensions.geography) set search_path = public, extensions;

-- ===========================================================================
-- 4.1 Placeholder profiles, claimed by an OTP-verified phone
-- ===========================================================================

alter table public.profiles
  add column placeholder boolean not null default false;

comment on column public.profiles.placeholder is
  'True for a farmer the founder created from a phone call, with no sign-in account yet. Claimed (re-keyed to his account id) the first time he signs in with that number.';

-- A placeholder has no account, so profiles.id can no longer be a foreign
-- key to auth.users. The one thing that key did — deleting an account
-- deletes its profile — becomes a trigger.
alter table public.profiles drop constraint profiles_id_fkey;

create function public.delete_profile_with_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$fn$;

revoke execute on function public.delete_profile_with_account() from public, anon, authenticated;

create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.delete_profile_with_account();

-- Every key that points at a profile follows it when it is re-keyed, so a
-- claim is one UPDATE and every field, job, rating and event goes with it.
-- Rebuilt from each key's own definition, so its ON DELETE rule is kept.
do $$
declare r record;
begin
  for r in
    select conname, conrelid::regclass as tbl, pg_get_constraintdef(oid) as def
    from pg_constraint
    where contype = 'f' and confrelid = 'public.profiles'::regclass
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s on update cascade', r.tbl, r.conname, r.def);
  end loop;
end $$;

-- Called by the app on every sign-in, before it creates a profile. The
-- phone is read from the Auth account — the number OTP proved — never
-- taken from the caller.
create function public.claim_profile()
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  me       uuid := auth.uid();
  my_phone text;
  held     uuid;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = me) then
    return false;
  end if;

  select u.phone into my_phone from auth.users u where u.id = me;
  if my_phone is null or my_phone = '' then
    return false;
  end if;

  select p.id into held
  from public.profiles p
  where p.placeholder and right(p.phone, 10) = right(my_phone, 10)
  for update;
  if held is null then
    return false;
  end if;

  update public.profiles
  set id = me, placeholder = false, phone = my_phone
  where id = held;
  return true;
end;
$fn$;

revoke execute on function public.claim_profile() from public, anon;
grant execute on function public.claim_profile() to authenticated;

-- ===========================================================================
-- 4.2 Staff can see the whole marketplace
-- ===========================================================================
-- A deliberate widening, to staff only: the founder cannot match a job he
-- cannot see. Permissive, so everyone else's access is unchanged.

create policy profiles_read_staff     on public.profiles     for select to authenticated using (public.is_admin());
create policy fields_read_staff       on public.fields       for select to authenticated using (public.is_admin());
create policy jobs_read_staff         on public.jobs         for select to authenticated using (public.is_admin());
create policy captains_read_staff     on public.captains     for select to authenticated using (public.is_admin());
create policy job_dispatch_read_staff on public.job_dispatch for select to authenticated using (public.is_admin());

-- ===========================================================================
-- 4.2 Founder functions. Each refuses anyone who is not staff.
-- ===========================================================================

create function public.require_staff()
returns void
language plpgsql
stable
set search_path = public
as $fn$
begin
  if not public.is_admin() then
    raise exception 'staff only' using errcode = '42501';
  end if;
end;
$fn$;

-- A farmer who phoned in. Idempotent by phone: the same number twice is the
-- same farmer, whether or not he has since signed up.
create function public.founder_create_farmer(p_phone text, p_name text, p_village text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  found  uuid;
begin
  perform public.require_staff();
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

-- A job for a farmer, booked by phone. He has no traced field, so the field
-- is *declared*: a square of the stated area on the pin the founder drops,
-- marked as such. The captain traces the real one on arrival (4.3); until
-- then the price rests on the farmer's word, which is what a phone booking is.
create function public.founder_create_job(
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
  perform public.require_staff();

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

-- Straight into the captain's queue. Priced exactly as a normal accept is.
create function public.founder_assign(p_job uuid, p_captain uuid)
returns public.jobs
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  j public.jobs;
begin
  perform public.require_staff();

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

-- Move a job along on someone's behalf, through the same transition rules
-- as everyone else (enforce_job_transition), and record the money.
create function public.founder_advance(
  p_job          uuid,
  p_status       public.job_status,
  p_final_amount numeric default null,
  p_payment      public.payment_mode default null
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $fn$
declare
  j public.jobs;
begin
  perform public.require_staff();
  update public.jobs
  set status       = p_status,
      final_amount = coalesce(p_final_amount, final_amount),
      payment_mode = coalesce(p_payment, payment_mode)
  where id = p_job
  returning * into j;
  if j.id is null then
    raise exception 'no such job' using errcode = 'P0002';
  end if;
  return j;
end;
$fn$;

-- Verified captains, for the founder to choose from. Nearest first when a
-- job is given.
create function public.founder_captains(p_job uuid default null)
returns table (captain_id uuid, full_name text, phone text, village text,
               is_online boolean, distance_km double precision)
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
begin
  perform public.require_staff();
  return query
  select c.profile_id, p.full_name, p.phone, p.village, c.is_online,
         case when p_job is null then null
              else st_distance(coalesce(c.current_location, c.base_location),
                               (select f.centroid from public.jobs j join public.fields f on f.id = j.field_id
                                where j.id = p_job)) / 1000.0 end
  from public.captains c
  join public.profiles p on p.id = c.profile_id
  where c.verification = 'verified'
  order by 6 nulls last, p.full_name
  limit 50;
end;
$fn$;

revoke execute on function public.require_staff() from public, anon;
revoke execute on function public.founder_create_farmer(text, text, text) from public, anon;
revoke execute on function public.founder_create_job(uuid, text, double precision, double precision, double precision, boolean, date, public.job_window) from public, anon;
revoke execute on function public.founder_assign(uuid, uuid) from public, anon;
revoke execute on function public.founder_advance(uuid, public.job_status, numeric, public.payment_mode) from public, anon;
revoke execute on function public.founder_captains(uuid) from public, anon;
grant execute on function public.require_staff() to authenticated;
grant execute on function public.founder_create_farmer(text, text, text) to authenticated;
grant execute on function public.founder_create_job(uuid, text, double precision, double precision, double precision, boolean, date, public.job_window) to authenticated;
grant execute on function public.founder_assign(uuid, uuid) to authenticated;
grant execute on function public.founder_advance(uuid, public.job_status, numeric, public.payment_mode) to authenticated;
grant execute on function public.founder_captains(uuid) to authenticated;
