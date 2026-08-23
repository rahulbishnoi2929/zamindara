-- Two-way ratings.
--
-- Critical for migrant captains: reputation earned in Ganganagar has to
-- travel into Fazilka, because they arrive with no local standing at all.

create table public.ratings (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  rater_id   uuid not null references public.profiles(id) on delete cascade,
  ratee_id   uuid not null references public.profiles(id) on delete cascade,
  stars      smallint not null,
  comment    text,
  created_at timestamptz not null default now(),

  unique (job_id, rater_id),
  constraint ratings_stars_range check (stars between 1 and 5),
  constraint ratings_not_self check (rater_id <> ratee_id)
);

create index ratings_ratee_idx on public.ratings (ratee_id, created_at desc);

-- Keep the captain aggregate current. Cheap at this volume; if it ever
-- becomes hot, move it to a periodically refreshed materialised view.
create or replace function public.refresh_captain_rating()
returns trigger
language plpgsql
as $fn$
begin
  update public.captains c
  set rating_avg = agg.avg_stars,
      rating_count = agg.n
  from (
    select avg(stars)::numeric(3,2) as avg_stars, count(*)::integer as n
    from public.ratings
    where ratee_id = new.ratee_id
  ) agg
  where c.profile_id = new.ratee_id;
  return new;
end;
$fn$;

create trigger ratings_refresh_captain
  after insert or update on public.ratings
  for each row execute function public.refresh_captain_rating();
