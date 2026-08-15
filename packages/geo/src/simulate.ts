import { KARAM_M } from '@zamindara/units';
import { centroidOf, distanceM, project, unproject } from './projection.js';
import type { GpsPoint, LatLng } from './types.js';

/** Deterministic PRNG, so simulated walks are reproducible in tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller. */
function gaussian(rand: () => number): number {
  const u = Math.max(rand(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * Build a rectangular field of a given size, centred on a coordinate.
 *
 * Defaults to a standard canal-colony killa: 36 × 40 karam.
 */
export function makeRectangleField(
  centre: LatLng,
  options: { lengthM?: number; widthM?: number; bearingRad?: number } = {},
): LatLng[] {
  const {
    lengthM = 40 * KARAM_M,
    widthM = 36 * KARAM_M,
    bearingRad = 0,
  } = options;

  const cos = Math.cos(bearingRad);
  const sin = Math.sin(bearingRad);
  const hl = lengthM / 2;
  const hw = widthM / 2;

  return ([
    [-hl, -hw],
    [hl, -hw],
    [hl, hw],
    [-hl, hw],
  ] as Array<[number, number]>).map(([x, y]) =>
    unproject({ x: x * cos - y * sin, y: x * sin + y * cos }, centre),
  );
}

export interface SimulateOptions {
  /** Walking pace, m/s. A farmer along a field edge is about 1.3. */
  speedMs?: number;
  /** GPS sample rate, Hz. */
  sampleHz?: number;
  /** Standard deviation of positional error, metres. */
  noiseSigmaM?: number;
  /** Accuracy value the device reports. Usually near but not equal to sigma. */
  reportedAccuracyM?: number;
  /** Fraction of fixes that arrive badly degraded. */
  badFixRate?: number;
  seed?: number;
}

/**
 * Simulate walking the perimeter of a field, with realistic GPS error.
 *
 * This is what lets the pipeline be evaluated honestly before anyone stands in
 * a field: the true area is known exactly, so recovered-vs-truth is measurable.
 * It does not replace the 20-plot field test — real GPS error is correlated over
 * time in ways independent Gaussian noise is not — but it catches the errors
 * worth catching at a desk.
 */
export function simulateWalk(
  field: readonly LatLng[],
  options: SimulateOptions = {},
): GpsPoint[] {
  const {
    speedMs = 1.3,
    sampleHz = 1,
    noiseSigmaM = 4,
    reportedAccuracyM = 5,
    badFixRate = 0.03,
    seed = 42,
  } = options;

  const rand = mulberry32(seed);
  const origin = centroidOf(field);
  const stepM = speedMs / sampleHz;

  const points: GpsPoint[] = [];
  let timestamp = Date.now();

  for (let i = 0; i < field.length; i += 1) {
    const from = field[i]!;
    const to = field[(i + 1) % field.length]!;
    const edgeLength = distanceM(from, to);
    const steps = Math.max(1, Math.round(edgeLength / stepM));

    const a = project(from, origin);
    const b = project(to, origin);

    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      const truth = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };

      const isBad = rand() < badFixRate;
      const sigma = isBad ? noiseSigmaM * 6 : noiseSigmaM;

      const noisy = {
        x: truth.x + gaussian(rand) * sigma,
        y: truth.y + gaussian(rand) * sigma,
      };

      const coord = unproject(noisy, origin);
      points.push({
        lat: coord.lat,
        lng: coord.lng,
        accuracy: isBad ? reportedAccuracyM * 5 : reportedAccuracyM,
        timestamp,
        speed: speedMs,
      });

      timestamp += 1000 / sampleHz;
    }
  }

  return points;
}
