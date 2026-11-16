/**
 * Sign the release APK with our own key, not the debug key.
 *
 * Why a config plugin and not an edit to android/app/build.gradle: that file
 * is generated. `expo prebuild --clean` deletes the whole android directory
 * and writes it again, so any edit made there survives until the next time
 * anything native changes — and then silently does not. A plugin runs as
 * part of prebuild, so the signing config is re-applied every time.
 *
 * Why the secrets are not in here: they are read by gradle from gradle
 * properties, which live in ~/.gradle/gradle.properties — outside the
 * repository and outside android/. Nothing this plugin writes contains a
 * password or a path to a keystore, so the generated file is as safe to
 * leave lying around as it was before.
 *
 * ⚠️ Why this throws rather than warning.
 *
 * If the anchor below ever stops matching — a React Native upgrade changes
 * the template, most likely — the quiet failure is a release APK signed
 * with the *debug* key. That is not a cosmetic problem. Android refuses to
 * install an update whose signature differs from the installed app, so a
 * captain carrying a debug-signed build cannot be given a properly signed
 * one later. He has to uninstall first, which takes his unsynced fields and
 * jobs with it. Better to fail the build in your own hands than to find out
 * from a captain in April.
 *
 * No new dependency: expo/config-plugins ships with expo.
 */

const { withAppBuildGradle } = require('expo/config-plugins');

/** What gradle looks for. Set these in ~/.gradle/gradle.properties. */
const STORE_FILE = 'ZAMINDARA_STORE_FILE';
const STORE_PASSWORD = 'ZAMINDARA_STORE_PASSWORD';
const KEY_ALIAS = 'ZAMINDARA_KEY_ALIAS';
const KEY_PASSWORD = 'ZAMINDARA_KEY_PASSWORD';

// The generated template, exactly as React Native writes it.
const DEBUG_SIGNING_BLOCK = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

const RELEASE_USES_DEBUG_KEY = `            signingConfig signingConfigs.debug
            def enableShrinkResources`;

const OUR_SIGNING_BLOCK = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        // Injected by plugins/withReleaseSigning.js. The values come from
        // ~/.gradle/gradle.properties, which is outside this repository —
        // nothing here is a secret.
        release {
            if (project.hasProperty('${STORE_FILE}')) {
                storeFile file(project.property('${STORE_FILE}'))
                storePassword project.property('${STORE_PASSWORD}')
                keyAlias project.property('${KEY_ALIAS}')
                keyPassword project.property('${KEY_PASSWORD}')
            }
        }
    }`;

// Falling back to the debug key when nothing is configured is deliberate: a
// fresh clone and CI must still be able to build. The build prints which one
// it used, because "which key signed this" is not a thing to guess about.
const RELEASE_USES_OUR_KEY = `            signingConfig project.hasProperty('${STORE_FILE}') ? signingConfigs.release : signingConfigs.debug
            if (!project.hasProperty('${STORE_FILE}')) {
                println '\\u001B[33mZamindara: no ${STORE_FILE} set, release APK is signed with the DEBUG key. Do not give this build to anyone.\\u001B[0m'
            }
            def enableShrinkResources`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    // Already applied — prebuild can run the mod more than once.
    if (gradle.includes(STORE_FILE)) return cfg;

    if (!gradle.includes(DEBUG_SIGNING_BLOCK)) {
      throw new Error(
        'withReleaseSigning: could not find the signingConfigs block in ' +
          'android/app/build.gradle. The React Native template has changed. ' +
          'Fix this plugin before building a release — otherwise the release ' +
          'APK is signed with the debug key, and Android will refuse to ' +
          'install a properly signed update over it.',
      );
    }
    if (!gradle.includes(RELEASE_USES_DEBUG_KEY)) {
      throw new Error(
        'withReleaseSigning: could not find the release buildType’s ' +
          'signingConfig line in android/app/build.gradle. See above.',
      );
    }

    gradle = gradle.replace(DEBUG_SIGNING_BLOCK, OUR_SIGNING_BLOCK);
    gradle = gradle.replace(RELEASE_USES_DEBUG_KEY, RELEASE_USES_OUR_KEY);

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
