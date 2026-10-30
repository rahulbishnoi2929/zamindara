-- People.
--
-- The phone number is the identity. Farmers here have no email address, so
-- there is no email column and no password anywhere in this schema.

create type public.user_role as enum ('farmer', 'captain', 'both');
create type public.verification_status as enum ('pending', 'verified', 'rejected', 'suspended');

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  phone         text not null unique,
  full_name     text not null,
  photo_url     text,

  role          public.user_role not null default 'farmer',
  village       text,
  region_id     uuid references public.regions(id) on delete restrict,

  language      text not null default 'pa',
  display_chain text not null default 'killa',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profiles_phone_format check (phone ~ '^[0-9]{10,15}$'),
  constraint profiles_name_present check (length(btrim(full_name)) > 0),
  constraint profiles_language_supported check (language in ('pa','hi','en')),
  constraint profiles_chain_supported check (display_chain in ('killa','bigha'))
);

create index profiles_region_idx on public.profiles (region_id);
create index profiles_name_trgm_idx on public.profiles using gin (full_name extensions.gin_trgm_ops);

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

comment on column public.profiles.role is
  'A farmer with an idle tractor is supply too. "both" is first class and must never be forced to one side.';

-- Captains — the supply side.
create table public.captains (
  profile_id          uuid primary key references public.profiles(id) on delete cascade,

  verification        public.verification_status not null default 'pending',
  verified_by         uuid references public.profiles(id) on delete set null,
  verified_at         timestamptz,

  base_location       geography(Point, 4326) not null,
  service_radius_km   numeric(5,2) not null default 15,

  is_online           boolean not null default false,
  current_location    geography(Point, 4326),
  location_updated_at timestamptz,

  -- Migrant mode. The flagship feature: an operator arriving from Ganganagar
  -- goes live and every farmer in radius sees him within a minute.
  is_travelling       boolean not null default false,
  travel_until        date,
  planned_route       text[],

  rating_avg          numeric(3,2),
  rating_count        integer not null default 0,
  jobs_completed      integer not null default 0,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint captains_radius_sane check (service_radius_km > 0 and service_radius_km <= 200),
  constraint captains_rating_range check (rating_avg is null or (rating_avg >= 1 and rating_avg <= 5)),
  constraint captains_verified_has_actor check (
    (verification <> 'verified') or (verified_by is not null and verified_at is not null)
  ),
  constraint captains_travel_has_date check (not is_travelling or travel_until is not null)
);

create index captains_base_idx on public.captains using gist (base_location);
create index captains_current_idx on public.captains using gist (current_location);

-- Dispatch only ever queries online, verified captains. In the off season
-- that is a small slice of the table, so the partial index is the difference
-- between a scan and a seek.
create index captains_dispatchable_idx
  on public.captains (verification)
  where is_online and verification = 'verified';

create index captains_travelling_idx
  on public.captains (travel_until)
  where is_travelling;

create trigger captains_touch
  before update on public.captains
  for each row execute function public.touch_updated_at();
