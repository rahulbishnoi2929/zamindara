/**
 * Land measurement constants for the Punjab / Haryana / North-Rajasthan belt.
 *
 * The entire package rests on one idea: **every unit in this belt is a whole
 * number of marlas.** That turns all decomposition into integer arithmetic and
 * removes floating-point carry bugs from the most price-sensitive code we own.
 *
 *     1 marla  =   1 marla
 *     1 kanal  =  20 marla
 *     1 bigha  = 100 marla   (5 kanal — the "pucca" bigha)
 *     1 killa  = 160 marla   (8 kanal — exactly one acre)
 *
 * See docs/UNITS_AND_MEASUREMENT.md
 */

/** Units we support. Deliberately excludes murabba and sarsahi. */
export const UNITS = ['marla', 'kanal', 'bigha', 'killa'] as const;
export type Unit = (typeof UNITS)[number];

/**
 * Each unit expressed in whole marlas. This is the canonical ladder —
 * everything else is derived from it.
 */
export const MARLA: Readonly<Record<Unit, number>> = {
  marla: 1,
  kanal: 20,
  bigha: 100,
  killa: 160,
};

/**
 * One marla in square metres.
 *
 * Derived from the survey definition: 1 killa is exactly 1 acre, and
 * 1 acre = 4046.8564224 m² (international acre). 4046.8564224 / 160.
 */
export const MARLA_SQM = 25.29285264;

/** Square metres per unit. Derived — never hand-typed. */
export const SQM: Readonly<Record<Unit, number>> = {
  marla: MARLA.marla * MARLA_SQM,
  kanal: MARLA.kanal * MARLA_SQM,
  bigha: MARLA.bigha * MARLA_SQM,
  killa: MARLA.killa * MARLA_SQM,
};

/** One acre in square metres. A killa is exactly this. */
export const ACRE_SQM = 4046.8564224;

/** One hectare in square metres. Used for government/reporting contexts only. */
export const HECTARE_SQM = 10_000;

/**
 * Display chains. Bigha and killa are both top-level units and never stack
 * together, so a farmer picks one. Kanal and marla are shared by both.
 */
export const CHAINS = {
  killa: ['killa', 'kanal', 'marla'],
  bigha: ['bigha', 'kanal', 'marla'],
} as const satisfies Record<string, readonly Unit[]>;

export type DisplayChain = keyof typeof CHAINS;

/** Supported display languages. */
export const LOCALES = ['pa', 'hi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Canal-colony grid geometry.
 *
 * Fazilka is canal-colony land, laid out on the murabba grid where one killa
 * is a standard rectangle of 36 × 40 karam. 1 karam = 5.5 ft, so the plot is
 * 198 ft × 220 ft = 43,560 ft² = exactly one acre.
 *
 * This is what lets the boundary walk snap to the grid instead of trusting
 * raw GPS. See docs/UNITS_AND_MEASUREMENT.md, defence 3.
 */
export const KARAM_M = 5.5 * 0.3048; // 1.6764 m
export const KILLA_SHORT_SIDE_M = 36 * KARAM_M; // 198 ft ≈ 60.35 m
export const KILLA_LONG_SIDE_M = 40 * KARAM_M; // 220 ft ≈ 67.06 m
