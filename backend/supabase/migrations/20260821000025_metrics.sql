-- Brief 3.3: free metrics. No analytics service: views to open in Supabase
-- Studio (Table editor → schema "metrics").
--
-- Their own schema, which the API does not expose (config.toml [api]
-- schemas = public, graphql_public) and which anon and authenticated are not
-- granted. A view runs with its owner's rights and so reads past RLS — that
-- is what makes it useful to the founder, and why no phone may reach it.
--
-- Every view is per region, because the data will be split by region later
-- and a number for "all districts" will stop meaning anything. Jobs carry no
-- region of their own; they take their field's.
--
-- Weeks are ISO weeks (Monday start) in India time, so a Sunday-night job is
-- in the week the founder thinks it is in.

create schema metrics;
revoke all on schema metrics from public, anon, authenticated;

create view metrics.jobs_per_week as
select r.slug as region,
       date_trunc('week', j.created_at at time zone 'Asia/Kolkata')::date as week_starting,
       count(*)                                          as jobs_posted,
       count(*) filter (where j.status = 'completed')    as completed,
       count(*) filter (where j.status = 'cancelled')    as cancelled,
       count(*) filter (where j.status = 'expired')      as expired_unmatched
from public.jobs j
join public.fields f on f.id = j.field_id
left join public.regions r on r.id = f.region_id
group by 1, 2
order by 2 desc, 1;

create view metrics.fields_by_method as
select r.slug as region,
       f.capture_method::text as method,
       count(*)                                         as fields,
       count(*) filter (where f.confirmed_by_owner)     as confirmed
from public.fields f
left join public.regions r on r.id = f.region_id
group by 1, 2
order by 1, 3 desc;

-- The number that says whether the product works: did he come back?
-- Of the farmers whose first job is at least 60 days old (so each has had
-- the full window), how many posted a second within 60 days of the first.
create view metrics.farmer_return_60d as
with firsts as (
  select j.farmer_id, min(j.created_at) as first_at
  from public.jobs j
  group by j.farmer_id
),
eligible as (
  select fi.*, (select f.region_id from public.jobs j join public.fields f on f.id = j.field_id
                where j.farmer_id = fi.farmer_id order by j.created_at limit 1) as region_id
  from firsts fi
  where fi.first_at <= now() - interval '60 days'
)
select r.slug as region,
       count(*) as farmers_with_60_days_history,
       count(*) filter (where exists (
         select 1 from public.jobs j2
         where j2.farmer_id = e.farmer_id
           and j2.created_at > e.first_at
           and j2.created_at <= e.first_at + interval '60 days'
       )) as came_back_within_60_days
from eligible e
left join public.regions r on r.id = e.region_id
group by 1
order by 1;

-- Active: reported his location, or moved a job, in the last 7 days. Going
-- online sends a location, so a captain who only opened the app and went
-- online counts; one who installed it and never went online does not.
create view metrics.captains_active_7d as
select r.slug as region,
       count(*) as verified_captains,
       count(*) filter (where c.location_updated_at > now() - interval '7 days'
                           or exists (select 1 from public.job_events e
                                      where e.actor_id = c.profile_id
                                        and e.created_at > now() - interval '7 days'))
         as active_last_7_days
from public.captains c
join public.profiles p on p.id = c.profile_id
left join public.regions r on r.id = p.region_id
where c.verification = 'verified'
group by 1
order by 1;

-- Area disputes: not recorded anywhere yet, so there is no view. Brief item
-- 4.4 adds the one-tap "area is wrong" and the column this would count.

revoke all on all tables in schema metrics from public, anon, authenticated;
grant usage on schema metrics to postgres, service_role;
grant select on all tables in schema metrics to postgres, service_role;
