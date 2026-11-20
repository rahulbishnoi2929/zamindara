-- Brief 2.5: an accept must be safe to send twice.
--
-- The phone retries an accept on a bad signal. If the first one landed and
-- only the reply was lost, the retry must hear "yours", not "taken".

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
select tests.make_user('11111111-1111-1111-1111-111111111111', '9876500301', 'Gurmeet');
select tests.make_user('22222222-2222-2222-2222-222222222222', '9876500302', 'Jaspal');
select tests.make_user('33333333-3333-3333-3333-333333333333', '9876500303', 'Harjit');

insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at)
select p, extensions.st_geographyfromtext('POINT(74.0300 30.4040)'),
       extensions.st_geographyfromtext('POINT(74.0300 30.4040)'),
       true, 'verified', '11111111-1111-1111-1111-111111111111', now()
from unnest(array['22222222-2222-2222-2222-222222222222',
                  '33333333-3333-3333-3333-333333333333']::uuid[]) p;

select tests.act_as('11111111-1111-1111-1111-111111111111');
insert into public.fields (owner_id, name, boundary, centroid, area_sqm,
                           capture_method, region_id, confirmed_by_owner)
values (
  '11111111-1111-1111-1111-111111111111', 'Nehar wala khet',
  tests.killa_polygon(30.4028, 74.0286),
  extensions.st_geographyfromtext('POINT(74.0286 30.4028)'),
  1, 'drawn', (select id from public.regions where slug = 'fazilka'), true
);
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       f.area_sqm, 'searching', true
from public.fields f where f.name = 'Nehar wala khet';

select tests.act_as_admin();
insert into public.job_dispatch (job_id, captain_id, rank)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 1),
       ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 2);

select tests.act_as('22222222-2222-2222-2222-222222222222');

select is(
  (select captain_id from public.accept_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'the first accept takes the job'
);

create temp table first_accept as
  select accepted_at, quoted_total from public.jobs
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  $$ select public.accept_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'the same captain sending it again (reply lost on 2G) is not told the job was taken'
);

select results_eq(
  $$ select accepted_at, quoted_total from public.jobs
     where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  $$ select accepted_at, quoted_total from first_accept $$,
  'and the retry writes nothing: same accepted time, same price'
);

select tests.act_as_admin();
select is(
  (select count(*)::int from public.job_events
   where job_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and to_status = 'accepted'),
  1,
  'one accept in the history, however many times it was sent'
);

-- The idempotence is only for the holder. Anyone else still loses the race.
select tests.act_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  $$ select public.accept_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '55006', null,
  'a different captain still hears that it was taken'
);

select throws_ok(
  $$ select public.accept_job_claim('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501', null,
  'the inner function cannot be called around the wrapper'
);

select * from finish();
rollback;
