import { describe, expect, it } from 'vitest';
import { ringAreaSqm } from '../src/area.js';
import { project } from '../src/projection.js';
import { squareUp } from '../src/rectangle.js';

describe('rectangle snap on the draw screen (Stage 6)', () => {
  // A killa-ish field tapped slightly off: no two sides quite square.
  const tapped = [
    { lat: 30.4, lng: 74.0 },
    { lat: 30.4003, lng: 74.00072 },
    { lat: 30.40087, lng: 74.00069 },
    { lat: 30.40058, lng: 73.99996 },
  ];

  it('gives four corners at right angles', () => {
    const sq = squareUp(tapped)!;
    expect(sq).toHaveLength(4);
    const xy = sq.map((p) => project(p, sq[0]!));
    for (let i = 0; i < 4; i++) {
      const a = xy[i]!, b = xy[(i + 1) % 4]!, c = xy[(i + 2) % 4]!;
      const u = { x: b.x - a.x, y: b.y - a.y }, v = { x: c.x - b.x, y: c.y - b.y };
      const cos = (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
      expect(Math.abs(cos)).toBeLessThan(1e-4);
    }
  });

  it('keeps the area he drew', () => {
    const sq = squareUp(tapped)!;
    expect(Math.abs(ringAreaSqm(sq) / ringAreaSqm(tapped) - 1)).toBeLessThan(0.002);
  });

  it('only squares four corners', () => {
    expect(squareUp(tapped.slice(0, 3))).toBeNull();
  });
});
