import { SERVICE_BY_CODE } from '@zamindara/catalog';
import { formatAreaShort, type Locale } from '@zamindara/units';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { t } from './i18n';
import { alertOk } from './phoneSetup';
import { savePushToken } from './sync/sync';
import type { Job } from './jobs';

/**
 * The job ping.
 *
 * The most important notification in the product, and it has to behave like
 * an incoming call rather than a WhatsApp message. A captain in April is on a
 * machine, in noise, not looking at his phone — if the ping is polite, he
 * misses the work and the farmer waits another day.
 *
 * So: its own channel at maximum importance, a long insistent vibration,
 * accept and decline reachable without opening the app, and the notification
 * stays until he answers it.
 */

export const JOB_CHANNEL = 'zamindara-job-ping';
/**
 * The same ping without the alarm: used while app_config.loud_ping is off.
 * A separate channel, not a setting on the loud one, because Android fixes a
 * channel's importance when it is created and ignores every later change.
 */
export const JOB_CHANNEL_QUIET = 'zamindara-job-quiet';
export const JOB_CATEGORY = 'zamindara-job';

export const ACTION_ACCEPT = 'accept';
export const ACTION_DECLINE = 'decline';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Create the Android channel and the accept/decline actions.
 *
 * Must run before the first ping — Android fixes a channel's importance at
 * creation time and ignores later changes, so getting this wrong once means
 * every captain on that install has a quiet ping until he reinstalls.
 */
export async function setupNotifications(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(JOB_CHANNEL, {
      name: 'Work requests',
      importance: Notifications.AndroidImportance.MAX,
      // Long and insistent. He is meant to feel this through a pocket while
      // a combine is running.
      vibrationPattern: [0, 700, 300, 700, 300, 700],
      lightColor: '#1B5E20',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      sound: 'default',
      enableVibrate: true,
    });
    await Notifications.setNotificationChannelAsync(JOB_CHANNEL_QUIET, {
      name: 'Work requests (quiet)',
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
      enableVibrate: true,
    });
  }

  // Accept and decline straight from the lock screen. Opening the app to
  // answer costs seconds he does not have.
  await Notifications.setNotificationCategoryAsync(JOB_CATEGORY, [
    { identifier: ACTION_ACCEPT, buttonTitle: 'Accept', options: { opensAppToForeground: true } },
    { identifier: ACTION_DECLINE, buttonTitle: 'Decline', options: { opensAppToForeground: false } },
  ]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Ring for a job.
 *
 * Local for now — until the backend exists there is nothing to push from a
 * server. The presentation is the real thing though, so what a captain sees
 * and feels here is what he will see and feel in April.
 */
export async function pingForJob(job: Job, locale: Locale, loud = false): Promise<string> {
  const service = SERVICE_BY_CODE.get(job.serviceCode);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: service?.name[locale] ?? t('workNearby', locale),
      body: [
        formatAreaShort(job.areaSqm, { locale }),
        job.village,
        job.isImmediate ? t('now', locale) : job.scheduledDate,
      ]
        .filter(Boolean)
        .join(' · '),
      data: { jobId: job.id },
      categoryIdentifier: JOB_CATEGORY,
      sound: 'default',
      ...(loud
        ? {
            vibrate: [0, 700, 300, 700, 300, 700],
            priority: Notifications.AndroidNotificationPriority.MAX,
            // Stays on screen until answered. A ping he swipes away by
            // accident is a job the farmer never hears about.
            sticky: true,
            autoDismiss: false,
          }
        : { priority: Notifications.AndroidNotificationPriority.HIGH }),
    },
    trigger: { channelId: loud ? JOB_CHANNEL : JOB_CHANNEL_QUIET },
  });
}

export async function dismissJobPing(notificationId: string): Promise<void> {
  await Notifications.dismissNotificationAsync(notificationId).catch(() => undefined);
}

/**
 * Is the captain within the hours he said he works?
 *
 * Nothing rings at midnight. A captain woken for a job he was never going to
 * take turns notifications off, and then misses the ones that mattered.
 */
export function withinWorkingHours(
  now: Date,
  startHour: number,
  endHour: number,
): boolean {
  const hour = now.getHours();
  return hour >= startHour && hour < endHour;
}

/**
 * Register this device so the server can ring it.
 *
 * Without this the ping is local only, and a captain on a second phone
 * learns about work by opening the app — the opposite of the promise.
 *
 * Needs an Expo project id, which comes from a free `eas init`. Returns
 * false rather than throwing when it is missing: that is a setup gap, not a
 * runtime error, and the app must keep working without it.
 */
export async function registerPushToken(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!(await requestNotificationPermission())) return false;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (typeof projectId !== 'string' || projectId.length === 0) return false;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return await savePushToken(token);
  } catch {
    // No network, or Expo unreachable. The next sign-in tries again.
    return false;
  }
}

// ---------------------------------------------------------------------------
// Phone setup (Stage 5)
// ---------------------------------------------------------------------------

const PACKAGE = 'com.zamindara.app';
const channelFor = (loud: boolean) => (loud ? JOB_CHANNEL : JOB_CHANNEL_QUIET);

/** What Android will tell us: notifications allowed, and the ping's channel not turned down. */
export async function readAlerts(loud: boolean): Promise<{ allowed: boolean; alert: boolean }> {
  const allowed = (await Notifications.getPermissionsAsync()).granted;
  const channel = Platform.OS === 'android' ? await Notifications.getNotificationChannelAsync(channelFor(loud)) : null;
  return { allowed, alert: alertOk(channel?.importance ?? null) };
}

/** Ask; once Android has stopped asking, open the app's notification page instead. */
export async function fixNotifications(): Promise<void> {
  if (await requestNotificationPermission()) return;
  await openSetting('android.settings.APP_NOTIFICATION_SETTINGS');
}

/** The work-request channel's own page, where he turned it down. */
export const openAlertSetting = (loud: boolean) =>
  openSetting('android.settings.CHANNEL_NOTIFICATION_SETTINGS', channelFor(loud));

/** The battery-optimisation list. Android will not say whether we are on it. */
export const openBatterySetting = () => openSetting('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');

/** The app's info page: on Xiaomi, Vivo, Oppo and Realme, Autostart is reached from here. */
export const openAppInfo = () => Linking.openSettings();

async function openSetting(action: string, channelId?: string): Promise<void> {
  const extras = [{ key: 'android.provider.extra.APP_PACKAGE', value: PACKAGE }];
  if (channelId !== undefined) extras.push({ key: 'android.provider.extra.CHANNEL_ID', value: channelId });
  // Some makers rename or remove a settings page; the app's info page always exists.
  await Linking.sendIntent(action, extras).catch(() => Linking.openSettings());
}

/** A ping in ten seconds, on the channel real pings use now, so he can lock the phone and listen. */
export async function testPing(locale: Locale, loud: boolean): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: t('testPingTitle', locale), body: t('testPingBody', locale), sound: 'default' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10,
      channelId: channelFor(loud),
    },
  });
}
