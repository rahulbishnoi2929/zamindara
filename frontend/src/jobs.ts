import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PricingUnit } from '@zamindara/catalog';
import { fromSqm } from '@zamindara/units';

/**
 * Jobs, stored locally.
 *
 * The shape mirrors public.jobs in backend/supabase/migrations so that wiring this to
 * Postgres is a change of storage rather than a change of model.
 *
 * Until the backend is live, dispatch is simulated on-device: a posted job
 * goes to `searching` and shows up in the captain feed on the same phone.
 * That is enough to demonstrate the whole loop to a captain in his yard,
 * which is worth having months before a server is.
 */

export type JobStatus =
  | 'searching'
  | 'accepted'
  | 'en_route'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  /**
   * Nobody took it and the day it was wanted has ended. Set by the server's
   * expire_stale_jobs, never on the phone — the clock decides, and the
   * phone's clock is not the one anyone agrees on.
   */
  | 'expired';

export type JobWindow = 'morning' | 'afternoon' | 'evening' | 'any';
export type PaymentMode = 'cash' | 'upi' | 'pending';

export interface Job {
  id: string;
  fieldId: string;
  /** Denormalised so a job can be shown without loading the field. */
  fieldName: string;
  village: string;
  serviceCode: string;

  /**
   * Snapshotted at booking. If the farmer re-measures the plot next season,
   * this job and the price charged on it must not move.
   */
  areaSqm: number;

  status: JobStatus;
  isImmediate: boolean;
  scheduledDate: string | null;
  window: JobWindow;

  quotedRate: number | null;
  quotedUnit: PricingUnit;
  quotedSubtotal: number | null;
  travelCharge: number;
  quotedTotal: number | null;

  captainName: string | null;
  /** Needed to rate him. Null until a captain has taken the job. */
  captainId: string | null;
  distanceKm: number | null;

  /**
   * How many captains have been offered this job. Null when unknown — the
   * app has not synced yet, or there is no backend.
   */
  offeredCount: number | null;

  finalAmount: number | null;
  paymentMode: PaymentMode | null;
  notes: string;

  /**
   * Stars this user has already given on this job, 1-5. Null means not
   * rated yet, which is what decides whether to ask — asking twice reads as
   * the app having lost his answer.
   */
  myRating: number | null;

  createdAt: number;
  acceptedAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
}

const KEY = 'zamindara/jobs';

export async function loadJobs(): Promise<Job[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === null) return [];
  try {
    const parsed = JSON.parse(raw) as Job[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(jobs: Job[]): Promise<Job[]> {
  await AsyncStorage.setItem(KEY, JSON.stringify(jobs));
  return jobs;
}

export async function addJob(job: Job): Promise<Job[]> {
  return writeAll([job, ...(await loadJobs())]);
}

export async function updateJob(job: Job): Promise<Job[]> {
  const jobs = await loadJobs();
  return writeAll(jobs.map((j) => (j.id === job.id ? job : j)));
}

/**
 * Claim a job for a captain.
 *
 * Mirrors public.accept_job: the status check is the guard, so a job already
 * taken cannot be taken again. On one device the race is not real, but
 * keeping the same shape means the swap to the server function is a swap.
 */
export async function acceptJob(
  jobId: string,
  captainName: string,
): Promise<{ jobs: Job[]; accepted: Job | null }> {
  const jobs = await loadJobs();
  const target = jobs.find((j) => j.id === jobId);

  if (target === undefined || target.status !== 'searching') {
    return { jobs, accepted: null };
  }

  const claimed: Job = {
    ...target,
    status: 'accepted',
    captainName,
    acceptedAt: Date.now(),
  };
  return { jobs: await writeAll(jobs.map((j) => (j.id === jobId ? claimed : j))), accepted: claimed };
}

/**
 * Rates actually realised for a service, newest first. Feeds rate guidance.
 *
 * Derived from the money, never from `quotedRate`. Reading the quote made
 * guidance learn from its own guesses: a farmer who talked ₹1200 down to
 * ₹900 still handed ₹1200 to the next farmer, so the guide could only ever
 * rise. Travel comes off first — it is a charge for distance, not a rate for
 * work, and leaving it in makes every far field look like an expensive one.
 *
 * Mirrors public.rate_guidance in backend/supabase/migrations deliberately:
 * the phone must say the same thing offline as the server says online.
 */
export function completedRates(jobs: readonly Job[], serviceCode: string): number[] {
  return jobs
    .filter(
      (j) =>
        j.serviceCode === serviceCode &&
        j.status === 'completed' &&
        j.quotedUnit === 'per_killa' &&
        j.finalAmount !== null &&
        // Nothing named, or less than the travel to reach it, says nothing
        // about the going rate.
        j.finalAmount > j.travelCharge,
    )
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .map((j) => (j.finalAmount! - j.travelCharge) / fromSqm(j.areaSqm, 'killa'));
}

/**
 * Who may still get out of a job, and until when.
 *
 * Both stop at 'in_progress'. A machine is in the field and diesel has been
 * burned; what is being asked for then is a settlement, and no button can
 * decide one. Mirrors the guards in cancel_job and release_job — the
 * database refuses it either way, this only keeps the button from appearing.
 */
const EXITABLE: ReadonlySet<JobStatus> = new Set<JobStatus>([
  'searching',
  'accepted',
  'en_route',
]);

/** The farmer no longer wants the work done. */
export const canCancel = (job: Job): boolean => EXITABLE.has(job.status);

/** The captain cannot do it — but the farmer still wants it done. */
export const canRelease = (job: Job): boolean =>
  job.status === 'accepted' || job.status === 'en_route';

export async function cancelJob(jobId: string): Promise<Job[]> {
  const jobs = await loadJobs();
  return writeAll(
    jobs.map((j) =>
      j.id === jobId && canCancel(j)
        ? { ...j, status: 'cancelled' as JobStatus, synced: false }
        : j,
    ),
  );
}

/**
 * Back to searching, and unassigned. Not cancelled: his breakdown is not
 * the farmer's cancellation, and the job should go back on the market.
 */
export async function releaseJob(jobId: string): Promise<Job[]> {
  const jobs = await loadJobs();
  return writeAll(
    jobs.map((j) =>
      j.id === jobId && canRelease(j)
        ? {
            ...j,
            status: 'searching' as JobStatus,
            captainName: null,
            acceptedAt: null,
            offeredCount: null,
            synced: false,
          }
        : j,
    ),
  );
}

/**
 * Who, if anyone, this user should be asked to rate on this job.
 *
 * Farmer rates captain only. The captain rating the farmer is two-way
 * reputation, which is a Phase 7 question and buys dispatch nothing — the
 * farmer is not ranked by anything. What was actually broken is that
 * eligible_captains gives rating 30% of the match score and nothing could
 * ever write one, so every captain ranked as the same constant 3.5.
 */
export function ratingAsk(job: Job, meIsCaptain: boolean): string | null {
  if (meIsCaptain) return null;
  if (job.status !== 'completed') return null;
  if (job.myRating !== null) return null;
  return job.captainId;
}

export async function rateJob(jobId: string, stars: number): Promise<Job[]> {
  const jobs = await loadJobs();
  return writeAll(
    jobs.map((j) => (j.id === jobId ? { ...j, myRating: stars } : j)),
  );
}

export const isLive = (job: Job): boolean =>
  job.status !== 'completed' && job.status !== 'cancelled' && job.status !== 'expired';

/** The order a captain works through his day. */
export function sortForCaptain(jobs: readonly Job[]): Job[] {
  const rank: Record<JobStatus, number> = {
    in_progress: 0,
    en_route: 1,
    accepted: 2,
    searching: 3,
    completed: 4,
    cancelled: 5,
    expired: 6,
  };
  return [...jobs].sort(
    (a, b) => rank[a.status] - rank[b.status] || a.createdAt - b.createdAt,
  );
}

// ---------------------------------------------------------------------------
// What to tell the farmer while he waits
// ---------------------------------------------------------------------------

export type SearchState =
  /** Offered to captains; waiting on one of them. */
  | { kind: 'offered'; count: number }
  /** Nobody eligible was online. Re-offered every sync pass. */
  | { kind: 'nobody-yet' }
  /** Not synced yet, so we genuinely do not know. */
  | { kind: 'unknown' };

/**
 * "Finding a captain" on its own is a lie of omission: it reads the same
 * whether six captains are deciding or nobody was ever asked. Those are
 * completely different situations for a farmer whose crop is on the ground —
 * one means wait, the other means ring someone yourself.
 *
 * Returns null for jobs that are not searching; there is nothing to wait for.
 */
export function searchState(job: Job): SearchState | null {
  if (job.status !== 'searching') return null;
  if (job.offeredCount === null) return { kind: 'unknown' };
  if (job.offeredCount === 0) return { kind: 'nobody-yet' };
  return { kind: 'offered', count: job.offeredCount };
}
