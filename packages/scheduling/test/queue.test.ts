import { SQM } from '@zamindara/units';
import { describe, expect, it } from 'vitest';
import {
  buildSchedule,
  DEFAULT_HOURS,
  findInSchedule,
  SETUP_MINUTES,
  suggestOrder,
  travelMinutes,
  workMinutes,
  type QueueJob,
} from '../src/queue.js';

const at = (hour: number, minute = 0): Date =>
  new Date(2027, 3, 15, hour, minute, 0, 0); // 15 April 2027 — harvest week

const job = (id: string, killa: number, distanceKm: number, mins: number | null = 25): QueueJob => ({
  id,
  areaSqm: SQM.killa * killa,
  estMinutesPerKilla: mins,
  distanceKm,
});

describe('how long the work takes', () => {
  it('scales with area', () => {
    // A combine does roughly a killa in 25 minutes.
    expect(workMinutes(SQM.killa, 25)).toBeCloseTo(25, 6);
    expect(workMinutes(SQM.killa * 4, 25)).toBeCloseTo(100, 6);
  });

  it('returns null for time-priced work', () => {
    // Levelling is sold by the hour. Its duration is the product, so it
    // cannot be predicted, and guessing would be worse than saying so.
    expect(workMinutes(SQM.killa, null)).toBeNull();
  });

  it('rejects a nonsense area', () => {
    expect(() => workMinutes(0, 25)).toThrow(RangeError);
    expect(() => workMinutes(-1, 25)).toThrow(RangeError);
  });
});

describe('travel', () => {
  it('scales with distance', () => {
    expect(travelMinutes(9)).toBeCloseTo(30, 5);
    expect(travelMinutes(0)).toBe(0);
  });

  it('rejects a negative distance', () => {
    expect(() => travelMinutes(-2)).toThrow(RangeError);
  });
});

describe('the queue laid out in time', () => {
  it('numbers jobs from one, in the captain order', () => {
    const schedule = buildSchedule([job('a', 2, 3), job('b', 1, 4)], at(8));
    expect(schedule.map((x) => x.id)).toEqual(['a', 'b']);
    expect(schedule.map((x) => x.position)).toEqual([1, 2]);
  });

  it('starts the first job after travelling to it', () => {
    const schedule = buildSchedule([job('a', 1, 9)], at(8));
    // 9 km at 18 km/h is half an hour.
    expect(schedule[0]!.startsAt.getHours()).toBe(8);
    expect(schedule[0]!.startsAt.getMinutes()).toBe(30);
  });

  it('stacks each job behind the one before it', () => {
    const schedule = buildSchedule([job('a', 2, 0), job('b', 2, 0)], at(8));
    expect(schedule[1]!.startsAt.getTime()).toBeGreaterThanOrEqual(
      schedule[0]!.endsAt.getTime(),
    );
  });

  it('includes setup time per job', () => {
    const schedule = buildSchedule([job('a', 1, 0)], at(8));
    const minutes =
      (schedule[0]!.endsAt.getTime() - schedule[0]!.startsAt.getTime()) / 60000;
    expect(minutes).toBeCloseTo(25 + SETUP_MINUTES, 5);
  });

  it('answers the question a farmer actually asks', () => {
    // "You are 4th today, he reaches you around..."
    const schedule = buildSchedule(
      [job('a', 3, 2), job('b', 2, 3), job('c', 4, 2), job('mine', 2, 3)],
      at(7),
    );
    const mine = findInSchedule(schedule, 'mine')!;

    expect(mine.position).toBe(4);
    expect(mine.startsAt.getTime()).toBeGreaterThan(at(7).getTime());
    // Four jobs of that size cannot all be done before lunch.
    expect(mine.startsAt.getHours()).toBeGreaterThanOrEqual(11);
  });
});

describe('working hours', () => {
  it('does not start a captain before dawn', () => {
    const schedule = buildSchedule([job('a', 1, 0)], at(4));
    expect(schedule[0]!.startsAt.getHours()).toBe(DEFAULT_HOURS.startHour);
  });

  it('rolls work past knocking-off time to the next morning', () => {
    // A farmer told "8pm" who sees nobody arrive stops believing the app.
    // Better to promise tomorrow morning and mean it.
    const schedule = buildSchedule([job('a', 6, 0), job('b', 6, 0), job('c', 6, 0)], at(16));
    const rolled = schedule.filter((x) => x.rolledToNextDay);

    expect(rolled.length).toBeGreaterThan(0);
    expect(rolled[0]!.startsAt.getHours()).toBe(DEFAULT_HOURS.startHour);
    expect(rolled[0]!.startsAt.getDate()).toBe(16);
  });

  it('honours a captain who works a longer day', () => {
    const late = buildSchedule([job('a', 2, 0)], at(18), { startHour: 6, endHour: 22 });
    expect(late[0]!.rolledToNextDay).toBe(false);
  });

  it('never promises a start after the day ends', () => {
    const schedule = buildSchedule(
      Array.from({ length: 8 }, (_, i) => job(String(i), 3, 2)),
      at(7),
    );
    for (const item of schedule) {
      expect(item.startsAt.getHours()).toBeLessThan(DEFAULT_HOURS.endHour);
    }
  });
});

describe('time-priced work in a queue', () => {
  it('does not promise the jobs behind it absurdly early', () => {
    // Levelling has no known duration. Assuming it is instant would tell the
    // next farmer his combine arrives in twenty minutes.
    const schedule = buildSchedule([job('level', 2, 0, null), job('next', 1, 0)], at(7));
    const gap = (schedule[1]!.startsAt.getTime() - schedule[0]!.startsAt.getTime()) / 60000;
    expect(gap).toBeGreaterThan(120);
  });
});

describe('suggested order', () => {
  const distance = (a: QueueJob, b: QueueJob): number =>
    Math.abs(a.distanceKm - b.distanceKm);

  it('starts with the nearest job to the captain', () => {
    const ordered = suggestOrder([job('far', 1, 20), job('near', 1, 2)], distance);
    expect(ordered[0]!.id).toBe('near');
  });

  it('keeps every job exactly once', () => {
    const jobs = [job('a', 1, 5), job('b', 1, 12), job('c', 1, 3), job('d', 1, 8)];
    const ordered = suggestOrder(jobs, distance);
    expect(ordered).toHaveLength(4);
    expect(new Set(ordered.map((j) => j.id)).size).toBe(4);
  });

  it('handles an empty queue', () => {
    expect(suggestOrder([], distance)).toEqual([]);
  });

  it('produces a shorter run than the worst possible order', () => {
    const jobs = [job('a', 1, 1), job('b', 1, 30), job('c', 1, 2), job('d', 1, 28)];
    const ordered = suggestOrder(jobs, distance);

    const run = (list: QueueJob[]): number =>
      list.slice(1).reduce((sum, j, i) => sum + distance(list[i]!, j), 0);

    expect(run(ordered)).toBeLessThan(run(jobs));
  });
});
