import { SERVICE_BY_CODE } from '@zamindara/catalog';
import { formatAreaShort, toSqm, type Locale } from '@zamindara/units';
import { t } from './i18n';
import type { JobStatus, JobWindow } from './jobs';

/**
 * Founder dispatch (Stage 4.2): what the founder sees of a job, and the
 * message he forwards to a captain. The powers themselves are database
 * functions that refuse anyone who is not staff; this is presentation.
 */

export interface FounderJob {
  id: string;
  status: JobStatus;
  serviceCode: string;
  areaSqm: number;
  isImmediate: boolean;
  scheduledDate: string | null;
  window: JobWindow;
  farmerName: string;
  farmerPhone: string;
  village: string;
  captainName: string | null;
  finalAmount: number | null;
}

const WINDOW_KEY = { morning: 'morning', afternoon: 'afternoon', evening: 'evening', any: 'anyTime' } as const;

/** 919876543210 → "98765 43210", how a number is read out here. */
const spokenPhone = (p: string) => {
  const ten = p.replace(/\D/g, '').slice(-10);
  return `${ten.slice(0, 5)} ${ten.slice(5)}`;
};

/**
 * The WhatsApp message to a captain. Punjabi unless asked otherwise, area
 * in local units as the app shows it, and the farmer's number so the
 * captain can ring him from the message.
 */
export function shareText(job: FounderJob, locale: Locale = 'pa'): string {
  const service = SERVICE_BY_CODE.get(job.serviceCode)?.name[locale] ?? job.serviceCode;
  const when = job.isImmediate
    ? t('now', locale)
    : [job.scheduledDate, t(WINDOW_KEY[job.window], locale)].filter(Boolean).join(' · ');
  return [
    `🌾 ${service}`,
    `📐 ${formatAreaShort(job.areaSqm, { locale })}`,
    `📍 ${job.village}`,
    `🕐 ${when}`,
    `📞 ${job.farmerName} ${spokenPhone(job.farmerPhone)}`,
  ].join('\n');
}

/** What the founder types from a phone call: whole killa and kanal. */
export function areaFromKillaKanal(killa: string, kanal: string): number | null {
  if (killa.trim() === '' && kanal.trim() === '') return null;
  const k = killa.trim() === '' ? 0 : Number(killa);
  const n = kanal.trim() === '' ? 0 : Number(kanal);
  if (!Number.isFinite(k) || !Number.isFinite(n) || k < 0 || n < 0) return null;
  const sqm = toSqm(k, 'killa') + toSqm(n, 'kanal');
  return sqm > 0 ? sqm : null;
}

export function founderJobFromWire(
  row: Record<string, unknown>,
  serviceCode: (serviceId: string) => string | null | undefined,
): FounderJob | null {
  const code = serviceCode(String(row['service_id']));
  if (code === null || code === undefined) return null;
  const farmer = (row['farmer'] ?? {}) as { full_name?: string; phone?: string; village?: string | null };
  const captain = row['captain'] as { profile?: { full_name?: string } | null } | null | undefined;
  return {
    id: String(row['id']),
    status: row['status'] as JobStatus,
    serviceCode: code,
    areaSqm: Number(row['area_sqm']),
    isImmediate: row['is_immediate'] === true,
    scheduledDate: (row['scheduled_date'] as string | null) ?? null,
    window: (row['scheduled_window'] as JobWindow) ?? 'any',
    farmerName: farmer.full_name ?? '',
    farmerPhone: farmer.phone ?? '',
    village: farmer.village ?? '',
    captainName: captain?.profile?.full_name ?? null,
    finalAmount: row['final_amount'] === null || row['final_amount'] === undefined ? null : Number(row['final_amount']),
  };
}
