import type { AcceptOutcome } from './sync/sync';

/**
 * How long an offer stands, from TECH_ARCHITECTURE "Timeout — 90 seconds".
 *
 * ponytail: client-side only. Nothing on the server closes an offer at 90 s
 * yet, so this bounds how long the phone keeps trying, not how long the job
 * is open. Move it to job_dispatch when server-side rounds are built.
 */
export const OFFER_WINDOW_MS = 90_000;
const RETRY_EVERY_MS = 5_000;

export type SendOutcome = 'accepted' | 'lost-race' | 'dropped';

export interface SendDeps {
  attempt: (jobId: string) => Promise<AcceptOutcome>;
  /** Local status of the job, refreshed by sync; undefined if unknown. */
  statusOf: (jobId: string) => Promise<string | undefined>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

/**
 * An accept on a bad signal.
 *
 * Until the server says yes the job is "sending", never "accepted" — the
 * captain must not drive out on a job someone else holds. A failure is
 * usually the signal, so keep trying while the offer stands; once the job
 * is no longer searching, or the window has passed, the accept is dropped
 * and he is told, rather than landing late on a job he has stopped
 * expecting. Nothing is persisted: if the app dies, so does the attempt,
 * which is the same as dropping it.
 */
export async function sendAccept(jobId: string, deps: SendDeps): Promise<SendOutcome> {
  const deadline = deps.now() + OFFER_WINDOW_MS;
  for (;;) {
    const outcome = await deps.attempt(jobId);
    if (outcome !== 'failed') return outcome;
    if (deps.now() + RETRY_EVERY_MS > deadline) return 'dropped';
    await deps.sleep(RETRY_EVERY_MS);
    const status = await deps.statusOf(jobId);
    if (status !== undefined && status !== 'searching') return 'dropped';
  }
}
