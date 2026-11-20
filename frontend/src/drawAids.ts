/**
 * The draw screen's aids (Stage 6), kept pure for testing.
 *
 * Corners are placed under a fixed crosshair, never by a fingertip that
 * covers the spot. And only when zoomed in: at village scale one tap spans
 * twenty metres, which on a killa is a big share of a side.
 */

/** Widest view, in metres across, at which a corner may be placed. */
export const MAX_VIEW_M = 400;

/** How many metres the map shows across. */
export const viewWidthM = (r: { latitude: number; longitudeDelta: number }): number =>
  r.longitudeDelta * 111_320 * Math.cos((r.latitude * Math.PI) / 180);

/** Which aids a drawn measurement used, for the field-test recorder. */
export interface DrawAids {
  /** He pressed "Make it a rectangle" and kept it. */
  snapped: boolean;
  /** He dragged a corner after placing it. */
  dragged: boolean;
  /** The widest view any corner was placed at, metres across. */
  widestViewM: number | null;
}
