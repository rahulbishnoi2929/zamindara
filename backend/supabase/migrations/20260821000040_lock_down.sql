-- A security pass over every endpoint (founder: "check every endpoint and
-- everything"). What a signed-in phone could do before this migration,
-- each found by reading the policies against the columns:
--
--   1. A farmer could INSERT a job already 'accepted' by a captain of his
--      choosing, with any area and any price. jobs_insert_own checked only
--      that the job was his and the field confirmed.
--   2. Either party could UPDATE any column of a shared job: the area, the
--      quote, farmer_id, captain_id. jobs_update_party is row-level, and
--      only `status` had a guard (enforce_job_transition).
--   3. A captain could move one of his job_dispatch rows to any other job
--      (job_dispatch_respond checks only captain_id), and then accept_job
--      that job: its check is "holds an offer row on it".
--   4. A captain could INSERT himself as 'verified' (the constraint wants a
--      verified_by and verified_at, which he can fill with his own id), and
--      could raise his own rating_avg, which dispatch ranks on.
--   5. Anyone could change their own profiles.phone, which is how founder
--      bookings find a farmer (farmer_by_phone): set your number to his and
--      his phoned-in jobs come to you.
--   6. Any signed-in user could read every verified captain's phone, home
--      and live location; and a captain merely offered a job, the farmer's
--      phone.
--   7. eligible_captains and quote_job were callable by anyone, signed in or
--      not. Both return a captain's distance to a field of the caller's
--      choosing; a few fields and some arithmetic place him.
--
-- The rule throughout: a direct write from the app (role `authenticated`)
-- may change only what that person decides. Everything the server decides
-- (identity, size, money, verification, ratings) changes only inside
-- SECURITY DEFINER functions, which run as the owner and so pass these
-- guards. Protected columns are quietly kept as they were rather than
-- refused, so an app sending its whole row on every sync keeps working; a
-- forbidden status move, which no app path makes, is refused.

-- ---------------------------------------------------------------------------
-- 1, 2. Jobs written directly from a phone
-- ---------------------------------------------------------------------------
create function public.guard_job_client_write()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  me uuid := auth.uid();
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'searching' or new.captain_id is not null or new.machine_id is not null then
      raise exception 'a new job starts searching, with no captain' using errcode = '42501';
    end if;
    -- The field's area, as the server measured it, never the phone's.
    new.area_sqm         := (select f.area_sqm from public.fields f where f.id = new.field_id);
    new.quoted_rate      := null;
    new.quoted_subtotal  := null;
    new.quoted_total     := null;
    new.travel_charge    := 0;
    new.final_amount     := null;
    new.payment_mode     := null;
    new.search_extra_km  := 0;
    new.search_exhausted_at := null;
    new.area_disputed_at := null;
    new.accepted_at      := null;
    new.started_at       := null;
    new.completed_at     := null;
    return new;
  end if;

  -- Identity, size and money are the server's.
  new.id               := old.id;
  new.farmer_id        := old.farmer_id;
  new.captain_id       := old.captain_id;
  new.field_id         := old.field_id;
  new.service_id       := old.service_id;
  new.area_sqm         := old.area_sqm;
  new.quoted_rate      := old.quoted_rate;
  new.quoted_unit      := old.quoted_unit;
  new.quoted_subtotal  := old.quoted_subtotal;
  new.travel_charge    := old.travel_charge;
  new.quoted_total     := old.quoted_total;
  new.is_immediate     := old.is_immediate;
  new.scheduled_date   := old.scheduled_date;
  new.scheduled_window := old.scheduled_window;
  new.search_extra_km  := old.search_extra_km;
  new.search_exhausted_at := old.search_exhausted_at;
  new.created_at       := old.created_at;

  if me is not null and me = old.captain_id then
    -- The captain moves his job forward, and records what was paid.
    if new.status <> old.status and not (
         (old.status = 'accepted'    and new.status in ('en_route', 'in_progress', 'completed'))
      or (old.status = 'en_route'    and new.status in ('in_progress', 'completed'))
      or (old.status = 'in_progress' and new.status = 'completed')
    ) then
      raise exception 'a captain cannot move a job from % to %', old.status, new.status
        using errcode = '55006';
    end if;
    -- Either side may say the area is wrong (4.4); stamp_area_dispute records who.
  else
    -- The farmer: notes and an area dispute. Cancelling goes through cancel_job.
    if new.status <> old.status then
      raise exception 'a farmer cannot move a job from % to % directly', old.status, new.status
        using errcode = '55006';
    end if;
    new.final_amount := old.final_amount;
    new.payment_mode := old.payment_mode;
    new.machine_id   := old.machine_id;
  end if;

  return new;
end;
$fn$;

-- Named to fire before jobs_set_machine, jobs_stamp_times and
-- jobs_transition_guard (BEFORE triggers run in name order).
create trigger jobs_guard_client_write
  before insert or update on public.jobs
  for each row execute function public.guard_job_client_write();

-- ---------------------------------------------------------------------------
-- 3. An offer row: the captain may decline it, nothing else
-- ---------------------------------------------------------------------------
create function public.guard_dispatch_client_write()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.response is distinct from old.response
     and not (old.response = 'pending' and new.response = 'declined') then
    raise exception 'an offer can only be declined from the app' using errcode = '42501';
  end if;
  new.id          := old.id;
  new.job_id      := old.job_id;
  new.captain_id  := old.captain_id;
  new.round       := old.round;
  new.rank        := old.rank;
  new.distance_km := old.distance_km;
  new.match_score := old.match_score;
  new.sent_at     := old.sent_at;
  new.repinged_at := old.repinged_at;
  new.responded_at := case when new.response = 'declined' and old.response = 'pending'
                           then now() else old.responded_at end;
  return new;
end;
$fn$;

create trigger job_dispatch_guard_client_write
  before update on public.job_dispatch
  for each row execute function public.guard_dispatch_client_write();

-- ---------------------------------------------------------------------------
-- 4. A captain's own row: never his own verification, never his own rating
-- ---------------------------------------------------------------------------
create function public.guard_captain_client_write()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.verification   := 'pending';
    new.verified_by    := null;
    new.verified_at    := null;
    new.rating_avg     := null;
    new.rating_count   := 0;
    new.jobs_completed := 0;
  else
    new.profile_id     := old.profile_id;
    -- verification is left for captains_update_own to refuse, loudly.
    new.verified_by    := old.verified_by;
    new.verified_at    := old.verified_at;
    new.rating_avg     := old.rating_avg;
    new.rating_count   := old.rating_count;
    new.jobs_completed := old.jobs_completed;
    new.created_at     := old.created_at;
  end if;
  return new;
end;
$fn$;

create trigger captains_guard_client_write
  before insert or update on public.captains
  for each row execute function public.guard_captain_client_write();

-- ---------------------------------------------------------------------------
-- 5. A profile's phone is the number Auth verified, and nothing else
-- ---------------------------------------------------------------------------
create function public.guard_profile_client_write()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  -- Not inside a server function: founder_create_farmer makes a placeholder
  -- profile with the farmer's number, and that must stand.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- The number Auth verified, from the session's own token.
    new.phone := nullif(current_setting('request.jwt.claims', true)::json ->> 'phone', '');
    new.placeholder := false;
  else
    new.id          := old.id;
    new.phone       := old.phone;
    new.placeholder := old.placeholder;
    new.created_at  := old.created_at;
  end if;
  return new;
end;
$fn$;

create trigger profiles_guard_client_write
  before insert or update on public.profiles
  for each row execute function public.guard_profile_client_write();

-- ---------------------------------------------------------------------------
-- 6. Phones and locations are not readable directly
--
-- Column privileges, because a row policy cannot hide one column: a captain
-- offered a job needs the farmer's name and village on his card, not his
-- number. Numbers come from my_job_contacts (the other side of a live job)
-- and staff_job_phones; locations only ever through server functions.
-- ---------------------------------------------------------------------------
revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, photo_url, role, village, region_id, language,
              display_chain, placeholder, created_at, updated_at)
  on public.profiles to authenticated;

revoke select on public.captains from anon, authenticated;
grant select (profile_id, verification, verified_by, verified_at, service_radius_km,
              is_online, is_travelling, travel_until, planned_route,
              rating_avg, rating_count, jobs_completed, created_at, updated_at)
  on public.captains to authenticated;

-- The other side's number, for each live job (accepted, on the way,
-- working): what the call button needs, and no more.
create function public.my_job_contacts()
returns table (job_id uuid, phone text)
language sql
stable
security definer
set search_path = public
as $fn$
  select j.id, p.phone
  from public.jobs j
  join public.profiles p
    on p.id = case when j.farmer_id = auth.uid() then j.captain_id else j.farmer_id end
  where auth.uid() is not null
    and (j.farmer_id = auth.uid() or j.captain_id = auth.uid())
    and j.captain_id is not null
    and j.status in ('accepted', 'en_route', 'in_progress');
$fn$;

-- The founder's job list: who to ring about open work.
create function public.staff_job_phones()
returns table (job_id uuid, phone text)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  perform public.require_staff();
  return query
  select j.id, p.phone
  from public.jobs j
  join public.profiles p on p.id = j.farmer_id
  where j.status in ('searching', 'accepted', 'en_route', 'in_progress');
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 7. Who may call what
--
-- New functions in public are executable by PUBLIC, so anon, unless revoked.
-- Nothing is called signed out (app_config is a table read), so: no
-- function at all for anon. Keep every grant authenticated already had,
-- explicitly, then take PUBLIC away.
-- ---------------------------------------------------------------------------
do $do$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    if has_function_privilege('authenticated', f, 'execute') then
      execute format('grant execute on function %s to authenticated', f);
    end if;
    execute format('grant execute on function %s to service_role', f);
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end;
$do$;

-- Internal: the dispatch functions call these; no phone does.
revoke execute on function public.eligible_captains(uuid, uuid, timestamptz, integer, integer) from authenticated;
revoke execute on function public.quote_job(uuid, uuid, uuid) from authenticated;
-- Arithmetic the dispatch functions use. No grants at all: its arguments are
-- extension types, and the Supabase CLI dump does not carry its grants, so
-- any grant here would silently vanish on a restore (CI caught it).
revoke execute on function public.road_km(extensions.geography, extensions.geography) from authenticated, service_role;
