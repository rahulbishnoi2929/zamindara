import type { WalkResult } from '@zamindara/geo';
import type { Locale } from '@zamindara/units';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { StyleSheet, Text, Vibration, View } from 'react-native';
import { AccuracyDot, AreaDisplay, Banner, Button } from './components';
import { t } from './i18n';
import { colors, radius, space, type } from './theme';
import { useBoundaryWalk } from './useBoundaryWalk';

interface Props {
  locale: Locale;
  onDone: (result: WalkResult) => void;
  onCancel: () => void;
}

/**
 * The boundary walk.
 *
 * Designed to be glanceable at arm's length, in sunlight, by someone who may
 * not read comfortably — and mostly not looked at at all, because the phone
 * should be in his pocket while he walks. Hence the vibration cues: they are
 * the actual interface once the walk starts.
 */
export function WalkScreen({ locale, onDone, onCancel }: Props) {
  const walk = useBoundaryWalk();

  // A twenty-minute walk must not be lost to the screen locking.
  useKeepAwake();

  useEffect(() => {
    void walk.requestPermission();
    // Intentionally once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // He is back at the starting corner. He is not looking at the screen, so
  // tell him with the one channel that reaches a pocket.
  useEffect(() => {
    if (walk.nearStart) Vibration.vibrate([0, 200, 120, 200]);
  }, [walk.nearStart]);

  if (walk.permissionDenied) {
    return (
      <View style={s.screen}>
        <View style={s.centered}>
          <Text style={s.message}>{t('needLocation', locale)}</Text>
          <Button
            label={t('grantPermission', locale)}
            onPress={() => void walk.requestPermission()}
          />
          <Button label={t('cancel', locale)} onPress={onCancel} variant="ghost" />
        </View>
      </View>
    );
  }

  const bandLabel =
    walk.current === null
      ? t('waitingForGps', locale)
      : walk.band === 'good'
        ? t('gpsGood', locale)
        : walk.band === 'fair'
          ? t('gpsFair', locale)
          : t('gpsPoor', locale);

  const isWalking = walk.phase === 'walking';
  const isPaused = walk.phase === 'paused';
  const canStart = walk.phase === 'ready' && walk.band !== 'poor';
  const canFinish = walk.points.length >= 8;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <AccuracyDot
          band={walk.band}
          label={bandLabel}
          accuracyM={walk.current?.accuracy}
        />
      </View>

      {walk.recoveredWalk && <Banner text={t('recovered', locale)} tone="info" />}

      {/* Never let him start on red. A walk begun on a weak signal produces a
          number nobody should bill against, and he would not know. */}
      {walk.band === 'poor' && !isWalking && (
        <Banner text={t('gpsPoorWarning', locale)} />
      )}

      <View style={s.body}>
        {walk.preview !== null && walk.points.length >= 8 ? (
          <AreaDisplay sqm={walk.preview.areaSqm} locale={locale} />
        ) : (
          <Text style={s.hint}>{t('startHint', locale)}</Text>
        )}

        <View style={s.stats}>
          <Text style={s.distance}>
            {Math.round(walk.distanceWalkedM)} m {t('walked', locale)}
          </Text>
          {walk.points.length > 0 && (
            <Text style={s.points}>{walk.points.length} points</Text>
          )}
        </View>

        {walk.nearStart && (
          <View style={s.loopPrompt}>
            <Text style={s.loopText}>{t('returnToStart', locale)}</Text>
          </View>
        )}
      </View>

      <View style={s.controls}>
        {walk.phase === 'idle' || walk.phase === 'acquiring' ? (
          <Button label={t('waitingForGps', locale)} onPress={() => {}} disabled />
        ) : walk.phase === 'ready' ? (
          <>
            <Button label={t('start', locale)} onPress={walk.start} disabled={!canStart} />
            <Button label={t('cancel', locale)} onPress={onCancel} variant="ghost" />
          </>
        ) : (
          <>
            <View style={s.row}>
              <Button
                label={isPaused ? t('resume', locale) : t('pause', locale)}
                onPress={isPaused ? walk.resume : walk.pause}
                variant="secondary"
                flex
              />
              <Button
                label={t('finish', locale)}
                onPress={() => {
                  const result = walk.finish();
                  if (result !== null) {
                    Vibration.vibrate(300);
                    onDone(result);
                  }
                }}
                disabled={!canFinish}
                flex
              />
            </View>
            {!canFinish && <Text style={s.smallHint}>{t('needMorePoints', locale)}</Text>}
            <Button
              label={t('cancel', locale)}
              onPress={() => void walk.discard().then(onCancel)}
              variant="ghost"
            />
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: space.md },
  header: { paddingVertical: space.md, alignItems: 'center' },
  centered: { flex: 1, justifyContent: 'center', gap: space.md },
  message: { ...type.body, color: colors.text, textAlign: 'center' },

  body: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.lg },
  hint: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: space.lg,
    lineHeight: 26,
  },
  stats: { alignItems: 'center', gap: space.xs },
  distance: { ...type.title, color: colors.primary },
  points: { ...type.label, color: colors.textMuted },

  loopPrompt: {
    backgroundColor: colors.primary,
    padding: space.md,
    borderRadius: radius.md,
  },
  loopText: { ...type.body, color: colors.textInverse, textAlign: 'center' },

  controls: { gap: space.sm, paddingBottom: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  smallHint: { ...type.label, color: colors.textMuted, textAlign: 'center' },
});
