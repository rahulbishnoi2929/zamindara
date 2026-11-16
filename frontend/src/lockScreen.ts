/**
 * Accepting from the lock screen.
 *
 * This is the most important interaction in the product. A captain on a
 * machine, phone in his pocket, hears it ring and takes the work without
 * unlocking anything. If it does not work he does not report a bug — he
 * stops trusting the sound, and then nothing else in the app matters.
 *
 * It had two ways to do nothing at all, both silent:
 *
 *   * the handler called `claimJob`, which begins `if (profile === null)
 *     return` — and on a cold start from a notification the profile has
 *     not loaded yet;
 *   * it looked the job up in local storage first, and a job offered to a
 *     phone that has not synced since is not there.
 *
 * Both end the same way: he taps Accept and the phone does nothing.
 *
 * Neither piece of local state is needed. `accept_job` takes a job id and a
 * session, and decides everything else server-side — so this path asks the
 * server directly and reconciles local state afterwards.
 */

/** Must match the identifier registered in notifications.ts. */
const ACCEPT = 'accept';

/**
 * The job he agreed to take, or null.
 *
 * Null for a decline, for a malformed payload, and — deliberately — for the
 * default action, which is what Android sends when he taps the body of the
 * notification rather than the Accept button. Treating that as an accept
 * would commit him to a job because he looked at it.
 */
export function acceptedJobId(response: unknown): string | null {
  if (typeof response !== 'object' || response === null) return null;

  const { actionIdentifier, notification } = response as {
    actionIdentifier?: unknown;
    notification?: unknown;
  };
  if (actionIdentifier !== ACCEPT) return null;

  const data = (notification as { request?: { content?: { data?: unknown } } } | undefined)
    ?.request?.content?.data;
  if (typeof data !== 'object' || data === null) return null;

  const jobId = (data as { jobId?: unknown }).jobId;
  return typeof jobId === 'string' && jobId.length > 0 ? jobId : null;
}
