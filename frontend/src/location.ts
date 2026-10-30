import type { LatLng } from '@zamindara/geo';
import * as Location from 'expo-location';

/**
 * One GPS fix, best effort.
 *
 * Used where a single point is needed — going online, anchoring a captain's
 * base — as opposed to the boundary walk's stream. Never throws and never
 * blocks for long: in a yard with one bar of signal a location that arrives
 * in nine seconds is worth less than the toggle responding now. Null means
 * "the phone could not place him", which callers treat as "try again next
 * time", never as an error he has to look at.
 */
export async function currentLatLng(): Promise<LatLng | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;

    const fix = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (fix === null) return null;

    return { lat: fix.coords.latitude, lng: fix.coords.longitude };
  } catch {
    return null;
  }
}
