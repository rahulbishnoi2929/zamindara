/**
 * Shrink the compiled Java in the release APK.
 *
 * After the architecture cut the APK is 43 MB, of which **29 MB is
 * `classes*.dex`** — compiled Java, unminified, because Expo's generated
 * `gradle.properties` leaves both of these off:
 *
 *     android.enableMinifyInReleaseBuilds
 *     android.enableShrinkResourcesInReleaseBuilds
 *
 * Turning them on runs R8: dead code is removed and what remains is
 * renamed to short names.
 *
 * ⚠️ This is the one cut that can break the app at **runtime** rather than
 * at build time. R8 cannot see code reached by reflection, so a native
 * module looked up by name can be stripped or renamed, and the failure
 * appears when a captain opens that screen — not here, and not in CI.
 *
 * What makes it survivable rather than reckless:
 *
 *   * Expo modules ship their own `proguard.txt` consumer rules, which are
 *     applied automatically. expo-location and expo-notifications both do,
 *     and those are the two this app most depends on.
 *   * `android/app/proguard-rules.pro` already keeps reanimated and the
 *     React Native turbomodule package.
 *   * The JavaScript half of the app — all of `src/`, all of `packages/` —
 *     is in the Hermes bundle and is not touched by R8 at all.
 *
 * It still needs proving on a handset. A release build that installs and
 * runs is not evidence; the evidence is opening the map, walking a
 * boundary, and receiving a notification, which are the three paths that
 * cross into native code.
 *
 * ⚠️ Crash reports become unreadable. R8 renames classes, so a stack trace
 * from a captain's phone is meaningless without the mapping file written to
 * `android/app/build/outputs/mapping/release/mapping.txt`. **Keep that file
 * with every APK you hand out.** It is regenerated on each build and does
 * not match any other build.
 *
 * No new dependency: expo/config-plugins ships with expo.
 */

const { withGradleProperties } = require('expo/config-plugins');

const SETTINGS = [
  ['android.enableMinifyInReleaseBuilds', 'true'],
  ['android.enableShrinkResourcesInReleaseBuilds', 'true'],
];

module.exports = function withMinification(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of SETTINGS) {
      const existing = cfg.modResults.find(
        (item) => item.type === 'property' && item.key === key,
      );
      if (existing === undefined) {
        cfg.modResults.push({ type: 'property', key, value });
      } else {
        existing.value = value;
      }
    }
    return cfg;
  });
};
