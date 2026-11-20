-- Stage 4.3: a captain logs a job booked by phone, and measures the field on arrival.

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
select tests.make_user('22222222-2222-2222-2222-222222222222', '919876501302', 'Jaspal');
select tests.make_user('33333333-3333-3333-3333-333333333333', '919876501303', 'Harjit');
select tests.make_user('44444444-4444-4444-4444-444444444444', '919876501304', 'Nobody');
insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at)
values ('22222222-2222-2222-2222-222222222222',
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        true, 'verified', '22222222-2222-2222-2222-222222222222', now());
-- Harjit has signed up as a captain but is not verified yet.
insert into public.captains (profile_id, base_location, current_location, is_online)
values ('33333333-3333-3333-3333-333333333333',
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        extensions.st_geographyfromtext('POINT(74.03 30.404)'), true);
insert into public.captain_machines (captain_id, machine_type_id, ownership)
values ('22222222-2222-2222-2222-222222222222', (select id from public.machine_types where code = 'combine'), 'owned');
insert into public.captain_services (captain_id, service_id, rate, rate_unit)
select p, (select id from public.services where code = 'wheat_harvest'), 3500, 'per_killa'
from unnest(array['22222222-2222-2222-2222-222222222222',
                  '33333333-3333-3333-3333-333333333333']::uuid[]) p;

select tests.act_as('22222222-2222-2222-2222-222222222222');
create temp table booked as
  select public.captain_create_job('98765 01399', 'Mohinder Singh', 'Ladhuka', 'wheat_harvest',
                                   3 * 4046.8564224, 30.41, 74.02) as id;

select tests.act_as_admin();
select results_eq(
  $$ select j.status::text, j.captain_id, p.full_name, p.placeholder
     from public.jobs j join public.profiles p on p.id = j.farmer_id
     where j.id = (select id from booked) $$,
  $$ values ('accepted', '22222222-2222-2222-2222-222222222222'::uuid, 'Mohinder Singh', true) $$,
  'his phone booking is in his queue, for a farmer who has no account yet'
);
select ok(
  (select quoted_total is not null and machine_id is not null from public.jobs where id = (select id from booked)),
  'priced at his own rate, and on his combine'
);
select is(
  (select f.capture_method::text from public.jobs j join public.fields f on f.id = j.field_id
   where j.id = (select id from booked)),
  'declared',
  'the field is the farmer''s word until someone measures it'
);

select tests.act_as('22222222-2222-2222-2222-222222222222');
create temp table booked2 as
  select public.captain_create_job('9876501399', 'Mohinder', null, 'wheat_harvest',
                                   4046.8564224, 30.41, 74.02) as id;
select is(
  (select farmer_id from public.jobs where id = (select id from booked2)),
  (select farmer_id from public.jobs where id = (select id from booked)),
  'the same number twice is the same farmer'
);
select throws_ok(
  $$ select public.captain_create_job('9876501398', 'X', null, 'paddy_harvest', 4046.86, 30.41, 74.02) $$,
  '42501', null, 'not for work he does not offer'
);
select throws_ok(
  $$ select public.captain_create_job('9876501302', 'Me', null, 'wheat_harvest', 4046.86, 30.41, 74.02) $$,
  '22023', null, 'not for his own number'
);

select tests.act_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  $$ select public.captain_create_job('9876501397', 'X', null, 'wheat_harvest', 4046.86, 30.41, 74.02) $$,
  '42501', null, 'an unverified captain cannot log jobs'
);
select throws_ok(
  $$ select public.founder_create_farmer('9876501396', 'X') $$,
  '42501', null, 'the founder functions still refuse everyone else'
);
select throws_ok(
  $$ select public.assign_job((select id from booked), '33333333-3333-3333-3333-333333333333') $$,
  '42501', null, 'the shared internals are not callable from a phone'
);

-- On arrival: he traces one killa where three were declared.
select tests.act_as('44444444-4444-4444-4444-444444444444');
select throws_ok(
  $$ select public.captain_retrace_field((select id from booked),
       extensions.st_asewkt(tests.killa_polygon(30.41, 74.02))) $$,
  '42501', null, 'only the captain working the job can re-measure it'
);

select tests.act_as('22222222-2222-2222-2222-222222222222');
create temp table before_trace as select quoted_total from public.jobs where id = (select id from booked);
select public.captain_retrace_field((select id from booked),
         extensions.st_asewkt(tests.killa_polygon(30.41, 74.02)), 'walked');

select tests.act_as_admin();
select ok(
  (select abs(j.area_sqm - 4046.86) < 60 and f.capture_method = 'walked'
          and j.quoted_total < (select quoted_total from before_trace)
   from public.jobs j join public.fields f on f.id = j.field_id where j.id = (select id from booked)),
  'the server measured it: one killa, walked, and the quote came down with it'
);

select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.captain_retrace_field((select id from booked),
       extensions.st_asewkt(tests.killa_polygon(30.41, 74.02))) $$,
  '22023', null, 'a measured field is not overwritten'
);
select throws_ok(
  $$ select public.captain_retrace_field((select id from booked),
       extensions.st_asewkt(tests.killa_polygon(30.41, 74.02)), 'declared') $$,
  '22023', null, 'and a re-trace cannot call itself declared'
);

select * from finish();
rollback;
