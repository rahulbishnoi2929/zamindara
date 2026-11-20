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
    jobs: typeof import('../src/jobs');
  };
  let admin: import('@supabase/supabase-js').SupabaseClient;

  beforeAll(async () => {
    app = {
      auth: await import('../src/auth'),
      sync: await import('../src/sync/sync'),
      mapping: await import('../src/sync/mapping'),
      profile: await import('../src/profile'),
      jobs: await import('../src/jobs'),
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
    await admin.from('ratings').delete().in('job_id', [jobId, job2]);
    await admin.from('jobs').delete().in('id', [jobId, job2, phonedJob, job3, ...twoCombineJobs, captainBooked, laterJob, roundsJob].filter(Boolean));
    await admin.from('app_config').update({ auto_dispatch: false }).eq('id', true);
    await admin.from('admins').delete().eq('phone', FARMER_PHONE);
    await admin.from('profiles').delete().eq('phone', '919876500005');
    for (const id of [farmerId, captainUid, phonedUid]) {
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
        accessNotes: 'Gate on the canal side',
      },
    ]);
    expect(fields[0]!.accessNotes).toBe('Gate on the canal side');
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

  let captain: import('../src/profile').Profile;

  it('a captain onboards: his machine and his rate reach the server', async () => {
    const captainId = await signInAs(CAPTAIN_PHONE, CAPTAIN_CODE);
    captainUid = captainId;
    captain = {
      ...app.profile.emptyProfile(),
      id: captainId,
      phone: '91' + CAPTAIN_PHONE,
      fullName: 'Jaspal Singh',
      village: 'Jalalabad',
      role: 'captain',
      isOnline: true,
      baseLocation: { lat: 30.404, lng: 74.03 },
      currentLocation: { lat: 30.404, lng: 74.03 },
      machines: [
        {
          id: crypto.randomUUID(),
          machineCode: 'combine',
          ownership: 'owned',
          leadTimeHours: 0,
          withOperatorOnly: true,
        },
      ],
      rates: [{ serviceCode: 'wheat_harvest', rate: 3500, unit: 'per_killa' }],
      onboardedAt: Date.now(),
    };
    expect(await app.sync.syncProfile(captain)).not.toBeNull();

    const machines = await admin.from('captain_machines').select('*').eq('captain_id', captainId);
    expect(machines.error).toBeNull();
    expect(machines.data).toHaveLength(1);
    const services = await admin.from('captain_services').select('*').eq('captain_id', captainId);
    expect(services.error).toBeNull();
    expect(services.data!.length).toBeGreaterThan(0);

    // He is not staff, and the verify queue says nothing to him.
    expect(await app.sync.amIAdmin()).toBe(false);
    expect(await app.sync.fetchPendingCaptains()).toEqual([]);
    // Registering this phone for pings.
    expect(await app.sync.savePushToken('ExponentPushToken[e2e-test-token]')).toBe(true);
  });

  it('the founder verifies him through the app, and reads the switches', async () => {
    // SETUP step 5, as written there: ten digits.
    const staff = await admin.from('admins').insert({ phone: FARMER_PHONE, note: 'e2e founder' });
    expect(staff.error).toBeNull();
    await signInAs(FARMER_PHONE, FARMER_CODE);
    expect(await app.sync.amIAdmin()).toBe(true);

    const pending = await app.sync.fetchPendingCaptains();
    expect(pending.map((p) => p.captainId)).toContain(captainUid);
    expect(await app.sync.setCaptainVerification(captainUid, 'verified')).toBe(true);
    const { data } = await admin.from('captains').select('verification').eq('profile_id', captainUid).single();
    expect(data?.verification).toBe('verified');

    const config = await app.sync.fetchAppConfig('pa');
    expect(config).not.toBeNull();
    expect(config!.founderCodeSignin).toBe(true);
    expect(config!.loudPing).toBe(false);

    // Automatic dispatch is off: the founder offers the job by hand.
    const offered = await admin.from('job_dispatch').insert({ job_id: jobId, captain_id: captainUid, rank: 1 });
    expect(offered.error).toBeNull();
  });

  it('the captain sees the offer, accepts, works it and completes it', async () => {
    await signInAs(CAPTAIN_PHONE, CAPTAIN_CODE);
    captainJobs = await app.sync.syncJobs([], captain);
    expect(captainJobs.map((j) => [j.id, j.status])).toEqual([[jobId, 'searching']]);

    // The farmer's directions reach him before he decides.
    expect(captainJobs[0]!.accessNotes).toBe('Gate on the canal side');

    expect(await app.sync.acceptJobRemote(jobId)).toBe('accepted');
    captainJobs = await app.sync.syncJobs(captainJobs, captain);
    expect(captainJobs.find((j) => j.id === jobId)?.status).toBe('accepted');
    // Batch A: once it is his, he can ring the farmer.
    expect(captainJobs.find((j) => j.id === jobId)?.contactPhone).toBe('91' + FARMER_PHONE);

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
      const { data } = await admin.from('jobs').select('status').eq('id', jobId).single();
      expect(data?.status).toBe(status);
    }
    const { data } = await admin.from('jobs').select('final_amount, captain_id').eq('id', jobId).single();
    expect(Number(data?.final_amount)).toBe(4200);
    expect(data?.captain_id).toBe(captainUid);

    // He rates the farmer.
    expect(await app.sync.pushRating(jobId, farmerId, 5)).toBe(true);
  });

  it('the farmer sees it done, with his captain named, and rates him', async () => {
    await signInAs(FARMER_PHONE, FARMER_CODE);
    farmerJobs = await app.sync.syncJobs(farmerJobs, farmer);
    const done = farmerJobs.find((j) => j.id === jobId);
    expect(done?.status).toBe('completed');
    expect(done?.captainName).toBe('Jaspal Singh');
    // Done: numbers are for live jobs only (0040), so his captain's is gone.
    expect(done?.contactPhone ?? null).toBeNull();
    expect(done?.finalAmount).toBe(4200);

    expect(await app.sync.pushRating(jobId, captainUid, 4)).toBe(true);
    // Rated twice (a retry) is still a success, not a second vote.
    expect(await app.sync.pushRating(jobId, captainUid, 4)).toBe(true);
    const { count } = await admin.from('ratings').select('*', { count: 'exact', head: true }).eq('job_id', jobId);
    expect(count).toBe(2);

    // Rate guidance: the RPC answers (it may decline to guess from one job).
    const { supabase } = await import('../src/supabase');
    const maps = await app.sync.loadCatalog();
    const g = await supabase.rpc('rate_guidance', {
      p_service_id: maps!.serviceId('wheat_harvest'),
      p_lat: 30.4028,
      p_lng: 74.0286,
    });
    expect(g.error).toBeNull();
  });

  it('4.4: the farmer says the area is wrong, and records his papers', async () => {
    // Still signed in as the farmer. The tap is saved locally, then synced.
    farmerJobs = farmerJobs.map((j) => (j.id === jobId ? { ...j, areaDisputedAt: Date.now() } : j));
    farmerJobs = await app.sync.syncJobs(farmerJobs, farmer);
    const { data } = await admin.from('jobs').select('area_disputed_at, area_disputed_by').eq('id', jobId).single();
    expect(data?.area_disputed_at).not.toBeNull();
    expect(data?.area_disputed_by).toBe(farmerId);
    // A second pass does not send it again: the server already holds it.
    const before = await admin.from('jobs').select('area_disputed_at').eq('id', jobId).single();
    farmerJobs = await app.sync.syncJobs(farmerJobs, farmer);
    const after = await admin.from('jobs').select('area_disputed_at').eq('id', jobId).single();
    expect(after.data?.area_disputed_at).toBe(before.data?.area_disputed_at);

    fields = await app.sync.syncFields(fields.map((f) => ({ ...f, papersAreaSqm: 5000, synced: false })));
    const papers = await admin.from('fields').select('papers_area_sqm, area_sqm').eq('id', fieldId).single();
    expect(papers.data?.papers_area_sqm).toBe(5000);
    expect(Math.abs((papers.data?.area_sqm ?? 0) - 5000)).toBeGreaterThan(500);
  });

  const job2 = crypto.randomUUID();

  it('a combine breaks: the captain hands a job back, the farmer withdraws it', async () => {
    farmerJobs = await app.sync.syncJobs(
      [...farmerJobs, { ...farmerJobs.find((j) => j.id === jobId)!, id: job2, status: 'searching',
        captainId: null, captainName: null, finalAmount: null, paymentMode: null, myRating: null,
        acceptedAt: null, startedAt: null, completedAt: null }],
      farmer,
    );
    expect((await admin.from('jobs').select('status').eq('id', job2).single()).data?.status).toBe('searching');
    expect((await admin.from('job_dispatch').insert({ job_id: job2, captain_id: captainUid, rank: 1 })).error).toBeNull();

    await signInAs(CAPTAIN_PHONE, CAPTAIN_CODE);
    captainJobs = await app.sync.syncJobs(captainJobs, captain);
    expect(await app.sync.acceptJobRemote(job2)).toBe('accepted');
    expect(await app.sync.releaseJobRemote(job2)).toBe('done');
    expect((await admin.from('jobs').select('status, captain_id').eq('id', job2).single()).data).toEqual({
      status: 'searching',
      captain_id: null,
    });

    await signInAs(FARMER_PHONE, FARMER_CODE);
    expect(await app.sync.cancelJobRemote(job2)).toBe('done');
    expect((await admin.from('jobs').select('status').eq('id', job2).single()).data?.status).toBe('cancelled');
    farmerJobs = await app.sync.syncJobs(farmerJobs, farmer);
    expect(farmerJobs.find((j) => j.id === job2)?.status).toBe('cancelled');
  });

  const PHONED_PHONE = '9876500003';
  const PHONED_CODE = '100003';
  let phonedJob = '';
  let phonedUid = '';

  it('4.2: the founder books, assigns and completes a job for a farmer who only phoned', async () => {
    // Signed in as the founder from the previous step.
    const farmerId = await app.sync.founderCreateFarmer(PHONED_PHONE, 'Baldev Singh', 'Ladhuka');
    expect(farmerId).not.toBeNull();
    phonedJob = (await app.sync.founderCreateJob({
      farmerId: farmerId!,
      serviceCode: 'wheat_harvest',
      areaSqm: 2 * 4046.8564224,
      at: { lat: 30.41, lng: 74.02 },
      isImmediate: true,
      scheduledDate: null,
      window: 'any',
    }))!;
    expect(phonedJob).toBeTruthy();

    const listed = await app.sync.fetchFounderJobs();
    const mine = listed!.find((j) => j.id === phonedJob);
    expect(mine).toMatchObject({ status: 'searching', farmerName: 'Baldev Singh', village: 'Ladhuka' });

    const captains = await app.sync.fetchFounderCaptains(phonedJob);
    expect(captains.map((c) => c.captainId)).toContain(captainUid);
    expect(await app.sync.founderAssign(phonedJob, captainUid)).toBe(true);
    for (const step of ['en_route', 'in_progress'] as const) {
      expect(await app.sync.founderAdvance(phonedJob, step)).toBe(true);
    }
    expect(await app.sync.founderAdvance(phonedJob, 'completed', 8400)).toBe(true);
    const { data } = await admin.from('jobs').select('status, final_amount, captain_id').eq('id', phonedJob).single();
    expect(data).toMatchObject({ status: 'completed', captain_id: captainUid });
    expect(Number(data?.final_amount)).toBe(8400);
  });

  it('4.1: when that farmer installs the app and signs in, his job is already his', async () => {
    phonedUid = await signInAs(PHONED_PHONE, PHONED_CODE);
    const him = {
      ...app.profile.emptyProfile(),
      id: phonedUid,
      phone: '91' + PHONED_PHONE,
      fullName: 'Baldev Singh',
      village: 'Ladhuka',
      onboardedAt: Date.now(),
    };
    expect(await app.sync.syncProfile(him)).not.toBeNull();
    const { data: profile } = await admin.from('profiles').select('placeholder').eq('id', phonedUid).single();
    expect(profile?.placeholder).toBe(false);

    const jobs = await app.sync.syncJobs([], him);
    expect(jobs.find((j) => j.id === phonedJob)).toMatchObject({ status: 'completed', finalAmount: 8400 });
    const fields = await app.sync.syncFields([]);
    expect(fields).toHaveLength(1);
  });

  let job3 = '';

  it('4.5: a captain who takes two killa and up; the farmer is told why nobody came', async () => {
    await signInAs(CAPTAIN_PHONE, CAPTAIN_CODE);
    captain = {
      ...captain,
      rates: [{ serviceCode: 'wheat_harvest', rate: 3500, unit: 'per_killa', minAreaSqm: 2 * 4046.8564224 }],
      updatedAt: Date.now(),
    };
    expect(await app.sync.syncProfile(captain)).not.toBeNull();
    const svc = await admin.from('captain_services').select('min_area_sqm').eq('captain_id', captainUid).single();
    expect(Math.round(Number(svc.data?.min_area_sqm))).toBe(8094);

    await signInAs(FARMER_PHONE, FARMER_CODE);
    job3 = crypto.randomUUID();
    const base = farmerJobs.find((j) => j.id === jobId)!;
    farmerJobs = await app.sync.syncJobs(
      [...farmerJobs, { ...base, id: job3, status: 'searching', captainId: null, captainName: null,
        finalAmount: null, paymentMode: null, myRating: null, areaDisputedAt: null,
        acceptedAt: null, startedAt: null, completedAt: null }],
      farmer,
    );
    // Sync pulls before it pushes, so the job comes back with its note on
    // the next pass — the next time he opens the app.
    farmerJobs = await app.sync.syncJobs(farmerJobs, farmer);
    // The field is about one killa: smaller than he takes.
    const note = farmerJobs.find((j) => j.id === job3)?.sizeFloorSqm;
    expect(Math.round(note ?? 0)).toBe(8094);
  });

  const twoCombineJobs: string[] = [];

  it('4.6: a captain buys a second combine; two jobs run on the two machines', async () => {
    await signInAs(CAPTAIN_PHONE, CAPTAIN_CODE);
    const first = captain.machines[0]!;
    captain = {
      ...captain,
      machines: [...captain.machines, { ...first, id: app.mapping.uuid() }],
      updatedAt: Date.now(),
    };
    expect(await app.sync.syncProfile(captain)).not.toBeNull();
    const machines = await admin.from('captain_machines').select('id').eq('captain_id', captainUid);
    // The phone's ids are the server's: the first combine kept its id.
    expect(machines.data!.map((m) => m.id).sort()).toEqual(captain.machines.map((m) => m.id).sort());

    // The founder books two jobs and gives both to him.
    await signInAs(FARMER_PHONE, FARMER_CODE);
    for (const lat of [30.42, 30.43]) {
      const id = await app.sync.founderCreateJob({
        farmerId,
        serviceCode: 'wheat_harvest',
        areaSqm: 3 * 4046.8564224,
        at: { lat, lng: 74.02 },
        isImmediate: true,
        scheduledDate: null,
        window: 'any',
      });
      expect(id).toBeTruthy();
      twoCombineJobs.push(id!);
      expect(await app.sync.founderAssign(id!, captainUid)).toBe(true);
    }

    await signInAs(CAPTAIN_PHONE, CAPTAIN_CODE);
    captainJobs = await app.sync.syncJobs(captainJobs, captain);
    const onMachines = twoCombineJobs.map((id) => captainJobs.find((j) => j.id === id)?.machineId);
    // One on each combine, not both on the first.
    expect(new Set(onMachines)).toEqual(new Set(captain.machines.map((m) => m.id)));

    // A later profile push does not unhook them: ids are stable now.
    captain = { ...captain, updatedAt: Date.now() };
    expect(await app.sync.syncProfile(captain)).not.toBeNull();
    const { data } = await admin.from('jobs').select('machine_id').in('id', twoCombineJobs);
    expect(data!.every((j) => j.machine_id !== null)).toBe(true);
  });

  let captainBooked = '';

  it('4.3: a captain logs a phone booking, then measures the real field', async () => {
    await signInAs(CAPTAIN_PHONE, CAPTAIN_CODE);
    captainBooked = (await app.sync.captainCreateJob({
      phone: '98765 00005',
      name: 'Sukhdev Singh',
      village: 'Arniwala',
      serviceCode: 'wheat_harvest',
      areaSqm: 3 * 4046.8564224,
      at: { lat: 30.44, lng: 74.02 },
      isImmediate: true,
      scheduledDate: null,
      window: 'any',
    }))!;
    expect(captainBooked).toBeTruthy();
    // The farmer has no app: the ping finds nobody, and nothing breaks.
    await app.sync.notifyFarmerBooked(captainBooked);

    captainJobs = await app.sync.syncJobs(captainJobs, captain);
    const logged = captainJobs.find((j) => j.id === captainBooked);
    expect(logged).toMatchObject({ status: 'accepted', fieldDeclared: true });
    // A square drawn in degrees, measured on the ellipsoid: within half a percent.
    expect(Math.abs(logged!.areaSqm - 3 * 4046.86)).toBeLessThan(60);

    // On arrival he walks it: one killa, not the three he was told.
    const side = Math.sqrt(4046.8564224);
    const dLat = side / 111320;
    const dLng = side / (111320 * Math.cos((30.44 * Math.PI) / 180));
    const polygon = [
      { lat: 30.44, lng: 74.02 },
      { lat: 30.44, lng: 74.02 + dLng },
      { lat: 30.44 + dLat, lng: 74.02 + dLng },
      { lat: 30.44 + dLat, lng: 74.02 },
    ];
    expect(await app.sync.captainRetraceField(captainBooked, polygon, 'walked')).toBe(true);
    captainJobs = await app.sync.syncJobs(captainJobs, captain);
    const measured = captainJobs.find((j) => j.id === captainBooked)!;
    expect(measured.fieldDeclared).toBe(false);
    expect(Math.abs(measured.areaSqm - 4046.86)).toBeLessThan(60);
    expect(measured.quotedTotal!).toBeLessThan(logged!.quotedTotal!);
  });

  it('4.7: a captain going to Sirsa next week is not offered Fazilka work that week', async () => {
    // Signed in as the captain from the previous step.
    const todayIst = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    captain = {
      ...captain,
      // Any size again (4.5 left him at two killa and up); this step is about where, not how big.
      rates: [{ serviceCode: 'wheat_harvest', rate: 3500, unit: 'per_killa', minAreaSqm: null }],
      routeStops: [{
        id: app.mapping.uuid(),
        place: 'Sirsa',
        lat: 29.534,
        lng: 75.029,
        fromDate: app.profile.addDays(todayIst, 5),
        toDate: app.profile.addDays(todayIst, 12),
      }],
      updatedAt: Date.now(),
    };
    expect(await app.sync.syncProfile(captain)).not.toBeNull();
    const stops = await admin.from('captain_route_stops').select('place, from_date').eq('captain_id', captainUid);
    expect(stops.data).toEqual([{ place: 'Sirsa', from_date: captain.routeStops[0]!.fromDate }]);

    const svc = await admin.from('services').select('id').eq('code', 'wheat_harvest').single();
    const who = async (startsAt: Date) => {
      const { data, error } = await admin.rpc('eligible_captains', {
        p_field_id: fieldId,
        p_service_id: svc.data!.id,
        p_starts_at: startsAt.toISOString(),
      });
      expect(error).toBeNull();
      return (data as Array<{ captain_id: string }>).map((r) => r.captain_id);
    };
    expect(await who(new Date())).toContain(captainUid);
    expect(await who(new Date(Date.now() + 7 * 86400_000))).not.toContain(captainUid);
  });

  let laterJob = '';
  let roundsJob = '';

  it('4.8: a job for the day after tomorrow is listed quietly, and he takes it', async () => {
    await signInAs(FARMER_PHONE, FARMER_CODE);
    laterJob = crypto.randomUUID();
    const todayIst = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const base = farmerJobs.find((j) => j.id === jobId)!;
    farmerJobs = await app.sync.syncJobs(
      [...farmerJobs, { ...base, id: laterJob, status: 'searching', isImmediate: false,
        scheduledDate: app.profile.addDays(todayIst, 2), window: 'morning', captainId: null, captainName: null,
        finalAmount: null, paymentMode: null, myRating: null, areaDisputedAt: null,
        acceptedAt: null, startedAt: null, completedAt: null }],
      farmer,
    );
    const { data } = await admin.from('jobs').select('dispatch_mode').eq('id', laterJob).single();
    expect(data?.dispatch_mode).toBe('open');

    // The founder turns automatic dispatch on. Nobody was pinged at posting;
    // the captain's next sync lists it to him.
    const on = await admin.from('app_config').update({ auto_dispatch: true }).eq('id', true);
    expect(on.error).toBeNull();
    await signInAs(CAPTAIN_PHONE, CAPTAIN_CODE);
    captainJobs = await app.sync.syncJobs(captainJobs, captain);
    expect(captainJobs.find((j) => j.id === laterJob)?.status).toBe('searching');
    expect(await app.sync.acceptJobRemote(laterJob)).toBe('accepted');
    await admin.from('app_config').update({ auto_dispatch: false }).eq('id', true);
  });

  it('batch B: nobody answers in 90 seconds; the farmer is told, and asks farther away', async () => {
    await signInAs(FARMER_PHONE, FARMER_CODE);
    await admin.from('app_config').update({ auto_dispatch: true }).eq('id', true);
    roundsJob = crypto.randomUUID();
    const base = farmerJobs.find((j) => j.id === jobId)!;
    farmerJobs = await app.sync.syncJobs(
      [...farmerJobs, { ...base, id: roundsJob, status: 'searching', isImmediate: true, scheduledDate: null,
        captainId: null, captainName: null, finalAmount: null, paymentMode: null, myRating: null,
        areaDisputedAt: null, acceptedAt: null, startedAt: null, completedAt: null }],
      farmer,
    );
    const asked = await admin.from('job_dispatch').select('captain_id, round').eq('job_id', roundsJob);
    expect(asked.data).toEqual([{ captain_id: captainUid, round: 1 }]);

    // A minute and a half passes with no answer.
    const sent = new Date(Date.now() - 100_000).toISOString();
    await admin.from('job_dispatch').update({ sent_at: sent }).eq('job_id', roundsJob);
    farmerJobs = await app.sync.syncJobs(farmerJobs, farmer); // closes the round; nobody else is near
    farmerJobs = await app.sync.syncJobs(farmerJobs, farmer); // and brings the news back
    const waiting = farmerJobs.find((j) => j.id === roundsJob)!;
    expect(waiting.searchExhaustedAt).not.toBeNull();
    expect(app.jobs.canWiden(waiting)).toBe(true);

    expect(await app.sync.widenSearch(roundsJob)).toBe(true);
    const { data } = await admin.from('jobs').select('search_extra_km').eq('id', roundsJob).single();
    expect(data?.search_extra_km).toBe(10);
    await admin.from('app_config').update({ auto_dispatch: false }).eq('id', true);
  });

  it('batch C: the captain sets off; the farmer sees how far away he is', async () => {
    // One of the two founder-booked jobs from 4.6, still accepted, on the farmer's account.
    const live = twoCombineJobs[0]!;
    await signInAs(CAPTAIN_PHONE, CAPTAIN_CODE);
    captainJobs = await app.sync.syncJobs(captainJobs, captain);
    captainJobs = captainJobs.map((j) => (j.id === live ? { ...j, status: 'en_route' as const } : j));
    captainJobs = await app.sync.syncJobs(captainJobs, captain);
    expect(app.jobs.trackedJobIds(captainJobs, captainUid)).toContain(live);
    expect(await app.sync.reportJobLocation(live, 30.43, 74.04)).toBe(true);
    // Nobody can learn about a field that is not theirs.
    expect(await app.sync.fetchNearby(fieldId)).toEqual({});

    await signInAs(FARMER_PHONE, FARMER_CODE);
    farmerJobs = await app.sync.syncJobs(farmerJobs, farmer);
    const seen = farmerJobs.find((j) => j.id === live)!;
    expect(seen.status).toBe('en_route');
    expect(seen.captainKm).toBeGreaterThan(0);
    expect(seen.captainKm).toBeLessThan(5);
    // His own field: a plain answer, whatever is free right now.
    const free = await app.sync.fetchNearby(fieldId);
    expect(Object.values(free).every((n) => typeof n === 'number')).toBe(true);
  });

  it('a phone that lost its local copy gets everything back, cursors notwithstanding', async () => {
    await signInAs(FARMER_PHONE, FARMER_CODE);
    const restored = await app.sync.syncJobs([], farmer);
    expect(restored.map((j) => j.id)).toContain(jobId);
    const refields = await app.sync.syncFields([]);
    expect(refields.map((f) => f.id)).toContain(fieldId);
  });
});
