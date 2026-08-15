import {
  CHAINS,
  MARLA,
  type DisplayChain,
  type Locale,
  type Unit,
} from './constants.js';
import { toWholeMarla } from './convert.js';
import { unitName } from './names.js';

/** One component of a compound area, e.g. `{ unit: 'kanal', amount: 3 }`. */
export interface AreaPart {
  unit: Unit;
  amount: number;
}

export interface FormatOptions {
  /** Which top-level unit to decompose into. Default `'killa'`. */
  chain?: DisplayChain;
  /** Language for unit names. Default `'pa'` (Punjabi, Gurmukhi). */
  locale?: Locale;
}

/**
 * Decompose an area into whole units of the chosen chain.
 *
 * Returns structured parts so UI can lay them out — big number, small unit
 * label — rather than parsing a string back apart.
 *
 * Zero components are omitted: 2 killa 0 kanal 8 marla comes back as
 * killa and marla only.
 */
export function areaParts(sqm: number, chain: DisplayChain = 'killa'): AreaPart[] {
  let remaining = toWholeMarla(sqm);
  const parts: AreaPart[] = [];

  for (const unit of CHAINS[chain]) {
    const size = MARLA[unit];
    const amount = Math.floor(remaining / size);
    if (amount > 0) {
      parts.push({ unit, amount });
      remaining -= amount * size;
    }
  }

  return parts;
}

/**
 * Format an area the way a farmer's jamabandi reads it.
 *
 *     formatArea(9813.6)  →  "2 ਕਿੱਲਾ 3 ਕਨਾਲ 8 ਮਰਲਾ"
 *     formatArea(9813.6, { locale: 'en' })  →  "2 killa 3 kanal 8 marla"
 *
 * Never returns a decimal. A farmer has never seen "2.4 killa" on a document,
 * and showing it is the fastest way to lose his trust in the number that sets
 * his price. See docs/UNITS_AND_MEASUREMENT.md §3.
 */
export function formatArea(sqm: number, options: FormatOptions = {}): string {
  const { chain = 'killa', locale = 'pa' } = options;
  const parts = areaParts(sqm, chain);

  if (parts.length === 0) {
    return `0 ${unitName('marla', locale)}`;
  }

  return parts
    .map((p) => `${p.amount} ${unitName(p.unit, locale)}`)
    .join(' ');
}

/**
 * Short form for tight spaces such as a field card or a job ping —
 * the two largest components only.
 *
 *     formatAreaShort(9813.6, { locale: 'en' })  →  "2 killa 3 kanal"
 */
export function formatAreaShort(sqm: number, options: FormatOptions = {}): string {
  const { chain = 'killa', locale = 'pa' } = options;
  const parts = areaParts(sqm, chain).slice(0, 2);

  if (parts.length === 0) {
    return `0 ${unitName('marla', locale)}`;
  }

  return parts
    .map((p) => `${p.amount} ${unitName(p.unit, locale)}`)
    .join(' ');
}
