import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GpsPoint, LatLng } from '@zamindara/geo';

/**
 * Local persistence.
 *
 * Everything here works with no network. A farmer measuring a field is
 * standing in the middle of one, and Fazilka's signal is not reliable — so
 * the walk is written to disk as it happens and uploaded whenever it can be.
 * Losing twenty minutes of walking to a dropped connection would be
 * unforgivable, and would only ever happen to the farmer least able to
 * tolerate it.
 */

const KEY_ACTIVE_WALK = 'zamindara/active-walk';
const KEY_FIELDS = 'zamindara/fields';
const KEY_LOCALE = 'zamindara/locale';

export interface SavedField {
  id: string;
  name: string;
  polygon: LatLng[];
  areaSqm: number;
  capturedAt: number;
  method: string;
  meanAccuracyM: number;
  /** False until it reaches Supabase. Nothing is lost while offline. */
  synced: boolean;
}

export interface ActiveWalk {
  startedAt: number;
  points: GpsPoint[];
}

/**
 * Checkpoint the walk in progress.
 *
 * Called as points arrive, so that a crash, a dead battery or an accidental
 * back-press does not cost the farmer his walk.
 */
export async function saveActiveWalk(walk: ActiveWalk): Promise<void> {
  await AsyncStorage.setItem(KEY_ACTIVE_WALK, JSON.stringify(walk));
}

export async function loadActiveWalk(): Promise<ActiveWalk | null> {
  const raw = await AsyncStorage.getItem(KEY_ACTIVE_WALK);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as ActiveWalk;
    return Array.isArray(parsed.points) ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearActiveWalk(): Promise<void> {
  await AsyncStorage.removeItem(KEY_ACTIVE_WALK);
}

export async function loadFields(): Promise<SavedField[]> {
  const raw = await AsyncStorage.getItem(KEY_FIELDS);
  if (raw === null) return [];
  try {
    const parsed = JSON.parse(raw) as SavedField[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveField(field: SavedField): Promise<SavedField[]> {
  const fields = await loadFields();
  const next = [field, ...fields.filter((f) => f.id !== field.id)];
  await AsyncStorage.setItem(KEY_FIELDS, JSON.stringify(next));
  return next;
}

export async function loadLocale(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_LOCALE);
}

export async function saveLocale(locale: string): Promise<void> {
  await AsyncStorage.setItem(KEY_LOCALE, locale);
}
