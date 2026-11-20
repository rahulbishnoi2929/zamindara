-- Brief 2.5: an accept must be safe to send twice.
--
-- On a bad signal the phone retries an accept until the offer ends. The
-- dangerous case is the one where the first attempt *worked* and only the
-- reply was lost: the retry found the job no longer 'searching' and raised
-- 55006, and the phone told the captain "another captain took this job" —
-- about a job that was his. He goes home; the farmer waits for nobody.
--
-- So a repeat accept by the captain who holds the job returns the job, and
-- writes nothing: no second accepted_at, no second audit row, no re-pricing.
--
-- The original function is renamed and kept, not rewritten. Its body holds
-- the race guard, the pricing and two hard-won fixes, and copying eighty
-- lines into a new migration is how a copy drifts from the original.

alter function public.accept_job(uuid) rename to accept_job_claim;

-- Only reachable through accept_job below. Postgres grants EXECUTE to PUBLIC
-- by default, so the inner function must be closed explicitly.
revoke execute on function public.accept_job_claim(uuid) from public, anon, authenticated;

create function public.accept_job(p_job_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  mine public.jobs;
begin
  select * into mine
  from public.jobs
  where id = p_job_id and captain_id = auth.uid() and auth.uid() is not null;

  if mine.id is not null then
    return mine;
  end if;

  return public.accept_job_claim(p_job_id);
end;
$fn$;

comment on function public.accept_job(uuid) is
  'Captain accepts an offered job. Idempotent for the captain who already holds it, so a retry after a lost reply is not reported as a lost race.';
