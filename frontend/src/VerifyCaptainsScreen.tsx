import type { Locale } from '@zamindara/units';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, Card } from './components';
import { t } from './i18n';
import {
  fetchPendingCaptains,
  setCaptainVerification,
  type PendingCaptain,
} from './sync/sync';
import { colors, radius, space, type } from './theme';

interface Props {
  locale: Locale;
  onBack: () => void;
}

/**
 * The verify queue — staff only, and the guard is in the database.
 *
 * This exists because there was no path to 'verified' at all: the column
 * defaults to pending, every dispatch query requires verified, and the RLS
 * policy correctly stops a captain promoting himself. Every captain
 * onboarded would have been a ghost — invisible to farmers, never dispatched.
 *
 * One tap, in the yard, next to the machine. That is where the founder
 * actually is when he decides, and it is better evidence than a document
 * check would be.
 */
export function VerifyCaptainsScreen({ locale, onBack }: Props) {
  const [pending, setPending] = useState<PendingCaptain[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPending(await fetchPendingCaptains());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (captain: PendingCaptain, status: 'verified' | 'rejected') => {
    setBusy(captain.captainId);
    const ok = await setCaptainVerification(captain.captainId, status);
    setBusy(null);

    if (!ok) {
      Alert.alert('Could not save', 'No connection, or you are not staff.');
      return;
    }
    // Drop him from the queue rather than refetching — he is decided either
    // way, and a round trip in a yard with one bar is worth avoiding.
    setPending((prev) => prev?.filter((c) => c.captainId !== captain.captainId) ?? null);
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={s.back}>‹ Back</Text>
        </Pressable>
        <Text style={s.title}>Verify captains</Text>
        <Text style={s.subtitle}>
          {pending === null ? '…' : `${pending.length} waiting`}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={
          <RefreshControl refreshing={pending === null} onRefresh={() => void load()} />
        }
      >
        {pending === null ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : pending.length === 0 ? (
          <Card>
            <Text style={s.empty}>
              Nobody waiting. A captain appears here once he finishes
              onboarding — until you verify him he is invisible to farmers and
              will never be offered a job.
            </Text>
          </Card>
        ) : (
          pending.map((captain) => (
            <Card key={captain.captainId}>
              <Text style={s.name}>{captain.fullName || '—'}</Text>
              <Text style={s.meta}>
                {[captain.village, captain.phone].filter(Boolean).join(' · ')}
              </Text>
              <Text
                style={[s.machines, captain.machineCount === 0 && s.machinesNone]}
              >
                {captain.machineCount === 0
                  ? 'no machines registered yet'
                  : `${captain.machineCount} machine${captain.machineCount === 1 ? '' : 's'}`}
              </Text>

              {/* A captain with no machine cannot be matched to any work, so
                  verifying him achieves nothing. Worth seeing before you tap. */}
              <View style={s.actions}>
                <Button
                  label="Reject"
                  onPress={() => void decide(captain, 'rejected')}
                  variant="ghost"
                  disabled={busy === captain.captainId}
                  flex
                />
                <Button
                  label="Verify"
                  onPress={() => void decide(captain, 'verified')}
                  disabled={busy === captain.captainId || captain.machineCount === 0}
                  flex
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <View style={s.footer}>
        <Button label={t('back', locale)} onPress={onBack} variant="secondary" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primaryDark, padding: space.md, gap: space.xs },
  back: { ...type.label, color: 'rgba(255,255,255,0.8)' },
  title: { ...type.title, color: colors.textInverse },
  subtitle: { ...type.label, color: 'rgba(255,255,255,0.75)' },

  body: { padding: space.md, gap: space.md },
  centered: { paddingVertical: space.xl, alignItems: 'center' },
  empty: { ...type.body, color: colors.textMuted, lineHeight: 25 },

  name: { ...type.body, fontSize: 20, color: colors.text },
  meta: { ...type.label, fontWeight: '400', color: colors.textMuted, marginTop: 2 },
  machines: { ...type.label, color: colors.primary, marginTop: space.xs },
  machinesNone: { color: colors.fair },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },

  footer: {
    padding: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
