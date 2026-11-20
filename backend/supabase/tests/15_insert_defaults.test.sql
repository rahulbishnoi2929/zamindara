-- Inserts as a phone actually sends them: no owner, no farmer, no region.

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
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
        'authenticated', 'authenticated', 'x@test.local', '', now(), now(), now());

select tests.act_as('11111111-1111-1111-1111-111111111111');
-- A real session's token carries the number Auth verified (0040 takes it from there).
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated',
                    'phone', '919876500701')::text, true);
-- What syncProfile sends: no region.
insert into public.profiles (id, phone, full_name) values
  ('11111111-1111-1111-1111-111111111111', '919876500701', 'Gurmeet');

select is(
  (select r.slug from public.profiles p join public.regions r on r.id = p.region_id
   where p.id = '11111111-1111-1111-1111-111111111111'),
  'fazilka',
  'a new profile with no region takes the one live region'
);

-- What fieldToWire sends: no owner, no region.
select lives_ok(
  $$ insert into public.fields (id, name, boundary, capture_method, confirmed_by_owner)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Khet',
             'SRID=4326;POLYGON((74.0286 30.4028,74.0293012 30.4028,74.0293012 30.4033442,74.0286 30.4033442,74.0286 30.4028))',
             'drawn', true) $$,
  'a field sent with no owner is accepted, as the phone sends it'
);

select is(
  (select owner_id from public.fields where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'and belongs to whoever is signed in'
);

select is(
  (select r.slug from public.fields f join public.regions r on r.id = f.region_id
   where f.id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'fazilka',
  'and is in its owner''s region'
);

-- What jobToWire sends: no farmer.
select lives_ok(
  $$ insert into public.jobs (id, field_id, service_id, area_sqm, status, is_immediate)
     select 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
            (select id from public.services where code = 'wheat_harvest'), 4046.86, 'searching', true $$,
  'a job sent with no farmer is accepted, and is his'
);

-- The default is the signed-in user; naming someone else is still refused.
select throws_ok(
  $$ insert into public.fields (name, owner_id, boundary, capture_method, confirmed_by_owner)
     values ('Not mine', '22222222-2222-2222-2222-222222222222',
             'SRID=4326;POLYGON((74.0286 30.4028,74.0293012 30.4028,74.0293012 30.4033442,74.0286 30.4033442,74.0286 30.4028))',
             'drawn', true) $$,
  '42501', null,
  'a phone still cannot create a field in someone else''s name'
);

-- The statement the app actually sends: an upsert, with a read of the
-- result. Refused by RLS until 0028.
select tests.act_as('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ insert into public.fields (id, name, boundary, capture_method, confirmed_by_owner)
     values ('aaaaaaaa-0000-0000-0000-000000000002', 'Upserted',
             'SRID=4326;POLYGON((74.0286 30.4028,74.0293012 30.4028,74.0293012 30.4033442,74.0286 30.4033442,74.0286 30.4028))',
             'drawn', true)
     on conflict (id) do update set name = excluded.name
     returning id $$,
  'the app''s upsert of a new field is accepted'
);

select lives_ok(
  $$ insert into public.fields (id, name, boundary, capture_method, confirmed_by_owner)
     values ('aaaaaaaa-0000-0000-0000-000000000002', 'Renamed on replay',
             'SRID=4326;POLYGON((74.0286 30.4028,74.0293012 30.4028,74.0293012 30.4033442,74.0286 30.4033442,74.0286 30.4028))',
             'drawn', true)
     on conflict (id) do update set name = excluded.name
     returning id $$,
  'and replaying it, as after an interrupted push, updates rather than fails'
);

-- What the app reads back: GeoJSON, not hex EWKB (0029).
select is(
  (select (f.boundary_geojson ->> 'type') from public.fields f
   where f.id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'Polygon',
  'a field reads back as a GeoJSON polygon the phone can parse'
);

select * from finish();
rollback;
