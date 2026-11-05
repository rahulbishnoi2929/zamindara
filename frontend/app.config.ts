import type { ExpoConfig } from 'expo/config';

/**
 * Secrets come from the environment, never from a tracked file.
 *
 * app.json stays as the readable base; this layers the three values that
 * must not be committed. Expo loads `.env` automatically, so putting a real
 * Maps key in app.json is now impossible to do by accident — the field is
 * populated at build time or it is left as the placeholder the app already
 * detects and explains on screen.
 *
 * `.env` is gitignored. `.env.example` lists the names.
 */

/**
 * Over-the-air updates.
 *
 * Reinstalling a 70 MB APK for a one-line change is not a workflow anyone
 * sustains, and in a season there will be a lot of one-line changes. With
 * this, a JavaScript change reaches every installed phone on its next cold
 * start — no download, no reinstall, nothing asked of a captain.
 *
 * The id comes from `eas init`, which writes it into app.json. Deriving the
 * URL from it rather than writing both means there is no second thing to
 * forget, and no placeholder that silently points at nothing.
 *
 * Absent id = updates off, which is the correct state before anyone has run
 * `eas init`: the app runs entirely on its embedded bundle.
 *
 * `fallbackToCacheTimeout: 0` is the Fazilka decision. The app NEVER waits
 * on the network to start — it opens on the bundle it already has and
 * fetches any new one in the background, for next time. The alternative is
 * a farmer staring at a splash screen on 2G, which is worse than running
 * yesterday's code.
 *
 * What this cannot do: native changes. A new native module, a new Android
 * permission, an SDK bump — those need a real build. The `fingerprint`
 * runtime policy in app.json is what keeps that honest: it hashes the
 * native project, so a JS bundle can never land on an app it does not match.
 */
function updates(projectId: string | undefined): Partial<ExpoConfig> {
  if (projectId === undefined || projectId === '') return {};
  return {
    updates: {
      url: `https://u.expo.dev/${projectId}`,
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
      // Which stream of updates this build listens to. EAS Build sets this
      // from eas.json; a build made locally with gradle gets it from here,
      // and building locally is how this project avoids paying for builds.
      requestHeaders: {
        'expo-channel-name': process.env.EAS_UPDATE_CHANNEL || 'production',
      },
    },
  };
}

export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  ...updates(config.extra?.['eas']?.projectId as string | undefined),
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey:
          process.env.GOOGLE_MAPS_API_KEY ||
          'REPLACE_WITH_YOUR_GOOGLE_MAPS_ANDROID_API_KEY',
      },
    },
  },
  extra: {
    ...config.extra,
    // Empty is a supported state: the app runs offline-only and says so.
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  },
});
