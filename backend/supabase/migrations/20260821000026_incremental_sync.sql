-- Incremental sync.
--
-- Every sync pass used to download everything: every field with its
-- boundary, every job, and for a captain every job he had ever done. Sync
-- runs each time the app comes to the front, so the cost grew all season
-- and made Supabase's 5 GB free egress the first limit we would hit
-- (docs/COSTS.md). Phones now ask only for rows changed since the newest
-- updated_at they have seen.
--
-- Two things the database must do for that to be correct:

-- 1. Make "changed since" an index seek, not a scan. Named, per the brief.
create index jobs_farmer_updated_idx  on public.jobs   (farmer_id, updated_at);
create index jobs_captain_updated_idx on public.jobs   (captain_id, updated_at)
  where captain_id is not null;
create index fields_owner_updated_idx on public.fields (owner_id, updated_at);

-- 2. Move a job's updated_at when its offers change.
--
-- The farmer's screen shows how many captains hold an offer, read from
-- job_dispatch. Offers are their own rows, so making one never touched the
-- job, and a phone asking "which jobs changed?" would never be told. His
-- screen would say "offered to nobody" all day while five captains had it.
--
-- Touching updated_at does not change status, so it writes no audit row
-- (jobs_log_status fires on status only), and the frozen-times guard leaves
-- the timestamps it protects alone.
create function public.touch_job_on_dispatch()
returns trigger
language plpgsql
-- The writer may be dispatch_job, a captain answering, or the founder in
-- Studio; a captain cannot update a job row he does not hold, so this runs
-- as the owner. It writes one column, of one row, that the change was about.
security definer
set search_path = public
as $fn$
begin
  update public.jobs set updated_at = now()
  where id = coalesce(new.job_id, old.job_id);
  return null;
end;
$fn$;

create trigger job_dispatch_touches_job
  after insert or update or delete on public.job_dispatch
  for each row execute function public.touch_job_on_dispatch();

revoke execute on function public.touch_job_on_dispatch() from public, anon, authenticated;
