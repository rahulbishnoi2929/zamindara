import { isBackendConfigured, supabase } from '../supabase';
import { currentSession } from '../auth';
import type { Job, JobStatus } from '../jobs';
import { isCaptain, type Profile } from '../profile';
import { saveField, type SavedField } from '../storage';
import {
  captainMachinesToWire,
  captainRatesToWire,
  fieldFromWire,
  fieldToWire,
  isUuid,
  jobEditsToWire,
  jobFromWire,
  jobToWire,
  mergeById,
  pointToGeoJson,
  profileFromWire,
  profileToWire,
} from './mapping';

/**
 * Sync: the same data, in two places, with the field between them unreliable.
 *
 * The division of trust that makes this simple enough to be safe:
 *
 *   - The phone is authoritative for anything it created and the server has
 *     not seen (a walk finished thirty seconds ago, a job posted in a yard
 *     with one bar of signal). Those push, and nothing pushes back.
 *   - The server is authoritative for anything shared (who won a job, what
 *     a field measures). Those pull, and on conflict the server wins —
 *     including when the server is telling us we lost a race.
 *   - A job status only ever pushes when it ADVANCES past what the server
 *     has. Without that guard, a farmer reopening his phone an hour after
 *     the captain finished would push his stale "accepted" back over the
 *     recorded "completed", and the record of what happened would be
 *     destroyed by a refresh.
 *
 * Nothing here throws. Every failure leaves the local state untouched and
 * the unsynced flag exactly where it was, which is what the next pass
 * (next app activation) retries from.
 */

// ---------------------------------------------------------------------------
// The server catalogue: machine and service codes to server ids
// ---------------------------------------------------------------------------

export interface CatalogMaps {
  machineTypeId: (code: string) => string | undefined;
  serviceId: (code: string) => string | undefined;
  serviceCode: (id: string) => string | null;
}

let catalogCache: CatalogMaps | null = null;

/**
 * Codes are the app's vocabulary; ids are the database's. The seed is
 * generated from the same catalogue the app bundles, so the two agree —
 * this fetch is how the phone learns today's mapping from the live
 * database rather than assuming it.
 */
export async function loadCatalog(): Promise<CatalogMaps | null> {
  if (catalogCache !== null) return catalogCache;
  if (!isBackendConfigured()) return null;

  const [machines, services] = await Promise.all([
    supabase.from('machine_types').select('id, code'),
    supabase.from('services').select('id, code'),
  ]);
  if (machines.error !== null || services.error !== null) return null;

  const machineById = new Map<string, string>();
  for (const row of machines.data as Array<{ id: string; code: string }>) {
    machineById.set(row.code, row.id);
  }
  const serviceByCode = new Map<string, string>();
  const serviceById = new Map<string, string>();
  for (const row of services.data as Array<{ id: string; code: string }>) {
    serviceByCode.set(row.code, row.id);
    serviceById.set(row.id, row.code);
  }

  catalogCache = {
    machineTypeId: (code) => machineById.get(code),
    serviceId: (code) => serviceByCode.get(code),
    serviceCode: (id) => serviceById.get(id) ?? null,
  };
  return catalogCache;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/**
 * Make the server's profile row and the local one agree.
 *
 * Returns the local profile, replaced by the server's when the server was
 * newer (a second phone, a reinstall), or null when there was nothing to
 * do — not signed in, never onboarded, or the push was refused.
 *
 * The captain half (base location, availability, machines, rates) only
 * exists once the phone knows where he stands: `base_location` is NOT NULL
 * in the database and cannot be invented. Until GPS has produced a point,
 * a captain syncs his profile row and nothing else — visible to nobody,
 * dispatched nothing, which is the honest state for a captain the phone
 * cannot yet place.
 */
export async function syncProfile(profile: Profile): Promise<Profile | null> {
  if (!isBackendConfigured()) return null;
  const session = await currentSession();
  if (session === null) return null;

  const wire = profileToWire(profile);
  if (wire === null) return null;
  const uid = session.user.id;

  const existing = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();

  let merged: Profile | null = null;

  if (existing.error !== null) return null;

  if (existing.data === null) {
    const inserted = await supabase.from('profiles').insert(wire).select('*').single();
    if (inserted.error !== null) return null;
    merged = profileFromWire(inserted.data as never, profile);
  } else {
    const serverRow = existing.data as { updated_at: string };
    const serverAt = Date.parse(serverRow.updated_at);
    if (Number.isNaN(serverAt) || profile.updatedAt > serverAt) {
      const pushed = await supabase.from('profiles').update(wire).eq('id', uid);
      if (pushed.error !== null) return null;
      merged = profile;
    } else {
      merged = profileFromWire(existing.data as never, profile);
    }
  }

  if (isCaptain(profile) && profile.baseLocation !== null) {
    const ok = await pushCaptainSide(profile, uid);
    if (!ok) return merged;
  }

  return merged;
}

async function pushCaptainSide(profile: Profile, uid: string): Promise<boolean> {
  if (profile.baseLocation === null) return false;
  const base = pointToGeoJson(profile.baseLocation);
  const current =
    profile.currentLocation === null ? null : pointToGeoJson(profile.currentLocation);

  // Upsert, not update: the captains row is born the first time a located
  // captain syncs. Verification is deliberately absent from this write —
  // the policy on that column is what stops a captain approving himself.
  const captains = await supabase.from('captains').upsert(
    {
      profile_id: uid,
      base_location: base,
      current_location: current,
      is_online: profile.isOnline,
      service_radius_km: profile.serviceRadiusKm,
    },
    { onConflict: 'profile_id' },
  );
  if (captains.error !== null) return false;

  // Machines have no natural key the client can address, so the push is a
  // replace: delete his rows, insert the current registry. Rates have a
  // real key and upsert cleanly; any service no longer offered is removed.
  //
  // A replace-set whose inputs are incomplete would delete real data: if
  // even one code has no server id (an app and a database out of step),
  // the whole replace is abandoned rather than silently drop the row the
  // map could not name. The next pass tries again.
  const maps = await loadCatalog();
  if (maps === null) return false;

  const allMachinesMapped = profile.machines.every(
    (m) => maps.machineTypeId(m.machineCode) !== undefined,
  );
  if (allMachinesMapped) {
    await supabase.from('captain_machines').delete().eq('captain_id', uid);
    const machines = captainMachinesToWire(profile.machines, maps.machineTypeId);
    if (machines.length > 0) {
      const inserted = await supabase
        .from('captain_machines')
        .insert(machines.map((m) => ({ ...m, captain_id: uid })));
      if (inserted.error !== null) return false;
    }
  }

  const allRatesMapped = profile.rates.every(
    (r) => maps.serviceId(r.serviceCode) !== undefined,
  );
  if (allRatesMapped) {
    const rates = captainRatesToWire(profile.rates, maps.serviceId);
    if (rates.length === 0) {
      // He cleared his rates; an empty replace must still delete.
      await supabase.from('captain_services').delete().eq('captain_id', uid);
    } else {
      const upserted = await supabase
        .from('captain_services')
        .upsert(rates.map((r) => ({ ...r, captain_id: uid })), {
          onConflict: 'captain_id,service_id',
        });
      if (upserted.error !== null) return false;
      const keep = rates.map((r) => r.service_id);
      await supabase
        .from('captain_services')
        .delete()
        .eq('captain_id', uid)
        .not('service_id', 'in', `(${keep.join(',')})`);
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

/**
 * Push every unsynced field, then pull the server's list.
 *
 * The insert is an upsert keyed on the client-minted id, so a push that
 * succeeded but was interrupted before the local flag flipped replays
 * harmlessly instead of duplicating the field.
 */
export async function syncFields(fields: SavedField[]): Promise<SavedField[]> {
  if (!isBackendConfigured()) return fields;
  const session = await currentSession();
  if (session === null) return fields;

  let next = fields;

  for (const f of fields.filter((x) => !x.synced)) {
    const wire = fieldToWire(f);
    if (wire === null) continue;

    const pushed = await supabase
      .from('fields')
      .upsert(wire, isUuid(f.id) ? { onConflict: 'id' } : undefined)
      .select('id, area_sqm')
      .single();

    if (pushed.error !== null) break; // keep the rest for the next pass

    const row = pushed.data as { id: string; area_sqm: number };
    const synced: SavedField = {
      ...f,
      id: row.id,
      // The server's area replaces the phone's estimate: it is derived
      // from the stored boundary and it is what will price every job.
      areaSqm: row.area_sqm,
      synced: true,
    };
    await saveField(synced);
    next = next.map((x) => (x.id === f.id ? synced : x));
  }

  const pulled = await supabase
    .from('fields')
    .select('id, name, boundary, area_sqm, capture_method, gps_accuracy_m, created_at')
    .eq('owner_id', session.user.id);
  if (pulled.error !== null) return next;

  const remote: SavedField[] = [];
  for (const row of pulled.data as never[]) {
    const parsed = fieldFromWire(row);
    if (parsed !== null) remote.push(parsed);
  }
  return mergeById(next, remote);
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/** How far along its life a job is. Sync may only push forward, never back. */
const STATUS_RANK: Record<JobStatus, number> = {
  searching: 0,
  accepted: 1,
  en_route: 2,
  in_progress: 3,
  completed: 4,
  cancelled: 4,
};

interface PulledJob {
  row: {
    id: string;
    field_id: string;
    service_id: string;
    area_sqm: number;
    status: string;
    is_immediate: boolean;
    scheduled_date: string | null;
    scheduled_window: 'morning' | 'afternoon' | 'evening' | 'any';
    quoted_rate: number | null;
    quoted_unit: 'per_killa' | 'per_hour' | 'per_day' | 'per_job';
    quoted_subtotal: number | null;
    travel_charge: number | null;
    quoted_total: number | null;
    final_amount: number | null;
    payment_mode: 'cash' | 'upi' | 'pending' | null;
    notes: string | null;
    created_at: string;
    accepted_at: string | null;
    started_at: string | null;
    completed_at: string | null;
  };
  fieldName: string;
  village: string;
  captainName: string | null;
  distanceKm: number | null;
}

/**
 * What this account can see of the marketplace, from the server's point of
 * view: his own jobs as a farmer, his assigned and offered jobs as a
 * captain. The embeds are what RLS is quietly grading — a field name
 * arrives only when the relationship exists.
 */
async function pullJobs(
  uid: string,
  myName: string,
  myVillage: string,
  captainSide: boolean,
): Promise<PulledJob[]> {
  const out: PulledJob[] = [];

  const farmerView = await supabase
    .from('jobs')
    .select(
      '*, field:fields(name), captain:profiles!jobs_captain_id_fkey(full_name)',
    )
    .eq('farmer_id', uid);
  if (farmerView.error === null) {
    for (const raw of farmerView.data as never[]) {
      const r = raw as {
        field?: { name?: string };
        captain?: { full_name?: string } | null;
      };
      out.push({
        row: raw as PulledJob['row'],
        fieldName: (r.field?.name as string | undefined) ?? '',
        village: myVillage,
        captainName: (r.captain?.full_name as string | undefined) ?? null,
        distanceKm: null,
      });
    }
  }

  if (captainSide) {
    const assigned = await supabase
      .from('jobs')
      .select('*, field:fields(name), farmer:profiles!jobs_farmer_id_fkey(full_name, village)')
      .eq('captain_id', uid)
      .in('status', ['accepted', 'en_route', 'in_progress', 'completed']);
    if (assigned.error === null) {
      for (const raw of assigned.data as never[]) {
        const r = raw as { field?: { name?: string }; farmer?: { village?: string } | null };
        out.push({
          row: raw as PulledJob['row'],
          fieldName: (r.field?.name as string | undefined) ?? '',
          village: (r.farmer?.village as string | undefined) ?? '',
          captainName: myName,
          distanceKm: null,
        });
      }
    }

    // Offers: pending dispatch rows. A stale pending offer on a job someone
    // else already took is filtered by the status, not left to confuse him.
    const offers = await supabase
      .from('job_dispatch')
      .select(
        'distance_km, job:jobs!inner(*, field:fields(name), farmer:profiles!jobs_farmer_id_fkey(full_name, village))',
      )
      .eq('captain_id', uid)
      .eq('response', 'pending')
      .eq('job.status', 'searching');
    if (offers.error === null) {
      for (const raw of offers.data as never[]) {
        const d = raw as {
          distance_km: number | null;
          job?: {
            field?: { name?: string };
            farmer?: { village?: string } | null;
          } & PulledJob['row'];
        };
        if (d.job === undefined) continue;
        out.push({
          row: d.job,
          fieldName: (d.job.field?.name as string | undefined) ?? '',
          village: (d.job.farmer?.village as string | undefined) ?? '',
          captainName: null,
          distanceKm: d.distance_km,
        });
      }
    }
  }

  return out;
}

/**
 * One full pass over jobs.
 *
 * Pull first, then push only what advanced, then merge — the merge takes
 * the server's word for everything except the rows we just pushed, where
 * our own write is the newest thing the server has.
 */
export async function syncJobs(
  jobs: Job[],
  profile: Profile,
): Promise<Job[]> {
  if (!isBackendConfigured()) return jobs;
  const session = await currentSession();
  if (session === null) return jobs;
  const uid = session.user.id;
  const maps = await loadCatalog();
  if (maps === null) return jobs;

  const pulled = await pullJobs(uid, profile.fullName, profile.village, isCaptain(profile));
  const serverById = new Map(pulled.map((p) => [p.row.id, p]));

  const pushed = new Set<string>();

  for (const job of jobs) {
    if (!isUuid(job.id)) continue;
    const server = serverById.get(job.id);

    if (server === undefined) {
      // The server has never seen it — an offline post. Insert it and put
      // it on offer. (Its field must already be a server row; jobToWire
      // refuses otherwise and it waits for the next pass.)
      const serviceId = maps.serviceId(job.serviceCode);
      const wire = serviceId === undefined ? null : jobToWire(job, serviceId);
      if (wire === null) continue;
      const inserted = await supabase.from('jobs').insert(wire);
      if (inserted.error === null) {
        await supabase.rpc('dispatch_job', { p_job_id: job.id });
        pushed.add(job.id);
      }
      continue;
    }

    const localRank = STATUS_RANK[job.status];
    const serverRank = STATUS_RANK[server.row.status as JobStatus] ?? 0;
    const amountsMissing =
      job.finalAmount !== null && server.row.final_amount === null;

    if (localRank > serverRank || (localRank === serverRank && amountsMissing)) {
      const updated = await supabase
        .from('jobs')
        .update(jobEditsToWire(job))
        .eq('id', job.id);
      if (updated.error === null) pushed.add(job.id);
    }
  }

  const remote: Job[] = [];
  for (const p of pulled) {
    const local = jobFromWire(
      p.row,
      maps.serviceCode(p.row.service_id),
      p.fieldName,
      p.village,
      p.captainName,
      p.distanceKm,
    );
    if (local !== null) remote.push(local);
  }

  let merged = mergeById(jobs, remote);
  // What we just pushed is newer than the snapshot we pulled before
  // pushing; keep it until the next pass confirms it.
  merged = merged.map((j) => (pushed.has(j.id) ? jobs.find((l) => l.id === j.id) ?? j : j));
  return merged;
}

// ---------------------------------------------------------------------------
// Accepting — the one action that cannot wait for the next pass
// ---------------------------------------------------------------------------

export type AcceptOutcome = 'accepted' | 'lost-race' | 'failed';

/**
 * Call the database's accept_job, where the race between two captains is
 * actually settled. 'lost-race' is not an error he caused; it means he was
 * offered the job, answered in seconds, and someone answered first.
 */
export async function acceptJobRemote(jobId: string): Promise<AcceptOutcome> {
  if (!isBackendConfigured() || !isUuid(jobId)) return 'failed';

  const { error } = await supabase.rpc('accept_job', { p_job_id: jobId });
  if (error === null) return 'accepted';
  if (error.code === '55006') return 'lost-race';
  return 'failed';
}
