-- Offering a job to captains.
--
-- The client cannot write job_dispatch itself: who gets offered work is not
-- the farmer's phone's decision to make, and RLS has no insert policy for it.
-- Until the edge function exists (its job is the push broadcast, not the
-- offer), this function is the offer. The farmer's phone calls it right after
-- inserting the job; the captain's phones see the rows and call accept_job.

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
  starts  timestamptz;
  rnd     integer;
  offered integer;
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

revoke execute on function public.dispatch_job(uuid, integer) from public, anon;
grant execute on function public.dispatch_job(uuid, integer) to authenticated;
