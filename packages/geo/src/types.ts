/** A WGS84 coordinate. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** A raw GPS fix as delivered by expo-location. */
export interface GpsPoint extends LatLng {
  /** Horizontal accuracy in metres, as reported by the device. */
  accuracy: number;
  /** Epoch milliseconds. */
  timestamp: number;
  /** Device-reported speed in m/s, when available. */
  speed?: number;
}

/** A point in the local tangent plane, in metres. */
export interface XY {
  x: number;
  y: number;
}

export type RejectReason =
  | 'poor-accuracy'
  | 'too-fast'
  | 'too-close'
  | 'out-of-order';

export interface RejectedPoint {
  point: GpsPoint;
  reason: RejectReason;
}

export type CaptureQuality = 'good' | 'fair' | 'poor';

export type AreaMethod =
  /** Kept the walked shape. Used when the plot genuinely is not a rectangle. */
  | 'polygon'
  /** Fitted a rectangle to the walked edges. The main accuracy win. */
  | 'rectangle-fit'
  /** Rectangle fit, then quantised to whole karam of the canal grid. */
  | 'grid-snapped';

export interface WalkResult {
  /** Final closed polygon, ready to persist. */
  polygon: LatLng[];
  /** Area in square metres — the number everything downstream depends on. */
  areaSqm: number;
  /** Whether the canal-grid snap applied. */
  method: AreaMethod;
  /** Area before snapping, so the two can be compared in field testing. */
  rawPolygonAreaSqm: number;
  perimeterM: number;
  /**
   * Polygon area ÷ bounding-rectangle area. Reported for diagnostics only —
   * noise depresses it even for a true rectangle, so it is not what decides
   * whether the grid snap applies.
   */
  rectangularity: number;
  /**
   * RMS distance from the boundary to the best-fit rectangle, in metres.
   * Compared against GPS accuracy, this is what decides the snap.
   */
  rectangleResidualM: number;
  /** Mean reported accuracy across accepted fixes, in metres. */
  meanAccuracyM: number;
  accepted: GpsPoint[];
  rejected: RejectedPoint[];
  simplified: LatLng[];
  quality: CaptureQuality;
  /** Human-readable problems worth showing the farmer before he confirms. */
  warnings: string[];
}
