import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from './theme';

/**
 * Shown over the map when the Google Maps key is still the placeholder.
 *
 * Covers the blank grey rectangle react-native-maps falls back to, and
 * explains the fix, so the failure is diagnosable from the phone rather than
 * only from the source.
 */
export function MapKeyWarning() {
  return (
    <View style={s.wrap}>
      <View style={s.card}>
        <Text style={s.title}>Map cannot load</Text>
        <Text style={s.body}>
          No Google Maps API key. Put one in{' '}
          <Text style={s.code}>apps/mobile/app.json</Text> under{' '}
          <Text style={s.code}>android.config.googleMaps.apiKey</Text>, then
          rebuild.
        </Text>
        <Text style={s.body}>
          Enable <Text style={s.code}>Maps SDK for Android</Text> in the Google
          Cloud console. It fits inside the free monthly credit at this volume.
        </Text>
        <Text style={s.footnote}>
          Walking the boundary still works without a key — only the satellite
          view needs it.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.fair,
    padding: space.md,
    gap: space.sm,
    maxWidth: 420,
  },
  title: { ...type.body, fontSize: 20, color: colors.poor },
  body: { ...type.label, fontWeight: '400', color: colors.text, lineHeight: 21 },
  code: { fontWeight: '700', color: colors.primary },
  footnote: { ...type.label, fontSize: 12, fontWeight: '400', color: colors.textMuted },
});
