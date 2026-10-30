import { SQM } from '@zamindara/units';
import {
  errorVsTape,
  tapeAreaSqm,
  type CaptureMethod,
  type TestMeasurement,
  type TestPlot,
} from './types';

/**
 * Turns the raw readings into the answer Phase 1 exists to get:
 * does the app measure a field accurately enough to bill against?
 *
 * Two questions are kept deliberately separate, because conflating them was
 * the original mistake in the plan:
 *
 *   Accuracy   — measured against the tape. This is the gate.
 *   Acceptance — the gap against the jamabandi. Not a gate; a warning about
 *                what farmers will believe when they see our number.
 */

export interface MethodStats {
  method: CaptureMethod;
  n: number;
  /** Signed. Positive means the app reads high. */
  bias: number;
  meanAbsError: number;
  worstAbsError: number;
  within2pc: number;
  within4pc: number;
}

export interface SizeBucketStats {
  label: string;
  n: number;
  meanAbsError: number;
  within2pc: number;
  /** The bar this bucket must clear: 2% at two killa and above, else 4%. */
  bar: number;
  passes: boolean;
}

export interface RepeatabilityStats {
  /** Plots measured more than once by the same method. */
  n: number;
  /** Mean spread between repeat measurements, as a fraction. */
  meanSpread: number;
  worstSpread: number;
}

export interface JamabandiStats {
  n: number;
  /** Median signed gap: measured area vs the land record. */
  medianGap: number;
  /** How one-sided it is — 1.0 means every plot fell the same way. */
  consistency: number;
}

export interface TestSummary {
  totalPlots: number;
  plotsWithTape: number;
  totalMeasurements: number;
  byMethod: MethodStats[];
  bySize: SizeBucketStats[];
  repeatability: RepeatabilityStats | null;
  jamabandi: JamabandiStats | null;
  imageryUnusableCount: number;
  gatePasses: boolean;
  gateNotes: string[];
}

const mean = (a: number[]): number =>
  a.length === 0 ? 0 : a.reduce((s, v) => s + v, 0) / a.length;

const median = (a: number[]): number => {
  if (a.length === 0) return 0;
  const sorted = [...a].sort((x, y) => x - y);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
};

function statsFor(
  method: CaptureMethod,
  measurements: TestMeasurement[],
  plotsById: Map<string, TestPlot>,
): MethodStats {
  const errors: number[] = [];

  for (const m of measurements) {
    if (m.method !== method) continue;
    const plot = plotsById.get(m.plotId);
    if (plot === undefined) continue;
    const error = errorVsTape(m, plot);
    if (error !== null) errors.push(error);
  }

  const abs = errors.map(Math.abs);
  return {
    method,
    n: errors.length,
    bias: mean(errors),
    meanAbsError: mean(abs),
    worstAbsError: abs.length === 0 ? 0 : Math.max(...abs),
    within2pc: abs.length === 0 ? 0 : abs.filter((e) => e < 0.02).length / abs.length,
    within4pc: abs.length === 0 ? 0 : abs.filter((e) => e < 0.04).length / abs.length,
  };
}

export function summarise(
  plots: TestPlot[],
  measurements: TestMeasurement[],
): TestSummary {
  const plotsById = new Map(plots.map((p) => [p.id, p]));
  const withTape = plots.filter((p) => tapeAreaSqm(p) !== null);

  const byMethod = (['drawn', 'walked'] as const)
    .map((m) => statsFor(m, measurements, plotsById))
    .filter((s) => s.n > 0);

  // — accuracy by plot size. Simulation says size dominates everything else,
  //   so the bar is size-dependent and the buckets must be reported apart.
  const buckets: Array<{ label: string; min: number; max: number; bar: number }> = [
    { label: 'under 1 killa', min: 0, max: SQM.killa, bar: 0.04 },
    { label: '1 – 2 killa', min: SQM.killa, max: 2 * SQM.killa, bar: 0.04 },
    { label: '2 killa and above', min: 2 * SQM.killa, max: Infinity, bar: 0.02 },
  ];

  const bySize: SizeBucketStats[] = buckets.map((bucket) => {
    const abs: number[] = [];

    for (const m of measurements) {
      const plot = plotsById.get(m.plotId);
      if (plot === undefined) continue;
      const truth = tapeAreaSqm(plot);
      if (truth === null || truth < bucket.min || truth >= bucket.max) continue;
      const error = errorVsTape(m, plot);
      if (error !== null) abs.push(Math.abs(error));
    }

    const meanAbsError = mean(abs);
    return {
      label: bucket.label,
      n: abs.length,
      meanAbsError,
      within2pc: abs.length === 0 ? 0 : abs.filter((e) => e < 0.02).length / abs.length,
      bar: bucket.bar,
      passes: abs.length > 0 && meanAbsError < bucket.bar,
    };
  });

  // — repeatability: same plot, same method, more than once
  const spreads: number[] = [];
  for (const plot of plots) {
    for (const method of ['drawn', 'walked'] as const) {
      const areas = measurements
        .filter((m) => m.plotId === plot.id && m.method === method)
        .map((m) => m.areaSqm);
      if (areas.length < 2) continue;
      const lo = Math.min(...areas);
      const hi = Math.max(...areas);
      if (lo > 0) spreads.push(hi / lo - 1);
    }
  }

  const repeatability: RepeatabilityStats | null =
    spreads.length === 0
      ? null
      : {
          n: spreads.length,
          meanSpread: mean(spreads),
          worstSpread: Math.max(...spreads),
        };

  // — the acceptance question, kept apart from the gate
  const gaps: number[] = [];
  for (const m of measurements) {
    const plot = plotsById.get(m.plotId);
    if (plot?.jamabandiSqm === undefined || plot.jamabandiSqm === null) continue;
    if (plot.jamabandiSqm <= 0) continue;
    gaps.push(m.areaSqm / plot.jamabandiSqm - 1);
  }

  const jamabandi: JamabandiStats | null =
    gaps.length === 0
      ? null
      : {
          n: gaps.length,
          medianGap: median(gaps),
          // How one-sided the disagreement is. If nearly every plot falls the
          // same way, this is systematic — and every farmer will meet a number
          // that contradicts his papers in the same direction.
          consistency:
            Math.abs(gaps.filter((g) => g > 0).length - gaps.filter((g) => g < 0).length) /
            gaps.length,
        };

  // — the gate
  const notes: string[] = [];
  const measured = bySize.filter((b) => b.n > 0);

  if (withTape.length < 20) {
    notes.push(`Only ${withTape.length} of 20 plots have a tape reading.`);
  }
  for (const bucket of measured) {
    if (!bucket.passes) {
      notes.push(
        `${bucket.label}: ${(bucket.meanAbsError * 100).toFixed(1)}% error, bar is ${(bucket.bar * 100).toFixed(0)}%.`,
      );
    }
  }
  if (repeatability !== null && repeatability.meanSpread >= 0.03) {
    notes.push(
      `Repeat measurements disagree by ${(repeatability.meanSpread * 100).toFixed(1)}%, bar is 3%.`,
    );
  }
  if (repeatability === null) {
    notes.push('No plot has been measured twice yet — repeatability untested.');
  }
  if (jamabandi !== null && Math.abs(jamabandi.medianGap) > 0.05) {
    notes.push(
      `Median gap vs jamabandi is ${(jamabandi.medianGap * 100).toFixed(1)}% — not a gate, but a launch problem.`,
    );
  }

  const gatePasses =
    withTape.length >= 20 &&
    measured.length > 0 &&
    measured.every((b) => b.passes) &&
    repeatability !== null &&
    repeatability.meanSpread < 0.03;

  return {
    totalPlots: plots.length,
    plotsWithTape: withTape.length,
    totalMeasurements: measurements.length,
    byMethod,
    bySize,
    repeatability,
    jamabandi,
    imageryUnusableCount: measurements.filter((m) => m.imageryUsable === false).length,
    gatePasses,
    gateNotes: notes,
  };
}
