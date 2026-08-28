import type { Session } from '@supabase/supabase-js';
import { isBackendConfigured, normalisePhone, supabase } from './supabase';

/**
 * Signing in.
 *
 * Phone number, one code, no password. Farmers here have no email address,
 * and a password is one more thing to lose — so the phone number is the
 * identity and the schema has no password column anywhere.
 *
 * Every function returns a result rather than throwing. A captain standing in
 * a field with one bar of signal will hit every one of these failure modes,
 * and each needs something he can act on rather than a stack trace.
 */

export type AuthOutcome =
  | { ok: true }
  | { ok: false; reason: 'no-backend' | 'bad-number' | 'rate-limited' | 'wrong-code' | 'offline' | 'unknown'; detail?: string };

/** Send a code to this number. */
export async function requestCode(rawPhone: string): Promise<AuthOutcome> {
  if (!isBackendConfigured()) return { ok: false, reason: 'no-backend' };

  const phone = normalisePhone(rawPhone);
  if (phone === null) return { ok: false, reason: 'bad-number' };

  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error === null) return { ok: true };

  // Asking again too soon is the commonest case by far — he did not see the
  // first message arrive and tapped again.
  if (error.status === 429) return { ok: false, reason: 'rate-limited' };
  if (isNetworkError(error.message)) return { ok: false, reason: 'offline' };
  return { ok: false, reason: 'unknown', detail: error.message };
}

/** Exchange the code for a session. */
export async function verifyCode(rawPhone: string, code: string): Promise<AuthOutcome> {
  if (!isBackendConfigured()) return { ok: false, reason: 'no-backend' };

  const phone = normalisePhone(rawPhone);
  if (phone === null) return { ok: false, reason: 'bad-number' };

  const { error } = await supabase.auth.verifyOtp({
    phone,
    token: code.trim(),
    type: 'sms',
  });

  if (error === null) return { ok: true };
  if (isNetworkError(error.message)) return { ok: false, reason: 'offline' };
  // Supabase reports an expired code and a wrong code the same way, and so
  // do we — "ask for a new code" is the right advice either way.
  return { ok: false, reason: 'wrong-code' };
}

export async function currentSession(): Promise<Session | null> {
  if (!isBackendConfigured()) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signOut(): Promise<void> {
  if (!isBackendConfigured()) return;
  await supabase.auth.signOut();
}

function isNetworkError(message: string): boolean {
  return /network|fetch|timeout|ENOTFOUND|Failed to fetch/i.test(message);
}
