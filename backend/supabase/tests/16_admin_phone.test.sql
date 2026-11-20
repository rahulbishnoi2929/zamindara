-- The founder becomes staff by inserting his number into admins, written
-- either way, while his profile carries the country code from Auth.

begin;
select plan(3);

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
select tests.make_user('11111111-1111-1111-1111-111111111111', '919876500801', 'Founder');
select tests.make_user('22222222-2222-2222-2222-222222222222', '919876500802', 'Somebody');
-- As SETUP.md tells him: ten digits.
insert into public.admins (phone) values ('9876500801');

select tests.act_as('11111111-1111-1111-1111-111111111111');
select ok(public.is_admin(), 'ten digits in admins matches a profile stored with 91');

select tests.act_as('22222222-2222-2222-2222-222222222222');
select ok(not public.is_admin(), 'and nobody else');

select tests.act_as_admin();
delete from public.admins;
insert into public.admins (phone) values ('919876500801');
select tests.act_as('11111111-1111-1111-1111-111111111111');
select ok(public.is_admin(), 'written with 91, it matches too');

select * from finish();
rollback;
