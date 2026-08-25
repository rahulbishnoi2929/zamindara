import { describe, expect, it } from 'vitest';
import { MACHINE_BY_CODE, MACHINE_TYPES } from '../src/machines.js';
import {
  SERVICES,
  servicesForMachines,
  servicesForMonth,
} from '../src/services.js';

describe('the machine catalogue', () => {
  it('has unique codes', () => {
    const codes = MACHINE_TYPES.map((m) => m.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('names every machine in all three languages', () => {
    for (const machine of MACHINE_TYPES) {
      expect(machine.name.en.length, machine.code).toBeGreaterThan(0);
      expect(machine.name.pa.length, machine.code).toBeGreaterThan(0);
      expect(machine.name.hi.length, machine.code).toBeGreaterThan(0);
    }
  });

  it('writes Punjabi in Gurmukhi and Hindi in Devanagari', () => {
    // An English name leaking into the pa or hi slot would show a captain a
    // word he cannot read, on the screen where he picks his own machine.
    const gurmukhi = /[਀-੿]/;
    const devanagari = /[ऀ-ॿ]/;

    for (const machine of MACHINE_TYPES) {
      expect(gurmukhi.test(machine.name.pa), `${machine.code} pa`).toBe(true);
      expect(devanagari.test(machine.name.hi), `${machine.code} hi`).toBe(true);
    }
  });

  it('carries the locally specific machines', () => {
    // A catalogue copied from a generic equipment list would not have these.
    // The toori cut is a real second job behind every combine, and kinnow
    // spraying is what keeps Fazilka captains earning in December.
    expect(MACHINE_BY_CODE.has('straw_reaper')).toBe(true);
    expect(MACHINE_BY_CODE.has('htp_sprayer')).toBe(true);
    expect(MACHINE_BY_CODE.has('cotton_shredder')).toBe(true);
  });

  it('prices repositioning by how hard the machine is to move', () => {
    const combine = MACHINE_BY_CODE.get('combine')!;
    const trolley = MACHINE_BY_CODE.get('trolley')!;
    expect(combine.travelRatePerKm).toBeGreaterThan(trolley.travelRatePerKm);
  });

  it('marks self-propelled machines as not needing a tractor', () => {
    expect(MACHINE_BY_CODE.get('combine')!.needsTractor).toBe(false);
    expect(MACHINE_BY_CODE.get('jcb')!.needsTractor).toBe(false);
    expect(MACHINE_BY_CODE.get('rotavator')!.needsTractor).toBe(true);
  });
});

describe('the service catalogue', () => {
  it('has unique codes', () => {
    const codes = SERVICES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('points every service at a machine that exists', () => {
    for (const service of SERVICES) {
      expect(MACHINE_BY_CODE.has(service.machineCode), service.code).toBe(true);
    }
  });

  it('uses only real months', () => {
    for (const service of SERVICES) {
      for (const month of service.seasonMonths) {
        expect(month, service.code).toBeGreaterThanOrEqual(1);
        expect(month, service.code).toBeLessThanOrEqual(12);
      }
    }
  });

  it('prices per killa unless the work is time-based', () => {
    // Levelling and earthwork cannot be known before the job is done.
    expect(SERVICES.find((s) => s.code === 'wheat_harvest')!.defaultUnit).toBe('per_killa');
    expect(SERVICES.find((s) => s.code === 'laser_levelling')!.defaultUnit).toBe('per_hour');
    expect(SERVICES.find((s) => s.code === 'earthwork')!.defaultUnit).toBe('per_hour');
  });
});

describe('what a captain can be offered', () => {
  it('derives services from the machines he registered', () => {
    const offered = servicesForMachines(['combine']).map((s) => s.code);
    expect(offered).toContain('wheat_harvest');
    expect(offered).toContain('paddy_harvest');
    // He has no rotavator, so he is never offered rotavator work.
    expect(offered).not.toContain('rotavator_work');
  });

  it('offers nothing to a captain with no machines', () => {
    expect(servicesForMachines([])).toHaveLength(0);
  });

  it('combines machines without duplicating services', () => {
    const offered = servicesForMachines(['combine', 'straw_reaper']);
    expect(offered.map((s) => s.code)).toContain('straw_collect');
    expect(new Set(offered.map((s) => s.code)).size).toBe(offered.length);
  });
});

describe('seasonal ordering', () => {
  it('puts wheat harvesting first in April', () => {
    expect(servicesForMonth(4)[0]!.code).toBe('wheat_harvest');
  });

  it('puts sowing near the top in November', () => {
    const top = servicesForMonth(11).slice(0, 5).map((s) => s.code);
    expect(top).toContain('wheat_sowing');
  });

  it('surfaces kinnow spraying in January', () => {
    // The off-season earner. If it were buried, captains would stop opening
    // the app in winter and be gone by April.
    const top = servicesForMonth(1).slice(0, 3).map((s) => s.code);
    expect(top).toContain('orchard_spray');
  });

  it('is stable — same month, same order', () => {
    expect(servicesForMonth(4).map((s) => s.code)).toEqual(
      servicesForMonth(4).map((s) => s.code),
    );
  });

  it('never loses a service', () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(servicesForMonth(month)).toHaveLength(SERVICES.length);
    }
  });
});
