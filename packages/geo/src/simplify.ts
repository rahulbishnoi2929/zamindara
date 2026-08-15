import { centroidOf, project, unproject } from './projection.js';
import type { LatLng, XY } from './types.js';

/** Perpendicular distance from `p` to the segment `a`–`b`, in metres. */
function perpendicularDistance(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function rdp(points: readonly XY[], tolerance: number): XY[] {
  if (points.length <= 2) return [...points];

  const first = points[0]!;
  const last = points[points.length - 1]!;

  let maxDist = 0;
  let index = 0;

  for (let i = 1; i < points.length - 1; i += 1) {
    const dist = perpendicularDistance(points[i]!, first, last);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist <= tolerance) return [first, last];

  const left = rdp(points.slice(0, index + 1), tolerance);
  const right = rdp(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/**
 * Ramer–Douglas–Peucker simplification in metres.
 *
 * A walked rectangle arrives as hundreds of jittering fixes strung along what
 * should be four straight lines. Simplification recovers the intended shape and
 * — just as importantly — recovers the *corners*, which is what makes the
 * rectangle fit downstream meaningful.
 *
 * Default tolerance is 2 m: below typical GPS error, above the jitter.
 */
export function simplifyTrack(points: readonly LatLng[], toleranceM = 2): LatLng[] {
  if (points.length <= 2) return [...points];

  const origin = centroidOf(points);
  const projected = points.map((p) => project(p, origin));
  return rdp(projected, toleranceM).map((xy) => unproject(xy, origin));
}
