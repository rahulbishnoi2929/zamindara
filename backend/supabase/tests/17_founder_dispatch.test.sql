-- Stage 4.1 + 4.2: placeholder farmers claimed by an OTP-verified phone,
-- and the founder's dispatch functions — refused to everyone but staff.

begin;
select plan(20);

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
select tests.make_user('11111111-1111-1111-1111-111111111111', '919876500901', 'Founder');
select tests.make_user('22222222-2222-2222-2222-222222222222', '919876500902', 'Jaspal');
select tests.make_user('33333333-3333-3333-3333-333333333333', '919876500903', 'Stranger');
insert into public.admins (phone) values ('9876500901');
insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at)
values ('22222222-2222-2222-2222-222222222222',
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        true, 'verified', '11111111-1111-1111-1111-111111111111', now());

-- ---------------------------------------------------------------- refusals
select tests.act_as('33333333-3333-3333-3333-333333333333');
select throws_ok($$ select public.founder_create_farmer('9876500999', 'X') $$, '42501', null,
  'a normal account cannot create a farmer');
select throws_ok($$ select public.founder_create_job('33333333-3333-3333-3333-333333333333', 'wheat_harvest', 4046.86, 30.4, 74.0) $$,
  '42501', null, 'nor book a job for anyone');
select throws_ok($$ select public.founder_captains() $$, '42501', null, 'nor list captains');

-- ---------------------------------------------------------- the founder
select tests.act_as('11111111-1111-1111-1111-111111111111');

create temp table t (farmer uuid, job uuid);
grant all on t to authenticated;
insert into t (farmer) values (public.founder_create_farmer('98765 00950', 'Gurmeet Singh', 'Arniwala'));

select is(
  (select row(placeholder, phone, r.slug)::text from public.profiles p
   join public.regions r on r.id = p.region_id where p.id = (select farmer from t)),
  '(t,919876500950,fazilka)',
  'a phoned-in farmer is a placeholder, stored with 91, in the live region'
);

select is(public.founder_create_farmer('919876500950', 'Gurmeet'), (select farmer from t),
  'the same number again is the same farmer');

update t set job = public.founder_create_job(
  (select farmer from t), 'wheat_harvest', 2 * 4046.8564224, 30.4028, 74.0286);

select is(
  (select row(j.status, f.capture_method, f.confirmed_by_owner)::text
   from public.jobs j join public.fields f on f.id = j.field_id where j.id = (select job from t)),
  '(searching,declared,t)',
  'the job is searching, on a declared field the founder vouches for'
);

select ok(
  (select abs(j.area_sqm - 2 * 4046.8564224) / (2 * 4046.8564224) < 0.01
   from public.jobs j where j.id = (select job from t)),
  'the declared square is the area he was told, within 1%'
);

select ok(
  exists(select 1 from public.founder_captains((select job from t))
         where captain_id = '22222222-2222-2222-2222-222222222222' and distance_km < 5),
  'the founder sees verified captains, with their distance to the job'
);

select is(
  (select row(status, captain_id)::text from public.founder_assign((select job from t), '22222222-2222-2222-2222-222222222222')),
  '(accepted,22222222-2222-2222-2222-222222222222)',
  'assigning puts it straight into the captain''s queue'
);

select throws_ok(
  $$ select public.founder_assign((select job from t), '22222222-2222-2222-2222-222222222222') $$,
  '55006', null, 'and it cannot be assigned twice'
);

select is(
  (select status::text from public.founder_advance((select job from t), 'en_route')),
  'en_route', 'the founder moves it along on the captain''s behalf'
);

select throws_ok(
  $$ select public.founder_advance((select job from t), 'expired') $$,
  null, null, 'the same transition rules bind the founder: an en-route job cannot lapse'
);

select is(
  (select row(status, final_amount, payment_mode)::text
   from public.founder_advance((select job from t), 'completed', 8400, 'cash')),
  '(completed,8400.00,cash)',
  'and records the money when it is done'
);

select throws_ok(
  $$ select public.founder_advance((select job from t), 'in_progress') $$,
  null, null, 'a finished job cannot be moved again, by the founder or anyone'
);

-- ------------------------------------------------------------ visibility
select tests.act_as('33333333-3333-3333-3333-333333333333');
select is_empty($$ select 1 from public.profiles where id = (select farmer from t) $$,
  'a stranger cannot see the phoned-in farmer');
select is_empty($$ select 1 from public.jobs where id = (select job from t) $$,
  'nor his job');

-- ----------------------------------------------------------------- claim
-- The stranger's verified phone is not the farmer's: nothing to claim.
select is(public.claim_profile(), false, 'a different number claims nothing');

-- The farmer installs the app and signs in with his own number.
select tests.act_as_admin();
insert into auth.users (instance_id, id, aud, role, phone, encrypted_password, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555',
        'authenticated', 'authenticated', '919876500950', '', now(), now());
select tests.act_as('55555555-5555-5555-5555-555555555555');

select is(public.claim_profile(), true, 'his OTP-verified number claims the placeholder');

select is(
  (select row(p.placeholder, j.farmer_id, f.owner_id)::text
   from public.profiles p, public.jobs j join public.fields f on f.id = j.field_id
   where p.id = '55555555-5555-5555-5555-555555555555' and j.id = (select job from t)),
  '(f,55555555-5555-5555-5555-555555555555,55555555-5555-5555-5555-555555555555)',
  'and his job and field are now his, under his own account'
);

select is(public.claim_profile(), false, 'claiming again does nothing');

select * from finish();
rollback;
