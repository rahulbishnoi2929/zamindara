import type { LatLng } from '@zamindara/geo';

/**
 * Phase 1 field test.
 *
 * The gate the whole project sits behind: does a measured boundary match
 * physical reality? See docs/BUILD_PLAN.md §Phase 1.
 *
 * Ground truth here is a **50 m measuring tape**, not the jamabandi. The land
 * record describes the legal parcel, not the cultivated field, and is often
 * decades stale — so it is captured as a separate reading rather than as truth.
 * The gap between paper and ground is its own finding.
 */

/** Units the tape reading can be entered in. */
export type TapeUnit = 'm' | 'ft' | 'karam';

export const TAPE_UNIT_M: Record<TapeUnit, number> = {
  m: 1,
  ft: 0.3048,
  karam: 5.5 * 0.3048,
};

export interface TestPlot {
  id: string;
  /** Something you'll recognise later — "Gurmeet, nehar wala". */
  label: string;
  village: string;

  /** Two sides of a rectangular plot, in the chosen unit. */
  sideA: number | null;
  sideB: number | null;
  tapeUnit: TapeUnit;

  /** The farmer's papers, in square metres. Recorded, never used as truth. */
  jamabandiSqm: number | null;

  notes: string;
  createdAt: number;
}

export type CaptureMethod = 'drawn' | 'walked';

export interface TestMeasurement {
  id: string;
  plotId: string;
  method: CaptureMethod;
  areaSqm: number;
  polygon: LatLng[];
  createdAt: number;

  // — walk only
  meanAccuracyM: number | null;
  durationSec: number | null;
  pointsAccepted: number | null;
  pointsRejected: number | null;
  /** polygon | rectangle-fit | grid-snapped */
  pipelineMethod: string | null;
  /** Did he have to drag the outline on the confirmation screen? */
  cornersAdjusted: boolean | null;

  // — draw only
  /** Was the field actually identifiable on the imagery? */
  imageryUsable: boolean | null;
}

/** Tape reading in square metres, or null if not measured yet. */
export function tapeAreaSqm(plot: TestPlot): number | null {
  if (plot.sideA === null || plot.sideB === null) return null;
  const scale = TAPE_UNIT_M[plot.tapeUnit];
  const area = plot.sideA * scale * (plot.sideB * scale);
  return Number.isFinite(area) && area > 0 ? area : null;
}

/** Signed error against the tape, as a fraction. Positive = app read high. */
export function errorVsTape(
  measurement: TestMeasurement,
  plot: TestPlot,
): number | null {
  const truth = tapeAreaSqm(plot);
  if (truth === null) return null;
  return measurement.areaSqm / truth - 1;
}
