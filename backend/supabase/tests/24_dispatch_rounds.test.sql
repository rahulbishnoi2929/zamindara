-- Batch B: dispatch rounds, a wider search, ringing again.

begin;
select plan(13);

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
update public.app_config set auto_dispatch = true;
select tests.make_user('11111111-1111-1111-1111-111111111111', '919876501601', 'Gurmeet');
select tests.make_user('99999999-9999-9999-9999-999999999999', '919876501699', 'Stranger');

-- Seven captains within a kilometre of the field, and one 18 km north with a 15 km radius.
select tests.make_user(('22222222-2222-2222-2222-00000000000' || n)::uuid, '91987650161' || n, 'Captain ' || n)
from generate_series(1, 8) n;
insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at, service_radius_km)
select ('22222222-2222-2222-2222-00000000000' || n)::uuid,
       extensions.st_geographyfromtext(format('POINT(74.03 %s)', case when n = 8 then 30.565 else 30.404 + n * 0.001 end)),
       extensions.st_geographyfromtext(format('POINT(74.03 %s)', case when n = 8 then 30.565 else 30.404 + n * 0.001 end)),
       true, 'verified', '11111111-1111-1111-1111-111111111111', now(), 15
from generate_series(1, 8) n;
insert into public.captain_machines (captain_id, machine_type_id, ownership)
select ('22222222-2222-2222-2222-00000000000' || n)::uuid, (select id from public.machine_types where code = 'combine'), 'owned'
from generate_series(1, 8) n;
insert into public.captain_services (captain_id, service_id, rate, rate_unit)
select ('22222222-2222-2222-2222-00000000000' || n)::uuid, (select id from public.services where code = 'wheat_harvest'), 3500, 'per_killa'
from generate_series(1, 8) n;

insert into public.fields (id, owner_id, name, boundary, capture_method, confirmed_by_owner)
select ('aaaaaaaa-0000-0000-0000-00000000160' || n)::uuid, '11111111-1111-1111-1111-111111111111',
       'Khet ' || n, tests.killa_polygon(30.4028 + n * 0.0005, 74.0286), 'drawn', true
from generate_series(1, 3) n;
-- 1: a "now" job. 2: a "now" job asked one captain at a time. 3: a job for later.
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate, scheduled_date)
select ('bbbbbbbb-0000-0000-0000-00000000160' || n)::uuid, '11111111-1111-1111-1111-111111111111',
       ('aaaaaaaa-0000-0000-0000-00000000160' || n)::uuid, (select id from public.services where code = 'wheat_harvest'),
       4046.86, 'searching', n < 3, case when n = 3 then (now() at time zone 'Asia/Kolkata')::date + 3 end
from generate_series(1, 3) n;

-- Moves a round into the past, as if the farmer's next pass came later.
create function tests.age_offers(p_job uuid, p_secs integer) returns void language sql as $$
  update public.job_dispatch set sent_at = sent_at - make_interval(secs => p_secs) where job_id = p_job;
$$;

select tests.act_as('11111111-1111-1111-1111-111111111111');
select is(public.dispatch_job('bbbbbbbb-0000-0000-0000-000000001601'), 5, 'round one: the best five are asked');
select is(public.dispatch_job('bbbbbbbb-0000-0000-0000-000000001601'), 0, 'while the round runs, nobody else is');
select is(public.repeat_ping_due('bbbbbbbb-0000-0000-0000-000000001601'), 0, 'nothing to ring again before 30 seconds');

select tests.act_as_admin();
select tests.age_offers('bbbbbbbb-0000-0000-0000-000000001601', 40);
select tests.act_as('11111111-1111-1111-1111-111111111111');
select is(public.repeat_ping_due('bbbbbbbb-0000-0000-0000-000000001601'), 5, 'unanswered at 30 seconds: ring the five again');
select is(public.repeat_ping_due('bbbbbbbb-0000-0000-0000-000000001601'), 0, 'but only once');

select tests.act_as_admin();
select tests.age_offers('bbbbbbbb-0000-0000-0000-000000001601', 60);
select tests.act_as('11111111-1111-1111-1111-111111111111');
select is(public.dispatch_job('bbbbbbbb-0000-0000-0000-000000001601'), 2,
  'after 90 seconds, round two asks the two nearby captains not yet asked');
select tests.act_as_admin();
select is(
  (select count(*)::integer from public.job_dispatch
   where job_id = 'bbbbbbbb-0000-0000-0000-000000001601' and response = 'timed_out'),
  5, 'and round one is closed as timed out'
);

select tests.age_offers('bbbbbbbb-0000-0000-0000-000000001601', 100);
select tests.act_as('11111111-1111-1111-1111-111111111111');
select public.dispatch_job('bbbbbbbb-0000-0000-0000-000000001601');
select tests.act_as_admin();
select isnt(
  (select search_exhausted_at from public.jobs where id = 'bbbbbbbb-0000-0000-0000-000000001601'),
  null, 'everyone nearby asked and nobody took it: the farmer is told'
);

select tests.act_as('99999999-9999-9999-9999-999999999999');
select throws_ok(
  $$ select public.widen_search('bbbbbbbb-0000-0000-0000-000000001601') $$,
  '42501', null, 'only the farmer can widen his search'
);
select tests.act_as('11111111-1111-1111-1111-111111111111');
select is(public.widen_search('bbbbbbbb-0000-0000-0000-000000001601'), 10, 'he asks 10 km farther');
select is(public.dispatch_job('bbbbbbbb-0000-0000-0000-000000001601'), 1,
  'and the captain 18 km out, past his own 15, is asked');

-- One at a time: three rounds, then stop, though captains remain.
select public.dispatch_job('bbbbbbbb-0000-0000-0000-000000001602', 1);
select tests.act_as_admin();
select tests.age_offers('bbbbbbbb-0000-0000-0000-000000001602', 100);
select tests.act_as('11111111-1111-1111-1111-111111111111');
select public.dispatch_job('bbbbbbbb-0000-0000-0000-000000001602', 1);
select tests.act_as_admin();
select tests.age_offers('bbbbbbbb-0000-0000-0000-000000001602', 100);
select tests.act_as('11111111-1111-1111-1111-111111111111');
select public.dispatch_job('bbbbbbbb-0000-0000-0000-000000001602', 1);
select tests.act_as_admin();
select tests.age_offers('bbbbbbbb-0000-0000-0000-000000001602', 100);
select tests.act_as('11111111-1111-1111-1111-111111111111');
select is(public.dispatch_job('bbbbbbbb-0000-0000-0000-000000001602', 1), 0,
  'three rounds, then the search stops');

-- A job for later is an open offer: its pings never time out.
select public.dispatch_job('bbbbbbbb-0000-0000-0000-000000001603');
select tests.act_as_admin();
select tests.age_offers('bbbbbbbb-0000-0000-0000-000000001603', 1000);
select tests.act_as('11111111-1111-1111-1111-111111111111');
select public.dispatch_job('bbbbbbbb-0000-0000-0000-000000001603');
select tests.act_as_admin();
select is(
  (select count(*)::integer from public.job_dispatch
   where job_id = 'bbbbbbbb-0000-0000-0000-000000001603' and response = 'pending'),
  5, 'a later job keeps its offers open: no rounds'
);

select * from finish();
rollback;
