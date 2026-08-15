import { LOCALES, type Locale } from '@zamindara/units';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AreaDisplay, Button, Card } from './components';
import { t } from './i18n';
import type { SavedField } from './storage';
import { colors, radius, space, TOUCH_MIN, type } from './theme';

interface Props {
  locale: Locale;
  fields: SavedField[];
  onAddField: () => void;
  onLocaleChange: (locale: Locale) => void;
}

const LOCALE_LABEL: Record<Locale, string> = {
  pa: 'ਪੰਜਾਬੀ',
  hi: 'हिन्दी',
  en: 'English',
};

export function HomeScreen({ locale, fields, onAddField, onLocaleChange }: Props) {
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.appName}>{t('appName', locale)}</Text>
        {/* Language stays reachable from the first screen. Someone else often
            sets the phone up, and the farmer needs to change it back. */}
        <View style={s.localeRow}>
          {LOCALES.map((code) => (
            <Pressable
              key={code}
              onPress={() => onLocaleChange(code)}
              style={[s.localeChip, locale === code && s.localeChipActive]}
            >
              <Text style={[s.localeText, locale === code && s.localeTextActive]}>
                {LOCALE_LABEL[code]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        <Text style={s.sectionTitle}>{t('myFields', locale)}</Text>

        {fields.length === 0 ? (
          <Card>
            <Text style={s.empty}>{t('noFields', locale)}</Text>
          </Card>
        ) : (
          fields.map((field) => (
            <Card key={field.id}>
              <Text style={s.fieldName}>{field.name}</Text>
              <AreaDisplay sqm={field.areaSqm} locale={locale} compact />
              {!field.synced && <Text style={s.pending}>⟳</Text>}
            </Card>
          ))
        )}
      </ScrollView>

      <View style={s.footer}>
        <Button label={t('addField', locale)} onPress={onAddField} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primary, padding: space.md, gap: space.md },
  appName: { ...type.title, color: colors.textInverse },
  localeRow: { flexDirection: 'row', gap: space.sm },
  localeChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    minHeight: 40,
    justifyContent: 'center',
  },
  localeChipActive: { backgroundColor: colors.surface },
  localeText: { ...type.label, color: colors.textInverse },
  localeTextActive: { color: colors.primary },

  list: { padding: space.md, gap: space.md },
  sectionTitle: { ...type.label, color: colors.textMuted },
  empty: { ...type.body, color: colors.textMuted, lineHeight: 26 },
  fieldName: { ...type.body, color: colors.text, marginBottom: space.xs },
  pending: { ...type.label, color: colors.fair },

  footer: { padding: space.md, minHeight: TOUCH_MIN + space.lg },
});
