-- The distance surcharge.
--
-- "If it's 5 km away then increase some amount of fare" was one of the first
-- things this product was asked for. Every piece of it existed:
-- machine_types.travel_rate_per_km, regions.free_travel_km, quote_job's
-- arithmetic, and twenty unit tests in the pricing package.
--
-- It was applied to nothing. travel_charge was 0 on every job ever created,
-- because the app priced a job at *posting* time — when there is no captain
-- and therefore no distance — and nothing ever priced it again. A captain
-- 25 km out was paid exactly what one in the next village was paid, which is
-- how you teach him to refuse distant work and strand the farmers who are
-- hardest to reach.
--
-- accept_job now prices the job the moment all three unknowns are known:
-- whose rate, how far, which machine. These assertions are on that moment.

begin;
select plan(10);

create schema if not exists tests;

create or replace function tests.make_user(p_id uuid, p_phone text, p_name text)
returns void language plpgsql as $fn$
begin
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_phone || '@test.local', '', now(), now(), now()
  );
  insert into public.profiles (id, phone, full_name, region_id)
  values (p_id, p_phone, p_name, (select id from public.regions where slug = 'fazilka'));
end;
$fn$;

create or replace function tests.act_as(p_id uuid)
returns void language plpgsql as $fn$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_id::text, 'role', 'authenticated')::text,
    true
  );
end;
$fn$;

create or replace function tests.act_as_admin()
returns void language plpgsql as $fn$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$fn$;

-- One killa, so the work half of the quote is roughly the captain's rate and
-- the drive half is what stands out. The geometry trigger computes the real
-- area from this boundary, so it has to be an honest killa.
create or replace function tests.killa_polygon(p_lat numeric, p_lng numeric)
returns geography language sql immutable as $fn$
  select extensions.st_geographyfromtext(format(
    'POLYGON((%s %s, %s %s, %s %s, %s %s, %s %s))',
    p_lng,             p_lat,
    p_lng + 0.0007012, p_lat,
    p_lng + 0.0007012, p_lat + 0.0005442,
    p_lng,             p_lat + 0.0005442,
    p_lng,             p_lat
  ));
$fn$;

grant usage on schema tests to postgres, anon, authenticated, service_role;
grant execute on all functions in schema tests
  to postgres, anon, authenticated, service_role;

select tests.act_as_admin();
select tests.make_user('11111111-1111-1111-1111-111111111111', '9876500101', 'Gurmeet');
select tests.make_user('22222222-2222-2222-2222-222222222222', '9876500102', 'Nearby Jaspal');
select tests.make_user('33333333-3333-3333-3333-333333333333', '9876500103', 'Faraway Sukhdev');

-- Jaspal is in the next village. Sukhdev is about 30 km east — a migrant
-- combine, which is exactly the supply this product exists to reach.
insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at)
values
  ('22222222-2222-2222-2222-222222222222',
   extensions.st_geographyfromtext('POINT(74.0300 30.4040)'),
   extensions.st_geographyfromtext('POINT(74.0300 30.4040)'),
   true, 'verified', '11111111-1111-1111-1111-111111111111', now()),
  ('33333333-3333-3333-3333-333333333333',
   extensions.st_geographyfromtext('POINT(74.3400 30.4028)'),
   extensions.st_geographyfromtext('POINT(74.3400 30.4028)'),
   true, 'verified', '11111111-1111-1111-1111-111111111111', now());

select tests.act_as('22222222-2222-2222-2222-222222222222');
insert into public.captain_machines (captain_id, machine_type_id, ownership, lead_time_hours)
values
  ('22222222-2222-2222-2222-222222222222',
   (select id from public.machine_types where code = 'combine'), 'owned', 0),
  ('22222222-2222-2222-2222-222222222222',
   (select id from public.machine_types where code = 'laser_leveller'), 'owned', 0);
insert into public.captain_services (captain_id, service_id, rate, rate_unit)
values
  ('22222222-2222-2222-2222-222222222222',
   (select id from public.services where code = 'wheat_harvest'), 1200, 'per_killa'),
  ('22222222-2222-2222-2222-222222222222',
   (select id from public.services where code = 'laser_levelling'), 800, 'per_hour');

select tests.act_as('33333333-3333-3333-3333-333333333333');
insert into public.captain_machines (captain_id, machine_type_id, ownership, lead_time_hours)
values ('33333333-3333-3333-3333-333333333333',
        (select id from public.machine_types where code = 'combine'), 'owned', 0);
insert into public.captain_services (captain_id, service_id, rate, rate_unit)
values ('33333333-3333-3333-3333-333333333333',
        (select id from public.services where code = 'wheat_harvest'), 1200, 'per_killa');

select tests.act_as('11111111-1111-1111-1111-111111111111');
insert into public.fields (owner_id, name, boundary, centroid, area_sqm,
                           capture_method, region_id, confirmed_by_owner)
values (
  '11111111-1111-1111-1111-111111111111',
  'Nehar wala khet',
  tests.killa_polygon(30.4028, 74.0286),
  extensions.st_geographyfromtext('POINT(74.0286 30.4028)'),
  1, 'drawn',
  (select id from public.regions where slug = 'fazilka'),
  true
);

-- ===========================================================================
-- What quote_job says, before anyone has accepted anything
-- ===========================================================================

select is(
  (select travel_charge from public.quote_job(
    (select id from public.fields where name = 'Nehar wala khet'),
    (select id from public.services where code = 'wheat_harvest'),
    '22222222-2222-2222-2222-222222222222'
  )),
  0.00::numeric,
  'the captain in the next village is charged nothing for the drive'
);

select ok(
  (select travel_charge from public.quote_job(
    (select id from public.fields where name = 'Nehar wala khet'),
    (select id from public.services where code = 'wheat_harvest'),
    '33333333-3333-3333-3333-333333333333'
  )) > 0,
  'and the combine 30 km out is paid for coming'
);

-- Checks the chain, not the geography: whatever road_km made of that
-- distance, the charge is the kilometres past the free five at ₹40.
select is(
  (select travel_charge from public.quote_job(
    (select id from public.fields where name = 'Nehar wala khet'),
    (select id from public.services where code = 'wheat_harvest'),
    '33333333-3333-3333-3333-333333333333'
  )),
  (select round(greatest(distance_km - 5, 0) * 40, 2) from public.quote_job(
    (select id from public.fields where name = 'Nehar wala khet'),
    (select id from public.services where code = 'wheat_harvest'),
    '33333333-3333-3333-3333-333333333333'
  )),
  'exactly the kilometres beyond the free five, at the machine''s own rate'
);

select is(
  (select total from public.quote_job(
    (select id from public.fields where name = 'Nehar wala khet'),
    (select id from public.services where code = 'wheat_harvest'),
    '33333333-3333-3333-3333-333333333333'
  )),
  (select round(subtotal + travel_charge, 2) from public.quote_job(
    (select id from public.fields where name = 'Nehar wala khet'),
    (select id from public.services where code = 'wheat_harvest'),
    '33333333-3333-3333-3333-333333333333'
  )),
  'the total is the work plus the drive'
);

-- An hourly job's total cannot be known before the work is done. It used to
-- come back as the travel charge alone — a number made entirely of the drive
-- out, which would have read as the price of the job.
select is(
  (select total from public.quote_job(
    (select id from public.fields where name = 'Nehar wala khet'),
    (select id from public.services where code = 'laser_levelling'),
    '22222222-2222-2222-2222-222222222222'
  )),
  null::numeric,
  'an hourly job says it cannot say yet, instead of quoting the drive'
);

-- ===========================================================================
-- Accepting is what makes the price real
--
-- This is the bug. Every job was created with travel_charge 0 and nothing
-- ever revisited it, so the surcharge was never applied to anything.
-- ===========================================================================

-- The farmer posts against district guidance: a range midpoint, no travel in
-- it, because at posting time there is no captain and so no distance.
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status,
                         is_immediate, quoted_rate, quoted_unit, travel_charge)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       f.area_sqm, 'searching', true, 1500, 'per_killa', 0
from public.fields f where f.name = 'Nehar wala khet';

insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status,
                         is_immediate, quoted_rate, quoted_unit, travel_charge)
select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       f.area_sqm, 'searching', true, 1500, 'per_killa', 0
from public.fields f where f.name = 'Nehar wala khet';

select tests.act_as_admin();
insert into public.job_dispatch (job_id, captain_id, rank)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 1);

select tests.act_as('22222222-2222-2222-2222-222222222222');
select lives_ok(
  $$ select public.accept_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'the nearby captain accepts'
);

select is(
  (select travel_charge from public.jobs
   where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0.00::numeric,
  'and the farmer is not charged travel for a machine from the next village'
);

select tests.act_as('33333333-3333-3333-3333-333333333333');
select lives_ok(
  $$ select public.accept_job('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  'the distant captain accepts the other one'
);

select ok(
  (select travel_charge > 0
      and quoted_total = quoted_subtotal + travel_charge
      -- His own rate, not the 1500 the farmer posted against: the estimate
      -- was district guidance, and accepting is what turns it into a price.
      and quoted_rate = 1200
   from public.jobs where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'and that job now carries his rate, his drive, and a total made of both'
);

-- ===========================================================================
-- The TS and the SQL must agree, and had already drifted
--
-- quote() in packages/pricing and quote_job here deliberately duplicate each
-- other: the phone has to price a job with no signal. The risk of that
-- choice is exactly what happened — TS returned a null total for an hourly
-- job, the SQL returned the travel charge, and nothing compared them.
--
-- This pins the worked example from docs/PRICING.md, which the pricing
-- package's own tests also pin. One concrete case, asserted on both sides.
-- ===========================================================================
-- 2 killa 3 kanal 8 marla = 388 whole marlas, the same input the package's
-- test uses. 2.425 killa at ₹1,100, plus 4 chargeable km at ₹50.
select is(
  round((388 * public.sqm_per_unit('marla') / public.sqm_per_unit('killa') * 1100)::numeric, 2)
    + round((greatest(9 - 5, 0) * 50)::numeric, 2),
  2867.50::numeric,
  'the PRICING.md worked example comes out the same here as in the package'
);

select * from finish();
rollback;
