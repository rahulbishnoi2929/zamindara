-- Regions and their land-measurement vocabulary.
--
-- A region owns its unit set. This is what makes expansion a row insert
-- rather than a migration: bigha means four different sizes in four states,
-- and an app that hard-coded one would silently mis-bill on the day it
-- crossed a border. See docs/UNITS_AND_MEASUREMENT.md.

create table public.regions (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  state             text not null,
  country           text not null default 'IN',

  -- Units this region actually uses, largest last.
  unit_set          text[] not null default '{marla,kanal,bigha,killa}',
  default_chain     text not null default 'killa',
  languages         text[] not null default '{pa,hi,en}',

  -- Travel charge starts beyond this distance.
  free_travel_km    numeric(5,2) not null default 5,

  boundary          geography(MultiPolygon, 4326),
  is_live           boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint regions_default_chain_valid
    check (default_chain = any(unit_set)),
  constraint regions_free_travel_sane
    check (free_travel_km >= 0 and free_travel_km <= 100)
);

create index regions_boundary_idx on public.regions using gist (boundary);
create index regions_live_idx on public.regions (is_live) where is_live;

comment on column public.regions.unit_set is
  'Units this region uses. Adding a region with bigha/biswa needs no schema change.';
