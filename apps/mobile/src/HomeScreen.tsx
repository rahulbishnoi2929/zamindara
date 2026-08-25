import { MACHINE_BY_CODE } from '@zamindara/catalog';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { AreaDisplay, Button, Card } from './components';
import { t } from './i18n';
import { isCaptain, isFarmer, type Profile } from './profile';
import type { SavedField } from './storage';
import { colors, radius, space, TOUCH_MIN, type } from './theme';

interface Props {
  profile: Profile;
  fields: SavedField[];
  onAddField: () => void;
  onEditProfile: () => void;
  onToggleOnline: () => void;
  onOpenFieldTest: () => void;
}

/**
 * Home, shaped by who you are.
 *
 * A captain opens to his availability toggle and his machines — the two
 * things that decide whether work reaches him today. A farmer opens to his
 * fields. Someone who is both sees both, in that order, because the supply
 * side is the one with a decision to make each morning.
 */
export function HomeScreen({
  profile,
  fields,
  onAddField,
  onEditProfile,
  onToggleOnline,
  onOpenFieldTest,
}: Props) {
  const locale = profile.language;
  const captain = isCaptain(profile);
  const farmer = isFarmer(profile);

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={s.headerText}>
            <Text style={s.appName}>{t('appName', locale)}</Text>
            <Text style={s.who}>
              {profile.fullName}
              {profile.village ? ` · ${profile.village}` : ''}
            </Text>
          </View>
          <Pressable onPress={onEditProfile} hitSlop={12} style={s.profileBtn}>
            <Text style={s.profileBtnText}>{t('editProfile', locale)}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {captain && (
          <>
            {/* The one decision a captain makes each morning. Big, obvious,
                and the first thing on the screen. */}
            <View style={[s.onlineCard, profile.isOnline && s.onlineCardOn]}>
              <View style={s.onlineText}>
                <Text style={[s.onlineLabel, profile.isOnline && s.onlineLabelOn]}>
                  {profile.isOnline ? t('online', locale) : t('offline', locale)}
                </Text>
                {profile.isOnline && (
                  <Text style={s.onlineHint}>{t('waitingForWork', locale)}</Text>
                )}
              </View>
              <Switch
                value={profile.isOnline}
                onValueChange={onToggleOnline}
                trackColor={{ true: colors.primaryLight, false: colors.border }}
                thumbColor={profile.isOnline ? colors.surface : colors.textMuted}
              />
            </View>

            <Text style={s.sectionTitle}>{t('yourMachines', locale)}</Text>
            {profile.machines.length === 0 ? (
              <Card>
                <Text style={s.empty}>{t('noMachinesYet', locale)}</Text>
              </Card>
            ) : (
              <View style={s.machineRow}>
                {profile.machines.map((machine) => {
                  const machineType = MACHINE_BY_CODE.get(machine.machineCode);
                  if (machineType === undefined) return null;
                  return (
                    <View key={machine.id} style={s.machineChip}>
                      <Text style={s.machineGlyph}>{machineType.glyph}</Text>
                      <Text style={s.machineName} numberOfLines={1}>
                        {machineType.name[locale]}
                      </Text>
                      {machine.ownership === 'arrangeable' && (
                        <Text style={s.arrangeMark}>◷</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {farmer && (
          <>
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
          </>
        )}
      </ScrollView>

      <View style={s.footer}>
        {farmer && <Button label={t('addField', locale)} onPress={onAddField} />}
        {!farmer && (
          <Button label={t('yourMachines', locale)} onPress={onEditProfile} variant="secondary" />
        )}
        {/* Founder's tool. Removed once Phase 1 clears. */}
        <Pressable onPress={onOpenFieldTest} hitSlop={12} style={s.testLink}>
          <Text style={s.testLinkText}>Field test</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primary, padding: space.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1 },
  appName: { ...type.title, color: colors.textInverse },
  who: { ...type.label, fontWeight: '400', color: 'rgba(255,255,255,0.85)' },
  profileBtn: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    minHeight: 40,
    justifyContent: 'center',
  },
  profileBtnText: { ...type.label, color: colors.textInverse },

  list: { padding: space.md, gap: space.md },

  onlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    padding: space.md,
    minHeight: 88,
  },
  onlineCardOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  onlineText: { flex: 1, gap: space.xs },
  onlineLabel: { ...type.title, color: colors.textMuted },
  onlineLabelOn: { color: colors.textInverse },
  onlineHint: { ...type.label, fontWeight: '400', color: 'rgba(255,255,255,0.85)', lineHeight: 20 },

  sectionTitle: { ...type.label, color: colors.textMuted },
  empty: { ...type.body, color: colors.textMuted, lineHeight: 25 },

  machineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  machineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    maxWidth: '100%',
  },
  machineGlyph: { fontSize: 20 },
  machineName: { ...type.label, color: colors.text, flexShrink: 1 },
  arrangeMark: { ...type.label, color: colors.fair },

  fieldName: { ...type.body, color: colors.text, marginBottom: space.xs },
  pending: { ...type.label, color: colors.fair },

  footer: { padding: space.md, minHeight: TOUCH_MIN + space.lg, gap: space.sm },
  testLink: { alignSelf: 'center', paddingVertical: space.sm },
  testLinkText: { ...type.label, fontSize: 13, color: colors.textMuted },
});
