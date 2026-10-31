import { describe, expect, it } from 'vitest';
import { searchState, type Job } from './jobs';

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
