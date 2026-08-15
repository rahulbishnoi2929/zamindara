import { centroidOf, project, unproject } from './projection.js';
import type { LatLng } from './types.js';

/**
 * Circular moving-average smoothing of a walked ring.
 *
 * Filtering removes fixes we should not trust; it does nothing about the error
 * in the ones we keep. Averaging each point with its neighbours does: with a
 * window of w, independent noise falls by roughly √w, so a 4 m error becomes
 * about 1.8 m at w = 5.
 *
 * The cost is rounded corners, which cuts a little area. The window is kept
 * small for that reason, and the effect is measured rather than assumed —
 * see test/accuracy.test.ts, which reports bias across many simulated walks.
 *
 * The ring is treated as circular, so the start/end join is smoothed like any
 * other part of the boundary rather than being left as a seam.
 */
export function smoothRing(ring: readonly LatLng[], window = 5): LatLng[] {
  const n = ring.length;
  if (n < 3 || window < 2) return [...ring];

  const half = Math.floor(window / 2);
  const origin = centroidOf(ring);
  const xy = ring.map((p) => project(p, origin));

  const smoothed = xy.map((_, i) => {
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (let k = -half; k <= half; k += 1) {
      const p = xy[(i + k + n * (Math.abs(k) + 1)) % n]!;
      sx += p.x;
      sy += p.y;
      count += 1;
    }
    return { x: sx / count, y: sy / count };
  });

  return smoothed.map((p) => unproject(p, origin));
}
