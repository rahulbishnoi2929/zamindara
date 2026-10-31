-- Verifying captains.
--
-- The gap this closes was total: nothing could move a captain off 'pending',
-- so every captain onboarded in November would have been invisible to
-- farmers and never offered a job. These assertions exist so that path
-- cannot silently close again.

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

grant usage on schema tests to postgres, anon, authenticated, service_role;
grant execute on all functions in schema tests
  to postgres, anon, authenticated, service_role;

select tests.act_as_admin();

-- The founder, a captain waiting to be let in, and a farmer.
select tests.make_user('aaaaaaaa-0000-0000-0000-000000000001', '9876500011', 'Founder');
select tests.make_user('bbbbbbbb-0000-0000-0000-000000000002', '9876500012', 'Jaspal');
select tests.make_user('cccccccc-0000-0000-0000-000000000003', '9876500013', 'Gurmeet');

insert into public.admins (phone, note) values ('9876500011', 'founder');

insert into public.captains (profile_id, base_location)
values
  ('bbbbbbbb-0000-0000-0000-000000000002',
   extensions.st_geographyfromtext('POINT(74.03 30.404)'));

-- ===========================================================================
-- The starting state: pending, and therefore invisible
-- ===========================================================================
select is(
  (select verification::text from public.captains
   where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'pending',
  'a captain starts pending'
);

select tests.act_as('cccccccc-0000-0000-0000-000000000003');
select is_empty(
  $$ select 1 from public.captains
     where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  'a pending captain is invisible to a farmer — which is why a path to verified must exist'
);

-- ===========================================================================
-- Only staff decide
-- ===========================================================================
select is(public.is_admin(), false, 'a farmer is not staff');

select throws_ok(
  $$ select public.set_captain_verification(
       'bbbbbbbb-0000-0000-0000-000000000002', 'verified') $$,
  '42501',
  'only staff can verify captains',
  'a farmer cannot verify a captain'
);

select tests.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.set_captain_verification(
       'bbbbbbbb-0000-0000-0000-000000000002', 'verified') $$,
  '42501',
  'only staff can verify captains',
  'a captain cannot verify himself through the function either'
);

select is_empty(
  $$ select 1 from public.pending_captains() $$,
  'a captain cannot see the pending queue'
);

-- ===========================================================================
-- The founder can
-- ===========================================================================
select tests.act_as('aaaaaaaa-0000-0000-0000-000000000001');

select is(public.is_admin(), true, 'the founder is staff');

select is(
  (select count(*)::int from public.pending_captains()),
  1,
  'the pending queue shows the captain waiting'
);

select is(
  (select machine_count from public.pending_captains()),
  0,
  'the queue reports how many machines he registered'
);

select is(
  public.set_captain_verification('bbbbbbbb-0000-0000-0000-000000000002', 'verified')::text,
  'verified',
  'the founder can verify a captain'
);

-- The constraint requires an actor and a time; a dispute later will want them.
select isnt_empty(
  $$ select 1 from public.captains
     where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002'
       and verified_by = 'aaaaaaaa-0000-0000-0000-000000000001'
       and verified_at is not null $$,
  'who decided, and when, is on the record'
);

-- The whole point: he is now visible and dispatchable.
select tests.act_as('cccccccc-0000-0000-0000-000000000003');
select isnt_empty(
  $$ select 1 from public.captains
     where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  'once verified, a farmer can see him'
);

-- ===========================================================================
-- Guards
-- ===========================================================================
select tests.act_as('aaaaaaaa-0000-0000-0000-000000000001');

select throws_ok(
  $$ select public.set_captain_verification(
       'bbbbbbbb-0000-0000-0000-000000000002', 'pending') $$,
  '22023',
  null,
  'cannot be set back to pending — that would erase who decided'
);

select throws_ok(
  $$ select public.set_captain_verification(
       '99999999-9999-9999-9999-999999999999', 'verified') $$,
  'P0002',
  'no such captain',
  'verifying a captain who does not exist fails loudly'
);

select * from finish();
rollback;
