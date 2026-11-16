/**
 * Build for phones, not for emulators.
 *
 * The generated android/gradle.properties ships four CPU architectures:
 *
 *     armeabi-v7a, arm64-v8a, x86, x86_64
 *
 * In a measured 75 MB release APK, 59 MB was native libraries and **32 MB
 * of that was x86 and x86_64** — architectures no phone in Fazilka has.
 * They exist for desktop emulators. Dropping them is the single largest cut
 * available and costs a captain nothing.
 *
 * Why a plugin and not an edit: android/gradle.properties is generated, and
 * `expo prebuild --clean` rewrites it. An edit there lasts until the next
 * native change and then silently does not.
 *
 * ⚠️ This applies to debug builds too, because the property is global
 * rather than per build type. So the standard Android emulator on Windows
 * (x86_64) will not run a build made this way. For an emulator build, pass
 * the architectures back on the command line for that one build:
 *
 *     ./gradlew assembleDebug -PreactNativeArchitectures=x86_64
 *
 * No new dependency: expo/config-plugins ships with expo.
 */

const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'reactNativeArchitectures';
const PHONES_ONLY = 'armeabi-v7a,arm64-v8a';

module.exports = function withPhoneArchitectures(config) {
  return withGradleProperties(config, (cfg) => {
    const existing = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === KEY,
    );

    if (existing === undefined) {
      // The template stopped shipping it. Setting it ourselves is still
      // correct, so add it rather than failing — unlike the signing plugin,
      // the bad outcome here is a larger APK, not an unupdatable one.
      cfg.modResults.push({ type: 'property', key: KEY, value: PHONES_ONLY });
      return cfg;
    }

    existing.value = PHONES_ONLY;
    return cfg;
  });
};
