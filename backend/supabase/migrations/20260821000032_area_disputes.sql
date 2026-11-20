-- Stage 4.4: "the area is wrong", and "the area on my papers".
--
-- A dispute is the one number that says whether measured area is trusted —
-- the product's whole premise — and nothing recorded it (3.3 could not
-- count it). Either party taps once; the server stamps who and when.

alter table public.jobs
  add column area_disputed_at timestamptz,
  add column area_disputed_by uuid references public.profiles(id)
    on delete set null on update cascade;

comment on column public.jobs.area_disputed_at is
  'When a party said the area is wrong. Set once, by the server; never cleared.';

-- Stored, shown, never priced: the papers describe the legal parcel, often
-- decades old, not the field being cut (reversal 3).
alter table public.fields
  add column papers_area_sqm double precision
    constraint fields_papers_area_plausible
    check (papers_area_sqm is null or (papers_area_sqm > 0 and papers_area_sqm < 2000000));

comment on column public.fields.papers_area_sqm is
  'Optional: the area on the farmer''s land papers. For comparison only; prices use area_sqm.';

-- Parties already update their jobs directly (jobs_update_party). The
-- dispute columns are decided here, not by what the phone sends: the first
-- mark is stamped with the server clock and the caller, and after that
-- neither column can change — not cleared, not re-attributed, not moved.
create function public.stamp_area_dispute()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if old.area_disputed_at is not null then
    new.area_disputed_at := old.area_disputed_at;
    new.area_disputed_by := old.area_disputed_by;
  elsif new.area_disputed_at is not null then
    new.area_disputed_at := now();
    new.area_disputed_by := auth.uid();
  else
    new.area_disputed_by := null;
  end if;
  return new;
end;
$fn$;

create trigger jobs_stamp_area_dispute
  before update of area_disputed_at, area_disputed_by on public.jobs
  for each row execute function public.stamp_area_dispute();

-- Per region and week: the trust number, and which side raises it.
create view metrics.area_disputes as
select r.slug as region,
       date_trunc('week', j.created_at at time zone 'Asia/Kolkata')::date as week_starting,
       count(*) filter (where j.status = 'completed')            as jobs_completed,
       count(*) filter (where j.area_disputed_at is not null)    as disputed,
       count(*) filter (where j.area_disputed_by = j.farmer_id)  as by_farmer,
       count(*) filter (where j.area_disputed_by = j.captain_id) as by_captain,
       count(*) filter (where j.area_disputed_at is not null
                          and f.capture_method = 'declared')     as disputed_declared_fields
from public.jobs j
join public.fields f on f.id = j.field_id
left join public.regions r on r.id = f.region_id
group by 1, 2
order by 2 desc, 1;

revoke all on metrics.area_disputes from public, anon, authenticated;
grant select on metrics.area_disputes to postgres, service_role;
