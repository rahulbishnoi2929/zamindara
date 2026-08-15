import { describe, expect, it } from 'vitest';
import { MARLA_SQM } from '../src/constants.js';
import { formatArea } from '../src/format.js';
import { parseArea } from '../src/parse.js';

const from = (killa: number, kanal: number, marla: number): number =>
  (killa * 160 + kanal * 20 + marla) * MARLA_SQM;

describe('parseArea', () => {
  it('parses a full compound area', () => {
    expect(parseArea('2 killa 3 kanal 8 marla')?.sqm).toBeCloseTo(from(2, 3, 8), 6);
  });

  it('parses a single unit', () => {
    expect(parseArea('4 killa')?.sqm).toBeCloseTo(from(4, 0, 0), 6);
    expect(parseArea('12 marla')?.sqm).toBeCloseTo(from(0, 0, 12), 6);
  });

  it('accepts decimals', () => {
    expect(parseArea('2.5 acre')?.sqm).toBeCloseTo(from(2, 4, 0), 6);
  });

  it('accepts the transliterations people actually type', () => {
    // Field reality: nobody spells these consistently.
    for (const text of ['4 killa', '4 killey', '4 kille', '4 kila', '4 acre', '4 ghumaon']) {
      expect(parseArea(text)?.sqm).toBeCloseTo(from(4, 0, 0), 6);
    }
  });

  it('accepts Gurmukhi and Devanagari script', () => {
    expect(parseArea('4 ਕਿੱਲੇ')?.sqm).toBeCloseTo(from(4, 0, 0), 6);
    expect(parseArea('4 किल्ला')?.sqm).toBeCloseTo(from(4, 0, 0), 6);
    expect(parseArea('3 ਕਨਾਲ 8 ਮਰਲਾ')?.sqm).toBeCloseTo(from(0, 3, 8), 6);
  });

  it('accepts Gurmukhi and Devanagari digits', () => {
    expect(parseArea('੪ ਕਿੱਲੇ')?.sqm).toBeCloseTo(from(4, 0, 0), 6);
    expect(parseArea('४ किल्ला')?.sqm).toBeCloseTo(from(4, 0, 0), 6);
  });

  it('tolerates messy separators', () => {
    expect(parseArea('2 killa, 3 kanal - 8 marla')?.sqm).toBeCloseTo(from(2, 3, 8), 6);
    expect(parseArea('  2killa   3kanal  ')?.sqm).toBeCloseTo(from(2, 3, 0), 6);
  });

  it('returns null rather than guessing', () => {
    // Guessing at an area is how someone gets billed wrong.
    expect(parseArea('')).toBeNull();
    expect(parseArea('bahut zameen')).toBeNull();
    expect(parseArea('12345')).toBeNull();
    expect(parseArea('5 hectare')).toBeNull();
  });

  it('round-trips through formatArea', () => {
    for (const sqm of [from(2, 3, 8), from(0, 0, 7), from(11, 0, 0), from(1, 7, 19)]) {
      const text = formatArea(sqm, { locale: 'en' });
      expect(parseArea(text)?.sqm).toBeCloseTo(sqm, 6);
    }
  });
});
