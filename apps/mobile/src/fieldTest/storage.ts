import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TestMeasurement, TestPlot } from './types';

const KEY_PLOTS = 'zamindara/test-plots';
const KEY_MEASUREMENTS = 'zamindara/test-measurements';

async function readArray<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const loadPlots = (): Promise<TestPlot[]> => readArray<TestPlot>(KEY_PLOTS);

export async function upsertPlot(plot: TestPlot): Promise<TestPlot[]> {
  const plots = await loadPlots();
  const index = plots.findIndex((p) => p.id === plot.id);
  const next = index >= 0 ? plots.map((p) => (p.id === plot.id ? plot : p)) : [...plots, plot];
  await AsyncStorage.setItem(KEY_PLOTS, JSON.stringify(next));
  return next;
}

export async function deletePlot(plotId: string): Promise<void> {
  const plots = (await loadPlots()).filter((p) => p.id !== plotId);
  const measurements = (await loadMeasurements()).filter((m) => m.plotId !== plotId);
  await AsyncStorage.multiSet([
    [KEY_PLOTS, JSON.stringify(plots)],
    [KEY_MEASUREMENTS, JSON.stringify(measurements)],
  ]);
}

export const loadMeasurements = (): Promise<TestMeasurement[]> =>
  readArray<TestMeasurement>(KEY_MEASUREMENTS);

export async function addMeasurement(
  measurement: TestMeasurement,
): Promise<TestMeasurement[]> {
  const next = [...(await loadMeasurements()), measurement];
  await AsyncStorage.setItem(KEY_MEASUREMENTS, JSON.stringify(next));
  return next;
}

export async function updateMeasurement(
  measurement: TestMeasurement,
): Promise<TestMeasurement[]> {
  const next = (await loadMeasurements()).map((m) =>
    m.id === measurement.id ? measurement : m,
  );
  await AsyncStorage.setItem(KEY_MEASUREMENTS, JSON.stringify(next));
  return next;
}

export async function deleteMeasurement(id: string): Promise<TestMeasurement[]> {
  const next = (await loadMeasurements()).filter((m) => m.id !== id);
  await AsyncStorage.setItem(KEY_MEASUREMENTS, JSON.stringify(next));
  return next;
}
