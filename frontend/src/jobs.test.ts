import { describe, expect, it } from 'vitest';
import {
  canCancel,
  canRelease,
  completedRates,
  ratingAsk,
  searchState,
  type Job,
} from './jobs';

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
