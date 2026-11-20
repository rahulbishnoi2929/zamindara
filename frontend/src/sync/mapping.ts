import type { PricingUnit } from '@zamindara/catalog';
import type { LatLng } from '@zamindara/geo';
import type { Job, JobStatus, JobWindow, PaymentMode } from '../jobs';
import type { CaptainMachine, Profile, Role, ServiceRate } from '../profile';
import type { SavedField } from '../storage';

/**
 * The wire format: how local models become database rows and back.
 *
 * This module is deliberately pure — no Supabase, no AsyncStorage, no React
 * Native — because every line here is one of the two things this project
 * treats as safety-critical: money and area. A swapped lat/lng, an unclosed
 * ring, a timestamp in the wrong unit silently changes what a farmer is
 * charged. So the mapping is tested on its own, before anything touches it.
 *
 * The three invariants worth reading for:
 *
 *   1. A field insert carries NO acreage. The server computes area from the
 *      boundary (guarantee 1) — if an area ever appears here, that promise
 *      is broken.
 *   2. Ids are UUIDs, minted on the phone at creation, so the same field or
 *      job is the same row on every device. Anything else (the old
 *      Date.now() ids) is not pushed with an id and gets a server-assigned
 *      one on first sync.
 *   3. Timestamps cross the wire as ISO strings and return as epoch
 *      milliseconds, exactly. Local code never sees an ISO string.
 */

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

/** Version 4 UUID, minted on the phone so a row keeps its identity offline. */
export function uuid(): string {
  const bytes = new Uint8Array(16);
  const c = globalThis.crypto;
  if (c !== undefined && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Anything that is not a UUID cannot be addressed by the database. */
export const isUuid = (id: string): boolean => UUID_RE.test(id);

// ---------------------------------------------------------------------------
// Timestamps — epoch milliseconds in, epoch milliseconds out
// ---------------------------------------------------------------------------

export const toIso = (epochMs: number): string => new Date(epochMs).toISOString();

export function fromIso(iso: string | null | undefined): number | null {
  if (iso === null || iso === undefined || iso === '') return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

// ---------------------------------------------------------------------------
// Geometry — LatLng corners to GeoJSON and back
// ---------------------------------------------------------------------------

export interface GeoJsonPolygon {
  type: 'Polygon';
  /** One outer ring, [lng, lat] pairs, closed. GeoJSON order, not ours. */
  coordinates: Array<Array<[number, number]>>;
}

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

export const pointToGeoJson = (p: LatLng): GeoJsonPoint => ({
  type: 'Point',
  coordinates: [p.lng, p.lat],
});

/**
 * Corners to a GeoJSON polygon ring.
 *
 * PostGIS requires the ring closed (first point repeated last) and the
 * database's own trigger requires at least three distinct corners. An
 * unclosed ring is accepted as geography and produces an area that is
 * quietly wrong, so closure happens here, in tested code, not at the call
 * site.
 *
 * Returns null when there is no polygon to send — the caller keeps the
 * field local rather than pushing something the server must reject.
 */
export function polygonToGeoJson(points: readonly LatLng[]): GeoJsonPolygon | null {
  if (points.length < 3) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const closed =
    last !== undefined && last.lat === first?.lat && last.lng === first?.lng;
  const ring = closed ? [...points] : [...points, first!];

  return {
    type: 'Polygon',
    coordinates: [ring.map((p) => [p.lng, p.lat] as [number, number])],
  };
}

/**
 * Geometry as the database will take it on write: EWKT text.
 *
 * Sending the GeoJSON object itself fails — PostgREST hands the column its
 * JSON text and PostGIS's geography input parses WKT, not GeoJSON ("parse
 * error - invalid geometry"). Unit tests of the mapping could not see that;
 * the end-to-end test against a real database did, on 20 Nov 2026. Until
 * then no field measured on a phone had ever reached the server.
 */
export function toEwkt(g: GeoJsonPolygon | GeoJsonPoint): string {
  if (g.type === 'Point') return `SRID=4326;POINT(${g.coordinates[0]} ${g.coordinates[1]})`;
  const ring = g.coordinates[0]!.map(([lng, lat]) => `${lng} ${lat}`).join(',');
  return `SRID=4326;POLYGON((${ring}))`;
}

export function geoJsonToPolygon(value: unknown): LatLng[] | null {
  if (typeof value !== 'object' || value === null) return null;
  const g = value as { type?: unknown; coordinates?: unknown };
  if (g.type !== 'Polygon' || !Array.isArray(g.coordinates)) return null;

  const ring = g.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) return null;

  const corners: LatLng[] = [];
  for (const pair of ring) {
    if (!Array.isArray(pair) || pair.length < 2) return null;
    const [lng, lat] = pair as [number, number];
    if (typeof lng !== 'number' || typeof lat !== 'number') return null;
    corners.push({ lat, lng });
  }

  // Our convention is an open list of corners; the closing point comes off.
  const first = corners[0];
  const last = corners[corners.length - 1];
  if (first !== undefined && last !== undefined && first.lat === last.lat && first.lng === last.lng) {
    corners.pop();
  }
  return corners;
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

/**
 * The local capture record stores the area *method* ('rectangle-fit',
 * 'grid-snapped'); the database stores how the boundary *arrived*. A walk
 * that was fitted to a rectangle was still a walk.
 */
const captureMethodOf = (method: string): 'drawn' | 'walked' =>
  method === 'drawn' || method === 'declared' ? 'drawn' : 'walked';

export interface WireFieldInsert {
  id?: string;
  name: string;
  /** EWKT; see toEwkt. */
  boundary: string;
  capture_method: 'drawn' | 'walked';
  gps_accuracy_m: number | null;
  /** The farmer attested to this boundary in the app, on the capture screen. */
  confirmed_by_owner: boolean;
  created_at: string;
  papers_area_sqm: number | null;
}

export interface WireFieldRow {
  id: string;
  name: string;
  boundary: unknown;
  area_sqm: number;
  capture_method: string;
  gps_accuracy_m: number | null;
  created_at: string;
  papers_area_sqm?: number | null;
}

/**
 * Note what is absent: no `area_sqm`, no `centroid`, no `owner_id`. The
 * server derives all three — area and centroid from the geometry, owner
 * from the session. A client-supplied acreage is guarantee-1 territory.
 */
export function fieldToWire(field: SavedField): WireFieldInsert | null {
  const boundary = polygonToGeoJson(field.polygon);
  if (boundary === null) return null;

  return {
    ...(isUuid(field.id) ? { id: field.id } : {}),
    name: field.name.trim().length > 0 ? field.name.trim() : 'Field',
    boundary: toEwkt(boundary),
    capture_method: captureMethodOf(field.method),
    gps_accuracy_m: field.meanAccuracyM > 0 ? Math.round(field.meanAccuracyM * 100) / 100 : null,
    confirmed_by_owner: true,
    created_at: toIso(field.capturedAt),
    papers_area_sqm: field.papersAreaSqm ?? null,
  };
}

export function fieldFromWire(row: WireFieldRow): SavedField | null {
  const polygon = geoJsonToPolygon(row.boundary);
  if (polygon === null) return null;

  return {
    id: row.id,
    name: row.name,
    polygon,
    // The database's number wins. It is derived from the stored boundary,
    // and it is what prices the job — keeping the phone's own estimate
    // alongside it would be two sources of truth for one fact.
    areaSqm: row.area_sqm,
    capturedAt: fromIso(row.created_at) ?? 0,
    method: row.capture_method,
    meanAccuracyM: row.gps_accuracy_m ?? 0,
    synced: true,
    papersAreaSqm: row.papers_area_sqm ?? null,
  };
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

const LOCAL_STATUSES: ReadonlySet<string> = new Set([
  'searching',
  'accepted',
  'en_route',
  'in_progress',
  'completed',
  'cancelled',
  // Used to be dropped here along with 'draft'. Dropping it made a lapsed
  // request vanish from the farmer's list with no explanation, which is
  // worse than the "finding a captain" it replaced.
  'expired',
]);

export interface WireJobInsert {
  id?: string;
  field_id: string;
  service_id: string;
  /** Snapshotted at booking, from the server-derived field area. */
  area_sqm: number;
  status: 'searching';
  is_immediate: boolean;
  scheduled_date: string | null;
  scheduled_window: JobWindow;
  quoted_unit: PricingUnit;
  travel_charge: number;
  notes: string;
  created_at: string;
}

export interface WireJobRow {
  id: string;
  area_disputed_at?: string | null;
  machine_id?: string | null;
  /** Embedded on the captain's pull. */
  field?: { capture_method?: string } | null;
  field_id: string;
  captain_id: string | null;
  service_id: string;
  area_sqm: number;
  status: string;
  is_immediate: boolean;
  scheduled_date: string | null;
  scheduled_window: JobWindow;
  quoted_rate: number | null;
  quoted_unit: PricingUnit | null;
  quoted_subtotal: number | null;
  travel_charge: number | null;
  quoted_total: number | null;
  final_amount: number | null;
  payment_mode: PaymentMode | null;
  notes: string | null;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface WireJobUpdate {
  status: JobStatus;
  final_amount: number | null;
  payment_mode: PaymentMode | null;
  quoted_rate: number | null;
  /** Any non-null value marks the dispute; the server stamps the real time and who. */
  area_disputed_at?: string;
}

/**
 * A job can only be pushed once its field is a server row — the database
 * will not accept a job pointing at a field it has never seen, and the
 * field's server-derived area is the area this job must snapshot. A
 * non-UUID fieldId means the field has not synced yet; null says "not yet".
 */
export function jobToWire(job: Job, serviceId: string): WireJobInsert | null {
  if (!isUuid(job.fieldId)) return null;

  return {
    ...(isUuid(job.id) ? { id: job.id } : {}),
    field_id: job.fieldId,
    service_id: serviceId,
    area_sqm: job.areaSqm,
    status: 'searching',
    is_immediate: job.isImmediate,
    scheduled_date: job.scheduledDate,
    scheduled_window: job.window,
    quoted_unit: job.quotedUnit,
    travel_charge: job.travelCharge,
    notes: job.notes,
    created_at: toIso(job.createdAt),
  };
}

export function jobEditsToWire(job: Job): WireJobUpdate {
  return {
    status: job.status,
    // started_at and completed_at are deliberately absent. The server stamps
    // them from its own clock when the status moves, and freezes them
    // otherwise — they are what a farmer and a captain argue about, so they
    // must not be one party's handset's word. Sending them anyway would be
    // sending something we know is discarded.
    final_amount: job.finalAmount,
    payment_mode: job.paymentMode,
    quoted_rate: job.quotedRate,
    ...(job.areaDisputedAt !== null && job.areaDisputedAt !== undefined
      ? { area_disputed_at: toIso(job.areaDisputedAt) }
      : {}),
  };
}

/**
 * A server job becomes a local one. Null means the local model has no
 * honest representation — 'draft' does not exist on the phone —
 * or the service is not in this build's catalogue, and a job we cannot
 * name is a job we cannot show.
 */
export function jobFromWire(
  row: WireJobRow,
  serviceCode: string | null,
  fieldName: string,
  village: string,
  captainName: string | null,
  distanceKm: number | null,
  offeredCount: number | null,
  /** Stars this user has already given on this job. */
  myRating: number | null,
): Job | null {
  if (serviceCode === null) return null;
  if (!LOCAL_STATUSES.has(row.status)) return null;

  return {
    id: row.id,
    fieldId: row.field_id,
    fieldName,
    village,
    serviceCode,
    areaSqm: row.area_sqm,
    status: row.status as JobStatus,
    isImmediate: row.is_immediate,
    scheduledDate: row.scheduled_date,
    window: row.scheduled_window,
    quotedRate: row.quoted_rate,
    quotedUnit: row.quoted_unit ?? 'per_killa',
    quotedSubtotal: row.quoted_subtotal,
    travelCharge: row.travel_charge ?? 0,
    quotedTotal: row.quoted_total,
    captainName,
    captainId: row.captain_id,
    offeredCount,
    distanceKm,
    finalAmount: row.final_amount,
    paymentMode: row.payment_mode,
    notes: row.notes ?? '',
    myRating,
    createdAt: fromIso(row.created_at) ?? 0,
    acceptedAt: fromIso(row.accepted_at),
    startedAt: fromIso(row.started_at),
    completedAt: fromIso(row.completed_at),
    areaDisputedAt: fromIso(row.area_disputed_at ?? null),
    machineId: row.machine_id ?? null,
    fieldDeclared: row.field?.capture_method === 'declared',
  };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface WireProfileUpsert {
  id: string;
  phone: string;
  full_name: string;
  role: Role;
  village: string | null;
  language: string;
  display_chain: 'killa' | 'bigha';
}

export interface WireProfileRow {
  id: string;
  phone: string;
  full_name: string;
  role: Role;
  village: string | null;
  language: string;
  display_chain: 'killa' | 'bigha';
  updated_at: string;
}

/**
 * Null when there is nothing to push: no phone means not signed in, and a
 * profile without a name cannot exist server-side (the schema requires a
 * non-blank name). Onboarding completes locally first; the row appears the
 * moment it is real.
 */
export function profileToWire(p: Profile): WireProfileUpsert | null {
  if (p.phone === null || !isUuid(p.id) || p.fullName.trim().length === 0) return null;
  return {
    id: p.id,
    phone: p.phone,
    full_name: p.fullName.trim(),
    role: p.role,
    village: p.village.trim().length > 0 ? p.village.trim() : null,
    language: p.language,
    display_chain: p.displayChain,
  };
}

export function profileFromWire(row: WireProfileRow, local: Profile | null): Profile {
  return {
    id: row.id,
    phone: row.phone,
    fullName: row.full_name,
    village: row.village ?? '',
    role: row.role,
    language: row.language === 'hi' || row.language === 'en' ? row.language : 'pa',
    displayChain: row.display_chain === 'bigha' ? 'bigha' : 'killa',
    machines: local?.machines ?? [],
    rates: local?.rates ?? [],
    serviceRadiusKm: local?.serviceRadiusKm ?? 15,
    isOnline: local?.isOnline ?? false,
    // The server does not hold where he stood; the phone does.
    baseLocation: local?.baseLocation ?? null,
    currentLocation: local?.currentLocation ?? null,
    onboardedAt: local?.onboardedAt ?? Date.now(),
    updatedAt: fromIso(row.updated_at) ?? Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Captain machinery
// ---------------------------------------------------------------------------

export interface WireMachineRow {
  /** The phone's id, kept: jobs point at a machine (4.6). */
  id: string;
  machine_type_id: string;
  ownership: 'owned' | 'arrangeable';
  lead_time_hours: number;
  with_operator_only: boolean;
  make: string | null;
}

export interface WireRateRow {
  service_id: string;
  rate: number | null;
  rate_unit: PricingUnit;
  min_area_sqm: number | null;
}

/**
 * Machine codes map through the server catalogue; a code the server does
 * not know (an app newer than the database, or vice versa) is skipped
 * rather than failing the whole push — half a registry on the server beats
 * none, and the next sync tries again.
 */
export function captainMachinesToWire(
  machines: readonly CaptainMachine[],
  machineTypeId: (code: string) => string | undefined,
): WireMachineRow[] {
  const rows: WireMachineRow[] = [];
  for (const m of machines) {
    const id = machineTypeId(m.machineCode);
    if (id === undefined) continue;
    rows.push({
      id: m.id,
      machine_type_id: id,
      ownership: m.ownership,
      lead_time_hours: Math.round(m.leadTimeHours),
      with_operator_only: m.withOperatorOnly,
      make: m.make?.trim() ?? null,
    });
  }
  return rows;
}

/**
 * Machines added by builds before 4.6 had ids like "1700000000000-combine",
 * which the server cannot keep. Give those a UUID, once; the caller saves
 * the result. Returns the same object when there is nothing to repair.
 */
export function withMachineUuids(profile: Profile): Profile {
  if (profile.machines.every((m) => isUuid(m.id))) return profile;
  return {
    ...profile,
    machines: profile.machines.map((m) => (isUuid(m.id) ? m : { ...m, id: uuid() })),
  };
}

export function captainRatesToWire(
  rates: readonly ServiceRate[],
  serviceId: (code: string) => string | undefined,
): WireRateRow[] {
  const rows: WireRateRow[] = [];
  for (const r of rates) {
    const id = serviceId(r.serviceCode);
    if (id === undefined) continue;
    rows.push({ service_id: id, rate: r.rate, rate_unit: r.unit, min_area_sqm: r.minAreaSqm ?? null });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Merging — what happens when the same thing exists in both places
// ---------------------------------------------------------------------------

/**
 * Server rows win; local-only rows survive to push next time.
 *
 * Push happens before pull on every sync pass, so by the time this runs
 * the server has already seen anything local did. Whatever comes back is
 * the truth, including the truth about a race we lost.
 */
export function mergeById<T extends { id: string }>(
  local: readonly T[],
  remote: readonly T[],
): T[] {
  const byId = new Map(local.map((item) => [item.id, item]));
  for (const item of remote) byId.set(item.id, item);
  return [...byId.values()];
}

// ---------------------------------------------------------------------------
// Who wins
//
// Both of these decide whether a farmer's local row survives a sync. They
// live here, pure and tested, because the failure mode is silent: a wrong
// answer does not throw, it quietly discards work he did in a field.
// ---------------------------------------------------------------------------

/**
 * Should the local profile overwrite the server's?
 *
 * Last-write-wins on the phone's clock. A server row with a missing or
 * unparseable timestamp loses, because the alternative is discarding edits
 * the farmer definitely made in favour of a row we cannot date.
 *
 * Equal timestamps go to the server, which stops two phones ping-ponging a
 * write at each other forever.
 *
 * ponytail: trusts the device clock. A phone set years ahead would win every
 * merge for as long as it stayed wrong. Acceptable while a profile holds a
 * name, a village and a rate card; move to a server-assigned version if it
 * ever holds anything a farmer would miss.
 */
export function localProfileIsNewer(
  localUpdatedAt: number,
  serverUpdatedAtIso: string | null | undefined,
): boolean {
  if (serverUpdatedAtIso === null || serverUpdatedAtIso === undefined) return true;
  const serverAt = Date.parse(serverUpdatedAtIso);
  if (Number.isNaN(serverAt)) return true;
  return localUpdatedAt > serverAt;
}

/**
 * Keep rows we just pushed, over the snapshot pulled before pushing them.
 *
 * The pull happens first, so its view predates this pass's writes. Without
 * this, a job the captain just accepted would flip back to searching on his
 * screen until the next sync — which looks exactly like the app losing his
 * work.
 */
export function keepJustPushed<T extends { id: string }>(
  merged: readonly T[],
  local: readonly T[],
  pushedIds: ReadonlySet<string>,
): T[] {
  const byId = new Map(local.map((item) => [item.id, item]));
  return merged.map((item) =>
    pushedIds.has(item.id) ? byId.get(item.id) ?? item : item,
  );
}

// ---------------------------------------------------------------------------
// Incremental sync
//
// A phone asks only for rows changed since the newest updated_at it has
// seen. The cursor is always a server timestamp, never the phone's clock.
// ---------------------------------------------------------------------------

/**
 * How far back to ask from. Five minutes before the cursor: updated_at is
 * stamped when a transaction starts, so one that commits late can carry a
 * time older than rows already seen. Re-reading the overlap costs a few rows
 * per pass and the merge is by id, so a row read twice is harmless.
 *
 * ponytail: five minutes is longer than any transaction here; a very slow
 * one would need xmin-based change tracking instead.
 */
export function sinceCursor(cursor: string | null): string | null {
  if (cursor === null) return null;
  const at = Date.parse(cursor.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1'));
  if (Number.isNaN(at)) return null;
  return new Date(at - 5 * 60_000).toISOString();
}

/** The newest updated_at among the rows, or the cursor if none is newer. */
export function advanceCursor(
  cursor: string | null,
  rows: ReadonlyArray<{ updated_at: string }>,
): string | null {
  let best = cursor;
  let bestAt = cursor === null ? -Infinity : Date.parse(cursor);
  for (const r of rows) {
    const at = Date.parse(r.updated_at);
    if (at > bestAt) {
      best = r.updated_at;
      bestAt = at;
    }
  }
  return best;
}

/** How far along its life a job is. Sync may only push forward, never back. */
export const STATUS_RANK: Record<JobStatus, number> = {
  searching: 0,
  accepted: 1,
  en_route: 2,
  in_progress: 3,
  completed: 4,
  cancelled: 4,
  // An ending, like the other two: the phone must never push 'searching'
  // back over a job the server has already let lapse.
  expired: 4,
};

/** What the server last said about a job, remembered between passes. */
export interface KnownJob {
  status: string;
  hasFinal: boolean;
  /** The server already holds an area dispute for it. */
  hasDispute?: boolean;
}

/**
 * Does this job need writing to the server?
 *
 * Decided against what the server last said, not against this pass's pull:
 * with incremental pulls an unchanged job is simply absent, and treating
 * "absent" as "never seen" re-inserted every job on every pass.
 */
export function needsPush(job: Job, known: KnownJob | undefined): 'insert' | 'update' | null {
  if (known === undefined) return 'insert';
  const localRank = STATUS_RANK[job.status];
  const serverRank = STATUS_RANK[known.status as JobStatus] ?? 0;
  if (localRank > serverRank) return 'update';
  if (localRank === serverRank && job.finalAmount !== null && !known.hasFinal) return 'update';
  // A dispute tapped offline goes up on the next pass, whatever the status.
  if (job.areaDisputedAt != null && known.hasDispute !== true) return 'update';
  return null;
}
