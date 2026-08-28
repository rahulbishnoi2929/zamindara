import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PricingUnit } from '@zamindara/catalog';

/**
 * Jobs, stored locally.
 *
 * The shape mirrors public.jobs in supabase/migrations so that wiring this to
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
  | 'cancelled';

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
  distanceKm: number | null;

  finalAmount: number | null;
  paymentMode: PaymentMode | null;
  notes: string;

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

/** Rates actually paid for a service, newest first. Feeds rate guidance. */
export function completedRates(jobs: readonly Job[], serviceCode: string): number[] {
  return jobs
    .filter(
      (j) =>
        j.serviceCode === serviceCode &&
        j.status === 'completed' &&
        j.quotedUnit === 'per_killa' &&
        j.quotedRate !== null,
    )
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .map((j) => j.quotedRate!);
}

export const isLive = (job: Job): boolean =>
  job.status !== 'completed' && job.status !== 'cancelled';

/** The order a captain works through his day. */
export function sortForCaptain(jobs: readonly Job[]): Job[] {
  const rank: Record<JobStatus, number> = {
    in_progress: 0,
    en_route: 1,
    accepted: 2,
    searching: 3,
    completed: 4,
    cancelled: 5,
  };
  return [...jobs].sort(
    (a, b) => rank[a.status] - rank[b.status] || a.createdAt - b.createdAt,
  );
}
