-- Phase 2.5 — the offer.
--
-- dispatch_job is what a farmer's phone calls right after posting a job, and
-- what a captain's phone sees the other end of. These tests walk the exact
-- path the app will: post, offer, accept — plus every way it must refuse.
--
-- The eligibility rules under test are the product:
--   * an unverified captain is never offered work (verification is staff's)
--   * an arrangeable machine is offered only when the job is far enough
--     ahead to clear its lead time — this is the owned/arrangeable contract
--   * nobody is offered the same job twice
--   * only the farmer who posted the job can dispatch it, and only while
--     it is still searching

begin;
select plan(42);

-- ---------------------------------------------------------------------------
-- Fixtures — same helpers as 02_guarantees.
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

grant usage on schema tests to postgres, anon, authenticated, service_role;
grant execute on all functions in schema tests
  to postgres, anon, authenticated, service_role;

select tests.act_as_admin();
select tests.make_user('11111111-1111-1111-1111-111111111111', '9876500001', 'Gurmeet');
select tests.make_user('22222222-2222-2222-2222-222222222222', '9876500002', 'Balwinder');
select tests.make_user('33333333-3333-3333-3333-333333333333', '9876500003', 'Jaspal');
select tests.make_user('44444444-4444-4444-4444-444444444444', '9876500004', 'Ramesh');
select tests.make_user('55555555-5555-5555-5555-555555555555', '9876500005', 'Sukhdev');

-- Three captains near the field. What separates them is the point of the
-- tests: Jaspal is verified, Ramesh is not, and Sukhdev's combine is
-- borrowed from a cousin who needs a day's notice.
insert into public.captains (profile_id, base_location, current_location, is_online, verification, verified_by, verified_at)
values
  ('33333333-3333-3333-3333-333333333333',
   extensions.st_geographyfromtext('POINT(74.0300 30.4040)'),
   extensions.st_geographyfromtext('POINT(74.0300 30.4040)'),
   true, 'verified', '11111111-1111-1111-1111-111111111111', now()),
  ('44444444-4444-4444-4444-444444444444',
   extensions.st_geographyfromtext('POINT(74.0310 30.4050)'),
   extensions.st_geographyfromtext('POINT(74.0310 30.4050)'),
   true, 'pending', null, null),
  ('55555555-5555-5555-5555-555555555555',
   extensions.st_geographyfromtext('POINT(74.0320 30.4060)'),
   extensions.st_geographyfromtext('POINT(74.0320 30.4060)'),
   true, 'verified', '11111111-1111-1111-1111-111111111111', now());

-- Machines and rates belong to their captains, so insert them as each
-- captain — the same RLS path the app's sync will use.
select tests.act_as('33333333-3333-3333-3333-333333333333');
insert into public.captain_machines (captain_id, machine_type_id, ownership, lead_time_hours)
values ('33333333-3333-3333-3333-333333333333',
        (select id from public.machine_types where code = 'combine'), 'owned', 0);
insert into public.captain_services (captain_id, service_id, rate, rate_unit)
values ('33333333-3333-3333-3333-333333333333',
        (select id from public.services where code = 'wheat_harvest'), 1100, 'per_killa');

select tests.act_as('44444444-4444-4444-4444-444444444444');
insert into public.captain_machines (captain_id, machine_type_id, ownership, lead_time_hours)
values ('44444444-4444-4444-4444-444444444444',
        (select id from public.machine_types where code = 'combine'), 'owned', 0);
insert into public.captain_services (captain_id, service_id, rate, rate_unit)
values ('44444444-4444-4444-4444-444444444444',
        (select id from public.services where code = 'wheat_harvest'), 1100, 'per_killa');

select tests.act_as('55555555-5555-5555-5555-555555555555');
insert into public.captain_machines (captain_id, machine_type_id, ownership, lead_time_hours)
values ('55555555-5555-5555-5555-555555555555',
        (select id from public.machine_types where code = 'combine'), 'arrangeable', 24);
insert into public.captain_services (captain_id, service_id, rate, rate_unit)
values ('55555555-5555-5555-5555-555555555555',
        (select id from public.services where code = 'wheat_harvest'), 1050, 'per_killa');

-- The farmer's field and two jobs, inserted through the RLS policies the
-- phone will use — not as admin, which would prove nothing about the path.
select tests.act_as('11111111-1111-1111-1111-111111111111');

insert into public.fields (owner_id, name, boundary, centroid, area_sqm, capture_method, region_id, confirmed_by_owner)
values (
  '11111111-1111-1111-1111-111111111111',
  'Nehar wala khet',
  tests.killa_polygon(30.4028, 74.0286),
  extensions.st_geographyfromtext('POINT(74.0286 30.4028)'),
  1, 'drawn',
  (select id from public.regions where slug = 'fazilka'),
  true
);

-- Job A: wanted now.
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       f.area_sqm, 'searching', true
from public.fields f where f.name = 'Nehar wala khet';

-- Job B: wanted the day after tomorrow, in the morning — far enough ahead
-- that a borrowed machine can clear a 24-hour lead time at any hour CI runs.
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status,
                         is_immediate, scheduled_date, scheduled_window)
select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       f.area_sqm, 'searching', false, current_date + 2, 'morning'
from public.fields f where f.name = 'Nehar wala khet';

-- ===========================================================================
-- The immediate job: only the captain who can actually start now
-- ===========================================================================

select is(
  public.dispatch_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'an immediate job is offered only to the verified captain with his own machine'
);

select is(
  (select captain_id::text from public.job_dispatch
   where job_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  '33333333-3333-3333-3333-333333333333',
  'the offer went to Jaspal, not the unverified Ramesh and not the borrowed combine'
);

select is(
  (select count(*)::int from public.job_dispatch
   where job_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'exactly one dispatch row'
);

select is(
  (select response::text from public.job_dispatch
   where job_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'pending',
  'the offer starts pending'
);

select is(
  (select rank from public.job_dispatch
   where job_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'the only offer is rank 1'
);

-- ===========================================================================
-- Re-dispatch never duplicates an offer
-- ===========================================================================

select is(
  public.dispatch_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  're-dispatching offers nobody new'
);

select is(
  (select count(*)::int from public.job_dispatch
   where job_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'Jaspal is not pinged twice for the same job'
);

-- ===========================================================================
-- The scheduled job: a borrowed machine qualifies once the notice clears
-- ===========================================================================

select is(
  public.dispatch_job('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  2,
  'a job two days out is offered to both captains whose machines can make it'
);

select is(
  (select rank from public.job_dispatch
   where job_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
     and captain_id = '33333333-3333-3333-3333-333333333333'),
  1,
  'the nearer owned combine is rank 1'
);

select is(
  (select rank from public.job_dispatch
   where job_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
     and captain_id = '55555555-5555-5555-5555-555555555555'),
  2,
  'the borrowed combine, farther out, is rank 2'
);

-- ===========================================================================
-- The guards
-- ===========================================================================

-- An unverified captain was never offered, so accepting is refused — with
-- the message that says he was never asked, which is true here.
select tests.act_as('44444444-4444-4444-4444-444444444444');
select throws_ok(
  $$ select public.accept_job('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '42501',
  null,
  'a captain who was never offered cannot accept'
);

-- The borrowed combine takes the scheduled job: lead time gates the offer,
-- not the acceptance.
select tests.act_as('55555555-5555-5555-5555-555555555555');
select lives_ok(
  $$ select public.accept_job('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  'the arrangeable captain can accept work he was offered'
);

select is(
  (select captain_id::text from public.jobs
   where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  '55555555-5555-5555-5555-555555555555',
  'the scheduled job is his'
);

-- Dispatching a job that already has a captain is refused.
select tests.act_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ select public.dispatch_job('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '55006',
  'job is not searching',
  'an accepted job cannot be dispatched again'
);

-- Only the farmer who posted it can dispatch it.
select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.dispatch_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501',
  'only the farmer who posted the job can dispatch it',
  'another farmer cannot dispatch someone else''s job'
);

-- An anonymous caller cannot so much as execute the function.
select tests.act_as_admin();
select set_config('role', 'anon', true);
select throws_ok(
  $$ select public.dispatch_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501',
  null,
  'anon cannot execute dispatch_job at all'
);

-- ===========================================================================
-- The immediate job's ending: offered, accepted, assigned
-- ===========================================================================

select tests.act_as('33333333-3333-3333-3333-333333333333');
select lives_ok(
  $$ select public.accept_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'the verified captain accepts the immediate job'
);

select is(
  (select captain_id::text from public.jobs
   where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  '33333333-3333-3333-3333-333333333333',
  'the immediate job is assigned to him'
);

-- ===========================================================================
-- The 6am case
--
-- dispatch_job used to be called once, at insert. A job posted before any
-- captain was online was therefore offered to nobody and sat in 'searching'
-- forever — the farmer watching a screen that said "finding a captain" and
-- meant nothing. The app now re-offers every pass; this is the behaviour
-- that makes that worth doing.
-- ===========================================================================
select tests.act_as_admin();
update public.captains set is_online = false
where profile_id = '33333333-3333-3333-3333-333333333333';

select tests.act_as('11111111-1111-1111-1111-111111111111');

insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate)
select 'dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       f.area_sqm, 'searching', true
from public.fields f where f.name = 'Nehar wala khet';

select is(
  public.dispatch_job('dddddddd-dddd-dddd-dddd-dddddddddddd'),
  0,
  'a job posted when nobody is available is offered to nobody'
);

select tests.act_as_admin();
update public.captains set is_online = true
where profile_id = '33333333-3333-3333-3333-333333333333';

select tests.act_as('11111111-1111-1111-1111-111111111111');

select is(
  public.dispatch_job('dddddddd-dddd-dddd-dddd-dddddddddddd'),
  1,
  'and is offered the moment a captain comes online, instead of sitting forever'
);

-- ===========================================================================
-- Rate guidance
--
-- The promise on the farmer's posting screen is that the suggested rate
-- "comes from what has actually been paid nearby, never from a number the
-- platform invented". It was ordering by quoted_rate — the number the
-- platform invented. Guidance learned from its own guesses, so it could
-- never fall, and a farmer who talked 1200 down to 900 still handed 1200 to
-- the next farmer. These are the assertions that tell the two apart.
-- ===========================================================================
select tests.act_as_admin();

-- One killa each, so the realised rate is the money itself and the
-- arithmetic under test stays visible.
insert into public.jobs (
  farmer_id, field_id, service_id, captain_id, area_sqm, status,
  is_immediate, quoted_rate, quoted_unit, final_amount, completed_at
)
select '11111111-1111-1111-1111-111111111111', f.id,
       (select id from public.services where code = 'wheat_harvest'),
       '33333333-3333-3333-3333-333333333333',
       4046.8564224, 'completed', true, 1200, 'per_killa', paid, now()
from public.fields f, (values (800), (900), (1000)) as v(paid)
where f.name = 'Nehar wala khet';

select is(
  (select low from public.rate_guidance(
    (select id from public.services where code = 'wheat_harvest'),
    (select extensions.st_y(centroid::extensions.geometry)
     from public.fields where name = 'Nehar wala khet'),
    (select extensions.st_x(centroid::extensions.geometry)
     from public.fields where name = 'Nehar wala khet')
  )),
  850.00::numeric,
  'guidance reports what was paid, not the 1200 every one of them was quoted'
);

select is(
  (select sample_size from public.rate_guidance(
    (select id from public.services where code = 'wheat_harvest'),
    (select extensions.st_y(centroid::extensions.geometry)
     from public.fields where name = 'Nehar wala khet'),
    (select extensions.st_x(centroid::extensions.geometry)
     from public.fields where name = 'Nehar wala khet')
  )),
  3,
  'and counts the jobs it drew that from'
);

-- Travel is a charge for distance, not a rate for work. Folding it in would
-- make every far field look like an expensive one.
insert into public.jobs (
  farmer_id, field_id, service_id, captain_id, area_sqm, status,
  is_immediate, quoted_rate, quoted_unit, final_amount, travel_charge, completed_at
)
select '11111111-1111-1111-1111-111111111111', f.id,
       (select id from public.services where code = 'wheat_harvest'),
       '33333333-3333-3333-3333-333333333333',
       4046.8564224, 'completed', true, 1200, 'per_killa', 1100, 200, now()
from public.fields f where f.name = 'Nehar wala khet';

select is(
  (select high from public.rate_guidance(
    (select id from public.services where code = 'wheat_harvest'),
    (select extensions.st_y(centroid::extensions.geometry)
     from public.fields where name = 'Nehar wala khet'),
    (select extensions.st_x(centroid::extensions.geometry)
     from public.fields where name = 'Nehar wala khet')
  )),
  925.00::numeric,
  'travel money is not mistaken for a work rate'
);

-- A job marked complete with no amount named is not evidence of anything.
insert into public.jobs (
  farmer_id, field_id, service_id, captain_id, area_sqm, status,
  is_immediate, quoted_rate, quoted_unit, completed_at
)
select '11111111-1111-1111-1111-111111111111', f.id,
       (select id from public.services where code = 'wheat_harvest'),
       '33333333-3333-3333-3333-333333333333',
       4046.8564224, 'completed', true, 1200, 'per_killa', now()
from public.fields f where f.name = 'Nehar wala khet';

select is(
  (select sample_size from public.rate_guidance(
    (select id from public.services where code = 'wheat_harvest'),
    (select extensions.st_y(centroid::extensions.geometry)
     from public.fields where name = 'Nehar wala khet'),
    (select extensions.st_x(centroid::extensions.geometry)
     from public.fields where name = 'Nehar wala khet')
  )),
  4,
  'a job that was never paid does not vote'
);

-- ===========================================================================
-- Getting out of a job
--
-- There was no way out of one. A farmer who posted by mistake had the job
-- re-offered to captains on every sync pass, and a captain whose combine
-- broke after accepting could not hand it back — the farmer waited on a
-- machine that was never coming. cancel_job and release_job are two
-- different events on purpose: a breakdown is not a cancellation.
-- ===========================================================================

select tests.act_as('11111111-1111-1111-1111-111111111111');

insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate)
select 'ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       f.area_sqm, 'searching', true
from public.fields f where f.name = 'Nehar wala khet';

select is(
  public.dispatch_job('ffffffff-ffff-ffff-ffff-ffffffffffff'),
  1,
  'the job to be cancelled is offered to Jaspal first, so there is an open offer to close'
);

-- Balwinder has nothing to do with this job.
select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.cancel_job('ffffffff-ffff-ffff-ffff-ffffffffffff') $$,
  '42501',
  null,
  'a stranger cannot cancel somebody else''s job'
);

-- Being offered the work is not the same as owning it.
select tests.act_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  $$ select public.cancel_job('ffffffff-ffff-ffff-ffff-ffffffffffff') $$,
  '42501',
  null,
  'a captain cannot cancel the farmer''s job'
);

select tests.act_as('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ select public.cancel_job('ffffffff-ffff-ffff-ffff-ffffffffffff', 'crop not ready') $$,
  'the farmer who posted it can withdraw it'
);

select is(
  (select status::text from public.jobs where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  'cancelled',
  'and the job is cancelled, with his reason on the record'
);

select is_empty(
  $$ select 1 from public.job_dispatch
     where job_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' and response = 'pending' $$,
  'the open offer is closed, so captains stop seeing work that no longer exists'
);

select throws_ok(
  $$ select public.dispatch_job('ffffffff-ffff-ffff-ffff-ffffffffffff') $$,
  '55006',
  null,
  'and every sync pass after this stops ringing captains about it'
);

-- ---------------------------------------------------------------------------
-- The captain hands one back
--
-- Scheduled far enough ahead that Sukhdev's borrowed combine clears its lead
-- time too — so there is somebody else for the job to reach.
-- ---------------------------------------------------------------------------
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status,
                         is_immediate, scheduled_date, scheduled_window)
select 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       f.area_sqm, 'searching', false, current_date + 2, 'morning'
from public.fields f where f.name = 'Nehar wala khet';

select is(
  public.dispatch_job('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  2,
  'a job far enough ahead reaches the borrowed combine as well as the owned one'
);

select tests.act_as('33333333-3333-3333-3333-333333333333');
select lives_ok(
  $$ select public.accept_job('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') $$,
  'Jaspal takes it'
);

select tests.act_as('55555555-5555-5555-5555-555555555555');
select throws_ok(
  $$ select public.release_job('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') $$,
  '42501',
  null,
  'a captain cannot release a job that was given to someone else'
);

select tests.act_as('33333333-3333-3333-3333-333333333333');
select lives_ok(
  $$ select public.release_job('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'combine broke') $$,
  'and when his combine breaks he can hand it back'
);

select is(
  (select status::text || coalesce(captain_id::text, ' unassigned')
   from public.jobs where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  'searching unassigned',
  'the job goes back on the market rather than dying with his breakdown'
);

-- This is the whole point: the farmer is not stranded.
select tests.act_as('55555555-5555-5555-5555-555555555555');
select lives_ok(
  $$ select public.accept_job('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') $$,
  'and the other captain can pick it up'
);

-- ---------------------------------------------------------------------------
-- Once the machine is in the field, neither of them gets a button
-- ---------------------------------------------------------------------------
select tests.act_as_admin();
insert into public.jobs (id, farmer_id, field_id, service_id, captain_id, area_sqm,
                         status, is_immediate, started_at)
select '99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       '33333333-3333-3333-3333-333333333333',
       f.area_sqm, 'in_progress', true, now()
from public.fields f where f.name = 'Nehar wala khet';

select tests.act_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ select public.cancel_job('99999999-9999-9999-9999-999999999999') $$,
  '55006',
  null,
  'a farmer cannot cancel work already underway — that is a settlement, not a cancellation'
);

select tests.act_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  $$ select public.release_job('99999999-9999-9999-9999-999999999999') $$,
  '55006',
  null,
  'and a captain cannot walk off a field he has already started cutting'
);

-- ---------------------------------------------------------------------------
-- And the guard is on the table, not only inside the functions
--
-- jobs_update_party lets a party write any column on their own job. Without
-- this trigger both rules above were advisory: setting the column directly
-- walked straight past them.
-- ---------------------------------------------------------------------------
select tests.act_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ update public.jobs set status = 'cancelled'
     where id = '99999999-9999-9999-9999-999999999999' $$,
  '55006',
  null,
  'writing the status column directly does not get around the in-progress rule'
);

select throws_ok(
  $$ update public.jobs set status = 'searching', captain_id = null
     where id = '99999999-9999-9999-9999-999999999999' $$,
  '55006',
  null,
  'and a job already underway cannot be pushed back onto the market'
);

select tests.act_as_admin();
update public.jobs set status = 'completed', completed_at = now()
where id = '99999999-9999-9999-9999-999999999999';

select throws_ok(
  $$ update public.jobs set status = 'in_progress'
     where id = '99999999-9999-9999-9999-999999999999' $$,
  '55006',
  null,
  'finished work is finished — a completed job cannot be reopened'
);

select * from finish();
rollback;
