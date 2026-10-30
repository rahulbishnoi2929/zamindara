import { formatArea, type DisplayChain, type Locale } from '@zamindara/units';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { accuracyColor, colors, radius, space, TOUCH_MIN, type } from './theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  flex?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  flex = false,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        s.button,
        variant === 'primary' && s.buttonPrimary,
        variant === 'secondary' && s.buttonSecondary,
        variant === 'ghost' && s.buttonGhost,
        flex && { flex: 1 },
        disabled && s.buttonDisabled,
        pressed && !disabled && s.buttonPressed,
      ]}
    >
      <Text
        style={[
          s.buttonLabel,
          variant === 'secondary' && { color: colors.primary },
          variant === 'ghost' && { color: colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The green/amber/red signal dot.
 *
 * Colour carries the meaning, not the text, because the person reading it
 * may not read comfortably — and because at arm's length in sunlight a
 * coloured disc is legible when 15 px of Gurmukhi is not.
 */
export function AccuracyDot({
  band,
  label,
  accuracyM,
}: {
  band: 'good' | 'fair' | 'poor';
  label: string;
  accuracyM?: number | undefined;
}) {
  return (
    <View style={s.accuracyRow}>
      <View style={[s.dot, { backgroundColor: accuracyColor(band) }]} />
      <Text style={s.accuracyLabel}>{label}</Text>
      {accuracyM !== undefined && (
        <Text style={s.accuracyValue}>±{Math.round(accuracyM)} m</Text>
      )}
    </View>
  );
}

/**
 * The area readout — the single most important number in the app.
 *
 * Always compound (2 killa 3 kanal 8 marla), never a decimal. A farmer has
 * never seen "2.4 killa" on a document, and a number he does not recognise is
 * a number he will not accept as the basis for a price.
 */
export function AreaDisplay({
  sqm,
  locale,
  chain = 'killa',
  compact = false,
}: {
  sqm: number;
  locale: Locale;
  chain?: DisplayChain;
  compact?: boolean;
}) {
  return (
    <Text
      style={compact ? s.areaCompact : s.areaHero}
      numberOfLines={2}
      adjustsFontSizeToFit
    >
      {formatArea(sqm, { locale, chain })}
    </Text>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

export function Banner({
  text,
  tone = 'warn',
}: {
  text: string;
  tone?: 'warn' | 'info';
}) {
  return (
    <View style={[s.banner, tone === 'info' && { backgroundColor: colors.primaryLight }]}>
      <Text style={s.bannerText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  button: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  buttonLabel: {
    ...type.button,
    color: colors.textInverse,
    textAlign: 'center',
  },

  accuracyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 18, height: 18, borderRadius: radius.pill },
  accuracyLabel: { ...type.label, color: colors.text },
  accuracyValue: { ...type.label, color: colors.textMuted },

  areaHero: { ...type.hero, color: colors.text, textAlign: 'center' },
  areaCompact: { ...type.body, color: colors.text },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  banner: {
    backgroundColor: colors.fair,
    padding: space.md,
    borderRadius: radius.sm,
  },
  bannerText: { ...type.label, color: colors.textInverse, lineHeight: 22 },
});
