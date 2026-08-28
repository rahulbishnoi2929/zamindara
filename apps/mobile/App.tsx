import type { LatLng, WalkResult } from '@zamindara/geo';
import type { Locale } from '@zamindara/units';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChooseMethodScreen } from './src/ChooseMethodScreen';
import { ConfirmScreen } from './src/ConfirmScreen';
import { DrawScreen } from './src/DrawScreen';
import { FieldTestScreen } from './src/fieldTest/FieldTestScreen';
import { PlotDetailScreen } from './src/fieldTest/PlotDetailScreen';
import * as testStore from './src/fieldTest/storage';
import type { CaptureMethod, TestMeasurement, TestPlot } from './src/fieldTest/types';
import { t } from './src/i18n';
import { HomeScreen } from './src/HomeScreen';
import { CompleteJobSheet } from './src/CompleteJobSheet';
import { JobPostFlow } from './src/JobPostFlow';
import {
  pingForJob,
  requestNotificationPermission,
  setupNotifications,
  withinWorkingHours,
} from './src/notifications';
import * as Notifications from 'expo-notifications';
import {
  acceptJob,
  addJob,
  loadJobs,
  updateJob,
  type Job,
  type JobStatus,
  type PaymentMode,
} from './src/jobs';
import { OnboardingFlow } from './src/onboarding/OnboardingFlow';
import { SignInScreen } from './src/SignInScreen';
import { currentSession } from './src/auth';
import { normalisePhone, startAutoRefresh, stopAutoRefresh } from './src/supabase';
import { AppState } from 'react-native';
import { loadProfile, saveProfile, type Profile } from './src/profile';
import {
  clearActiveWalk,
  loadFields,
  saveField,
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
  | { name: 'onboarding' }
  | { name: 'choose'; intent: Intent }
  | { name: 'draw'; intent: Intent }
  | { name: 'walk'; intent: Intent }
  | { name: 'confirm'; intent: Intent; result: WalkResult }
  | { name: 'book' }
  | { name: 'test' }
  | { name: 'testPlot'; plotId: string };

export default function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fields, setFields] = useState<SavedField[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [completing, setCompleting] = useState<Job | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  // He chose to carry on without an account. Field measurement works fully
  // offline, so this is a legitimate way to use the app, not an escape hatch.
  const [skippedAuth, setSkippedAuth] = useState(false);
  const [plots, setPlots] = useState<TestPlot[]>([]);
  const [measurements, setMeasurements] = useState<TestMeasurement[]>([]);

  useEffect(() => {
    void (async () => {
      setProfile(await loadProfile());
      setFields(await loadFields());
      setJobs(await loadJobs());
      setPlots(await testStore.loadPlots());
      setMeasurements(await testStore.loadMeasurements());
      const session = await currentSession();
      setSignedIn(session !== null);
      setReady(true);
    })();
  }, []);

  // Refresh tokens only while the app is in front of him. The default timer
  // keeps the phone awake, which costs battery across a ten-hour day in a
  // pocket and buys nothing.
  useEffect(() => {
    startAutoRefresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') startAutoRefresh();
      else stopAutoRefresh();
    });
    return () => {
      sub.remove();
      stopAutoRefresh();
    };
  }, []);

  // The channel must exist before the first ping: Android fixes a channel's
  // importance when it is created and ignores later changes.
  useEffect(() => {
    void (async () => {
      await setupNotifications();
      await requestNotificationPermission();
    })();
  }, []);

  const locale: Locale = profile?.language ?? 'pa';

  const persistProfile = async (next: Profile) => {
    setProfile(await saveProfile(next));
    setScreen({ name: 'home' });
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

  /**
   * Advance a job one step: accepted -> en route -> working -> done.
   *
   * Mirrors the status ladder in public.jobs. Completion records the amount
   * and how it was paid, but the money itself moves between the two of them —
   * v1 takes no commission, so there is nothing for the app to hold.
   */
  const advanceJob = async (job: Job) => {
    const nextStatus: Partial<Record<JobStatus, JobStatus>> = {
      accepted: 'en_route',
      en_route: 'in_progress',
      in_progress: 'completed',
    };
    const next = nextStatus[job.status];
    if (next === undefined) return;

    // Completion asks what was actually taken, so it goes through a sheet
    // rather than a single tap. The recorded amount is what a dispute turns
    // on, and a season of them is what makes rate guidance honest.
    if (next === 'completed') {
      setCompleting(job);
      return;
    }

    setJobs(
      await updateJob({
        ...job,
        status: next,
        startedAt: next === 'in_progress' ? Date.now() : job.startedAt,
      }),
    );
  };

  const finishJob = async (amount: number, payment: PaymentMode) => {
    if (completing === null || profile === null) return;
    const rate =
      profile.rates.find((r) => r.serviceCode === completing.serviceCode)?.rate ?? null;

    setJobs(
      await updateJob({
        ...completing,
        status: 'completed',
        completedAt: Date.now(),
        finalAmount: amount,
        paymentMode: payment,
        // Recorded so this job can feed rate guidance for the next farmer.
        quotedRate: completing.quotedRate ?? rate,
      }),
    );
    setCompleting(null);
  };

  const claimJob = async (job: Job) => {
    if (profile === null) return;
    const { jobs: updated, accepted } = await acceptJob(job.id, profile.fullName);
    setJobs(updated);
    if (accepted === null) {
      // Someone else got there first. Not an error he caused.
      Alert.alert(t('alreadyTaken', locale));
    }
  };

  // Accept or decline straight from the lock screen, without opening the app.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const jobId = response.notification.request.content.data?.['jobId'];
      if (typeof jobId !== 'string') return;
      if (response.actionIdentifier !== 'accept') return;

      void (async () => {
        const current = await loadJobs();
        const target = current.find((j) => j.id === jobId);
        if (target !== undefined) await claimJob(target);
      })();
    });
    return () => sub.remove();
  });

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

  // Onboarding gates everything. Until we know who this is and — for a
  // captain — what he has, the rest of the app has nothing to work with.
  const needsOnboarding = profile === null || profile.onboardedAt === null;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />

        {!ready ? (
          <View style={s.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !signedIn && !skippedAuth ? (
          <SignInScreen
            locale={locale}
            onSignedIn={(phone) => {
              setSignedIn(true);
              const e164 = normalisePhone(phone);
              if (profile !== null && e164 !== null) {
                void persistProfile({ ...profile, phone: e164 });
              }
            }}
            // Measuring a field works with no account and no signal. Only
            // booking and taking work needs one.
            onSkip={() => setSkippedAuth(true)}
          />
        ) : needsOnboarding || screen.name === 'onboarding' ? (
          <OnboardingFlow
            initial={profile}
            onDone={(next) => void persistProfile(next)}
          />
        ) : (
          <>
            {screen.name === 'home' && profile !== null && (
              <HomeScreen
                profile={profile}
                fields={fields}
                jobs={jobs}
                onAddField={() => setScreen({ name: 'choose', intent: { kind: 'field' } })}
                onBookWork={() => setScreen({ name: 'book' })}
                onAcceptJob={(job) => void claimJob(job)}
                onAdvanceJob={(job) => void advanceJob(job)}
                onEditProfile={() => setScreen({ name: 'onboarding' })}
                onToggleOnline={() =>
                  void persistProfile({ ...profile, isOnline: !profile.isOnline })
                }
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

            {screen.name === 'book' && profile !== null && (
              <JobPostFlow
                locale={locale}
                fields={fields}
                history={jobs}
                village={profile.village}
                onPost={(job) => {
                  void addJob(job).then(setJobs);
                  // Until there is a server to push from, the ping is local.
                  // The presentation is the real thing, so what a captain
                  // sees and feels here is what he sees in April.
                  if (
                    profile.isOnline &&
                    withinWorkingHours(new Date(), 7, 19)
                  ) {
                    void pingForJob(job, locale);
                  }
                  setScreen({ name: 'home' });
                }}
                onCancel={() => setScreen({ name: 'home' })}
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
            <CompleteJobSheet
              job={completing}
              locale={locale}
              captainRate={
                completing === null || profile === null
                  ? null
                  : profile.rates.find(
                      (r) => r.serviceCode === completing.serviceCode,
                    )?.rate ?? null
              }
              onComplete={(amount, payment) => void finishJob(amount, payment)}
              onCancel={() => setCompleting(null)}
            />
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
