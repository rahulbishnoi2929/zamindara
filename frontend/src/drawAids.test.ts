import { describe, expect, it } from 'vitest';
import { MAX_VIEW_M, viewWidthM } from './drawAids';

describe('draw screen zoom gate (Stage 6)', () => {
  it('the opening view is close enough to place corners', () => {
    // DrawScreen opens at 0.0022 degrees across, in Fazilka.
    const w = viewWidthM({ latitude: 30.4, longitudeDelta: 0.0022 });
    expect(w).toBeGreaterThan(200);
    expect(w).toBeLessThan(MAX_VIEW_M);
  });
  it('zoomed out to a village, it is not', () => {
    expect(viewWidthM({ latitude: 30.4, longitudeDelta: 0.02 })).toBeGreaterThan(MAX_VIEW_M);
  });
});
