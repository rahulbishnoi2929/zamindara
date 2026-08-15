import { describe, expect, it } from 'vitest';
import { MARLA_SQM } from '../src/constants.js';
import { areaParts, formatArea, formatAreaShort } from '../src/format.js';

/** Build an exact area from whole units, so expectations are unambiguous. */
const from = (killa: number, kanal: number, marla: number): number =>
  (killa * 160 + kanal * 20 + marla) * MARLA_SQM;

describe('formatArea', () => {
  it('reads the way a jamabandi reads', () => {
    expect(formatArea(from(2, 3, 8), { locale: 'en' })).toBe('2 killa 3 kanal 8 marla');
  });

  it('never returns a decimal', () => {
    // The whole point of the package. 2.4 killa is not a thing a farmer
    // has ever seen on a document.
    for (let sqm = 0; sqm < 50_000; sqm += 137) {
      expect(formatArea(sqm, { locale: 'en' })).not.toMatch(/\d\.\d/);
    }
  });

  it('omits zero components', () => {
    expect(formatArea(from(2, 0, 8), { locale: 'en' })).toBe('2 killa 8 marla');
    expect(formatArea(from(0, 3, 0), { locale: 'en' })).toBe('3 kanal');
    expect(formatArea(from(1, 0, 0), { locale: 'en' })).toBe('1 killa');
  });

  it('shows marla alone below one kanal', () => {
    expect(formatArea(from(0, 0, 12), { locale: 'en' })).toBe('12 marla');
  });

  it('handles zero', () => {
    expect(formatArea(0, { locale: 'en' })).toBe('0 marla');
  });

  describe('rounding carries instead of overflowing', () => {
    // The bug this package exists to prevent. Rounding at the end of a
    // decomposition would render these as "3 kanal 20 marla" and
    // "0 killa 8 kanal" — both nonsense, both plausible-looking.

    it('carries 19.6 marla into a full kanal', () => {
      expect(formatArea(79.6 * MARLA_SQM, { locale: 'en' })).toBe('4 kanal');
    });

    it('carries 159.7 marla into a full killa', () => {
      expect(formatArea(159.7 * MARLA_SQM, { locale: 'en' })).toBe('1 killa');
    });

    it('never emits a component at or above its parent', () => {
      for (let marla = 0; marla < 2000; marla += 1) {
        const parts = areaParts(marla * MARLA_SQM + MARLA_SQM * 0.49);
        const kanal = parts.find((p) => p.unit === 'kanal')?.amount ?? 0;
        const m = parts.find((p) => p.unit === 'marla')?.amount ?? 0;
        expect(kanal).toBeLessThan(8);
        expect(m).toBeLessThan(20);
      }
    });
  });

  describe('display chains', () => {
    it('decomposes the same area either way', () => {
      const sqm = from(2, 3, 8);
      expect(formatArea(sqm, { chain: 'killa', locale: 'en' })).toBe('2 killa 3 kanal 8 marla');
      expect(formatArea(sqm, { chain: 'bigha', locale: 'en' })).toBe('3 bigha 4 kanal 8 marla');
    });

    it('never mixes bigha and killa in one string', () => {
      for (let sqm = 0; sqm < 80_000; sqm += 311) {
        const killaChain = formatArea(sqm, { chain: 'killa', locale: 'en' });
        const bighaChain = formatArea(sqm, { chain: 'bigha', locale: 'en' });
        expect(killaChain).not.toContain('bigha');
        expect(bighaChain).not.toContain('killa');
      }
    });
  });

  describe('locales', () => {
    it('renders Punjabi in Gurmukhi by default', () => {
      expect(formatArea(from(2, 3, 8))).toBe('2 ਕਿੱਲਾ 3 ਕਨਾਲ 8 ਮਰਲਾ');
    });

    it('renders Hindi in Devanagari', () => {
      expect(formatArea(from(2, 3, 8), { locale: 'hi' })).toBe('2 किल्ला 3 कनाल 8 मरला');
    });
  });
});

describe('formatAreaShort', () => {
  it('keeps the two largest components', () => {
    expect(formatAreaShort(from(2, 3, 8), { locale: 'en' })).toBe('2 killa 3 kanal');
  });

  it('falls back gracefully on small areas', () => {
    expect(formatAreaShort(from(0, 0, 7), { locale: 'en' })).toBe('7 marla');
    expect(formatAreaShort(0, { locale: 'en' })).toBe('0 marla');
  });
});

describe('areaParts', () => {
  it('returns structured components for UI layout', () => {
    expect(areaParts(from(2, 3, 8))).toEqual([
      { unit: 'killa', amount: 2 },
      { unit: 'kanal', amount: 3 },
      { unit: 'marla', amount: 8 },
    ]);
  });

  it('returns an empty list for zero', () => {
    expect(areaParts(0)).toEqual([]);
  });
});
