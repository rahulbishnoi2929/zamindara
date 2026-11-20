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
const KEY_APP_CONFIG = 'zamindara/app-config';

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
  /** The area on his land papers (4.4). Shown beside the measured one; never priced. */
  papersAreaSqm?: number | null;
}

export interface ActiveWalk {
  startedAt: number;
  points: GpsPoint[];
}

/**
 * Checkpoint the walk in progress, append-only.
 *
 * One key per GPS fix, so each point is one small write. The walk used to be
 * one JSON blob rewritten on every fix: twenty minutes in, that is 1,200
 * points re-serialised and re-written every second, on the cheapest phone in
 * the district, while it is also running GPS and the screen.
 *
 * Keys carry the walk's start time, so a new walk can never pick up points a
 * previous one left behind, even if clearing them had not finished.
 *
 * Called as points arrive, so that a crash, a dead battery or an accidental
 * back-press does not cost the farmer his walk.
 */
const WALK_PREFIX = 'zamindara/walk/';
const KEY_WALK_META = `${WALK_PREFIX}meta`;

async function walkKeys(): Promise<string[]> {
  return (await AsyncStorage.getAllKeys()).filter(
    (k) => k.startsWith(WALK_PREFIX) || k === KEY_ACTIVE_WALK,
  );
}

/**
 * Start a fresh walk: forget any other, then record when this one began.
 * Spares this walk's own keys, in case its first fix lands before the
 * clear has listed what to remove.
 */
export async function beginActiveWalk(startedAt: number): Promise<void> {
  const own = `${WALK_PREFIX}${startedAt}/`;
  await AsyncStorage.multiRemove((await walkKeys()).filter((k) => !k.startsWith(own)));
  await AsyncStorage.setItem(KEY_WALK_META, JSON.stringify({ startedAt }));
}

export async function appendWalkPoint(
  startedAt: number,
  seq: number,
  point: GpsPoint,
): Promise<void> {
  await AsyncStorage.setItem(`${WALK_PREFIX}${startedAt}/${seq}`, JSON.stringify(point));
}

export async function loadActiveWalk(): Promise<ActiveWalk | null> {
  // A walk saved by a build from before append-only storage: one blob.
  // Move it into the new form so it is not lost on the update.
  const legacy = await AsyncStorage.getItem(KEY_ACTIVE_WALK);
  if (legacy !== null) {
    await AsyncStorage.removeItem(KEY_ACTIVE_WALK);
    try {
      const parsed = JSON.parse(legacy) as ActiveWalk;
      if (Array.isArray(parsed.points) && typeof parsed.startedAt === 'number') {
        await beginActiveWalk(parsed.startedAt);
        await Promise.all(
          parsed.points.map((p, i) => appendWalkPoint(parsed.startedAt, i, p)),
        );
      }
    } catch {
      // Unreadable: nothing to recover.
    }
  }

  const meta = await AsyncStorage.getItem(KEY_WALK_META);
  if (meta === null) return null;
  let startedAt: number;
  try {
    startedAt = (JSON.parse(meta) as { startedAt: number }).startedAt;
  } catch {
    return null;
  }

  const prefix = `${WALK_PREFIX}${startedAt}/`;
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix));
  const points: [number, GpsPoint][] = [];
  for (const [key, value] of await AsyncStorage.multiGet(keys)) {
    if (value === null) continue;
    try {
      points.push([Number(key.slice(prefix.length)), JSON.parse(value) as GpsPoint]);
    } catch {
      // One torn write loses one point, not the walk.
    }
  }
  // Numeric, not text: "10" sorts before "9".
  points.sort((a, b) => a[0] - b[0]);
  return { startedAt, points: points.map(([, p]) => p) };
}

export async function clearActiveWalk(): Promise<void> {
  await AsyncStorage.multiRemove(await walkKeys());
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

/**
 * The last configuration the server gave us.
 *
 * Sign-in happens before anything else, often on a phone handed over in a
 * yard with one bar of signal. Without a cached copy the screen would fall
 * back to its built-in wording — "we have sent you an SMS" — on exactly the
 * occasion it is most wrong, because no SMS is coming.
 *
 * Stale is fine. The question it answers changes about once a year.
 */
export async function saveAppConfig(config: unknown): Promise<void> {
  await AsyncStorage.setItem(KEY_APP_CONFIG, JSON.stringify(config));
}

export async function loadCachedAppConfig<T>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(KEY_APP_CONFIG);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Where he was, and anything half-done: the screen, a job being booked, the
 * corners drawn so far. A cheap phone kills a backgrounded app during a
 * phone call; this is what brings him back to the same place. Null clears.
 */
export async function saveUi(name: string, value: unknown): Promise<void> {
  const key = `zamindara/ui/${name}`;
  if (value === null) await AsyncStorage.removeItem(key);
  else await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadUi(name: string): Promise<unknown> {
  const raw = await AsyncStorage.getItem(`zamindara/ui/${name}`);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
