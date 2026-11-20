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

  // — sign in
  yourPhone: { pa: 'ਤੁਹਾਡਾ ਫ਼ੋਨ ਨੰਬਰ', hi: 'आपका फ़ोन नंबर', en: 'Your phone number' },
  phoneHint: {
    pa: 'ਇਸੇ ਨੰਬਰ ਤੇ ਕੰਮ ਦੀ ਖ਼ਬਰ ਆਵੇਗੀ।',
    hi: 'इसी नंबर पर काम की ख़बर आएगी।',
    en: 'Work requests come to this number.',
  },
  sendCode: { pa: 'ਕੋਡ ਭੇਜੋ', hi: 'कोड भेजें', en: 'Send code' },
  enterCode: { pa: 'ਕੋਡ ਪਾਓ', hi: 'कोड डालें', en: 'Enter the code' },
  codeSentTo: { pa: 'ਕੋਡ ਭੇਜਿਆ', hi: 'कोड भेजा', en: 'Code sent to' },

  // No SMS provider yet: a captain's code is one the founder reads to him
  // over the phone. Saying "we have sent you an SMS" to a man who will
  // never receive one tells him to wait for something that is not coming,
  // and he will decide the app is broken — which, from where he stands,
  // it is. Switched by app_config.founder_code_signin, so the day the SMS
  // paperwork clears this changes on phones already in captains' hands.
  codeFromFounder: {
    pa: 'ਜੋ ਕੋਡ ਤੁਹਾਨੂੰ ਫ਼ੋਨ ਤੇ ਦੱਸਿਆ ਗਿਆ ਸੀ, ਉਹ ਪਾਓ',
    hi: 'जो कोड आपको फ़ोन पर बताया गया था, वह डालें',
    en: 'Enter the code you were given on the phone',
  },
  codeFromFounderHint: {
    pa: 'ਕੋਈ SMS ਨਹੀਂ ਆਵੇਗਾ। ਕੋਡ ਨਾ ਹੋਵੇ ਤਾਂ ਸਾਨੂੰ ਫ਼ੋਨ ਕਰੋ।',
    hi: 'कोई SMS नहीं आएगा। कोड न हो तो हमें फ़ोन करें।',
    en: 'No SMS will arrive. Ring us if you do not have a code.',
  },
  getCode: { pa: 'ਅੱਗੇ ਵਧੋ', hi: 'आगे बढ़ें', en: 'Continue' },
  verify: { pa: 'ਅੱਗੇ ਵਧੋ', hi: 'आगे बढ़ें', en: 'Continue' },
  resend: { pa: 'ਦੁਬਾਰਾ ਭੇਜੋ', hi: 'दोबारा भेजें', en: 'Send again' },
  changeNumber: { pa: 'ਨੰਬਰ ਬਦਲੋ', hi: 'नंबर बदलें', en: 'Change number' },
  errBadNumber: {
    pa: 'ਦਸ ਅੰਕਾਂ ਦਾ ਨੰਬਰ ਪਾਓ।',
    hi: 'दस अंकों का नंबर डालें।',
    en: 'Enter a 10-digit number.',
  },
  errWrongCode: {
    pa: 'ਕੋਡ ਗ਼ਲਤ ਹੈ। ਨਵਾਂ ਕੋਡ ਮੰਗਵਾਓ।',
    hi: 'कोड ग़लत है। नया कोड मँगवाएँ।',
    en: 'That code is wrong. Ask for a new one.',
  },
  errRateLimited: {
    pa: 'ਥੋੜ੍ਹਾ ਰੁਕੋ, ਫਿਰ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    hi: 'थोड़ा रुकें, फिर दोबारा कोशिश करें।',
    en: 'Wait a moment, then try again.',
  },
  errOffline: {
    pa: 'ਇੰਟਰਨੈੱਟ ਨਹੀਂ ਚੱਲ ਰਿਹਾ।',
    hi: 'इंटरनेट नहीं चल रहा।',
    en: 'No internet connection.',
  },
  continueOffline: {
    pa: 'ਬਿਨਾਂ ਲਾਗਇਨ ਅੱਗੇ ਵਧੋ',
    hi: 'बिना लॉगिन आगे बढ़ें',
    en: 'Continue without signing in',
  },
  offlineModeNote: {
    pa: 'ਖੇਤ ਨਾਪਣਾ ਬਿਨਾਂ ਲਾਗਇਨ ਵੀ ਚੱਲਦਾ ਹੈ। ਕੰਮ ਲੈਣ-ਦੇਣ ਲਈ ਲਾਗਇਨ ਚਾਹੀਦਾ ਹੈ।',
    hi: 'खेत नापना बिना लॉगिन भी चलता है। काम लेन-देन के लिए लॉगिन चाहिए।',
    en: 'Measuring fields works without signing in. Booking and taking work needs an account.',
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

  // — booking a job
  bookWork: { pa: 'ਕੰਮ ਕਰਵਾਓ', hi: 'काम करवाएँ', en: 'Book work' },
  pickField: { pa: 'ਕਿਹੜਾ ਖੇਤ?', hi: 'कौन सा खेत?', en: 'Which field?' },
  pickWork: { pa: 'ਕੀ ਕੰਮ ਕਰਵਾਉਣਾ ਹੈ?', hi: 'क्या काम करवाना है?', en: 'What work?' },
  whenWork: { pa: 'ਕਦੋਂ?', hi: 'कब?', en: 'When?' },
  now: { pa: 'ਹੁਣੇ', hi: 'अभी', en: 'Now' },
  today: { pa: 'ਅੱਜ', hi: 'आज', en: 'Today' },
  tomorrow: { pa: 'ਕੱਲ੍ਹ', hi: 'कल', en: 'Tomorrow' },
  morning: { pa: 'ਸਵੇਰੇ', hi: 'सुबह', en: 'Morning' },
  afternoon: { pa: 'ਦੁਪਹਿਰੇ', hi: 'दोपहर', en: 'Afternoon' },
  evening: { pa: 'ਸ਼ਾਮ ਨੂੰ', hi: 'शाम को', en: 'Evening' },
  anyTime: { pa: 'ਕਿਸੇ ਵੀ ਵੇਲੇ', hi: 'किसी भी समय', en: 'Any time' },
  typicalRate: { pa: 'ਨੇੜੇ ਦਾ ਆਮ ਰੇਟ', hi: 'आस-पास का आम रेट', en: 'Typical rate near you' },
  noRateData: {
    pa: 'ਰੇਟ ਕੈਪਟਨ ਨਾਲ ਗੱਲ ਕਰਕੇ ਤੈਅ ਹੋਵੇਗਾ।',
    hi: 'रेट कैप्टन से बात करके तय होगा।',
    en: 'The captain will quote you a rate.',
  },
  approxTotal: { pa: 'ਅੰਦਾਜ਼ਨ', hi: 'अनुमानित', en: 'Approximate' },
  approxNote: {
    pa: 'ਅਸਲ ਰਕਮ ਕੈਪਟਨ ਨਾਲ ਤੈਅ ਹੋਵੇਗੀ।',
    hi: 'असली रकम कैप्टन के साथ तय होगी।',
    en: 'The final amount is agreed with the captain.',
  },
  postJob: { pa: 'ਕੰਮ ਭੇਜੋ', hi: 'काम भेजें', en: 'Send request' },
  noFieldsToBook: {
    pa: 'ਪਹਿਲਾਂ ਖੇਤ ਨਾਪੋ, ਫਿਰ ਕੰਮ ਕਰਵਾ ਸਕਦੇ ਹੋ।',
    hi: 'पहले खेत नापें, फिर काम करवा सकते हैं।',
    en: 'Measure a field first, then you can book work.',
  },

  // — jobs
  myJobs: { pa: 'ਮੇਰੇ ਕੰਮ', hi: 'मेरे काम', en: 'My jobs' },
  workNearby: { pa: 'ਨੇੜੇ ਦਾ ਕੰਮ', hi: 'आस-पास का काम', en: 'Work nearby' },
  noJobs: { pa: 'ਅਜੇ ਕੋਈ ਕੰਮ ਨਹੀਂ।', hi: 'अभी कोई काम नहीं।', en: 'No jobs yet.' },
  noWorkNearby: {
    pa: 'ਹੁਣੇ ਕੋਈ ਕੰਮ ਨਹੀਂ। ਨਵਾਂ ਆਉਣ ਤੇ ਦਿਸੇਗਾ।',
    hi: 'अभी कोई काम नहीं। नया आने पर दिखेगा।',
    en: 'No work right now. New requests appear here.',
  },
  statusSearching: { pa: 'ਕੈਪਟਨ ਲੱਭ ਰਹੇ ਹਾਂ', hi: 'कैप्टन ढूँढ रहे हैं', en: 'Finding a captain' },
  statusAccepted: { pa: 'ਕੈਪਟਨ ਮਿਲ ਗਿਆ', hi: 'कैप्टन मिल गया', en: 'Captain assigned' },
  statusEnRoute: { pa: 'ਰਸਤੇ ਵਿੱਚ', hi: 'रास्ते में', en: 'On the way' },
  statusInProgress: { pa: 'ਕੰਮ ਚੱਲ ਰਿਹਾ ਹੈ', hi: 'काम चल रहा है', en: 'Work in progress' },
  statusCompleted: { pa: 'ਪੂਰਾ ਹੋਇਆ', hi: 'पूरा हुआ', en: 'Completed' },
  statusExpired: { pa: 'ਸਮਾਂ ਨਿਕਲ ਗਿਆ', hi: 'समय निकल गया', en: 'Lapsed' },
  expiredWhy: {
    pa: 'ਉਸ ਦਿਨ ਕੋਈ ਕੈਪਟਨ ਨਹੀਂ ਮਿਲਿਆ। ਲੋੜ ਹੋਵੇ ਤਾਂ ਨਵਾਂ ਕੰਮ ਪਾ ਦਿਓ।',
    hi: 'उस दिन कोई कैप्टन नहीं मिला। ज़रूरत हो तो नया काम डाल दें।',
    en: 'No captain was free that day. Post it again if you still need it.',
  },
  statusCancelled: { pa: 'ਰੱਦ', hi: 'रद्द', en: 'Cancelled' },
  accept: { pa: 'ਹਾਂ, ਕਰਾਂਗਾ', hi: 'हाँ, करूँगा', en: 'Accept' },
  decline: { pa: 'ਨਹੀਂ', hi: 'नहीं', en: 'Decline' },
  alreadyTaken: {
    pa: 'ਇਹ ਕੰਮ ਕਿਸੇ ਹੋਰ ਨੇ ਲੈ ਲਿਆ।',
    hi: 'यह काम किसी और ने ले लिया।',
    en: 'Another captain took this job.',
  },
  startWork: { pa: 'ਕੰਮ ਸ਼ੁਰੂ ਕਰੋ', hi: 'काम शुरू करें', en: 'Start work' },
  onMyWay: { pa: 'ਚੱਲ ਪਿਆ ਹਾਂ', hi: 'चल पड़ा हूँ', en: 'On my way' },
  markComplete: { pa: 'ਕੰਮ ਪੂਰਾ ਹੋਇਆ', hi: 'काम पूरा हुआ', en: 'Mark complete' },

  // Getting out of a job. The farmer's word is "cancel"; the captain's is
  // not — he is handing work back that the farmer still wants done, and
  // calling that cancelling would read as though he had ended it.
  cancelJob: { pa: 'ਕੰਮ ਰੱਦ ਕਰੋ', hi: 'काम रद्द करें', en: 'Cancel job' },
  cancelJobAsk: {
    pa: 'ਇਹ ਕੰਮ ਰੱਦ ਕਰਨਾ ਹੈ?',
    hi: 'यह काम रद्द करना है?',
    en: 'Cancel this job?',
  },
  releaseJob: { pa: 'ਮੈਂ ਨਹੀਂ ਕਰ ਸਕਦਾ', hi: 'मैं नहीं कर सकता', en: "I can't do it" },
  releaseJobAsk: {
    pa: 'ਕੰਮ ਵਾਪਸ ਕਰਨਾ ਹੈ? ਕਿਸੇ ਹੋਰ ਕੈਪਟਨ ਨੂੰ ਭੇਜ ਦਿਆਂਗੇ।',
    hi: 'काम वापस करना है? किसी और कैप्टन को भेज देंगे।',
    en: 'Hand this job back? We will offer it to another captain.',
  },
  keepIt: { pa: 'ਨਹੀਂ, ਰਹਿਣ ਦਿਓ', hi: 'नहीं, रहने दो', en: 'No, keep it' },
  tooLateToStop: {
    pa: 'ਕੰਮ ਸ਼ੁਰੂ ਹੋ ਚੁੱਕਾ ਹੈ। ਫ਼ੋਨ ਤੇ ਗੱਲ ਕਰੋ।',
    hi: 'काम शुरू हो चुका है। फ़ोन पर बात करें।',
    en: 'Work has already started. Settle it by phone.',
  },
  amountTaken: { pa: 'ਕਿੰਨੇ ਪੈਸੇ ਲਏ?', hi: 'कितने पैसे लिए?', en: 'Amount received' },
  payCash: { pa: 'ਨਕਦ', hi: 'नकद', en: 'Cash' },
  payUpi: { pa: 'UPI', hi: 'UPI', en: 'UPI' },
  payPending: { pa: 'ਬਾਅਦ ਵਿੱਚ', hi: 'बाद में', en: 'Later' },
  callFarmer: { pa: 'ਫ਼ੋਨ ਕਰੋ', hi: 'फ़ोन करें', en: 'Call' },
  awayKm: { pa: 'ਕਿ.ਮੀ. ਦੂਰ', hi: 'कि.मी. दूर', en: 'km away' },
  // What "finding a captain" is actually doing. Without this the farmer
  // cannot tell a slow answer from nobody having been asked at all.
  searchAsked: { pa: 'ਕੈਪਟਨਾਂ ਨੂੰ ਪੁੱਛਿਆ', hi: 'कैप्टन से पूछा', en: 'captains asked' },
  searchNobodyYet: {
    pa: 'ਹਾਲੇ ਕੋਈ ਕੈਪਟਨ ਨੇੜੇ ਨਹੀਂ — ਲੱਭ ਰਹੇ ਹਾਂ',
    hi: 'अभी कोई कैप्टन नज़दीक नहीं — ढूँढ रहे हैं',
    en: 'No captain nearby yet — still looking',
  },
  queuePosition: { pa: 'ਤੁਹਾਡਾ ਨੰਬਰ', hi: 'आपका नंबर', en: 'You are number' },
  around: { pa: 'ਲਗਭਗ', hi: 'लगभग', en: 'around' },

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
  // Founder dispatch (Stage 4.2). Staff only, but staff read Punjabi too.
  founderTitle: { pa: 'ਕੰਮ ਮਿਲਾਓ', hi: 'काम मिलाएँ', en: 'Match work' },
  founderNewJob: { pa: '+ ਕਿਸਾਨ ਲਈ ਨਵਾਂ ਕੰਮ', hi: '+ किसान के लिए नया काम', en: '+ New job for a farmer' },
  founderOpenJobs: { pa: 'ਖੁੱਲ੍ਹੇ ਕੰਮ', hi: 'खुले काम', en: 'Open jobs' },
  founderNoJobs: { pa: 'ਕੋਈ ਖੁੱਲ੍ਹਾ ਕੰਮ ਨਹੀਂ।', hi: 'कोई खुला काम नहीं।', en: 'No open jobs.' },
  founderLoadFailed: {
    pa: 'ਕੰਮ ਨਹੀਂ ਆਏ। ਸਿਗਨਲ ਵੇਖੋ ਤੇ ਹੇਠਾਂ ਖਿੱਚੋ।',
    hi: 'काम नहीं आए। सिग्नल देखें और नीचे खींचें।',
    en: 'Could not load jobs. Check signal and pull down to retry.',
  },
  founderFarmerPhone: { pa: 'ਕਿਸਾਨ ਦਾ ਫ਼ੋਨ', hi: 'किसान का फ़ोन', en: "Farmer's phone" },
  founderFarmerName: { pa: 'ਕਿਸਾਨ ਦਾ ਨਾਂ', hi: 'किसान का नाम', en: "Farmer's name" },
  founderVillage: { pa: 'ਪਿੰਡ', hi: 'गाँव', en: 'Village' },
  founderArea: { pa: 'ਰਕਬਾ', hi: 'रकबा', en: 'Area' },
  founderKilla: { pa: 'ਕਿੱਲੇ', hi: 'किल्ला', en: 'killa' },
  founderKanal: { pa: 'ਕਨਾਲ', hi: 'कनाल', en: 'kanal' },
  founderPin: {
    pa: 'ਨਕਸ਼ੇ ਨੂੰ ਖਿੱਚੋ ਤਾਂ ਕਿ ਪਿੰਨ ਖੇਤ ਉੱਤੇ ਆਵੇ',
    hi: 'नक्शा खिसकाएँ ताकि पिन खेत पर आए',
    en: 'Move the map so the pin sits on the field',
  },
  phoneSetup: { pa: 'ਫ਼ੋਨ ਤਿਆਰ ਕਰੋ', hi: 'फ़ोन तैयार करें', en: 'Phone setup' },
  phoneSetupHint: {
    pa: 'ਤਾਂ ਜੋ ਕੰਮ ਦੀ ਘੰਟੀ ਕਦੇ ਨਾ ਖੁੰਝੇ।',
    hi: 'ताकि काम की घंटी कभी न छूटे।',
    en: 'So you never miss a work call.',
  },
  phoneSetupWarn: {
    pa: '⚠ ਕੰਮ ਦੀ ਘੰਟੀ ਬੰਦ ਹੈ — ਠੀਕ ਕਰੋ',
    hi: '⚠ काम की घंटी बंद है — ठीक करें',
    en: '⚠ Work alerts are off — fix',
  },
  setupNotifications: { pa: 'ਸੂਚਨਾਵਾਂ ਚਾਲੂ', hi: 'सूचनाएँ चालू', en: 'Notifications allowed' },
  setupAlert: { pa: 'ਕੰਮ ਦੀ ਘੰਟੀ ਪੂਰੀ ਤਾਕਤ ਤੇ', hi: 'काम की घंटी पूरी ताकत पर', en: 'Work alert at full strength' },
  setupBattery: { pa: 'ਬੈਟਰੀ ਸੇਵਰ ਬੰਦ (ਜ਼ਮੀਂਦਾਰਾ ਲਈ)', hi: 'बैटरी सेवर बंद (ज़मींदारा के लिए)', en: 'Battery saver off for Zamindara' },
  setupBatteryHint: {
    pa: 'ਸੂਚੀ ਵਿੱਚ ਜ਼ਮੀਂਦਾਰਾ ਲੱਭੋ ਤੇ "ਪਾਬੰਦੀ ਨਹੀਂ" ਚੁਣੋ।',
    hi: 'सूची में ज़मींदारा ढूँढें और "प्रतिबंध नहीं" चुनें।',
    en: 'Find Zamindara in the list and choose "Don\'t optimise" / "No restrictions".',
  },
  setupAutostart: { pa: 'ਆਟੋਸਟਾਰਟ ਚਾਲੂ', hi: 'ऑटोस्टार्ट चालू', en: 'Autostart on' },
  setupAutostartHint: {
    pa: '"ਆਟੋਸਟਾਰਟ" ਜਾਂ "ਬੈਕਗ੍ਰਾਊਂਡ ਵਿੱਚ ਚੱਲਣ ਦਿਓ" ਲੱਭੋ ਤੇ ਚਾਲੂ ਕਰੋ। ਕਈ ਫ਼ੋਨਾਂ ਵਿੱਚ ਇਹ ਨਹੀਂ ਹੁੰਦਾ — ਤਾਂ "ਹੋ ਗਿਆ" ਦਬਾਓ।',
    hi: '"ऑटोस्टार्ट" या "बैकग्राउंड में चलने दें" ढूँढें और चालू करें। कई फ़ोन में यह नहीं होता — तो "हो गया" दबाएँ।',
    en: 'Find "Autostart" or "Allow background activity" and turn it on. Many phones have neither; then just tap Done.',
  },
  setupOpen: { pa: 'ਖੋਲ੍ਹੋ', hi: 'खोलें', en: 'Open' },
  setupFix: { pa: 'ਠੀਕ ਕਰੋ', hi: 'ठीक करें', en: 'Fix' },
  setupTicked: { pa: 'ਹੋ ਗਿਆ', hi: 'हो गया', en: 'Done' },
  testPing: { pa: '10 ਸਕਿੰਟ ਵਿੱਚ ਟੈਸਟ ਘੰਟੀ', hi: '10 सेकंड में टेस्ट घंटी', en: 'Test ping in 10 seconds' },
  testPingWait: {
    pa: 'ਹੁਣ ਫ਼ੋਨ ਲਾਕ ਕਰੋ ਤੇ ਸੁਣੋ…',
    hi: 'अब फ़ोन लॉक करें और सुनें…',
    en: 'Lock the phone now and listen…',
  },
  testPingTitle: { pa: 'ਜ਼ਮੀਂਦਾਰਾ ਟੈਸਟ', hi: 'ज़मींदारा टेस्ट', en: 'Zamindara test' },
  testPingBody: {
    pa: 'ਕੰਮ ਦੀ ਘੰਟੀ ਇਸ ਤਰ੍ਹਾਂ ਵੱਜੇਗੀ।',
    hi: 'काम की घंटी ऐसे बजेगी।',
    en: 'This is how a work request will ring.',
  },
  heardIt: { pa: 'ਸੁਣ ਗਈ', hi: 'सुन ली', en: 'I heard it' },
  didNotHear: { pa: 'ਨਹੀਂ ਸੁਣੀ', hi: 'नहीं सुनी', en: "I didn't" },
  didNotHearHint: {
    pa: 'ਉੱਪਰਲੀਆਂ ਸਾਰੀਆਂ ਲਾਈਨਾਂ ਮੁੜ ਵੇਖੋ ਤੇ ਫ਼ੋਨ ਦੀ ਆਵਾਜ਼ ਚਾਲੂ ਕਰੋ, ਫਿਰ ਦੁਬਾਰਾ ਟੈਸਟ ਕਰੋ।',
    hi: 'ऊपर की सभी पंक्तियाँ फिर देखें और फ़ोन की आवाज़ चालू करें, फिर दोबारा टेस्ट करें।',
    en: 'Check every line above and turn the phone\'s sound up, then test again.',
  },
  myRoute: { pa: 'ਮੇਰਾ ਰੂਟ', hi: 'मेरा रूट', en: 'My route' },
  routeHint: {
    pa: 'ਬਾਹਰ ਕੰਮ ਤੇ ਜਾ ਰਹੇ ਹੋ? ਦੱਸੋ ਕਿੱਥੇ ਤੇ ਕਦੋਂ — ਓਥੋਂ ਦੇ ਕੰਮ ਤੁਹਾਨੂੰ ਮਿਲਣਗੇ।',
    hi: 'बाहर काम पर जा रहे हैं? बताइए कहाँ और कब — वहाँ के काम आपको मिलेंगे।',
    en: 'Going away for work? Say where and when, and you will be offered work there.',
  },
  routeEmpty: { pa: 'ਕੋਈ ਥਾਂ ਨਹੀਂ ਜੋੜੀ।', hi: 'कोई जगह नहीं जोड़ी।', en: 'No stops yet.' },
  routeAdd: { pa: '+ ਥਾਂ ਜੋੜੋ', hi: '+ जगह जोड़ें', en: '+ Add a stop' },
  routePlace: { pa: 'ਥਾਂ ਦਾ ਨਾਂ (ਜਿਵੇਂ ਸਿਰਸਾ)', hi: 'जगह का नाम (जैसे सिरसा)', en: 'Place (e.g. Sirsa)' },
  routeFrom: { pa: 'ਕਦੋਂ ਤੋਂ', hi: 'कब से', en: 'From' },
  routeDays: { pa: 'ਕਿੰਨੇ ਦਿਨ', hi: 'कितने दिन', en: 'Days' },
  routePin: {
    pa: 'ਨਕਸ਼ਾ ਹਿਲਾ ਕੇ ਪਿੰਨ ਓਸ ਥਾਂ ਤੇ ਰੱਖੋ ਜਿੱਥੇ ਤੁਸੀਂ ਰਹੋਗੇ।',
    hi: 'नक्शा हिलाकर पिन उस जगह रखें जहाँ आप रहेंगे।',
    en: 'Move the map so the pin is where you will be based.',
  },
  routeOverlap: {
    pa: 'ਇਹ ਤਾਰੀਖਾਂ ਦੂਜੀ ਥਾਂ ਨਾਲ ਟਕਰਾਉਂਦੀਆਂ ਹਨ।',
    hi: 'ये तारीखें दूसरी जगह से टकराती हैं।',
    en: 'These dates overlap another stop.',
  },
  captainLogJob: { pa: '+ ਫ਼ੋਨ ਵਾਲਾ ਕੰਮ ਜੋੜੋ', hi: '+ फ़ोन वाला काम जोड़ें', en: '+ Add a phone booking' },
  measureField: { pa: 'ਖੇਤ ਨਾਪੋ', hi: 'खेत नापें', en: 'Measure the field' },
  founderCreate: { pa: 'ਕੰਮ ਬਣਾਓ', hi: 'काम बनाएँ', en: 'Create job' },
  founderMissing: {
    pa: 'ਫ਼ੋਨ, ਨਾਂ, ਕੰਮ ਅਤੇ ਰਕਬਾ ਭਰੋ।',
    hi: 'फ़ोन, नाम, काम और रकबा भरें।',
    en: 'Fill in phone, name, work and area.',
  },
  founderFailed: {
    pa: 'ਨਹੀਂ ਹੋਇਆ। ਸਿਗਨਲ ਵੇਖੋ ਤੇ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    hi: 'नहीं हुआ। सिग्नल देखें और फिर कोशिश करें।',
    en: 'That did not go through. Check signal and try again.',
  },
  founderAssign: { pa: 'ਕੈਪਟਨ ਚੁਣੋ', hi: 'कैप्टन चुनें', en: 'Choose captain' },
  founderNoCaptains: {
    pa: 'ਕੋਈ ਪੱਕਾ ਕੈਪਟਨ ਨਹੀਂ।',
    hi: 'कोई पक्का कैप्टन नहीं।',
    en: 'No verified captains yet.',
  },
  founderShare: { pa: 'ਵਟਸਐਪ ਤੇ ਭੇਜੋ', hi: 'व्हाट्सऐप पर भेजें', en: 'Share' },
  founderAmount: { pa: 'ਕਿੰਨੇ ਪੈਸੇ ਲੱਗੇ (₹)', hi: 'कितने पैसे लगे (₹)', en: 'Amount paid (₹)' },
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
  // Area disputes (4.4): one tap, once, never undone.
  sizeFloorNote: {
    pa: 'ਨੇੜਲੇ ਕੈਪਟਨ ਸਿਰਫ਼ {area} ਜਾਂ ਵੱਡੇ ਕੰਮ ਲੈਂਦੇ ਹਨ',
    hi: 'पास के कैप्टन सिर्फ़ {area} या बड़े काम लेते हैं',
    en: 'Captains nearby only take {area} or more',
  },
  minAreaLabel: { pa: 'ਘੱਟੋ-ਘੱਟ ਕਿੱਲੇ', hi: 'कम से कम किल्ले', en: 'Smallest job (killa)' },
  areaWrong: { pa: 'ਰਕਬਾ ਗਲਤ ਹੈ?', hi: 'रकबा गलत है?', en: 'Area wrong?' },
  areaWrongAsk: {
    pa: 'ਦਰਜ ਕਰੀਏ ਕਿ ਰਕਬਾ ਗਲਤ ਹੈ? ਇਹ ਵਾਪਸ ਨਹੀਂ ਹੁੰਦਾ।',
    hi: 'दर्ज करें कि रकबा गलत है? यह वापस नहीं होता।',
    en: 'Record that the area is wrong? This cannot be undone.',
  },
  areaDisputed: { pa: 'ਰਕਬੇ ਤੇ ਇਤਰਾਜ਼ ਦਰਜ ਹੈ', hi: 'रकबे पर आपत्ति दर्ज है', en: 'Area disputed' },
  papersArea: { pa: 'ਕਾਗਜ਼ਾਂ ਵਿੱਚ', hi: 'कागज़ों में', en: 'On papers' },
  papersAreaAdd: { pa: '+ ਕਾਗਜ਼ਾਂ ਵਾਲਾ ਰਕਬਾ', hi: '+ कागज़ों वाला रकबा', en: '+ Area on my papers' },

  // — permissions and errors
  needLocation: {
    pa: 'ਖੇਤ ਨਾਪਣ ਲਈ ਲੋਕੇਸ਼ਨ ਦੀ ਇਜਾਜ਼ਤ ਚਾਹੀਦੀ ਹੈ।',
    hi: 'खेत नापने के लिए लोकेशन की अनुमति चाहिए।',
    en: 'Zamindara needs location access to measure your field.',
  },
  grantPermission: { pa: 'ਇਜਾਜ਼ਤ ਦਿਓ', hi: 'अनुमति दें', en: 'Allow' },
  // On a bad signal the accept keeps trying; until the server says yes he
  // must not believe the job is his.
  sendingAccept: { pa: 'ਭੇਜ ਰਹੇ ਹਾਂ…', hi: 'भेज रहे हैं…', en: 'Sending…' },
  acceptDropped: {
    pa: 'ਸਿਗਨਲ ਨਹੀਂ ਮਿਲਿਆ, ਇਹ ਕੰਮ ਹੁਣ ਤੁਹਾਡੇ ਲਈ ਨਹੀਂ ਹੈ।',
    hi: 'सिग्नल नहीं मिला, यह काम अब आपके लिए नहीं है।',
    en: 'No signal reached the server. This job is no longer yours to take.',
  },
  // No store, so an update is a sentence and a link, not a badge.
  updateAvailable: {
    pa: 'ਨਵਾਂ ਵਰਜ਼ਨ ਆਇਆ ਹੈ',
    hi: 'नया वर्ज़न आया है',
    en: 'A newer version is available',
  },
  updateRequired: {
    pa: 'ਇਹ ਵਰਜ਼ਨ ਪੁਰਾਣਾ ਹੈ। ਨਵਾਂ ਪਾਉਣਾ ਪਵੇਗਾ।',
    hi: 'यह वर्ज़न पुराना है। नया डालना पड़ेगा।',
    en: 'This version is too old. You will need the new one.',
  },
  getUpdate: { pa: 'ਡਾਊਨਲੋਡ ਕਰੋ', hi: 'डाउनलोड करें', en: 'Download' },

  // Rating. One question, five taps, no comment box: he is asked once, on
  // the card, right after the work is done.
  howWasWork: { pa: 'ਕੰਮ ਕਿਹੋ ਜਿਹਾ ਰਿਹਾ?', hi: 'काम कैसा रहा?', en: 'How was the work?' },
  // Why the total moved once a captain took the job. Silence here would
  // read as the app having quietly put the price up.
  travelFrom: { pa: 'ਆਉਣ ਦਾ ਖ਼ਰਚ', hi: 'आने का खर्च', en: 'Travel' },
  workCharge: { pa: 'ਕੰਮ ਦਾ', hi: 'काम का', en: 'Work' },

  yourRating: { pa: 'ਤੁਹਾਡੀ ਰੇਟਿੰਗ', hi: 'आपकी रेटिंग', en: 'Your rating' },

  exitFailed: {
    pa: 'ਨਹੀਂ ਹੋ ਸਕਿਆ। ਸਿਗਨਲ ਵੇਖੋ ਤੇ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    hi: 'नहीं हो सका। सिग्नल देखें और फिर कोशिश करें।',
    en: 'Could not do it. Check your signal and try again.',
  },
  recovered: {
    pa: 'ਪਿਛਲਾ ਅਧੂਰਾ ਨਾਪ ਮਿਲਿਆ',
    hi: 'पिछला अधूरा नाप मिला',
    en: 'Unfinished measurement recovered',
  },
} as const;

export type StringKey = keyof typeof strings;

/**
 * Exposed for the completeness test only.
 *
 * "A screen isn't done until it's complete in Punjabi" is standing rule 3
 * in BUILD_PLAN, and until now nothing checked it — a missing Gurmukhi
 * string would have reached a captain's phone as English, or as nothing.
 */
export const ALL_STRINGS: Readonly<Record<string, Record<string, string>>> = strings;

export function t(key: StringKey, locale: Locale = 'pa'): string {
  return strings[key][locale];
}

/** Suggested field names, in the farmer's own language. */
export const FIELD_NAME_SUGGESTIONS: Record<Locale, string[]> = {
  pa: ['ਨਹਿਰ ਵਾਲਾ ਖੇਤ', 'ਘਰ ਦੇ ਪਿੱਛੇ', 'ਵੱਡਾ ਖੇਤ', 'ਸੜਕ ਵਾਲਾ'],
  hi: ['नहर वाला खेत', 'घर के पीछे', 'बड़ा खेत', 'सड़क वाला'],
  en: ['Canal field', 'Behind the house', 'Big field', 'Roadside'],
};
