-- The field area is the price.
--
-- area_sqm multiplies the rate, feeds rate guidance and decides the travel
-- charge. It is derived from the boundary server-side for exactly that
-- reason — and until migration 17 a farmer could write it directly, because
-- the trigger was `update OF boundary` and his RLS policy lets him write any
-- column on his own field.
--
-- The first assertion here is that bug. The rest are the guards around it
-- that had never been exercised by anything.

begin;
select plan(8);

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

-- One killa.
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
select tests.make_user('11111111-1111-1111-1111-111111111111', '9876500301', 'Gurmeet');

select tests.act_as('11111111-1111-1111-1111-111111111111');
insert into public.fields (id, owner_id, name, boundary, centroid, area_sqm,
                           capture_method, region_id, confirmed_by_owner)
values (
  'ffffffff-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'Nehar wala khet',
  tests.killa_polygon(30.4028, 74.0286),
  extensions.st_geographyfromtext('POINT(74.0286 30.4028)'),
  -- A deliberate lie on the way in. The trigger must discard it.
  999999,
  'drawn',
  (select id from public.regions where slug = 'fazilka'),
  true
);

select ok(
  (select area_sqm from public.fields where id = 'ffffffff-1111-1111-1111-111111111111')
    between 4000 and 4100,
  'an area sent on insert is discarded and recomputed from the boundary'
);

-- ===========================================================================
-- The bug: writing the column directly
--
-- fields_update_own lets an owner write any column on his own field, and the
-- trigger used to fire only when `boundary` was in the UPDATE. So this
-- succeeded, and his one-killa field became four hundred acres — priced,
-- quoted and fed into rate guidance at that size.
-- ===========================================================================
select lives_ok(
  $$ update public.fields set area_sqm = 1000000
     where id = 'ffffffff-1111-1111-1111-111111111111' $$,
  'the update itself is allowed — his own field, his own row'
);

select ok(
  (select area_sqm from public.fields where id = 'ffffffff-1111-1111-1111-111111111111')
    between 4000 and 4100,
  'but the area stays what the boundary says, so he cannot set his own price'
);

select ok(
  (select extensions.st_x(centroid::extensions.geometry)
   from public.fields where id = 'ffffffff-1111-1111-1111-111111111111') between 74.02 and 74.03,
  'and the centroid is still the boundary''s, so he cannot move his field nearer a captain'
);

-- Renaming must not quietly un-confirm the field: that is a different rule
-- and the trigger now runs on every update, so it is worth pinning.
select lives_ok(
  $$ update public.fields set name = 'Nehar wala khet (upper)'
     where id = 'ffffffff-1111-1111-1111-111111111111' $$,
  'renaming a field is still allowed'
);

select ok(
  (select confirmed_by_owner from public.fields
   where id = 'ffffffff-1111-1111-1111-111111111111'),
  'and does not un-confirm it — only a changed boundary does that'
);

-- ===========================================================================
-- Polygons that are not fields
-- ===========================================================================

-- A bow tie. st_isvalid catches it; nothing had ever asserted so.
select throws_ok(
  $$ insert into public.fields (owner_id, name, boundary, centroid, area_sqm,
                                capture_method, region_id)
     values ('11111111-1111-1111-1111-111111111111', 'Bow tie',
             extensions.st_geographyfromtext(
               'POLYGON((74.0286 30.4028, 74.0296 30.4038, 74.0296 30.4028, 74.0286 30.4038, 74.0286 30.4028))'
             ),
             extensions.st_geographyfromtext('POINT(74.0290 30.4033)'),
             1, 'drawn',
             (select id from public.regions where slug = 'fazilka')) $$,
  '23514',
  null,
  'a self-intersecting polygon is refused rather than priced'
);

-- Two corners a metre apart, placed while the map was zoomed out.
select throws_ok(
  $$ insert into public.fields (owner_id, name, boundary, centroid, area_sqm,
                                capture_method, region_id)
     values ('11111111-1111-1111-1111-111111111111', 'Speck',
             extensions.st_geographyfromtext(
               'POLYGON((74.0286 30.4028, 74.02861 30.4028, 74.02861 30.40281, 74.0286 30.40281, 74.0286 30.4028))'
             ),
             extensions.st_geographyfromtext('POINT(74.0286 30.4028)'),
             1, 'drawn',
             (select id from public.regions where slug = 'fazilka')) $$,
  '23514',
  null,
  'and a field smaller than one marla is refused — the app could not name it'
);

select * from finish();
rollback;
