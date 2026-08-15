import { closeRing, openRing, ringAreaSqm, type LatLng, type WalkResult } from '@zamindara/geo';
import { SQM, type Locale } from '@zamindara/units';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { AreaDisplay, Banner, Button } from './components';
import { t } from './i18n';
import { colors, radius, space, type } from './theme';

interface Props {
  locale: Locale;
  result: WalkResult;
  /** `adjusted` records whether he actually had to move the outline. */
  onConfirm: (polygon: LatLng[], areaSqm: number, adjusted: boolean) => void;
  onWalkAgain: () => void;
}

/** Plots below this are where GPS alone cannot reach the 2% bar. */
const SMALL_PLOT_SQM = SQM.killa;

/** Fit the map to the field with a little breathing room. */
function regionFor(ring: readonly LatLng[]): Region {
  const lats = ring.map((p) => p.lat);
  const lngs = ring.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.0015),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.0015),
  };
}

/**
 * The confirmation screen — and, on the evidence, the most important one.
 *
 * Measurement says the pipeline gets a one-killa plot to about 2% and a
 * half-killa plot nowhere near it. So this screen is not a formality that
 * rubber-stamps the algorithm; it is where the accuracy actually comes from.
 * The farmer looks at his own field on satellite imagery — his trees, his
 * channel, his boundary — and drags the outline onto it.
 *
 * What he confirms here is what he is billed against. Nothing else is.
 */
export function ConfirmScreen({ locale, result, onConfirm, onWalkAgain }: Props) {
  const [corners, setCorners] = useState<LatLng[]>(() => openRing(result.polygon));

  // How often the pipeline's output needs correcting by hand is itself a
  // measurement — it says how much of the accuracy is coming from the
  // algorithm and how much from the farmer's own eyes.
  const [adjusted, setAdjusted] = useState(false);

  // Live area as he drags. Every corner move updates the number he is about
  // to agree to, so there is never a gap between what he sees and what he
  // accepts.
  const areaSqm = useMemo(() => ringAreaSqm(corners), [corners]);

  const region = useMemo(() => regionFor(openRing(result.polygon)), [result.polygon]);
  const isSmallPlot = areaSqm < SMALL_PLOT_SQM;

  const moveCorner = (index: number, next: LatLng) => {
    setAdjusted(true);
    setCorners((prev) => prev.map((p, i) => (i === index ? next : p)));
  };

  return (
    <View style={s.screen}>
      <View style={s.mapWrap}>
        <MapView
          style={s.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={region}
          mapType="satellite"
          rotateEnabled={false}
          pitchEnabled={false}
        >
          <Polygon
            coordinates={corners.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor="#FFD54F"
            strokeWidth={3}
            fillColor="rgba(255,213,79,0.25)"
          />
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
              {/* Large hit area — this is dragged with a thumb, outdoors. */}
              <View style={s.handle} />
            </Marker>
          ))}
        </MapView>
      </View>

      <View style={s.panel}>
        <AreaDisplay sqm={areaSqm} locale={locale} />
        <Text style={s.instruction}>{t('dragCorners', locale)}</Text>

        {isSmallPlot && <Banner text={t('smallPlotWarning', locale)} />}

        {result.warnings.map((warning) => (
          <Banner key={warning} text={warning} />
        ))}

        <View style={s.row}>
          <Button
            label={t('walkAgain', locale)}
            onPress={onWalkAgain}
            variant="secondary"
            flex
          />
          <Button
            label={t('confirm', locale)}
            onPress={() => onConfirm(closeRing(corners), areaSqm, adjusted)}
            flex
          />
        </View>

        {isSmallPlot && <Text style={s.footnote}>{t('measureTwiceHint', locale)}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  handle: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: '#FFD54F',
    borderWidth: 3,
    borderColor: colors.textInverse,
  },
  panel: { padding: space.md, gap: space.md, backgroundColor: colors.surface },
  instruction: { ...type.body, color: colors.textMuted, textAlign: 'center' },
  row: { flexDirection: 'row', gap: space.sm },
  footnote: { ...type.label, color: colors.textMuted, textAlign: 'center' },
});
