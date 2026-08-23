-- Jobs, dispatch and the audit trail.

create type public.job_status as enum (
  'draft', 'searching', 'accepted', 'en_route',
  'in_progress', 'completed', 'cancelled', 'expired'
);

create type public.payment_mode as enum ('cash', 'upi', 'pending');
create type public.job_window as enum ('morning', 'afternoon', 'evening', 'any');

create table public.jobs (
  id                uuid primary key default gen_random_uuid(),
  farmer_id         uuid not null references public.profiles(id) on delete restrict,
  field_id          uuid not null references public.fields(id) on delete restrict,
  service_id        uuid not null references public.services(id) on delete restrict,
  captain_id        uuid references public.captains(profile_id) on delete set null,

  -- Snapshotted at booking. If the farmer re-measures his plot next season,
  -- historical jobs and the prices charged on them must not move.
  area_sqm          double precision not null,

  status            public.job_status not null default 'draft',

  is_immediate      boolean not null default false,
  scheduled_date    date,
  scheduled_window  public.job_window not null default 'any',

  quoted_rate       numeric(10,2),
  quoted_unit       public.pricing_unit,
  quoted_subtotal   numeric(10,2),
  travel_charge     numeric(10,2) not null default 0,
  quoted_total      numeric(10,2),
  final_amount      numeric(10,2),
  payment_mode      public.payment_mode,

  queue_position    integer,
  eta               timestamptz,

  notes             text,
  start_photo_url   text,
  end_photo_url     text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  accepted_at       timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  cancelled_by      uuid references public.profiles(id) on delete set null,
  cancel_reason     text,

  constraint jobs_area_positive check (area_sqm > 0),
  constraint jobs_amounts_sane check (
    (quoted_total is null or quoted_total >= 0) and
    (final_amount is null or final_amount >= 0) and
    travel_charge >= 0
  ),
  -- A job past searching must have a captain; one before it must not.
  constraint jobs_assignment_matches_status check (
    (status in ('draft','searching','expired') and captain_id is null)
    or (status in ('accepted','en_route','in_progress','completed') and captain_id is not null)
    or (status = 'cancelled')
  ),
  constraint jobs_completed_has_time check (status <> 'completed' or completed_at is not null),
  constraint jobs_scheduled_or_immediate check (is_immediate or scheduled_date is not null)
);

create index jobs_farmer_idx on public.jobs (farmer_id, created_at desc);
create index jobs_captain_queue_idx on public.jobs (captain_id, scheduled_date, queue_position);
create index jobs_field_idx on public.jobs (field_id);

-- The hot path: everything currently in flight. Tiny compared to history.
create index jobs_active_idx on public.jobs (status, created_at)
  where status in ('searching', 'accepted', 'en_route', 'in_progress');

-- Feeds the rate guidance shown to farmers.
create index jobs_completed_rates_idx on public.jobs (service_id, completed_at desc)
  where status = 'completed' and quoted_rate is not null;

create trigger jobs_touch
  before update on public.jobs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Dispatch: one row per captain pinged.
--
-- Also the analytics backbone. Acceptance rate, time-to-accept and coverage
-- all come from this table, and those are the health metrics in the PRD.
-- ---------------------------------------------------------------------------
create type public.dispatch_response as enum ('pending', 'accepted', 'declined', 'timed_out');

create table public.job_dispatch (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs(id) on delete cascade,
  captain_id    uuid not null references public.captains(profile_id) on delete cascade,

  round         integer not null default 1,
  rank          integer not null,
  distance_km   numeric(6,2),
  match_score   numeric(6,3),

  sent_at       timestamptz not null default now(),
  responded_at  timestamptz,
  response      public.dispatch_response not null default 'pending',

  unique (job_id, captain_id),
  constraint dispatch_responded_has_time check (
    response = 'pending' or responded_at is not null
  )
);

create index job_dispatch_captain_idx on public.job_dispatch (captain_id, sent_at desc);
create index job_dispatch_pending_idx on public.job_dispatch (job_id) where response = 'pending';

-- ---------------------------------------------------------------------------
-- Audit trail. Every status change, appended, never updated.
--
-- When a farmer and a captain disagree about what happened, this is the only
-- record that settles it. Worth the write cost from day one.
-- ---------------------------------------------------------------------------
create table public.job_events (
  id          bigserial primary key,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  from_status public.job_status,
  to_status   public.job_status not null,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index job_events_job_idx on public.job_events (job_id, created_at);

create or replace function public.log_job_status_change()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.job_events (job_id, actor_id, from_status, to_status, detail)
    values (
      new.id,
      auth.uid(),
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      jsonb_build_object('captain_id', new.captain_id, 'total', new.quoted_total)
    );
  end if;
  return new;
end;
$fn$;

create trigger jobs_log_status
  after insert or update of status on public.jobs
  for each row execute function public.log_job_status_change();
