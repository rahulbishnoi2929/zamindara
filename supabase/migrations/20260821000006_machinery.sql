-- What each captain actually has, and what he charges for it.

-- The owned / arrangeable split is the product's key insight about rural
-- machinery: access runs through relationships, not ownership. A captain who
-- owns a tractor but borrows a rotavator from his cousin is a perfectly good
-- captain for a rotavator job — he just needs notice.
create type public.ownership_type as enum ('owned', 'arrangeable');

create table public.captain_machines (
  id                  uuid primary key default gen_random_uuid(),
  captain_id          uuid not null references public.captains(profile_id) on delete cascade,
  machine_type_id     uuid not null references public.machine_types(id) on delete restrict,

  ownership           public.ownership_type not null default 'owned',
  lead_time_hours     integer not null default 0,

  make                text,
  model               text,
  year                integer,
  capacity            text,
  photo_url           text,

  -- Balwinder's constraint: he will lend the machine, but he comes with it.
  with_operator_only  boolean not null default false,

  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint machines_lead_time_sane check (lead_time_hours >= 0 and lead_time_hours <= 336),
  constraint machines_owned_is_immediate check (ownership <> 'owned' or lead_time_hours = 0),
  constraint machines_year_sane check (year is null or (year >= 1950 and year <= 2100))
);

create index captain_machines_captain_idx on public.captain_machines (captain_id) where is_active;
create index captain_machines_type_idx on public.captain_machines (machine_type_id) where is_active;

create trigger captain_machines_touch
  before update on public.captain_machines
  for each row execute function public.touch_updated_at();

-- Rates are stored as amount + unit, never a bare number. "1100" means
-- 1100 per killa, and the unit is part of the data.
create table public.captain_services (
  captain_id  uuid not null references public.captains(profile_id) on delete cascade,
  service_id  uuid not null references public.services(id) on delete cascade,

  rate        numeric(10,2),
  rate_unit   public.pricing_unit not null,
  is_active   boolean not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (captain_id, service_id),
  constraint captain_services_rate_sane check (rate is null or rate > 0)
);

create index captain_services_service_idx on public.captain_services (service_id) where is_active;

create trigger captain_services_touch
  before update on public.captain_services
  for each row execute function public.touch_updated_at();

comment on column public.captain_services.rate is
  'Null means negotiable. The app shows a range from recent nearby jobs instead.';
