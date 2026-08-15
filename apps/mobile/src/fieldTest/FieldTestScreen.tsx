import { formatArea } from '@zamindara/units';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../components';
import { colors, radius, space, type } from '../theme';
import { exportCsv } from './csv';
import { summarise, type TestSummary } from './stats';
import { tapeAreaSqm, type TestMeasurement, type TestPlot } from './types';

interface Props {
  plots: TestPlot[];
  measurements: TestMeasurement[];
  onOpenPlot: (plotId: string) => void;
  onAddPlot: () => void;
  onBack: () => void;
}

/**
 * Phase 1 field test — the founder's tool, not the farmer's.
 *
 * Deliberately English, dense and information-first. The rest of the app is
 * built for someone who reads slowly in sunlight; this screen is built for
 * one person who needs to know whether twenty plots have cleared the gate.
 */
export function FieldTestScreen({
  plots,
  measurements,
  onOpenPlot,
  onAddPlot,
  onBack,
}: Props) {
  const [exporting, setExporting] = useState(false);
  const summary = useMemo(
    () => summarise(plots, measurements),
    [plots, measurements],
  );

  const handleExport = async () => {
    setExporting(true);
    const result = await exportCsv(plots, measurements);
    setExporting(false);
    if (!result.ok) Alert.alert('Export', result.message);
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={s.back}>‹ Back</Text>
        </Pressable>
        <Text style={s.title}>Field Test — Phase 1</Text>
        <Text style={s.subtitle}>
          {summary.plotsWithTape}/20 plots taped · {summary.totalMeasurements} measurements
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <GateCard summary={summary} />

        {summary.byMethod.length > 0 && (
          <Card>
            <Text style={s.cardTitle}>Accuracy vs tape, by method</Text>
            <View style={s.tableHead}>
              <Text style={[s.th, s.colWide]}>method</Text>
              <Text style={s.th}>n</Text>
              <Text style={s.th}>bias</Text>
              <Text style={s.th}>|err|</Text>
              <Text style={s.th}>&lt;2%</Text>
            </View>
            {summary.byMethod.map((m) => (
              <View key={m.method} style={s.tr}>
                <Text style={[s.td, s.colWide, s.strong]}>{m.method}</Text>
                <Text style={s.td}>{m.n}</Text>
                <Text style={s.td}>{(m.bias * 100).toFixed(1)}%</Text>
                <Text style={s.td}>{(m.meanAbsError * 100).toFixed(1)}%</Text>
                <Text style={s.td}>{(m.within2pc * 100).toFixed(0)}%</Text>
              </View>
            ))}
            <Text style={s.footnote}>
              Which method wins here decides the app's default. Drawing leads on
              reasoning alone so far.
            </Text>
          </Card>
        )}

        {summary.bySize.some((b) => b.n > 0) && (
          <Card>
            <Text style={s.cardTitle}>By plot size</Text>
            {summary.bySize
              .filter((b) => b.n > 0)
              .map((b) => (
                <View key={b.label} style={s.tr}>
                  <Text style={[s.td, s.colWidest]}>{b.label}</Text>
                  <Text style={s.td}>n={b.n}</Text>
                  <Text style={[s.td, b.passes ? s.pass : s.fail]}>
                    {(b.meanAbsError * 100).toFixed(1)}%
                  </Text>
                  <Text style={s.tdMuted}>bar {(b.bar * 100).toFixed(0)}%</Text>
                </View>
              ))}
            <Text style={s.footnote}>
              Simulation says size dominates every other factor. Small plots are
              expected to be worse — the bar is set accordingly.
            </Text>
          </Card>
        )}

        {summary.repeatability !== null && (
          <Card>
            <Text style={s.cardTitle}>Repeatability</Text>
            <Text style={s.stat}>
              {(summary.repeatability.meanSpread * 100).toFixed(1)}% mean spread ·{' '}
              {(summary.repeatability.worstSpread * 100).toFixed(1)}% worst
            </Text>
            <Text style={s.footnote}>
              Same plot, same method, measured twice. Bar is 3%.
            </Text>
          </Card>
        )}

        {summary.jamabandi !== null && (
          <Card>
            <Text style={s.cardTitle}>Gap vs jamabandi — not a gate</Text>
            <Text style={s.stat}>
              median {(summary.jamabandi.medianGap * 100).toFixed(1)}% ·{' '}
              {(summary.jamabandi.consistency * 100).toFixed(0)}% one-sided
            </Text>
            <Text style={s.footnote}>
              The record is not ground truth — it describes the legal parcel and is
              often stale. But it is the number the farmer already believes. A large,
              one-sided gap means farmers meet our number already convinced it is
              wrong, and that needs an answer before launch.
            </Text>
          </Card>
        )}

        {summary.imageryUnusableCount > 0 && (
          <Card>
            <Text style={s.cardTitle}>Imagery unusable</Text>
            <Text style={s.stat}>{summary.imageryUnusableCount} plots</Text>
            <Text style={s.footnote}>
              How often the field could not be traced from above — this is what
              decides whether walking stays essential.
            </Text>
          </Card>
        )}

        <Text style={s.sectionTitle}>Plots</Text>

        {plots.length === 0 ? (
          <Card>
            <Text style={s.empty}>
              No plots yet. Add one, tape two sides, then measure it both ways.
            </Text>
          </Card>
        ) : (
          plots.map((plot) => (
            <PlotRow
              key={plot.id}
              plot={plot}
              measurements={measurements.filter((m) => m.plotId === plot.id)}
              onPress={() => onOpenPlot(plot.id)}
            />
          ))
        )}
      </ScrollView>

      <View style={s.footer}>
        <Button label="Add plot" onPress={onAddPlot} />
        <Button
          label={exporting ? 'Exporting…' : 'Export CSV'}
          onPress={() => void handleExport()}
          variant="secondary"
          disabled={exporting || measurements.length === 0}
        />
      </View>
    </View>
  );
}

function GateCard({ summary }: { summary: TestSummary }) {
  return (
    <View style={[s.gate, summary.gatePasses ? s.gatePass : s.gateFail]}>
      <Text style={s.gateTitle}>
        {summary.gatePasses ? '✓ Gate passed' : 'Gate not yet passed'}
      </Text>
      {summary.gateNotes.length === 0 ? (
        <Text style={s.gateNote}>Build can continue to Phase 2.</Text>
      ) : (
        summary.gateNotes.map((note) => (
          <Text key={note} style={s.gateNote}>
            • {note}
          </Text>
        ))
      )}
    </View>
  );
}

function PlotRow({
  plot,
  measurements,
  onPress,
}: {
  plot: TestPlot;
  measurements: TestMeasurement[];
  onPress: () => void;
}) {
  const tape = tapeAreaSqm(plot);
  const drawn = measurements.filter((m) => m.method === 'drawn').length;
  const walked = measurements.filter((m) => m.method === 'walked').length;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.plotRow, pressed && s.pressed]}>
      <View style={s.plotMain}>
        <Text style={s.plotLabel}>{plot.label || 'Untitled plot'}</Text>
        <Text style={s.plotMeta}>
          {tape === null
            ? 'no tape reading'
            : formatArea(tape, { locale: 'en' })}
          {plot.village ? ` · ${plot.village}` : ''}
        </Text>
      </View>
      <View style={s.plotCounts}>
        <Text style={[s.badge, drawn > 0 && s.badgeOn]}>D{drawn}</Text>
        <Text style={[s.badge, walked > 0 && s.badgeOn]}>W{walked}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primaryDark, padding: space.md, gap: space.xs },
  back: { ...type.label, color: 'rgba(255,255,255,0.8)' },
  title: { ...type.title, color: colors.textInverse },
  subtitle: { ...type.label, color: 'rgba(255,255,255,0.75)' },

  body: { padding: space.md, gap: space.md },

  gate: { borderRadius: radius.md, padding: space.md, gap: space.xs },
  gatePass: { backgroundColor: colors.good },
  gateFail: { backgroundColor: colors.fair },
  gateTitle: { ...type.body, fontSize: 20, color: colors.textInverse },
  gateNote: { ...type.label, color: colors.textInverse, lineHeight: 21 },

  cardTitle: { ...type.label, color: colors.textMuted, marginBottom: space.sm },
  stat: { ...type.body, fontSize: 20, color: colors.text },
  footnote: {
    ...type.label,
    fontWeight: '400',
    color: colors.textMuted,
    marginTop: space.sm,
    lineHeight: 19,
  },

  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: space.xs,
  },
  th: { ...type.label, fontSize: 12, color: colors.textMuted, flex: 1 },
  tr: { flexDirection: 'row', paddingVertical: space.sm, alignItems: 'center' },
  td: { ...type.label, color: colors.text, flex: 1 },
  tdMuted: { ...type.label, fontWeight: '400', color: colors.textMuted, flex: 1 },
  colWide: { flex: 1.6 },
  colWidest: { flex: 2.4 },
  strong: { fontWeight: '700' },
  pass: { color: colors.good, fontWeight: '700' },
  fail: { color: colors.poor, fontWeight: '700' },

  sectionTitle: { ...type.label, color: colors.textMuted, marginTop: space.sm },
  empty: { ...type.body, color: colors.textMuted, lineHeight: 25 },

  plotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    minHeight: 68,
    gap: space.sm,
  },
  pressed: { opacity: 0.85 },
  plotMain: { flex: 1, gap: 2 },
  plotLabel: { ...type.body, color: colors.text },
  plotMeta: { ...type.label, fontWeight: '400', color: colors.textMuted },
  plotCounts: { flexDirection: 'row', gap: space.xs },
  badge: {
    ...type.label,
    fontSize: 12,
    color: colors.textMuted,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  badgeOn: { color: colors.textInverse, backgroundColor: colors.primary },

  footer: {
    padding: space.md,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
