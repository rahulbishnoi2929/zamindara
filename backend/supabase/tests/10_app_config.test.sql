-- The one row the app asks about itself.
--
-- There is no store, so an APK sits on a captain's phone until someone
-- replaces it by hand. This row is how a phone finds out there is a newer
-- one, and how the server refuses a version too old to be safe.
--
-- The assertions that matter are about who can write it. The anon key ships
-- inside every APK, so "a client can change what the minimum supported
-- version is" would mean any captain's handset can lock out every other.

begin;
select plan(12);

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

create or replace function tests.act_as_anon()
returns void language plpgsql as $fn$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
end;
$fn$;

grant usage on schema tests to postgres, anon, authenticated, service_role;
grant execute on all functions in schema tests
  to postgres, anon, authenticated, service_role;

select tests.act_as_admin();
select tests.make_user('11111111-1111-1111-1111-111111111111', '9876500501', 'Gurmeet');

-- ===========================================================================
-- Everyone can read it, including a phone that has not signed in
--
-- A handset too old to be allowed in still has to be able to learn that,
-- and it learns it before signing in — otherwise the lockout is a dead end
-- with no message.
-- ===========================================================================
select tests.act_as_anon();

select is(
  (select count(*)::int from public.app_config),
  1,
  'a phone that has not signed in can still read the configuration'
);

select is(
  (select minimum_supported_version from public.app_config),
  '0.0.0',
  'and the floor starts at zero, so adding this locks nobody out'
);

select tests.act_as('11111111-1111-1111-1111-111111111111');
select is(
  (select latest_version from public.app_config),
  '0.1.0',
  'a signed-in captain reads the same single row'
);

-- ===========================================================================
-- Nobody with an app's key can write it
--
-- The anon key is inside every APK. If a client could raise
-- minimum_supported_version, one captain's handset could lock out the
-- district; if it could change latest_apk_url, it could hand everyone an
-- APK of its choosing.
-- ===========================================================================
-- Note the shape of these three. An UPDATE or DELETE with no permissive
-- policy does not raise in Postgres — it matches zero rows and reports
-- success. Only INSERT, which is checked with WITH CHECK, throws. So the
-- assertion that means anything is that the row did not move.
update public.app_config set minimum_supported_version = '9.9.9';

select is(
  (select minimum_supported_version from public.app_config),
  '0.0.0',
  'a signed-in user cannot raise the floor and lock out every other phone'
);

update public.app_config set latest_apk_url = 'https://example.invalid/evil.apk';

select ok(
  (select latest_apk_url is null from public.app_config),
  'nor point the district at an APK of his choosing'
);

select throws_ok(
  $$ insert into public.app_config (latest_version, minimum_supported_version)
     values ('2.0.0', '2.0.0') $$,
  '42501',
  null,
  'nor add a second configuration for the app to find'
);

delete from public.app_config;

select is(
  (select count(*)::int from public.app_config),
  1,
  'nor delete the one that is there'
);

-- ===========================================================================
-- Which story the sign-in screen tells
--
-- There is no SMS provider. Telling a captain an SMS is on its way, when
-- none is, is the app asking him to wait for something that is not coming.
-- ===========================================================================
select is(
  (select founder_code_signin from public.app_config),
  true,
  'the default is the honest one: the code comes from the founder'
);

update public.app_config set founder_code_signin = false;

select is(
  (select founder_code_signin from public.app_config),
  true,
  'and a captain cannot flip it — it is read from the dashboard, not written by a phone'
);

-- The day the SMS paperwork clears, this changes on phones already in
-- captains' hands. There is no store to push an update through, which is
-- the whole reason it is a column.
select tests.act_as_admin();
update public.app_config set founder_code_signin = false;

select is(
  (select founder_code_signin from public.app_config),
  false,
  'the founder can switch it from the dashboard without rebuilding anything'
);

select tests.act_as('11111111-1111-1111-1111-111111111111');

-- ===========================================================================
-- The row cannot become nonsense
-- ===========================================================================
select tests.act_as_admin();

select throws_ok(
  $$ insert into public.app_config (id, latest_version, minimum_supported_version)
     values (false, '0.2.0', '0.1.0') $$,
  '23514',
  null,
  'there can only ever be one row — two answers would be no answer'
);

-- A version that is not a version compares as nothing sensible, which would
-- either nag every phone forever or lock them all out.
select throws_ok(
  $$ update public.app_config set latest_version = 'v2-beta' $$,
  '23514',
  null,
  'and a malformed version is refused rather than stored'
);

select * from finish();
rollback;
