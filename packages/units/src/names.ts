import type { Locale, Unit } from './constants.js';

/**
 * Unit names by locale. Punjabi (Gurmukhi) is the default in Fazilka;
 * Hindi (Devanagari) matters around Abohar.
 */
const NAMES: Readonly<Record<Locale, Record<Unit, string>>> = {
  pa: {
    marla: 'ਮਰਲਾ',
    kanal: 'ਕਨਾਲ',
    bigha: 'ਬਿੱਘਾ',
    killa: 'ਕਿੱਲਾ',
  },
  hi: {
    marla: 'मरला',
    kanal: 'कनाल',
    bigha: 'बीघा',
    killa: 'किल्ला',
  },
  en: {
    marla: 'marla',
    kanal: 'kanal',
    bigha: 'bigha',
    killa: 'killa',
  },
};

/** Localised name for a unit. */
export function unitName(unit: Unit, locale: Locale = 'pa'): string {
  return NAMES[locale][unit];
}

/**
 * Accepted spellings when parsing free text, e.g. a farmer typing his area
 * on the "declare" capture path, or an admin entering it from a jamabandi.
 *
 * Kept generous on purpose. Transliteration is inconsistent in the field and
 * rejecting "killey" because we expected "killa" is a bad reason to fail.
 */
const ALIASES: Readonly<Record<string, Unit>> = {
  // marla
  marla: 'marla',
  marle: 'marla',
  marlas: 'marla',
  ਮਰਲਾ: 'marla',
  ਮਰਲੇ: 'marla',
  मरला: 'marla',
  मरले: 'marla',

  // kanal
  kanal: 'kanal',
  kanals: 'kanal',
  kanaal: 'kanal',
  canal: 'kanal',
  ਕਨਾਲ: 'kanal',
  कनाल: 'kanal',

  // bigha
  bigha: 'bigha',
  bighas: 'bigha',
  bige: 'bigha',
  biga: 'bigha',
  ਬਿੱਘਾ: 'bigha',
  ਬਿਘਾ: 'bigha',
  बीघा: 'bigha',
  बिघा: 'bigha',

  // killa — including its synonyms acre and ghumaon
  killa: 'killa',
  killas: 'killa',
  killey: 'killa',
  kille: 'killa',
  kila: 'killa',
  acre: 'killa',
  acres: 'killa',
  ekad: 'killa',
  ghumaon: 'killa',
  ghumao: 'killa',
  ਕਿੱਲਾ: 'killa',
  ਕਿੱਲੇ: 'killa',
  ਕਿਲਾ: 'killa',
  ਏਕੜ: 'killa',
  किल्ला: 'killa',
  किल्ले: 'killa',
  किला: 'killa',
  एकड़: 'killa',
};

/** Resolve a written unit name to a Unit, or null if unrecognised. */
export function resolveUnit(token: string): Unit | null {
  return ALIASES[token.trim().toLowerCase()] ?? null;
}
