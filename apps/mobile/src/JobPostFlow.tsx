import { SERVICE_BY_CODE, servicesForMonth, type Service } from '@zamindara/catalog';
import { quote, rateGuidance } from '@zamindara/pricing';
import type { Locale } from '@zamindara/units';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AreaDisplay, Button, Card } from './components';
import { t } from './i18n';
import { completedRates, type Job, type JobWindow } from './jobs';
import type { SavedField } from './storage';
import { colors, radius, space, type } from './theme';

interface Props {
  locale: Locale;
  fields: SavedField[];
  history: readonly Job[];
  village: string;
  onPost: (job: Job) => void;
  onCancel: () => void;
}

type Step = 'field' | 'service' | 'when' | 'review';

const WINDOWS: Array<{
  value: JobWindow;
  key: 'morning' | 'afternoon' | 'evening' | 'anyTime';
}> = [
  { value: 'morning', key: 'morning' },
  { value: 'afternoon', key: 'afternoon' },
  { value: 'evening', key: 'evening' },
  { value: 'any', key: 'anyTime' },
];

/**
 * Posting a job.
 *
 *   field -> work -> when -> review
 *
 * Field comes first, and it is the shortest step because his fields are
 * already measured. Every booking after the first is two taps to get here,
 * which is the retention argument for measuring once and keeping it forever.
 */
export function JobPostFlow({
  locale,
  fields,
  history,
  village,
  onPost,
  onCancel,
}: Props) {
  const [step, setStep] = useState<Step>(fields.length === 1 ? 'service' : 'field');
  const [fieldId, setFieldId] = useState<string | null>(fields[0]?.id ?? null);
  const [serviceCode, setServiceCode] = useState<string | null>(null);
  const [timing, setTiming] = useState<'now' | 'today' | 'tomorrow'>('today');
  const [window, setWindow] = useState<JobWindow>('any');

  const field = fields.find((f) => f.id === fieldId) ?? null;
  const service = serviceCode === null ? null : SERVICE_BY_CODE.get(serviceCode) ?? null;

  // Ordered for the month he is actually in. In April harvesting is first;
  // in November, sowing. A fixed order would bury the one thing he urgently
  // needs three rows down.
  const services = useMemo(() => servicesForMonth(new Date().getMonth() + 1), []);

  // Guidance comes from what has actually been paid nearby, never from a
  // number the platform invented.
  const guidance = useMemo(
    () => (service === null ? null : rateGuidance(completedRates(history, service.code))),
    [history, service],
  );

  const estimate = useMemo(() => {
    if (field === null || service === null || guidance === null) return null;
    const mid = (guidance.low + guidance.high) / 2;
    return quote({
      areaSqm: field.areaSqm,
      rate: mid,
      unit: service.defaultUnit,
      // Travel is unknown until a captain accepts, so the estimate covers
      // the work alone and the note below says so.
      distanceKm: 0,
      travelRatePerKm: 0,
    });
  }, [field, service, guidance]);

  const post = () => {
    if (field === null || service === null) return;
    const scheduled = new Date();
    if (timing === 'tomorrow') scheduled.setDate(scheduled.getDate() + 1);

    onPost({
      id: String(Date.now()),
      fieldId: field.id,
      fieldName: field.name,
      village,
      serviceCode: service.code,
      // Snapshotted: re-measuring the field later must not move this job.
      areaSqm: field.areaSqm,
      status: 'searching',
      isImmediate: timing === 'now',
      scheduledDate: timing === 'now' ? null : scheduled.toISOString().slice(0, 10),
      window,
      quotedRate: null,
      quotedUnit: service.defaultUnit,
      quotedSubtotal: null,
      travelCharge: 0,
      quotedTotal: null,
      captainName: null,
      distanceKm: null,
      finalAmount: null,
      paymentMode: null,
      notes: '',
      createdAt: Date.now(),
      acceptedAt: null,
      startedAt: null,
      completedAt: null,
    });
  };

  if (fields.length === 0) {
    return (
      <View style={s.screen}>
        <View style={s.body}>
          <Card>
            <Text style={s.empty}>{t('noFieldsToBook', locale)}</Text>
          </Card>
        </View>
        <View style={s.footer}>
          <Button label={t('back', locale)} onPress={onCancel} variant="secondary" />
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.body}>
        {step === 'field' && (
          <>
            <Text style={s.question}>{t('pickField', locale)}</Text>
            {fields.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => {
                  setFieldId(f.id);
                  setStep('service');
                }}
                style={({ pressed }) => [s.option, pressed && s.pressed]}
              >
                <Text style={s.optionName}>{f.name}</Text>
                <AreaDisplay sqm={f.areaSqm} locale={locale} compact />
              </Pressable>
            ))}
          </>
        )}

        {step === 'service' && (
          <>
            <Text style={s.question}>{t('pickWork', locale)}</Text>
            <View style={s.grid}>
              {services.map((item: Service) => (
                <Pressable
                  key={item.code}
                  onPress={() => {
                    setServiceCode(item.code);
                    setStep('when');
                  }}
                  style={({ pressed }) => [s.tile, pressed && s.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={item.name[locale]}
                >
                  <Text style={s.tileName}>{item.name[locale]}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {step === 'when' && (
          <>
            <Text style={s.question}>{t('whenWork', locale)}</Text>
            <View style={s.chips}>
              {(['now', 'today', 'tomorrow'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setTiming(option)}
                  style={[s.chip, timing === option && s.chipOn]}
                >
                  <Text style={[s.chipText, timing === option && s.chipTextOn]}>
                    {t(option, locale)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {timing !== 'now' && (
              <View style={s.chips}>
                {WINDOWS.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => setWindow(option.value)}
                    style={[s.chip, window === option.value && s.chipOn]}
                  >
                    <Text style={[s.chipText, window === option.value && s.chipTextOn]}>
                      {t(option.key, locale)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}

        {step === 'review' && field !== null && service !== null && (
          <>
            <Card>
              <Text style={s.reviewService}>{service.name[locale]}</Text>
              <Text style={s.reviewField}>{field.name}</Text>
              <AreaDisplay sqm={field.areaSqm} locale={locale} />
            </Card>

            <Card>
              {guidance === null ? (
                // No local history yet. Inventing a "typical rate" from
                // nothing would anchor him on a number we made up.
                <Text style={s.noRate}>{t('noRateData', locale)}</Text>
              ) : (
                <>
                  <Text style={s.label}>{t('typicalRate', locale)}</Text>
                  <Text style={s.rateRange}>
                    {`₹${guidance.low} – ₹${guidance.high} ${t('perKilla', locale)}`}
                  </Text>
                  {estimate?.subtotal != null && (
                    <>
                      <Text style={s.label}>{t('approxTotal', locale)}</Text>
                      <Text style={s.total}>
                        {`₹${Math.round(estimate.subtotal)}`}
                      </Text>
                    </>
                  )}
                </>
              )}
              {/* Always visible. Over-promising a price is how trust dies. */}
              <Text style={s.approxNote}>{t('approxNote', locale)}</Text>
            </Card>
          </>
        )}
      </ScrollView>

      <View style={s.footer}>
        {step === 'field' && (
          <Button label={t('cancel', locale)} onPress={onCancel} variant="ghost" />
        )}

        {step === 'service' && (
          <Button
            label={t('back', locale)}
            onPress={() => (fields.length === 1 ? onCancel() : setStep('field'))}
            variant="secondary"
          />
        )}

        {step === 'when' && (
          <View style={s.row}>
            <Button
              label={t('back', locale)}
              onPress={() => setStep('service')}
              variant="secondary"
              flex
            />
            <Button label={t('next', locale)} onPress={() => setStep('review')} flex />
          </View>
        )}

        {step === 'review' && (
          <View style={s.row}>
            <Button
              label={t('back', locale)}
              onPress={() => setStep('when')}
              variant="secondary"
              flex
            />
            <Button label={t('postJob', locale)} onPress={post} flex />
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.md, gap: space.md, paddingTop: space.lg, paddingBottom: space.xl },
  question: { ...type.title, color: colors.text },
  label: { ...type.label, color: colors.textMuted },
  empty: { ...type.body, color: colors.textMuted, lineHeight: 25 },
  pressed: { opacity: 0.85 },

  option: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    minHeight: 76,
    gap: space.xs,
  },
  optionName: { ...type.body, color: colors.text },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    width: '48%',
    minHeight: 84,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
  },
  tileName: { ...type.body, fontSize: 17, color: colors.text, textAlign: 'center' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 56,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.body, color: colors.text },
  chipTextOn: { color: colors.textInverse },

  reviewService: { ...type.title, color: colors.text },
  reviewField: { ...type.label, color: colors.textMuted, marginBottom: space.sm },
  noRate: { ...type.body, color: colors.text, lineHeight: 25 },
  rateRange: { ...type.body, fontSize: 20, color: colors.text, marginBottom: space.sm },
  total: { ...type.hero, fontSize: 34, color: colors.primary },
  approxNote: {
    ...type.label,
    fontWeight: '400',
    color: colors.textMuted,
    marginTop: space.sm,
    lineHeight: 20,
  },

  footer: {
    padding: space.md,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', gap: space.sm },
});
