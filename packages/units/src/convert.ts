import { MARLA, MARLA_SQM, type Unit } from './constants.js';

/**
 * Convert an amount of some unit into square metres.
 *
 * Square metres is the only form we ever persist. See DATA_MODEL.md.
 */
export function toSqm(amount: number, unit: Unit): number {
  assertFinite(amount, 'amount');
  return amount * MARLA[unit] * MARLA_SQM;
}

/**
 * Convert square metres into a decimal amount of one unit.
 *
 * This is the form pricing uses — `(area ÷ unit) × rate` — and it is the only
 * place a decimal area is acceptable. Never show the result to a farmer;
 * use `formatArea` for that.
 */
export function fromSqm(sqm: number, unit: Unit): number {
  assertFinite(sqm, 'sqm');
  return sqm / (MARLA[unit] * MARLA_SQM);
}

/**
 * Square metres to whole marlas, rounded.
 *
 * The single most important function in the package. Every display path
 * rounds to whole marlas *once, here*, and then decomposes with integer
 * arithmetic. Rounding at the end of a decomposition instead would let
 * 19.6 marla render as "20 marla" rather than carrying into a full kanal.
 *
 * A marla is 25.3 m², comfortably above GPS error, so this loses nothing
 * we could honestly have measured anyway.
 */
export function toWholeMarla(sqm: number): number {
  assertFinite(sqm, 'sqm');
  if (sqm < 0) throw new RangeError('area cannot be negative');
  return Math.round(sqm / MARLA_SQM);
}

/** Convert directly between two units. */
export function convert(amount: number, from: Unit, to: Unit): number {
  return fromSqm(toSqm(amount, from), to);
}

function assertFinite(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number, got ${String(value)}`);
  }
}
