-- A client could set its own field area, and therefore its own price.
--
-- `derive_field_geometry` recomputes area_sqm and centroid from the boundary
-- and ignores whatever the client sent. The comment on the column even says
-- "Never trust a client-supplied area — it sets the price."
--
-- But the trigger was declared `before insert or update OF boundary`. In
-- Postgres that fires only when `boundary` appears in the UPDATE's column
-- list. And `fields_update_own` lets an owner write any column on his own
-- field. So:
--
--     update public.fields set area_sqm = 1000000 where id = <mine>;
--
-- never fired the trigger, and the field was then four hundred acres. Every
-- quote, every rate-guidance sample and every captain's travel charge is
-- computed from that number.
--
-- Dropping `OF boundary` makes the trigger fire on any update of the row.
-- Recomputing from the boundary is cheap, and it is the only value that can
-- be trusted, so doing it on every write is both safer and simpler than
-- enumerating which columns deserve suspicion.
--
-- The confirmed_by_owner reset already guards itself with st_equals, so
-- renaming a field still does not un-confirm it.

drop trigger if exists fields_derive_geometry on public.fields;

create trigger fields_derive_geometry
  before insert or update on public.fields
  for each row execute function public.derive_field_geometry();

-- ---------------------------------------------------------------------------
-- A field too small to name
--
-- There was a maximum (200 hectares, "a mis-drawn polygon, not a
-- landholding") and no minimum beyond `> 0`. A three-square-metre field is
-- equally a mis-drawn polygon — two corners placed on the same spot while
-- the map was zoomed out.
--
-- The floor is one marla, and the reason is not arbitrary: marla is the
-- smallest unit this app can express. `toWholeMarla` rounds to whole marlas,
-- so a field below half of one already displays as nothing at all. A field
-- the app cannot name is not a field.
-- ---------------------------------------------------------------------------
alter table public.fields
  add constraint fields_area_at_least_a_marla
  check (area_sqm >= 25.29285264);

comment on constraint fields_area_at_least_a_marla on public.fields is
  'One marla, the smallest unit the app can express. Below it the area displays as nothing.';

-- ---------------------------------------------------------------------------
-- A "declared" field still has a boundary
--
-- The capture_method enum offers 'declared', which reads as "the farmer told
-- us the area without tracing anything". The table does not allow that:
-- `boundary` is NOT NULL, and so is `centroid`.
--
-- That is left exactly as it is, and written down here so the next person
-- does not take the enum value as a promise. 'declared' means the farmer
-- accepted or typed an area *and* traced an approximate shape — dispatch
-- needs a centroid to find anyone, and travel cannot be priced without one,
-- so a field with no location is of no use to either side.
--
-- Allowing a boundary-less field would be a schema change with consequences
-- for eligible_captains, quote_job and the RLS field-visibility rules, not a
-- constraint tweak.
-- ---------------------------------------------------------------------------
comment on type public.capture_method is
  'How the boundary was obtained. All three still require a boundary: dispatch needs a centroid and travel cannot be priced without one.';
