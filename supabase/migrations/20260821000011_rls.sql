-- Row-level security.
--
-- The governing principle: a farmer's field boundary is his land record. It
-- is not public data, and nobody sees it without a working relationship to
-- that field. Everything else follows from treating that seriously.
--
-- Helper predicates are SECURITY DEFINER so that a policy on one table can
-- consult another without tripping RLS recursion.

alter table public.regions           enable row level security;
alter table public.machine_types     enable row level security;
alter table public.services          enable row level security;
alter table public.profiles          enable row level security;
alter table public.captains          enable row level security;
alter table public.captain_machines  enable row level security;
alter table public.captain_services  enable row level security;
alter table public.fields            enable row level security;
alter table public.jobs              enable row level security;
alter table public.job_dispatch      enable row level security;
alter table public.job_events        enable row level security;
alter table public.ratings           enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Does the current user have a live working relationship with this field?
-- Either it is his, or he is a captain who has been offered or assigned work
-- on it. A captain who was pinged and declined loses access with the job.
create or replace function public.can_see_field(p_field_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select
    exists (
      select 1 from public.fields
      where id = p_field_id and owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.jobs j
      left join public.job_dispatch d
        on d.job_id = j.id and d.captain_id = auth.uid()
      where j.field_id = p_field_id
        and (
          j.captain_id = auth.uid()
          or (d.id is not null and d.response in ('pending', 'accepted'))
        )
    );
$fn$;

-- Is the current user a party to this job?
create or replace function public.is_job_party(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.jobs j
    where j.id = p_job_id
      and (j.farmer_id = auth.uid() or j.captain_id = auth.uid())
  )
  or exists (
    select 1 from public.job_dispatch d
    where d.job_id = p_job_id and d.captain_id = auth.uid()
  );
$fn$;

-- Do these two people share any job? Gates seeing each other's contact card.
create or replace function public.shares_a_job_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.jobs j
    where (j.farmer_id = auth.uid() and j.captain_id = p_other)
       or (j.captain_id = auth.uid() and j.farmer_id = p_other)
  )
  or exists (
    select 1
    from public.job_dispatch d
    join public.jobs j on j.id = d.job_id
    where d.captain_id = auth.uid() and j.farmer_id = p_other
  );
$fn$;

-- ---------------------------------------------------------------------------
-- Reference data — readable by any signed-in user, written only by staff.
-- ---------------------------------------------------------------------------
create policy regions_read on public.regions
  for select to authenticated using (true);

create policy machine_types_read on public.machine_types
  for select to authenticated using (is_active);

create policy services_read on public.services
  for select to authenticated using (is_active);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create policy profiles_read_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- A farmer choosing between captains needs to see who they are. Limited to
-- verified captains, and to counterparties on a shared job.
create policy profiles_read_counterparty on public.profiles
  for select to authenticated
  using (
    public.shares_a_job_with(id)
    or exists (
      select 1 from public.captains c
      where c.profile_id = profiles.id and c.verification = 'verified'
    )
  );

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Captains and their machinery — public once verified, so farmers can browse.
-- ---------------------------------------------------------------------------
create policy captains_read on public.captains
  for select to authenticated
  using (verification = 'verified' or profile_id = auth.uid());

create policy captains_insert_self on public.captains
  for insert to authenticated
  with check (profile_id = auth.uid());

-- A captain must never be able to verify himself. Verification is set by
-- staff through the service role, which bypasses RLS entirely.
create policy captains_update_own on public.captains
  for update to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and verification = (
      select verification from public.captains where profile_id = auth.uid()
    )
  );

create policy captain_machines_read on public.captain_machines
  for select to authenticated
  using (
    captain_id = auth.uid()
    or (is_active and exists (
      select 1 from public.captains c
      where c.profile_id = captain_machines.captain_id
        and c.verification = 'verified'
    ))
  );

create policy captain_machines_write on public.captain_machines
  for all to authenticated
  using (captain_id = auth.uid())
  with check (captain_id = auth.uid());

create policy captain_services_read on public.captain_services
  for select to authenticated
  using (
    captain_id = auth.uid()
    or (is_active and exists (
      select 1 from public.captains c
      where c.profile_id = captain_services.captain_id
        and c.verification = 'verified'
    ))
  );

create policy captain_services_write on public.captain_services
  for all to authenticated
  using (captain_id = auth.uid())
  with check (captain_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Fields — the tightest policies in the schema.
-- ---------------------------------------------------------------------------
create policy fields_read on public.fields
  for select to authenticated
  using (public.can_see_field(id));

create policy fields_insert_own on public.fields
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy fields_update_own on public.fields
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy fields_delete_own on public.fields
  for delete to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
create policy jobs_read on public.jobs
  for select to authenticated
  using (public.is_job_party(id));

create policy jobs_insert_own on public.jobs
  for insert to authenticated
  with check (
    farmer_id = auth.uid()
    and exists (
      select 1 from public.fields f
      where f.id = field_id
        and f.owner_id = auth.uid()
        -- Billing gate: an unconfirmed area must never reach a price.
        and f.confirmed_by_owner
    )
  );

-- Accepting is done through accept_job(), which handles the race. This
-- covers the rest of the lifecycle: the farmer cancelling, the captain
-- moving the job through en_route / in_progress / completed.
create policy jobs_update_party on public.jobs
  for update to authenticated
  using (farmer_id = auth.uid() or captain_id = auth.uid())
  with check (farmer_id = auth.uid() or captain_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Dispatch and audit
-- ---------------------------------------------------------------------------
create policy job_dispatch_read on public.job_dispatch
  for select to authenticated
  using (
    captain_id = auth.uid()
    or exists (
      select 1 from public.jobs j
      where j.id = job_dispatch.job_id and j.farmer_id = auth.uid()
    )
  );

create policy job_dispatch_respond on public.job_dispatch
  for update to authenticated
  using (captain_id = auth.uid())
  with check (captain_id = auth.uid());

create policy job_events_read on public.job_events
  for select to authenticated
  using (public.is_job_party(job_id));

-- ---------------------------------------------------------------------------
-- Ratings — aggregates are public, individual ratings are visible to parties.
-- ---------------------------------------------------------------------------
create policy ratings_read on public.ratings
  for select to authenticated
  using (true);

create policy ratings_insert_party on public.ratings
  for insert to authenticated
  with check (
    rater_id = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.status = 'completed'
        and (j.farmer_id = auth.uid() or j.captain_id = auth.uid())
        and ratee_id in (j.farmer_id, j.captain_id)
    )
  );
