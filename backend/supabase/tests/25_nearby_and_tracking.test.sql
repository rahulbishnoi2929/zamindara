-- Batch C: "available now", and the captain's position on a live job.

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
select tests.make_user('11111111-1111-1111-1111-111111111111', '919876501701', 'Gurmeet');
select tests.make_user('99999999-9999-9999-9999-999999999999', '919876501799', 'Stranger');
-- Three combine captains near the field: idle and online, busy, and offline.
select tests.make_user(('22222222-2222-2222-2222-00000000000' || n)::uuid, '91987650171' || n, 'Captain ' || n)
from generate_series(1, 3) n;
insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at, service_radius_km)
select ('22222222-2222-2222-2222-00000000000' || n)::uuid,
       extensions.st_geographyfromtext('POINT(74.03 30.41)'), extensions.st_geographyfromtext('POINT(74.03 30.41)'),
       n <> 3, 'verified', '11111111-1111-1111-1111-111111111111', now(), 15
from generate_series(1, 3) n;
insert into public.captain_machines (id, captain_id, machine_type_id, ownership)
select ('cccccccc-0000-0000-0000-00000000170' || n)::uuid, ('22222222-2222-2222-2222-00000000000' || n)::uuid,
       (select id from public.machine_types where code = 'combine'), 'owned'
from generate_series(1, 3) n;
insert into public.captain_services (captain_id, service_id, rate, rate_unit)
select ('22222222-2222-2222-2222-00000000000' || n)::uuid, (select id from public.services where code = 'wheat_harvest'), 3500, 'per_killa'
from generate_series(1, 3) n;

insert into public.fields (id, owner_id, name, boundary, capture_method, confirmed_by_owner)
values ('aaaaaaaa-0000-0000-0000-000000001701', '11111111-1111-1111-1111-111111111111', 'Khet',
        tests.killa_polygon(30.4028, 74.0286), 'drawn', true);
-- Captain 2 is busy: a job of Gurmeet's, accepted, on his combine.
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate, captain_id, accepted_at)
values ('bbbbbbbb-0000-0000-0000-000000001701', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000001701', (select id from public.services where code = 'wheat_harvest'),
        4046.86, 'accepted', true, '22222222-2222-2222-2222-000000000002', now());

select tests.act_as('11111111-1111-1111-1111-111111111111');
select is(
  (select array_agg(row(machine_code, captains)::text) from public.available_nearby('aaaaaaaa-0000-0000-0000-000000001701')),
  array['(combine,1)'],
  'one combine is free near his field: not the busy one, not the offline one'
);
select tests.act_as('99999999-9999-9999-9999-999999999999');
select throws_ok(
  $$ select * from public.available_nearby('aaaaaaaa-0000-0000-0000-000000001701') $$,
  '42501', null, 'only about your own field'
);

-- Tracking: only while on the way or working.
select tests.act_as('22222222-2222-2222-2222-000000000002');
select throws_ok(
  $$ select public.report_job_location('bbbbbbbb-0000-0000-0000-000000001701', 30.41, 74.03) $$,
  '42501', null, 'not reported before he sets off'
);
update public.jobs set status = 'en_route' where id = 'bbbbbbbb-0000-0000-0000-000000001701';
select lives_ok(
  $$ select public.report_job_location('bbbbbbbb-0000-0000-0000-000000001701', 30.41, 74.03) $$,
  'on the way, he reports where he is'
);
select tests.act_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  $$ select public.report_job_location('bbbbbbbb-0000-0000-0000-000000001701', 30.0, 74.0) $$,
  '42501', null, 'nobody else can move his dot'
);

select tests.act_as('11111111-1111-1111-1111-111111111111');
select ok(
  (select km between 0.5 and 2 from public.job_captain_location('bbbbbbbb-0000-0000-0000-000000001701')),
  'the farmer sees how far his captain is'
);
select tests.act_as('99999999-9999-9999-9999-999999999999');
select throws_ok(
  $$ select * from public.job_captain_location('bbbbbbbb-0000-0000-0000-000000001701') $$,
  '42501', null, 'nobody else does'
);
select throws_ok(
  $$ select 1 from public.job_locations $$,
  '42501', null, 'and the table itself is closed'
);

select tests.act_as_admin();
update public.job_locations set updated_at = now() - interval '45 minutes';
select tests.act_as('11111111-1111-1111-1111-111111111111');
select is_empty(
  $$ select 1 from public.job_captain_location('bbbbbbbb-0000-0000-0000-000000001701') $$,
  'a position older than half an hour is not shown'
);

select tests.act_as_admin();
update public.job_locations set updated_at = now();
update public.jobs set status = 'in_progress', started_at = now() where id = 'bbbbbbbb-0000-0000-0000-000000001701';
update public.jobs set status = 'completed', completed_at = now(), final_amount = 3500, payment_mode = 'cash'
where id = 'bbbbbbbb-0000-0000-0000-000000001701';
select tests.act_as('11111111-1111-1111-1111-111111111111');
select is_empty(
  $$ select 1 from public.job_captain_location('bbbbbbbb-0000-0000-0000-000000001701') $$,
  'once the job is done, his position is not shown'
);
select tests.act_as('22222222-2222-2222-2222-000000000002');
select throws_ok(
  $$ select public.report_job_location('bbbbbbbb-0000-0000-0000-000000001701', 30.41, 74.03) $$,
  '42501', null, 'nor reported'
);

select * from finish();
rollback;
