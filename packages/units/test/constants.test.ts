import { describe, expect, it } from 'vitest';
import {
  ACRE_SQM,
  KILLA_LONG_SIDE_M,
  KILLA_SHORT_SIDE_M,
  MARLA,
  SQM,
  UNITS,
} from '../src/constants.js';

describe('the unit ladder', () => {
  it('holds the relationships the founder specified', () => {
    expect(MARLA.killa / MARLA.kanal).toBe(8); // 1 killa = 8 kanal
    expect(MARLA.bigha / MARLA.kanal).toBe(5); // 1 bigha = 5 kanal
    expect(MARLA.kanal / MARLA.marla).toBe(20); // 1 kanal = 20 marla
    expect(MARLA.killa / MARLA.marla).toBe(160); // 1 killa = 160 marla
  });

  it('makes every unit a whole number of marlas', () => {
    // This is what lets decomposition be integer arithmetic.
    for (const unit of UNITS) {
      expect(Number.isInteger(MARLA[unit])).toBe(true);
    }
  });

  it('makes one killa exactly one acre', () => {
    expect(SQM.killa).toBeCloseTo(ACRE_SQM, 6);
  });

  it('makes a bigha five-eighths of a killa', () => {
    expect(SQM.bigha / SQM.killa).toBeCloseTo(0.625, 10);
  });
});

describe('canal-colony grid geometry', () => {
  it('makes a standard killa plot 198 ft by 220 ft', () => {
    const FT = 0.3048;
    expect(KILLA_SHORT_SIDE_M).toBeCloseTo(198 * FT, 6);
    expect(KILLA_LONG_SIDE_M).toBeCloseTo(220 * FT, 6);
  });

  it('makes that rectangle exactly one acre', () => {
    // 36 karam x 40 karam is the murabba-grid killa. If this drifts,
    // grid snapping in the boundary walk silently mis-sizes every field.
    expect(KILLA_SHORT_SIDE_M * KILLA_LONG_SIDE_M).toBeCloseTo(ACRE_SQM, 4);
  });
});
