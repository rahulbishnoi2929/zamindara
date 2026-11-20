-- Brief 3.3: the metrics views. Correct numbers on a known fixture, and no
-- phone can read them — they see past RLS by design.

begin;
select plan(6);

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
-- Its own region, so nothing else in the database — the CI restore fixture,
-- one day real data — can move these numbers.
insert into public.regions (slug, name, state, unit_set, default_chain, languages, is_live)
values ('metrics-test', 'Metrics test', 'Punjab', '{marla,kanal,bigha,killa}', 'killa', '{pa,hi,en}', false);
select tests.make_user('11111111-1111-1111-1111-111111111111', '9876500501', 'Comes back');
select tests.make_user('22222222-2222-2222-2222-222222222222', '9876500502', 'Never returns');
select tests.make_user('33333333-3333-3333-3333-333333333333', '9876500503', 'Busy captain');
select tests.make_user('44444444-4444-4444-4444-444444444444', '9876500504', 'Idle captain');
update public.profiles set region_id = (select id from public.regions where slug = 'metrics-test')
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
             '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444');

insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at, location_updated_at)
values
  ('33333333-3333-3333-3333-333333333333',
   extensions.st_geographyfromtext('POINT(74.03 30.404)'),
   extensions.st_geographyfromtext('POINT(74.03 30.404)'),
   true, 'verified', '11111111-1111-1111-1111-111111111111', now(), now() - interval '1 day'),
  ('44444444-4444-4444-4444-444444444444',
   extensions.st_geographyfromtext('POINT(74.03 30.404)'),
   extensions.st_geographyfromtext('POINT(74.03 30.404)'),
   false, 'verified', '11111111-1111-1111-1111-111111111111', now(), now() - interval '30 days');

insert into public.fields (id, owner_id, name, boundary, centroid, area_sqm,
                           capture_method, region_id, confirmed_by_owner)
select ('aaaaaaaa-0000-0000-0000-00000000000' || n)::uuid, o, 'Khet ' || n,
       tests.killa_polygon(30.4028 + n * 0.001, 74.0286),
       extensions.st_geographyfromtext('POINT(74.0286 30.4028)'),
       1, m::public.capture_method, (select id from public.regions where slug = 'metrics-test'), true
from (values (1, '11111111-1111-1111-1111-111111111111'::uuid, 'drawn'),
             (2, '22222222-2222-2222-2222-222222222222'::uuid, 'drawn'),
             (3, '22222222-2222-2222-2222-222222222222'::uuid, 'walked')) v(n, o, m);

-- Farmer 1: first job 70 days ago, second 65 days ago — came back.
-- Farmer 2: one job 70 days ago and nothing since.
insert into public.jobs (farmer_id, field_id, service_id, area_sqm, status, is_immediate, created_at)
select o, f, (select id from public.services where code = 'wheat_harvest'), 4046.86, 'searching', true,
       now() - d * interval '1 day'
from (values ('11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 70),
             ('11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 65),
             ('22222222-2222-2222-2222-222222222222'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid, 70)) v(o, f, d);

select is(
  (select sum(jobs_posted)::int from metrics.jobs_per_week where region = 'metrics-test'),
  3, 'jobs per week adds up to every job posted'
);

select results_eq(
  $$ select method, fields::int from metrics.fields_by_method where region = 'metrics-test' order by method $$,
  $$ values ('drawn', 2), ('walked', 1) $$,
  'fields counted by how they were mapped'
);

select results_eq(
  $$ select farmers_with_60_days_history::int, came_back_within_60_days::int
     from metrics.farmer_return_60d where region = 'metrics-test' $$,
  $$ values (2, 1) $$,
  'of two farmers with 60 days of history, one came back'
);

select results_eq(
  $$ select verified_captains::int, active_last_7_days::int
     from metrics.captains_active_7d where region = 'metrics-test' $$,
  $$ values (2, 1) $$,
  'a captain seen yesterday is active; one last seen a month ago is not'
);

select tests.act_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ select * from metrics.jobs_per_week $$,
  '42501', null,
  'a signed-in phone cannot read the metrics — they see past RLS'
);

select tests.act_as_admin();
select set_config('role', 'anon', true);
select throws_ok(
  $$ select * from metrics.captains_active_7d $$,
  '42501', null,
  'nor can one that is signed out'
);

select * from finish();
rollback;
