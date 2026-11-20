-- Stage 4.6: a job runs on a specific machine.
--
-- A captain with two combines is two queues, not one. Without this his
-- second combine stood idle in the numbers: every job counted against "him",
-- so dispatch ranked him as busy while half his capacity waited.

alter table public.jobs
  add column machine_id uuid references public.captain_machines(id)
    on delete set null;

comment on column public.jobs.machine_id is
  'The captain''s machine this job runs on. Set by the server when a captain takes the job.';

create index jobs_machine_active_idx on public.jobs (machine_id)
  where status in ('accepted', 'en_route', 'in_progress');

-- His least-busy active machine for this work; owned before arranged, then
-- oldest. Null when he has none of the right type (a founder can assign a
-- captain whose registry is incomplete).
create function public.pick_machine(p_captain uuid, p_service uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select cm.id
  from public.captain_machines cm
  join public.services s on s.id = p_service and s.machine_type_id = cm.machine_type_id
  where cm.captain_id = p_captain and cm.is_active
  order by (select count(*) from public.jobs j
            where j.machine_id = cm.id
              and j.status in ('accepted', 'en_route', 'in_progress')),
           (cm.ownership = 'owned') desc, cm.created_at, cm.id
  limit 1;
$fn$;

revoke execute on function public.pick_machine(uuid, uuid) from public, anon, authenticated;

-- One trigger, so every way a job gets a captain picks a machine: accept,
-- founder_assign, and whatever comes later (4.3). The phone never decides
-- it unchecked: a machine that is not this captain's, of this work's type,
-- is refused.
create function public.set_job_machine()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  valid boolean;
begin
  if new.captain_id is null then
    new.machine_id := null;
    return new;
  end if;

  valid := new.machine_id is not null and exists (
    select 1 from public.captain_machines cm
    join public.services s on s.id = new.service_id and s.machine_type_id = cm.machine_type_id
    where cm.id = new.machine_id and cm.captain_id = new.captain_id
  );

  if tg_op = 'INSERT' or new.captain_id is distinct from old.captain_id then
    if not valid then
      new.machine_id := public.pick_machine(new.captain_id, new.service_id);
    end if;
  elsif new.machine_id is not null and not valid then
    raise exception 'not one of this captain''s machines for this work' using errcode = '23514';
  end if;
  return new;
end;
$fn$;

create trigger jobs_set_machine
  before insert or update of captain_id, machine_id on public.jobs
  for each row execute function public.set_job_machine();

-- Jobs already under way get their machine now.
update public.jobs
set machine_id = public.pick_machine(captain_id, service_id)
where captain_id is not null
  and status in ('accepted', 'en_route', 'in_progress');

-- eligible_captains as in 0033, with queue_load changed (marked): the load
-- of his least-busy machine for this work, not every job he holds. Jobs
-- with no machine (assigned to a captain with none of this type) still
-- count against him.
create or replace function public.eligible_captains(
  p_field_id     uuid,
  p_service_id   uuid,
  p_starts_at    timestamptz default now(),
  p_limit        integer default 5
)
returns table (
  captain_id   uuid,
  distance_km  numeric,
  rating_avg   numeric,
  queue_load   integer,
  match_score  numeric
)
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  with field as (
    select centroid, area_sqm from public.fields where id = p_field_id
  ),
  lead_hours as (
    select greatest(0, extract(epoch from (p_starts_at - now())) / 3600)::numeric as available
  ),
  candidates as (
    select
      c.profile_id,
      public.road_km(c.current_location, f.centroid) as km,
      c.rating_avg,
      -- 4.6: per machine.
      (
        coalesce((
          select min(per_machine.n)
          from (
            select count(j.id)::integer as n
            from public.captain_machines cm2
            join public.services s2
              on s2.id = p_service_id and s2.machine_type_id = cm2.machine_type_id
            left join public.jobs j
              on j.machine_id = cm2.id
             and j.status in ('accepted', 'en_route', 'in_progress')
            where cm2.captain_id = c.profile_id and cm2.is_active
            group by cm2.id
          ) per_machine
        ), 0)
        + (
          select count(*)::integer
          from public.jobs j
          where j.captain_id = c.profile_id
            and j.machine_id is null
            and j.status in ('accepted', 'en_route', 'in_progress')
        )
      ) as queue_load,
      (
        select count(*) filter (where d.response = 'accepted')::numeric
             / nullif(count(*) filter (
                 where d.response in ('accepted', 'declined', 'timed_out')
               ), 0)
        from public.job_dispatch d
        where d.captain_id = c.profile_id
      ) as accept_rate
    from public.captains c
    cross join field f
    cross join lead_hours l
    where c.is_online
      and c.verification = 'verified'
      and c.current_location is not null
      and extensions.st_dwithin(c.current_location, f.centroid, 200000)
      and extensions.st_dwithin(
            c.current_location, f.centroid, c.service_radius_km * 1000
          )
      and exists (
        select 1
        from public.captain_services cs
        join public.services s on s.id = cs.service_id
        join public.captain_machines cm
          on cm.captain_id = c.profile_id
         and cm.machine_type_id = s.machine_type_id
         and cm.is_active
        where cs.captain_id = c.profile_id
          and cs.service_id = p_service_id
          and cs.is_active
          and (cm.ownership = 'owned' or cm.lead_time_hours <= l.available)
          and (cs.min_area_sqm is null or cs.min_area_sqm <= f.area_sqm)
      )
  )
  select
    profile_id,
    km,
    rating_avg,
    queue_load,
    round((
        (1 - least(km, 50) / 50) * 0.40
      + (coalesce(rating_avg, 3.5) / 5)  * 0.30
      + (1 - least(queue_load, 8)::numeric / 8) * 0.20
      + coalesce(accept_rate, 0.5) * 0.10
    )::numeric, 3) as match_score
  from candidates
  order by match_score desc, km asc
  limit p_limit;
$fn$;
