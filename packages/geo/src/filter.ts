import { distanceM } from './projection.js';
import type { GpsPoint, RejectedPoint } from './types.js';

export interface FilterOptions {
  /** Discard fixes reporting worse accuracy than this. Metres. */
  maxAccuracyM?: number;
  /** Discard fixes implying a speed above this. m/s. Walking is ~1.4. */
  maxSpeedMs?: number;
  /** Discard fixes closer than this to the previous kept one. Metres. */
  minSpacingM?: number;
}

export const DEFAULT_FILTER: Required<FilterOptions> = {
  // A 10 m fix on a 60 m field edge is a sixth of the side. Anything worse
  // is noise pretending to be a measurement.
  maxAccuracyM: 10,
  // 2.2 m/s ≈ 8 km/h. Above that he is on a bike or a tractor, not walking
  // the boundary, and the track is not the field edge.
  //
  // Applied against a *noise-adjusted* gap, not the raw one — see below.
  maxSpeedMs: 2.2,
  // Below 1 m apart, consecutive fixes carry no new information about the
  // boundary. Kept deliberately under a walking pace (~1.3 m/s at 1 Hz) so
  // the filter thins jitter without discarding the track itself.
  minSpacingM: 1,
};

export interface FilterResult {
  accepted: GpsPoint[];
  rejected: RejectedPoint[];
}

/**
 * First line of defence against bad GPS.
 *
 * Runs live while the farmer walks, so the app can show a green/amber/red
 * indicator and refuse to start on red. Everything downstream assumes it has
 * already run. See docs/UNITS_AND_MEASUREMENT.md §4, defence 1.
 */
export function filterTrack(
  points: readonly GpsPoint[],
  options: FilterOptions = {},
): FilterResult {
  const { maxAccuracyM, maxSpeedMs, minSpacingM } = { ...DEFAULT_FILTER, ...options };

  const accepted: GpsPoint[] = [];
  const rejected: RejectedPoint[] = [];
  let last: GpsPoint | undefined;

  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
      rejected.push({ point, reason: 'poor-accuracy' });
      continue;
    }

    if (point.accuracy > maxAccuracyM) {
      rejected.push({ point, reason: 'poor-accuracy' });
      continue;
    }

    if (last !== undefined) {
      if (point.timestamp < last.timestamp) {
        rejected.push({ point, reason: 'out-of-order' });
        continue;
      }

      const gap = distanceM(last, point);
      const seconds = (point.timestamp - last.timestamp) / 1000;

      // Two fixes one second apart, each accurate to 5 m, can sit 10 m apart
      // while the walker has moved barely a metre. Testing the raw gap against
      // a walking pace therefore rejects the honest track and keeps only the
      // wild outliers — the exact opposite of what the filter is for.
      //
      // So we subtract the error budget both fixes admit to, and test what is
      // left. Only movement that cannot be explained by noise counts as speed.
      const noiseAllowance = last.accuracy + point.accuracy;
      const unexplainedGap = Math.max(0, gap - noiseAllowance);

      if (seconds > 0 && unexplainedGap / seconds > maxSpeedMs) {
        rejected.push({ point, reason: 'too-fast' });
        continue;
      }

      if (gap < minSpacingM) {
        rejected.push({ point, reason: 'too-close' });
        continue;
      }
    }

    accepted.push(point);
    last = point;
  }

  return { accepted, rejected };
}

/** Live quality signal for the walk screen's green/amber/red dot. */
export function accuracyBand(accuracyM: number): 'good' | 'fair' | 'poor' {
  if (accuracyM <= 6) return 'good';
  if (accuracyM <= 10) return 'fair';
  return 'poor';
}
