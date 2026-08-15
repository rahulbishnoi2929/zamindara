import type { LatLng, WalkResult } from '@zamindara/geo';
import type { Locale } from '@zamindara/units';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChooseMethodScreen } from './src/ChooseMethodScreen';
import { ConfirmScreen } from './src/ConfirmScreen';
import { DrawScreen } from './src/DrawScreen';
import { HomeScreen } from './src/HomeScreen';
import {
  clearActiveWalk,
  loadFields,
  loadLocale,
  saveField,
  saveLocale,
  type SavedField,
} from './src/storage';
import { colors } from './src/theme';
import { WalkScreen } from './src/WalkScreen';

type Screen =
  | { name: 'home' }
  | { name: 'choose' }
  | { name: 'draw' }
  | { name: 'walk' }
  | { name: 'confirm'; result: WalkResult };

/**
 * Zamindara — field measurement prototype.
 *
 * Scope: measure a field and save it. Enough to answer the question the build
 * plan puts before everything else — does a measured boundary match a tape?
 *
 * Two capture methods, and the choice between them is not a formality:
 *
 *   Draw   — trace the field on satellite imagery. The default. Faster, and
 *            he can see whether it is right while he does it.
 *   Walk   — pace the boundary with GPS. For fields that cannot be picked out
 *            from above, or where the imagery is too old to trust.
 *
 * A hand-rolled screen union rather than a navigation library: one linear
 * flow does not need one, and the APK stays small.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [locale, setLocale] = useState<Locale>('pa');
  const [fields, setFields] = useState<SavedField[]>([]);

  useEffect(() => {
    void (async () => {
      setFields(await loadFields());
      const saved = await loadLocale();
      if (saved === 'pa' || saved === 'hi' || saved === 'en') setLocale(saved);
    })();
  }, []);

  const changeLocale = (next: Locale) => {
    setLocale(next);
    void saveLocale(next);
  };

  const persist = async (
    polygon: LatLng[],
    areaSqm: number,
    method: string,
    meanAccuracyM: number,
  ) => {
    const field: SavedField = {
      id: String(Date.now()),
      // Naming comes next; the prototype's job is the measurement.
      name: `Field ${fields.length + 1}`,
      polygon,
      areaSqm,
      capturedAt: Date.now(),
      method,
      meanAccuracyM,
      synced: false,
    };

    setFields(await saveField(field));
    await clearActiveWalk();
    setScreen({ name: 'home' });
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />

        {screen.name === 'home' && (
          <HomeScreen
            locale={locale}
            fields={fields}
            onAddField={() => setScreen({ name: 'choose' })}
            onLocaleChange={changeLocale}
          />
        )}

        {screen.name === 'choose' && (
          <ChooseMethodScreen
            locale={locale}
            onDraw={() => setScreen({ name: 'draw' })}
            onWalk={() => setScreen({ name: 'walk' })}
            onCancel={() => setScreen({ name: 'home' })}
          />
        )}

        {/* No confirmation step after drawing — he traced it on satellite
            imagery and was watching the area the whole time. A second screen
            showing him the same picture would be friction, not a safeguard. */}
        {screen.name === 'draw' && (
          <DrawScreen
            locale={locale}
            onDone={(polygon, areaSqm) => void persist(polygon, areaSqm, 'drawn', 0)}
            onCancel={() => setScreen({ name: 'choose' })}
          />
        )}

        {screen.name === 'walk' && (
          <WalkScreen
            locale={locale}
            onDone={(result) => setScreen({ name: 'confirm', result })}
            onCancel={() => setScreen({ name: 'choose' })}
          />
        )}

        {/* A walked track, by contrast, must be checked against imagery. He
            has no way to judge the number otherwise. */}
        {screen.name === 'confirm' && (
          <ConfirmScreen
            locale={locale}
            result={screen.result}
            onConfirm={(polygon, areaSqm) =>
              void persist(
                polygon,
                areaSqm,
                screen.result.method,
                screen.result.meanAccuracyM,
              )
            }
            onWalkAgain={() => setScreen({ name: 'walk' })}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
