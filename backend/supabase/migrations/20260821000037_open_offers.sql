-- Stage 4.8: a job for a later day is an open offer, not a 90-second ping.
--
-- A farmer booking a combine for Thursday does not need five phones ringing
-- now. He needs every eligible captain to see the job, without alarm, for as
-- long as it stands, and the first to accept to get it.
--
-- How, without a second offer system:
--   * `jobs.dispatch_mode` says which kind a job is. 'instant' for a "now"
--     job, 'open' for any other. Derived, never written, so no client (and
--     no old APK) can get it wrong.
--   * `claim_open_offers()`, called by a captain's sync pass, lists to him
--     every open job he is eligible for, as an ordinary pending job_dispatch
--     row. So his offer feed, accept_job's membership check and the first-
--     accept-wins race all work unchanged. It sends no push.
--   * notify-dispatch rings quietly for a job that is not immediate.
--
-- An open offer stands until it is taken or its day ends (expire_stale_jobs,
-- 0016, closes it then). It obeys app_config.auto_dispatch like everything
-- else: while the founder matches by hand, nobody is listed anything.

alter table public.jobs
  add column dispatch_mode text
    generated always as (case when is_immediate then 'instant' else 'open' end) stored;

comment on column public.jobs.dispatch_mode is
  'instant: a "now" job, offered to the top captains with a ping. open: a job for later, listed quietly to every eligible captain until taken or lapsed.';

-- When the work starts. The same mapping dispatch_job_offer (0019) uses
-- inline; that body is left alone rather than re-declared to call this.
create function public.job_starts_at(j public.jobs)
returns timestamptz
language sql
stable
set search_path = public
as $fn$
  select case
    when j.is_immediate or j.scheduled_date is null then now()
    else ((j.scheduled_date
           + (case j.scheduled_window
                when 'morning'   then time '07:00'
                when 'afternoon' then time '12:00'
                when 'evening'   then time '16:00'
                else                  time '07:00'
              end)) at time zone 'Asia/Kolkata')
  end;
$fn$;

-- ---------------------------------------------------------------------------
-- List open jobs to the calling captain
--
-- Only ever writes rows for the caller, only for jobs eligible_captains
-- (base, live location or route stop on the day, service, size floor, lead
-- time) says he can do, and never more than once per job: a declined offer
-- stays declined. The same guards as dispatch_job: a confirmed field, and a
-- farmer with more than five requests open is a runaway loop, listed to
-- nobody.
--
-- ponytail: one eligible_captains call per open job he has not yet seen.
-- Fine for a district's dozens; at thousands, prefilter jobs by distance to
-- his location and stops before the loop.
-- ---------------------------------------------------------------------------
create function public.claim_open_offers()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  me     uuid := auth.uid();
  j      public.jobs;
  e      record;
  added  integer;
  listed integer := 0;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not coalesce((select auto_dispatch from public.app_config), false) then
    return 0;
  end if;

  for j in
    select jb.*
    from public.jobs jb
    join public.fields f on f.id = jb.field_id
    where jb.status = 'searching'
      and jb.dispatch_mode = 'open'
      and f.confirmed_by_owner
      and jb.farmer_id <> me
      and not exists (
        select 1 from public.job_dispatch d where d.job_id = jb.id and d.captain_id = me
      )
      and (select count(*) from public.jobs o
           where o.farmer_id = jb.farmer_id and o.status = 'searching') <= 5
  loop
    select x.distance_km, x.match_score into e
    from public.eligible_captains(j.field_id, j.service_id, public.job_starts_at(j), 1000) x
    where x.captain_id = me;

    if found then
      insert into public.job_dispatch (job_id, captain_id, rank, distance_km, match_score)
      values (j.id, me, 1, e.distance_km, e.match_score)
      on conflict (job_id, captain_id) do nothing;
      get diagnostics added = row_count;
      listed := listed + added;
    end if;
  end loop;

  return listed;
end;
$fn$;

revoke execute on function public.claim_open_offers() from public, anon;
grant execute on function public.claim_open_offers() to authenticated, service_role;

comment on function public.claim_open_offers() is
  'List every open (later-day) job the calling captain is eligible for as a pending offer. Quiet, idempotent, obeys auto_dispatch.';
