/**
 * Generate supabase/seed.sql from the catalogue.
 *
 * The database and the app must never disagree about what a Happy Seeder is,
 * or about which month kinnow spraying happens in. Rather than trusting two
 * hand-maintained lists to stay in step, the SQL is derived from the
 * TypeScript — the same reasoning that put sqm_per_unit under test.
 *
 *   npm run gen:seed --workspace @zamindara/catalog
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MACHINE_TYPES } from '../src/machines.ts';
import { SERVICES } from '../src/services.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', '..', '..', 'supabase', 'seed.sql');

/** Single-quote a SQL string literal. */
const q = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const REGIONS = [
  ['fazilka', 'Fazilka', 'Punjab', '{pa,hi,en}', true],
  ['muktsar', 'Sri Muktsar Sahib', 'Punjab', '{pa,hi,en}', false],
  ['ferozepur', 'Ferozepur', 'Punjab', '{pa,hi,en}', false],
  ['bathinda', 'Bathinda', 'Punjab', '{pa,hi,en}', false],
  ['sirsa', 'Sirsa', 'Haryana', '{hi,pa,en}', false],
  ['ganganagar', 'Sri Ganganagar', 'Rajasthan', '{hi,pa,en}', false],
  ['hanumangarh', 'Hanumangarh', 'Rajasthan', '{hi,pa,en}', false],
] as const;

const lines: string[] = [
  '-- GENERATED FILE — do not edit by hand.',
  '--',
  '-- Produced from packages/catalog by:',
  '--   npm run gen:seed --workspace @zamindara/catalog',
  '--',
  '-- Editing this file directly reintroduces the divergence between the',
  '-- database and the app that generating it exists to prevent.',
  '',
  '-- ---------------------------------------------------------------------------',
  '-- Regions',
  '--',
  '-- All three states share killa/kanal/marla. North Rajasthan qualifies',
  '-- because Ganganagar and Hanumangarh were settled under the same',
  '-- canal-colony system as Punjab. The rest of Rajasthan uses bigha/biswa',
  '-- and is deliberately absent until its district-level bigha is verified.',
  '-- ---------------------------------------------------------------------------',
  'insert into public.regions (slug, name, state, unit_set, default_chain, languages, is_live)',
  'values',
];

lines.push(
  REGIONS.map(
    ([slug, name, state, langs, live]) =>
      `  (${q(slug)}, ${q(name)}, ${q(state)}, '{marla,kanal,bigha,killa}', 'killa', ${q(langs)}, ${live})`,
  ).join(',\n') + '\non conflict (slug) do nothing;',
  '',
  '-- ---------------------------------------------------------------------------',
  '-- Machinery',
  '-- ---------------------------------------------------------------------------',
  'insert into public.machine_types',
  '  (code, name_en, name_pa, name_hi, category, needs_tractor, travel_rate_per_km, sort_order)',
  'values',
  MACHINE_TYPES.map(
    (m) =>
      `  (${q(m.code)}, ${q(m.name.en)}, ${q(m.name.pa)}, ${q(m.name.hi)}, ` +
      `${q(m.category)}, ${m.needsTractor}, ${m.travelRatePerKm}, ${m.sortOrder})`,
  ).join(',\n') + '\non conflict (code) do nothing;',
  '',
  '-- ---------------------------------------------------------------------------',
  '-- Services',
  '--',
  '-- season_months drives the seasonal reordering of the job grid: harvesting',
  '-- first in April, sowing in November, orchard spraying in January.',
  '-- ---------------------------------------------------------------------------',
  'insert into public.services',
  '  (code, name_en, name_pa, name_hi, machine_type_id, default_unit,',
  '   est_minutes_per_killa, season_months, sort_order)',
  'select v.code, v.name_en, v.name_pa, v.name_hi, mt.id,',
  '       v.unit::public.pricing_unit, v.mins, v.months, v.sort_order',
  'from (values',
  SERVICES.map(
    (s) =>
      `  (${q(s.code)}, ${q(s.name.en)}, ${q(s.name.pa)}, ${q(s.name.hi)}, ` +
      `${q(s.machineCode)}, ${q(s.defaultUnit)}, ` +
      `${s.estMinutesPerKilla ?? 'null'}, ` +
      `${s.seasonMonths.length > 0 ? `array[${s.seasonMonths.join(',')}]` : 'array[]::int[]'}, ` +
      `${s.sortOrder})`,
  ).join(',\n'),
  ') as v(code, name_en, name_pa, name_hi, machine_code, unit, mins, months, sort_order)',
  'join public.machine_types mt on mt.code = v.machine_code',
  'on conflict (code) do nothing;',
  '',
);

writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(
  `seed.sql written — ${REGIONS.length} regions, ${MACHINE_TYPES.length} machines, ${SERVICES.length} services`,
);
