import type { Service } from './types.js';

/**
 * The work a farmer can book, tied to the machine that does it.
 *
 * `seasonMonths` is what reorders the farmer's job grid. In April he opens
 * the app and sees harvesting first; in November, sowing; in January, kinnow
 * spraying. A grid that showed the same order year-round would put the one
 * thing he urgently needs three rows down.
 */
export const SERVICES: readonly Service[] = [
  // — Harvest, and the second job that follows it
  {
    code: 'wheat_harvest',
    name: { en: 'Wheat harvesting', pa: 'ਕਣਕ ਦੀ ਵਾਢੀ', hi: 'गेहूँ कटाई' },
    machineCode: 'combine',
    defaultUnit: 'per_killa',
    estMinutesPerKilla: 25,
    seasonMonths: [4],
    sortOrder: 10,
  },
  {
    code: 'paddy_harvest',
    name: { en: 'Paddy harvesting', pa: 'ਝੋਨੇ ਦੀ ਵਾਢੀ', hi: 'धान कटाई' },
    machineCode: 'combine',
    defaultUnit: 'per_killa',
    estMinutesPerKilla: 30,
    seasonMonths: [10, 11],
    sortOrder: 20,
  },
  {
    code: 'straw_collect',
    name: { en: 'Straw collection', pa: 'ਤੂੜੀ ਬਣਾਉਣੀ', hi: 'तूड़ी बनाना' },
    machineCode: 'straw_reaper',
    defaultUnit: 'per_killa',
    estMinutesPerKilla: 35,
    seasonMonths: [4, 5],
    sortOrder: 30,
  },
  {
    code: 'baling',
    name: { en: 'Baling', pa: 'ਬੇਲ ਬਣਾਉਣੇ', hi: 'बेल बनाना' },
    machineCode: 'baler',
    defaultUnit: 'per_killa',
    estMinutesPerKilla: 30,
    seasonMonths: [4, 5, 10, 11],
    sortOrder: 40,
  },

  // — Ground preparation
  {
    code: 'ploughing',
    name: { en: 'Ploughing', pa: 'ਵਾਹੀ', hi: 'जुताई' },
    machineCode: 'mb_plough',
    defaultUnit: 'per_killa',
    estMinutesPerKilla: 45,
    seasonMonths: [5, 6, 10],
    sortOrder: 50,
  },
  {
    code: 'rotavator_work',
    name: { en: 'Rotavator', pa: 'ਰੋਟਾਵੇਟਰ', hi: 'रोटावेटर' },
    machineCode: 'rotavator',
    defaultUnit: 'per_killa',
    estMinutesPerKilla: 30,
    seasonMonths: [5, 6, 10, 11],
    sortOrder: 60,
  },
  {
    code: 'laser_levelling',
    name: { en: 'Laser levelling', pa: 'ਲੇਜ਼ਰ ਲੈਵਲਿੰਗ', hi: 'लेज़र लेवलिंग' },
    machineCode: 'laser_leveller',
    defaultUnit: 'per_hour',
    estMinutesPerKilla: null,
    seasonMonths: [5, 6, 11, 12],
    sortOrder: 70,
  },
  {
    code: 'cotton_bed_prep',
    name: { en: 'Cotton bed prep', pa: 'ਨਰਮੇ ਦੀ ਤਿਆਰੀ', hi: 'नरमा तैयारी' },
    machineCode: 'ridger',
    defaultUnit: 'per_killa',
    estMinutesPerKilla: 40,
    seasonMonths: [4, 5],
    sortOrder: 80,
  },

  // — Sowing
  {
    code: 'wheat_sowing',
    name: { en: 'Wheat sowing', pa: 'ਕਣਕ ਦੀ ਬਿਜਾਈ', hi: 'गेहूँ बिजाई' },
    machineCode: 'happy_seeder',
    defaultUnit: 'per_killa',
    estMinutesPerKilla: 35,
    seasonMonths: [10, 11],
    sortOrder: 90,
  },
  {
    code: 'seed_drilling',
    name: { en: 'Seed drilling', pa: 'ਬਿਜਾਈ', hi: 'बिजाई' },
    machineCode: 'seed_drill',
    defaultUnit: 'per_killa',
    estMinutesPerKilla: 30,
    seasonMonths: [5, 6, 10, 11],
    sortOrder: 100,
  },

  // — Spraying
  {
    code: 'field_spray',
    name: { en: 'Spraying', pa: 'ਸਪਰੇਅ', hi: 'स्प्रे' },
    machineCode: 'boom_sprayer',
    defaultUnit: 'per_killa',
    estMinutesPerKilla: 15,
    seasonMonths: [6, 7, 8, 9],
    sortOrder: 110,
  },
  {
    code: 'orchard_spray',
    name: { en: 'Kinnow spraying', pa: 'ਕਿੰਨੂ ਸਪਰੇਅ', hi: 'किन्नू स्प्रे' },
    machineCode: 'htp_sprayer',
    defaultUnit: 'per_killa',
    estMinutesPerKilla: 40,
    seasonMonths: [12, 1, 2],
    sortOrder: 120,
  },

  // — Year round
  {
    code: 'haulage',
    name: { en: 'Haulage', pa: 'ਢੋਆ-ਢੁਆਈ', hi: 'ढुलाई' },
    machineCode: 'trolley',
    defaultUnit: 'per_job',
    estMinutesPerKilla: null,
    seasonMonths: [],
    sortOrder: 130,
  },
  {
    code: 'earthwork',
    name: { en: 'Earthwork', pa: 'ਮਿੱਟੀ ਦਾ ਕੰਮ', hi: 'मिट्टी का काम' },
    machineCode: 'jcb',
    defaultUnit: 'per_hour',
    estMinutesPerKilla: null,
    seasonMonths: [],
    sortOrder: 140,
  },
];

export const SERVICE_BY_CODE: ReadonlyMap<string, Service> = new Map(
  SERVICES.map((s) => [s.code, s]),
);

/**
 * What can this captain actually be offered?
 *
 * Derived from his machinery, not asked separately. A captain who registers
 * a combine is offered wheat and paddy harvesting; he should never have to
 * tell us twice.
 */
export function servicesForMachines(machineCodes: readonly string[]): Service[] {
  const owned = new Set(machineCodes);
  return SERVICES.filter((s) => owned.has(s.machineCode)).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

/**
 * Services ordered for the month, in season first.
 *
 * Ties are broken by the catalogue order so the grid stays stable rather
 * than reshuffling under the farmer's thumb between sessions.
 */
export function servicesForMonth(month: number, all = SERVICES): Service[] {
  return [...all].sort((a, b) => {
    const aIn = a.seasonMonths.includes(month) ? 0 : 1;
    const bIn = b.seasonMonths.includes(month) ? 0 : 1;
    return aIn - bIn || a.sortOrder - b.sortOrder;
  });
}
