-- Phase 2, step 2.1 and 2.2 — does the schema build, and does the catalogue load?
--
-- Run with:  supabase test db

begin;
select plan(28);

-- ---------------------------------------------------------------------------
-- Extensions and tables
-- ---------------------------------------------------------------------------
select has_extension('extensions', 'postgis', 'PostGIS is installed');

select has_table('public', 'regions',          'regions exists');
select has_table('public', 'profiles',         'profiles exists');
select has_table('public', 'captains',         'captains exists');
select has_table('public', 'machine_types',    'machine_types exists');
select has_table('public', 'services',         'services exists');
select has_table('public', 'captain_machines', 'captain_machines exists');
select has_table('public', 'fields',           'fields exists');
select has_table('public', 'jobs',             'jobs exists');
select has_table('public', 'job_dispatch',     'job_dispatch exists');
select has_table('public', 'job_events',       'job_events exists');
select has_table('public', 'ratings',          'ratings exists');

-- ---------------------------------------------------------------------------
-- RLS is on everywhere that holds user data.
--
-- A table that silently ships without RLS is the failure mode this checks
-- for: it leaks quietly and nothing complains.
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select count(*)::int
     from pg_tables
     where schemaname = 'public'
       and tablename in ('regions','profiles','captains','machine_types','services',
                         'captain_machines','captain_services','fields','jobs',
                         'job_dispatch','job_events','ratings')
       and not rowsecurity $$,
  $$ values (0) $$,
  'every public table has row-level security enabled'
);

-- ---------------------------------------------------------------------------
-- Land units must agree with packages/units, exactly.
--
-- If SQL and TypeScript ever disagree about the size of a killa, one of them
-- prices a job wrong. These are the same constants as
-- packages/units/src/constants.ts.
-- ---------------------------------------------------------------------------
select is(public.sqm_per_unit('killa'), 4046.8564224::numeric, 'one killa is one acre in square metres');
select is(public.sqm_per_unit('kanal'), 505.8570528::numeric,  'one kanal is an eighth of a killa');
select is(public.sqm_per_unit('marla'), 25.29285264::numeric,  'one marla is a 160th of a killa');
select is(public.sqm_per_unit('bigha'), 2529.285264::numeric,  'one bigha is five kanal');

select is(
  public.sqm_per_unit('killa') / public.sqm_per_unit('kanal'),
  8::numeric,
  'a killa is eight kanal'
);
select is(
  public.sqm_per_unit('bigha') / public.sqm_per_unit('kanal'),
  5::numeric,
  'a bigha is five kanal'
);

-- ---------------------------------------------------------------------------
-- Seed data — the Fazilka catalogue
-- ---------------------------------------------------------------------------
select isnt_empty(
  $$ select 1 from public.regions where slug = 'fazilka' and is_live $$,
  'Fazilka is seeded and live'
);

select results_eq(
  $$ select count(*)::int from public.regions where is_live $$,
  $$ values (1) $$,
  'exactly one region is live at launch'
);

select ok(
  (select count(*) from public.machine_types) >= 20,
  'the machine catalogue is seeded'
);

-- The locally specific ones. A generic equipment list would not have these,
-- and their absence would mean the catalogue came from somewhere else.
select isnt_empty($$ select 1 from public.machine_types where code = 'straw_reaper' $$,
  'straw reaper (toori) is in the catalogue');
select isnt_empty($$ select 1 from public.machine_types where code = 'htp_sprayer' $$,
  'orchard sprayer for kinnow is in the catalogue');
select isnt_empty($$ select 1 from public.machine_types where code = 'combine' $$,
  'combine harvester is in the catalogue');

-- Gurmukhi and Devanagari must survive the round trip into Postgres.
select isnt_empty(
  $$ select 1 from public.machine_types where code = 'combine' and name_pa = 'ਕੰਬਾਈਨ' $$,
  'Gurmukhi names are stored intact'
);
select isnt_empty(
  $$ select 1 from public.machine_types where code = 'combine' and name_hi = 'कंबाइन' $$,
  'Devanagari names are stored intact'
);

-- Seasonality drives the farmer's job grid ordering.
select isnt_empty(
  $$ select 1 from public.services where code = 'wheat_harvest' and 4 = any(season_months) $$,
  'wheat harvesting is an April service'
);
select isnt_empty(
  $$ select 1 from public.services where code = 'orchard_spray' and 1 = any(season_months) $$,
  'kinnow spraying is a January service'
);

-- Repositioning a combine costs more than towing an implement.
select ok(
  (select travel_rate_per_km from public.machine_types where code = 'combine')
  > (select travel_rate_per_km from public.machine_types where code = 'trolley'),
  'a combine costs more per km to reposition than a trolley'
);

select ok(
  (select count(*) from public.services) >= 12,
  'the service catalogue is seeded'
);

select * from finish();
rollback;
