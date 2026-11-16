-- What stops one farmer ringing every phone in the district.
--
-- dispatch_job checked two things: that the caller is the farmer who posted
-- the job, and that the job is still searching. Nothing else. Since it is
-- called on every sync pass and since a successful offer sends a push, a
-- loop posting jobs is a loop ringing every eligible captain — and the
-- captains cannot tell it from real demand.
--
-- Three guards, each answering a different question.

-- ---------------------------------------------------------------------------
-- 1 · The field has to be one the farmer stood on and confirmed
--
-- `confirmed_by_owner` is set when he taps Confirm on the screen showing him
-- his own area with draggable corners, and the geometry trigger clears it
-- again the moment a boundary changes. So requiring it here means: a field
-- whose shape was edited cannot be dispatched until he has looked at the new
-- area and accepted it.
--
-- That matters because the area is the price. Re-drawing a field larger and
-- immediately posting work on it is the cheapest version of the attack that
-- migration 17 closed from the other side.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 2 · A ceiling on how many requests can be open at once
-- 3 · And on how fast they can be created
--
-- ⚠️ Both numbers are mine, not yours, and are worth a minute of your time.
-- Five open requests is more than any farmer in Fazilka has fields in one
-- harvest; twenty an hour is far beyond hand-typing. They are set to catch a
-- runaway loop or a bored captain's cousin, not to ration real use. If a
-- commission agent books for ten farmers from one handset, five is wrong.
-- ---------------------------------------------------------------------------
create or replace function public.dispatch_job(
  p_job_id uuid,
  p_limit   integer default 5
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  me      uuid := auth.uid();
  j       public.jobs;
  fld     public.fields;
  starts  timestamptz;
  rnd     integer;
  offered integer;
  open_jobs integer;
  recent    integer;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into j from public.jobs where id = p_job_id;
  if j.id is null then
    raise exception 'no such job' using errcode = 'P0002';
  end if;
  if j.farmer_id <> me then
    raise exception 'only the farmer who posted the job can dispatch it'
      using errcode = '42501';
  end if;
  if j.status <> 'searching' then
    raise exception 'job is not searching' using errcode = '55006';
  end if;

  select * into fld from public.fields where id = j.field_id;
  if not fld.confirmed_by_owner then
    raise exception 'the field has not been confirmed by its owner'
      using errcode = '55006';
  end if;

  -- Counted excluding this job, so the cap is on what is open *besides* the
  -- one being offered.
  select count(*)::integer into open_jobs
  from public.jobs
  where farmer_id = me and status = 'searching' and id <> p_job_id;

  if open_jobs >= 5 then
    raise exception 'too many requests open at once'
      using errcode = '54000';
  end if;

  select count(*)::integer into recent
  from public.jobs
  where farmer_id = me and created_at > now() - interval '1 hour';

  if recent > 20 then
    raise exception 'too many requests in one hour'
      using errcode = '54000';
  end if;

  -- When the work starts, for the arrangeable-lead-time filter inside
  -- eligible_captains: a captain who needs a day to borrow his cousin's
  -- rotavator must not be pinged for work starting in an hour.
  --
  -- The window-to-hour mapping is an approximation in UTC (morning = 07:00);
  -- for a lead-time filter measured in hours that is close enough, the same
  -- spirit as road distance being straight-line x 1.3.
  starts := case
    when j.is_immediate then now()
    else ((j.scheduled_date
           + (case j.scheduled_window
                when 'morning'   then time '07:00'
                when 'afternoon' then time '12:00'
                when 'evening'   then time '16:00'
                else                  time '07:00'
              end)) at time zone 'Asia/Kolkata')
  end;

  -- Re-dispatching (nobody answered round one) is a new round, never a
  -- duplicate offer: the unique (job_id, captain_id) keeps a captain from
  -- being pinged twice for the same job.
  select coalesce(max(round), 0) + 1 into rnd
  from public.job_dispatch
  where job_id = p_job_id;

  insert into public.job_dispatch (job_id, captain_id, round, rank, distance_km, match_score)
  select
    p_job_id,
    e.captain_id,
    rnd,
    row_number() over (order by e.match_score desc, e.distance_km asc),
    e.distance_km,
    e.match_score
  from public.eligible_captains(j.field_id, j.service_id, starts, p_limit) e
  on conflict (job_id, captain_id) do nothing;

  get diagnostics offered = row_count;
  return offered;
end;
$fn$;

comment on function public.dispatch_job is
  'Offer a searching job to the top captains. Requires a confirmed field and refuses a farmer with too many open or too many recent requests.';
