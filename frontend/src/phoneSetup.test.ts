import { describe, expect, it } from 'vitest';
import { alertOk } from './phoneSetup';

// Expo's AndroidImportance: DEFAULT 5, HIGH 6, MAX 7.
describe('phone setup (Stage 5)', () => {
  it('the work alert is fine at heads-up strength or above', () => {
    expect(alertOk(7)).toBe(true);
    expect(alertOk(6)).toBe(true);
  });
  it('is at risk when he turned the channel down', () => {
    expect(alertOk(5)).toBe(false);
    expect(alertOk(2)).toBe(false);
  });
  it('a channel that cannot be read (not Android, not made yet) is not a warning', () => {
    expect(alertOk(null)).toBe(true);
  });
});
