-- Incremental sync: the indexes behind "changed since", and a job's
-- updated_at moving when its offers change.

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

select has_index('public', 'jobs', 'jobs_farmer_updated_idx', 'a farmer''s changed jobs are an index seek');
select has_index('public', 'jobs', 'jobs_captain_updated_idx', 'so are a captain''s');
select has_index('public', 'fields', 'fields_owner_updated_idx', 'and a farmer''s changed fields');

select tests.act_as_admin();
select tests.make_user('11111111-1111-1111-1111-111111111111', '9876500601', 'Gurmeet');
select tests.make_user('22222222-2222-2222-2222-222222222222', '9876500602', 'Jaspal');
insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at)
values ('22222222-2222-2222-2222-222222222222',
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        true, 'verified', '11111111-1111-1111-1111-111111111111', now());

insert into public.fields (owner_id, name, boundary, centroid, area_sqm,
                           capture_method, region_id, confirmed_by_owner)
values ('11111111-1111-1111-1111-111111111111', 'Nehar wala khet',
        tests.killa_polygon(30.4028, 74.0286),
        extensions.st_geographyfromtext('POINT(74.0286 30.4028)'),
        1, 'drawn', (select id from public.regions where slug = 'fazilka'), true);
-- Posted an hour ago, untouched since.
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate,
                         created_at, updated_at)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       f.area_sqm, 'searching', true, now() - interval '1 hour', now() - interval '1 hour'
from public.fields f where f.name = 'Nehar wala khet';

-- The founder offers it by hand, as with automatic dispatch off.
insert into public.job_dispatch (job_id, captain_id, rank)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 1);

select ok(
  (select updated_at > now() - interval '1 minute' from public.jobs
   where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'an offer moves the job''s updated_at, so the farmer''s phone hears about it'
);

select is(
  (select count(*)::int from public.job_events
   where job_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'and writes no audit row: only the insert is in the history'
);

-- A captain declining is a change the farmer sees too.
update public.jobs set updated_at = now() - interval '1 hour'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select tests.act_as('22222222-2222-2222-2222-222222222222');
update public.job_dispatch set response = 'declined', responded_at = now()
where job_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select tests.act_as_admin();
select ok(
  (select updated_at > now() - interval '1 minute' from public.jobs
   where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'a captain answering an offer, through his own RLS, also moves it'
);

select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.touch_job_on_dispatch() $$,
  '42501', null,
  'the trigger function cannot be called directly'
);

select * from finish();
rollback;
