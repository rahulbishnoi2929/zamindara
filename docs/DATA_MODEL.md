# Data Model

**Postgres 15 + PostGIS 3**, hosted on Supabase.

Two rules govern the whole schema:

1. **Area is stored only as `area_sqm`.** Never killa, never bigha. See [Units](UNITS_AND_MEASUREMENT.md).
2. **All geometry is `geography(…, 4326)`** so PostGIS returns metres directly, without projection maths.

---

## Regions and units

```sql
create table regions (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,              -- 'Fazilka'
  state         text not null,              -- 'Punjab'
  country       text not null default 'IN',
  unit_set      text[] not null default '{marla,kanal,bigha,killa}',
  default_chain text not null default 'killa',   -- 'killa' | 'bigha'
  languages     text[] not null default '{pa,hi,en}',
  boundary      geography(MultiPolygon, 4326),
  is_live       boolean not null default false,
  created_at    timestamptz not null default now()
);
```

A region carries its own unit vocabulary. Adding Jodhpur later means inserting a row with `unit_set = '{biswa,bigha}'` — no schema change, no migration, no risk to existing records.

---

## People

```sql
create type user_role as enum ('farmer', 'captain', 'both');
create type verification_status as enum ('pending', 'verified', 'rejected', 'suspended');

create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  phone          text unique not null,
  full_name      text not null,
  photo_url      text,
  role           user_role not null default 'farmer',
  village        text,
  region_id      uuid references regions(id),
  language       text not null default 'pa',
  display_chain  text not null default 'killa',
  created_at     timestamptz not null default now()
);
```

`role = 'both'` is first-class. A farmer with an idle tractor is a supplier too, and the schema must never force him to pick.

```sql
create table captains (
  profile_id      uuid primary key references profiles(id) on delete cascade,
  verification    verification_status not null default 'pending',
  verified_by     uuid references profiles(id),
  base_location   geography(Point, 4326) not null,
  service_radius_km int not null default 15,

  is_online       boolean not null default false,
  current_location geography(Point, 4326),
  location_updated_at timestamptz,

  -- migrant mode
  is_travelling   boolean not null default false,
  travel_until    date,
  planned_route   text[],                    -- ordered district names

  rating_avg      numeric(3,2),
  rating_count    int not null default 0,
  jobs_completed  int not null default 0,
  created_at      timestamptz not null default now()
);

create index on captains using gist (current_location);
create index on captains using gist (base_location);
create index on captains (is_online) where is_online = true;
```

The partial index matters — dispatch only ever queries online captains, and in the off-season that's a small fraction of rows.

---

## Machinery

A catalog of machine types, plus what each captain actually has.

```sql
create table machine_types (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,     -- 'combine_harvester'
  name_en        text not null,
  name_pa        text not null,
  name_hi        text not null,
  category       text not null,            -- tillage | sowing | harvesting | spraying | haulage | earthmoving
  needs_tractor  boolean not null default true,
  icon_url       text,
  sort_order     int not null default 0
);
```

**Launch catalog for Fazilka.** Drawn from the local cotton–wheat–kinnow rotation, not a generic list:

| Category | Machines |
|---|---|
| Tillage | Tractor, rotavator, cultivator, disc harrow (tavi), MB plough, sub-soiler, laser land leveller |
| Sowing | Seed drill, happy seeder, super seeder, zero-till drill, ridger / bed planter (cotton) |
| Harvesting | Combine harvester, straw reaper (toori), thresher, baler, cotton stalk shredder |
| Spraying | Boom sprayer, HTP orchard sprayer (kinnow) |
| Haulage | Trolley / trailer |
| Earthmoving | JCB / backhoe |

Straw reaper and the orchard sprayer are deliberate — the *toori* cut after the combine is a real second market in Punjab, and kinnow spraying is what keeps Fazilka captains earning in December when everyone else is idle.

```sql
create type ownership_type as enum ('owned', 'arrangeable');

create table captain_machines (
  id               uuid primary key default gen_random_uuid(),
  captain_id       uuid not null references captains(profile_id) on delete cascade,
  machine_type_id  uuid not null references machine_types(id),
  ownership        ownership_type not null default 'owned',
  lead_time_hours  int not null default 0,   -- only meaningful when arrangeable
  make             text,
  model            text,
  year             int,
  capacity         text,                     -- '50 HP', '14 ft cutter bar'
  photo_url        text,
  with_operator_only boolean not null default false,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
```

Three fields here encode product decisions made elsewhere:

- **`ownership`** — the owned/arrangeable split from the [PRD](PRD.md). Arrangeable machines are excluded from instant dispatch but eligible for scheduled jobs beyond their lead time.
- **`lead_time_hours`** — how much notice he needs to get hold of it.
- **`with_operator_only`** — Balwinder's constraint. He'll lend the machine; he won't lend it without himself.

---

## Services and rates

```sql
create type pricing_unit as enum ('per_killa', 'per_hour', 'per_day', 'per_job');

create table services (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,    -- 'wheat_harvest'
  name_en          text not null,
  name_pa          text not null,
  name_hi          text not null,
  machine_type_id  uuid not null references machine_types(id),
  default_unit     pricing_unit not null default 'per_killa',
  est_minutes_per_killa int,                -- combine ≈ 25
  season_months    int[],                   -- {4} for wheat harvest — drives UI ordering
  icon_url         text
);

create table captain_services (
  captain_id  uuid not null references captains(profile_id) on delete cascade,
  service_id  uuid not null references services(id),
  rate        numeric(10,2),                -- null = negotiable
  rate_unit   pricing_unit not null,
  is_active   boolean not null default true,
  primary key (captain_id, service_id)
);
```

`season_months` is what reorders the farmer's job grid — harvesting first in April, sowing in November, orchard spraying in January.

---

## Fields

```sql
create type capture_method as enum ('walked', 'drawn', 'declared');

create table fields (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references profiles(id) on delete cascade,
  name           text not null,             -- 'Nehar wala khet'
  boundary       geography(Polygon, 4326),
  centroid       geography(Point, 4326) not null,
  area_sqm       double precision not null check (area_sqm > 0),

  capture_method capture_method not null,
  gps_accuracy_m numeric(5,2),
  area_method    text not null default 'polygon',  -- polygon | rectangle-fit | grid-snapped
  confirmed_by_owner boolean not null default false,

  current_crop   text,
  khasra_no      text,
  access_notes   text,                      -- 'truck can reach', 'kaccha approach'
  region_id      uuid references regions(id),
  created_at     timestamptz not null default now()
);

create index on fields using gist (centroid);
create index on fields using gist (boundary);
```

`area_sqm` is written server-side from the geometry, never accepted from the client:

```sql
create or replace function set_field_area() returns trigger as $$
begin
  if new.boundary is not null then
    new.area_sqm := st_area(new.boundary);
    new.centroid := st_centroid(new.boundary::geometry)::geography;
  end if;
  return new;
end $$ language plpgsql;

create trigger fields_area
  before insert or update of boundary on fields
  for each row execute function set_field_area();
```

**A client must never be able to send its own acreage.** That number sets the price, so it is computed by the database from the confirmed geometry or it isn't trusted.

`confirmed_by_owner` gates billing — an unconfirmed field cannot be used for a priced job.

---

## Jobs

```sql
create type job_status as enum (
  'draft', 'searching', 'accepted', 'en_route',
  'in_progress', 'completed', 'cancelled', 'expired'
);
create type payment_mode as enum ('cash', 'upi', 'pending');

create table jobs (
  id              uuid primary key default gen_random_uuid(),
  farmer_id       uuid not null references profiles(id),
  field_id        uuid not null references fields(id),
  service_id      uuid not null references services(id),
  captain_id      uuid references captains(profile_id),

  area_sqm        double precision not null,  -- snapshotted at booking
  status          job_status not null default 'draft',

  is_immediate    boolean not null default false,
  scheduled_date  date,
  scheduled_window text,                      -- morning | afternoon | evening

  quoted_rate     numeric(10,2),
  quoted_unit     pricing_unit,
  quoted_total    numeric(10,2),
  travel_charge   numeric(10,2) not null default 0,
  final_amount    numeric(10,2),
  payment_mode    payment_mode,

  queue_position  int,
  eta             timestamptz,
  notes           text,
  start_photo_url text,
  end_photo_url   text,

  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz,
  cancelled_by    uuid references profiles(id),
  cancel_reason   text
);

create index on jobs (status) where status in ('searching','accepted','in_progress');
create index on jobs (captain_id, scheduled_date);
```

`area_sqm` is **snapshotted onto the job**, not read live from the field. If the farmer later re-measures the plot, historical jobs and their prices must not change.

---

## Dispatch

```sql
create type dispatch_response as enum ('pending', 'accepted', 'declined', 'timed_out');

create table job_dispatch (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  captain_id  uuid not null references captains(profile_id),
  rank        int not null,               -- match score order
  distance_km numeric(6,2),
  sent_at     timestamptz not null default now(),
  responded_at timestamptz,
  response    dispatch_response not null default 'pending',
  unique (job_id, captain_id)
);
```

One row per captain pinged. This is also the analytics backbone — acceptance rate, response time, and coverage all come from here.

---

## Ratings

```sql
create table ratings (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references jobs(id) on delete cascade,
  rater_id   uuid not null references profiles(id),
  ratee_id   uuid not null references profiles(id),
  stars      int not null check (stars between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  unique (job_id, rater_id)
);
```

Two-way, like Uber. Critical for migrant captains — reputation earned in Ganganagar must travel into Fazilka, because they have no local standing.

---

## Core geospatial queries

**Find eligible captains for a job.** The whole dispatch engine, in one query:

```sql
select c.profile_id,
       round((st_distance(c.current_location, f.centroid) / 1000)::numeric, 2) as km
from captains c
join captain_services cs on cs.captain_id = c.profile_id
join captain_machines cm on cm.captain_id = c.profile_id
join services s          on s.id = cs.service_id
                        and s.machine_type_id = cm.machine_type_id
cross join (select centroid from fields where id = $field_id) f
where c.is_online
  and c.verification = 'verified'
  and cs.service_id = $service_id
  and cm.is_active
  and (cm.ownership = 'owned' or $is_scheduled)
  and st_dwithin(c.current_location, f.centroid, c.service_radius_km * 1000)
order by km, c.rating_avg desc nulls last
limit 10;
```

`st_dwithin` uses the GiST index, so this stays fast as the captain table grows.

**Area in local units** — conversion lives in the app layer, but for reporting:

```sql
select area_sqm,
       floor(area_sqm / 4046.856)                      as killa,
       floor(mod(area_sqm::numeric, 4046.856) / 505.857) as kanal,
       round(mod(area_sqm::numeric, 505.857) / 25.29285) as marla
from fields;
```

---

## Row-level security

Supabase RLS is on for every table. Baseline policy set:

| Table | Policy |
|---|---|
| `profiles` | Read own; read limited public fields of a counterparty on a shared job |
| `fields` | Full access to owner only. **A captain sees a field's geometry only via an accepted job.** |
| `jobs` | Visible to the farmer, the assigned captain, and any captain currently dispatched |
| `captain_machines` | Owner writes; anyone reads active machines of verified captains |
| `ratings` | Write once per job per rater; read aggregates publicly |

Field boundaries are a farmer's land records. They are not public data, and the schema must not treat them as such.
