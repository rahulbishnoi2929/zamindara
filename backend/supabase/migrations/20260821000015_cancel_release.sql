-- Getting out of a job.
--
-- Until now there was no way out of one. A farmer who posted by mistake, or
-- whose crop turned out not to be ready, had no way to withdraw: the job sat
-- in 'searching' and was re-offered to captains on every sync pass, ringing
-- them about work that did not exist. That is the fastest way to teach a
-- captain to ignore the ping, which is the one thing that has to work in
-- April. And a captain whose combine broke after accepting could not hand
-- the job back, so the farmer waited on a machine that was never coming and
-- the job could never reach anyone else.
--
-- Two different events, deliberately two functions:
--
--   cancel_job   the farmer no longer wants the work done
--   release_job  the captain cannot do it, but the farmer still wants it
--
-- Collapsing them into one would have been shorter and wrong. A captain's
-- breakdown is not the farmer's cancellation: the job should go back on the
-- market, not die.
--
-- Neither is allowed once the work is 'in_progress'. At that point a machine
-- is in the field and fuel has been burned; what is being asked for then is
-- a settlement, not a cancellation, and a button cannot decide it. v1 says
-- so plainly and leaves it to a phone call — which is the season's stated
-- plan for disputes anyway.
--
-- No reason text is collected. The founder is shadowing every job this
-- season and will hear the reason by phone; a free-text box in a field, in
-- the sun, would collect nothing worth reading. The column stays for when
-- that changes.

-- ---------------------------------------------------------------------------
-- The farmer withdraws
-- ---------------------------------------------------------------------------
create or replace function public.cancel_job(
  p_job_id uuid,
  p_reason text default null
)
returns public.jobs
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  me        uuid := auth.uid();
  cancelled public.jobs;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.jobs
  set status        = 'cancelled',
      cancelled_at  = now(),
      cancelled_by  = me,
      cancel_reason = p_reason
  where id = p_job_id
    and farmer_id = me
    -- captain_id is deliberately left as it is. If someone was already on
    -- his way, the record should keep saying who was stood up.
    and status in ('searching', 'accepted', 'en_route')
  returning * into cancelled;

  if cancelled.id is null then
    -- One message cannot serve both cases: "not yours" and "too late" need
    -- different things from the person reading them.
    if not exists (select 1 from public.jobs where id = p_job_id and farmer_id = me) then
      raise exception 'only the farmer who posted the job can cancel it'
        using errcode = '42501';
    end if;
    raise exception 'the work has already started'
      using errcode = '55006';
  end if;

  -- Close the open offers, or captains keep seeing a job that no longer
  -- exists — and a re-dispatch would keep ringing them about it.
  update public.job_dispatch
  set response = 'timed_out', responded_at = now()
  where job_id = p_job_id and response = 'pending';

  return cancelled;
end;
$fn$;

comment on function public.cancel_job is
  'The farmer withdraws a job before work starts. Closes any open offers.';

-- ---------------------------------------------------------------------------
-- The captain hands it back
-- ---------------------------------------------------------------------------
create or replace function public.release_job(
  p_job_id uuid,
  p_reason text default null
)
returns public.jobs
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  me       uuid := auth.uid();
  released public.jobs;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Back on the market, not dead. jobs_assignment_matches_status requires a
  -- searching job to have no captain, which is exactly the right shape here.
  update public.jobs
  set status      = 'searching',
      captain_id  = null,
      accepted_at = null
  where id = p_job_id
    and captain_id = me
    and status in ('accepted', 'en_route')
  returning * into released;

  if released.id is null then
    if not exists (select 1 from public.jobs where id = p_job_id and captain_id = me) then
      raise exception 'this job is not yours to release' using errcode = '42501';
    end if;
    raise exception 'the work has already started' using errcode = '55006';
  end if;

  -- 'declined' rather than deleting the row: he was asked and he said no.
  -- The unique (job_id, captain_id) then keeps dispatch_job from offering
  -- him the same job again, and his accept rate drops, which is honest —
  -- a captain who accepts and hands back is worse for a farmer than one who
  -- never accepted.
  update public.job_dispatch
  set response = 'declined', responded_at = now()
  where job_id = p_job_id and captain_id = me;

  return released;
end;
$fn$;

comment on function public.release_job is
  'The assigned captain hands a job back before starting. Returns it to searching so it can reach someone else.';

-- ---------------------------------------------------------------------------
-- The guard belongs on the table, not only in the functions
--
-- jobs_update_party lets a farmer or his captain write any column on their
-- own job, status included. So both guards above were advisory: a client
-- that set `status = 'cancelled'` directly on a job already being cut would
-- sail straight past cancel_job and past the "settlement, not a button"
-- rule. The app wouldn't, but "the app wouldn't" is not a guarantee, and the
-- rest of this schema puts its guarantees in the database.
--
-- Forward moves stay permissive on purpose, including accepted -> completed:
-- a captain who drives out, cuts, and only then touches his phone never
-- tapped "on my way", and refusing his completion would be the app arguing
-- with what actually happened. What is refused is a job going *backwards*
-- without being released, and work being cancelled after it started.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_job_transition()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    case old.status
      when 'draft'       then new.status in ('searching', 'cancelled', 'expired')
      when 'searching'   then new.status in ('accepted', 'cancelled', 'expired')
      -- 'searching' here is release_job handing the job back to the market.
      when 'accepted'    then new.status in ('en_route', 'in_progress', 'completed',
                                             'searching', 'cancelled')
      when 'en_route'    then new.status in ('in_progress', 'completed',
                                             'searching', 'cancelled')
      when 'in_progress' then new.status in ('completed')
      -- completed, cancelled and expired are the end of the story.
      else false
    end
  ) then
    raise exception 'a job cannot go from % to %', old.status, new.status
      using errcode = '55006';
  end if;

  return new;
end;
$fn$;

create trigger jobs_transition_guard
  before update of status on public.jobs
  for each row execute function public.enforce_job_transition();

comment on function public.enforce_job_transition is
  'Legal job status moves. Enforced on the table because jobs_update_party lets a party write status directly.';
