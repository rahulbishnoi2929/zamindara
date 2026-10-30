import { SERVICE_BY_CODE } from '@zamindara/catalog';
import { formatAreaShort, type Locale } from '@zamindara/units';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { t } from './i18n';
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
export async function pingForJob(job: Job, locale: Locale): Promise<string> {
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
      vibrate: [0, 700, 300, 700, 300, 700],
      priority: Notifications.AndroidNotificationPriority.MAX,
      // Stays on screen until answered. A ping he swipes away by accident
      // is a job the farmer never hears about.
      sticky: true,
      autoDismiss: false,
    },
    trigger: null,
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
