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
export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
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
