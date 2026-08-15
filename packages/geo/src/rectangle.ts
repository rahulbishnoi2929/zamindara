import { KARAM_M } from '@zamindara/units';
import { signedAreaXY } from './area.js';
import { centroidOf, project, unproject } from './projection.js';
import type { LatLng, XY } from './types.js';

function cross(o: XY, a: XY, b: XY): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Convex hull, counter-clockwise. Andrew's monotone chain. */
export function convexHull(points: readonly XY[]): XY[] {
  if (points.length < 3) return [...points];

  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const build = (pts: XY[]): XY[] => {
    const stack: XY[] = [];
    for (const p of pts) {
      while (stack.length >= 2 && cross(stack[stack.length - 2]!, stack[stack.length - 1]!, p) <= 0) {
        stack.pop();
      }
      stack.push(p);
    }
    stack.pop();
    return stack;
  };

  return [...build(sorted), ...build(sorted.reverse())];
}

export interface OrientedRectangle {
  /** Four corners, in the local tangent plane. */
  cornersXY: XY[];
  /** Long side, metres. */
  lengthM: number;
  /** Short side, metres. */
  widthM: number;
  /** Rotation of the long side from east, radians. */
  angleRad: number;
  areaSqm: number;
}

/**
 * Minimum-area bounding rectangle, by rotating calipers.
 *
 * The key insight for Fazilka: canal-colony fields *are* rectangles. The wobble
 * in a walked track is GPS error, not the shape of the land. Fitting the
 * best rectangle therefore removes error rather than adding assumption.
 *
 * The minimum-area rectangle always shares an edge with the convex hull, so
 * testing one orientation per hull edge is exhaustive.
 */
export function minimumBoundingRectangle(points: readonly XY[]): OrientedRectangle | null {
  const hull = convexHull(points);
  if (hull.length < 3) return null;

  let best: OrientedRectangle | null = null;

  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of hull) {
      const x = p.x * cos - p.y * sin;
      const y = p.x * sin + p.y * cos;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    const w = maxX - minX;
    const h = maxY - minY;
    const area = w * h;

    if (best === null || area < best.areaSqm) {
      best = {
        cornersXY: rotatedCorners(minX, maxX, minY, maxY, angle),
        lengthM: Math.max(w, h),
        widthM: Math.min(w, h),
        angleRad: angle,
        areaSqm: area,
      };
    }
  }

  return best;
}

function rotatedCorners(minX: number, maxX: number, minY: number, maxY: number, angle: number): XY[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners: Array<[number, number]> = [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ];
  return corners.map(([x, y]) => ({ x: x * cos - y * sin, y: x * sin + y * cos }));
}

/**
 * Fit a rectangle to a noisy walked ring, without the bounding-box bias.
 *
 * A *minimum bounding* rectangle is systematically too big. It has to enclose
 * every point, so it latches onto the outermost noise excursion on each side —
 * with 4 m GPS error on a 60 m plot that inflates the area by roughly a
 * quarter. Using it directly would make the "correction" worse than the raw
 * measurement.
 *
 * The shoelace area of the walked polygon, by contrast, is close to unbiased:
 * noise pushes the traced path outside the true boundary as often as inside,
 * and the errors largely cancel around the loop.
 *
 * So we take orientation and aspect ratio from the bounding rectangle — both
 * robust — and scale it to match the polygon's own area. The result is a clean
 * rectangle the farmer can recognise, carrying the area estimate we actually
 * trust.
 */
export function fitRectangleToPolygon(ringXY: readonly XY[]): OrientedRectangle | null {
  const mbr = minimumBoundingRectangle(ringXY);
  if (mbr === null || mbr.areaSqm === 0) return null;

  const polygonArea = Math.abs(signedAreaXY(ringXY));
  if (polygonArea === 0) return null;

  const scale = Math.sqrt(polygonArea / mbr.areaSqm);
  const cx = mbr.cornersXY.reduce((s, p) => s + p.x, 0) / 4;
  const cy = mbr.cornersXY.reduce((s, p) => s + p.y, 0) / 4;

  return {
    cornersXY: mbr.cornersXY.map((p) => ({
      x: cx + (p.x - cx) * scale,
      y: cy + (p.y - cy) * scale,
    })),
    lengthM: mbr.lengthM * scale,
    widthM: mbr.widthM * scale,
    angleRad: mbr.angleRad,
    areaSqm: polygonArea,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export interface RefinedRectangle extends OrientedRectangle {
  /** RMS distance from the boundary points to the fitted edges, metres. */
  residualM: number;
}

/**
 * Refine a rectangle by fitting each edge to the points that lie along it.
 *
 * Neither of the simpler estimates is good enough on its own. The bounding
 * rectangle is inflated by noise; scaling it to the polygon's area fixes the
 * total but inherits a biased aspect ratio, because noise stretches the short
 * side proportionally more than the long one.
 *
 * The fix uses a fact specific to this problem: every point walked along one
 * edge shares the same true coordinate in the rectangle's frame, differing only
 * by noise. The *median* of those measurements is therefore an unbiased
 * estimate of where the edge really is, and is unmoved by the occasional wild
 * fix. So we assign each point to its nearest edge, take the median per edge,
 * and repeat — each pass sharpens the assignment.
 *
 * Also returns the residual, which is what tells us whether the plot was a
 * rectangle at all.
 */
export function refineRectangle(
  pointsXY: readonly XY[],
  angleRad: number,
  iterations = 3,
): RefinedRectangle | null {
  if (pointsXY.length < 4) return null;

  const cos = Math.cos(-angleRad);
  const sin = Math.sin(-angleRad);
  const rotated = pointsXY.map((p) => ({
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  }));

  let minX = Math.min(...rotated.map((p) => p.x));
  let maxX = Math.max(...rotated.map((p) => p.x));
  let minY = Math.min(...rotated.map((p) => p.y));
  let maxY = Math.max(...rotated.map((p) => p.y));

  for (let pass = 0; pass < iterations; pass += 1) {
    const left: number[] = [];
    const right: number[] = [];
    const bottom: number[] = [];
    const top: number[] = [];

    for (const p of rotated) {
      const distances = [
        { edge: 'left', d: Math.abs(p.x - minX) },
        { edge: 'right', d: Math.abs(p.x - maxX) },
        { edge: 'bottom', d: Math.abs(p.y - minY) },
        { edge: 'top', d: Math.abs(p.y - maxY) },
      ];
      distances.sort((a, b) => a.d - b.d);

      switch (distances[0]!.edge) {
        case 'left': left.push(p.x); break;
        case 'right': right.push(p.x); break;
        case 'bottom': bottom.push(p.y); break;
        default: top.push(p.y); break;
      }
    }

    if (left.length === 0 || right.length === 0 || bottom.length === 0 || top.length === 0) {
      return null;
    }

    minX = median(left);
    maxX = median(right);
    minY = median(bottom);
    maxY = median(top);
  }

  if (maxX <= minX || maxY <= minY) return null;

  // How far do the points actually sit from the edges we fitted?
  let sumSq = 0;
  for (const p of rotated) {
    const d = Math.min(
      Math.abs(p.x - minX),
      Math.abs(p.x - maxX),
      Math.abs(p.y - minY),
      Math.abs(p.y - maxY),
    );
    sumSq += d * d;
  }
  const residualM = Math.sqrt(sumSq / rotated.length);

  const w = maxX - minX;
  const h = maxY - minY;
  const back = (x: number, y: number): XY => ({
    x: x * Math.cos(angleRad) - y * Math.sin(angleRad),
    y: x * Math.sin(angleRad) + y * Math.cos(angleRad),
  });

  return {
    cornersXY: [back(minX, minY), back(maxX, minY), back(maxX, maxY), back(minX, maxY)],
    lengthM: Math.max(w, h),
    widthM: Math.min(w, h),
    angleRad,
    areaSqm: w * h,
    residualM,
  };
}

export interface GridSnapResult {
  rectangle: OrientedRectangle;
  /** Did either side actually move? */
  snapped: boolean;
  /** Sides expressed in karam after snapping. */
  lengthKaram: number;
  widthKaram: number;
}

/**
 * Snap a rectangle's sides to whole karam.
 *
 * Canal-colony plots were surveyed in karam — a killa is 36 × 40 karam — so
 * whole-karam sides are the ground truth the land was laid out against.
 *
 * Snapping is applied to a side **only when the measurement is already close
 * to a whole karam**, within `toleranceKaram`. Forcing a side that sits halfway
 * between two karam would invent precision and could push the area further from
 * the truth than leaving it alone. When in doubt, we do not snap.
 */
export function snapToKaramGrid(
  rect: OrientedRectangle,
  toleranceKaram = 0.35,
): GridSnapResult {
  const snapSide = (metres: number): { value: number; karam: number; moved: boolean } => {
    const inKaram = metres / KARAM_M;
    const nearest = Math.round(inKaram);
    const off = Math.abs(inKaram - nearest);

    if (nearest >= 1 && off <= toleranceKaram) {
      return { value: nearest * KARAM_M, karam: nearest, moved: true };
    }
    return { value: metres, karam: inKaram, moved: false };
  };

  const length = snapSide(rect.lengthM);
  const width = snapSide(rect.widthM);
  const snapped = length.moved || width.moved;

  if (!snapped) {
    return {
      rectangle: rect,
      snapped: false,
      lengthKaram: length.karam,
      widthKaram: width.karam,
    };
  }

  // Rescale the corners about the rectangle's centre so the drawn shape
  // matches the snapped dimensions.
  const cx = rect.cornersXY.reduce((s, p) => s + p.x, 0) / 4;
  const cy = rect.cornersXY.reduce((s, p) => s + p.y, 0) / 4;
  const scaleLong = rect.lengthM === 0 ? 1 : length.value / rect.lengthM;
  const scaleShort = rect.widthM === 0 ? 1 : width.value / rect.widthM;
  const cos = Math.cos(rect.angleRad);
  const sin = Math.sin(rect.angleRad);
  const widthIsAlongEdge = rect.widthM >= rect.lengthM;

  const cornersXY = rect.cornersXY.map((p) => {
    // Into the rectangle's own frame, scale, then back out.
    const dx = p.x - cx;
    const dy = p.y - cy;
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    const su = u * (widthIsAlongEdge ? scaleShort : scaleLong);
    const sv = v * (widthIsAlongEdge ? scaleLong : scaleShort);
    return { x: cx + su * cos - sv * sin, y: cy + su * sin + sv * cos };
  });

  return {
    rectangle: {
      cornersXY,
      lengthM: length.value,
      widthM: width.value,
      angleRad: rect.angleRad,
      areaSqm: length.value * width.value,
    },
    snapped: true,
    lengthKaram: length.karam,
    widthKaram: width.karam,
  };
}

/**
 * How rectangular is this shape? Polygon area ÷ bounding-rectangle area.
 *
 * 1.0 is a perfect rectangle. Fazilka's canal-grid plots sit near it; a
 * canal-side or river-side plot will not, and must keep its true polygon.
 */
export function rectangularity(ringXY: readonly XY[]): number {
  const mbr = minimumBoundingRectangle(ringXY);
  if (mbr === null || mbr.areaSqm === 0) return 0;
  return Math.abs(signedAreaXY(ringXY)) / mbr.areaSqm;
}

/** Convert projected rectangle corners back to coordinates. */
export function rectangleToLatLng(rect: OrientedRectangle, origin: LatLng): LatLng[] {
  return rect.cornersXY.map((xy) => unproject(xy, origin));
}

/** Project a ring for rectangle work, using its own centroid as origin. */
export function projectRing(ring: readonly LatLng[]): { xy: XY[]; origin: LatLng } {
  const origin = centroidOf(ring);
  return { xy: ring.map((p) => project(p, origin)), origin };
}
