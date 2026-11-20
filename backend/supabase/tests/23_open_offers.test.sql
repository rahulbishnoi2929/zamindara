-- Stage 4.8: a job for a later day is an open offer, listed quietly.

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
select tests.make_user('11111111-1111-1111-1111-111111111111', '919876501501', 'Gurmeet');
select tests.make_user('22222222-2222-2222-2222-222222222222', '919876501502', 'Balkar');
select tests.make_user('33333333-3333-3333-3333-333333333333', '919876501503', 'Kuldeep');
-- Balkar in Fazilka; Kuldeep in Ganganagar, 60 km out with a 20 km radius.
insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at, service_radius_km)
values ('22222222-2222-2222-2222-222222222222',
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        true, 'verified', '11111111-1111-1111-1111-111111111111', now(), 20),
       ('33333333-3333-3333-3333-333333333333',
        extensions.st_geographyfromtext('POINT(73.877 29.904)'),
        extensions.st_geographyfromtext('POINT(73.877 29.904)'),
        true, 'verified', '11111111-1111-1111-1111-111111111111', now(), 20);
insert into public.captain_machines (captain_id, machine_type_id, ownership)
select c, (select id from public.machine_types where code = 'combine'), 'owned'
from unnest(array['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']::uuid[]) c;
insert into public.captain_services (captain_id, service_id, rate, rate_unit)
select c, (select id from public.services where code = 'wheat_harvest'), 3500, 'per_killa'
from unnest(array['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']::uuid[]) c;

-- Three Fazilka fields; the third not yet confirmed by its owner.
insert into public.fields (id, owner_id, name, boundary, capture_method, confirmed_by_owner)
select ('aaaaaaaa-0000-0000-0000-00000000150' || n)::uuid, '11111111-1111-1111-1111-111111111111',
       'Khet ' || n, tests.killa_polygon(30.4028 + n * 0.001, 74.0286), 'drawn', n < 3
from generate_series(1, 3) n;
-- 1: Thursday's harvest. 2: right now. 3: later, on the unconfirmed field.
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate, scheduled_date)
values ('bbbbbbbb-0000-0000-0000-000000001501', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000001501', (select id from public.services where code = 'wheat_harvest'),
        4046.86, 'searching', false, (now() at time zone 'Asia/Kolkata')::date + 3),
       ('bbbbbbbb-0000-0000-0000-000000001502', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000001502', (select id from public.services where code = 'wheat_harvest'),
        4046.86, 'searching', true, null),
       ('bbbbbbbb-0000-0000-0000-000000001503', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000001503', (select id from public.services where code = 'wheat_harvest'),
        4046.86, 'searching', false, (now() at time zone 'Asia/Kolkata')::date + 3);

select is(
  (select array_agg(dispatch_mode order by id) from public.jobs where farmer_id = '11111111-1111-1111-1111-111111111111'),
  array['open', 'instant', 'open'],
  'a job for later is an open offer; a job for now is instant'
);

select tests.act_as('22222222-2222-2222-2222-222222222222');
select is(public.claim_open_offers(), 0, 'while the founder matches by hand, nothing is listed');

select tests.act_as_admin();
update public.app_config set auto_dispatch = true;

select tests.act_as('22222222-2222-2222-2222-222222222222');
select is(public.claim_open_offers(), 1,
  'with dispatch on, he is listed the later job: not the instant one, not the unconfirmed field');
select is(
  (select response::text from public.job_dispatch
   where job_id = 'bbbbbbbb-0000-0000-0000-000000001501' and captain_id = '22222222-2222-2222-2222-222222222222'),
  'pending',
  'as an ordinary pending offer in his feed'
);
select is(public.claim_open_offers(), 0, 'listing again adds nothing');

select tests.act_as('33333333-3333-3333-3333-333333333333');
select is(public.claim_open_offers(), 0, 'a captain out of reach is listed nothing');

select tests.act_as('22222222-2222-2222-2222-222222222222');
select is(
  (select status::text from public.accept_job('bbbbbbbb-0000-0000-0000-000000001501')),
  'accepted',
  'the first to accept gets it, as now'
);

-- A runaway loop: six more requests open at once.
select tests.act_as_admin();
insert into public.fields (id, owner_id, name, boundary, capture_method, confirmed_by_owner)
select ('aaaaaaaa-0000-0000-0000-00000000151' || n)::uuid, '11111111-1111-1111-1111-111111111111',
       'Khet 1' || n, tests.killa_polygon(30.41 + n * 0.001, 74.0286), 'drawn', true
from generate_series(1, 6) n;
insert into public.jobs (farmer_id, field_id, service_id, area_sqm, status, is_immediate, scheduled_date)
select '11111111-1111-1111-1111-111111111111', ('aaaaaaaa-0000-0000-0000-00000000151' || n)::uuid,
       (select id from public.services where code = 'wheat_harvest'), 4046.86, 'searching', false,
       (now() at time zone 'Asia/Kolkata')::date + 3
from generate_series(1, 6) n;

select tests.act_as('22222222-2222-2222-2222-222222222222');
select is(public.claim_open_offers(), 0, 'a farmer with more than five requests open is listed to nobody');

select tests.act_as_admin();
select ok(
  (select public.job_starts_at(j) = ((now() at time zone 'Asia/Kolkata')::date + 3 + time '07:00') at time zone 'Asia/Kolkata'
   from public.jobs j where id = 'bbbbbbbb-0000-0000-0000-000000001501'),
  'a later job starts at seven in the morning, India time, on its day'
);

select * from finish();
rollback;
