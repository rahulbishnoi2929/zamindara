import {
  closeRing,
  isSelfIntersecting,
  openRing,
  ringAreaSqm,
  ringPerimeterM,
} from './area.js';
import { DEFAULT_FILTER, filterTrack, type FilterOptions } from './filter.js';
import { centroidOf, project } from './projection.js';
import {
  minimumBoundingRectangle,
  rectangleToLatLng,
  refineRectangle,
  snapToKaramGrid,
} from './rectangle.js';
import { simplifyTrack } from './simplify.js';
import { smoothRing } from './smooth.js';
import type { CaptureQuality, GpsPoint, WalkResult } from './types.js';

export interface PipelineOptions extends FilterOptions {
  /** Moving-average window. Default 5. Set to 0 to disable smoothing. */
  smoothWindow?: number;
  /** RDP tolerance in metres. Default 2. */
  simplifyToleranceM?: number;
  /**
   * How close the boundary must sit to a fitted rectangle before the canal
   * grid snap applies, as a multiple of the walk's own GPS accuracy.
   *
   * Expressed relative to accuracy on purpose: the question is not "is this
   * shape near-rectangular in absolute metres" but "is every departure from a
   * rectangle explainable by the error we already know we have". Default 0.9.
   */
  rectangleResidualRatio?: number;
  /**
   * Fit a rectangle when the shape warrants it. Default true.
   *
   * This is a *confirmability* decision, not an accuracy one — on area it is a
   * wash (1.89% vs 1.87% mean error). It earns its place at the next step: the
   * farmer has to check the outline against satellite imagery and drag it into
   * place, and dragging four corners is something he can do on a phone in a
   * field. Dragging the twenty-odd vertices of a raw walked polygon is not.
   */
  rectangleFit?: boolean;
  /**
   * Additionally quantise the fitted rectangle's sides to whole karam.
   *
   * Off by default. In simulation this *reduces* accuracy: one karam is 2.8%
   * of a 36-karam side, so quantising a fit that is already within 1% mostly
   * rounds it away from the truth. Kept available because real canal-colony
   * plots may sit closer to the grid than simulated ones do — that is a
   * question for the field test, not for a guess.
   */
  gridSnap?: boolean;
  /** How close to a whole karam a side must be before snapping. */
  gridSnapToleranceKaram?: number;
}

/**
 * Every default here was chosen by measurement, not judgement.
 * test/accuracy.test.ts holds the sweeps; the summary:
 *
 *   smoothWindow      0 → 3.22% error · 5 → 1.71% · 9 → 1.87% · 21 → 5.25%
 *                     Too little leaves noise; too much rounds the corners
 *                     off the field and quietly steals area. 5 is the floor.
 *
 *   simplifyTolerance 1 m → 1.76% · 2 m → 1.87% · 4 m → 3.53%
 *                     Anything above ~2 m starts cutting corners rather than
 *                     jitter, and it always loses area, never gains it.
 *
 *   gridSnap          Measurably worse. Left off. See the option's comment.
 */
const DEFAULTS = {
  smoothWindow: 5,
  simplifyToleranceM: 1,
  rectangleResidualRatio: 0.9,
  rectangleFit: true,
  gridSnap: false,
  gridSnapToleranceKaram: 0.35,
} as const;

/**
 * Turn a walked GPS track into a field boundary and an area.
 *
 * The defences from docs/UNITS_AND_MEASUREMENT.md §4, in order:
 *
 *   1. filter    — drop fixes we should not have trusted
 *   2. smooth    — average out the error in the ones we keep
 *   3. simplify  — recover straight edges and real corners
 *   4. snap      — fit the canal-grid rectangle, where the shape warrants it
 *   5. confirm   — NOT here. The farmer confirms on satellite imagery, and
 *                  his confirmation, not this function, is the source of truth.
 *
 * Nothing this returns should be billed against until `confirmed_by_owner`
 * is set. See DATA_MODEL.md.
 */
export function processWalk(
  track: readonly GpsPoint[],
  options: PipelineOptions = {},
): WalkResult {
  const opts = { ...DEFAULT_FILTER, ...DEFAULTS, ...options };
  const warnings: string[] = [];

  // 1 — filter
  const { accepted, rejected } = filterTrack(track, opts);
  const meanAccuracyM = mean(accepted.map((p) => p.accuracy));

  if (accepted.length < 4) {
    return {
      polygon: [],
      areaSqm: 0,
      method: 'polygon',
      rawPolygonAreaSqm: 0,
      perimeterM: 0,
      rectangularity: 0,
      rectangleResidualM: Infinity,
      meanAccuracyM,
      accepted,
      rejected,
      simplified: [],
      quality: 'poor',
      warnings: ['Not enough usable GPS points to form a field. Walk again.'],
    };
  }

  // 2, 3 — smooth then simplify
  const smoothed = smoothRing(openRing(accepted), opts.smoothWindow);
  const simplified = simplifyTrack(smoothed, opts.simplifyToleranceM);
  const rawPolygonAreaSqm = ringAreaSqm(simplified);
  const perimeterM = ringPerimeterM(simplified);

  if (isSelfIntersecting(simplified)) {
    warnings.push('The walked path crosses itself. Check the outline before confirming.');
  }

  // 4 — fit a rectangle and, if the plot really is one, snap it to the grid.
  //
  // The rectangle is fitted against the smoothed track rather than the
  // simplified one: edge medians want every observation of that edge, and
  // simplification has already thrown most of them away.
  const origin = centroidOf(smoothed);
  const smoothedXY = smoothed.map((p) => project(p, origin));
  const simplifiedXY = simplified.map((p) => project(p, origin));

  const mbr = minimumBoundingRectangle(simplifiedXY);
  const rectangularity =
    mbr === null || mbr.areaSqm === 0 ? 0 : rawPolygonAreaSqm / mbr.areaSqm;

  let polygon = closeRing(simplified);
  let areaSqm = rawPolygonAreaSqm;
  let method: WalkResult['method'] = 'polygon';
  let rectangleResidualM = Infinity;

  if (mbr !== null) {
    const refined = refineRectangle(smoothedXY, mbr.angleRad);

    if (refined !== null) {
      rectangleResidualM = refined.residualM;
      const budget = Math.max(meanAccuracyM, 1) * opts.rectangleResidualRatio;

      // Only treat this as a rectangle if every departure from one is
      // explainable by the GPS error we already know we had.
      if (opts.rectangleFit && refined.residualM <= budget) {
        let rect = refined;
        method = 'rectangle-fit';

        if (opts.gridSnap) {
          const snap = snapToKaramGrid(refined, opts.gridSnapToleranceKaram);
          if (snap.snapped) {
            rect = { ...snap.rectangle, residualM: refined.residualM };
            method = 'grid-snapped';
          }
        }

        polygon = closeRing(rectangleToLatLng(rect, origin));
        areaSqm = rect.areaSqm;

        const shift = Math.abs(areaSqm - rawPolygonAreaSqm) / rawPolygonAreaSqm;
        if (shift > 0.05) {
          warnings.push(
            'Shape correction changed the area by more than 5%. Check it carefully.',
          );
        }
      }
    }
  }

  if (rejected.filter((r) => r.reason === 'poor-accuracy').length > accepted.length) {
    warnings.push('Signal was weak for much of the walk. Consider walking again.');
  }

  const quality = assessQuality(meanAccuracyM, accepted.length, rejected.length, warnings);

  return {
    polygon,
    areaSqm,
    method,
    rawPolygonAreaSqm,
    perimeterM,
    rectangularity,
    rectangleResidualM,
    meanAccuracyM,
    accepted,
    rejected,
    simplified,
    quality,
    warnings,
  };
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function assessQuality(
  meanAccuracyM: number,
  acceptedCount: number,
  rejectedCount: number,
  warnings: readonly string[],
): CaptureQuality {
  if (warnings.length > 0) return 'poor';
  if (acceptedCount < 8) return 'poor';

  const rejectRatio = rejectedCount / (acceptedCount + rejectedCount);
  if (meanAccuracyM <= 6 && rejectRatio < 0.3) return 'good';
  if (meanAccuracyM <= 10 && rejectRatio < 0.6) return 'fair';
  return 'poor';
}
