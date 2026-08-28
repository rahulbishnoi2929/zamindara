import { SQM } from '@zamindara/units';
import { describe, expect, it } from 'vitest';
import { quote, rateGuidance, roadKm, round2 } from '../src/quote.js';

/** 2 killa 3 kanal 8 marla — the worked example used throughout the docs. */
const EXAMPLE_SQM = 388 * 25.29285264;

describe('the worked example from the docs', () => {
  it('prices 2 killa 3 kanal 8 marla at 1,100 per killa, captain 9 km out', () => {
    const q = quote({
      areaSqm: EXAMPLE_SQM,
      rate: 1100,
      unit: 'per_killa',
      distanceKm: 9,
      travelRatePerKm: 50,
    });

    // Every figure here appears in docs/PRICING.md. If one of them moves,
    // the documentation is now lying to a farmer.
    expect(q.areaInUnit).toBeCloseTo(2.425, 3);
    expect(q.subtotal).toBe(2667.5);
    expect(q.chargeableKm).toBe(4);
    expect(q.travelCharge).toBe(200);
    expect(q.total).toBe(2867.5);
  });
});

describe('the travel charge', () => {
  it('is nothing inside the free radius', () => {
    const q = quote({
      areaSqm: SQM.killa,
      rate: 1000,
      unit: 'per_killa',
      distanceKm: 5,
      travelRatePerKm: 50,
    });
    expect(q.travelCharge).toBe(0);
    expect(q.total).toBe(1000);
  });

  it('charges only the distance beyond it', () => {
    const q = quote({
      areaSqm: SQM.killa,
      rate: 1000,
      unit: 'per_killa',
      distanceKm: 12,
      travelRatePerKm: 50,
    });
    expect(q.chargeableKm).toBe(7);
    expect(q.travelCharge).toBe(350);
  });

  it('never goes negative for a captain in the same village', () => {
    const q = quote({
      areaSqm: SQM.killa,
      rate: 1000,
      unit: 'per_killa',
      distanceKm: 0.4,
      travelRatePerKm: 50,
    });
    expect(q.travelCharge).toBe(0);
  });

  it('respects a region with a different free radius', () => {
    const q = quote({
      areaSqm: SQM.killa,
      rate: 1000,
      unit: 'per_killa',
      distanceKm: 12,
      freeDistanceKm: 10,
      travelRatePerKm: 50,
    });
    expect(q.travelCharge).toBe(100);
  });

  it('costs more to bring a combine than a trolley', () => {
    const common = {
      areaSqm: SQM.killa,
      rate: 1000,
      unit: 'per_killa' as const,
      distanceKm: 15,
    };
    const combine = quote({ ...common, travelRatePerKm: 60 });
    const trolley = quote({ ...common, travelRatePerKm: 35 });
    expect(combine.travelCharge).toBeGreaterThan(trolley.travelCharge);
  });
});

describe('pricing units', () => {
  it('prices per killa from the area', () => {
    const q = quote({
      areaSqm: SQM.killa * 3,
      rate: 1200,
      unit: 'per_killa',
      distanceKm: 0,
      travelRatePerKm: 40,
    });
    expect(q.subtotal).toBe(3600);
  });

  it('prices a flat job regardless of area', () => {
    const q = quote({
      areaSqm: SQM.killa * 9,
      rate: 800,
      unit: 'per_job',
      distanceKm: 0,
      travelRatePerKm: 40,
    });
    expect(q.subtotal).toBe(800);
  });

  it('refuses to guess at hourly work', () => {
    // Levelling and earthwork cannot be known before the job is done.
    // Inventing a figure would be worse than admitting we do not have one.
    for (const unit of ['per_hour', 'per_day'] as const) {
      const q = quote({
        areaSqm: SQM.killa,
        rate: 900,
        unit,
        distanceKm: 8,
        travelRatePerKm: 50,
      });
      expect(q.subtotal).toBeNull();
      expect(q.total).toBeNull();
      expect(q.isEstimatable).toBe(false);
      // The travel charge is still known, and still shown.
      expect(q.travelCharge).toBe(150);
    }
  });

  it('shows no figure when the captain has not set a rate', () => {
    const q = quote({
      areaSqm: SQM.killa,
      rate: null,
      unit: 'per_killa',
      distanceKm: 3,
      travelRatePerKm: 40,
    });
    expect(q.subtotal).toBeNull();
    expect(q.isEstimatable).toBe(false);
  });
});

describe('rounding', () => {
  it('lands on whole paisa', () => {
    const q = quote({
      areaSqm: 1234.567,
      rate: 1133,
      unit: 'per_killa',
      distanceKm: 7.3,
      travelRatePerKm: 47,
    });
    for (const value of [q.subtotal, q.travelCharge, q.total]) {
      if (value !== null) expect(Number.isInteger(round2(value) * 100)).toBe(true);
    }
  });

  it('rounds half away from zero, as Postgres does', () => {
    expect(round2(2.675)).toBe(2.68);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.125)).toBe(0.13);
  });

  it('adds travel after rounding the subtotal, matching the SQL', () => {
    // quote_job rounds the subtotal, rounds the travel charge, then rounds
    // the sum. Doing it in a different order can differ by a paisa, and a
    // paisa of disagreement between app and server is a support call.
    const q = quote({
      areaSqm: SQM.killa * 1.005,
      rate: 999.99,
      unit: 'per_killa',
      distanceKm: 6.5,
      travelRatePerKm: 33.33,
    });
    expect(q.total).toBe(round2(q.subtotal! + q.travelCharge));
  });
});

describe('bad input', () => {
  it('rejects a zero or negative area', () => {
    const base = { rate: 100, unit: 'per_killa' as const, distanceKm: 1, travelRatePerKm: 40 };
    expect(() => quote({ ...base, areaSqm: 0 })).toThrow(RangeError);
    expect(() => quote({ ...base, areaSqm: -5 })).toThrow(RangeError);
    expect(() => quote({ ...base, areaSqm: NaN })).toThrow(RangeError);
  });

  it('rejects a negative distance', () => {
    expect(() =>
      quote({
        areaSqm: SQM.killa,
        rate: 100,
        unit: 'per_killa',
        distanceKm: -1,
        travelRatePerKm: 40,
      }),
    ).toThrow(RangeError);
  });
});

describe('road distance', () => {
  it('applies the winding factor', () => {
    expect(roadKm(10000)).toBe(13);
    expect(roadKm(0)).toBe(0);
  });
});

describe('rate guidance', () => {
  it('reports the interquartile range', () => {
    const g = rateGuidance([1000, 1100, 1200, 1300, 1400])!;
    expect(g.low).toBe(1100);
    expect(g.high).toBe(1300);
    expect(g.sampleSize).toBe(5);
  });

  it('stays quiet on too small a sample', () => {
    // Two jobs is one man's opinion dressed up as data.
    expect(rateGuidance([1200, 1300])).toBeNull();
    expect(rateGuidance([])).toBeNull();
  });

  it('ignores nonsense rates', () => {
    expect(rateGuidance([1000, 1100, 1200, -5, NaN])!.sampleSize).toBe(3);
  });

  it('is not dragged around by one outlier', () => {
    // One captain charging ten times the going rate must not make the range
    // look like that is normal.
    const normal = rateGuidance([1000, 1100, 1150, 1200, 1250])!;
    const withOutlier = rateGuidance([1000, 1100, 1150, 1200, 1250, 12000])!;
    expect(withOutlier.high).toBeLessThan(normal.high * 1.5);
  });
});
