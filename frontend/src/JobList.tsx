import { SERVICE_BY_CODE } from '@zamindara/catalog';
import { formatAreaShort, type Locale } from '@zamindara/units';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from './components';
import { t, type StringKey } from './i18n';
import type { Job, JobStatus } from './jobs';
import { colors, radius, space, type } from './theme';

const STATUS_KEY: Record<JobStatus, StringKey> = {
  searching: 'statusSearching',
  accepted: 'statusAccepted',
  en_route: 'statusEnRoute',
  in_progress: 'statusInProgress',
  completed: 'statusCompleted',
  cancelled: 'statusCancelled',
};

const STATUS_COLOR: Record<JobStatus, string> = {
  searching: colors.fair,
  accepted: colors.primary,
  en_route: colors.primary,
  in_progress: colors.primary,
  completed: colors.good,
  cancelled: colors.textMuted,
};

interface FarmerCardProps {
  job: Job;
  locale: Locale;
  /** 1-based place in the captain's day, once one has accepted. */
  position?: number | undefined;
  /** Approximate start. Work durations only — see HomeScreen. */
  etaAt?: Date | undefined;
}

/** A job as the farmer who booked it sees it. */
export function FarmerJobCard({ job, locale, position, etaAt }: FarmerCardProps) {
  const service = SERVICE_BY_CODE.get(job.serviceCode);
  return (
    <Card>
      <View style={s.head}>
        <Text style={s.service}>{service?.name[locale] ?? job.serviceCode}</Text>
        <Text style={[s.status, { color: STATUS_COLOR[job.status] }]}>
          {t(STATUS_KEY[job.status], locale)}
        </Text>
      </View>
      <Text style={s.meta}>
        {`${job.fieldName} · ${formatAreaShort(job.areaSqm, { locale })}`}
      </Text>
      {job.captainName !== null && <Text style={s.captain}>{job.captainName}</Text>}

      {/* The question a farmer actually asks is never "is a machine coming"
          but "when does it reach me". */}
      {position !== undefined && etaAt !== undefined && (
        <Text style={s.queue}>
          {`${t('queuePosition', locale)} ${position} · ${t('around', locale)} ${formatClock(etaAt)}`}
        </Text>
      )}
      {job.finalAmount !== null && (
        <Text style={s.amount}>{`₹${Math.round(job.finalAmount)}`}</Text>
      )}
    </Card>
  );
}

interface CaptainCardProps {
  job: Job;
  locale: Locale;
  onAccept: (job: Job) => void;
  onAdvance: (job: Job) => void;
}

/**
 * A job as a captain sees it.
 *
 * An incoming request shows exactly what he needs to decide and nothing
 * else: what work, how big, where, and when. He is deciding in seconds,
 * possibly from a tractor seat.
 *
 * Deliberately not shown before he accepts: the field boundary. That is the
 * farmer's land record, and the RLS policies in the backend enforce the same
 * rule — a captain sees the geometry only once he has the job.
 */
export function CaptainJobCard({ job, locale, onAccept, onAdvance }: CaptainCardProps) {
  const service = SERVICE_BY_CODE.get(job.serviceCode);
  const incoming = job.status === 'searching';

  return (
    <View style={[s.captainCard, incoming && s.captainCardIncoming]}>
      <View style={s.head}>
        <Text style={[s.service, incoming && s.serviceIncoming]}>
          {service?.name[locale] ?? job.serviceCode}
        </Text>
        {!incoming && (
          <Text style={[s.status, { color: STATUS_COLOR[job.status] }]}>
            {t(STATUS_KEY[job.status], locale)}
          </Text>
        )}
      </View>

      <Text style={[s.bigArea, incoming && s.bigAreaIncoming]}>
        {formatAreaShort(job.areaSqm, { locale })}
      </Text>

      <Text style={[s.meta, incoming && s.metaIncoming]}>
        {[job.village, job.isImmediate ? t('now', locale) : job.scheduledDate]
          .filter(Boolean)
          .join(' · ')}
      </Text>

      {incoming ? (
        <View style={s.actions}>
          <Button label={t('accept', locale)} onPress={() => onAccept(job)} flex />
        </View>
      ) : (
        <View style={s.actions}>
          {job.status === 'accepted' && (
            <Button label={t('onMyWay', locale)} onPress={() => onAdvance(job)} flex />
          )}
          {job.status === 'en_route' && (
            <Button label={t('startWork', locale)} onPress={() => onAdvance(job)} flex />
          )}
          {job.status === 'in_progress' && (
            <Button label={t('markComplete', locale)} onPress={() => onAdvance(job)} flex />
          )}
        </View>
      )}
    </View>
  );
}

/** 24-hour clock, which is how a time is read here. */
function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function EmptyJobs({ locale, captain }: { locale: Locale; captain: boolean }) {
  return (
    <Card>
      <Text style={s.empty}>{t(captain ? 'noWorkNearby' : 'noJobs', locale)}</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  service: { ...type.body, fontSize: 19, color: colors.text, flex: 1 },
  serviceIncoming: { color: colors.textInverse },
  status: { ...type.label, fontSize: 13 },
  meta: { ...type.label, fontWeight: '400', color: colors.textMuted, marginTop: space.xs },
  metaIncoming: { color: 'rgba(255,255,255,0.85)' },
  captain: { ...type.body, color: colors.primary, marginTop: space.xs },
  queue: { ...type.body, color: colors.text, marginTop: space.xs },
  amount: { ...type.body, fontSize: 20, color: colors.good, marginTop: space.xs },
  empty: { ...type.body, color: colors.textMuted, lineHeight: 25 },

  captainCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.xs,
  },
  // An incoming request is the loudest thing on the screen, because it has
  // to be answerable in seconds and he is not looking for it.
  captainCardIncoming: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  bigArea: { ...type.hero, fontSize: 30, color: colors.text },
  bigAreaIncoming: { color: colors.textInverse },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
});
