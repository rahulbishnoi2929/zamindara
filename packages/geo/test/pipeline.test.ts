import { ACRE_SQM, KARAM_M } from '@zamindara/units';
import { describe, expect, it } from 'vitest';
import { ringAreaSqm } from '../src/area.js';
import { processWalk } from '../src/pipeline.js';
import { makeRectangleField, simulateWalk } from '../src/simulate.js';
import type { LatLng } from '../src/types.js';

/**
 * Behaviour of the pipeline: what it decides, what it returns, what it refuses.
 * Accuracy is a statistical property and lives in accuracy.test.ts — asserting
 * it against a single random seed only tests which seed you happened to pick.
 */

const FAZILKA: LatLng = { lat: 30.4028, lng: 74.0286 };

describe('a standard canal-colony killa', () => {
  const field = makeRectangleField(FAZILKA);

  it('is exactly one acre before any GPS is involved', () => {
    expect(ringAreaSqm(field)).toBeCloseTo(ACRE_SQM, 1);
  });

  it('is recognised as a rectangle', () => {
    const result = processWalk(simulateWalk(field, { seed: 1 }));
    expect(result.method).toBe('rectangle-fit');
  });

  it('produces a four-corner outline the farmer can drag', () => {
    // Five points: four corners plus the repeated closing vertex.
    const result = processWalk(simulateWalk(field, { seed: 1 }));
    expect(result.polygon).toHaveLength(5);
  });

  it('lands in the right neighbourhood', () => {
    const result = processWalk(simulateWalk(field, { seed: 1 }));
    expect(result.areaSqm).toBeGreaterThan(ACRE_SQM * 0.9);
    expect(result.areaSqm).toBeLessThan(ACRE_SQM * 1.1);
  });
});

describe('plots that are not rectangles', () => {
  it('keeps the true polygon for an irregular plot', () => {
    // Canal-side and orchard-corner plots genuinely are not rectangles.
    // Forcing one would invent land the farmer does not have.
    const irregular: LatLng[] = [
      { lat: 30.4028, lng: 74.0286 },
      { lat: 30.4034, lng: 74.0291 },
      { lat: 30.4031, lng: 74.0299 },
      { lat: 30.4022, lng: 74.0297 },
      { lat: 30.4019, lng: 74.0289 },
      { lat: 30.4023, lng: 74.0283 },
    ];
    const result = processWalk(simulateWalk(irregular, { noiseSigmaM: 3, seed: 9 }));

    expect(result.method).toBe('polygon');
    expect(result.polygon.length).toBeGreaterThan(5);
  });

  it('does not lose much area on an irregular plot', () => {
    const irregular: LatLng[] = [
      { lat: 30.4028, lng: 74.0286 },
      { lat: 30.4038, lng: 74.0294 },
      { lat: 30.4033, lng: 74.0305 },
      { lat: 30.4018, lng: 74.0301 },
      { lat: 30.4014, lng: 74.0288 },
    ];
    const truth = ringAreaSqm(irregular);
    const result = processWalk(simulateWalk(irregular, { noiseSigmaM: 3, seed: 4 }));

    expect(Math.abs(result.areaSqm / truth - 1)).toBeLessThan(0.06);
  });
});

describe('fields at an angle to north', () => {
  it('are still recognised as rectangles', () => {
    // Canal-colony plots follow the murabba grid, which is not aligned to
    // north. Orientation must not affect the decision.
    for (const bearing of [0, Math.PI / 7, Math.PI / 4, 1.1]) {
      const field = makeRectangleField(FAZILKA, { bearingRad: bearing });
      const result = processWalk(simulateWalk(field, { seed: 3 }));
      expect(result.method).toBe('rectangle-fit');
    }
  });
});

describe('bad walks are reported, not silently accepted', () => {
  it('refuses a track with too few usable points', () => {
    const result = processWalk([
      { lat: 30.4, lng: 74.02, accuracy: 5, timestamp: 1000 },
      { lat: 30.4001, lng: 74.0201, accuracy: 5, timestamp: 2000 },
    ]);

    expect(result.areaSqm).toBe(0);
    expect(result.quality).toBe('poor');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('drops fixes with poor reported accuracy', () => {
    const field = makeRectangleField(FAZILKA);
    const track = simulateWalk(field, { seed: 2 }).map((p, i) =>
      i % 3 === 0 ? { ...p, accuracy: 40 } : p,
    );
    const result = processWalk(track);

    expect(result.rejected.some((r) => r.reason === 'poor-accuracy')).toBe(true);
    expect(result.accepted.every((p) => p.accuracy <= 10)).toBe(true);
  });

  it('keeps most of an honest walk', () => {
    // The filter's job is to remove noise, not the track. An early version
    // rejected 150 of 196 good fixes by testing raw gaps against a walking
    // pace, which GPS noise alone routinely exceeds.
    const field = makeRectangleField(FAZILKA);
    const track = simulateWalk(field, { seed: 2 });
    const result = processWalk(track);

    expect(result.accepted.length).toBeGreaterThan(track.length * 0.8);
  });

  it('grades a clean walk as good', () => {
    const field = makeRectangleField(FAZILKA);
    const result = processWalk(
      simulateWalk(field, { noiseSigmaM: 1.5, reportedAccuracyM: 4, seed: 4 }),
    );
    expect(result.quality).toBe('good');
  });

  it('reports mean accuracy so the UI can explain itself', () => {
    const field = makeRectangleField(FAZILKA);
    const result = processWalk(simulateWalk(field, { reportedAccuracyM: 5, seed: 6 }));

    expect(result.meanAccuracyM).toBeGreaterThan(0);
    expect(result.meanAccuracyM).toBeLessThanOrEqual(10);
  });
});

describe('the returned polygon', () => {
  it('is closed, GeoJSON style', () => {
    const field = makeRectangleField(FAZILKA);
    const result = processWalk(simulateWalk(field, { seed: 8 }));
    const first = result.polygon[0]!;
    const last = result.polygon[result.polygon.length - 1]!;

    expect(first.lat).toBeCloseTo(last.lat, 9);
    expect(first.lng).toBeCloseTo(last.lng, 9);
  });

  it('has an area matching what the pipeline reported', () => {
    // If these ever disagree, the farmer is confirming one shape and being
    // billed for another.
    for (const seed of [1, 5, 12, 30]) {
      const field = makeRectangleField(FAZILKA, { bearingRad: 0.3 });
      const result = processWalk(simulateWalk(field, { seed }));
      expect(ringAreaSqm(result.polygon)).toBeCloseTo(result.areaSqm, 0);
    }
  });

  it('carries the diagnostics the confirmation screen needs', () => {
    const field = makeRectangleField(FAZILKA, { lengthM: 80 * KARAM_M });
    const result = processWalk(simulateWalk(field, { seed: 2 }));

    expect(result.rawPolygonAreaSqm).toBeGreaterThan(0);
    expect(result.perimeterM).toBeGreaterThan(0);
    expect(Number.isFinite(result.rectangleResidualM)).toBe(true);
    expect(result.simplified.length).toBeGreaterThan(3);
  });
});
