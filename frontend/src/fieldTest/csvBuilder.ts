import { errorVsTape, tapeAreaSqm, type TestMeasurement, type TestPlot } from './types';

/** Quote a CSV field only when it needs it. */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const CSV_HEADER = [
  'plot_label',
  'village',
  'tape_side_a',
  'tape_side_b',
  'tape_unit',
  'tape_area_sqm',
  'jamabandi_sqm',
  'method',
  'measured_area_sqm',
  'error_vs_tape_pc',
  'gap_vs_jamabandi_pc',
  'mean_gps_accuracy_m',
  'walk_duration_sec',
  'points_accepted',
  'points_rejected',
  'pipeline_method',
  'corners_adjusted',
  'imagery_usable',
  'measured_at',
  'plot_notes',
] as const;

/**
 * One row per measurement, with the plot's reference data repeated.
 *
 * Deliberately wide and flat rather than normalised — this lands in a
 * spreadsheet where every question ("how did drawing do on small plots?")
 * should be answerable with a filter, not a join.
 *
 * Kept free of any Expo import so it can be unit tested. File writing and
 * sharing live in csv.ts.
 */
export function buildCsv(plots: TestPlot[], measurements: TestMeasurement[]): string {
  const plotsById = new Map(plots.map((p) => [p.id, p]));

  const rows = measurements.flatMap((m) => {
    const plot = plotsById.get(m.plotId);
    if (plot === undefined) return [];

    const tape = tapeAreaSqm(plot);
    const error = errorVsTape(m, plot);
    const gap =
      plot.jamabandiSqm !== null && plot.jamabandiSqm > 0
        ? m.areaSqm / plot.jamabandiSqm - 1
        : null;

    return [
      [
        plot.label,
        plot.village,
        plot.sideA,
        plot.sideB,
        plot.tapeUnit,
        tape === null ? '' : tape.toFixed(2),
        plot.jamabandiSqm === null ? '' : plot.jamabandiSqm.toFixed(2),
        m.method,
        m.areaSqm.toFixed(2),
        error === null ? '' : (error * 100).toFixed(2),
        gap === null ? '' : (gap * 100).toFixed(2),
        m.meanAccuracyM === null ? '' : m.meanAccuracyM.toFixed(2),
        m.durationSec === null ? '' : Math.round(m.durationSec),
        m.pointsAccepted ?? '',
        m.pointsRejected ?? '',
        m.pipelineMethod ?? '',
        m.cornersAdjusted === null ? '' : m.cornersAdjusted ? 'yes' : 'no',
        m.imageryUsable === null ? '' : m.imageryUsable ? 'yes' : 'no',
        new Date(m.createdAt).toISOString(),
        plot.notes,
      ]
        .map(cell)
        .join(','),
    ];
  });

  // Plots measured zero times still belong in the export — an untested plot
  // is a gap in the sample, and it should be visible in the spreadsheet.
  const unmeasured = plots
    .filter((p) => !measurements.some((m) => m.plotId === p.id))
    .map((p) => {
      const tape = tapeAreaSqm(p);
      const row = new Array<string>(CSV_HEADER.length).fill('');
      row[0] = cell(p.label);
      row[1] = cell(p.village);
      row[2] = cell(p.sideA);
      row[3] = cell(p.sideB);
      row[4] = cell(p.tapeUnit);
      row[5] = tape === null ? '' : tape.toFixed(2);
      row[6] = p.jamabandiSqm === null ? '' : p.jamabandiSqm.toFixed(2);
      row[19] = cell(p.notes);
      return row.join(',');
    });

  return [CSV_HEADER.join(','), ...rows, ...unmeasured].join('\n');
}
