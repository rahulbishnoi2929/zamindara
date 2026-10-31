-- Push tokens.
--
-- A push token is the address a notification is delivered to. A leaked set of
-- them is a spam channel pointed at every captain in the district, so the
-- important assertions here are about who *cannot* read them.

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

grant usage on schema tests to postgres, anon, authenticated, service_role;
grant execute on all functions in schema tests
  to postgres, anon, authenticated, service_role;

select tests.act_as_admin();
select tests.make_user('11111111-0000-0000-0000-000000000001', '9876500021', 'Jaspal');
select tests.make_user('22222222-0000-0000-0000-000000000002', '9876500022', 'Ramesh');

-- ===========================================================================
-- A device registers its own token
-- ===========================================================================
select tests.act_as('11111111-0000-0000-0000-000000000001');

select lives_ok(
  $$ insert into public.push_tokens (token, profile_id)
     values ('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]',
             '11111111-0000-0000-0000-000000000001') $$,
  'a captain can register his own device'
);

-- Reinstalling, or a token rotating, must not accumulate dead rows.
select lives_ok(
  $$ insert into public.push_tokens (token, profile_id)
     values ('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]',
             '11111111-0000-0000-0000-000000000001')
     on conflict (token) do update set profile_id = excluded.profile_id $$,
  're-registering the same token is idempotent'
);

select is(
  (select count(*)::int from public.push_tokens),
  1,
  'and leaves exactly one row'
);

-- A second phone is normal and both should ring.
select lives_ok(
  $$ insert into public.push_tokens (token, profile_id)
     values ('ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]',
             '11111111-0000-0000-0000-000000000001') $$,
  'a captain may hold more than one device'
);

-- ===========================================================================
-- Nobody else can touch them
-- ===========================================================================
select tests.act_as('22222222-0000-0000-0000-000000000002');

select is_empty(
  $$ select 1 from public.push_tokens $$,
  'another user cannot read anyone else''s push tokens'
);

select throws_ok(
  $$ insert into public.push_tokens (token, profile_id)
     values ('ExponentPushToken[cccccccccccccccccccccc]',
             '11111111-0000-0000-0000-000000000001') $$,
  '42501',
  null,
  'a user cannot register a token against someone else'
);

-- ===========================================================================
-- A phone changing hands moves the token, rather than leaving a stale row
-- pointed at the wrong person — which would send his work to a stranger.
-- ===========================================================================
select tests.act_as_admin();
update public.push_tokens
set profile_id = '22222222-0000-0000-0000-000000000002'
where token = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';

select tests.act_as('22222222-0000-0000-0000-000000000002');
select is(
  (select count(*)::int from public.push_tokens),
  1,
  'the new owner sees the device that moved to him'
);

select tests.act_as('11111111-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from public.push_tokens),
  1,
  'and the previous owner no longer does'
);

-- ===========================================================================
-- Malformed tokens are refused at the door
-- ===========================================================================
select throws_ok(
  $$ insert into public.push_tokens (token, profile_id)
     values ('not-a-push-token', '11111111-0000-0000-0000-000000000001') $$,
  '23514',
  null,
  'a malformed token is rejected rather than failing silently at send time'
);

select * from finish();
rollback;
