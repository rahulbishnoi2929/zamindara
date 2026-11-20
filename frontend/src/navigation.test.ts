import { describe, expect, it } from 'vitest';
import { backFrom, draftStillValid, persistable, prevStep, restoreScreen } from './navigation';

const field = { kind: 'field' } as const;
const test = { kind: 'test', plotId: 'p1' } as const;

describe('Android back', () => {
  it('steps back one screen, never out of the app mid-task', () => {
    expect(backFrom({ name: 'draw', intent: field })).toEqual({ name: 'choose', intent: field });
    expect(backFrom({ name: 'walk', intent: field })).toEqual({ name: 'choose', intent: field });
    expect(backFrom({ name: 'choose', intent: field })).toEqual({ name: 'home' });
    expect(backFrom({ name: 'book' })).toEqual({ name: 'home' });
    expect(backFrom({ name: 'verify' })).toEqual({ name: 'home' });
    expect(backFrom({ name: 'test' })).toEqual({ name: 'home' });
    expect(backFrom({ name: 'onboarding' })).toEqual({ name: 'home' });
    expect(backFrom({ name: 'testPlot', plotId: 'p1' })).toEqual({ name: 'test' });
  });

  it('a field-test measurement goes back to its plot, not to choose', () => {
    expect(backFrom({ name: 'draw', intent: test })).toEqual({ name: 'testPlot', plotId: 'p1' });
    expect(backFrom({ name: 'walk', intent: test })).toEqual({ name: 'testPlot', plotId: 'p1' });
  });

  it('confirm goes back to the walk, which is kept, so nothing is lost', () => {
    const result = {} as never;
    expect(backFrom({ name: 'confirm', intent: field, result })).toEqual({
      name: 'walk',
      intent: field,
    });
  });

  it('home leaves it to Android', () => {
    expect(backFrom({ name: 'home' })).toBeNull();
  });
});

describe('restoring the screen after the phone killed the app', () => {
  it('the walk result is not stored; confirm comes back as the recovered walk', () => {
    expect(persistable({ name: 'confirm', intent: field, result: {} as never })).toEqual({
      name: 'walk',
      intent: field,
    });
  });

  it('returns him to where he was', () => {
    expect(restoreScreen({ name: 'book' }, [])).toEqual({ name: 'book' });
    expect(restoreScreen({ name: 'draw', intent: field }, [])).toEqual({
      name: 'draw',
      intent: field,
    });
  });

  it('anything stale or unreadable falls back safely', () => {
    expect(restoreScreen(null, [])).toEqual({ name: 'home' });
    expect(restoreScreen({ name: 'nonsense' }, [])).toEqual({ name: 'home' });
    expect(restoreScreen({ name: 'testPlot', plotId: 'gone' }, ['p1'])).toEqual({ name: 'test' });
    expect(restoreScreen({ name: 'draw', intent: { kind: 'test', plotId: 'gone' } }, [])).toEqual({
      name: 'test',
    });
    // A confirm saved by some path that skipped persistable has no result.
    expect(restoreScreen({ name: 'confirm', intent: field }, [])).toEqual({
      name: 'walk',
      intent: field,
    });
  });
});

describe('job draft', () => {
  it('back walks the booking steps before leaving it', () => {
    expect(prevStep('review', 2)).toBe('when');
    expect(prevStep('when', 2)).toBe('service');
    expect(prevStep('service', 2)).toBe('field');
    expect(prevStep('field', 2)).toBeNull();
    // With one field the field step is skipped going forward, so too going back.
    expect(prevStep('service', 1)).toBeNull();
  });

  it('a draft says "today", so it only holds on the day it was made', () => {
    const morning = new Date(2026, 10, 20, 8).getTime();
    expect(draftStillValid(morning, new Date(2026, 10, 20, 21).getTime())).toBe(true);
    expect(draftStillValid(morning, new Date(2026, 10, 21, 7).getTime())).toBe(false);
  });
});

describe('re-measuring a phone booking (4.3)', () => {
  it('survives a restart mid-walk, and goes back to choosing a method', async () => {
    const { restoreScreen, backFrom } = await import('./navigation');
    const walk = { name: 'walk', intent: { kind: 'retrace', jobId: 'j1' } };
    expect(restoreScreen(walk, [])).toEqual(walk);
    expect(backFrom(walk as never)).toEqual({ name: 'choose', intent: { kind: 'retrace', jobId: 'j1' } });
    expect(restoreScreen({ name: 'captainBook' }, [])).toEqual({ name: 'captainBook' });
  });
});
