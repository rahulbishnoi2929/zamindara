-- Brief 3.2: remote switches, on the one app_config row.
--
-- founder_code_signin (0022) and minimum_supported_version (0021) already
-- live here. Two more:
--
--   auto_dispatch  When false, dispatch_job offers a job to nobody, and the
--                  founder matches by hand: in Studio, insert a job_dispatch
--                  row (job_id, captain_id, rank 1) and that captain sees
--                  the offer on his next sync and can accept it.
--   loud_ping      When false, a job ping is an ordinary high-priority
--                  notification instead of the alarm that bypasses Do Not
--                  Disturb.
--
-- Both default off, by the founder's decision: while there are ten captains
-- and a person can match every job, a machine choosing for him, or a phone
-- ringing through Do Not Disturb, is a risk with no upside yet.
--
-- Additive. An APK that predates these columns never reads them.

alter table public.app_config
  add column auto_dispatch boolean not null default false,
  add column loud_ping     boolean not null default false;

comment on column public.app_config.auto_dispatch is
  'False: dispatch_job offers nobody; the founder matches by inserting job_dispatch rows. True: the top captains are offered automatically.';
comment on column public.app_config.loud_ping is
  'False: a job ping is a normal notification. True: the full alarm channel that bypasses Do Not Disturb.';

-- Enforced in the database, not the app: an old APK calls dispatch_job on
-- every sync pass and has never heard of this switch.
--
-- Renamed and wrapped rather than re-declared, as with accept_job in 0023:
-- the body holds the limits, the confirmed-field check and the index-usable
-- search, and a copy would drift.
alter function public.dispatch_job(uuid, integer) rename to dispatch_job_offer;
revoke execute on function public.dispatch_job_offer(uuid, integer) from public, anon, authenticated;

create function public.dispatch_job(p_job_id uuid, p_limit integer default 5)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $fn$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- No row at all is treated as off: the safe reading of "nobody said".
  if not coalesce((select auto_dispatch from public.app_config), false) then
    return 0;
  end if;

  return public.dispatch_job_offer(p_job_id, p_limit);
end;
$fn$;

-- A new function in public is granted to anon automatically. The original
-- was not callable signed-out, and neither is this.
revoke execute on function public.dispatch_job(uuid, integer) from public, anon;
grant execute on function public.dispatch_job(uuid, integer) to authenticated, service_role;

comment on function public.dispatch_job(uuid, integer) is
  'Offer a searching job to the top captains, if app_config.auto_dispatch is on. Otherwise offers nobody and returns 0.';
