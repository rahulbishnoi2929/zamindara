/**
 * Design constants.
 *
 * Two constraints drive every value here, and both come from the field rather
 * than from taste:
 *
 *   Sunlight — a phone held at arm's length in a Punjab April is barely
 *   readable. Contrast is high, type is large, and nothing important is grey.
 *
 *   Gloves and haste — a captain answering during harvest, or a farmer with
 *   muddy hands. Nothing tappable is under 56 px, and the primary action on
 *   any screen is the biggest thing on it.
 */

export const colors = {
  // Wheat-field green. Also the splash and adaptive-icon background.
  primary: '#1B5E20',
  primaryDark: '#0B3D0F',
  primaryLight: '#4C8C4A',

  good: '#2E7D32',
  fair: '#EF6C00',
  poor: '#C62828',

  text: '#111111',
  textMuted: '#5A5A5A',
  textInverse: '#FFFFFF',

  surface: '#FFFFFF',
  background: '#F4F4F0',
  border: '#D6D6CE',

  overlay: 'rgba(0,0,0,0.72)',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 24,
  pill: 999,
} as const;

/** Minimum tap target. Below this, a gloved thumb misses. */
export const TOUCH_MIN = 56;

export const type = {
  /** The area readout. Deliberately enormous — it is the whole point. */
  hero: { fontSize: 40, fontWeight: '800' },
  title: { fontSize: 26, fontWeight: '700' },
  body: { fontSize: 18, fontWeight: '500' },
  label: { fontSize: 15, fontWeight: '600' },
  button: { fontSize: 20, fontWeight: '700' },
} as const;

export const accuracyColor = (band: 'good' | 'fair' | 'poor'): string =>
  band === 'good' ? colors.good : band === 'fair' ? colors.fair : colors.poor;
