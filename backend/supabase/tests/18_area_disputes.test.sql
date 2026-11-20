-- Stage 4.4: area disputes and the area on the papers.

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
select tests.make_user('11111111-1111-1111-1111-111111111111', '919876501001', 'Gurmeet');
select tests.make_user('22222222-2222-2222-2222-222222222222', '919876501002', 'Jaspal');
select tests.make_user('33333333-3333-3333-3333-333333333333', '919876501003', 'Stranger');
insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at)
values ('22222222-2222-2222-2222-222222222222',
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        extensions.st_geographyfromtext('POINT(74.03 30.404)'),
        true, 'verified', '11111111-1111-1111-1111-111111111111', now());
insert into public.fields (id, owner_id, name, boundary, capture_method, confirmed_by_owner)
values ('aaaaaaaa-0000-0000-0000-000000001001', '11111111-1111-1111-1111-111111111111', 'Khet',
        tests.killa_polygon(30.4028, 74.0286), 'drawn', true);
insert into public.jobs (id, farmer_id, field_id, service_id, captain_id, area_sqm, status, is_immediate, accepted_at)
select 'bbbbbbbb-0000-0000-0000-000000001001', '11111111-1111-1111-1111-111111111111',
       'aaaaaaaa-0000-0000-0000-000000001001', (select id from public.services where code = 'wheat_harvest'),
       '22222222-2222-2222-2222-222222222222', 4046.86, 'accepted', true, now();

-- A stranger cannot mark someone else's job.
select tests.act_as('33333333-3333-3333-3333-333333333333');
update public.jobs set area_disputed_at = now() where id = 'bbbbbbbb-0000-0000-0000-000000001001';
select tests.act_as_admin();
select is((select area_disputed_at from public.jobs where id = 'bbbbbbbb-0000-0000-0000-000000001001'),
  null, 'a stranger cannot dispute a job he is not party to');

-- The captain says the area is wrong, and claims a time last year and the farmer's name.
select tests.act_as('22222222-2222-2222-2222-222222222222');
update public.jobs set area_disputed_at = '2025-01-01', area_disputed_by = '11111111-1111-1111-1111-111111111111'
where id = 'bbbbbbbb-0000-0000-0000-000000001001';
select tests.act_as_admin();
select is((select area_disputed_by from public.jobs where id = 'bbbbbbbb-0000-0000-0000-000000001001'),
  '22222222-2222-2222-2222-222222222222'::uuid, 'the dispute is his, whoever he claims it was');
select ok((select area_disputed_at > now() - interval '1 minute' from public.jobs where id = 'bbbbbbbb-0000-0000-0000-000000001001'),
  'and stamped with the server clock, not the phone''s');

-- The farmer tries to clear it.
select tests.act_as('11111111-1111-1111-1111-111111111111');
update public.jobs set area_disputed_at = null, area_disputed_by = null where id = 'bbbbbbbb-0000-0000-0000-000000001001';
select tests.act_as_admin();
select isnt((select area_disputed_at from public.jobs where id = 'bbbbbbbb-0000-0000-0000-000000001001'),
  null, 'once said, a dispute cannot be cleared');
select is((select area_disputed_by from public.jobs where id = 'bbbbbbbb-0000-0000-0000-000000001001'),
  '22222222-2222-2222-2222-222222222222'::uuid, 'or re-attributed');

select is(
  (select row(disputed, by_captain, by_farmer)::text from metrics.area_disputes where region = 'fazilka'),
  '(1,1,0)', 'counted, and by which side'
);

-- Papers: stored, never priced.
select tests.act_as('11111111-1111-1111-1111-111111111111');
update public.fields set papers_area_sqm = 5000 where id = 'aaaaaaaa-0000-0000-0000-000000001001';
select tests.act_as_admin();
select is((select papers_area_sqm from public.fields where id = 'aaaaaaaa-0000-0000-0000-000000001001'),
  5000::double precision, 'the owner records the area on his papers');
select ok((select abs(area_sqm - 5000) > 500 from public.fields where id = 'aaaaaaaa-0000-0000-0000-000000001001'),
  'and the priced area stays the measured one');

select throws_ok(
  $$ update public.fields set papers_area_sqm = -1 where id = 'aaaaaaaa-0000-0000-0000-000000001001' $$,
  '23514', null, 'nonsense on the papers is refused'
);

select * from finish();
rollback;
