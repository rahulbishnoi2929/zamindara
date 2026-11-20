import type { Locale } from '@zamindara/units';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card } from './components';
import { PinMap } from './FounderScreen';
import { t } from './i18n';
import { addDays, overlapsRoute, type RouteStop } from './profile';
import { uuid } from './sync/mapping';
import { colors, radius, space, type } from './theme';

interface Props {
  locale: Locale;
  stops: RouteStop[];
  /** Where to open the map: where he is, or Fazilka. */
  near: { lat: number; lng: number } | null;
  /** The same array back when nothing changed. */
  onDone: (stops: RouteStop[]) => void;
}

const FAZILKA = { lat: 30.4036, lng: 74.0284 };

/** Today, on the phone's calendar. */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** 12/03 — the way a date is written here, and short enough for a tractor seat. */
const short = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * A migrant combine's route (Stage 4.7): where he will be, from when, for
 * how long. Dispatch matches him from the stop covering a job's day. Dates
 * by − and + rather than a calendar: no new dependency, and big targets.
 */
export function RouteScreen({ locale, stops: initial, near, onDone }: Props) {
  const [stops, setStops] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [place, setPlace] = useState('');
  const [center, setCenter] = useState(near ?? FAZILKA);
  const [startIn, setStartIn] = useState(0);
  const [days, setDays] = useState(7);

  const fromDate = addDays(today(), startIn);
  const toDate = addDays(fromDate, days - 1);

  const add = () => {
    if (place.trim() === '') {
      Alert.alert(t('routePlace', locale));
      return;
    }
    if (overlapsRoute(stops, { fromDate, toDate })) {
      Alert.alert(t('routeOverlap', locale));
      return;
    }
    const next = [...stops, { id: uuid(), place: place.trim(), lat: center.lat, lng: center.lng, fromDate, toDate }];
    setStops(next.sort((a, b) => a.fromDate.localeCompare(b.fromDate)));
    setAdding(false);
    setPlace('');
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{t('myRoute', locale)}</Text>
        <Text style={s.muted}>{t('routeHint', locale)}</Text>

        {stops.length === 0 && !adding && (
          <Card>
            <Text style={s.muted}>{t('routeEmpty', locale)}</Text>
          </Card>
        )}
        {stops.map((stop) => (
          <Card key={stop.id}>
            <View style={s.row}>
              <View style={s.flex}>
                <Text style={s.place}>{stop.place}</Text>
                <Text style={s.muted}>
                  {short(stop.fromDate)} – {short(stop.toDate)}
                </Text>
              </View>
              <Pressable
                onPress={() => setStops(stops.filter((x) => x.id !== stop.id))}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={`✕ ${stop.place}`}
                style={s.remove}
              >
                <Text style={s.removeText}>✕</Text>
              </Pressable>
            </View>
          </Card>
        ))}

        {adding ? (
          <>
            <TextInput style={s.input} placeholder={t('routePlace', locale)} value={place} onChangeText={setPlace} />
            <Stepper
              label={t('routeFrom', locale)}
              value={short(fromDate)}
              onMinus={() => setStartIn(Math.max(0, startIn - 1))}
              onPlus={() => setStartIn(Math.min(120, startIn + 1))}
            />
            <Stepper
              label={t('routeDays', locale)}
              value={String(days)}
              onMinus={() => setDays(Math.max(1, days - 1))}
              onPlus={() => setDays(Math.min(60, days + 1))}
            />
            <Text style={s.muted}>{t('routePin', locale)}</Text>
            <PinMap center={center} onMove={setCenter} zoom={0.3} />
            <View style={s.row}>
              <Button label={t('cancel', locale)} onPress={() => setAdding(false)} variant="ghost" flex />
              <Button label={t('save', locale)} onPress={add} flex />
            </View>
          </>
        ) : (
          <Button label={t('routeAdd', locale)} onPress={() => setAdding(true)} variant="secondary" />
        )}
      </ScrollView>
      <View style={s.footer}>
        <Button label={t('done', locale)} onPress={() => onDone(stops)} />
      </View>
    </View>
  );
}

export function Stepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={s.stepper}>
      <Text style={[s.muted, s.flex]}>{label}</Text>
      <Pressable onPress={onMinus} style={s.step} accessibilityRole="button" accessibilityLabel={`${label} −`}>
        <Text style={s.stepText}>−</Text>
      </Pressable>
      <Text style={s.value}>{value}</Text>
      <Pressable onPress={onPlus} style={s.step} accessibilityRole="button" accessibilityLabel={`${label} +`}>
        <Text style={s.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.md, gap: space.md },
  title: { ...type.title, color: colors.text },
  muted: { ...type.label, fontWeight: '400', color: colors.textMuted },
  place: { ...type.body, color: colors.text },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  flex: { flex: 1 },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 28, color: colors.text },
  value: { ...type.body, color: colors.text, minWidth: 64, textAlign: 'center' },
  remove: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  removeText: { fontSize: 22, color: colors.textMuted },
  footer: { padding: space.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
