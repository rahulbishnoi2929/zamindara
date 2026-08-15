import { formatArea, parseArea } from '@zamindara/units';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, Card } from '../components';
import { colors, radius, space, type } from '../theme';
import {
  errorVsTape,
  tapeAreaSqm,
  TAPE_UNIT_M,
  type TapeUnit,
  type TestMeasurement,
  type TestPlot,
} from './types';

interface Props {
  plot: TestPlot;
  measurements: TestMeasurement[];
  onChange: (plot: TestPlot) => void;
  onMeasureDrawn: () => void;
  onMeasureWalked: () => void;
  onUpdateMeasurement: (measurement: TestMeasurement) => void;
  onDeleteMeasurement: (id: string) => void;
  onDeletePlot: () => void;
  onBack: () => void;
}

const UNITS: TapeUnit[] = ['m', 'ft', 'karam'];

export function PlotDetailScreen({
  plot,
  measurements,
  onChange,
  onMeasureDrawn,
  onMeasureWalked,
  onUpdateMeasurement,
  onDeleteMeasurement,
  onDeletePlot,
  onBack,
}: Props) {
  // Jamabandi is entered as text so it can be typed the way it reads on the
  // paper — "4 killa 2 kanal" — rather than converted in the founder's head.
  const [jamabandiText, setJamabandiText] = useState(
    plot.jamabandiSqm === null ? '' : formatArea(plot.jamabandiSqm, { locale: 'en' }),
  );

  const tape = tapeAreaSqm(plot);
  const patch = (fields: Partial<TestPlot>) => onChange({ ...plot, ...fields });

  const parseNumber = (text: string): number | null => {
    const value = Number(text.replace(/[^\d.]/g, ''));
    return text.trim() === '' || !Number.isFinite(value) || value <= 0 ? null : value;
  };

  const commitJamabandi = (text: string) => {
    setJamabandiText(text);
    if (text.trim() === '') {
      patch({ jamabandiSqm: null });
      return;
    }
    const parsed = parseArea(text);
    if (parsed !== null) patch({ jamabandiSqm: parsed.sqm });
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={s.back}>‹ Field test</Text>
        </Pressable>
        <Text style={s.title}>{plot.label || 'New plot'}</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={s.cardTitle}>Plot</Text>
          <Field
            label="Label"
            value={plot.label}
            onChangeText={(v) => patch({ label: v })}
            placeholder="Gurmeet — nehar wala"
          />
          <Field
            label="Village"
            value={plot.village}
            onChangeText={(v) => patch({ village: v })}
            placeholder="Roshan Wala"
          />
        </Card>

        <Card>
          <Text style={s.cardTitle}>Tape reading — ground truth</Text>
          <View style={s.row}>
            <View style={s.flex}>
              <Field
                label="Side A"
                value={plot.sideA === null ? '' : String(plot.sideA)}
                onChangeText={(v) => patch({ sideA: parseNumber(v) })}
                keyboardType="decimal-pad"
                placeholder="60.4"
              />
            </View>
            <View style={s.flex}>
              <Field
                label="Side B"
                value={plot.sideB === null ? '' : String(plot.sideB)}
                onChangeText={(v) => patch({ sideB: parseNumber(v) })}
                keyboardType="decimal-pad"
                placeholder="67.1"
              />
            </View>
          </View>

          <Text style={s.fieldLabel}>Unit</Text>
          <View style={s.chips}>
            {UNITS.map((unit) => (
              <Pressable
                key={unit}
                onPress={() => patch({ tapeUnit: unit })}
                style={[s.chip, plot.tapeUnit === unit && s.chipOn]}
              >
                <Text style={[s.chipText, plot.tapeUnit === unit && s.chipTextOn]}>
                  {unit}
                </Text>
              </Pressable>
            ))}
          </View>

          {tape !== null && (
            <View style={s.tapeResult}>
              <Text style={s.tapeArea}>{formatArea(tape, { locale: 'en' })}</Text>
              <Text style={s.tapeSqm}>{tape.toFixed(0)} m²</Text>
            </View>
          )}

          <Text style={s.footnote}>
            Two sides of a rectangle. A 50 m tape is accurate to about 0.2% — the
            margin a reference needs when validating a 2% target.
            {plot.tapeUnit === 'karam' &&
              ` One karam = ${TAPE_UNIT_M.karam.toFixed(4)} m. A standard killa is 36 × 40 karam.`}
          </Text>
        </Card>

        <Card>
          <Text style={s.cardTitle}>Jamabandi — recorded, not ground truth</Text>
          <Field
            label="As written on the paper"
            value={jamabandiText}
            onChangeText={commitJamabandi}
            placeholder="4 killa 2 kanal"
          />
          {plot.jamabandiSqm !== null && tape !== null && (
            <Text style={s.gap}>
              {(((tape / plot.jamabandiSqm) - 1) * 100).toFixed(1)}% vs tape
            </Text>
          )}
          <Text style={s.footnote}>
            The record describes the legal parcel, not the cultivated field, and is
            often stale. Captured because it is the number the farmer believes.
          </Text>
        </Card>

        <Card>
          <Text style={s.cardTitle}>Measurements ({measurements.length})</Text>

          {measurements.length === 0 && (
            <Text style={s.empty}>
              Measure this plot both ways. That comparison is what decides the app's
              default method.
            </Text>
          )}

          {measurements.map((m) => {
            const error = errorVsTape(m, plot);
            return (
              <View key={m.id} style={s.measurement}>
                <View style={s.measurementHead}>
                  <Text style={s.method}>{m.method}</Text>
                  {error !== null && (
                    <Text
                      style={[
                        s.error,
                        Math.abs(error) < 0.02
                          ? s.pass
                          : Math.abs(error) < 0.04
                            ? s.warn
                            : s.fail,
                      ]}
                    >
                      {error > 0 ? '+' : ''}
                      {(error * 100).toFixed(1)}%
                    </Text>
                  )}
                </View>

                <Text style={s.measurementArea}>
                  {formatArea(m.areaSqm, { locale: 'en' })} · {m.areaSqm.toFixed(0)} m²
                </Text>

                <Text style={s.measurementMeta}>
                  {[
                    m.meanAccuracyM !== null && `±${m.meanAccuracyM.toFixed(1)} m GPS`,
                    m.durationSec !== null && `${Math.round(m.durationSec)}s`,
                    m.pointsAccepted !== null &&
                      `${m.pointsAccepted}/${(m.pointsAccepted ?? 0) + (m.pointsRejected ?? 0)} fixes`,
                    m.pipelineMethod,
                    m.cornersAdjusted === true && 'corners dragged',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </Text>

                <View style={s.measurementActions}>
                  {m.method === 'drawn' && (
                    <Pressable
                      onPress={() =>
                        onUpdateMeasurement({
                          ...m,
                          imageryUsable: m.imageryUsable === false ? true : false,
                        })
                      }
                      style={[s.smallChip, m.imageryUsable === false && s.smallChipWarn]}
                    >
                      <Text style={s.smallChipText}>
                        {m.imageryUsable === false ? 'imagery unusable' : 'imagery ok'}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() =>
                      Alert.alert('Delete measurement?', '', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => onDeleteMeasurement(m.id),
                        },
                      ])
                    }
                    style={s.smallChip}
                  >
                    <Text style={s.smallChipText}>delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </Card>

        <Pressable
          onPress={() =>
            Alert.alert('Delete this plot?', 'Its measurements go too.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: onDeletePlot },
            ])
          }
        >
          <Text style={s.deletePlot}>Delete plot</Text>
        </Pressable>
      </ScrollView>

      <View style={s.footer}>
        <View style={s.row}>
          <Button label="Draw" onPress={onMeasureDrawn} flex />
          <Button label="Walk" onPress={onMeasureWalked} variant="secondary" flex />
        </View>
      </View>
    </View>
  );
}

function Field({
  label,
  ...input
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.input}
        placeholderTextColor={colors.textMuted}
        {...input}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primaryDark, padding: space.md, gap: space.xs },
  back: { ...type.label, color: 'rgba(255,255,255,0.8)' },
  title: { ...type.title, color: colors.textInverse },

  body: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  cardTitle: { ...type.label, color: colors.textMuted, marginBottom: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },

  fieldWrap: { gap: space.xs, marginBottom: space.sm },
  fieldLabel: { ...type.label, fontSize: 13, color: colors.textMuted },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    minHeight: 48,
  },

  chips: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.label, color: colors.text },
  chipTextOn: { color: colors.textInverse },

  tapeResult: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  tapeArea: { ...type.body, fontSize: 22, color: colors.primary },
  tapeSqm: { ...type.label, fontWeight: '400', color: colors.textMuted },
  gap: { ...type.body, color: colors.text },

  footnote: {
    ...type.label,
    fontWeight: '400',
    color: colors.textMuted,
    marginTop: space.sm,
    lineHeight: 19,
  },
  empty: { ...type.label, fontWeight: '400', color: colors.textMuted, lineHeight: 21 },

  measurement: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.sm,
    marginTop: space.sm,
    gap: space.xs,
  },
  measurementHead: { flexDirection: 'row', justifyContent: 'space-between' },
  method: { ...type.label, color: colors.text, textTransform: 'uppercase' },
  error: { ...type.body, fontSize: 20 },
  pass: { color: colors.good },
  warn: { color: colors.fair },
  fail: { color: colors.poor },
  measurementArea: { ...type.body, color: colors.text },
  measurementMeta: { ...type.label, fontSize: 12, fontWeight: '400', color: colors.textMuted },
  measurementActions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  smallChip: {
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallChipWarn: { backgroundColor: colors.fair, borderColor: colors.fair },
  smallChipText: { ...type.label, fontSize: 12, color: colors.text },

  deletePlot: { ...type.label, color: colors.poor, textAlign: 'center', padding: space.md },

  footer: {
    padding: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
