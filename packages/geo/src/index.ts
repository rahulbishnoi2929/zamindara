/**
 * @zamindara/geo
 *
 * The boundary-walk geometry pipeline: raw GPS track in, field polygon and
 * area out. Pure functions, no device APIs, so the whole thing is testable
 * without standing in a field.
 *
 * See docs/UNITS_AND_MEASUREMENT.md §4.
 */

export {
  closeRing,
  isSelfIntersecting,
  openRing,
  ringAreaSqm,
  ringPerimeterM,
  signedAreaXY,
} from './area.js';

export {
  DEFAULT_FILTER,
  accuracyBand,
  filterTrack,
  type FilterOptions,
  type FilterResult,
} from './filter.js';

export { processWalk, type PipelineOptions } from './pipeline.js';

export { centroidOf, distanceM, project, unproject } from './projection.js';

export {
  convexHull,
  fitRectangleToPolygon,
  minimumBoundingRectangle,
  projectRing,
  rectangleToLatLng,
  rectangularity,
  refineRectangle,
  snapToKaramGrid,
  type GridSnapResult,
  type OrientedRectangle,
  type RefinedRectangle,
} from './rectangle.js';

export { simplifyTrack } from './simplify.js';
export { smoothRing } from './smooth.js';
export { makeRectangleField, simulateWalk, type SimulateOptions } from './simulate.js';

export type {
  AreaMethod,
  CaptureQuality,
  GpsPoint,
  LatLng,
  RejectReason,
  RejectedPoint,
  WalkResult,
  XY,
} from './types.js';
