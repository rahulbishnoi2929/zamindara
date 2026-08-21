import Constants from 'expo-constants';

const PLACEHOLDER = 'REPLACE_WITH_YOUR_GOOGLE_MAPS_ANDROID_API_KEY';

/**
 * Is the Google Maps key still unset?
 *
 * Without a key, react-native-maps renders a blank grey rectangle and says
 * nothing about why. Both map screens are unusable in that state, and the
 * failure is silent — you would find out standing in a field, having driven
 * there to measure a plot.
 *
 * So we detect it and say so. English only and deliberately blunt: this is a
 * setup error, and the only person who will ever see it is the founder.
 */
export function googleMapsKeyMissing(): boolean {
  const key = Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
  return key === undefined || key === null || key === '' || key === PLACEHOLDER;
}
