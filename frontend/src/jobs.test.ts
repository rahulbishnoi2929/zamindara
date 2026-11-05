import { describe, expect, it } from 'vitest';
import { completedRates, searchState, type Job } from './jobs';

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
