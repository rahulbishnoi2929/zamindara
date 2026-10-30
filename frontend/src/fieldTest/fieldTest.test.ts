import { SQM } from '@zamindara/units';
import { describe, expect, it } from 'vitest';
import { buildCsv } from './csvBuilder';
import { summarise } from './stats';
import { errorVsTape, tapeAreaSqm, type TestMeasurement, type TestPlot } from './types';

/**
 * The field-test recorder decides whether Phase 1 passes, which decides
 * whether anything else gets built. That makes it exactly the kind of code
 * the project's standing rule covers: tested before it is trusted.
 */

let seq = 0;
const id = () => `id-${(seq += 1)}`;

function plot(overrides: Partial<TestPlot> = {}): TestPlot {
  return {
    id: id(),
    label: 'test plot',
    village: 'Roshan Wala',
    // 60.35 x 67.06 m — a standard canal-colony killa.
    sideA: 60.35,
    sideB: 67.06,
    tapeUnit: 'm',
    jamabandiSqm: null,
    notes: '',
    createdAt: 0,
    ...overrides,
  };
}

function measurement(
  plotId: string,
  areaSqm: number,
  overrides: Partial<TestMeasurement> = {},
): TestMeasurement {
  return {
    id: id(),
    plotId,
    method: 'drawn',
    areaSqm,
    polygon: [],
    createdAt: 0,
    meanAccuracyM: null,
    durationSec: null,
    pointsAccepted: null,
    pointsRejected: null,
    pipelineMethod: null,
    cornersAdjusted: null,
    imageryUsable: null,
    ...overrides,
  };
}

describe('tape reading', () => {
  it('computes area from two sides', () => {
    expect(tapeAreaSqm(plot())).toBeCloseTo(60.35 * 67.06, 2);
  });

  it('converts feet', () => {
    // The canal-grid killa: 198 ft x 220 ft is exactly one acre.
    const p = plot({ sideA: 198, sideB: 220, tapeUnit: 'ft' });
    expect(tapeAreaSqm(p)).toBeCloseTo(SQM.killa, 0);
  });

  it('converts karam', () => {
    // The same plot as the surveyor laid it out: 36 x 40 karam.
    const p = plot({ sideA: 36, sideB: 40, tapeUnit: 'karam' });
    expect(tapeAreaSqm(p)).toBeCloseTo(SQM.killa, 0);
  });

  it('is null until both sides are entered', () => {
    expect(tapeAreaSqm(plot({ sideA: null }))).toBeNull();
    expect(tapeAreaSqm(plot({ sideB: null }))).toBeNull();
  });
});

describe('error against the tape', () => {
  it('is signed, positive when the app reads high', () => {
    const p = plot({ sideA: 100, sideB: 100 }); // 10,000 m²
    expect(errorVsTape(measurement(p.id, 10_200), p)).toBeCloseTo(0.02, 6);
    expect(errorVsTape(measurement(p.id, 9_800), p)).toBeCloseTo(-0.02, 6);
  });

  it('is null without a tape reading', () => {
    const p = plot({ sideA: null });
    expect(errorVsTape(measurement(p.id, 4000), p)).toBeNull();
  });
});

describe('the gate', () => {
  /** n plots of a given size, each measured once at `errorFraction` off. */
  function sample(n: number, sideM: number, errorFraction: number) {
    const plots: TestPlot[] = [];
    const measurements: TestMeasurement[] = [];

    for (let i = 0; i < n; i += 1) {
      const p = plot({ sideA: sideM, sideB: sideM });
      const truth = sideM * sideM;
      plots.push(p);
      // Two readings per plot so repeatability has something to work with.
      measurements.push(measurement(p.id, truth * (1 + errorFraction)));
      measurements.push(measurement(p.id, truth * (1 + errorFraction * 0.9)));
    }
    return { plots, measurements };
  }

  it('does not pass on fewer than 20 taped plots', () => {
    const { plots, measurements } = sample(5, 100, 0.005);
    const summary = summarise(plots, measurements);

    expect(summary.gatePasses).toBe(false);
    expect(summary.gateNotes.join(' ')).toContain('5 of 20');
  });

  it('passes when 20 accurate plots have been measured twice', () => {
    // 100 x 100 m = 2.47 killa, so this lands in the strict 2% bucket.
    const { plots, measurements } = sample(20, 100, 0.005);
    const summary = summarise(plots, measurements);

    expect(summary.plotsWithTape).toBe(20);
    expect(summary.gatePasses).toBe(true);
    expect(summary.gateNotes).toHaveLength(0);
  });

  it('fails a large plot that misses the 2% bar', () => {
    const { plots, measurements } = sample(20, 100, 0.035);
    const summary = summarise(plots, measurements);

    expect(summary.gatePasses).toBe(false);
    expect(summary.gateNotes.join(' ')).toContain('2 killa and above');
  });

  it('holds small plots to 4%, not 2%', () => {
    // 45 x 45 m = 0.5 killa. 3% would fail the strict bar and passes here,
    // because simulation says small plots cannot reach 2% from GPS alone.
    const { plots, measurements } = sample(20, 45, 0.03);
    const summary = summarise(plots, measurements);

    const bucket = summary.bySize.find((b) => b.label === 'under 1 killa');
    expect(bucket?.bar).toBe(0.04);
    expect(bucket?.passes).toBe(true);
    expect(summary.gatePasses).toBe(true);
  });

  it('flags untested repeatability', () => {
    const plots: TestPlot[] = [];
    const measurements: TestMeasurement[] = [];
    for (let i = 0; i < 20; i += 1) {
      const p = plot({ sideA: 100, sideB: 100 });
      plots.push(p);
      measurements.push(measurement(p.id, 10_050)); // one reading only
    }
    const summary = summarise(plots, measurements);

    expect(summary.repeatability).toBeNull();
    expect(summary.gatePasses).toBe(false);
    expect(summary.gateNotes.join(' ')).toContain('measured twice');
  });

  it('fails when repeat measurements disagree', () => {
    const plots: TestPlot[] = [];
    const measurements: TestMeasurement[] = [];
    for (let i = 0; i < 20; i += 1) {
      const p = plot({ sideA: 100, sideB: 100 });
      plots.push(p);
      measurements.push(measurement(p.id, 10_000));
      measurements.push(measurement(p.id, 10_600)); // 6% apart
    }
    const summary = summarise(plots, measurements);

    expect(summary.repeatability?.meanSpread).toBeGreaterThan(0.03);
    expect(summary.gatePasses).toBe(false);
  });
});

describe('method comparison', () => {
  it('reports drawing and walking separately', () => {
    const p = plot({ sideA: 100, sideB: 100 });
    const summary = summarise(
      [p],
      [
        measurement(p.id, 10_100, { method: 'drawn' }),
        measurement(p.id, 10_400, { method: 'walked' }),
      ],
    );

    const drawn = summary.byMethod.find((m) => m.method === 'drawn');
    const walked = summary.byMethod.find((m) => m.method === 'walked');

    expect(drawn?.meanAbsError).toBeCloseTo(0.01, 4);
    expect(walked?.meanAbsError).toBeCloseTo(0.04, 4);
  });
});

describe('the jamabandi gap', () => {
  it('is reported but never gates the build', () => {
    // Every plot reads 10% below its paper record — systematic, one-sided,
    // and exactly the kind of thing that would blindside a launch.
    const plots: TestPlot[] = [];
    const measurements: TestMeasurement[] = [];
    for (let i = 0; i < 20; i += 1) {
      const p = plot({ sideA: 100, sideB: 100, jamabandiSqm: 11_111 });
      plots.push(p);
      measurements.push(measurement(p.id, 10_000));
      measurements.push(measurement(p.id, 10_020));
    }
    const summary = summarise(plots, measurements);

    expect(summary.jamabandi?.medianGap).toBeLessThan(-0.05);
    expect(summary.jamabandi?.consistency).toBe(1); // entirely one-sided
    expect(summary.gateNotes.join(' ')).toContain('jamabandi');

    // Accuracy against the tape is fine, so the build is not blocked —
    // but the warning is on the record.
    expect(summary.gatePasses).toBe(true);
  });
});

describe('CSV export', () => {
  it('writes one row per measurement', () => {
    const p = plot({ label: 'Gurmeet', jamabandiSqm: 4000 });
    const csv = buildCsv(p ? [p] : [], [
      measurement(p.id, 4100, { method: 'drawn' }),
      measurement(p.id, 4200, { method: 'walked', meanAccuracyM: 5.2 }),
    ]);
    const lines = csv.trim().split('\n');

    expect(lines).toHaveLength(3); // header + 2
    expect(lines[0]).toContain('error_vs_tape_pc');
    expect(lines[1]).toContain('drawn');
    expect(lines[2]).toContain('walked');
  });

  it('includes plots that have not been measured yet', () => {
    // An untested plot is a gap in the sample and must be visible.
    const csv = buildCsv([plot({ label: 'Untouched' })], []);
    expect(csv.trim().split('\n')).toHaveLength(2);
    expect(csv).toContain('Untouched');
  });

  it('escapes commas and quotes in free text', () => {
    const p = plot({ label: 'Gurmeet, big field', notes: 'said "too small"' });
    const csv = buildCsv([p], [measurement(p.id, 4000)]);

    expect(csv).toContain('"Gurmeet, big field"');
    expect(csv).toContain('"said ""too small"""');
  });
});
