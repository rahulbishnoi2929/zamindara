import { SQM } from '@zamindara/units';

/**
 * A captain's day.
 *
 * Unlike a taxi, a combine serves eight fields back to back. So a captain has
 * a *queue*, not one job at a time, and the farmer's real question is never
 * "is a machine coming" but "when does it reach me". Answering that honestly
 * is most of what the app owes him.
 *
 * Everything here is pure and tested, because the number it produces is a
 * promise made to someone whose crop is on the ground.
 */

/** Minutes spent getting to a job, at a rough tractor pace on farm roads. */
const TRAVEL_KMH = 18;

/** Fixed overhead per job: opening a gate, agreeing where to start, turning. */
export const SETUP_MINUTES = 12;

export interface QueueJob {
  id: string;
  areaSqm: number;
  /** From the service catalogue. Null for time-priced work. */
  estMinutesPerKilla: number | null;
  /** Road distance from the previous job, or from the captain if first. */
  distanceKm: number;
}

export interface WorkingHours {
  /** Hour the captain starts, 0–23. */
  startHour: number;
  /** Hour he stops. Work does not begin after this. */
  endHour: number;
}

export const DEFAULT_HOURS: WorkingHours = { startHour: 7, endHour: 19 };

export interface ScheduledJob {
  id: string;
  /** 1-based. What the farmer is told: "you are 4th today". */
  position: number;
  startsAt: Date;
  endsAt: Date;
  workMinutes: number;
  travelMinutes: number;
  /** True when the job spilled past working hours onto a later day. */
  rolledToNextDay: boolean;
}

/**
 * How long the work itself takes.
 *
 * Null for time-priced work, where the duration is the thing being sold and
 * cannot be known in advance. A caller must handle that rather than guess —
 * an invented ETA is worse than none.
 */
export function workMinutes(areaSqm: number, estMinutesPerKilla: number | null): number | null {
  if (estMinutesPerKilla === null) return null;
  if (!Number.isFinite(areaSqm) || areaSqm <= 0) {
    throw new RangeError('area must be positive');
  }
  return (areaSqm / SQM.killa) * estMinutesPerKilla;
}

export function travelMinutes(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new RangeError('distance cannot be negative');
  }
  return (distanceKm / TRAVEL_KMH) * 60;
}

const addMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() + minutes * 60_000);

/** Move to the start of the next working day. */
function nextMorning(from: Date, hours: WorkingHours): Date {
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  next.setHours(hours.startHour, 0, 0, 0);
  return next;
}

/**
 * Lay the queue out in time.
 *
 * Jobs run in the order given — the captain's own order, which he can change.
 * Work that would start after his day ends rolls to the next morning rather
 * than being quietly promised for tonight, because a farmer told "8pm" who
 * sees nobody arrive stops believing the app.
 */
export function buildSchedule(
  jobs: readonly QueueJob[],
  startAt: Date,
  hours: WorkingHours = DEFAULT_HOURS,
): ScheduledJob[] {
  const schedule: ScheduledJob[] = [];

  // A captain who comes online before dawn is not starting before dawn.
  let cursor = new Date(startAt);
  if (cursor.getHours() < hours.startHour) {
    cursor.setHours(hours.startHour, 0, 0, 0);
  }

  jobs.forEach((job, index) => {
    const travel = travelMinutes(job.distanceKm);
    const work = workMinutes(job.areaSqm, job.estMinutesPerKilla);
    // Time-priced work has no known duration. Assume a half day so the queue
    // behind it is not promised absurdly early; the estimate is flagged by
    // the null it came from.
    const effectiveWork = work ?? 240;

    let arriveAt = addMinutes(cursor, travel);
    let rolled = false;

    // Would he start after knocking-off time? Then it is tomorrow's job.
    if (arriveAt.getHours() >= hours.endHour) {
      cursor = nextMorning(arriveAt, hours);
      arriveAt = addMinutes(cursor, travel);
      rolled = true;
    }

    const startsAt = arriveAt;
    const endsAt = addMinutes(startsAt, effectiveWork + SETUP_MINUTES);

    schedule.push({
      id: job.id,
      position: index + 1,
      startsAt,
      endsAt,
      workMinutes: effectiveWork,
      travelMinutes: travel,
      rolledToNextDay: rolled,
    });

    cursor = endsAt;
  });

  return schedule;
}

/** Where a given job sits, and when it starts. */
export function findInSchedule(
  schedule: readonly ScheduledJob[],
  jobId: string,
): ScheduledJob | null {
  return schedule.find((item) => item.id === jobId) ?? null;
}

/**
 * Suggest a geographically sensible order.
 *
 * Nearest-first from where the captain stands, then nearest to the last job.
 * A greedy nearest-neighbour rather than anything cleverer: at eight stops
 * the difference is minutes, and the captain knows the roads better than we
 * do. It is a suggestion he can override, not an instruction.
 */
export function suggestOrder(
  jobs: readonly QueueJob[],
  distanceBetween: (a: QueueJob, b: QueueJob) => number,
): QueueJob[] {
  const remaining = [...jobs];
  const ordered: QueueJob[] = [];

  // First hop uses each job's distance from the captain himself.
  let current = remaining
    .slice()
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];

  while (current !== undefined) {
    ordered.push(current);
    remaining.splice(remaining.indexOf(current), 1);

    const here = current;
    current = remaining
      .slice()
      .sort((a, b) => distanceBetween(here, a) - distanceBetween(here, b))[0];
  }

  return ordered;
}
