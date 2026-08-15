import { closeRing, ringAreaSqm, type LatLng } from '@zamindara/geo';
import type { Locale } from '@zamindara/units';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { AreaDisplay, Button } from './components';
import { t } from './i18n';
import { colors, radius, space, type } from './theme';

interface Props {
  locale: Locale;
  onDone: (polygon: LatLng[], areaSqm: number) => void;
  onCancel: () => void;
}

/** Fazilka town, used only if location is unavailable. */
const FALLBACK: Region = {
  latitude: 30.4028,
  longitude: 74.0286,
  latitudeDelta: 0.004,
  longitudeDelta: 0.004,
};

/**
 * Trace the field on satellite imagery.
 *
 * The default way to measure a field, and on reflection a better one than
 * walking for most plots — for a reason that is easy to miss:
 *
 * **Georeferencing offset does not change area.** If Google's imagery sits
 * three metres north of truth, the whole traced polygon sits three metres
 * north and the area is unchanged. So the error here comes only from how
 * precisely the farmer taps a boundary he can see, across four corners —
 * not from two hundred noisy GPS fixes.
 *
 * And the part that matters most: he can *see* whether it is right. A walked
 * track gives him a number with no way to judge it. Here he is looking at his
 * own field — his bunds, his trees, his watercourse — with the outline on top.
 *
 * Walking stays available for the cases this cannot serve: imagery too old or
 * too cloudy, a field he cannot pick out, or a boundary that simply is not
 * visible from above.
 */
export function DrawScreen({ locale, onDone, onCancel }: Props) {
  const [region, setRegion] = useState<Region | null>(null);
  const [corners, setCorners] = useState<LatLng[]>([]);
  const [showLabels, setShowLabels] = useState(false);

  // Centre on where he is standing. He is almost certainly in or beside the
  // field he wants to measure, so this removes the hardest part of the task —
  // finding your own field on a satellite map.
  useEffect(() => {
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setRegion(FALLBACK);
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setRegion({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          // Tight enough that individual bunds are visible.
          latitudeDelta: 0.0022,
          longitudeDelta: 0.0022,
        });
      } catch {
        setRegion(FALLBACK);
      }
    })();
  }, []);

  const areaSqm = useMemo(
    () => (corners.length >= 3 ? ringAreaSqm(corners) : 0),
    [corners],
  );

  const addCorner = (point: LatLng) => setCorners((prev) => [...prev, point]);
  const moveCorner = (index: number, next: LatLng) =>
    setCorners((prev) => prev.map((p, i) => (i === index ? next : p)));
  const undo = () => setCorners((prev) => prev.slice(0, -1));

  if (region === null) {
    return (
      <View style={[s.screen, s.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.finding}>{t('findingYou', locale)}</Text>
      </View>
    );
  }

  const coords = corners.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const canFinish = corners.length >= 3;

  return (
    <View style={s.screen}>
      <View style={s.mapWrap}>
        <MapView
          style={s.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={region}
          mapType={showLabels ? 'hybrid' : 'satellite'}
          rotateEnabled={false}
          pitchEnabled={false}
          showsUserLocation
          showsMyLocationButton
          onPress={(e) =>
            addCorner({
              lat: e.nativeEvent.coordinate.latitude,
              lng: e.nativeEvent.coordinate.longitude,
            })
          }
        >
          {/* Open chain while he is still placing corners, closed shape once
              there are enough to enclose an area. */}
          {corners.length >= 3 ? (
            <Polygon
              coordinates={coords}
              strokeColor="#FFD54F"
              strokeWidth={3}
              fillColor="rgba(255,213,79,0.25)"
            />
          ) : (
            corners.length >= 2 && (
              <Polyline coordinates={coords} strokeColor="#FFD54F" strokeWidth={3} />
            )
          )}

          {corners.map((corner, index) => (
            <Marker
              key={index}
              draggable
              anchor={{ x: 0.5, y: 0.5 }}
              coordinate={{ latitude: corner.lat, longitude: corner.lng }}
              onDrag={(e) =>
                moveCorner(index, {
                  lat: e.nativeEvent.coordinate.latitude,
                  lng: e.nativeEvent.coordinate.longitude,
                })
              }
              onDragEnd={(e) =>
                moveCorner(index, {
                  lat: e.nativeEvent.coordinate.latitude,
                  lng: e.nativeEvent.coordinate.longitude,
                })
              }
            >
              {/* Numbered so the order he tapped in is obvious, and a mistaken
                  corner is easy to spot. */}
              <View style={s.handle}>
                <Text style={s.handleText}>{index + 1}</Text>
              </View>
            </Marker>
          ))}
        </MapView>

        {/* Roads and village names help him orient before he starts tapping. */}
        <Pressable
          style={s.labelToggle}
          onPress={() => setShowLabels((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: showLabels }}
        >
          <Text style={s.labelToggleText}>{t('labels', locale)}</Text>
        </Pressable>
      </View>

      <View style={s.panel}>
        {canFinish ? (
          <AreaDisplay sqm={areaSqm} locale={locale} />
        ) : (
          <Text style={s.instruction}>{t('tapCorners', locale)}</Text>
        )}

        <Text style={s.hint}>
          {canFinish ? t('tapCornersHint', locale) : t('needThreePoints', locale)}
        </Text>

        <View style={s.row}>
          <Button
            label={t('undo', locale)}
            onPress={undo}
            variant="secondary"
            disabled={corners.length === 0}
            flex
          />
          <Button
            label={t('done', locale)}
            onPress={() => onDone(closeRing(corners), areaSqm)}
            disabled={!canFinish}
            flex
          />
        </View>

        <Button
          label={corners.length > 0 ? t('clearAll', locale) : t('cancel', locale)}
          onPress={corners.length > 0 ? () => setCorners([]) : onCancel}
          variant="ghost"
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', gap: space.md },
  finding: { ...type.body, color: colors.textMuted },

  mapWrap: { flex: 1 },
  map: { flex: 1 },

  handle: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: '#FFD54F',
    borderWidth: 3,
    borderColor: colors.textInverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleText: { fontSize: 13, fontWeight: '800', color: colors.text },

  labelToggle: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    minHeight: 40,
    justifyContent: 'center',
  },
  labelToggleText: { ...type.label, color: colors.text },

  panel: { padding: space.md, gap: space.sm, backgroundColor: colors.surface },
  instruction: { ...type.title, color: colors.text, textAlign: 'center' },
  hint: { ...type.label, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  row: { flexDirection: 'row', gap: space.sm },
});
