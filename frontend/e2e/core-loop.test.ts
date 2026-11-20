/**
 * The core loop, end to end, against a real database.
 *
 * Runs the app's own sync code — not a re-implementation — against the CI
 * Supabase stack: a farmer signs in, saves a field, posts a job; the founder
 * offers it to a captain (automatic dispatch is off); the captain accepts,
 * works it and completes it; the farmer sees it done. It also counts the
 * bytes each sync pass downloads, which is how incremental sync is proven
 * rather than asserted.
 *
 * Skipped unless E2E_SUPABASE_URL is set; CI sets it after `supabase start`.
 * Sign-in uses the fixture test numbers in config.toml, so no SMS is sent.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const URL_ = process.env['E2E_SUPABASE_URL'] ?? '';
const ANON = process.env['E2E_SUPABASE_ANON_KEY'] ?? '';
const SERVICE = process.env['E2E_SUPABASE_SERVICE_KEY'] ?? '';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
    getAllKeys: async () => [...store.keys()],
    multiGet: async (ks: string[]) => ks.map((k) => [k, store.get(k) ?? null]),
    multiRemove: async (ks: string[]) => ks.forEach((k) => store.delete(k)),
  },
}));
vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { supabaseUrl: URL_, supabaseAnonKey: ANON } } },
}));
vi.mock('react-native-url-polyfill/auto', () => ({}));

// Count what comes back from the two tables that grow all season. Installed
// before the client is created, because supabase-js captures fetch then.
const downloaded = { jobs: 0, fields: 0 };
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const res = await realFetch(input, init);
  const url = String(input instanceof Request ? input.url : input);
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method === 'GET') {
    const bytes = (await res.clone().text()).length;
    if (url.includes('/rest/v1/jobs')) downloaded.jobs += bytes;
    if (url.includes('/rest/v1/fields')) downloaded.fields += bytes;
  }
  return res;
};

const FARMER_PHONE = '9876500001';
const FARMER_CODE = '100001';
const CAPTAIN_PHONE = '9876500002';
const CAPTAIN_CODE = '100002';

describe.skipIf(URL_ === '')('core loop against the database', { timeout: 60_000 }, () => {
  // Loaded after the mocks and the fetch wrapper are in place.
  let app: {
    auth: typeof import('../src/auth');
    sync: typeof import('../src/sync/sync');
    mapping: typeof import('../src/sync/mapping');
    profile: typeof import('../src/profile');
  };
  let admin: import('@supabase/supabase-js').SupabaseClient;

  beforeAll(async () => {
    app = {
      auth: await import('../src/auth'),
      sync: await import('../src/sync/sync'),
      mapping: await import('../src/sync/mapping'),
      profile: await import('../src/profile'),
    };
    const { createClient } = await import('@supabase/supabase-js');
    admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  });

  // Leave the database as it was found. CI runs the guarantee tests again
  // after this, and a completed ₹4,200 job left behind moves the district's
  // rate guidance those tests check.
  let captainUid = '';
  afterAll(async () => {
    globalThis.fetch = realFetch;
    if (admin === undefined) return;
    await admin.from('jobs').delete().eq('id', jobId);
    for (const id of [farmerId, captainUid]) {
      if (id !== '') await admin.auth.admin.deleteUser(id);
    }
  });

  // Auth allows one code request per ~5 s (config.toml max_frequency).
  let lastRequest = 0;
  async function signInAs(phone: string, code: string): Promise<string> {
    await app.auth.signOut();
    const wait = lastRequest + 6000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequest = Date.now();
    const asked = await app.auth.requestCode(phone);
    if (!asked.ok) {
      // The app's outcome hides the server's words; show them on failure.
      const { supabase } = await import('../src/supabase');
      const raw = await supabase.auth.signInWithOtp({ phone: '+91' + phone });
      console.error('requestCode failed:', asked, raw.error?.status, raw.error?.message);
    }
    expect(asked).toEqual({ ok: true });
    expect(await app.auth.verifyCode(phone, code)).toEqual({ ok: true });
    const session = await app.auth.currentSession();
    return session!.user.id;
  }

  // Shared across the steps, in order.
  let farmerId = '';
  let farmer: import('../src/profile').Profile;
  let fields: import('../src/storage').SavedField[] = [];
  let farmerJobs: import('../src/jobs').Job[] = [];
  let captainJobs: import('../src/jobs').Job[] = [];
  const jobId = crypto.randomUUID();
  const fieldId = crypto.randomUUID();

  it('a farmer signs in and his profile reaches the server', async () => {
    farmerId = await signInAs(FARMER_PHONE, FARMER_CODE);
    farmer = {
      ...app.profile.emptyProfile(),
      id: farmerId,
      phone: '91' + FARMER_PHONE,
      fullName: 'Gurmeet Singh',
      village: 'Arniwala',
      role: 'farmer',
      onboardedAt: Date.now(),
    };
    const synced = await app.sync.syncProfile(farmer);
    expect(synced).not.toBeNull();
    const { data } = await admin.from('profiles').select('full_name').eq('id', farmerId).single();
    expect(data?.full_name).toBe('Gurmeet Singh');
  });

  it('saves a field, and the server decides its area', async () => {
    fields = await app.sync.syncFields([
      {
        id: fieldId,
        name: 'E2E core-loop khet',
        // About one killa near Fazilka.
        polygon: [
          { lat: 30.4028, lng: 74.0286 },
          { lat: 30.4028, lng: 74.0293012 },
          { lat: 30.4033442, lng: 74.0293012 },
          { lat: 30.4033442, lng: 74.0286 },
        ],
        areaSqm: 999_999, // the phone's number must not survive
        capturedAt: Date.now(),
        method: 'drawn',
        meanAccuracyM: 0,
        synced: false,
      },
    ]);
    if (!fields[0]!.synced) {
      // syncFields keeps a failed push for the next pass and says nothing;
      // repeat it here to get the server's reason.
      const { supabase } = await import('../src/supabase');
      const wire = app.mapping.fieldToWire(fields[0]!)!;
      const raw = await supabase.from('fields').upsert(wire).select('id');
      console.error('field push failed:', raw.error);
    }
    expect(fields[0]!.synced).toBe(true);
    expect(fields[0]!.areaSqm).toBeGreaterThan(3500);
    expect(fields[0]!.areaSqm).toBeLessThan(4600);
  });

  it('posts a job; with automatic dispatch off nobody is offered it', async () => {
    const job: import('../src/jobs').Job = {
      id: jobId,
      fieldId,
      fieldName: 'E2E core-loop khet',
      village: 'Arniwala',
      serviceCode: 'wheat_harvest',
      areaSqm: fields[0]!.areaSqm,
      status: 'searching',
      isImmediate: true,
      scheduledDate: null,
      window: 'any',
      quotedRate: null,
      quotedUnit: 'per_killa',
      quotedSubtotal: null,
      travelCharge: 0,
      quotedTotal: null,
      captainName: null,
      captainId: null,
      distanceKm: null,
      offeredCount: null,
      finalAmount: null,
      paymentMode: null,
      notes: '',
      myRating: null,
      createdAt: Date.now(),
      acceptedAt: null,
      startedAt: null,
      completedAt: null,
    };
    farmerJobs = await app.sync.syncJobs([job], farmer);
    const { data } = await admin.from('jobs').select('status').eq('id', jobId).single();
    expect(data?.status).toBe('searching');
    const { count } = await admin
      .from('job_dispatch')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', jobId);
    expect(count).toBe(0);
  });

  it('a second pass with nothing changed does not insert the job again, and downloads almost nothing', async () => {
    const before = { ...downloaded };
    farmerJobs = await app.sync.syncJobs(farmerJobs, farmer);
    const idle = downloaded.jobs - before.jobs;
    console.log(`MEASURED idle sync pass: ${idle} bytes of jobs (first pass downloaded ${before.jobs})`);
    // Only the five-minute overlap is re-read: this one job. The old full
    // pull re-sent every job he had ever posted on every pass.
    expect(idle).toBeLessThan(4000);
    const { count } = await admin
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('farmer_id', farmerId);
    expect(count).toBe(1);
  });

  it('the founder offers it to a captain by hand', async () => {
    const captainId = await signInAs(CAPTAIN_PHONE, CAPTAIN_CODE);
    captainUid = captainId;
    const captain = {
      ...app.profile.emptyProfile(),
      id: captainId,
      phone: '91' + CAPTAIN_PHONE,
      fullName: 'Jaspal Singh',
      village: 'Jalalabad',
      role: 'captain' as const,
      isOnline: true,
      baseLocation: { lat: 30.404, lng: 74.03 },
      currentLocation: { lat: 30.404, lng: 74.03 },
      onboardedAt: Date.now(),
    };
    expect(await app.sync.syncProfile(captain)).not.toBeNull();

    // What the founder does in Studio: verify him, then offer the job.
    const verified = await admin
      .from('captains')
      .update({ verification: 'verified', verified_by: farmerId, verified_at: new Date().toISOString() })
      .eq('profile_id', captainId)
      .select('profile_id');
    expect(verified.error).toBeNull();
    expect(verified.data).toHaveLength(1);
    const offered = await admin.from('job_dispatch').insert({ job_id: jobId, captain_id: captainId, rank: 1 });
    expect(offered.error).toBeNull();

    captainJobs = await app.sync.syncJobs([], captain);
    expect(captainJobs.map((j) => [j.id, j.status])).toEqual([[jobId, 'searching']]);

    // Accept, then work it through to the end, one sync per step.
    expect(await app.sync.acceptJobRemote(jobId)).toBe('accepted');
    captainJobs = await app.sync.syncJobs(captainJobs, captain);
    expect(captainJobs.find((j) => j.id === jobId)?.status).toBe('accepted');

    for (const status of ['en_route', 'in_progress', 'completed'] as const) {
      captainJobs = captainJobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status,
              ...(status === 'completed' ? { finalAmount: 4200, paymentMode: 'cash' as const } : {}),
            }
          : j,
      );
      captainJobs = await app.sync.syncJobs(captainJobs, captain);
      const { data } = await admin.from('jobs').select('status, final_amount').eq('id', jobId).single();
      expect(data?.status).toBe(status);
    }
    const { data } = await admin.from('jobs').select('final_amount, captain_id').eq('id', jobId).single();
    expect(Number(data?.final_amount)).toBe(4200);
    expect(data?.captain_id).toBe(captainId);
  });

  it('the farmer sees it done, with his captain named', async () => {
    await signInAs(FARMER_PHONE, FARMER_CODE);
    farmerJobs = await app.sync.syncJobs(farmerJobs, farmer);
    const done = farmerJobs.find((j) => j.id === jobId);
    expect(done?.status).toBe('completed');
    expect(done?.captainName).toBe('Jaspal Singh');
    expect(done?.finalAmount).toBe(4200);
  });

  it('a phone that lost its local copy gets everything back, cursors notwithstanding', async () => {
    const restored = await app.sync.syncJobs([], farmer);
    expect(restored.map((j) => j.id)).toContain(jobId);
    const refields = await app.sync.syncFields([]);
    expect(refields.map((f) => f.id)).toContain(fieldId);
  });
});
