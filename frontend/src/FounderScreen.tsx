import { SERVICE_BY_CODE, servicesForMonth } from '@zamindara/catalog';
import { formatAreaShort, type Locale } from '@zamindara/units';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { Button, Card } from './components';
import { areaFromKillaKanal, shareText, type FounderJob } from './founder';
import { t } from './i18n';
import type { JobStatus, JobWindow } from './jobs';
import { currentLatLng } from './location';
import {
  fetchFounderCaptains,
  fetchFounderJobs,
  founderAdvance,
  founderAssign,
  founderCreateFarmer,
  founderCreateJob,
  type FounderCaptain,
} from './sync/sync';
import { colors, radius, space, type } from './theme';

interface Props {
  locale: Locale;
  onBack: () => void;
}

type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'assign'; job: FounderJob };

/** Fazilka town, when the phone cannot say where it is. */
const FAZILKA = { lat: 30.4036, lng: 74.0284 };

const NEXT: Partial<Record<JobStatus, { to: JobStatus; label: 'onMyWay' | 'startWork' | 'markComplete' }>> = {
  accepted: { to: 'en_route', label: 'onMyWay' },
  en_route: { to: 'in_progress', label: 'startWork' },
  in_progress: { to: 'completed', label: 'markComplete' },
};

/**
 * Founder dispatch (Stage 4.2): book work for a farmer who phoned, put it in
 * a captain's queue, move it along, record the money, and forward it on
 * WhatsApp. Staff only — the database refuses everyone else; this screen is
 * simply not offered to them.
 */
export function FounderScreen({ locale, onBack }: Props) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  // undefined = loading, null = failed (offline or not staff).
  const [jobs, setJobs] = useState<FounderJob[] | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setJobs(undefined);
    setJobs(await fetchFounderJobs());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Android back leaves the form or the captain list first, not the screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mode.kind === 'list') return false;
      setMode({ kind: 'list' });
      return true;
    });
    return () => sub.remove();
  }, [mode.kind]);

  const advance = async (job: FounderJob) => {
    const next = NEXT[job.status];
    if (next === undefined) return;
    let amount: number | null = null;
    if (next.to === 'completed') {
      amount = Number(amounts[job.id] ?? '');
      if (!Number.isFinite(amount) || amount <= 0) {
        Alert.alert(t('founderAmount', locale));
        return;
      }
    }
    setBusy(job.id);
    const ok = await founderAdvance(job.id, next.to, amount);
    setBusy(null);
    if (!ok) Alert.alert(t('founderFailed', locale));
    void load();
  };

  if (mode.kind === 'new') {
    return (
      <PhoneBookingForm
        locale={locale}
        onCreate={async (b) => {
          const farmerId = await founderCreateFarmer(b.phone, b.name, b.village);
          return farmerId !== null && (await founderCreateJob({ ...b, farmerId })) !== null;
        }}
        onDone={() => {
          setMode({ kind: 'list' });
          void load();
        }}
      />
    );
  }

  if (mode.kind === 'assign') {
    return (
      <AssignCaptain
        locale={locale}
        job={mode.job}
        onDone={() => {
          setMode({ kind: 'list' });
          void load();
        }}
      />
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.title}>{t('founderTitle', locale)}</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={jobs === undefined} onRefresh={() => void load()} />}
      >
        <Button label={t('founderNewJob', locale)} onPress={() => setMode({ kind: 'new' })} />

        <Text style={s.section}>{t('founderOpenJobs', locale)}</Text>
        {jobs === undefined ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : jobs === null ? (
          <Card>
            <Text style={s.muted}>{t('founderLoadFailed', locale)}</Text>
          </Card>
        ) : jobs.length === 0 ? (
          <Card>
            <Text style={s.muted}>{t('founderNoJobs', locale)}</Text>
          </Card>
        ) : (
          jobs.map((job) => {
            const next = NEXT[job.status];
            return (
              <Card key={job.id}>
                <Text style={s.service}>
                  {SERVICE_BY_CODE.get(job.serviceCode)?.name[locale] ?? job.serviceCode} ·{' '}
                  {formatAreaShort(job.areaSqm, { locale })}
                </Text>
                <Text style={s.muted}>
                  {[job.village, job.isImmediate ? t('now', locale) : job.scheduledDate].filter(Boolean).join(' · ')}
                </Text>
                <Text style={s.muted}>
                  {job.farmerName} · {job.farmerPhone.slice(-10)}
                </Text>
                {job.captainName !== null && <Text style={s.captain}>→ {job.captainName}</Text>}

                {job.status === 'in_progress' && (
                  <TextInput
                    style={s.input}
                    keyboardType="number-pad"
                    placeholder={t('founderAmount', locale)}
                    value={amounts[job.id] ?? ''}
                    onChangeText={(v) => setAmounts((a) => ({ ...a, [job.id]: v }))}
                  />
                )}

                <View style={s.actions}>
                  {job.status === 'searching' ? (
                    <Button
                      label={t('founderAssign', locale)}
                      onPress={() => setMode({ kind: 'assign', job })}
                      flex
                    />
                  ) : next !== undefined ? (
                    <Button
                      label={t(next.label, locale)}
                      onPress={() => void advance(job)}
                      disabled={busy === job.id}
                      flex
                    />
                  ) : null}
                  <Button
                    label={t('founderShare', locale)}
                    onPress={() => void Share.share({ message: shareText(job, 'pa') })}
                    variant="secondary"
                    flex
                  />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      <View style={s.footer}>
        <Button label={t('back', locale)} onPress={onBack} variant="secondary" />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const isoDay = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** What a phone booking says: who, what, how big, where and when. */
export interface PhoneBooking {
  phone: string;
  name: string;
  village: string;
  serviceCode: string;
  areaSqm: number;
  at: { lat: number; lng: number };
  isImmediate: boolean;
  scheduledDate: string | null;
  window: JobWindow;
}

/**
 * A job taken on the phone. The founder's (4.2) and a captain's own (4.3):
 * the same form, a different `onCreate`. A captain sees only his own services.
 */
export function PhoneBookingForm({
  locale,
  onDone,
  onCreate,
  serviceCodes,
}: {
  locale: Locale;
  onDone: () => void;
  onCreate: (booking: PhoneBooking) => Promise<boolean>;
  serviceCodes?: readonly string[];
}) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [village, setVillage] = useState('');
  const [service, setService] = useState<string | null>(null);
  const [killa, setKilla] = useState('');
  const [kanal, setKanal] = useState('');
  const [when, setWhen] = useState<'now' | 'today' | 'tomorrow'>('now');
  const [window, setWindow] = useState<JobWindow>('any');
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const services = useMemo(
    () =>
      serviceCodes === undefined
        ? servicesForMonth(new Date().getMonth() + 1)
        : serviceCodes.flatMap((c) => SERVICE_BY_CODE.get(c) ?? []),
    [serviceCodes],
  );
  const area = areaFromKillaKanal(killa, kanal);

  useEffect(() => {
    void currentLatLng().then((p) => setCenter(p ?? FAZILKA));
  }, []);

  const create = async () => {
    if (phone.replace(/\D/g, '').length < 10 || name.trim() === '' || service === null || area === null || center === null) {
      Alert.alert(t('founderMissing', locale));
      return;
    }
    setSaving(true);
    const ok = await onCreate({
      phone,
      name,
      village,
      serviceCode: service,
      areaSqm: area,
      at: center,
      isImmediate: when === 'now',
      scheduledDate: when === 'now' ? null : isoDay(when === 'today' ? 0 : 1),
      window,
    });
    setSaving(false);
    if (!ok) {
      Alert.alert(t('founderFailed', locale));
      return;
    }
    onDone();
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.title2}>{t('founderNewJob', locale)}</Text>

        <TextInput style={s.input} placeholder={t('founderFarmerPhone', locale)} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <TextInput style={s.input} placeholder={t('founderFarmerName', locale)} value={name} onChangeText={setName} />
        <TextInput style={s.input} placeholder={t('founderVillage', locale)} value={village} onChangeText={setVillage} />

        <View style={s.chips}>
          {services.slice(0, 8).map((sv) => (
            <Chip key={sv.code} label={sv.name[locale]} on={service === sv.code} onPress={() => setService(sv.code)} />
          ))}
        </View>

        <Text style={s.section}>{t('founderArea', locale)}</Text>
        <View style={s.row}>
          <TextInput style={[s.input, s.flex]} keyboardType="number-pad" placeholder={t('founderKilla', locale)} value={killa} onChangeText={setKilla} />
          <TextInput style={[s.input, s.flex]} keyboardType="number-pad" placeholder={t('founderKanal', locale)} value={kanal} onChangeText={setKanal} />
        </View>
        {area !== null && <Text style={s.service}>{formatAreaShort(area, { locale })}</Text>}

        <View style={s.chips}>
          {(['now', 'today', 'tomorrow'] as const).map((w) => (
            <Chip key={w} label={t(w, locale)} on={when === w} onPress={() => setWhen(w)} />
          ))}
        </View>
        {when !== 'now' && (
          <View style={s.chips}>
            {([['morning', 'morning'], ['afternoon', 'afternoon'], ['evening', 'evening'], ['any', 'anyTime']] as const).map(([w, key]) => (
              <Chip key={w} label={t(key, locale)} on={window === w} onPress={() => setWindow(w)} />
            ))}
          </View>
        )}

        <Text style={s.muted}>{t('founderPin', locale)}</Text>
        <PinMap center={center} onMove={setCenter} />
      </ScrollView>
      <View style={s.footer}>
        <View style={s.row}>
          <Button label={t('cancel', locale)} onPress={onDone} variant="ghost" flex />
          <Button label={t('founderCreate', locale)} onPress={() => void create()} disabled={saving} flex />
        </View>
      </View>
    </View>
  );
}

/** A map whose centre is the pin: he moves the map, not the pin. Null centre: still locating. */
export function PinMap({
  center,
  onMove,
  zoom = 0.03,
}: {
  center: { lat: number; lng: number } | null;
  onMove: (p: { lat: number; lng: number }) => void;
  zoom?: number;
}) {
  return (
    <View style={s.mapWrap}>
      {center === null ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            mapType="hybrid"
            initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: zoom, longitudeDelta: zoom } as Region}
            onRegionChangeComplete={(r) => onMove({ lat: r.latitude, lng: r.longitude })}
          />
          <View pointerEvents="none" style={s.pin}>
            <Text style={s.pinText}>📍</Text>
          </View>
        </>
      )}
    </View>
  );
}

function AssignCaptain({ locale, job, onDone }: { locale: Locale; job: FounderJob; onDone: () => void }) {
  const [captains, setCaptains] = useState<FounderCaptain[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchFounderCaptains(job.id).then(setCaptains);
  }, [job.id]);

  const choose = async (c: FounderCaptain) => {
    setBusy(true);
    const ok = await founderAssign(job.id, c.captainId);
    setBusy(false);
    if (!ok) {
      Alert.alert(t('founderFailed', locale));
      return;
    }
    onDone();
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.title2}>{t('founderAssign', locale)}</Text>
        <Text style={s.muted}>{shareText(job, locale).split('\n').slice(0, 3).join('  ')}</Text>
        {captains === null ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : captains.length === 0 ? (
          <Card>
            <Text style={s.muted}>{t('founderNoCaptains', locale)}</Text>
          </Card>
        ) : (
          captains.map((c) => (
            <Pressable key={c.captainId} onPress={() => void choose(c)} disabled={busy} style={s.captainRow}>
              <Text style={s.service}>
                {c.isOnline ? '🟢' : '⚪'} {c.fullName}
              </Text>
              <Text style={s.muted}>
                {[c.village, c.distanceKm === null ? null : `${Math.round(c.distanceKm)} km`, c.phone.slice(-10)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
      <View style={s.footer}>
        <Button label={t('back', locale)} onPress={onDone} variant="secondary" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primaryDark, padding: space.md },
  title: { ...type.title, color: colors.textInverse },
  title2: { ...type.title, color: colors.text },
  body: { padding: space.md, gap: space.md },
  section: { ...type.label, color: colors.textMuted },
  muted: { ...type.label, fontWeight: '400', color: colors.textMuted },
  service: { ...type.body, fontSize: 20, color: colors.text },
  captain: { ...type.label, color: colors.primary },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  input: {
    ...type.body,
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.label, color: colors.text },
  chipTextOn: { color: colors.textInverse },
  mapWrap: { height: 260, borderRadius: radius.md, overflow: 'hidden', justifyContent: 'center' },
  pin: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pinText: { fontSize: 36, marginBottom: 36 },
  captainRow: {
    minHeight: 56,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: { padding: space.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
