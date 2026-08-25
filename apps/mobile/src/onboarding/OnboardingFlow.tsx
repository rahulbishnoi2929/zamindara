import { servicesForMachines, type PricingUnit } from '@zamindara/catalog';
import { LOCALES, type Locale } from '@zamindara/units';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, Card } from '../components';
import { t } from '../i18n';
import {
  emptyProfile,
  isCaptain,
  machineCodes,
  type Profile,
  type Role,
  type ServiceRate,
} from '../profile';
import { colors, radius, space, TOUCH_MIN, type } from '../theme';
import { MachineRegistry } from './MachineRegistry';

interface Props {
  initial?: Profile | null;
  onDone: (profile: Profile) => void;
}

type Step = 'language' | 'role' | 'details' | 'machines' | 'rates';

const LOCALE_LABEL: Record<Locale, string> = {
  pa: 'ਪੰਜਾਬੀ',
  hi: 'हिन्दी',
  en: 'English',
};

const UNIT_KEY: Record<PricingUnit, 'perKilla' | 'perHour' | 'perDay' | 'perJob'> = {
  per_killa: 'perKilla',
  per_hour: 'perHour',
  per_day: 'perDay',
  per_job: 'perJob',
};

/**
 * Captain onboarding.
 *
 * Every second of friction here costs a captain, and the founder walks people
 * through this in person during season one — so it is built to be finished in
 * under eight minutes, standing in a yard, by someone who reads slowly.
 *
 * A farmer skips the last two steps entirely. Someone who picks "I do both"
 * does not: a farmer with an idle tractor is supply, and the app should never
 * make him choose a side.
 */
export function OnboardingFlow({ initial, onDone }: Props) {
  const [profile, setProfile] = useState<Profile>(initial ?? emptyProfile());
  const [step, setStep] = useState<Step>(initial?.onboardedAt != null ? 'details' : 'language');

  const locale = profile.language;
  const patch = (fields: Partial<Profile>) => setProfile((p) => ({ ...p, ...fields }));

  // Services follow from machinery. A captain who registers a combine is
  // offered wheat and paddy harvesting; he should never have to say it twice.
  const offered = useMemo(
    () => servicesForMachines(machineCodes(profile)),
    [profile],
  );

  const rateFor = (code: string): ServiceRate | undefined =>
    profile.rates.find((r) => r.serviceCode === code);

  const setRate = (code: string, unit: PricingUnit, text: string) => {
    const value = Number(text.replace(/[^\d.]/g, ''));
    const rate = text.trim() === '' || !Number.isFinite(value) || value <= 0 ? null : value;
    const rest = profile.rates.filter((r) => r.serviceCode !== code);
    patch({ rates: [...rest, { serviceCode: code, rate, unit }] });
  };

  const captain = isCaptain(profile);
  const canLeaveDetails = profile.fullName.trim().length > 0;

  const finish = () => {
    // Drop rates for services he can no longer field, so removing a machine
    // cannot leave a price quoted for work he cannot do.
    const valid = new Set(offered.map((s) => s.code));
    onDone({
      ...profile,
      rates: profile.rates.filter((r) => valid.has(r.serviceCode)),
      onboardedAt: Date.now(),
    });
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {step === 'language' && (
          <>
            <Text style={s.question}>{t('chooseLanguage', locale)}</Text>
            {LOCALES.map((code) => (
              <Pressable
                key={code}
                onPress={() => {
                  patch({ language: code });
                  setStep('role');
                }}
                style={({ pressed }) => [s.bigOption, pressed && s.pressed]}
              >
                <Text style={s.bigOptionText}>{LOCALE_LABEL[code]}</Text>
              </Pressable>
            ))}
          </>
        )}

        {step === 'role' && (
          <>
            <Text style={s.question}>{t('whoAreYou', locale)}</Text>
            <RoleCard
              glyph="🌾"
              label={t('iAmFarmer', locale)}
              onPress={() => {
                patch({ role: 'farmer' });
                setStep('details');
              }}
            />
            <RoleCard
              glyph="🚜"
              label={t('iAmCaptain', locale)}
              onPress={() => {
                patch({ role: 'captain' });
                setStep('details');
              }}
              primary
            />
            {/* Quiet, but present. Many people here are both, and forcing a
                permanent choice would be wrong. */}
            <Pressable
              onPress={() => {
                patch({ role: 'both' });
                setStep('details');
              }}
              style={s.bothLink}
            >
              <Text style={s.bothText}>{t('iAmBoth', locale)}</Text>
            </Pressable>
          </>
        )}

        {step === 'details' && (
          <>
            <Text style={s.question}>{t('yourName', locale)}</Text>
            <TextInput
              style={s.input}
              value={profile.fullName}
              onChangeText={(v) => patch({ fullName: v })}
              placeholder="—"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <Text style={s.label}>{t('yourVillage', locale)}</Text>
            <TextInput
              style={s.input}
              value={profile.village}
              onChangeText={(v) => patch({ village: v })}
              placeholder="—"
              placeholderTextColor={colors.textMuted}
            />
            {/* TODO: replace with a searchable list of Fazilka villages.
                Free text will produce five spellings of the same place. */}
          </>
        )}

        {step === 'machines' && (
          <>
            <Text style={s.question}>{t('yourMachines', locale)}</Text>
            <MachineRegistry
              locale={locale}
              machines={profile.machines}
              onChange={(machines) => patch({ machines })}
            />
          </>
        )}

        {step === 'rates' && (
          <>
            <Text style={s.question}>{t('yourRates', locale)}</Text>
            <Text style={s.hint}>{t('ratesHint', locale)}</Text>

            {offered.length === 0 ? (
              <Card>
                <Text style={s.hint}>{t('noServicesYet', locale)}</Text>
              </Card>
            ) : (
              offered.map((service) => {
                const current = rateFor(service.code);
                return (
                  <View key={service.code} style={s.rateRow}>
                    <Text style={s.rateName}>{service.name[locale]}</Text>
                    <View style={s.rateInputWrap}>
                      <Text style={s.rupee}>₹</Text>
                      <TextInput
                        style={s.rateInput}
                        value={current?.rate == null ? '' : String(current.rate)}
                        onChangeText={(v) => setRate(service.code, service.defaultUnit, v)}
                        keyboardType="number-pad"
                        placeholder="—"
                        placeholderTextColor={colors.textMuted}
                      />
                      <Text style={s.rateUnit}>{t(UNIT_KEY[service.defaultUnit], locale)}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <View style={s.footer}>
        {step === 'details' && (
          <Button
            label={t('next', locale)}
            onPress={() => (captain ? setStep('machines') : finish())}
            disabled={!canLeaveDetails}
          />
        )}
        {step === 'machines' && (
          <View style={s.row}>
            <Button
              label={t('back', locale)}
              onPress={() => setStep('details')}
              variant="secondary"
              flex
            />
            <Button label={t('next', locale)} onPress={() => setStep('rates')} flex />
          </View>
        )}
        {step === 'rates' && (
          <View style={s.row}>
            <Button
              label={t('back', locale)}
              onPress={() => setStep('machines')}
              variant="secondary"
              flex
            />
            <Button label={t('finishSetup', locale)} onPress={finish} flex />
          </View>
        )}
      </View>
    </View>
  );
}

function RoleCard({
  glyph,
  label,
  onPress,
  primary = false,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.roleCard, primary && s.roleCardPrimary, pressed && s.pressed]}
    >
      <Text style={s.roleGlyph}>{glyph}</Text>
      <Text style={[s.roleLabel, primary && s.roleLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.md, gap: space.md, paddingTop: space.xl, paddingBottom: space.xl },
  question: { ...type.title, color: colors.text },
  label: { ...type.label, color: colors.textMuted },
  hint: { ...type.label, fontWeight: '400', color: colors.textMuted, lineHeight: 21 },
  pressed: { opacity: 0.85 },

  bigOption: {
    minHeight: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigOptionText: { ...type.title, color: colors.text },

  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 100,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    padding: space.md,
  },
  roleCardPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleGlyph: { fontSize: 40 },
  roleLabel: { ...type.body, fontSize: 20, color: colors.text, flex: 1 },
  roleLabelPrimary: { color: colors.textInverse },
  bothLink: { alignSelf: 'center', padding: space.md, minHeight: TOUCH_MIN, justifyContent: 'center' },
  bothText: { ...type.body, color: colors.primary, textDecorationLine: 'underline' },

  input: {
    ...type.body,
    fontSize: 22,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    minHeight: 64,
  },

  rateRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.sm,
  },
  rateName: { ...type.body, color: colors.text },
  rateInputWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rupee: { ...type.title, color: colors.textMuted },
  rateInput: {
    ...type.title,
    color: colors.text,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    minWidth: 110,
    minHeight: TOUCH_MIN,
    paddingHorizontal: space.sm,
  },
  rateUnit: { ...type.label, color: colors.textMuted },

  footer: {
    padding: space.md,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', gap: space.sm },
});
