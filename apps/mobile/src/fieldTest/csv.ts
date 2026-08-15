import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildCsv } from './csvBuilder';
import type { TestMeasurement, TestPlot } from './types';

export { buildCsv } from './csvBuilder';

/** Write the CSV to a file and open the Android share sheet. */
export async function exportCsv(
  plots: TestPlot[],
  measurements: TestMeasurement[],
): Promise<{ ok: boolean; message: string }> {
  try {
    const csv = buildCsv(plots, measurements);
    const stamp = new Date().toISOString().slice(0, 10);

    const directory = new Directory(Paths.cache, 'field-test');
    if (!directory.exists) directory.create();

    const file = new File(directory, `zamindara-field-test-${stamp}.csv`);
    if (file.exists) file.delete();
    file.create();
    file.write(csv);

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, message: `Saved to ${file.uri}, but sharing is unavailable.` };
    }

    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Zamindara field test results',
      UTI: 'public.comma-separated-values-text',
    });

    return { ok: true, message: 'Exported.' };
  } catch (error) {
    return { ok: false, message: `Export failed: ${String(error)}` };
  }
}
