import { describe, expect, it } from 'vitest';
import { ACRE_SQM, MARLA_SQM, SQM } from '../src/constants.js';
import { convert, fromSqm, toSqm, toWholeMarla } from '../src/convert.js';

describe('toSqm', () => {
  it('converts each unit', () => {
    expect(toSqm(1, 'killa')).toBeCloseTo(4046.8564, 4);
    expect(toSqm(1, 'bigha')).toBeCloseTo(2529.2853, 4);
    expect(toSqm(1, 'kanal')).toBeCloseTo(505.857, 3);
    expect(toSqm(1, 'marla')).toBeCloseTo(25.2929, 4);
  });

  it('handles zero and fractions', () => {
    expect(toSqm(0, 'killa')).toBe(0);
    expect(toSqm(2.5, 'killa')).toBeCloseTo(2.5 * ACRE_SQM, 6);
  });

  it('rejects non-finite input', () => {
    expect(() => toSqm(NaN, 'killa')).toThrow(TypeError);
    expect(() => toSqm(Infinity, 'killa')).toThrow(TypeError);
  });
});

describe('fromSqm', () => {
  it('is the inverse of toSqm', () => {
    for (const unit of ['marla', 'kanal', 'bigha', 'killa'] as const) {
      for (const amount of [0.5, 1, 3, 17.25, 400]) {
        expect(fromSqm(toSqm(amount, unit), unit)).toBeCloseTo(amount, 10);
      }
    }
  });

  it('gives the decimal form pricing needs', () => {
    // (area ÷ unit) × rate — the only place a decimal area is acceptable.
    expect(fromSqm(SQM.killa * 2.4, 'killa')).toBeCloseTo(2.4, 10);
  });
});

describe('convert', () => {
  it('moves between units', () => {
    expect(convert(1, 'killa', 'kanal')).toBeCloseTo(8, 10);
    expect(convert(1, 'bigha', 'kanal')).toBeCloseTo(5, 10);
    expect(convert(1, 'kanal', 'marla')).toBeCloseTo(20, 10);
    expect(convert(160, 'marla', 'killa')).toBeCloseTo(1, 10);
  });

  it('round-trips', () => {
    expect(convert(convert(7, 'killa', 'marla'), 'marla', 'killa')).toBeCloseTo(7, 10);
  });
});

describe('toWholeMarla', () => {
  it('rounds to the nearest marla', () => {
    expect(toWholeMarla(MARLA_SQM * 3.4)).toBe(3);
    expect(toWholeMarla(MARLA_SQM * 3.6)).toBe(4);
    expect(toWholeMarla(0)).toBe(0);
  });

  it('rejects negative area', () => {
    // A negative area means the geometry pipeline produced a self-intersecting
    // or wrongly-wound polygon. Fail loudly rather than bill on it.
    expect(() => toWholeMarla(-1)).toThrow(RangeError);
  });

  it('rejects non-finite input', () => {
    expect(() => toWholeMarla(NaN)).toThrow(TypeError);
  });
});
