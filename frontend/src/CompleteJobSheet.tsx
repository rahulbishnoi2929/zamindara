import { SERVICE_BY_CODE } from '@zamindara/catalog';
import { quote } from '@zamindara/pricing';
import { formatAreaShort, fromSqm, type Locale } from '@zamindara/units';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from './components';
import { t } from './i18n';
import type { Job, PaymentMode } from './jobs';
import { colors, radius, space, TOUCH_MIN, type } from './theme';

interface Props {
  job: Job | null;
  locale: Locale;
  /** The captain's own rate for this work, if he set one. */
  captainRate: number | null;
  onComplete: (amount: number, payment: PaymentMode) => void;
  onCancel: () => void;
}

const MODES: Array<{ value: PaymentMode; key: 'payCash' | 'payUpi' | 'payPending' }> = [
  { value: 'cash', key: 'payCash' },
  { value: 'upi', key: 'payUpi' },
  { value: 'pending', key: 'payPending' },
];

/**
 * Finishing a job.
 *
 * v1 takes no commission, so no money moves through the app — the two of them
 * settle in cash or by UPI exactly as they do today. What the app records is
 * *what was agreed*, because that is the number a dispute turns on, and
 * because a season of real amounts is what makes rate guidance honest.
 *
 * The amount is prefilled from his own rate and the field's area, so the
 * common case is one tap. He can overwrite it — the field is what happened,
 * not what we predicted.
 */
export function CompleteJobSheet({
  job,
  locale,
  captainRate,
  onComplete,
  onCancel,
}: Props) {
  const suggested = useMemo(() => {
    if (job === null || captainRate === null) return null;
    const q = quote({
      areaSqm: job.areaSqm,
      rate: captainRate,
      unit: job.quotedUnit,
      distanceKm: job.distanceKm ?? 0,
      travelRatePerKm: 0,
    });
    return q.total;
  }, [job, captainRate]);

  const [amount, setAmount] = useState<string>(
    suggested === null ? '' : String(Math.round(suggested)),
  );
  const [payment, setPayment] = useState<PaymentMode>('cash');

  if (job === null) return null;

  const service = SERVICE_BY_CODE.get(job.serviceCode);
  const value = Number(amount.replace(/[^\d.]/g, ''));
  const valid = Number.isFinite(value) && value > 0;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={s.title}>{service?.name[locale] ?? job.serviceCode}</Text>
          <Text style={s.meta}>
            {`${job.fieldName} · ${formatAreaShort(job.areaSqm, { locale })}`}
          </Text>

          <Text style={s.label}>{t('amountTaken', locale)}</Text>
          <View style={s.amountRow}>
            <Text style={s.rupee}>₹</Text>
            <TextInput
              style={s.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
          </View>

          {suggested !== null && (
            <Text style={s.suggestion}>
              {`${Math.round(fromSqm(job.areaSqm, 'killa') * 100) / 100} × ₹${captainRate}`}
            </Text>
          )}

          <View style={s.chips}>
            {MODES.map((mode) => (
              <Pressable
                key={mode.value}
                onPress={() => setPayment(mode.value)}
                style={[s.chip, payment === mode.value && s.chipOn]}
              >
                <Text style={[s.chipText, payment === mode.value && s.chipTextOn]}>
                  {t(mode.key, locale)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={s.actions}>
            <Button label={t('cancel', locale)} onPress={onCancel} variant="ghost" flex />
            <Button
              label={t('markComplete', locale)}
              onPress={() => onComplete(value, payment)}
              disabled={!valid}
              flex
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.md,
    paddingBottom: space.xl,
    gap: space.sm,
  },
  title: { ...type.title, color: colors.text },
  meta: { ...type.label, fontWeight: '400', color: colors.textMuted },
  label: { ...type.label, color: colors.textMuted, marginTop: space.sm },

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rupee: { ...type.hero, fontSize: 34, color: colors.textMuted },
  amountInput: {
    ...type.hero,
    fontSize: 34,
    color: colors.text,
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    minHeight: 68,
  },
  suggestion: { ...type.label, fontWeight: '400', color: colors.textMuted },

  chips: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  chip: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: TOUCH_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.label, color: colors.text },
  chipTextOn: { color: colors.textInverse },

  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
});
