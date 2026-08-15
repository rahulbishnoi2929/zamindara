import type { Locale } from '@zamindara/units';

/**
 * Strings, Punjabi first.
 *
 * Fazilka is Punjabi-speaking, so Gurmukhi is the default rather than a
 * translation of an English original. Hindi matters around Abohar. English is
 * last and exists mostly for the founder and for testing.
 *
 * Kept as a plain object rather than i18next for now: three languages and one
 * flow do not need a library, and every kilobyte counts on a low-end phone.
 */

const strings = {
  // — home
  appName: { pa: 'ਜ਼ਮੀਂਦਾਰਾ', hi: 'ज़मींदारा', en: 'Zamindara' },
  myFields: { pa: 'ਮੇਰੇ ਖੇਤ', hi: 'मेरे खेत', en: 'My fields' },
  addField: { pa: 'ਨਵਾਂ ਖੇਤ ਜੋੜੋ', hi: 'नया खेत जोड़ें', en: 'Add a field' },
  noFields: {
    pa: 'ਅਜੇ ਕੋਈ ਖੇਤ ਨਹੀਂ। ਪਹਿਲਾ ਖੇਤ ਨਾਪੋ।',
    hi: 'अभी कोई खेत नहीं। पहला खेत नापें।',
    en: 'No fields yet. Measure your first one.',
  },

  // — capture method
  howMeasure: { pa: 'ਖੇਤ ਕਿਵੇਂ ਨਾਪਣਾ ਹੈ?', hi: 'खेत कैसे नापना है?', en: 'How to measure?' },
  walkBoundary: { pa: 'ਖੇਤ ਦੇ ਦੁਆਲੇ ਤੁਰੋ', hi: 'खेत के चारों ओर चलें', en: 'Walk the boundary' },
  walkBoundaryHint: {
    pa: 'ਸਭ ਤੋਂ ਸਹੀ ਤਰੀਕਾ',
    hi: 'सबसे सही तरीका',
    en: 'Most accurate',
  },

  // — walking
  gpsGood: { pa: 'GPS ਵਧੀਆ', hi: 'GPS अच्छा', en: 'GPS good' },
  gpsFair: { pa: 'GPS ਠੀਕ-ਠਾਕ', hi: 'GPS ठीक', en: 'GPS fair' },
  gpsPoor: { pa: 'GPS ਕਮਜ਼ੋਰ', hi: 'GPS कमज़ोर', en: 'GPS weak' },
  waitingForGps: { pa: 'GPS ਦੀ ਉਡੀਕ...', hi: 'GPS का इंतज़ार...', en: 'Waiting for GPS…' },
  gpsPoorWarning: {
    pa: 'ਸਿਗਨਲ ਕਮਜ਼ੋਰ ਹੈ। ਖੁੱਲ੍ਹੀ ਥਾਂ ਜਾਓ ਅਤੇ ਉਡੀਕੋ।',
    hi: 'सिग्नल कमज़ोर है। खुली जगह जाएँ और रुकें।',
    en: 'Signal is weak. Move to open ground and wait.',
  },
  start: { pa: 'ਸ਼ੁਰੂ ਕਰੋ', hi: 'शुरू करें', en: 'Start' },
  pause: { pa: 'ਰੋਕੋ', hi: 'रोकें', en: 'Pause' },
  resume: { pa: 'ਜਾਰੀ ਰੱਖੋ', hi: 'जारी रखें', en: 'Resume' },
  finish: { pa: 'ਪੂਰਾ ਹੋਇਆ', hi: 'पूरा हुआ', en: 'Finish' },
  cancel: { pa: 'ਰੱਦ ਕਰੋ', hi: 'रद्द करें', en: 'Cancel' },
  walked: { pa: 'ਤੁਰੇ', hi: 'चले', en: 'walked' },
  startHint: {
    pa: 'ਖੇਤ ਦੇ ਇੱਕ ਕੋਨੇ ਤੋਂ ਸ਼ੁਰੂ ਕਰੋ। ਫ਼ੋਨ ਜੇਬ ਵਿੱਚ ਪਾ ਲਵੋ।',
    hi: 'खेत के एक कोने से शुरू करें। फ़ोन जेब में रख लें।',
    en: 'Start at one corner. You can put the phone in your pocket.',
  },
  returnToStart: {
    pa: 'ਸ਼ੁਰੂ ਵਾਲੇ ਕੋਨੇ ਤੇ ਵਾਪਸ ਆ ਗਏ ਹੋ — ਪੂਰਾ ਕਰੋ?',
    hi: 'शुरू वाले कोने पर वापस आ गए हैं — पूरा करें?',
    en: 'You are back at the start — finish?',
  },
  needMorePoints: {
    pa: 'ਹੋਰ ਤੁਰੋ — ਪੂਰਾ ਚੱਕਰ ਲਾਓ।',
    hi: 'और चलें — पूरा चक्कर लगाएँ।',
    en: 'Keep walking — complete the loop.',
  },

  // — confirm
  checkOutline: { pa: 'ਨਿਸ਼ਾਨ ਦੇਖੋ', hi: 'निशान देखें', en: 'Check the outline' },
  dragCorners: {
    pa: 'ਗ਼ਲਤ ਲੱਗੇ? ਕੋਨੇ ਖਿੱਚ ਕੇ ਠੀਕ ਕਰੋ।',
    hi: 'ग़लत लगे? कोने खींचकर ठीक करें।',
    en: 'Looks wrong? Drag the corners.',
  },
  smallPlotWarning: {
    pa: 'ਛੋਟਾ ਖੇਤ — ਨਾਪ ਘੱਟ ਪੱਕਾ ਹੈ। ਕੋਨੇ ਧਿਆਨ ਨਾਲ ਮਿਲਾਓ।',
    hi: 'छोटा खेत — नाप कम पक्का है। कोने ध्यान से मिलाएँ।',
    en: 'Small plot — the measurement is less certain. Line the corners up carefully.',
  },
  confirm: { pa: 'ਸਹੀ ਹੈ', hi: 'सही है', en: 'Confirm' },
  walkAgain: { pa: 'ਦੁਬਾਰਾ ਨਾਪੋ', hi: 'दोबारा नापें', en: 'Measure again' },
  measureTwiceHint: {
    pa: 'ਛੋਟੇ ਖੇਤ ਲਈ ਦੋ ਵਾਰ ਨਾਪਣਾ ਬਿਹਤਰ ਹੈ।',
    hi: 'छोटे खेत के लिए दो बार नापना बेहतर है।',
    en: 'For a small plot, measuring twice is better.',
  },

  // — naming
  nameField: { pa: 'ਖੇਤ ਦਾ ਨਾਂ', hi: 'खेत का नाम', en: 'Name this field' },
  save: { pa: 'ਸੰਭਾਲੋ', hi: 'सहेजें', en: 'Save' },

  // — permissions and errors
  needLocation: {
    pa: 'ਖੇਤ ਨਾਪਣ ਲਈ ਲੋਕੇਸ਼ਨ ਦੀ ਇਜਾਜ਼ਤ ਚਾਹੀਦੀ ਹੈ।',
    hi: 'खेत नापने के लिए लोकेशन की अनुमति चाहिए।',
    en: 'Zamindara needs location access to measure your field.',
  },
  grantPermission: { pa: 'ਇਜਾਜ਼ਤ ਦਿਓ', hi: 'अनुमति दें', en: 'Allow' },
  recovered: {
    pa: 'ਪਿਛਲਾ ਅਧੂਰਾ ਨਾਪ ਮਿਲਿਆ',
    hi: 'पिछला अधूरा नाप मिला',
    en: 'Unfinished measurement recovered',
  },
} as const;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, locale: Locale = 'pa'): string {
  return strings[key][locale];
}

/** Suggested field names, in the farmer's own language. */
export const FIELD_NAME_SUGGESTIONS: Record<Locale, string[]> = {
  pa: ['ਨਹਿਰ ਵਾਲਾ ਖੇਤ', 'ਘਰ ਦੇ ਪਿੱਛੇ', 'ਵੱਡਾ ਖੇਤ', 'ਸੜਕ ਵਾਲਾ'],
  hi: ['नहर वाला खेत', 'घर के पीछे', 'बड़ा खेत', 'सड़क वाला'],
  en: ['Canal field', 'Behind the house', 'Big field', 'Roadside'],
};
