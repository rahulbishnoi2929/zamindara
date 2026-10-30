import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';

/**
 * The Supabase client.
 *
 * Two things about this app make the configuration unusual:
 *
 * **Sessions live in AsyncStorage.** A captain signs in once and stays signed
 * in. Being logged out in a field with no signal, mid-harvest, would be
 * unforgivable — and there is no password to type back in even if he wanted
 * to, because the phone number is the identity.
 *
 * **Auto-refresh is off by default and driven by app state instead.** The
 * default timer keeps a phone awake to renew tokens; on a device that spends
 * ten hours in a pocket during harvest, that costs battery for nothing.
 * See `startAutoRefresh` below.
 */

interface Extra {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const SUPABASE_URL = extra.supabaseUrl ?? '';
export const SUPABASE_ANON_KEY = extra.supabaseAnonKey ?? '';

/**
 * Is a backend configured at all?
 *
 * The app runs fully offline without one — measuring fields, registering
 * machinery, and the on-device job loop all work. So a missing backend is a
 * degraded mode to be reported, not a crash.
 */
export const isBackendConfigured = (): boolean =>
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

export const supabase: SupabaseClient = createClient(
  // A syntactically valid placeholder, so constructing the client never
  // throws when no backend is configured. Every call is gated on
  // isBackendConfigured() rather than on the client existing.
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_ANON_KEY || 'public-anon-key-not-configured',
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: false,
      // No deep-link callback: phone OTP never leaves the app.
      detectSessionInUrl: false,
    },
  },
);

/** Refresh tokens only while the app is actually in front of him. */
export function startAutoRefresh(): void {
  supabase.auth.startAutoRefresh().catch(() => undefined);
}

export function stopAutoRefresh(): void {
  supabase.auth.stopAutoRefresh().catch(() => undefined);
}

/**
 * Normalise a phone number to what Supabase expects.
 *
 * People here type ten digits. They also type them with spaces, with a
 * leading zero, and with +91 — all of which mean the same person, and none of
 * which should create a second account.
 */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');

  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;

  return null;
}

/** The ten digits, for display back to him. */
export function displayPhone(e164: string): string {
  return e164.replace(/^91/, '');
}
