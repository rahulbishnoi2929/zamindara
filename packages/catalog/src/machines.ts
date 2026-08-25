import type { MachineType } from './types.js';

/**
 * The Fazilka machinery catalogue.
 *
 * Drawn from the local cotton–wheat–kinnow rotation, not a generic equipment
 * list. Two entries deserve explaining, because a catalogue copied from
 * elsewhere would not have them:
 *
 *   straw_reaper — the toori cut behind every combine. A second job on the
 *   same field, days later, and a real earner for a captain who owns one.
 *
 *   htp_sprayer  — Abohar's kinnow orchards. This is what keeps captains
 *   opening the app in December, so they are still active in April.
 *
 * This array is the single source of truth. supabase/seed.sql is generated
 * from it — see scripts/generate-seed.ts. Never edit the SQL by hand.
 */
export const MACHINE_TYPES: readonly MachineType[] = [
  // — Tillage
  {
    code: 'tractor',
    name: { en: 'Tractor', pa: 'ਟਰੈਕਟਰ', hi: 'ट्रैक्टर' },
    category: 'tillage',
    needsTractor: false,
    travelRatePerKm: 40,
    glyph: '🚜',
    sortOrder: 10,
  },
  {
    code: 'rotavator',
    name: { en: 'Rotavator', pa: 'ਰੋਟਾਵੇਟਰ', hi: 'रोटावेटर' },
    category: 'tillage',
    needsTractor: true,
    travelRatePerKm: 40,
    glyph: '🌀',
    sortOrder: 20,
  },
  {
    code: 'cultivator',
    name: { en: 'Cultivator', pa: 'ਕਲਟੀਵੇਟਰ', hi: 'कल्टीवेटर' },
    category: 'tillage',
    needsTractor: true,
    travelRatePerKm: 40,
    glyph: '⚒️',
    sortOrder: 30,
  },
  {
    code: 'disc_harrow',
    name: { en: 'Disc harrow (tavi)', pa: 'ਤਵੀ', hi: 'तवी' },
    category: 'tillage',
    needsTractor: true,
    travelRatePerKm: 40,
    glyph: '⭕',
    sortOrder: 40,
  },
  {
    code: 'mb_plough',
    name: { en: 'MB plough', pa: 'ਐਮਬੀ ਹਲ਼', hi: 'एमबी हल' },
    category: 'tillage',
    needsTractor: true,
    travelRatePerKm: 40,
    glyph: '🔨',
    sortOrder: 50,
  },
  {
    code: 'sub_soiler',
    name: { en: 'Sub-soiler', pa: 'ਸਬ-ਸੌਇਲਰ', hi: 'सब-सॉइलर' },
    category: 'tillage',
    needsTractor: true,
    travelRatePerKm: 45,
    glyph: '⛏️',
    sortOrder: 60,
  },
  {
    code: 'laser_leveller',
    name: { en: 'Laser leveller', pa: 'ਲੇਜ਼ਰ ਲੈਵਲਰ', hi: 'लेज़र लेवलर' },
    category: 'tillage',
    needsTractor: true,
    travelRatePerKm: 60,
    glyph: '📐',
    sortOrder: 70,
  },

  // — Sowing
  {
    code: 'seed_drill',
    name: { en: 'Seed drill', pa: 'ਸੀਡ ਡਰਿੱਲ', hi: 'सीड ड्रिल' },
    category: 'sowing',
    needsTractor: true,
    travelRatePerKm: 40,
    glyph: '🌱',
    sortOrder: 80,
  },
  {
    code: 'happy_seeder',
    name: { en: 'Happy Seeder', pa: 'ਹੈਪੀ ਸੀਡਰ', hi: 'हैप्पी सीडर' },
    category: 'sowing',
    needsTractor: true,
    travelRatePerKm: 50,
    glyph: '🌾',
    sortOrder: 90,
  },
  {
    code: 'super_seeder',
    name: { en: 'Super Seeder', pa: 'ਸੁਪਰ ਸੀਡਰ', hi: 'सुपर सीडर' },
    category: 'sowing',
    needsTractor: true,
    travelRatePerKm: 50,
    glyph: '🌾',
    sortOrder: 100,
  },
  {
    code: 'zero_till',
    name: { en: 'Zero-till drill', pa: 'ਜ਼ੀਰੋ ਟਿੱਲ ਡਰਿੱਲ', hi: 'ज़ीरो टिल ड्रिल' },
    category: 'sowing',
    needsTractor: true,
    travelRatePerKm: 45,
    glyph: '🌱',
    sortOrder: 110,
  },
  {
    code: 'ridger',
    name: { en: 'Ridger / bed planter', pa: 'ਰਿੱਜਰ', hi: 'रिजर' },
    category: 'sowing',
    needsTractor: true,
    travelRatePerKm: 40,
    glyph: '〰️',
    sortOrder: 120,
  },

  // — Harvesting
  {
    code: 'combine',
    name: { en: 'Combine harvester', pa: 'ਕੰਬਾਈਨ', hi: 'कंबाइन' },
    category: 'harvesting',
    needsTractor: false,
    travelRatePerKm: 60,
    glyph: '🌾',
    sortOrder: 130,
  },
  {
    code: 'straw_reaper',
    name: { en: 'Straw reaper (toori)', pa: 'ਤੂੜੀ ਵਾਲੀ ਮਸ਼ੀਨ', hi: 'तूड़ी मशीन' },
    category: 'harvesting',
    needsTractor: true,
    travelRatePerKm: 50,
    glyph: '🧹',
    sortOrder: 140,
  },
  {
    code: 'thresher',
    name: { en: 'Thresher', pa: 'ਥਰੈਸ਼ਰ', hi: 'थ्रेशर' },
    category: 'harvesting',
    needsTractor: true,
    travelRatePerKm: 45,
    glyph: '⚙️',
    sortOrder: 150,
  },
  {
    code: 'baler',
    name: { en: 'Baler', pa: 'ਬੇਲਰ', hi: 'बेलर' },
    category: 'harvesting',
    needsTractor: true,
    travelRatePerKm: 50,
    glyph: '📦',
    sortOrder: 160,
  },
  {
    code: 'cotton_shredder',
    name: { en: 'Cotton stalk shredder', pa: 'ਨਰਮਾ ਸ਼ਰੈਡਰ', hi: 'नरमा श्रेडर' },
    category: 'harvesting',
    needsTractor: true,
    travelRatePerKm: 45,
    glyph: '✂️',
    sortOrder: 170,
  },

  // — Spraying
  {
    code: 'boom_sprayer',
    name: { en: 'Boom sprayer', pa: 'ਸਪਰੇਅ ਮਸ਼ੀਨ', hi: 'स्प्रे मशीन' },
    category: 'spraying',
    needsTractor: true,
    travelRatePerKm: 40,
    glyph: '💦',
    sortOrder: 180,
  },
  {
    code: 'htp_sprayer',
    name: { en: 'Orchard sprayer (HTP)', pa: 'ਐਚਟੀਪੀ ਸਪਰੇਅ', hi: 'एचटीपी स्प्रे' },
    category: 'spraying',
    needsTractor: true,
    travelRatePerKm: 40,
    glyph: '🍊',
    sortOrder: 190,
  },

  // — Haulage and earthmoving
  {
    code: 'trolley',
    name: { en: 'Trolley', pa: 'ਟਰਾਲੀ', hi: 'ट्रॉली' },
    category: 'haulage',
    needsTractor: true,
    travelRatePerKm: 35,
    glyph: '🛻',
    sortOrder: 200,
  },
  {
    code: 'jcb',
    name: { en: 'JCB / backhoe', pa: 'ਜੇਸੀਬੀ', hi: 'जेसीबी' },
    category: 'earthmoving',
    needsTractor: false,
    travelRatePerKm: 70,
    glyph: '🏗️',
    sortOrder: 210,
  },
];

export const MACHINE_BY_CODE: ReadonlyMap<string, MachineType> = new Map(
  MACHINE_TYPES.map((m) => [m.code, m]),
);

export const CATEGORY_NAMES: Record<
  MachineType['category'],
  Record<'en' | 'pa' | 'hi', string>
> = {
  tillage: { en: 'Tillage', pa: 'ਵਾਹੀ', hi: 'जुताई' },
  sowing: { en: 'Sowing', pa: 'ਬਿਜਾਈ', hi: 'बिजाई' },
  harvesting: { en: 'Harvesting', pa: 'ਵਾਢੀ', hi: 'कटाई' },
  spraying: { en: 'Spraying', pa: 'ਸਪਰੇਅ', hi: 'स्प्रे' },
  haulage: { en: 'Haulage', pa: 'ਢੋਆ-ਢੁਆਈ', hi: 'ढुलाई' },
  earthmoving: { en: 'Earthwork', pa: 'ਮਿੱਟੀ ਦਾ ਕੰਮ', hi: 'मिट्टी का काम' },
};
