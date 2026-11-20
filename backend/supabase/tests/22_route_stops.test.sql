-- Stage 4.7: a migrant combine's route, as dated stops.

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
select tests.make_user('11111111-1111-1111-1111-111111111111', '919876501401', 'Gurmeet');
select tests.make_user('22222222-2222-2222-2222-222222222222', '919876501402', 'Balkar');
-- Balkar is in Ganganagar now (about 60 km from Fazilka), online.
insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at, service_radius_km)
values ('22222222-2222-2222-2222-222222222222',
        extensions.st_geographyfromtext('POINT(73.877 29.904)'),
        extensions.st_geographyfromtext('POINT(73.877 29.904)'),
        true, 'verified', '11111111-1111-1111-1111-111111111111', now(), 20);
insert into public.captain_machines (captain_id, machine_type_id, ownership)
values ('22222222-2222-2222-2222-222222222222', (select id from public.machine_types where code = 'combine'), 'owned');
insert into public.captain_services (captain_id, service_id, rate, rate_unit)
values ('22222222-2222-2222-2222-222222222222', (select id from public.services where code = 'wheat_harvest'), 3500, 'per_killa');

-- A field in Fazilka, and one in Ganganagar.
insert into public.fields (id, owner_id, name, boundary, capture_method, confirmed_by_owner)
values ('aaaaaaaa-0000-0000-0000-000000001401', '11111111-1111-1111-1111-111111111111', 'Fazilka khet',
        tests.killa_polygon(30.4028, 74.0286), 'drawn', true),
       ('aaaaaaaa-0000-0000-0000-000000001402', '11111111-1111-1111-1111-111111111111', 'Ganganagar khet',
        tests.killa_polygon(29.905, 73.878), 'drawn', true);

-- He will be in Fazilka from day 5 to day 12.
select tests.act_as('22222222-2222-2222-2222-222222222222');
insert into public.captain_route_stops (place, location, from_date, to_date)
values ('Fazilka', extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        (now() at time zone 'Asia/Kolkata')::date + 5, (now() at time zone 'Asia/Kolkata')::date + 12);

select tests.act_as_admin();
select is_empty(
  $$ select 1 from public.eligible_captains('aaaaaaaa-0000-0000-0000-000000001401',
       (select id from public.services where code = 'wheat_harvest')) $$,
  'today he is in Ganganagar: not offered Fazilka work'
);
select ok(
  (select distance_km < 5 from public.eligible_captains('aaaaaaaa-0000-0000-0000-000000001401',
     (select id from public.services where code = 'wheat_harvest'), now() + interval '7 days')),
  'for a day his route puts him in Fazilka, he is matched, from there'
);
select is_empty(
  $$ select 1 from public.eligible_captains('aaaaaaaa-0000-0000-0000-000000001402',
       (select id from public.services where code = 'wheat_harvest'), now() + interval '7 days') $$,
  'and not for Ganganagar work that day: he will be away'
);
select isnt_empty(
  $$ select 1 from public.eligible_captains('aaaaaaaa-0000-0000-0000-000000001402',
       (select id from public.services where code = 'wheat_harvest'), now() + interval '20 days') $$,
  'a day no stop covers: where he is now, as before'
);

update public.captains set is_online = false where profile_id = '22222222-2222-2222-2222-222222222222';
select isnt_empty(
  $$ select 1 from public.eligible_captains('aaaaaaaa-0000-0000-0000-000000001401',
       (select id from public.services where code = 'wheat_harvest'), now() + interval '7 days') $$,
  'his route counts even while he is offline today'
);

select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ insert into public.captain_route_stops (place, location, from_date, to_date)
     values ('Sirsa', extensions.st_geographyfromtext('POINT(75.03 29.53)'),
             current_date + 10, current_date + 14) $$,
  '23P01', null, 'two places on one day is refused'
);
select throws_ok(
  $$ insert into public.captain_route_stops (place, location, from_date, to_date)
     values ('Sirsa', extensions.st_geographyfromtext('POINT(75.03 29.53)'),
             current_date + 30, current_date + 25) $$,
  '23514', null, 'a stop that ends before it starts is refused'
);
select lives_ok(
  $$ insert into public.captain_route_stops (place, location, from_date, to_date)
     values ('Sirsa', extensions.st_geographyfromtext('POINT(75.03 29.53)'),
             current_date + 30, current_date + 35) $$,
  'the next stop on his way is fine'
);

select tests.act_as('11111111-1111-1111-1111-111111111111');
select is_empty(
  $$ select 1 from public.captain_route_stops $$,
  'a farmer cannot see where a captain will be'
);
select throws_ok(
  $$ insert into public.captain_route_stops (captain_id, place, location, from_date, to_date)
     values ('22222222-2222-2222-2222-222222222222', 'X',
             extensions.st_geographyfromtext('POINT(75 29)'), current_date + 50, current_date + 51) $$,
  '42501', null, 'nor write one for him'
);

select * from finish();
rollback;
