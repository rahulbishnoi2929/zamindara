-- Jobs that have had their day.
--
-- `expired` has been in the job_status enum since the first migration. The
-- constraint permits it, the transition guard allows searching -> expired,
-- and the app knows to ignore it. **Nothing ever set it.**
--
-- So a farmer asks for a combine tomorrow morning, nobody takes it, and
-- tomorrow comes and goes. The job stays `searching` forever. And since
-- re-dispatch now runs on every sync pass, that dead job keeps being
-- offered — which since remote push means it keeps **ringing captains'
-- phones about work from last week.**
--
-- By late November the pool would be full of them, every captain's phone
-- going off for harvests already done. That is the exact failure cancel_job
-- was built to prevent, except a farmer only cancels if he remembers to.
-- A request for a day that has ended should lapse by itself.
--
-- The rule is one line and explainable to a farmer: **a request stands for
-- the day it was wanted, and no longer.** For a scheduled job that is
-- `scheduled_date`; for an immediate one, the day it was posted. Nobody
-- wants yesterday's harvest request filled today without being asked again.

-- ---------------------------------------------------------------------------
-- When the request stops standing. IST, like the rest of dispatch.
-- ---------------------------------------------------------------------------
create or replace function public.job_lapses_at(j public.jobs)
returns timestamptz
language sql
-- Stable, not immutable: a timezone conversion depends on tz rules, which
-- are data and can change under us.
stable
set search_path = public
as $fn$
  select (
    (case
       when j.is_immediate or j.scheduled_date is null
         then ((j.created_at at time zone 'Asia/Kolkata')::date)
       else j.scheduled_date
     end + 1)::timestamp at time zone 'Asia/Kolkata'
  );
$fn$;

comment on function public.job_lapses_at is
  'Midnight IST after the day a job was wanted. A request stands for that day only.';

-- ---------------------------------------------------------------------------
-- Expire everything whose day has ended
--
-- Callable by any signed-in user, which looks surprising for something that
-- writes other people's rows — so, deliberately:
--
--   * it can only move searching -> expired, and only for jobs whose wanted
--     day is already over. The clock decides, never the caller.
--   * no caller can name a job, choose one, or expire one early.
--   * it is idempotent: the second call finds nothing.
--
-- That makes any client's sync pass keep the pool clean, which needs no
-- scheduler, no extension and no server of our own. The farmer's app clears
-- his lapsed requests; a captain's app clears whatever his did not.
--
-- ponytail: pg_cron would be the textbook home for this. It needs enabling
-- and scheduling, and a job that expires when someone next looks is good
-- enough — move it there if the table ever grows past a district.
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_jobs()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  lapsed integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  with gone as (
    update public.jobs j
    set status = 'expired'
    where j.status = 'searching'
      and now() >= public.job_lapses_at(j)
    returning j.id
  )
  select count(*)::integer into lapsed from gone;

  -- Close the offers with them. A pending row on a job nobody can take any
  -- more is what a captain still sees in his feed — the stale ping, which is
  -- the whole reason for this function.
  update public.job_dispatch d
  set response = 'timed_out', responded_at = now()
  where d.response = 'pending'
    and exists (
      select 1 from public.jobs j
      where j.id = d.job_id and j.status = 'expired'
    );

  return lapsed;
end;
$fn$;

comment on function public.expire_stale_jobs is
  'Lapse searching jobs whose wanted day has ended, and close their open offers. Time-based and idempotent, so any client may call it.';

-- The expiry sweep looks for searching jobs only; the existing
-- jobs_active_idx already covers that predicate.
