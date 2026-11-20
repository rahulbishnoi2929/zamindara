-- Brief 3.2: the switches on the app_config row, and what dispatch does
-- with automatic dispatch off.

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
select tests.make_user('11111111-1111-1111-1111-111111111111', '9876500401', 'Gurmeet');

select tests.act_as('11111111-1111-1111-1111-111111111111');
insert into public.fields (owner_id, name, boundary, centroid, area_sqm,
                           capture_method, region_id, confirmed_by_owner)
values ('11111111-1111-1111-1111-111111111111', 'Nehar wala khet',
        tests.killa_polygon(30.4028, 74.0286),
        extensions.st_geographyfromtext('POINT(74.0286 30.4028)'),
        1, 'drawn', (select id from public.regions where slug = 'fazilka'), true);
insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
       f.id, (select id from public.services where code = 'wheat_harvest'),
       f.area_sqm, 'searching', true
from public.fields f where f.name = 'Nehar wala khet';

select is(
  (select row(auto_dispatch, loud_ping, founder_code_signin)::text from public.app_config),
  '(f,f,t)',
  'defaults: automatic dispatch off, loud ping off, founder-code sign-in on'
);

select is(
  public.dispatch_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'with automatic dispatch off, a job is offered to nobody'
);

select tests.act_as_admin();
select is_empty(
  $$ select 1 from public.job_dispatch where job_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'and no offer rows are written — the founder writes them by hand'
);

update public.app_config set auto_dispatch = true;
select tests.act_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ select public.dispatch_job('00000000-0000-0000-0000-00000000dead') $$,
  'P0002', null,
  'switched on, the call reaches the real dispatcher'
);

select tests.act_as_admin();
update public.app_config set auto_dispatch = false;

-- A row nobody can write from a phone: the anon key ships in every APK.
select tests.act_as('11111111-1111-1111-1111-111111111111');
update public.app_config set auto_dispatch = true, loud_ping = true;
select tests.act_as_admin();
select is(
  (select row(auto_dispatch, loud_ping)::text from public.app_config),
  '(f,f)',
  'a signed-in user cannot flip a switch (the update matches no row)'
);

select tests.act_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ select public.dispatch_job_offer('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 5) $$,
  '42501', null,
  'the inner dispatcher cannot be called around the switch'
);

select tests.act_as_admin();
select set_config('role', 'anon', true);
select throws_ok(
  $$ select public.dispatch_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501', null,
  'signed out, dispatch_job cannot be called at all'
);

select tests.act_as_admin();
select set_config('role', 'anon', true);
select is(
  (select row(auto_dispatch, loud_ping)::text from public.app_config),
  '(f,f)',
  'a phone that has not signed in can read the switches'
);

select * from finish();
rollback;
