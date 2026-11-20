-- Stage 4.5: a captain's smallest job, per service.

begin;
select plan(7);

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
select tests.make_user('11111111-1111-1111-1111-111111111111', '919876501101', 'Gurmeet');
select tests.make_user('22222222-2222-2222-2222-222222222222', '919876501102', 'Jaspal');
insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at)
values ('22222222-2222-2222-2222-222222222222',
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        true, 'verified', '11111111-1111-1111-1111-111111111111', now());
insert into public.captain_machines (captain_id, machine_type_id, ownership)
values ('22222222-2222-2222-2222-222222222222', (select id from public.machine_types where code = 'combine'), 'owned');
-- Two killa and up.
insert into public.captain_services (captain_id, service_id, rate, rate_unit, min_area_sqm)
values ('22222222-2222-2222-2222-222222222222', (select id from public.services where code = 'wheat_harvest'),
        3500, 'per_killa', 2 * 4046.8564224);

-- A one-killa field and a job on it.
insert into public.fields (id, owner_id, name, boundary, capture_method, confirmed_by_owner)
values ('aaaaaaaa-0000-0000-0000-000000001101', '11111111-1111-1111-1111-111111111111', 'Small',
        tests.killa_polygon(30.4028, 74.0286), 'drawn', true);
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate)
select 'bbbbbbbb-0000-0000-0000-000000001101', '11111111-1111-1111-1111-111111111111',
       'aaaaaaaa-0000-0000-0000-000000001101', (select id from public.services where code = 'wheat_harvest'),
       4046.86, 'searching', true;

select is_empty(
  $$ select 1 from public.eligible_captains('aaaaaaaa-0000-0000-0000-000000001101',
       (select id from public.services where code = 'wheat_harvest')) $$,
  'a one-killa field is not offered to a captain who takes two killa and up'
);

select tests.act_as('11111111-1111-1111-1111-111111111111');
select ok(
  abs(public.job_size_floor('bbbbbbbb-0000-0000-0000-000000001101') - 2 * 4046.8564224) < 1,
  'and the farmer is told the smallest size the captains nearby take'
);

select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.job_size_floor('bbbbbbbb-0000-0000-0000-000000001101') $$,
  '42501', null, 'only the farmer who posted it can ask'
);

-- He lowers his minimum: now he is eligible, and size is no longer the reason.
select tests.act_as_admin();
update public.captain_services set min_area_sqm = 4000 where captain_id = '22222222-2222-2222-2222-222222222222';
select isnt_empty(
  $$ select 1 from public.eligible_captains('aaaaaaaa-0000-0000-0000-000000001101',
       (select id from public.services where code = 'wheat_harvest')) $$,
  'at or below his minimum, he is offered it'
);
select tests.act_as('11111111-1111-1111-1111-111111111111');
select is(public.job_size_floor('bbbbbbbb-0000-0000-0000-000000001101'), null::double precision,
  'and the farmer is told nothing about size');

-- No minimum at all behaves as before 4.5.
select tests.act_as_admin();
update public.captain_services set min_area_sqm = null where captain_id = '22222222-2222-2222-2222-222222222222';
select isnt_empty(
  $$ select 1 from public.eligible_captains('aaaaaaaa-0000-0000-0000-000000001101',
       (select id from public.services where code = 'wheat_harvest')) $$,
  'no minimum means any size, as before'
);

select throws_ok(
  $$ update public.captain_services set min_area_sqm = -5 $$,
  '23514', null, 'a nonsense minimum is refused'
);

select * from finish();
rollback;
