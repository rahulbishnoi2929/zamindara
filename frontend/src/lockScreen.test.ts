import { describe, expect, it } from 'vitest';
import { acceptedJobId } from './lockScreen';

describe('acceptedJobId', () => {
  const ok = {
    actionIdentifier: 'accept',
    notification: { request: { content: { data: { jobId: 'job-1' } } } },
  };

  it('reads the job id from an accept tap', () => {
    expect(acceptedJobId(ok)).toBe('job-1');
  });

  it('ignores a decline, and ignores merely opening the notification', () => {
    expect(acceptedJobId({ ...ok, actionIdentifier: 'decline' })).toBeNull();
    // The default identifier is what Android sends when he taps the body
    // rather than the Accept button. Treating that as an accept would take
    // a job on his behalf because he looked at it.
    expect(
      acceptedJobId({ ...ok, actionIdentifier: 'expo.modules.notifications.actions.DEFAULT' }),
    ).toBeNull();
  });

  it('survives a payload that is missing or the wrong shape', () => {
    expect(acceptedJobId({ actionIdentifier: 'accept' })).toBeNull();
    expect(acceptedJobId({ actionIdentifier: 'accept', notification: {} })).toBeNull();
    expect(
      acceptedJobId({
        actionIdentifier: 'accept',
        notification: { request: { content: { data: { jobId: 42 } } } },
      }),
    ).toBeNull();
    expect(acceptedJobId(null)).toBeNull();
    expect(acceptedJobId(undefined)).toBeNull();
  });
});
