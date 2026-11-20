import type { WalkResult } from '@zamindara/geo';

/**
 * Where the app is, and where Android's back button takes it.
 *
 * There is no navigation library: one `screen` value in App. That is enough,
 * but it meant back was never handled — Android's default left the app from
 * every screen, mid-drawing or mid-booking. And the screen lived only in
 * memory, so a cheap phone that killed the app during a phone call brought
 * him back to home with his work gone.
 */

export type Intent = { kind: 'field' } | { kind: 'test'; plotId: string };

export type Screen =
  | { name: 'home' }
  | { name: 'onboarding' }
  | { name: 'choose'; intent: Intent }
  | { name: 'draw'; intent: Intent }
  | { name: 'walk'; intent: Intent }
  | { name: 'confirm'; intent: Intent; result: WalkResult }
  | { name: 'book' }
  | { name: 'verify' }
  | { name: 'founder' }
  | { name: 'test' }
  | { name: 'testPlot'; plotId: string };

/** Where back goes. Null: home, so let Android do its normal thing. */
export function backFrom(screen: Screen): Screen | null {
  switch (screen.name) {
    case 'home':
      return null;
    case 'draw':
    case 'walk':
      // Same places their own Cancel buttons go.
      return screen.intent.kind === 'test'
        ? { name: 'testPlot', plotId: screen.intent.plotId }
        : { name: 'choose', intent: screen.intent };
    case 'confirm':
      // The walk is still checkpointed, so this is "walk again", not discard.
      return { name: 'walk', intent: screen.intent };
    case 'testPlot':
      return { name: 'test' };
    default:
      return { name: 'home' };
  }
}

/** What is written to disk. The walk result is rebuilt from the checkpoint. */
export function persistable(screen: Screen): Screen {
  return screen.name === 'confirm' ? { name: 'walk', intent: screen.intent } : screen;
}

const NAMES = new Set(['home', 'onboarding', 'choose', 'draw', 'walk', 'confirm', 'book', 'verify', 'founder', 'test', 'testPlot']);

/** Read back what was saved, falling back to somewhere safe if it is stale. */
export function restoreScreen(saved: unknown, plotIds: readonly string[]): Screen {
  const s = saved as { name?: unknown; intent?: Intent; plotId?: unknown } | null;
  if (s === null || typeof s !== 'object' || !NAMES.has(s.name as string)) {
    return { name: 'home' };
  }
  if (s.name === 'testPlot') {
    return plotIds.includes(s.plotId as string)
      ? { name: 'testPlot', plotId: s.plotId as string }
      : { name: 'test' };
  }
  if (s.name === 'choose' || s.name === 'draw' || s.name === 'walk' || s.name === 'confirm') {
    const intent = s.intent;
    if (intent?.kind !== 'field' && intent?.kind !== 'test') return { name: 'home' };
    if (intent.kind === 'test' && !plotIds.includes(intent.plotId)) return { name: 'test' };
    return { name: s.name === 'confirm' ? 'walk' : s.name, intent };
  }
  return { name: s.name } as Screen;
}

export type BookingStep = 'field' | 'service' | 'when' | 'review';

/** One step back in the booking; null means leave it. */
export function prevStep(step: BookingStep, fieldCount: number): BookingStep | null {
  switch (step) {
    case 'review':
      return 'when';
    case 'when':
      return 'service';
    case 'service':
      return fieldCount === 1 ? null : 'field';
    case 'field':
      return null;
  }
}

/** A draft says "today" or "tomorrow", so it only means it on the day it was made. */
export function draftStillValid(savedAt: number, now: number): boolean {
  return new Date(savedAt).toDateString() === new Date(now).toDateString();
}
