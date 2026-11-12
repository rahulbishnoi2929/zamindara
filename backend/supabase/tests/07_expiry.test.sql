-- Jobs that have had their day.
--
-- `expired` was in the enum from the first migration and nothing ever set
-- it, so a job nobody accepted stayed `searching` forever — re-offered on
-- every sync pass, ringing captains' phones about harvests already done.
--
-- These assertions are about the one rule: a request stands for the day it
-- was wanted, and no longer. The important ones are the things expiry must
-- NOT touch, because a sweep that is callable by anyone and runs on every
-- sync pass had better be precise.

begin;
select plan(11);

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
select tests.make_user('11111111-1111-1111-1111-111111111111', '9876500201', 'Gurmeet');
select tests.make_user('22222222-2222-2222-2222-222222222222', '9876500202', 'Jaspal');

insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at)
values ('22222222-2222-2222-2222-222222222222',
        extensions.st_geographyfromtext('POINT(74.0300 30.4040)'),
        extensions.st_geographyfromtext('POINT(74.0300 30.4040)'),
        true, 'verified', '11111111-1111-1111-1111-111111111111', now());

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
-- When a request stops standing
-- ===========================================================================

-- A job wanted the day before yesterday. Still searching, because nothing
-- ever expired anything.
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status,
                         is_immediate, scheduled_date, scheduled_window)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       f.area_sqm, 'searching', false, current_date - 2, 'morning'
from public.fields f where f.name = 'Nehar wala khet';

-- Wanted tomorrow. Must survive.
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status,
                         is_immediate, scheduled_date, scheduled_window)
select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       f.area_sqm, 'searching', false, current_date + 1, 'morning'
from public.fields f where f.name = 'Nehar wala khet';

-- Posted "now", today. Must survive today, whatever hour CI runs at.
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status,
                         is_immediate)
select 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       f.area_sqm, 'searching', true
from public.fields f where f.name = 'Nehar wala khet';

-- A job from last week that a captain actually took. Expiry must not touch
-- work in hand: he may still be cutting it, or owed for it.
select tests.act_as_admin();
insert into public.jobs (id, farmer_id, field_id, service_id, captain_id, area_sqm,
                         status, is_immediate, scheduled_date, accepted_at)
select 'dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       '22222222-2222-2222-2222-222222222222',
       f.area_sqm, 'accepted', false, current_date - 7, now()
from public.fields f where f.name = 'Nehar wala khet';

-- An open offer on the lapsed job. This is the stale ping itself.
insert into public.job_dispatch (job_id, captain_id, rank)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '22222222-2222-2222-2222-222222222222', 1);

select tests.act_as('11111111-1111-1111-1111-111111111111');

select is(
  public.expire_stale_jobs(),
  1,
  'the request for a day that has passed lapses'
);

select is(
  (select status::text from public.jobs
   where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'expired',
  'and says so, rather than claiming to still be looking for a captain'
);

select is_empty(
  $$ select 1 from public.job_dispatch
     where job_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and response = 'pending' $$,
  'its open offer is closed — that offer is the stale ping on a captain''s phone'
);

select is(
  (select status::text from public.jobs
   where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'searching',
  'tomorrow''s request is untouched'
);

select is(
  (select status::text from public.jobs
   where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'searching',
  'and a job posted today survives today, whatever hour it is'
);

select is(
  (select status::text from public.jobs
   where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'accepted',
  'work a captain has taken is never expired, however old — he may still be owed for it'
);

-- Called on every sync pass by every client, so a second call must be a
-- no-op rather than a second round of writes and audit rows.
select is(
  public.expire_stale_jobs(),
  0,
  'calling it again finds nothing: it is idempotent'
);

-- ===========================================================================
-- A lapsed job is finished with
-- ===========================================================================

select throws_ok(
  $$ select public.dispatch_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '55006',
  null,
  'a lapsed job is not offered to anybody again'
);

select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.accept_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '55006',
  null,
  'and a captain who still had it on screen cannot take yesterday''s work'
);

-- ===========================================================================
-- Nobody gets to decide this but the clock
-- ===========================================================================

-- A captain running the sweep is normal — his app syncs too — and it must
-- reach the same answer, not his own convenience.
select is(
  public.expire_stale_jobs(),
  0,
  'a captain may run the sweep; it is the clock that decides, not the caller'
);

select tests.act_as_admin();
select set_config('request.jwt.claims', '', true);
select set_config('role', 'anon', true);
select throws_ok(
  $$ select public.expire_stale_jobs() $$,
  '28000',
  null,
  'and a stranger who is not signed in cannot run it at all'
);

select * from finish();
rollback;
