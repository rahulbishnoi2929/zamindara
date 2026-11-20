/**
 * Which version this phone is on, and whether that is still good enough.
 *
 * There is no Play Store. An APK is installed by hand and stays until
 * someone replaces it, so a captain can be three builds behind for weeks
 * and nothing tells him. One row in `app_config` is how he finds out.
 *
 * Two separate questions, deliberately:
 *
 *   `available` — there is a newer build. A notice, ignorable.
 *   `required`  — this build is below the floor. It must stop.
 *
 * Most new versions are a suggestion. Collapsing the two would mean either
 * nagging a working phone or blocking one that was fine.
 */

export interface AppConfig {
  latestVersion: string;
  latestApkUrl: string | null;
  minimumSupportedVersion: string;
  /** Already picked for this user's language by the caller. */
  note: string | null;
  /**
   * True while there is no SMS provider: the sign-in screen says the code
   * came from the founder, because no message is on its way.
   */
  founderCodeSignin: boolean;
  /**
   * True: a job ping is the alarm that bypasses Do Not Disturb. False, the
   * default and the answer for any server that predates the switch: an
   * ordinary high-priority notification.
   */
  loudPing: boolean;
}

/**
 * Read the app_config row. Null if it carries no usable version, in which
 * case the caller falls back to the cached copy.
 *
 * Each switch has a safe default for a row that predates it, because old
 * phones meet new servers and new phones meet old ones for weeks.
 */
export function appConfigFromRow(
  row: Record<string, unknown>,
  locale: 'pa' | 'hi' | 'en',
): AppConfig | null {
  const latestVersion = String(row['latest_version'] ?? '');
  const minimumSupportedVersion = String(row['minimum_supported_version'] ?? '');
  if (latestVersion === '' || minimumSupportedVersion === '') return null;

  const note = row[`update_note_${locale}`];
  return {
    latestVersion,
    latestApkUrl: typeof row['latest_apk_url'] === 'string' ? row['latest_apk_url'] : null,
    minimumSupportedVersion,
    // There is no SMS provider; anything but an explicit false says so.
    founderCodeSignin: row['founder_code_signin'] !== false,
    // Never loud unless explicitly told.
    loudPing: row['loud_ping'] === true,
    note: typeof note === 'string' && note.length > 0 ? note : null,
  };
}

export type UpdateState =
  | { kind: 'current' }
  | { kind: 'available'; version: string; url: string | null; note: string | null }
  | { kind: 'required'; version: string; url: string | null; note: string | null };

const PARTS = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Negative, zero or positive, like any comparator.
 *
 * Numeric part by part, because `'0.10.0' < '0.9.0'` as text and that is
 * exactly the release where it would first matter.
 *
 * Anything unreadable compares **equal**. The alternative — treating it as
 * older — turns a typo in the dashboard into every phone in the district
 * locking itself out, with no way to fix it from the phone.
 */
export function compareVersions(a: string, b: string): number {
  const left = PARTS.exec(a);
  const right = PARTS.exec(b);
  if (left === null || right === null) return 0;

  for (let i = 1; i <= 3; i += 1) {
    const diff = Number(left[i]) - Number(right[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * No config means say nothing. The phone with no signal is the one standing
 * in a field, and a version check is never a reason to stop it working.
 */
export function updateState(running: string, config: AppConfig | null): UpdateState {
  if (config === null) return { kind: 'current' };

  const { latestVersion: version, latestApkUrl: url, note } = config;

  if (compareVersions(running, config.minimumSupportedVersion) < 0) {
    return { kind: 'required', version, url, note };
  }
  if (compareVersions(running, version) < 0) {
    return { kind: 'available', version, url, note };
  }
  return { kind: 'current' };
}
