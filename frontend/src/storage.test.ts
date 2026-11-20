import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
const writes: string[] = [];

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      writes.push(v);
      store.set(k, v);
    },
    removeItem: async (k: string) => void store.delete(k),
    getAllKeys: async () => [...store.keys()],
    multiGet: async (ks: string[]) => ks.map((k) => [k, store.get(k) ?? null]),
    multiRemove: async (ks: string[]) => ks.forEach((k) => store.delete(k)),
  },
}));

const { appendWalkPoint, beginActiveWalk, clearActiveWalk, loadActiveWalk } = await import(
  './storage'
);

const pt = (i: number) => ({ lat: 30 + i / 1e5, lng: 74, accuracy: 4, timestamp: 1000 + i });

beforeEach(() => {
  store.clear();
  writes.length = 0;
});

describe('walk checkpoints', () => {
  it('appends: each point is one small write, never the whole track', async () => {
    await beginActiveWalk(1);
    for (let i = 0; i < 300; i += 1) await appendWalkPoint(1, i, pt(i));
    const biggest = Math.max(...writes.map((w) => w.length));
    expect(biggest).toBeLessThan(200);
    const walk = await loadActiveWalk();
    expect(walk?.startedAt).toBe(1);
    expect(walk?.points).toHaveLength(300);
    expect(walk?.points[299]).toEqual(pt(299));
  });

  it('restores in walking order, not key order (10 sorts before 9 as text)', async () => {
    await beginActiveWalk(1);
    for (const i of [10, 9, 0, 2, 1, 3, 4, 5, 6, 7, 8]) await appendWalkPoint(1, i, pt(i));
    const walk = await loadActiveWalk();
    expect(walk?.points.map((p) => p.timestamp)).toEqual([...Array(11)].map((_, i) => 1000 + i));
  });

  it('a new walk never inherits the last walk’s points', async () => {
    await beginActiveWalk(1);
    for (let i = 0; i < 50; i += 1) await appendWalkPoint(1, i, pt(i));
    await beginActiveWalk(2);
    await appendWalkPoint(2, 0, pt(0));
    expect((await loadActiveWalk())?.points).toHaveLength(1);
    expect([...store.keys()].filter((k) => k.includes('/1/'))).toHaveLength(0);
  });

  it('migrates a walk saved by an older build as one blob', async () => {
    store.set(
      'zamindara/active-walk',
      JSON.stringify({ startedAt: 7, points: [pt(0), pt(1), pt(2)] }),
    );
    const walk = await loadActiveWalk();
    expect(walk).toEqual({ startedAt: 7, points: [pt(0), pt(1), pt(2)] });
    expect(store.has('zamindara/active-walk')).toBe(false);
    // And it is now in the new form, so it survives a second restart.
    expect((await loadActiveWalk())?.points).toHaveLength(3);
  });

  it('clear removes everything, and nothing saved means null', async () => {
    await beginActiveWalk(1);
    await appendWalkPoint(1, 0, pt(0));
    await clearActiveWalk();
    expect(store.size).toBe(0);
    expect(await loadActiveWalk()).toBeNull();
  });
});

describe('starting a walk', () => {
  it('keeps a first point that landed before the old walk was cleared', async () => {
    await beginActiveWalk(1);
    await appendWalkPoint(1, 0, pt(0));
    await appendWalkPoint(2, 0, pt(5)); // new walk's first fix, early
    await beginActiveWalk(2);
    expect((await loadActiveWalk())?.points).toEqual([pt(5)]);
  });
});
