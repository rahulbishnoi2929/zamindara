import type { Locale } from '@zamindara/units';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './components';
import { t } from './i18n';
import { colors, radius, space, type } from './theme';

interface Props {
  locale: Locale;
  onDraw: () => void;
  onWalk: () => void;
  onCancel: () => void;
}

/**
 * How does he want to measure this field?
 *
 * Drawing is listed first and styled as the primary choice. It is faster, it
 * needs no walking, and — because he is looking at his own field while he does
 * it — he can tell whether the result is right. Walking gives him a number he
 * has no way to judge.
 *
 * Walking stays for what drawing cannot do: imagery too old or too cloudy, a
 * field he cannot pick out from above, or a boundary with nothing visible to
 * trace.
 */
export function ChooseMethodScreen({ locale, onDraw, onWalk, onCancel }: Props) {
  return (
    <View style={s.screen}>
      <Text style={s.question}>{t('howMeasure', locale)}</Text>

      <MethodCard
        icon="🗺️"
        title={t('drawOnMap', locale)}
        hint={t('drawOnMapHint', locale)}
        onPress={onDraw}
        primary
      />

      <MethodCard
        icon="🚶"
        title={t('walkBoundary', locale)}
        hint={t('walkBoundaryHint', locale)}
        onPress={onWalk}
      />

      <View style={s.spacer} />
      <Button label={t('cancel', locale)} onPress={onCancel} variant="ghost" />
    </View>
  );
}

function MethodCard({
  icon,
  title,
  hint,
  onPress,
  primary = false,
}: {
  icon: string;
  title: string;
  hint: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      style={({ pressed }) => [s.card, primary && s.cardPrimary, pressed && s.pressed]}
    >
      <Text style={s.icon}>{icon}</Text>
      <View style={s.cardText}>
        <Text style={[s.cardTitle, primary && s.cardTitlePrimary]}>{title}</Text>
        <Text style={[s.cardHint, primary && s.cardHintPrimary]}>{hint}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: space.md, gap: space.md },
  question: { ...type.title, color: colors.text, marginTop: space.lg },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    padding: space.md,
    minHeight: 96,
  },
  cardPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.85 },
  icon: { fontSize: 40 },
  cardText: { flex: 1, gap: space.xs },
  cardTitle: { ...type.body, fontSize: 21, color: colors.text },
  cardTitlePrimary: { color: colors.textInverse },
  cardHint: { ...type.label, color: colors.textMuted },
  cardHintPrimary: { color: 'rgba(255,255,255,0.85)' },

  spacer: { flex: 1 },
});
