-- The security pass: invariants over every endpoint, then each hole it
-- closed, attempted and refused. A future migration that re-opens one of
-- these fails here.

begin;
select plan(23);

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

-- ===========================================================================
-- Invariants
-- ===========================================================================
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every table in public has row level security'
);
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') $$,
  'signed out, no function in public can be called'
);
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') $$,
  'every SECURITY DEFINER function pins its search_path'
);
select is_empty(
  $$ select f from unnest(array[
       'public.eligible_captains(uuid,uuid,timestamp with time zone,integer,integer)',
       'public.quote_job(uuid,uuid,uuid)',
       'public.road_km(extensions.geography,extensions.geography)',
       'public.accept_job_claim(uuid)',
       'public.dispatch_job_offer(uuid,integer)',
       'public.pick_machine(uuid,uuid)',
       'public.assign_job(uuid,uuid)',
       'public.farmer_by_phone(text,text,text)']) f
     where to_regprocedure(f) is not null
       and has_function_privilege('authenticated', to_regprocedure(f), 'execute') $$,
  'the internal dispatch functions are not callable from a phone'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'phone', 'select'),
  'phone numbers are not readable directly'
);
select ok(
  not has_column_privilege('authenticated', 'public.captains', 'current_location', 'select')
  and not has_column_privilege('authenticated', 'public.captains', 'base_location', 'select'),
  'nor are captains'' live or home locations'
);
-- Supabase grants anon table rights by design; the policies are the gate.
select is_empty(
  $$ select tablename || '.' || policyname from pg_policies
     where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
       and (roles @> '{anon}' or roles @> '{public}') $$,
  'signed out, no policy lets anyone write'
);

-- ===========================================================================
-- People
-- ===========================================================================
select tests.act_as_admin();
select tests.make_user('11111111-1111-1111-1111-111111111111', '919876501801', 'Gurmeet');
select tests.make_user('22222222-2222-2222-2222-222222222222', '919876501802', 'Jaspal');
select tests.make_user('33333333-3333-3333-3333-333333333333', '919876501803', 'Balkar');
insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at)
select c, extensions.st_geographyfromtext('POINT(74.03 30.404)'), extensions.st_geographyfromtext('POINT(74.03 30.404)'),
       true, 'verified', '11111111-1111-1111-1111-111111111111', now()
from unnest(array['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']::uuid[]) c;
insert into public.captain_machines (captain_id, machine_type_id, ownership)
select c, (select id from public.machine_types where code = 'combine'), 'owned'
from unnest(array['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']::uuid[]) c;
insert into public.fields (id, owner_id, name, boundary, capture_method, confirmed_by_owner)
values ('aaaaaaaa-0000-0000-0000-000000001801', '11111111-1111-1111-1111-111111111111', 'Khet',
        tests.killa_polygon(30.4028, 74.0286), 'drawn', true);
-- One accepted job of Gurmeet's with Jaspal; one searching, offered to Balkar.
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate, captain_id, accepted_at, quoted_total)
values ('bbbbbbbb-0000-0000-0000-000000001801', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000001801',
        (select id from public.services where code = 'wheat_harvest'), 4046.86, 'accepted', true,
        '22222222-2222-2222-2222-222222222222', now(), 3500),
       ('bbbbbbbb-0000-0000-0000-000000001802', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000001801',
        (select id from public.services where code = 'wheat_harvest'), 4046.86, 'searching', true, null, null, null);
insert into public.job_dispatch (job_id, captain_id, rank)
values ('bbbbbbbb-0000-0000-0000-000000001802', '33333333-3333-3333-3333-333333333333', 1);

-- ===========================================================================
-- 1. A farmer cannot create a job already taken, or at his own area
-- ===========================================================================
select tests.act_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ insert into public.jobs (farmer_id, field_id, service_id, area_sqm, status, is_immediate, captain_id)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000001801',
             (select id from public.services where code = 'wheat_harvest'), 1, 'accepted', true,
             '22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'a job cannot be born accepted by a captain of the farmer''s choosing'
);
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate, quoted_total)
values ('bbbbbbbb-0000-0000-0000-000000001803', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000001801',
        (select id from public.services where code = 'wheat_harvest'), 1, 'searching', true, 1);
select ok(
  (select area_sqm > 3000 and quoted_total is null from public.jobs where id = 'bbbbbbbb-0000-0000-0000-000000001803'),
  'a new job takes the field''s measured area, and no price from the phone'
);

-- ===========================================================================
-- 2. Neither side can rewrite a shared job
-- ===========================================================================
update public.jobs set area_sqm = 1, quoted_total = 1, captain_id = '33333333-3333-3333-3333-333333333333'
where id = 'bbbbbbbb-0000-0000-0000-000000001801';
select ok(
  (select area_sqm > 4000 and quoted_total = 3500 and captain_id = '22222222-2222-2222-2222-222222222222'
   from public.jobs where id = 'bbbbbbbb-0000-0000-0000-000000001801'),
  'the farmer cannot change the area, the price or the captain'
);
select throws_ok(
  $$ update public.jobs set status = 'completed' where id = 'bbbbbbbb-0000-0000-0000-000000001801' $$,
  '55006', null, 'nor mark the job done himself'
);
select tests.act_as('22222222-2222-2222-2222-222222222222');
update public.jobs set farmer_id = '22222222-2222-2222-2222-222222222222', area_sqm = 99999
where id = 'bbbbbbbb-0000-0000-0000-000000001801';
select ok(
  (select farmer_id = '11111111-1111-1111-1111-111111111111' and area_sqm < 5000
   from public.jobs where id = 'bbbbbbbb-0000-0000-0000-000000001801'),
  'the captain cannot take the job off the farmer, or grow the field'
);
select lives_ok(
  $$ update public.jobs set status = 'en_route' where id = 'bbbbbbbb-0000-0000-0000-000000001801' $$,
  'but he can set off, as always'
);

-- ===========================================================================
-- 3. An offer cannot be moved onto another job
-- ===========================================================================
select tests.act_as('33333333-3333-3333-3333-333333333333');
update public.job_dispatch set job_id = 'bbbbbbbb-0000-0000-0000-000000001803'
where job_id = 'bbbbbbbb-0000-0000-0000-000000001802';
select throws_ok(
  $$ select public.accept_job('bbbbbbbb-0000-0000-0000-000000001803') $$,
  '42501', null, 'so a captain cannot accept a job he was never offered'
);
select throws_ok(
  $$ update public.job_dispatch set response = 'accepted' where job_id = 'bbbbbbbb-0000-0000-0000-000000001802' $$,
  '42501', null, 'and an offer can only be declined from the app, not accepted around accept_job'
);

-- ===========================================================================
-- 4. A captain cannot verify or rate himself
-- ===========================================================================
select tests.act_as_admin();
select tests.make_user('44444444-4444-4444-4444-444444444444', '919876501804', 'Kuldeep');
select tests.act_as('44444444-4444-4444-4444-444444444444');
insert into public.captains (profile_id, base_location, verification, verified_by, verified_at, rating_avg)
values ('44444444-4444-4444-4444-444444444444', extensions.st_geographyfromtext('POINT(74 30.4)'),
        'verified', '44444444-4444-4444-4444-444444444444', now(), 5);
select is(
  (select row(verification, rating_avg)::text from public.captains where profile_id = '44444444-4444-4444-4444-444444444444'),
  '(pending,)', 'a new captain starts pending and unrated, whatever he sends'
);
select tests.act_as('22222222-2222-2222-2222-222222222222');
update public.captains set rating_avg = 5, jobs_completed = 900 where profile_id = '22222222-2222-2222-2222-222222222222';
select ok(
  (select rating_avg is null and jobs_completed = 0 from public.captains where profile_id = '22222222-2222-2222-2222-222222222222'),
  'nor raise his own rating'
);

-- ===========================================================================
-- 5. A phone number cannot be taken over
-- ===========================================================================
update public.profiles set phone = '919876501801' where id = '22222222-2222-2222-2222-222222222222';
select tests.act_as_admin();
select is(
  (select phone from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  '919876501802', 'nobody can change his number to someone else''s'
);

-- ===========================================================================
-- 6. Numbers only to the other side of a live job
-- ===========================================================================
select tests.act_as('22222222-2222-2222-2222-222222222222');
select is(
  (select phone from public.my_job_contacts() where job_id = 'bbbbbbbb-0000-0000-0000-000000001801'),
  '919876501801', 'the captain on a live job gets the farmer''s number'
);
select tests.act_as('33333333-3333-3333-3333-333333333333');
select is_empty(
  $$ select 1 from public.my_job_contacts() $$,
  'a captain merely offered a job does not'
);
select throws_ok(
  $$ select phone from public.profiles $$,
  '42501', null, 'and reading the column directly is refused'
);
select lives_ok(
  $$ select full_name, village from public.profiles $$,
  'while names and villages still show on an offer card'
);
select throws_ok(
  $$ select * from public.staff_job_phones() $$,
  '42501', null, 'the founder''s list of numbers is staff only'
);

select * from finish();
rollback;
