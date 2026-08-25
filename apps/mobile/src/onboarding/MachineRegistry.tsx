import {
  CATEGORY_NAMES,
  MACHINE_BY_CODE,
  MACHINE_TYPES,
  type MachineCategory,
  type MachineType,
} from '@zamindara/catalog';
import type { Locale } from '@zamindara/units';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card } from '../components';
import { t } from '../i18n';
import type { CaptainMachine, Ownership } from '../profile';
import { colors, radius, space, TOUCH_MIN, type } from '../theme';

interface Props {
  locale: Locale;
  machines: CaptainMachine[];
  onChange: (machines: CaptainMachine[]) => void;
}

const CATEGORY_ORDER: MachineCategory[] = [
  'harvesting',
  'tillage',
  'sowing',
  'spraying',
  'haulage',
  'earthmoving',
];

const LEAD_TIMES = [
  { hours: 0, key: 'sameDay' as const },
  { hours: 24, key: 'oneDay' as const },
  { hours: 72, key: 'twoDays' as const },
];

/**
 * The machine registry — the heart of captain onboarding, and the phase the
 * business actually depends on.
 *
 * Two things it does differently from an equipment list:
 *
 * The picker is a **grid of glyphs and local names**, never a dropdown of
 * English words. The captain choosing from it may not read comfortably, and
 * he is choosing his own machine — the one thing on this screen he knows
 * better than anyone.
 *
 * It records **owned or arrangeable**. Rural machinery access runs through
 * relationships rather than ownership: a captain who owns a tractor and can
 * borrow a rotavator from his cousin is a perfectly good captain for
 * rotavator work, he just needs notice. A registry that only recorded
 * ownership would throw away most of the district's real capacity.
 */
export function MachineRegistry({ locale, machines, onChange }: Props) {
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<CaptainMachine | null>(null);

  const add = (machine: MachineType) => {
    const entry: CaptainMachine = {
      id: `${Date.now()}-${machine.code}`,
      machineCode: machine.code,
      ownership: 'owned',
      leadTimeHours: 0,
      withOperatorOnly: false,
    };
    setPicking(false);
    onChange([...machines, entry]);
    setEditing(entry);
  };

  const patch = (id: string, fields: Partial<CaptainMachine>) => {
    const next = machines.map((m) => (m.id === id ? { ...m, ...fields } : m));
    onChange(next);
    setEditing((cur) => (cur?.id === id ? { ...cur, ...fields } : cur));
  };

  const remove = (id: string) => {
    onChange(machines.filter((m) => m.id !== id));
    setEditing(null);
  };

  return (
    <View style={s.wrap}>
      {machines.length === 0 ? (
        <Card>
          <Text style={s.empty}>{t('noMachinesYet', locale)}</Text>
        </Card>
      ) : (
        machines.map((machine) => {
          const type = MACHINE_BY_CODE.get(machine.machineCode);
          if (type === undefined) return null;
          return (
            <Pressable
              key={machine.id}
              onPress={() => setEditing(machine)}
              style={({ pressed }) => [s.row, pressed && s.pressed]}
            >
              <Text style={s.rowGlyph}>{type.glyph}</Text>
              <View style={s.rowText}>
                <Text style={s.rowName}>{type.name[locale]}</Text>
                <Text style={s.rowMeta}>
                  {machine.ownership === 'owned'
                    ? t('ownedByMe', locale)
                    : `${t('canArrange', locale)} · ${leadLabel(machine.leadTimeHours, locale)}`}
                  {machine.withOperatorOnly ? ` · ${t('withOperatorOnly', locale)}` : ''}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}

      <Button label={t('addMachine', locale)} onPress={() => setPicking(true)} variant="secondary" />

      {/* ---- Machine picker: glyph grid, grouped, local names only ---- */}
      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <View style={s.modal}>
          <Text style={s.modalTitle}>{t('pickMachine', locale)}</Text>
          <ScrollView contentContainerStyle={s.modalBody}>
            {CATEGORY_ORDER.map((category) => (
              <View key={category} style={s.group}>
                <Text style={s.groupTitle}>{CATEGORY_NAMES[category][locale]}</Text>
                <View style={s.grid}>
                  {MACHINE_TYPES.filter((m) => m.category === category).map((machine) => (
                    <Pressable
                      key={machine.code}
                      onPress={() => add(machine)}
                      style={({ pressed }) => [s.tile, pressed && s.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={machine.name[locale]}
                    >
                      <Text style={s.tileGlyph}>{machine.glyph}</Text>
                      <Text style={s.tileName} numberOfLines={2}>
                        {machine.name[locale]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={s.modalFooter}>
            <Button label={t('cancel', locale)} onPress={() => setPicking(false)} variant="ghost" />
          </View>
        </View>
      </Modal>

      {/* ---- Detail sheet: ownership, lead time, operator constraint ---- */}
      <Modal
        visible={editing !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditing(null)}
      >
        <View style={s.sheetBackdrop}>
          <View style={s.sheet}>
            {editing !== null && (
              <>
                <Text style={s.sheetTitle}>
                  {MACHINE_BY_CODE.get(editing.machineCode)?.name[locale] ?? ''}
                </Text>

                <Text style={s.label}>{t('ownership', locale)}</Text>
                <View style={s.chips}>
                  {(['owned', 'arrangeable'] as Ownership[]).map((option) => (
                    <Pressable
                      key={option}
                      onPress={() =>
                        patch(editing.id, {
                          ownership: option,
                          leadTimeHours: option === 'owned' ? 0 : Math.max(editing.leadTimeHours, 24),
                        })
                      }
                      style={[s.chip, editing.ownership === option && s.chipOn]}
                    >
                      <Text style={[s.chipText, editing.ownership === option && s.chipTextOn]}>
                        {option === 'owned' ? t('ownedByMe', locale) : t('canArrange', locale)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Lead time only matters for a machine he has to go and get.
                    It is what keeps him out of instant-job dispatch. */}
                {editing.ownership === 'arrangeable' && (
                  <>
                    <Text style={s.hint}>{t('canArrangeHint', locale)}</Text>
                    <View style={s.chips}>
                      {LEAD_TIMES.map((option) => (
                        <Pressable
                          key={option.hours}
                          onPress={() => patch(editing.id, { leadTimeHours: option.hours })}
                          style={[s.chip, editing.leadTimeHours === option.hours && s.chipOn]}
                        >
                          <Text
                            style={[
                              s.chipText,
                              editing.leadTimeHours === option.hours && s.chipTextOn,
                            ]}
                          >
                            {t(option.key, locale)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>{t('withOperatorOnly', locale)}</Text>
                  <Switch
                    value={editing.withOperatorOnly}
                    onValueChange={(v) => patch(editing.id, { withOperatorOnly: v })}
                    trackColor={{ true: colors.primaryLight, false: colors.border }}
                    thumbColor={editing.withOperatorOnly ? colors.primary : colors.surface}
                  />
                </View>

                <View style={s.sheetActions}>
                  <Button
                    label={t('remove', locale)}
                    onPress={() => remove(editing.id)}
                    variant="ghost"
                    flex
                  />
                  <Button label={t('done', locale)} onPress={() => setEditing(null)} flex />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function leadLabel(hours: number, locale: Locale): string {
  if (hours === 0) return t('sameDay', locale);
  if (hours <= 24) return t('oneDay', locale);
  return t('twoDays', locale);
}

const s = StyleSheet.create({
  wrap: { gap: space.sm },
  empty: { ...type.body, color: colors.textMuted, lineHeight: 25 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    minHeight: 72,
  },
  pressed: { opacity: 0.85 },
  rowGlyph: { fontSize: 32 },
  rowText: { flex: 1, gap: 2 },
  rowName: { ...type.body, color: colors.text },
  rowMeta: { ...type.label, fontWeight: '400', color: colors.textMuted },

  modal: { flex: 1, backgroundColor: colors.background, paddingTop: space.xl },
  modalTitle: { ...type.title, color: colors.text, padding: space.md },
  modalBody: { padding: space.md, gap: space.lg, paddingBottom: space.xl },
  modalFooter: { padding: space.md, borderTopWidth: 1, borderTopColor: colors.border },

  group: { gap: space.sm },
  groupTitle: { ...type.label, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    width: '31%',
    minHeight: 104,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
    gap: space.xs,
  },
  tileGlyph: { fontSize: 34 },
  tileName: { ...type.label, fontSize: 13, color: colors.text, textAlign: 'center' },

  sheetBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.md,
    gap: space.md,
    paddingBottom: space.xl,
  },
  sheetTitle: { ...type.title, color: colors.text },
  sheetActions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },

  label: { ...type.label, color: colors.textMuted },
  hint: { ...type.label, fontWeight: '400', color: colors.textMuted, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.label, color: colors.text },
  chipTextOn: { color: colors.textInverse },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TOUCH_MIN,
  },
  switchLabel: { ...type.body, color: colors.text, flex: 1, paddingRight: space.md },
});
