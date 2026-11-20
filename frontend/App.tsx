import type { LatLng, WalkResult } from '@zamindara/geo';
import { backFrom, persistable, restoreScreen, type Intent, type Screen } from './src/navigation';
import type { Locale } from '@zamindara/units';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChooseMethodScreen } from './src/ChooseMethodScreen';
import { ConfirmScreen } from './src/ConfirmScreen';
import { DrawScreen } from './src/DrawScreen';
import type { DrawAids } from './src/drawAids';
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
  readAlerts,
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
import { FounderScreen, PhoneBookingForm } from './src/FounderScreen';
import { RouteScreen } from './src/RouteScreen';
import { currentSession } from './src/auth';
import { startAutoRefresh, stopAutoRefresh } from './src/supabase';
import { AppState } from 'react-native';
import { isCaptain, loadProfile, saveProfile, type Profile } from './src/profile';
import { PhoneSetupScreen } from './src/PhoneSetupScreen';
import { currentLatLng } from './src/location';
import {
  acceptJobRemote,
  captainCreateJob,
  captainRetraceField,
  notifyFarmerBooked,
  amIAdmin,
  syncFields,
  cancelJobRemote,
  fetchAppConfig,
  fetchRateGuidance,
  pushRating,
  releaseJobRemote,
  syncJobs,
  syncProfile,
} from './src/sync/sync';
import { uuid } from './src/sync/mapping';
import { sendAccept, type SendOutcome } from './src/sendingAccept';
import { acceptedJobId } from './src/lockScreen';
import type { AppConfig } from './src/version';
import {
  clearActiveWalk,
  loadFields,
  loadUi,
  saveUi,
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

export default function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fields, setFields] = useState<SavedField[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  // Accepts on their way to the server. A ref guards against a second send
  // (button and lock screen at once); the state is what the card shows.
  const sendingRef = useRef(new Set<string>());
  const [sendingAccepts, setSendingAccepts] = useState<ReadonlySet<string>>(new Set());
  const [completing, setCompleting] = useState<Job | null>(null);

  // Android back. One listener for the app's lifetime, reading the latest
  // state through a ref; screens with steps of their own (booking) register
  // after it, and Android asks the newest listener first.
  const backRef = useRef<() => boolean>(() => false);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => backRef.current());
    return () => sub.remove();
  }, []);

  // Not before the saved screen has been read back, or the initial 'home'
  // would overwrite it.
  useEffect(() => {
    if (ready) void saveUi('screen', persistable(screen));
  }, [screen, ready]);
  /**
   * What the server says about versions. Null until read, and null forever
   * with no backend — a version check never stops the app working.
   */
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  // Stage 5: a captain whose work pings would not be seen is told on his home screen.
  const [alertsAtRisk, setAlertsAtRisk] = useState(false);
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
      const storedPlots = await testStore.loadPlots();
      setPlots(storedPlots);
      // Back where he was before the phone killed the app — mid-draw,
      // mid-booking — rather than at home with the work gone.
      setScreen(restoreScreen(await loadUi('screen'), storedPlots.map((p) => p.id)));
      setSkippedAuth((await loadUi('skippedAuth')) === true);
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

  const loud = appConfig?.loudPing ?? false;
  useEffect(() => {
    if (screen.name !== 'home') return;
    void readAlerts(loud).then((r) => setAlertsAtRisk(!r.allowed || !r.alert));
  }, [screen.name, loud]);

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
    aids: DrawAids | null = null,
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
        snapped: aids?.snapped ?? null,
        viewWidthM: aids?.widestViewM ?? null,
      };

      setMeasurements(await testStore.addMeasurement(measurement));
      await clearActiveWalk();
      setScreen({ name: 'testPlot', plotId: intent.plotId });
      return;
    }

    if (intent.kind === 'retrace') {
      // The server measures it from the boundary and re-quotes the job; the
      // next sync brings both back. Needs signal: the job is on the server.
      const ok = await captainRetraceField(intent.jobId, polygon, method === 'walked' ? 'walked' : 'drawn');
      if (!ok) {
        Alert.alert(t('founderFailed', locale));
        return;
      }
      await clearActiveWalk();
      setScreen({ name: 'home' });
      void runSync();
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
  // "The area is wrong" (4.4). Saved on the phone first so a tap with no
  // signal is not lost; the next pass sends it, and the server stamps who
  // and when. Asks first: it cannot be taken back.
  const disputeArea = (job: Job) => {
    Alert.alert(t('areaWrongAsk', locale), undefined, [
      { text: t('cancel', locale), style: 'cancel' },
      {
        text: t('confirm', locale),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const updated = await updateJob({ ...job, areaDisputedAt: Date.now() });
            setJobs(updated);
            if (signedIn && profile !== null) void syncJobs(updated, profile).then(setJobs);
          })();
        },
      },
    ]);
  };

  const setPapersArea = (field: SavedField, sqm: number | null) => editField(field, { papersAreaSqm: sqm });

  const editField = (field: SavedField, patch: Partial<SavedField>) => {
    void (async () => {
      const saved = await saveField({ ...field, ...patch, synced: false });
      setFields(saved);
      if (signedIn) void syncFields(saved).then((next) => next !== saved && setFields(next));
    })();
  };

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

  /**
   * Send an accept, retrying through a dead patch until the offer ends.
   * Shows "sending" meanwhile, never "accepted"; null if already sending.
   */
  const sendAcceptNow = async (jobId: string): Promise<SendOutcome | null> => {
    if (sendingRef.current.has(jobId)) return null;
    sendingRef.current.add(jobId);
    setSendingAccepts(new Set(sendingRef.current));
    try {
      return await sendAccept(jobId, {
        attempt: acceptJobRemote,
        statusOf: async (id) => (await loadJobs()).find((j) => j.id === id)?.status,
        now: Date.now,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      });
    } finally {
      sendingRef.current.delete(jobId);
      setSendingAccepts(new Set(sendingRef.current));
    }
  };

  const claimJob = async (job: Job) => {
    if (profile === null) return;

    // Signed in, the race is real and only the database can judge it.
    if (signedIn) {
      const outcome = await sendAcceptNow(job.id);
      if (outcome === null) return;
      if (outcome === 'lost-race') {
        // Someone else got there first. Not an error he caused.
        Alert.alert(t('alreadyTaken', locale));
      } else if (outcome === 'dropped') {
        // Silence would read as "the tap did nothing". He must not drive out.
        Alert.alert(t('acceptDropped', locale));
      }
      const current = await loadJobs();
      void syncJobs(current, profile).then(setJobs);
      return;
    }

    // Not signed in: the on-device simulation, for the yard demo.
    const { jobs: updated, accepted } = await acceptJob(job.id, profile.fullName);
    setJobs(updated);
    if (accepted === null) {
      Alert.alert(t('alreadyTaken', locale));
    }
  };

  // Read once, and again when his language changes so the note is in it.
  // Not on every sync: a version is not news that arrives mid-harvest.
  useEffect(() => {
    void fetchAppConfig(locale).then(setAppConfig);
  }, [locale, signedIn]);

  // Accept or decline straight from the lock screen, without opening the app.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const jobId = acceptedJobId(response);
      if (jobId === null) return;

      void (async () => {
        // Deliberately not claimJob. That begins `if (profile === null)
        // return`, and a cold start from a notification has no profile
        // yet; it also looked the job up in local storage, and a job
        // offered since the last sync is not there. Either one made the
        // tap do nothing, silently.
        //
        // accept_job needs a job id and a session and decides the rest
        // server-side, so none of that local state is required. The token
        // refreshes itself on the way: supabase-js asks getSession for the
        // access token, and getSession refreshes an expired one.
        const outcome = await sendAcceptNow(jobId);
        if (outcome === null) return;

        if (outcome === 'lost-race') {
          Alert.alert(t('alreadyTaken', locale));
        } else if (outcome === 'dropped') {
          // Never silent. He believes he has the job.
          Alert.alert(t('acceptDropped', locale));
          return;
        }

        // Reconcile whenever we can. If the profile has not loaded yet the
        // next ordinary sync pass picks it up — the job is already his on
        // the server, which is the part that matters.
        const current = await loadJobs();
        if (profile !== null) void syncJobs(current, profile).then(setJobs);
        else setJobs(current);
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
  const gated = !signedIn && !skippedAuth ? true : needsOnboarding;
  backRef.current = () => {
    // On the sign-in or first onboarding screen there is nowhere to go back
    // to; Android's default is right. A sheet (Modal) handles its own back.
    if (!ready || gated) return false;
    const to = backFrom(screen);
    if (to === null) return false;
    setScreen(to);
    return true;
  };

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
            // Undefined until the config is read, and the default is the
            // honest one: with no SMS provider configured, no message is
            // coming. Cached from the last run, so a phone with no signal
            // still shows the right words.
            founderCode={appConfig?.founderCodeSignin}
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
            onSkip={() => {
              setSkippedAuth(true);
              void saveUi('skippedAuth', true);
            }}
          />
        ) : needsOnboarding || screen.name === 'onboarding' ? (
          <OnboardingFlow
            initial={profile}
            onDone={(next) => {
              // A new captain's last onboarding step is setting his phone up to hear pings.
              const firstTime = profile === null || profile.onboardedAt === null;
              void persistProfile(next).then(() => {
                if (firstTime && isCaptain(next)) setScreen({ name: 'phoneSetup' });
              });
            }}
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
                sendingAccepts={sendingAccepts}
                onAdvanceJob={(job) => void advanceJob(job)}
                appConfig={appConfig}
                onGetUpdate={(url) => void Linking.openURL(url)}
                onCancelJob={(job) => exitJob(job, 'cancel')}
                onRateJob={(job, stars) => void rateJobNow(job, stars)}
                onReleaseJob={(job) => exitJob(job, 'release')}
                onDisputeArea={disputeArea}
                onSetPapersArea={setPapersArea}
                onSetAccessNotes={(field, accessNotes) => editField(field, { accessNotes })}
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
                onOpenFounder={isStaff ? () => setScreen({ name: 'founder' }) : undefined}
                onLogPhoneJob={() => setScreen({ name: 'captainBook' })}
                onOpenRoute={() => setScreen({ name: 'route' })}
                onPhoneSetup={() => setScreen({ name: 'phoneSetup' })}
                alertsAtRisk={alertsAtRisk}
                onRetrace={(job) => setScreen({ name: 'choose', intent: { kind: 'retrace', jobId: job.id } })}
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
                draftKey={
                  screen.intent.kind === 'test'
                    ? `test:${screen.intent.plotId}`
                    : screen.intent.kind === 'retrace'
                      ? `retrace:${screen.intent.jobId}`
                      : 'field'
                }
                onDone={(polygon, areaSqm, aids) => {
                  void saveUi('drawCorners', null);
                  void record(screen.intent, 'drawn', polygon, areaSqm, null, aids.dragged, aids);
                }}
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
                  void saveUi('jobDraft', null);
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
                    // Only a "now" job may ring loud (4.8); a later one is an open offer.
                    void pingForJob(job, locale, job.isImmediate && (appConfig?.loudPing ?? false));
                  }
                  setScreen({ name: 'home' });
                }}
                onCancel={() => {
                  void saveUi('jobDraft', null);
                  setScreen({ name: 'home' });
                }}
              />
            )}

            {screen.name === 'captainBook' && profile !== null && (
              <PhoneBookingForm
                locale={locale}
                serviceCodes={profile.rates.map((r) => r.serviceCode)}
                onCreate={async (b) => {
                  const id = await captainCreateJob(b);
                  if (id === null) return false;
                  void notifyFarmerBooked(id);
                  return true;
                }}
                onDone={() => {
                  setScreen({ name: 'home' });
                  void runSync();
                }}
              />
            )}

            {screen.name === 'phoneSetup' && (
              <PhoneSetupScreen locale={locale} loud={loud} onDone={() => setScreen({ name: 'home' })} />
            )}

            {screen.name === 'route' && profile !== null && (
              <RouteScreen
                locale={locale}
                stops={profile.routeStops}
                near={profile.currentLocation ?? profile.baseLocation}
                onDone={(routeStops) => {
                  setScreen({ name: 'home' });
                  if (routeStops !== profile.routeStops) void persistProfile({ ...profile, routeStops });
                }}
              />
            )}

            {screen.name === 'founder' && (
              <FounderScreen locale={locale} onBack={() => setScreen({ name: 'home' })} />
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
