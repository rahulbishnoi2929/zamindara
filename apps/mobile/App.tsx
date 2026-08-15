import type { LatLng, WalkResult } from '@zamindara/geo';
import type { Locale } from '@zamindara/units';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmScreen } from './src/ConfirmScreen';
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
  | { name: 'walk' }
  | { name: 'confirm'; result: WalkResult };

/**
 * Zamindara — boundary walk prototype.
 *
 * Scope: measure a field and save it. Enough to answer the question the
 * roadmap says must be answered before anything else gets built — does a
 * walked boundary match the farmer's jamabandi?
 *
 * A hand-rolled screen union rather than a navigation library: three screens
 * in one linear flow does not need one, and the APK stays small.
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

  const handleConfirm = async (polygon: LatLng[], areaSqm: number) => {
    if (screen.name !== 'confirm') return;

    const field: SavedField = {
      id: String(Date.now()),
      // Naming comes next; the prototype's job is the measurement.
      name: `Field ${fields.length + 1}`,
      polygon,
      areaSqm,
      capturedAt: Date.now(),
      method: screen.result.method,
      meanAccuracyM: screen.result.meanAccuracyM,
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
            onAddField={() => setScreen({ name: 'walk' })}
            onLocaleChange={changeLocale}
          />
        )}

        {screen.name === 'walk' && (
          <WalkScreen
            locale={locale}
            onDone={(result) => setScreen({ name: 'confirm', result })}
            onCancel={() => setScreen({ name: 'home' })}
          />
        )}

        {screen.name === 'confirm' && (
          <ConfirmScreen
            locale={locale}
            result={screen.result}
            onConfirm={(polygon, areaSqm) => void handleConfirm(polygon, areaSqm)}
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
