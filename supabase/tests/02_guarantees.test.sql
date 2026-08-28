-- Phase 2, step 2.3 — the guarantees.
--
-- Three properties this product cannot ship without:
--
--   1. A client cannot decide its own acreage. Area sets the price.
--   2. A farmer's field boundary is not visible to strangers. It is a land
--      record, not public data.
--   3. Two captains accepting the same job produce exactly one winner.
--
-- Everything else in the schema is recoverable. These three are not: each
-- one, if wrong, either costs someone money or leaks their land.

begin;
select plan(18);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
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

-- Act as a given signed-in user.
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

-- A one-killa rectangle near Fazilka: roughly 60.35 m x 67.06 m.
create or replace function tests.killa_polygon(p_lat float8, p_lng float8)
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

-- The helpers are called while acting as a signed-in user, so the
-- authenticated role needs rights on them. Granted after the functions
-- exist, since `all functions` only covers what is already there.
grant usage on schema tests to postgres, anon, authenticated, service_role;
grant execute on all functions in schema tests
  to postgres, anon, authenticated, service_role;

select tests.act_as_admin();
select tests.make_user('11111111-1111-1111-1111-111111111111', '9876500001', 'Gurmeet');
select tests.make_user('22222222-2222-2222-2222-222222222222', '9876500002', 'Balwinder');
select tests.make_user('33333333-3333-3333-3333-333333333333', '9876500003', 'Jaspal');
select tests.make_user('44444444-4444-4444-4444-444444444444', '9876500004', 'Ramesh');

-- ===========================================================================
-- GUARANTEE 1 — the client cannot set its own acreage
-- ===========================================================================
select tests.act_as('11111111-1111-1111-1111-111111111111');

insert into public.fields (owner_id, name, boundary, centroid, area_sqm, capture_method, region_id, confirmed_by_owner)
values (
  '11111111-1111-1111-1111-111111111111',
  'Nehar wala khet',
  tests.killa_polygon(30.4028, 74.0286),
  extensions.st_geographyfromtext('POINT(74.0286 30.4028)'),
  -- A client claiming ten killa for a one-killa plot. If this number
  -- survived, the farmer would be billed roughly ten times over.
  40468.56,
  'drawn',
  (select id from public.regions where slug = 'fazilka'),
  true
);

select ok(
  (select area_sqm from public.fields where name = 'Nehar wala khet') < 5000,
  'the submitted area was discarded, not stored'
);

select ok(
  (select area_sqm from public.fields where name = 'Nehar wala khet') between 3900 and 4200,
  'area was derived from the geometry and is about one killa'
);

select ok(
  (select centroid is not null from public.fields where name = 'Nehar wala khet'),
  'centroid was derived server-side too'
);

-- A self-intersecting ring produces a meaningless area, sometimes a
-- plausible-looking one, which is worse.
select throws_ok(
  $$ insert into public.fields (owner_id, name, boundary, centroid, area_sqm, capture_method)
     values (
       '11111111-1111-1111-1111-111111111111', 'bowtie',
       extensions.st_geographyfromtext('POLYGON((0 0, 1 1, 1 0, 0 1, 0 0))'),
       extensions.st_geographyfromtext('POINT(0 0)'), 1, 'drawn'
     ) $$,
  '23514',
  null,
  'a self-intersecting boundary is rejected'
);

-- Re-measuring a field invalidates the farmer's confirmation of it.
update public.fields
set boundary = tests.killa_polygon(30.4030, 74.0290)
where name = 'Nehar wala khet';

select ok(
  (select not confirmed_by_owner from public.fields where name = 'Nehar wala khet'),
  'changing the boundary clears the owner confirmation'
);

-- ===========================================================================
-- GUARANTEE 2 — a field boundary is not public data
-- ===========================================================================
select tests.act_as('22222222-2222-2222-2222-222222222222');

select is_empty(
  $$ select 1 from public.fields where name = 'Nehar wala khet' $$,
  'a different farmer cannot see the field at all'
);

select tests.act_as('11111111-1111-1111-1111-111111111111');
select isnt_empty(
  $$ select 1 from public.fields where name = 'Nehar wala khet' $$,
  'the owner can see his own field'
);

-- A captain with no relationship to the field sees nothing.
select tests.act_as('33333333-3333-3333-3333-333333333333');
select is_empty(
  $$ select 1 from public.fields where name = 'Nehar wala khet' $$,
  'a captain with no job on the field cannot see it'
);

-- ===========================================================================
-- Captains cannot verify themselves
-- ===========================================================================
select tests.act_as_admin();
insert into public.captains (profile_id, base_location, current_location, is_online, verification, verified_by, verified_at)
values
  ('33333333-3333-3333-3333-333333333333',
   extensions.st_geographyfromtext('POINT(74.0300 30.4040)'),
   extensions.st_geographyfromtext('POINT(74.0300 30.4040)'),
   true, 'verified', '11111111-1111-1111-1111-111111111111', now()),
  ('44444444-4444-4444-4444-444444444444',
   extensions.st_geographyfromtext('POINT(74.0310 30.4050)'),
   extensions.st_geographyfromtext('POINT(74.0310 30.4050)'),
   true, 'pending', null, null);

select tests.act_as('44444444-4444-4444-4444-444444444444');

-- He must be able to change his own operational state. Going online is the
-- one decision he makes every morning, and a policy that blocked it would
-- break the product while looking like good security.
select lives_ok(
  $$ update public.captains set is_online = false
     where profile_id = '44444444-4444-4444-4444-444444444444' $$,
  'a captain can take himself offline'
);

-- But he cannot promote himself. The policy raises rather than silently
-- dropping the row, which is the better failure: an attempt is visible.
select throws_ok(
  $$ update public.captains set verification = 'verified'
     where profile_id = '44444444-4444-4444-4444-444444444444' $$,
  '42501',
  null,
  'a captain cannot verify himself'
);

-- ===========================================================================
-- Billing gate — an unconfirmed area cannot reach a price
-- ===========================================================================
select tests.act_as('11111111-1111-1111-1111-111111111111');

insert into public.fields (owner_id, name, boundary, centroid, area_sqm, capture_method, confirmed_by_owner)
values (
  '11111111-1111-1111-1111-111111111111', 'Unconfirmed plot',
  tests.killa_polygon(30.4100, 74.0400),
  extensions.st_geographyfromtext('POINT(74.04 30.41)'), 1, 'declared', false
);

select throws_ok(
  $$ insert into public.jobs (farmer_id, field_id, service_id, area_sqm, status, is_immediate)
     select '11111111-1111-1111-1111-111111111111',
            f.id,
            (select id from public.services where code = 'wheat_harvest'),
            f.area_sqm, 'searching', true
     from public.fields f where f.name = 'Unconfirmed plot' $$,
  '42501',
  null,
  'a job cannot be booked against an unconfirmed field'
);

-- ===========================================================================
-- GUARANTEE 3 — exactly one captain wins a contested job
-- ===========================================================================
select tests.act_as_admin();

insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate)
select
  '99999999-9999-9999-9999-999999999999',
  '11111111-1111-1111-1111-111111111111',
  f.id,
  (select id from public.services where code = 'wheat_harvest'),
  f.area_sqm, 'searching', true
from public.fields f where f.name = 'Nehar wala khet';

insert into public.job_dispatch (job_id, captain_id, rank)
values
  ('99999999-9999-9999-9999-999999999999', '33333333-3333-3333-3333-333333333333', 1),
  ('99999999-9999-9999-9999-999999999999', '44444444-4444-4444-4444-444444444444', 2);

-- Once dispatched, the captain can see the field he has been asked to work.
select tests.act_as('33333333-3333-3333-3333-333333333333');
select isnt_empty(
  $$ select 1 from public.fields where name = 'Nehar wala khet' $$,
  'a dispatched captain can see the field he was offered'
);

-- First captain accepts.
select lives_ok(
  $$ select public.accept_job('99999999-9999-9999-9999-999999999999') $$,
  'the first captain to accept gets the job'
);

select is(
  (select captain_id::text from public.jobs where id = '99999999-9999-9999-9999-999999999999'),
  '33333333-3333-3333-3333-333333333333',
  'the job is assigned to the captain who accepted'
);

-- Second captain accepts moments later. In production these arrive
-- concurrently; the row lock plus the status predicate inside accept_job is
-- what serialises them. Here we prove the guard rejects the loser.
select tests.act_as('44444444-4444-4444-4444-444444444444');
select throws_ok(
  $$ select public.accept_job('99999999-9999-9999-9999-999999999999') $$,
  '55006',
  'job already taken',
  'the second captain is told the job is gone, not given it'
);

select is(
  (select captain_id::text from public.jobs where id = '99999999-9999-9999-9999-999999999999'),
  '33333333-3333-3333-3333-333333333333',
  'the assignment did not change'
);

-- A captain who was never offered the job cannot accept it.
select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.accept_job('99999999-9999-9999-9999-999999999999') $$,
  '42501',
  'this job was not offered to you',
  'an undispatched captain cannot claim a job'
);

-- Every status change is on the record. When two people disagree about what
-- happened, this table is what settles it.
select tests.act_as_admin();
select ok(
  (select count(*) from public.job_events
   where job_id = '99999999-9999-9999-9999-999999999999') >= 2,
  'the job status history was recorded'
);

select * from finish();
rollback;
