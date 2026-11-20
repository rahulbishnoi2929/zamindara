-- What stops one farmer ringing every phone in the district, and whose
-- clock decides when work happened.
--
-- dispatch_job used to check only that the caller owned the job and that it
-- was still searching. Since it runs on every sync pass and a successful
-- offer sends a push, that made a loop posting jobs a loop ringing every
-- eligible captain — indistinguishable, from their side, from real demand.
--
-- And started_at / completed_at arrived from the handset, stamped with its
-- own clock. They are what a farmer and a captain argue about.

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

-- A searching job on the farmer's confirmed field.
create or replace function tests.post_job(p_id uuid)
returns void language plpgsql as $fn$
begin
  insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm,
                           status, is_immediate)
  select p_id, '11111111-1111-1111-1111-111111111111', f.id,
         (select id from public.services where code = 'wheat_harvest'),
         f.area_sqm, 'searching', true
  from public.fields f where f.name = 'Nehar wala khet';
end;
$fn$;

grant usage on schema tests to postgres, anon, authenticated, service_role;
grant execute on all functions in schema tests
  to postgres, anon, authenticated, service_role;

select tests.act_as_admin();
-- Automatic dispatch is off by default (0024). These tests are about what
-- dispatch does when it runs, so they switch it on.
update public.app_config set auto_dispatch = true;
select tests.make_user('11111111-1111-1111-1111-111111111111', '9876500401', 'Gurmeet');
select tests.make_user('22222222-2222-2222-2222-222222222222', '9876500402', 'Jaspal');

insert into public.captains (profile_id, base_location, current_location, is_online,
                             verification, verified_by, verified_at)
values ('22222222-2222-2222-2222-222222222222',
        extensions.st_geographyfromtext('POINT(74.0300 30.4040)'),
        extensions.st_geographyfromtext('POINT(74.0300 30.4040)'),
        true, 'verified', '11111111-1111-1111-1111-111111111111', now());

select tests.act_as('22222222-2222-2222-2222-222222222222');
insert into public.captain_machines (captain_id, machine_type_id, ownership, lead_time_hours)
values ('22222222-2222-2222-2222-222222222222',
        (select id from public.machine_types where code = 'combine'), 'owned', 0);
insert into public.captain_services (captain_id, service_id, rate, rate_unit)
values ('22222222-2222-2222-2222-222222222222',
        (select id from public.services where code = 'wheat_harvest'), 1200, 'per_killa');

select tests.act_as('11111111-1111-1111-1111-111111111111');
insert into public.fields (owner_id, name, boundary, centroid, area_sqm,
                           capture_method, region_id, confirmed_by_owner)
values (
  '11111111-1111-1111-1111-111111111111',
  'Nehar wala khet',
  tests.killa_polygon(30.4028, 74.0286),
  extensions.st_geographyfromtext('POINT(74.0286 30.4028)'),
  1, 'drawn',
  (select id from public.regions where slug = 'fazilka'),
  true
);

-- ===========================================================================
-- The field must be one he looked at and accepted
-- ===========================================================================

select tests.post_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

select is(
  public.dispatch_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'a job on a confirmed field is offered as before'
);

-- jobs_insert_own already refuses a job on an unconfirmed field: "an
-- unconfirmed area must never reach a price". So the gap dispatch_job
-- closes is narrower, and it is the one that actually happens — the field
-- is confirmed when the job is posted, and un-confirmed afterwards by
-- re-drawing it. The job already exists; without this guard it keeps being
-- offered at whatever the new boundary says.
select tests.post_job('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

update public.fields
set boundary = tests.killa_polygon(30.4030, 74.0288)
where name = 'Nehar wala khet';

select is(
  (select confirmed_by_owner from public.fields where name = 'Nehar wala khet'),
  false,
  're-drawing a boundary un-confirms the field'
);

select throws_ok(
  $$ select public.dispatch_job('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '55006',
  null,
  'and a job already posted on it stops being offered until he accepts the new area'
);

update public.fields set confirmed_by_owner = true where name = 'Nehar wala khet';

select is(
  public.dispatch_job('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  1,
  'once he confirms it, the job goes out'
);

-- ===========================================================================
-- A ceiling on open requests
--
-- Two are already searching. Four more makes six, and the sixth is refused.
-- ===========================================================================
select tests.post_job('cccccccc-cccc-cccc-cccc-cccccccccccc');
select tests.post_job('dddddddd-dddd-dddd-dddd-dddddddddddd');
select tests.post_job('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');

select is(
  public.dispatch_job('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  1,
  'five open requests is still ordinary use'
);

select tests.post_job('f1111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ select public.dispatch_job('f1111111-1111-1111-1111-111111111111') $$,
  '54000',
  null,
  'the sixth is refused, so a loop cannot ring every captain in the district'
);

-- A captain is not affected by the farmer's ceiling, and the job he already
-- holds is not counted against it either.
select is(
  (select count(*)::int from public.jobs
   where farmer_id = '11111111-1111-1111-1111-111111111111' and status = 'searching'),
  6,
  'the refused job still exists — it is the offer that was stopped, not the request'
);

-- ===========================================================================
-- Whose clock says when the work happened
-- ===========================================================================
select tests.act_as('22222222-2222-2222-2222-222222222222');
select lives_ok(
  $$ select public.accept_job('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'the captain takes the first job'
);

-- The handset claims it started last year. It did not.
update public.jobs
set status = 'in_progress', started_at = '2025-01-01 05:00:00+00'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select ok(
  (select started_at from public.jobs
   where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') > now() - interval '1 minute',
  'the server stamps when work started, not what the phone said'
);

-- Completing carries the handset's started_at up with it. Before the freeze
-- this is where a wrong time actually got stored.
update public.jobs
set status = 'completed', final_amount = 1200,
    started_at = '2025-01-01 05:00:00+00',
    completed_at = '2030-01-01 05:00:00+00'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select ok(
  (select completed_at from public.jobs
   where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') < now() + interval '1 minute',
  'and when it finished, so a phone cannot date its own work in the future'
);

select ok(
  (select started_at from public.jobs
   where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') > now() - interval '1 minute',
  'the start time is not rewritten by the write that completes the job'
);

-- A later edit with no status change must move nothing.
update public.jobs
set final_amount = 1300, completed_at = '2030-01-01 05:00:00+00'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select ok(
  (select completed_at from public.jobs
   where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') < now() + interval '1 minute',
  'and a later sync cannot rewrite a time that is already on the record'
);

select * from finish();
rollback;
