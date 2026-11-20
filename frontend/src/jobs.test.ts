import { describe, expect, it } from 'vitest';
import {
  canCancel,
  isLive,
  canRelease,
  completedRates,
  ratingAsk,
  searchState,
  type Job,
} from './jobs';
import { canCall, canRetrace, canWiden, farmerClockNeeded, machineLabels, nearbyBanner, splitJobs, telUrl, trackedJobIds } from './jobs';

describe('canRetrace (4.3)', () => {
  const j = (status: Job['status'], fieldDeclared: boolean) => ({ status, fieldDeclared }) as Job;
  it('a declared field, while the job is his to work', () => {
    expect(canRetrace(j('accepted', true))).toBe(true);
    expect(canRetrace(j('in_progress', true))).toBe(true);
  });
  it('never a field someone already measured, nor a finished job', () => {
    expect(canRetrace(j('accepted', false))).toBe(false);
    expect(canRetrace(j('completed', true))).toBe(false);
  });
});

describe('machineLabels (4.6)', () => {
  const m = (id: string, machineCode: string) =>
    ({ id, machineCode, ownership: 'owned', leadTimeHours: 0, withOperatorOnly: false }) as const;
  it('numbers only the kinds he has more than one of', () => {
    const labels = machineLabels(
      [m('a', 'combine'), m('b', 'tractor'), m('c', 'combine')],
      (code) => (code === 'combine' ? 'ਕੰਬਾਈਨ' : 'ਟਰੈਕਟਰ'),
    );
    expect([...labels]).toEqual([
      ['a', 'ਕੰਬਾਈਨ 1'],
      ['c', 'ਕੰਬਾਈਨ 2'],
    ]);
  });
});

const job: Job = {
  id: 'j1',
  fieldId: 'f1',
  fieldName: 'Nehar wala khet',
  village: 'Roshan Wala',
  serviceCode: 'wheat_harvest',
  areaSqm: 8093,
  status: 'searching',
  isImmediate: true,
  scheduledDate: null,
  window: 'any',
  quotedRate: 1200,
  quotedUnit: 'per_killa',
  quotedSubtotal: 2400,
  travelCharge: 0,
  quotedTotal: 2400,
  captainName: null,
  distanceKm: null,
  offeredCount: null,
  captainId: null,
  myRating: null,
  finalAmount: null,
  paymentMode: null,
  notes: '',
  createdAt: 1,
  acceptedAt: null,
  startedAt: null,
  completedAt: null,
};

describe('searchState', () => {
  it('says nothing once a captain has it — the status line already does', () => {
    expect(searchState({ ...job, status: 'accepted', offeredCount: 3 })).toBeNull();
  });

  it('admits it does not know rather than claiming nobody was asked', () => {
    expect(searchState(job)).toEqual({ kind: 'unknown' });
  });

  it('separates "asked nobody" from "asked and waiting"', () => {
    expect(searchState({ ...job, offeredCount: 0 })).toEqual({ kind: 'nobody-yet' });
    expect(searchState({ ...job, offeredCount: 2 })).toEqual({ kind: 'offered', count: 2 });
  });
});

describe('completedRates', () => {
  const KILLA = 4046.8564224;
  const paid = (over: Partial<Job>): Job => ({
    ...job,
    status: 'completed',
    areaSqm: KILLA,
    quotedRate: 1200,
    completedAt: 10,
    ...over,
  });

  it('reports what was paid, not what was quoted', () => {
    // The guide said 1200 and he settled at 900. Reading quotedRate here
    // fed 1200 back to the next farmer, so the guide could only ever rise.
    expect(completedRates([paid({ finalAmount: 900 })], 'wheat_harvest')).toEqual([900]);
  });

  it('takes travel off first — it is a distance charge, not a work rate', () => {
    expect(
      completedRates([paid({ finalAmount: 1100, travelCharge: 200 })], 'wheat_harvest'),
    ).toEqual([900]);
  });

  it('is per killa, not per job', () => {
    expect(
      completedRates([paid({ areaSqm: KILLA * 3, finalAmount: 2700 })], 'wheat_harvest'),
    ).toEqual([900]);
  });

  it('ignores a job nobody paid for, and one that did not cover the travel', () => {
    expect(
      completedRates(
        [paid({ finalAmount: null }), paid({ finalAmount: 100, travelCharge: 200 })],
        'wheat_harvest',
      ),
    ).toEqual([]);
  });

  it('newest first, so recency wins when the list is trimmed', () => {
    expect(
      completedRates(
        [
          paid({ finalAmount: 800, completedAt: 1 }),
          paid({ finalAmount: 1000, completedAt: 9 }),
        ],
        'wheat_harvest',
      ),
    ).toEqual([1000, 800]);
  });
});

describe('who may get out of a job', () => {
  const at = (status: Job['status']): Job => ({ ...job, status });

  it('lets the farmer withdraw until the machine starts', () => {
    expect(['searching', 'accepted', 'en_route'].map((st) => canCancel(at(st as Job['status']))))
      .toEqual([true, true, true]);
  });

  it('lets the captain hand back only work he took and has not started', () => {
    expect(canRelease(at('searching'))).toBe(false); // not his yet
    expect(canRelease(at('accepted'))).toBe(true);
    expect(canRelease(at('en_route'))).toBe(true);
  });

  it('gives neither of them a button once the machine is in the field', () => {
    // Diesel has been burned. What is being asked for then is a settlement,
    // and the database refuses it either way — this only hides the button.
    for (const status of ['in_progress', 'completed', 'cancelled'] as const) {
      expect(canCancel(at(status))).toBe(false);
      expect(canRelease(at(status))).toBe(false);
    }
  });
});

describe('ratingAsk', () => {
  const done: Job = {
    ...job,
    status: 'completed',
    captainId: '33333333-3333-3333-3333-333333333333',
    captainName: 'Jaspal',
    completedAt: 20,
  };

  it('asks the farmer about the captain once the work is done', () => {
    expect(ratingAsk(done, false)).toBe('33333333-3333-3333-3333-333333333333');
  });

  it('does not ask twice — that reads as the app having lost his answer', () => {
    expect(ratingAsk({ ...done, myRating: 4 }, false)).toBeNull();
  });

  it('does not ask before the work is finished', () => {
    expect(ratingAsk({ ...done, status: 'in_progress' }, false)).toBeNull();
  });

  it('does not ask the captain to rate the farmer — that is not what was broken', () => {
    // Two-way reputation is a Phase 7 question and buys dispatch nothing:
    // the farmer is not ranked by anything.
    expect(ratingAsk(done, true)).toBeNull();
  });
});

describe('a lapsed job', () => {
  const lapsed: Job = { ...job, status: 'expired' };

  it('is not live, so it leaves the list of things still happening', () => {
    expect(isLive(lapsed)).toBe(false);
  });

  it('offers no way out, because there is nothing left to get out of', () => {
    expect(canCancel(lapsed)).toBe(false);
    expect(canRelease(lapsed)).toBe(false);
  });

  it('stops claiming to be looking for a captain', () => {
    expect(searchState(lapsed)).toBeNull();
  });
});

describe('splitJobs — what goes where on home', () => {
  const me = { id: 'me', fullName: 'Gurpreet Singh', isOnline: true, captain: true };
  const j = (over: Partial<Job>): Job =>
    ({ id: over.id ?? 'x', fieldId: 'f-other', status: 'searching', captainId: null, captainName: null, ...over }) as Job;

  it('his own posted job is not offered back to him as nearby work', () => {
    const s = splitJobs([j({ id: 'own', fieldId: 'f-mine' }), j({ id: 'offer' })], me, new Set(['f-mine']));
    expect(s.incoming.map((x) => x.id)).toEqual(['offer']);
    expect(s.myJobs.map((x) => x.id)).toEqual(['own']);
  });

  it('a job he holds is in his queue, matched by id, not by name', () => {
    const s = splitJobs(
      [
        j({ id: 'mine', status: 'accepted', captainId: 'me', captainName: 'Gurpreet Singh' }),
        // Another captain with the same name — common in Punjab.
        j({ id: 'namesake', status: 'accepted', captainId: 'other', captainName: 'Gurpreet Singh' }),
      ],
      me,
      new Set(),
    );
    expect(s.captainQueue.map((x) => x.id)).toEqual(['mine']);
  });

  it('offline on-device jobs with no id still match by name', () => {
    const s = splitJobs([j({ id: 'local', status: 'accepted', captainName: 'Gurpreet Singh' })], me, new Set());
    expect(s.captainQueue.map((x) => x.id)).toEqual(['local']);
  });

  it('offline captain gets no incoming; a farmer-only user sees all his jobs', () => {
    expect(splitJobs([j({})], { ...me, isOnline: false }, new Set()).incoming).toEqual([]);
    const farmer = { ...me, captain: false };
    expect(splitJobs([j({ id: 'a' })], farmer, new Set()).myJobs.map((x) => x.id)).toEqual(['a']);
  });
});

describe('the call button (batch A)', () => {
  const j = (status: Job['status'], contactPhone: string | null) => ({ status, contactPhone }) as Job;
  it('while the job is live between them', () => {
    expect(canCall(j('accepted', '919876500002'))).toBe(true);
    expect(canCall(j('en_route', '919876500002'))).toBe(true);
    expect(canCall(j('in_progress', '919876500002'))).toBe(true);
  });
  it('not on an open offer, a finished job, or with no number', () => {
    expect(canCall(j('searching', '919876500002'))).toBe(false);
    expect(canCall(j('completed', '919876500002'))).toBe(false);
    expect(canCall(j('accepted', null))).toBe(false);
  });
  it('dials the number as stored, with its country code', () => {
    expect(telUrl('919876500002')).toBe('tel:+919876500002');
  });
});

describe('dispatch rounds (batch B)', () => {
  const j = (over: Partial<Job>) => ({ status: 'searching', isImmediate: true, fieldId: 'f1', ...over }) as Job;
  it('the farmer may widen an exhausted "now" search, up to 30 km', () => {
    expect(canWiden(j({ searchExhaustedAt: 1, searchExtraKm: 0 }))).toBe(true);
    expect(canWiden(j({ searchExhaustedAt: 1, searchExtraKm: 30 }))).toBe(false);
    expect(canWiden(j({ searchExhaustedAt: null, searchExtraKm: 0 }))).toBe(false);
    expect(canWiden(j({ searchExhaustedAt: 1, status: 'accepted' }))).toBe(false);
  });
  it('the 30-second clock runs only while one of his own "now" jobs is searching', () => {
    const mine = new Set(['f1']);
    expect(farmerClockNeeded([j({})], mine)).toBe(true);
    // An offer on someone else's field, on a captain's phone.
    expect(farmerClockNeeded([j({ fieldId: 'other' })], mine)).toBe(false);
    expect(farmerClockNeeded([j({ isImmediate: false })], mine)).toBe(false);
    expect(farmerClockNeeded([j({ status: 'accepted' })], mine)).toBe(false);
    // Exhausted: nothing left to run until he widens it.
    expect(farmerClockNeeded([j({ searchExhaustedAt: 1 })], mine)).toBe(false);
  });
});

describe('available now, and the live job (batch C)', () => {
  const j = (over: Partial<Job>) => ({ status: 'searching', isImmediate: true, fieldId: 'f1', ...over }) as Job;
  it('the farmer clock also runs while his captain is on the way or working', () => {
    const mine = new Set(['f1']);
    expect(farmerClockNeeded([j({ status: 'en_route' })], mine)).toBe(true);
    expect(farmerClockNeeded([j({ status: 'in_progress', isImmediate: false })], mine)).toBe(true);
    expect(farmerClockNeeded([j({ status: 'completed' })], mine)).toBe(false);
  });
  it('a captain reports his position only for his own live jobs', () => {
    const jobs = [
      j({ id: 'a', status: 'en_route', captainId: 'me' }),
      j({ id: 'b', status: 'accepted', captainId: 'me' }),
      j({ id: 'c', status: 'in_progress', captainId: 'other' }),
      j({ id: 'd', status: 'in_progress', captainId: 'me' }),
    ];
    expect(trackedJobIds(jobs, 'me')).toEqual(['a', 'd']);
  });
  it('the banner names in-season machines that are free, most first, at most two', () => {
    // April: wheat harvest (combine) and straw (straw_reaper) are in season; a rotavator is not.
    const shown = nearbyBanner({ combine: 2, straw_reaper: 1, rotavator: 4, baler: 0 }, 4);
    expect(shown).toEqual([{ machineCode: 'combine', count: 2 }, { machineCode: 'straw_reaper', count: 1 }]);
    expect(nearbyBanner({}, 4)).toEqual([]);
  });
});
