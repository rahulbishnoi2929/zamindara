import type { PricingUnit } from '@zamindara/catalog';
import { SQM } from '@zamindara/units';

/**
 * What a job costs.
 *
 * This module and `public.quote_job` in supabase/migrations must agree to the
 * paisa. The database is authoritative — a client cannot be trusted to price
 * its own work — but the app has to show the farmer a number *before* he
 * commits, and showing him one figure then billing another is exactly the
 * kind of thing that ends a business in a village.
 *
 * So the arithmetic is duplicated deliberately, and the tests assert both
 * halves round identically. Same reasoning as sqm_per_unit.
 */

/** Round to paisa, matching Postgres `round(numeric, 2)`. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Straight-line metres to approximate road kilometres.
 *
 * Roads wind; the 1.3 factor accounts for it. For a 5 km threshold that is
 * accurate enough, and it keeps a paid routing API off the critical path.
 * Calibrate against real trips in season one. Mirrors `public.road_km`.
 */
export function roadKm(straightLineMetres: number): number {
  return round2((straightLineMetres / 1000) * 1.3);
}

export interface QuoteInput {
  areaSqm: number;
  /** What the captain charges. Null means he negotiates each job. */
  rate: number | null;
  unit: PricingUnit;
  /** Road distance from the captain to the field. */
  distanceKm: number;
  /** Travel is free within this radius. Region setting, default 5 km. */
  freeDistanceKm?: number;
  /** Per km beyond the free radius, by machine class. */
  travelRatePerKm: number;
}

export interface Quote {
  areaSqm: number;
  /** Area expressed in the pricing unit — 2.43 killa, say. */
  areaInUnit: number | null;
  rate: number | null;
  unit: PricingUnit;
  /**
   * Null when the work is time-priced, because it cannot be known before the
   * job is done. The quote still carries the rate; the final amount is
   * entered on completion.
   */
  subtotal: number | null;
  distanceKm: number;
  chargeableKm: number;
  travelCharge: number;
  total: number | null;
  /** True when we genuinely cannot show a figure yet, and must say so. */
  isEstimatable: boolean;
}

const FREE_KM_DEFAULT = 5;

export function quote(input: QuoteInput): Quote {
  const {
    areaSqm,
    rate,
    unit,
    distanceKm,
    freeDistanceKm = FREE_KM_DEFAULT,
    travelRatePerKm,
  } = input;

  if (!Number.isFinite(areaSqm) || areaSqm <= 0) {
    throw new RangeError('area must be positive');
  }
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new RangeError('distance cannot be negative');
  }

  // A captain 15 km away burns diesel and an hour of daylight getting there.
  // Without this charge he simply declines distant work, and the farmers
  // furthest from town are the ones left unserved.
  const chargeableKm = Math.max(distanceKm - freeDistanceKm, 0);
  const travelCharge = round2(chargeableKm * travelRatePerKm);

  const areaInUnit = unit === 'per_killa' ? areaSqm / SQM.killa : null;

  let subtotal: number | null = null;
  if (rate !== null) {
    if (unit === 'per_killa') subtotal = round2((areaSqm / SQM.killa) * rate);
    else if (unit === 'per_job') subtotal = round2(rate);
    // per_hour and per_day stay null on purpose — see the field comment.
  }

  return {
    areaSqm,
    areaInUnit,
    rate,
    unit,
    subtotal,
    distanceKm,
    chargeableKm,
    travelCharge,
    total: subtotal === null ? null : round2(subtotal + travelCharge),
    isEstimatable: subtotal !== null,
  };
}

/**
 * The range shown to a farmer as rate guidance.
 *
 * A range, never a single number. The platform does not set prices; it
 * reports what has actually been paid nearby, and the negotiation stays
 * between the two of them. Mirrors `public.rate_guidance`, which uses the
 * same quartiles.
 */
export interface RateGuidance {
  low: number;
  high: number;
  sampleSize: number;
}

export function rateGuidance(recentRates: readonly number[]): RateGuidance | null {
  const rates = recentRates.filter((r) => Number.isFinite(r) && r > 0).sort((a, b) => a - b);
  // Below a handful of jobs, a "typical rate" is one man's opinion dressed
  // up as data. Better to show nothing than to anchor on noise.
  if (rates.length < 3) return null;

  return {
    low: round2(percentile(rates, 0.25)),
    high: round2(percentile(rates, 0.75)),
    sampleSize: rates.length,
  };
}

/** Linear-interpolated percentile, matching Postgres `percentile_cont`. */
function percentile(sorted: readonly number[], p: number): number {
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}
