import type { LatLng, WalkResult } from '@zamindara/geo';
import type { Locale } from '@zamindara/units';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
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
  registerPushToken,
  setupNotifications,
  withinWorkingHours,
} from './src/notifications';
import * as Notifications from 'expo-notifications';
import {
  acceptJob,
  addJob,
  cancelJob,
  loadJobs,
  rateJob,
  releaseJob,
  updateJob,
  type Job,
  type JobStatus,
  type PaymentMode,
} from './src/jobs';
import { OnboardingFlow } from './src/onboarding/OnboardingFlow';
import { SignInScreen } from './src/SignInScreen';
import { VerifyCaptainsScreen } from './src/VerifyCaptainsScreen';
import { currentSession } from './src/auth';
import { startAutoRefresh, stopAutoRefresh } from './src/supabase';
import { AppState } from 'react-native';
import { loadProfile, saveProfile, type Profile } from './src/profile';
import { currentLatLng } from './src/location';
import {
  acceptJobRemote,
  amIAdmin,
  syncFields,
  cancelJobRemote,
  fetchRateGuidance,
  pushRating,
  releaseJobRemote,
  syncJobs,
  syncProfile,
} from './src/sync/sync';
import { uuid } from './src/sync/mapping';
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
  | { name: 'verify' }
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
  // Staff only. The verify queue is hidden entirely for everyone else; the
  // real guard is in the database, this just avoids offering a dead end.
  const [isStaff, setIsStaff] = useState(false);
  const [plots, setPlots] = useState<TestPlot[]>([]);
  const [measurements, setMeasurements] = useState<TestMeasurement[]>([]);

  useEffect(() => {
    void (async () => {
      const stored = await loadProfile();
      const storedFields = await loadFields();
      const storedJobs = await loadJobs();
      setProfile(stored);
      setFields(storedFields);
      setJobs(storedJobs);
      setPlots(await testStore.loadPlots());
      setMeasurements(await testStore.loadMeasurements());
      const session = await currentSession();
      setSignedIn(session !== null);
      if (session !== null) setIsStaff(await amIAdmin());
      setReady(true);

      // The first sync pass runs once everything local is loaded, so a
      // field measured offline yesterday is on its way before he has
      // finished reading the home screen.
      if (session !== null && stored !== null) {
        void (async () => {
          const merged = (await syncProfile(stored)) ?? stored;
          const fields = await syncFields(storedFields);
          const jobs = await syncJobs(storedJobs, merged);
          if (merged !== stored) {
            setProfile(await saveProfile(merged));
          }
          if (fields !== storedFields) setFields(fields);
          if (jobs !== storedJobs) setJobs(jobs);
        })();
      }
    })();
  }, []);

  /**
   * One sync pass, from the top: profile, then fields, then jobs.
   *
   * Order matters — a job cannot exist server-side until its field does,
   * and a captain cannot be dispatched to until his profile row does. Each
   * stage leaves the state it found when it cannot reach the server, which
   * is what makes "sync on every activation" safe to run unconditionally.
   */
  const runSync = async () => {
    if (profile === null || !signedIn) return;
    const merged = await syncProfile(profile);
    const current = merged ?? profile;
    if (merged !== null && merged !== profile) {
      setProfile(await saveProfile(merged));
    }
    const nextFields = await syncFields(fields);
    if (nextFields !== fields) setFields(nextFields);
    const nextJobs = await syncJobs(jobs, current);
    if (nextJobs !== jobs) setJobs(nextJobs);
  };

  // Refresh tokens and sync only while the app is in front of him. The
  // default timer keeps a phone awake, which costs battery across a
  // ten-hour day in a pocket and buys nothing; and a sync pass while the
  // phone is locked would burn the same signal for a screen nobody reads.
  // The listener registers once and reads runSync through a ref, so it
  // always sees the latest state without re-subscribing on every render.
  const runSyncRef = useRef(runSync);
  runSyncRef.current = runSync;
  useEffect(() => {
    startAutoRefresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startAutoRefresh();
        void runSyncRef.current();
      } else {
        stopAutoRefresh();
      }
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
      // Registers the device so the server can ring it. Returns false and
      // changes nothing when there is no Expo project id yet — a setup gap,
      // not a runtime error.
      await registerPushToken();
    })();
  }, []);

  const locale: Locale = profile?.language ?? 'pa';

  const persistProfile = async (raw: Profile) => {
    // A profile written before sign-in carries a local id and no phone. The
    // moment there is a session, its identity is the auth user id and the
    // signed-in number — onboarding usually runs after signing in, so this
    // is the normal path, not the exception. Without this stamp the row the
    // database knows him by never gets created.
    let next = raw;
    if (signedIn) {
      const session = await currentSession();
      const id = session?.user.id;
      const phone = session?.user.phone?.replace(/^\+/, '') ?? null;
      if (id !== undefined && (next.id !== id || next.phone !== phone)) {
        next = { ...next, id, phone };
      }
    }

    const saved = await saveProfile(next);
    setProfile(saved);
    setScreen({ name: 'home' });
    // Onboarding edits and the morning availability toggle both land here;
    // either may be the first thing this profile ever says to the server.
    void syncProfile(saved).then((merged) => {
      if (merged !== null && merged !== saved) {
        void saveProfile(merged).then(setProfile);
      }
    });
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
      // Minted here, on the phone: the same field is the same row on every
      // device it ever reaches, even if it was measured with no signal.
      id: uuid(),
      name: `Field ${fields.length + 1}`,
      polygon,
      areaSqm,
      capturedAt: Date.now(),
      method: walk?.method ?? 'drawn',
      meanAccuracyM: walk?.meanAccuracyM ?? 0,
      synced: false,
    };

    const saved = await saveField(field);
    setFields(saved);
    await clearActiveWalk();
    setScreen({ name: 'home' });
    // Saved to disk first, so the upload is an upgrade, not a dependency:
    // with no signal the field waits with its ⟳ showing, and syncs on the
    // next pass.
    void syncFields(saved).then((next) => {
      if (next !== saved) setFields(next);
    });
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

    const updated = await updateJob({
      ...job,
      status: next,
      startedAt: next === 'in_progress' ? Date.now() : job.startedAt,
    });
    setJobs(updated);
    if (signedIn && profile !== null) {
      void syncJobs(updated, profile).then((pulled) => {
        if (pulled !== updated) setJobs(pulled);
      });
    }
  };

  const finishJob = async (amount: number, payment: PaymentMode) => {
    if (completing === null || profile === null) return;
    const rate =
      profile.rates.find((r) => r.serviceCode === completing.serviceCode)?.rate ?? null;

    const updated = await updateJob({
      ...completing,
      status: 'completed',
      completedAt: Date.now(),
      finalAmount: amount,
      paymentMode: payment,
      // Recorded so this job can feed rate guidance for the next farmer.
      quotedRate: completing.quotedRate ?? rate,
    });
    setJobs(updated);
    setCompleting(null);
    if (signedIn) {
      void syncJobs(updated, profile).then((pulled) => {
        if (pulled !== updated) setJobs(pulled);
      });
    }
  };

  /**
   * Getting out of a job.
   *
   * One function for both because only three things differ: who is asking,
   * which server call, and what the local store does afterwards. The shape
   * is the same and so are the two things that matter — ask first, because a
   * mis-tap in a field cancels a harvest, and never move the local job
   * unless the server agreed.
   */
  const exitJob = (job: Job, kind: 'cancel' | 'release') => {
    const cancelling = kind === 'cancel';
    Alert.alert(
      t(cancelling ? 'cancelJobAsk' : 'releaseJobAsk', locale),
      undefined,
      [
        { text: t('keepIt', locale), style: 'cancel' },
        {
          text: t(cancelling ? 'cancelJob' : 'releaseJob', locale),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (signedIn) {
                const outcome = cancelling
                  ? await cancelJobRemote(job.id)
                  : await releaseJobRemote(job.id);

                // Already underway. A button cannot settle that, and
                // pretending it worked would leave him expecting no machine.
                if (outcome === 'too-late') {
                  Alert.alert(t('tooLateToStop', locale));
                  if (profile !== null) void syncJobs(await loadJobs(), profile).then(setJobs);
                  return;
                }
                if (outcome !== 'done') {
                  Alert.alert(t('exitFailed', locale));
                  return;
                }
              }

              const updated = cancelling ? await cancelJob(job.id) : await releaseJob(job.id);
              setJobs(updated);
              if (signedIn && profile !== null) {
                void syncJobs(updated, profile).then(setJobs);
              }
            })();
          },
        },
      ],
    );
  };

  /**
   * Rating the captain.
   *
   * Written locally first, so the stars he tapped stay tapped with no
   * signal, then pushed. The unique (job_id, rater_id) makes the push
   * idempotent, so a retry on the next pass cannot double-count him.
   */
  const rateJobNow = async (job: Job, stars: number) => {
    setJobs(await rateJob(job.id, stars));
    if (signedIn && job.captainId !== null) {
      void pushRating(job.id, job.captainId, stars);
    }
  };

  const claimJob = async (job: Job) => {
    if (profile === null) return;

    // Signed in, the race is real and only the database can judge it.
    if (signedIn) {
      const outcome = await acceptJobRemote(job.id);
      if (outcome === 'accepted' || outcome === 'lost-race') {
        const current = await loadJobs();
        void syncJobs(current, profile).then(setJobs);
        if (outcome === 'lost-race') {
          // Someone else got there first. Not an error he caused.
          Alert.alert(t('alreadyTaken', locale));
        }
        return;
      }
      // Signal or server trouble. The job stays as it is; the next sync
      // pass brings the truth. But silence would read as "the tap did
      // nothing", so say what happened and what to do about it.
      Alert.alert(t('acceptFailed', locale));
      return;
    }

    // Not signed in: the on-device simulation, for the yard demo.
    const { jobs: updated, accepted } = await acceptJob(job.id, profile.fullName);
    setJobs(updated);
    if (accepted === null) {
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
      referenceAreaSqm: null,
      referenceSource: 'tape',
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
              // persistProfile stamps the session's user id and phone onto
              // the profile, which is what creates his row in the database.
              // A fresh install has no profile yet; onboarding, which runs
              // next, creates one and goes through the same stamp.
              if (profile !== null) void persistProfile(profile);
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
                onCancelJob={(job) => exitJob(job, 'cancel')}
                onRateJob={(job, stars) => void rateJobNow(job, stars)}
                onReleaseJob={(job) => exitJob(job, 'release')}
                onEditProfile={() => setScreen({ name: 'onboarding' })}
                onToggleOnline={() => {
                  void (async () => {
                    const goingOnline = !profile.isOnline;
                    // Going online is what puts him on the market, so it is
                    // the moment dispatch needs to know where he stands. A
                    // missing fix means no captains row yet — honest, and
                    // corrected by the next toggle with signal.
                    const fix = goingOnline ? await currentLatLng() : null;
                    await persistProfile({
                      ...profile,
                      isOnline: goingOnline,
                      baseLocation: profile.baseLocation ?? fix,
                      currentLocation:
                        goingOnline && fix !== null
                          ? fix
                          : profile.currentLocation,
                    });
                  })();
                }}
                onOpenFieldTest={() => setScreen({ name: 'test' })}
                onVerifyCaptains={isStaff ? () => setScreen({ name: 'verify' }) : undefined}
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
                fetchGuidance={signedIn ? fetchRateGuidance : undefined}
                onPost={(job) => {
                  void addJob(job).then((added) => {
                    setJobs(added);
                    // The pass that follows inserts the job and offers it
                    // to whoever is eligible, wherever they are.
                    void syncJobs(added, profile).then((pulled) => {
                      if (pulled !== added) setJobs(pulled);
                    });
                  });
                  // Until push notifications arrive with the edge function,
                  // the ping is local — the presentation is the real thing,
                  // so what a captain sees here is what he sees in April.
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

            {screen.name === 'verify' && (
              <VerifyCaptainsScreen
                locale={locale}
                onBack={() => setScreen({ name: 'home' })}
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
            {/* Mounted only while a job is being closed out. Kept mounted,
                its amount field held the *previous* job's number: useState
                runs once, so the prefill never arrived and then never
                cleared. One tap away from recording the wrong money. */}
            {completing !== null && (
              <CompleteJobSheet
                job={completing}
                locale={locale}
                captainRate={
                  profile?.rates.find(
                    (r) => r.serviceCode === completing.serviceCode,
                  )?.rate ?? null
                }
                onComplete={(amount, payment) => void finishJob(amount, payment)}
                onCancel={() => setCompleting(null)}
              />
            )}
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
