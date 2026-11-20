import { describe, expect, it } from 'vitest';
import { OFFER_WINDOW_MS, sendAccept } from './sendingAccept';
import type { AcceptOutcome } from './sync/sync';

/** A fake clock that sleep() advances, so 90 seconds take no time. */
function harness(outcomes: AcceptOutcome[], status: () => string = () => 'searching') {
  let now = 0;
  let calls = 0;
  return {
    deps: {
      attempt: async () => outcomes[Math.min(calls++, outcomes.length - 1)]!,
      statusOf: async () => status(),
      now: () => now,
      sleep: async (ms: number) => {
        now += ms;
      },
    },
    calls: () => calls,
    clock: () => now,
  };
}

describe('sendAccept', () => {
  it('accepted on the first try', async () => {
    const h = harness(['accepted']);
    expect(await sendAccept('j', h.deps)).toBe('accepted');
    expect(h.calls()).toBe(1);
  });

  it('keeps sending through a dead patch and lands it', async () => {
    const h = harness(['failed', 'failed', 'accepted']);
    expect(await sendAccept('j', h.deps)).toBe('accepted');
    expect(h.calls()).toBe(3);
  });

  it('lost race is an answer, not something to retry', async () => {
    const h = harness(['failed', 'lost-race']);
    expect(await sendAccept('j', h.deps)).toBe('lost-race');
    expect(h.calls()).toBe(2);
  });

  it('is dropped when the offer window ends, never reported accepted', async () => {
    const h = harness(['failed']);
    expect(await sendAccept('j', h.deps)).toBe('dropped');
    expect(h.clock()).toBeLessThanOrEqual(OFFER_WINDOW_MS);
  });

  it('is dropped as soon as the job stops searching (taken, cancelled, expired)', async () => {
    let status = 'searching';
    const h = harness(['failed'], () => status);
    const result = sendAccept('j', {
      ...h.deps,
      sleep: async (ms) => {
        await h.deps.sleep(ms);
        status = 'expired';
      },
    });
    expect(await result).toBe('dropped');
    expect(h.calls()).toBe(1);
  });
});
