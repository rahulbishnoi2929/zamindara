-- Stage 4.6: a job runs on a specific machine; two combines are two queues.

begin;
select plan(9);

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
select tests.make_user('11111111-1111-1111-1111-111111111111', '919876501201', 'Gurmeet');
select tests.make_user('22222222-2222-2222-2222-222222222222', '919876501202', 'Jaspal');
insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at)
values ('22222222-2222-2222-2222-222222222222',
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        true, 'verified', '11111111-1111-1111-1111-111111111111', now());
-- Two combines (the first is older) and a tractor.
insert into public.captain_machines (id, captain_id, machine_type_id, ownership, created_at)
values ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
        (select id from public.machine_types where code = 'combine'), 'owned', now() - interval '1 day'),
       ('cccccccc-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
        (select id from public.machine_types where code = 'combine'), 'owned', now()),
       ('cccccccc-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
        (select id from public.machine_types where code = 'tractor'), 'owned', now());
insert into public.captain_services (captain_id, service_id, rate, rate_unit)
values ('22222222-2222-2222-2222-222222222222', (select id from public.services where code = 'wheat_harvest'),
        3500, 'per_killa');

-- Three fields, a job on each, the first two offered to him.
insert into public.fields (id, owner_id, name, boundary, capture_method, confirmed_by_owner)
select ('aaaaaaaa-0000-0000-0000-00000000120' || n)::uuid, '11111111-1111-1111-1111-111111111111',
       'Khet ' || n, tests.killa_polygon(30.4028 + n * 0.001, 74.0286), 'drawn', true
from generate_series(1, 3) n;
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate)
select ('bbbbbbbb-0000-0000-0000-00000000120' || n)::uuid, '11111111-1111-1111-1111-111111111111',
       ('aaaaaaaa-0000-0000-0000-00000000120' || n)::uuid,
       (select id from public.services where code = 'wheat_harvest'), 4046.86, 'searching', true
from generate_series(1, 3) n;
insert into public.job_dispatch (job_id, captain_id, rank)
values ('bbbbbbbb-0000-0000-0000-000000001201', '22222222-2222-2222-2222-222222222222', 1),
       ('bbbbbbbb-0000-0000-0000-000000001202', '22222222-2222-2222-2222-222222222222', 1);

select tests.act_as('22222222-2222-2222-2222-222222222222');
select is(
  (select machine_id from public.accept_job('bbbbbbbb-0000-0000-0000-000000001201')),
  'cccccccc-0000-0000-0000-000000000001'::uuid,
  'on accept the job lands on a combine of his, not his tractor'
);

select tests.act_as_admin();
select is(
  (select queue_load from public.eligible_captains('aaaaaaaa-0000-0000-0000-000000001203',
     (select id from public.services where code = 'wheat_harvest'))),
  0,
  'with one combine busy, his idle second combine still counts as free'
);

select tests.act_as('22222222-2222-2222-2222-222222222222');
select is(
  (select machine_id from public.accept_job('bbbbbbbb-0000-0000-0000-000000001202')),
  'cccccccc-0000-0000-0000-000000000002'::uuid,
  'his second job goes to the idle combine'
);

select tests.act_as_admin();
select is(
  (select queue_load from public.eligible_captains('aaaaaaaa-0000-0000-0000-000000001203',
     (select id from public.services where code = 'wheat_harvest'))),
  1,
  'with both busy, he is loaded'
);

select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ update public.jobs set machine_id = 'cccccccc-0000-0000-0000-000000000003'
     where id = 'bbbbbbbb-0000-0000-0000-000000001201' $$,
  '23514', null, 'a wheat harvest cannot be put on his tractor'
);
select lives_ok(
  $$ update public.jobs set machine_id = 'cccccccc-0000-0000-0000-000000000002'
     where id = 'bbbbbbbb-0000-0000-0000-000000001201' $$,
  'but he can move it to his other combine'
);
select throws_ok(
  $$ select public.pick_machine('22222222-2222-2222-2222-222222222222',
       (select id from public.services where code = 'wheat_harvest')) $$,
  '42501', null, 'the machine picker is the server''s, not callable from a phone'
);

select is(
  (select machine_id from public.jobs where id = 'bbbbbbbb-0000-0000-0000-000000001203'),
  null::uuid,
  'a job nobody has taken is on no machine'
);

-- He sells a combine: its jobs stay his, on no machine, and nothing breaks.
select tests.act_as_admin();
delete from public.captain_machines where id = 'cccccccc-0000-0000-0000-000000000002';
select is(
  (select count(*)::int from public.jobs
   where captain_id = '22222222-2222-2222-2222-222222222222' and machine_id is null),
  2,
  'removing a machine leaves its jobs with the captain'
);

select * from finish();
rollback;
