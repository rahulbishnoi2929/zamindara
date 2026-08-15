import { centroidOf, distanceM, project } from './projection.js';
import type { LatLng, XY } from './types.js';

/** Shoelace area of a planar ring, in square metres. Sign indicates winding. */
export function signedAreaXY(ring: readonly XY[]): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/**
 * Area of a lat/lng ring, in square metres.
 *
 * Projects to a local tangent plane and applies the shoelace formula. At field
 * scale this matches a full geodesic computation to well within a square metre
 * — a rounding error against the 25 m² marla we display in.
 *
 * Always positive: winding order is an artefact of which way the farmer walked
 * around his field, and carries no meaning we want to propagate.
 */
export function ringAreaSqm(ring: readonly LatLng[]): number {
  if (ring.length < 3) return 0;
  const origin = centroidOf(ring);
  return Math.abs(signedAreaXY(ring.map((p) => project(p, origin))));
}

/** Perimeter of a closed ring, in metres. */
export function ringPerimeterM(ring: readonly LatLng[]): number {
  if (ring.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i += 1) {
    total += distanceM(ring[i]!, ring[(i + 1) % ring.length]!);
  }
  return total;
}

/**
 * Remove a duplicated closing vertex, if present.
 *
 * GeoJSON rings repeat the first point at the end; the shoelace formula does
 * not want it. Normalising here keeps every caller from having to care.
 */
export function openRing(ring: readonly LatLng[]): LatLng[] {
  if (ring.length < 2) return [...ring];
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  const isClosed = distanceM(first, last) < 0.5;
  return isClosed ? ring.slice(0, -1) : [...ring];
}

/** Append the first point to the end, GeoJSON style. */
export function closeRing(ring: readonly LatLng[]): LatLng[] {
  const open = openRing(ring);
  return open.length === 0 ? [] : [...open, open[0]!];
}

/**
 * Does the ring cross itself?
 *
 * A self-intersecting polygon produces a meaningless area — sometimes a
 * plausible-looking one, which is worse. Happens when a farmer cuts across his
 * field mid-walk or doubles back around an obstacle.
 */
export function isSelfIntersecting(ring: readonly LatLng[]): boolean {
  const open = openRing(ring);
  if (open.length < 4) return false;

  const origin = centroidOf(open);
  const pts = open.map((p) => project(p, origin));
  const n = pts.length;

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      // Skip segments that share a vertex — they touch by construction.
      if (i === j || (i === 0 && j === n - 1) || j === i + 1) continue;
      if (segmentsIntersect(pts[i]!, pts[(i + 1) % n]!, pts[j]!, pts[(j + 1) % n]!)) {
        return true;
      }
    }
  }
  return false;
}

function cross(o: XY, a: XY, b: XY): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function segmentsIntersect(p1: XY, p2: XY, p3: XY, p4: XY): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}
