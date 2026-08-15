import { KARAM_M } from '@zamindara/units';
import { describe, expect, it } from 'vitest';
import { ringAreaSqm } from '../src/area.js';
import { processWalk, type PipelineOptions } from '../src/pipeline.js';
import { makeRectangleField, simulateWalk } from '../src/simulate.js';

/**
 * These are not really unit tests. They are the evidence for the pipeline's
 * design, and a guard against a future change that looks clever and quietly
 * costs a farmer money.
 *
 * The simulator uses independent Gaussian error. Real GPS error is correlated
 * over time — a bad ionosphere or a tree line skews a whole edge one way — so
 * treat these as a floor on the error, not a prediction of it. The 20-plot
 * field test against jamabandi records is the real measurement.
 */

const FAZILKA = { lat: 30.4028, lng: 74.0286 };
const SEEDS = 200;

interface Stats {
  bias: number;
  meanAbsError: number;
  within2pc: number;
}

function measure(options: PipelineOptions = {}, killa = 1): Stats {
  const field = makeRectangleField(FAZILKA, {
    lengthM: 40 * KARAM_M * Math.sqrt(killa),
    widthM: 36 * KARAM_M * Math.sqrt(killa),
  });
  const truth = ringAreaSqm(field);
  const errors: number[] = [];

  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const r = processWalk(simulateWalk(field, { noiseSigmaM: 4, seed }), options);
    errors.push(r.areaSqm / truth - 1);
  }

  const abs = errors.map(Math.abs);
  return {
    bias: errors.reduce((s, e) => s + e, 0) / errors.length,
    meanAbsError: abs.reduce((s, e) => s + e, 0) / abs.length,
    within2pc: abs.filter((e) => e < 0.02).length / abs.length,
  };
}

describe('smoothing is the stage that matters', () => {
  // Measured with rectangle fitting off, so the effect being tested is the
  // smoothing alone. The median edge fit is itself robust to noise, and with
  // it switched on it masks most of what this stage contributes.

  it('beats no smoothing decisively', () => {
    const none = measure({ smoothWindow: 0, rectangleFit: false });
    const some = measure({ smoothWindow: 5, rectangleFit: false });

    expect(some.meanAbsError).toBeLessThan(none.meanAbsError * 0.7);
  });

  it('gets worse again when the window is too wide', () => {
    // Over-smoothing rounds the corners off the field, and a rounded corner
    // is land the farmer owns and would not be paid for. Note the sign: the
    // bias is always negative, so the failure mode is under-billing him for
    // work done on land he actually has.
    const good = measure({ smoothWindow: 5, rectangleFit: false });
    const tooMuch = measure({ smoothWindow: 21, rectangleFit: false });

    expect(tooMuch.bias).toBeLessThan(-0.03);
    expect(good.meanAbsError).toBeLessThan(tooMuch.meanAbsError);
  });
});

describe('the karam grid snap does not pay for itself', () => {
  // A negative result, kept deliberately. One karam is 2.8% of a 36-karam
  // side, so quantising an estimate already inside 2% mostly rounds it away
  // from the truth. Grid snapping was the original design premise; the
  // measurement said no, so it ships switched off.
  //
  // The field test should revisit this: real canal-colony plots may sit
  // closer to the surveyed grid than simulated ones do.
  it('is no better than plain rectangle fitting', () => {
    const fitted = measure({ gridSnap: false });
    const snapped = measure({ gridSnap: true });

    expect(snapped.within2pc).toBeLessThanOrEqual(fitted.within2pc);
  });
});

describe('field size dominates everything else', () => {
  // The single most important operational finding. GPS error is a fixed
  // number of metres, so its effect on *area* shrinks as the field grows.
  const sizes = [0.5, 1, 2, 5];
  const results = sizes.map((killa) => ({ killa, ...measure({}, killa) }));

  it('reports the size curve', () => {
    console.log('\n  plot size   mean |error|   within 2%');
    for (const r of results) {
      console.log(
        `  ${String(r.killa).padStart(4)} killa   ` +
          `${(r.meanAbsError * 100).toFixed(2).padStart(8)}%   ` +
          `${(r.within2pc * 100).toFixed(0).padStart(7)}%`,
      );
    }
  });

  it('gets steadily more accurate as the plot gets bigger', () => {
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i]!.meanAbsError).toBeLessThan(results[i - 1]!.meanAbsError);
    }
  });

  it('comfortably meets the 2% bar at two killa and above', () => {
    expect(measure({}, 2).within2pc).toBeGreaterThan(0.8);
    expect(measure({}, 5).within2pc).toBeGreaterThan(0.95);
  });

  it('does NOT meet the 2% bar on a half-killa plot', () => {
    // Documented, not hidden. Small plots need the satellite drag-correction
    // or a second walk — the algorithm alone cannot get there from 4 m GPS.
    expect(measure({}, 0.5).within2pc).toBeLessThan(0.6);
  });
});

describe('degradation as GPS worsens', () => {
  it('is gradual and reported, never silent', () => {
    const field = makeRectangleField(FAZILKA);
    const truth = ringAreaSqm(field);
    const observed: Array<{ sigma: number; error: number }> = [];

    for (const sigma of [2, 4, 6, 8]) {
      const errors: number[] = [];
      for (let seed = 1; seed <= 80; seed += 1) {
        const track = simulateWalk(field, {
          noiseSigmaM: sigma,
          reportedAccuracyM: sigma + 1,
          seed,
        });
        errors.push(Math.abs(processWalk(track).areaSqm / truth - 1));
      }
      observed.push({ sigma, error: errors.reduce((s, e) => s + e, 0) / errors.length });
    }

    for (let i = 1; i < observed.length; i += 1) {
      expect(observed[i]!.error).toBeGreaterThan(observed[i - 1]!.error);
    }
    expect(observed[0]!.error).toBeLessThan(0.015);
  });
});

describe('walking the field twice', () => {
  it('is worth it on a small plot', () => {
    // Averaging two independent walks cuts random error by about √2. On a
    // half-killa plot, where one walk cannot reach 2%, this is the cheapest
    // fix available and needs no new technology.
    const field = makeRectangleField(FAZILKA, {
      lengthM: 40 * KARAM_M * Math.sqrt(0.5),
      widthM: 36 * KARAM_M * Math.sqrt(0.5),
    });
    const truth = ringAreaSqm(field);

    const single: number[] = [];
    const doubled: number[] = [];

    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const a = processWalk(simulateWalk(field, { noiseSigmaM: 4, seed })).areaSqm;
      const b = processWalk(simulateWalk(field, { noiseSigmaM: 4, seed: seed + 5000 })).areaSqm;
      single.push(Math.abs(a / truth - 1));
      doubled.push(Math.abs((a + b) / 2 / truth - 1));
    }

    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    console.log(
      `\n  half killa: one walk ${(mean(single) * 100).toFixed(2)}%  ` +
        `two walks averaged ${(mean(doubled) * 100).toFixed(2)}%`,
    );

    expect(mean(doubled)).toBeLessThan(mean(single));
  });
});
