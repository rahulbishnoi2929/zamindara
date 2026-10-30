-- Machinery catalogue and the work each machine can do.
--
-- Drawn from the Fazilka cotton–wheat–kinnow rotation, not a generic list.
-- The straw reaper and the orchard sprayer are deliberate: the toori cut
-- behind every combine is a real second market, and kinnow spraying is what
-- keeps captains earning in December.

create type public.machine_category as enum (
  'tillage', 'sowing', 'harvesting', 'spraying', 'haulage', 'earthmoving'
);

create type public.pricing_unit as enum ('per_killa', 'per_hour', 'per_day', 'per_job');

create table public.machine_types (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  name_en             text not null,
  name_pa             text not null,
  name_hi             text not null,
  category            public.machine_category not null,
  needs_tractor       boolean not null default true,
  icon_url            text,

  -- Repositioning a self-propelled combine costs more than towing an
  -- implement, so the travel rate is per machine class.
  travel_rate_per_km  numeric(8,2) not null default 40,

  sort_order          integer not null default 0,
  is_active           boolean not null default true,

  constraint machine_travel_rate_sane check (travel_rate_per_km >= 0)
);

create index machine_types_category_idx on public.machine_types (category, sort_order);

create table public.services (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,
  name_en               text not null,
  name_pa               text not null,
  name_hi               text not null,
  machine_type_id       uuid not null references public.machine_types(id) on delete restrict,

  default_unit          public.pricing_unit not null default 'per_killa',
  est_minutes_per_killa integer,

  -- Drives the seasonal reordering of the farmer's job grid: harvesting first
  -- in April, sowing in November, orchard spraying in January.
  season_months         integer[] not null default '{}',

  icon_url              text,
  is_active             boolean not null default true,
  sort_order            integer not null default 0,

  constraint services_minutes_sane check (est_minutes_per_killa is null or est_minutes_per_killa > 0),
  constraint services_months_valid check (
    season_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]
  )
);

create index services_machine_idx on public.services (machine_type_id);
