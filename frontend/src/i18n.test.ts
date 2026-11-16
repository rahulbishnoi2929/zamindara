import { describe, expect, it } from 'vitest';
import { ALL_STRINGS } from './i18n';

/**
 * Standing rule 3: "Gurmukhi is not a translation pass at the end. A screen
 * isn't done until it's complete in Punjabi."
 *
 * Nothing enforced it. A string added in English only would have shipped,
 * and a captain in Fazilka would have met it in a language he may not read.
 */
describe('every string exists in all three languages', () => {
  const keys = Object.keys(ALL_STRINGS);

  it('has strings at all', () => {
    expect(keys.length).toBeGreaterThan(100);
  });

  for (const locale of ['pa', 'hi', 'en'] as const) {
    it(`is complete in ${locale}`, () => {
      const missing = keys.filter((k) => {
        const value = ALL_STRINGS[k]?.[locale];
        return typeof value !== 'string' || value.trim().length === 0;
      });
      expect(missing).toEqual([]);
    });
  }

  it('does not leave Punjabi as a copy of the English', () => {
    // Not a translation check — it cannot be. It catches the specific
    // laziness of pasting the English into the pa slot to make a screen
    // "done". Proper nouns and codes are legitimately identical.
    const ALLOWED = new Set(['appName', 'upi']);
    const copied = keys.filter(
      (k) =>
        !ALLOWED.has(k) &&
        ALL_STRINGS[k]?.['pa'] === ALL_STRINGS[k]?.['en'] &&
        (ALL_STRINGS[k]?.['en']?.length ?? 0) > 3,
    );
    expect(copied).toEqual([]);
  });
});
