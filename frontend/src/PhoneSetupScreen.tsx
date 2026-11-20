import type { Locale } from '@zamindara/units';
import { useCallback, useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from './components';
import { t } from './i18n';
import {
  fixNotifications,
  openAlertSetting,
  openAppInfo,
  openBatterySetting,
  readAlerts,
  testPing,
} from './notifications';
import { NO_TICKS, type SetupTicks } from './phoneSetup';
import { loadUi, saveUi } from './storage';
import { colors, space, type } from './theme';

interface Props {
  locale: Locale;
  /** The founder's loud-ping switch: the test rings on the channel real pings use now. */
  loud: boolean;
  onDone: () => void;
}

/**
 * Phone setup (Stage 5): the settings that decide whether a work ping is
 * heard. Two Android will report, two he ticks himself, then a test ping.
 * Re-reads whenever he comes back from a settings page.
 */
export function PhoneSetupScreen({ locale, loud, onDone }: Props) {
  const [alerts, setAlerts] = useState<{ allowed: boolean; alert: boolean } | null>(null);
  const [ticks, setTicks] = useState<SetupTicks>(NO_TICKS);
  const [test, setTest] = useState<'idle' | 'waiting' | 'missed'>('idle');

  const reread = useCallback(() => void readAlerts(loud).then(setAlerts), [loud]);

  useEffect(() => {
    reread();
    void loadUi('phoneSetup').then((v) => {
      if (v !== null && typeof v === 'object') setTicks({ ...NO_TICKS, ...(v as Partial<SetupTicks>) });
    });
    const sub = AppState.addEventListener('change', (s) => s === 'active' && reread());
    return () => sub.remove();
  }, [reread]);

  const tick = (key: keyof SetupTicks, value = true) => {
    const next = { ...ticks, [key]: value };
    setTicks(next);
    void saveUi('phoneSetup', next);
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.title}>{t('phoneSetup', locale)}</Text>
        <Text style={s.muted}>{t('phoneSetupHint', locale)}</Text>

        <Row ok={alerts?.allowed} label={t('setupNotifications', locale)}>
          <Button label={t('setupFix', locale)} onPress={() => void fixNotifications()} variant="secondary" />
        </Row>
        <Row ok={alerts?.alert} label={t('setupAlert', locale)}>
          <Button label={t('setupFix', locale)} onPress={() => void openAlertSetting(loud)} variant="secondary" />
        </Row>
        <Row ok={ticks.battery} label={t('setupBattery', locale)} hint={t('setupBatteryHint', locale)}>
          <View style={s.row}>
            <Button label={t('setupOpen', locale)} onPress={() => void openBatterySetting()} variant="secondary" flex />
            <Button label={t('setupTicked', locale)} onPress={() => tick('battery')} variant="ghost" flex />
          </View>
        </Row>
        <Row ok={ticks.autostart} label={t('setupAutostart', locale)} hint={t('setupAutostartHint', locale)}>
          <View style={s.row}>
            <Button label={t('setupOpen', locale)} onPress={() => void openAppInfo()} variant="secondary" flex />
            <Button label={t('setupTicked', locale)} onPress={() => tick('autostart')} variant="ghost" flex />
          </View>
        </Row>

        <Card>
          <Text style={s.label}>{ticks.heard ? `✓ ${t('heardIt', locale)}` : t('testPing', locale)}</Text>
          {test === 'waiting' ? (
            <>
              <Text style={s.muted}>{t('testPingWait', locale)}</Text>
              <View style={s.row}>
                <Button
                  label={t('heardIt', locale)}
                  onPress={() => {
                    tick('heard');
                    setTest('idle');
                  }}
                  flex
                />
                <Button
                  label={t('didNotHear', locale)}
                  onPress={() => {
                    tick('heard', false);
                    setTest('missed');
                  }}
                  variant="ghost"
                  flex
                />
              </View>
            </>
          ) : (
            <>
              {test === 'missed' && <Text style={s.warn}>{t('didNotHearHint', locale)}</Text>}
              <Button
                label={t('testPing', locale)}
                onPress={() => void testPing(locale, loud).then(() => setTest('waiting'))}
                variant="secondary"
              />
            </>
          )}
        </Card>
      </ScrollView>
      <View style={s.footer}>
        <Button label={t('done', locale)} onPress={onDone} />
      </View>
    </View>
  );
}

/** One setting: ✓ when fine (nothing more to do), ✗ or ☐ with its buttons otherwise. Undefined: still reading. */
function Row({ ok, label, hint, children }: { ok: boolean | undefined; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card>
      <Text style={s.label}>
        {ok === true ? '✓' : ok === false ? '✗' : '…'} {label}
      </Text>
      {ok === false && (
        <>
          {hint !== undefined && <Text style={s.muted}>{hint}</Text>}
          {children}
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.md, gap: space.md },
  title: { ...type.title, color: colors.text },
  label: { ...type.body, color: colors.text, marginBottom: space.sm },
  muted: { ...type.label, fontWeight: '400', color: colors.textMuted, marginBottom: space.sm },
  warn: { ...type.label, color: colors.text, marginBottom: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  footer: { padding: space.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
