import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PricingUnit } from '@zamindara/catalog';
import type { LatLng } from '@zamindara/geo';
import type { Locale } from '@zamindara/units';

/**
 * Who the user is, and what he has.
 *
 * Local-only for now. The shape deliberately mirrors the Postgres schema in
 * backend/supabase/migrations, so wiring this to Supabase is a change of storage
 * rather than a change of model.
 */

export type Role = 'farmer' | 'captain' | 'both';
export type Ownership = 'owned' | 'arrangeable';

export interface CaptainMachine {
  id: string;
  machineCode: string;
  /**
   * Owned, or arrangeable from a relative or neighbour.
   *
   * The second tier is the point: in rural Punjab machinery access runs
   * through relationships, not ownership, and a registry that only recorded
   * what a captain owns would throw away most of the district's real
   * capacity. Arrangeable machines take scheduled work, not instant jobs.
   */
  ownership: Ownership;
  leadTimeHours: number;
  /** Balwinder's constraint — he will lend the machine, but he comes with it. */
  withOperatorOnly: boolean;
  make?: string;
  photoUri?: string;
}

export interface ServiceRate {
  serviceCode: string;
  /** Null means negotiable. The app shows a range from nearby jobs instead. */
  rate: number | null;
  unit: PricingUnit;
  /** Smallest field he takes for this work (4.5). Null or absent: any size. */
  minAreaSqm?: number | null;
}

/** Where a travelling captain will be, and when (4.7). Dates are local, YYYY-MM-DD, inclusive. */
export interface RouteStop {
  id: string;
  place: string;
  lat: number;
  lng: number;
  fromDate: string;
  toDate: string;
}

export interface Profile {
  /** Local id until signed in, then the Supabase auth user id. */
  id: string;
  /** E.164 without the plus, e.g. 919876500001. Null while offline-only. */
  phone: string | null;
  fullName: string;
  village: string;
  role: Role;
  language: Locale;
  displayChain: 'killa' | 'bigha';

  // Captain-side. Empty for a pure farmer.
  machines: CaptainMachine[];
  rates: ServiceRate[];
  serviceRadiusKm: number;
  isOnline: boolean;
  /**
   * Where he stands. The database requires a base location before a captain
   * row can exist at all, and dispatch needs a current one — so both stay
   * null until GPS has produced a point, and a captain the phone cannot yet
   * place is simply not on the market.
   */
  baseLocation: LatLng | null;
  currentLocation: LatLng | null;
  /** A migrant combine's route. Dispatch uses the stop covering a job's day. */
  routeStops: RouteStop[];

  onboardedAt: number | null;
  updatedAt: number;
}

const KEY = 'zamindara/profile';

export function emptyProfile(): Profile {
  return {
    id: String(Date.now()),
    phone: null,
    fullName: '',
    village: '',
    role: 'farmer',
    language: 'pa',
    displayChain: 'killa',
    machines: [],
    rates: [],
    serviceRadiusKm: 15,
    isOnline: false,
    baseLocation: null,
    currentLocation: null,
    routeStops: [],
    onboardedAt: null,
    updatedAt: Date.now(),
  };
}

export async function loadProfile(): Promise<Profile | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Profile;
    // Tolerate profiles written by an older build rather than losing them.
    return {
      ...emptyProfile(),
      ...parsed,
      machines: Array.isArray(parsed.machines) ? parsed.machines : [],
      rates: Array.isArray(parsed.rates) ? parsed.rates : [],
      routeStops: Array.isArray(parsed.routeStops) ? parsed.routeStops : [],
    };
  } catch {
    return null;
  }
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const next = { ...profile, updatedAt: Date.now() };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

/** Does this person supply machinery, whichever side he signed up as? */
export const isCaptain = (p: Profile): boolean =>
  p.role === 'captain' || p.role === 'both';

/** Does he book work? A captain who also farms does. */
export const isFarmer = (p: Profile): boolean =>
  p.role === 'farmer' || p.role === 'both';

/** Machine codes he can actually field, for deriving offerable services. */
export const machineCodes = (p: Profile): string[] =>
  p.machines.map((m) => m.machineCode);

/** A calendar day plus n, as YYYY-MM-DD. Noon UTC, so no time zone moves the day. */
export function addDays(isoDay: string, n: number): string {
  const d = new Date(`${isoDay}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Would this stop put him in two places on one day? The server refuses it too. */
export const overlapsRoute = (
  stops: readonly RouteStop[],
  next: { fromDate: string; toDate: string },
): boolean => stops.some((s) => s.fromDate <= next.toDate && next.fromDate <= s.toDate);
