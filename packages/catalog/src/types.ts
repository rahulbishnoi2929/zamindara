import type { Locale } from '@zamindara/units';

export type MachineCategory =
  | 'tillage'
  | 'sowing'
  | 'harvesting'
  | 'spraying'
  | 'haulage'
  | 'earthmoving';

export type PricingUnit = 'per_killa' | 'per_hour' | 'per_day' | 'per_job';

/** A name in every language the app speaks. */
export type LocalisedName = Record<Locale, string>;

export interface MachineType {
  code: string;
  name: LocalisedName;
  category: MachineCategory;
  /** False for self-propelled machines — a combine, a JCB, a tractor itself. */
  needsTractor: boolean;
  /**
   * What it costs to reposition, per km beyond the free radius.
   * A self-propelled combine is expensive to move; a towed trolley is not.
   */
  travelRatePerKm: number;
  /**
   * Placeholder glyph until real photographs exist.
   *
   * The flows call for an illustrated grid rather than a list of English
   * words, because the captain choosing from it may not read comfortably.
   * Emoji are a stand-in for that, not the answer — a photograph of the
   * actual machine is what a farmer recognises.
   */
  glyph: string;
  sortOrder: number;
}

export interface Service {
  code: string;
  name: LocalisedName;
  /** The machine this work needs. Ties a captain's registry to what he can do. */
  machineCode: string;
  defaultUnit: PricingUnit;
  /** Rough duration, for queue planning and ETAs. Null where time-priced. */
  estMinutesPerKilla: number | null;
  /**
   * Months this work happens in, 1–12. Drives the seasonal reordering of the
   * farmer's job grid: harvesting first in April, sowing in November,
   * orchard spraying in January.
   */
  seasonMonths: number[];
  sortOrder: number;
}
