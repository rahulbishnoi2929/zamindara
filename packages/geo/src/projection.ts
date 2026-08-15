import type { LatLng, XY } from './types.js';

/** Mean Earth radius (IUGG), metres. */
const R = 6_371_008.8;
const DEG = Math.PI / 180;

/**
 * Project lat/lng onto a local tangent plane in metres, centred on `origin`.
 *
 * An equirectangular projection about a local origin. At field scale — a few
 * hundred metres — the distortion is far below a millimetre, which is five
 * orders of magnitude smaller than GPS error. Using a full geodesic solution
 * here would add complexity and change no digit anyone will ever see.
 */
export function project(point: LatLng, origin: LatLng): XY {
  const cosLat = Math.cos(origin.lat * DEG);
  return {
    x: (point.lng - origin.lng) * DEG * R * cosLat,
    y: (point.lat - origin.lat) * DEG * R,
  };
}

/** Inverse of `project`. */
export function unproject(xy: XY, origin: LatLng): LatLng {
  const cosLat = Math.cos(origin.lat * DEG);
  return {
    lng: origin.lng + xy.x / (DEG * R * cosLat),
    lat: origin.lat + xy.y / (DEG * R),
  };
}

/** Mean of a set of coordinates. Used as the projection origin. */
export function centroidOf(points: readonly LatLng[]): LatLng {
  if (points.length === 0) throw new RangeError('no points');
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}

/** Great-circle distance in metres. Haversine. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
