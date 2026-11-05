import { SERVICE_BY_CODE } from '@zamindara/catalog';
import { formatAreaShort, type Locale } from '@zamindara/units';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from './components';
import { t, type StringKey } from './i18n';
import {
  canCancel,
  canRelease,
  ratingAsk,
  searchState,
  type Job,
  type JobStatus,
} from './jobs';
import { colors, radius, space, TOUCH_MIN, type } from './theme';

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
  /** Withdraw the job. Absent where there is nothing to withdraw. */
  onCancel?: ((job: Job) => void) | undefined;
  /** Rate the captain who did it. */
  onRate?: ((job: Job, stars: number) => void) | undefined;
}

/** A job as the farmer who booked it sees it. */
export function FarmerJobCard({
  job,
  locale,
  position,
  etaAt,
  onCancel,
  onRate,
}: FarmerCardProps) {
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
      <SearchNote job={job} locale={locale} />

      {/* The question a farmer actually asks is never "is a machine coming"
          but "when does it reach me". */}
      {position !== undefined && etaAt !== undefined && (
        <Text style={s.queue}>
          {`${t('queuePosition', locale)} ${position} · ${t('around', locale)} ${formatClock(etaAt)}`}
        </Text>
      )}
      {/* A captain 30 km out is paid for the drive, so the total he accepted
          at is not the estimate the farmer posted against. Showing the two
          halves is the difference between a priced job and a price rise. */}
      {job.travelCharge > 0 && job.quotedSubtotal !== null && (
        <Text style={s.breakdown}>
          {`${t('workCharge', locale)} ₹${Math.round(job.quotedSubtotal)}`
            + `  ·  ${t('travelFrom', locale)} ₹${Math.round(job.travelCharge)}`
            + (job.quotedTotal === null ? '' : `  =  ₹${Math.round(job.quotedTotal)}`)}
        </Text>
      )}

      {job.finalAmount !== null && (
        <Text style={s.amount}>{`₹${Math.round(job.finalAmount)}`}</Text>
      )}

      {/* Asked once, on the card, right after the work is done — which is
          the only moment he actually remembers it. Until something could
          write one, rating was 30% of a captain's match score and the same
          constant 3.5 for every captain in the district. */}
      {job.myRating !== null ? (
        <Text style={s.rated}>{`${t('yourRating', locale)}  ${stars(job.myRating)}`}</Text>
      ) : (
        onRate !== undefined &&
        ratingAsk(job, false) !== null && (
          <View style={s.rateRow}>
            <Text style={s.rateAsk}>{t('howWasWork', locale)}</Text>
            <View style={s.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => onRate(job, n)} style={s.star}>
                  <Text style={s.starGlyph}>☆</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )
      )}

      {/* Quiet, and last. He is here to watch a job, not to end one — but
          with no way out at all, a job posted by mistake was re-offered to
          captains on every sync pass until someone drove to an empty field. */}
      {onCancel !== undefined && canCancel(job) && (
        <Pressable onPress={() => onCancel(job)} style={s.exit}>
          <Text style={s.exitText}>{t('cancelJob', locale)}</Text>
        </Pressable>
      )}
    </Card>
  );
}

/**
 * While a job is searching, say whether anyone was actually asked. A posted
 * job with no captain online yet looks identical to one being considered,
 * and the farmer is standing in a field deciding whether to ring someone.
 */
function SearchNote({ job, locale }: { job: Job; locale: Locale }) {
  const state = searchState(job);
  if (state === null || state.kind === 'unknown') return null;
  return (
    <Text style={s.searchNote}>
      {state.kind === 'nobody-yet'
        ? t('searchNobodyYet', locale)
        : `${state.count} ${t('searchAsked', locale)}`}
    </Text>
  );
}

interface CaptainCardProps {
  job: Job;
  locale: Locale;
  onAccept: (job: Job) => void;
  onAdvance: (job: Job) => void;
  /** Hand the job back, so it can reach another captain. */
  onRelease?: ((job: Job) => void) | undefined;
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
export function CaptainJobCard({
  job,
  locale,
  onAccept,
  onAdvance,
  onRelease,
}: CaptainCardProps) {
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

      {/* A combine breaks. Without this the farmer waited on a machine that
          was never coming, and the job could never reach anyone else. */}
      {onRelease !== undefined && canRelease(job) && (
        <Pressable onPress={() => onRelease(job)} style={s.exit}>
          <Text style={s.exitText}>{t('releaseJob', locale)}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Filled stars out of five. A glyph, so there is no icon font to ship. */
const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(5 - n);

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
  searchNote: { ...type.body, color: colors.textMuted, marginTop: space.xs },

  // Deliberately not a Button. Ending a job is never the thing he came to
  // do, and a full-width button next to "on my way" is a mis-tap waiting
  // for a bumpy tractor seat.
  breakdown: { ...type.label, fontWeight: '400', color: colors.textMuted, marginTop: space.xs },
  rateRow: { marginTop: space.sm },
  rateAsk: { ...type.label, color: colors.textMuted },
  starRow: { flexDirection: 'row', marginTop: space.xs },
  // Each star is a full touch target. Five of them in a row is the classic
  // way to make a farmer in gloves hit the wrong one.
  star: {
    minWidth: TOUCH_MIN,
    minHeight: TOUCH_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starGlyph: { fontSize: 32, color: colors.fair },
  rated: { ...type.label, color: colors.textMuted, marginTop: space.sm },

  exit: { alignSelf: 'flex-start', paddingVertical: space.sm, minHeight: TOUCH_MIN },
  exitText: { ...type.label, color: colors.textMuted },
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
