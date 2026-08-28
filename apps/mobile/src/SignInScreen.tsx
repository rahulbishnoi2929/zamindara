import type { Locale } from '@zamindara/units';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { requestCode, verifyCode, type AuthOutcome } from './auth';
import { Banner, Button } from './components';
import { t, type StringKey } from './i18n';
import { isBackendConfigured } from './supabase';
import { colors, radius, space, TOUCH_MIN, type } from './theme';

interface Props {
  locale: Locale;
  onSignedIn: (phone: string) => void;
  /** Measuring fields works without an account. Booking work does not. */
  onSkip: () => void;
}

const ERROR_KEY: Record<string, StringKey> = {
  'bad-number': 'errBadNumber',
  'wrong-code': 'errWrongCode',
  'rate-limited': 'errRateLimited',
  offline: 'errOffline',
  'no-backend': 'offlineModeNote',
  unknown: 'errOffline',
};

/**
 * Signing in with a phone number and one code.
 *
 * No password, because there is nothing to remember and nothing to lose. The
 * number he types here is the same one a farmer will ring when the combine is
 * late, which is why the hint says so — it makes the number feel like his
 * business line rather than a form field.
 *
 * Skipping is allowed on purpose. Field measurement works entirely offline,
 * and a captain standing in a yard with no signal should still be able to see
 * what the app does before committing to an account.
 */
export function SignInScreen({ locale, onSignedIn, onSkip }: Props) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<StringKey | null>(null);
  const codeInput = useRef<TextInput>(null);

  const handle = (result: AuthOutcome, onOk: () => void) => {
    if (result.ok) {
      setError(null);
      onOk();
      return;
    }
    setError(ERROR_KEY[result.reason] ?? 'errOffline');
  };

  const send = async () => {
    setBusy(true);
    handle(await requestCode(phone), () => {
      setStage('code');
      setTimeout(() => codeInput.current?.focus(), 250);
    });
    setBusy(false);
  };

  const check = async () => {
    setBusy(true);
    handle(await verifyCode(phone, code), () => onSignedIn(phone));
    setBusy(false);
  };

  const tenDigits = phone.replace(/\D/g, '').length >= 10;

  return (
    <View style={s.screen}>
      <View style={s.body}>
        <Text style={s.brand}>{t('appName', locale)}</Text>

        {!isBackendConfigured() && (
          <Banner text={t('offlineModeNote', locale)} tone="info" />
        )}

        {stage === 'phone' ? (
          <>
            <Text style={s.question}>{t('yourPhone', locale)}</Text>
            <View style={s.phoneRow}>
              <Text style={s.dialCode}>+91</Text>
              <TextInput
                style={s.phoneInput}
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  setError(null);
                }}
                keyboardType="phone-pad"
                maxLength={13}
                placeholder="—"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
            </View>
            <Text style={s.hint}>{t('phoneHint', locale)}</Text>
          </>
        ) : (
          <>
            <Text style={s.question}>{t('enterCode', locale)}</Text>
            <Text style={s.hint}>
              {`${t('codeSentTo', locale)} +91 ${phone.replace(/\D/g, '').slice(-10)}`}
            </Text>
            <TextInput
              ref={codeInput}
              style={s.codeInput}
              value={code}
              onChangeText={(v) => {
                setCode(v);
                setError(null);
              }}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="——————"
              placeholderTextColor={colors.border}
              // Lets Android drop the code straight in from the SMS.
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
            />
          </>
        )}

        {error !== null && <Banner text={t(error, locale)} />}
      </View>

      <View style={s.footer}>
        {busy ? (
          <View style={s.busy}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : stage === 'phone' ? (
          <Button
            label={t('sendCode', locale)}
            onPress={() => void send()}
            disabled={!tenDigits}
          />
        ) : (
          <>
            <Button
              label={t('verify', locale)}
              onPress={() => void check()}
              disabled={code.trim().length < 4}
            />
            <View style={s.row}>
              <Button
                label={t('changeNumber', locale)}
                onPress={() => {
                  setStage('phone');
                  setCode('');
                  setError(null);
                }}
                variant="ghost"
                flex
              />
              <Button label={t('resend', locale)} onPress={() => void send()} variant="ghost" flex />
            </View>
          </>
        )}

        <Pressable onPress={onSkip} style={s.skip} hitSlop={12}>
          <Text style={s.skipText}>{t('continueOffline', locale)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: space.md, paddingTop: space.xl, gap: space.md },
  brand: { ...type.hero, fontSize: 36, color: colors.primary },
  question: { ...type.title, color: colors.text, marginTop: space.lg },
  hint: { ...type.label, fontWeight: '400', color: colors.textMuted, lineHeight: 21 },

  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
  },
  dialCode: { ...type.hero, fontSize: 26, color: colors.textMuted },
  phoneInput: { ...type.hero, fontSize: 28, color: colors.text, flex: 1, minHeight: 72 },

  codeInput: {
    ...type.hero,
    fontSize: 40,
    letterSpacing: 10,
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    minHeight: 84,
  },

  footer: {
    padding: space.md,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  busy: { minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: space.sm },
  skip: { alignSelf: 'center', paddingVertical: space.sm },
  skipText: { ...type.label, color: colors.textMuted, textDecorationLine: 'underline' },
});
