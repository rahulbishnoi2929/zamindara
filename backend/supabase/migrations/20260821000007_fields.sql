-- Fields.
--
-- A farmer's field boundary is his land record. It is not public data, and
-- the RLS policies later treat it accordingly.

create type public.capture_method as enum ('drawn', 'walked', 'declared');

create table public.fields (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles(id) on delete cascade,
  name               text not null,

  boundary           geography(Polygon, 4326) not null,
  centroid           geography(Point, 4326) not null,
  area_sqm           double precision not null,

  capture_method     public.capture_method not null,
  gps_accuracy_m     numeric(6,2),
  confirmed_by_owner boolean not null default false,

  current_crop       text,
  khasra_no          text,
  access_notes       text,
  region_id          uuid references public.regions(id) on delete restrict,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint fields_area_positive check (area_sqm > 0),
  -- A field larger than 200 hectares in this belt is a mis-drawn polygon,
  -- not a landholding. Fail loudly rather than quote a price on it.
  constraint fields_area_plausible check (area_sqm < 2000000),
  constraint fields_name_present check (length(btrim(name)) > 0)
);

create index fields_owner_idx on public.fields (owner_id);
create index fields_centroid_idx on public.fields using gist (centroid);
create index fields_boundary_idx on public.fields using gist (boundary);

create trigger fields_touch
  before update on public.fields
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- The single most important function in this schema.
--
-- Area sets the price. If a client could submit its own acreage, a farmer
-- could halve his bill and a captain could double it, and neither would be
-- detectable after the fact. So area and centroid are DERIVED here, from the
-- geometry, and whatever the client sent is discarded.
--
-- The polygon is validated first: a self-intersecting ring produces a
-- meaningless area, and sometimes a plausible-looking one, which is worse.
-- ---------------------------------------------------------------------------
create or replace function public.derive_field_geometry()
returns trigger
language plpgsql
as $$
declare
  ring geometry;
begin
  ring := new.boundary::geometry;

  if not extensions.st_isvalid(ring) then
    raise exception 'field boundary is not a valid polygon: %',
      extensions.st_isvalidreason(ring)
      using errcode = 'check_violation';
  end if;

  if extensions.st_npoints(ring) < 4 then
    raise exception 'field boundary needs at least three distinct corners'
      using errcode = 'check_violation';
  end if;

  -- Client-supplied values are ignored on purpose.
  new.area_sqm := extensions.st_area(new.boundary);
  new.centroid := extensions.st_centroid(ring)::geography;

  -- Re-measuring a field invalidates the farmer's confirmation of it.
  if tg_op = 'UPDATE' and not extensions.st_equals(ring, old.boundary::geometry) then
    new.confirmed_by_owner := false;
  end if;

  return new;
end;
$$;

create trigger fields_derive_geometry
  before insert or update of boundary on public.fields
  for each row execute function public.derive_field_geometry();

comment on column public.fields.area_sqm is
  'Derived server-side from boundary. Never trust a client-supplied area — it sets the price.';
comment on column public.fields.confirmed_by_owner is
  'Gates billing. An unconfirmed field cannot be used for a priced job.';
