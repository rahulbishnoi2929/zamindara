import type { LatLng, WalkResult } from '@zamindara/geo';
import type { Locale } from '@zamindara/units';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChooseMethodScreen } from './src/ChooseMethodScreen';
import { ConfirmScreen } from './src/ConfirmScreen';
import { DrawScreen } from './src/DrawScreen';
import { FieldTestScreen } from './src/fieldTest/FieldTestScreen';
import { PlotDetailScreen } from './src/fieldTest/PlotDetailScreen';
import * as testStore from './src/fieldTest/storage';
import type { CaptureMethod, TestMeasurement, TestPlot } from './src/fieldTest/types';
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

/**
 * Why a measurement is being taken.
 *
 * The same capture screens serve both paths: a farmer saving a field, and the
 * founder recording a Phase 1 test reading. Sharing them is the point — the
 * field test has to exercise the code that actually ships, not a copy of it.
 */
type Intent = { kind: 'field' } | { kind: 'test'; plotId: string };

type Screen =
  | { name: 'home' }
  | { name: 'choose'; intent: Intent }
  | { name: 'draw'; intent: Intent }
  | { name: 'walk'; intent: Intent }
  | { name: 'confirm'; intent: Intent; result: WalkResult }
  | { name: 'test' }
  | { name: 'testPlot'; plotId: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [locale, setLocale] = useState<Locale>('pa');
  const [fields, setFields] = useState<SavedField[]>([]);
  const [plots, setPlots] = useState<TestPlot[]>([]);
  const [measurements, setMeasurements] = useState<TestMeasurement[]>([]);

  useEffect(() => {
    void (async () => {
      setFields(await loadFields());
      setPlots(await testStore.loadPlots());
      setMeasurements(await testStore.loadMeasurements());
      const saved = await loadLocale();
      if (saved === 'pa' || saved === 'hi' || saved === 'en') setLocale(saved);
    })();
  }, []);

  const changeLocale = (next: Locale) => {
    setLocale(next);
    void saveLocale(next);
  };

  /** A finished measurement, routed by why it was taken. */
  const record = async (
    intent: Intent,
    method: CaptureMethod,
    polygon: LatLng[],
    areaSqm: number,
    walk: WalkResult | null,
    cornersAdjusted: boolean | null,
  ) => {
    if (intent.kind === 'test') {
      const durationSec =
        walk === null || walk.accepted.length < 2
          ? null
          : (walk.accepted[walk.accepted.length - 1]!.timestamp -
              walk.accepted[0]!.timestamp) /
            1000;

      const measurement: TestMeasurement = {
        id: String(Date.now()),
        plotId: intent.plotId,
        method,
        areaSqm,
        polygon,
        createdAt: Date.now(),
        meanAccuracyM: walk?.meanAccuracyM ?? null,
        durationSec,
        pointsAccepted: walk?.accepted.length ?? null,
        pointsRejected: walk?.rejected.length ?? null,
        pipelineMethod: walk?.method ?? null,
        cornersAdjusted,
        imageryUsable: method === 'drawn' ? true : null,
      };

      setMeasurements(await testStore.addMeasurement(measurement));
      await clearActiveWalk();
      setScreen({ name: 'testPlot', plotId: intent.plotId });
      return;
    }

    const field: SavedField = {
      id: String(Date.now()),
      // Naming comes next; the prototype's job is the measurement.
      name: `Field ${fields.length + 1}`,
      polygon,
      areaSqm,
      capturedAt: Date.now(),
      method: walk?.method ?? 'drawn',
      meanAccuracyM: walk?.meanAccuracyM ?? 0,
      synced: false,
    };

    setFields(await saveField(field));
    await clearActiveWalk();
    setScreen({ name: 'home' });
  };

  const openPlot = (plotId: string) => setScreen({ name: 'testPlot', plotId });

  const addPlot = async () => {
    const plot: TestPlot = {
      id: String(Date.now()),
      label: '',
      village: '',
      sideA: null,
      sideB: null,
      tapeUnit: 'm',
      jamabandiSqm: null,
      notes: '',
      createdAt: Date.now(),
    };
    setPlots(await testStore.upsertPlot(plot));
    openPlot(plot.id);
  };

  const currentPlot =
    screen.name === 'testPlot' ? plots.find((p) => p.id === screen.plotId) : undefined;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />

        {screen.name === 'home' && (
          <HomeScreen
            locale={locale}
            fields={fields}
            onAddField={() => setScreen({ name: 'choose', intent: { kind: 'field' } })}
            onLocaleChange={changeLocale}
            onOpenFieldTest={() => setScreen({ name: 'test' })}
          />
        )}

        {screen.name === 'choose' && (
          <ChooseMethodScreen
            locale={locale}
            onDraw={() => setScreen({ name: 'draw', intent: screen.intent })}
            onWalk={() => setScreen({ name: 'walk', intent: screen.intent })}
            onCancel={() => setScreen({ name: 'home' })}
          />
        )}

        {/* No confirmation step after drawing — he traced it on satellite
            imagery and was watching the area the whole time. A second screen
            showing him the same picture would be friction, not a safeguard. */}
        {screen.name === 'draw' && (
          <DrawScreen
            locale={locale}
            onDone={(polygon, areaSqm) =>
              void record(screen.intent, 'drawn', polygon, areaSqm, null, null)
            }
            onCancel={() =>
              screen.intent.kind === 'test'
                ? openPlot(screen.intent.plotId)
                : setScreen({ name: 'choose', intent: screen.intent })
            }
          />
        )}

        {screen.name === 'walk' && (
          <WalkScreen
            locale={locale}
            onDone={(result) =>
              setScreen({ name: 'confirm', intent: screen.intent, result })
            }
            onCancel={() =>
              screen.intent.kind === 'test'
                ? openPlot(screen.intent.plotId)
                : setScreen({ name: 'choose', intent: screen.intent })
            }
          />
        )}

        {/* A walked track, by contrast, must be checked against imagery. He
            has no way to judge the number otherwise. */}
        {screen.name === 'confirm' && (
          <ConfirmScreen
            locale={locale}
            result={screen.result}
            onConfirm={(polygon, areaSqm, adjusted) =>
              void record(
                screen.intent,
                'walked',
                polygon,
                areaSqm,
                screen.result,
                adjusted,
              )
            }
            onWalkAgain={() => setScreen({ name: 'walk', intent: screen.intent })}
          />
        )}

        {screen.name === 'test' && (
          <FieldTestScreen
            plots={plots}
            measurements={measurements}
            onOpenPlot={openPlot}
            onAddPlot={() => void addPlot()}
            onBack={() => setScreen({ name: 'home' })}
          />
        )}

        {screen.name === 'testPlot' && currentPlot !== undefined && (
          <PlotDetailScreen
            plot={currentPlot}
            measurements={measurements.filter((m) => m.plotId === currentPlot.id)}
            onChange={(next) => {
              setPlots((prev) => prev.map((p) => (p.id === next.id ? next : p)));
              void testStore.upsertPlot(next);
            }}
            onMeasureDrawn={() =>
              setScreen({ name: 'draw', intent: { kind: 'test', plotId: currentPlot.id } })
            }
            onMeasureWalked={() =>
              setScreen({ name: 'walk', intent: { kind: 'test', plotId: currentPlot.id } })
            }
            onUpdateMeasurement={(m) => {
              setMeasurements((prev) => prev.map((x) => (x.id === m.id ? m : x)));
              void testStore.updateMeasurement(m);
            }}
            onDeleteMeasurement={(id) => {
              setMeasurements((prev) => prev.filter((m) => m.id !== id));
              void testStore.deleteMeasurement(id);
            }}
            onDeletePlot={() => {
              void testStore.deletePlot(currentPlot.id).then(() => {
                setPlots((prev) => prev.filter((p) => p.id !== currentPlot.id));
                setMeasurements((prev) =>
                  prev.filter((m) => m.plotId !== currentPlot.id),
                );
                setScreen({ name: 'test' });
              });
            }}
            onBack={() => setScreen({ name: 'test' })}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
