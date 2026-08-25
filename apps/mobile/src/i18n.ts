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

  // — onboarding
  chooseLanguage: { pa: 'ਭਾਸ਼ਾ ਚੁਣੋ', hi: 'भाषा चुनें', en: 'Choose your language' },
  whoAreYou: { pa: 'ਤੁਸੀਂ ਕੌਣ ਹੋ?', hi: 'आप कौन हैं?', en: 'Who are you?' },
  iAmFarmer: { pa: 'ਮੈਨੂੰ ਖੇਤ ਦਾ ਕੰਮ ਕਰਵਾਉਣਾ ਹੈ', hi: 'मुझे खेत का काम करवाना है', en: 'I need work done on my field' },
  iAmCaptain: { pa: 'ਮੇਰੇ ਕੋਲ ਮਸ਼ੀਨ ਹੈ', hi: 'मेरे पास मशीन है', en: 'I have machinery' },
  iAmBoth: { pa: 'ਮੈਂ ਦੋਵੇਂ ਕਰਦਾ ਹਾਂ', hi: 'मैं दोनों करता हूँ', en: 'I do both' },
  yourName: { pa: 'ਤੁਹਾਡਾ ਨਾਂ', hi: 'आपका नाम', en: 'Your name' },
  yourVillage: { pa: 'ਪਿੰਡ', hi: 'गाँव', en: 'Village' },
  next: { pa: 'ਅੱਗੇ', hi: 'आगे', en: 'Next' },
  back: { pa: 'ਪਿੱਛੇ', hi: 'पीछे', en: 'Back' },
  skip: { pa: 'ਬਾਅਦ ਵਿੱਚ', hi: 'बाद में', en: 'Later' },
  finishSetup: { pa: 'ਪੂਰਾ ਕਰੋ', hi: 'पूरा करें', en: 'Finish' },

  // — machine registry
  yourMachines: { pa: 'ਤੁਹਾਡੀਆਂ ਮਸ਼ੀਨਾਂ', hi: 'आपकी मशीनें', en: 'Your machinery' },
  addMachine: { pa: 'ਮਸ਼ੀਨ ਜੋੜੋ', hi: 'मशीन जोड़ें', en: 'Add a machine' },
  pickMachine: { pa: 'ਕਿਹੜੀ ਮਸ਼ੀਨ?', hi: 'कौन सी मशीन?', en: 'Which machine?' },
  noMachinesYet: {
    pa: 'ਅਜੇ ਕੋਈ ਮਸ਼ੀਨ ਨਹੀਂ ਜੋੜੀ। ਜੋ ਵੀ ਤੁਹਾਡੇ ਕੋਲ ਹੈ ਉਹ ਜੋੜੋ।',
    hi: 'अभी कोई मशीन नहीं जोड़ी। जो भी आपके पास है वो जोड़ें।',
    en: 'No machines yet. Add whatever you have.',
  },
  ownership: { pa: 'ਮਸ਼ੀਨ ਕਿਸ ਦੀ ਹੈ?', hi: 'मशीन किसकी है?', en: 'Whose machine is it?' },
  ownedByMe: { pa: 'ਮੇਰੀ ਆਪਣੀ', hi: 'मेरी अपनी', en: 'Mine' },
  canArrange: { pa: 'ਮੰਗਵਾ ਸਕਦਾ ਹਾਂ', hi: 'मँगवा सकता हूँ', en: 'I can arrange it' },
  canArrangeHint: {
    pa: 'ਰਿਸ਼ਤੇਦਾਰ ਜਾਂ ਗੁਆਂਢੀ ਤੋਂ। ਕਿੰਨਾ ਸਮਾਂ ਲੱਗੇਗਾ?',
    hi: 'रिश्तेदार या पड़ोसी से। कितना समय लगेगा?',
    en: 'From a relative or neighbour. How much notice do you need?',
  },
  sameDay: { pa: 'ਉਸੇ ਦਿਨ', hi: 'उसी दिन', en: 'Same day' },
  oneDay: { pa: 'ਇੱਕ ਦਿਨ', hi: 'एक दिन', en: '1 day' },
  twoDays: { pa: 'ਦੋ-ਤਿੰਨ ਦਿਨ', hi: 'दो-तीन दिन', en: '2–3 days' },
  withOperatorOnly: {
    pa: 'ਮਸ਼ੀਨ ਨਾਲ ਮੈਂ ਖ਼ੁਦ ਜਾਵਾਂਗਾ',
    hi: 'मशीन के साथ मैं ख़ुद जाऊँगा',
    en: 'I go with the machine',
  },
  remove: { pa: 'ਹਟਾਓ', hi: 'हटाएँ', en: 'Remove' },

  // — rates
  yourRates: { pa: 'ਤੁਹਾਡੇ ਰੇਟ', hi: 'आपके रेट', en: 'Your rates' },
  ratesHint: {
    pa: 'ਰੇਟ ਹੁਣ ਨਾ ਦੱਸਣਾ ਹੋਵੇ ਤਾਂ ਖਾਲੀ ਛੱਡ ਦਿਓ — ਹਰ ਕੰਮ ਤੇ ਗੱਲ ਕਰ ਲੈਣਾ।',
    hi: 'रेट अभी न बताना हो तो खाली छोड़ दें — हर काम पर बात कर लेना।',
    en: 'Leave blank to negotiate each job instead.',
  },
  perKilla: { pa: 'ਪ੍ਰਤੀ ਕਿੱਲਾ', hi: 'प्रति किल्ला', en: 'per killa' },
  perHour: { pa: 'ਪ੍ਰਤੀ ਘੰਟਾ', hi: 'प्रति घंटा', en: 'per hour' },
  perDay: { pa: 'ਪ੍ਰਤੀ ਦਿਨ', hi: 'प्रति दिन', en: 'per day' },
  perJob: { pa: 'ਪ੍ਰਤੀ ਕੰਮ', hi: 'प्रति काम', en: 'per job' },
  noServicesYet: {
    pa: 'ਪਹਿਲਾਂ ਮਸ਼ੀਨ ਜੋੜੋ — ਕੰਮ ਆਪੇ ਆ ਜਾਣਗੇ।',
    hi: 'पहले मशीन जोड़ें — काम अपने आप आ जाएँगे।',
    en: 'Add a machine first — the work follows from it.',
  },

  // — captain home
  captainHome: { pa: 'ਕੰਮ', hi: 'काम', en: 'Work' },
  goOnline: { pa: 'ਆਨਲਾਈਨ ਹੋਵੋ', hi: 'ऑनलाइन हों', en: 'Go online' },
  goOffline: { pa: 'ਆਫ਼ਲਾਈਨ ਹੋਵੋ', hi: 'ऑफ़लाइन हों', en: 'Go offline' },
  online: { pa: 'ਆਨਲਾਈਨ', hi: 'ऑनलाइन', en: 'Online' },
  offline: { pa: 'ਆਫ਼ਲਾਈਨ', hi: 'ऑफ़लाइन', en: 'Offline' },
  waitingForWork: {
    pa: 'ਕੰਮ ਦੀ ਉਡੀਕ ਹੈ। ਨਵਾਂ ਕੰਮ ਆਉਣ ਤੇ ਫ਼ੋਨ ਵੱਜੇਗਾ।',
    hi: 'काम का इंतज़ार है। नया काम आने पर फ़ोन बजेगा।',
    en: 'Waiting for work. Your phone will ring when a job comes in.',
  },
  editProfile: { pa: 'ਪ੍ਰੋਫ਼ਾਈਲ', hi: 'प्रोफ़ाइल', en: 'Profile' },

  // — capture method
  howMeasure: { pa: 'ਖੇਤ ਕਿਵੇਂ ਨਾਪਣਾ ਹੈ?', hi: 'खेत कैसे नापना है?', en: 'How to measure?' },

  drawOnMap: { pa: 'ਨਕਸ਼ੇ ਤੇ ਖੇਤ ਬਣਾਓ', hi: 'नक़्शे पर खेत बनाएँ', en: 'Draw on the map' },
  drawOnMapHint: {
    pa: 'ਸਭ ਤੋਂ ਸੌਖਾ — ਤੁਰਨ ਦੀ ਲੋੜ ਨਹੀਂ',
    hi: 'सबसे आसान — चलने की ज़रूरत नहीं',
    en: 'Easiest — no walking needed',
  },
  walkBoundary: { pa: 'ਖੇਤ ਦੇ ਦੁਆਲੇ ਤੁਰੋ', hi: 'खेत के चारों ओर चलें', en: 'Walk the boundary' },
  walkBoundaryHint: {
    pa: 'ਜੇ ਨਕਸ਼ੇ ਤੇ ਖੇਤ ਨਾ ਦਿਸੇ',
    hi: 'अगर नक़्शे पर खेत न दिखे',
    en: 'If you cannot see the field on the map',
  },

  // — drawing
  tapCorners: {
    pa: 'ਖੇਤ ਦੇ ਕੋਨਿਆਂ ਤੇ ਦਬਾਓ',
    hi: 'खेत के कोनों पर दबाएँ',
    en: 'Tap the corners of your field',
  },
  tapCornersHint: {
    pa: 'ਵੱਟ ਦੇ ਨਾਲ-ਨਾਲ ਹਰ ਕੋਨੇ ਤੇ ਦਬਾਓ। ਗ਼ਲਤ ਹੋਵੇ ਤਾਂ ਖਿੱਚ ਕੇ ਠੀਕ ਕਰੋ।',
    hi: 'मेड़ के साथ हर कोने पर दबाएँ। ग़लत हो तो खींचकर ठीक करें।',
    en: 'Tap each corner along the bund. Drag any point to fix it.',
  },
  needThreePoints: {
    pa: 'ਘੱਟੋ-ਘੱਟ ਤਿੰਨ ਕੋਨੇ ਚਾਹੀਦੇ ਹਨ',
    hi: 'कम से कम तीन कोने चाहिए',
    en: 'At least three corners needed',
  },
  undo: { pa: 'ਪਿੱਛੇ', hi: 'पीछे', en: 'Undo' },
  clearAll: { pa: 'ਸਾਰੇ ਹਟਾਓ', hi: 'सब हटाएँ', en: 'Clear' },
  done: { pa: 'ਹੋ ਗਿਆ', hi: 'हो गया', en: 'Done' },
  labels: { pa: 'ਨਾਂ', hi: 'नाम', en: 'Labels' },
  findingYou: { pa: 'ਤੁਹਾਡੀ ਥਾਂ ਲੱਭ ਰਹੇ ਹਾਂ...', hi: 'आपकी जगह ढूँढ रहे हैं...', en: 'Finding your location…' },

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
