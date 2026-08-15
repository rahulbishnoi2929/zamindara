/**
 * @zamindara/units
 *
 * Land area conversion and display for the Punjab / Haryana / North-Rajasthan
 * belt. This is the most safety-critical package in the repository: a bug here
 * overbills a farmer, and the area number is the one thing both sides of every
 * job have to agree on.
 *
 * Two rules, enforced throughout:
 *   1. Square metres is the only persisted form.
 *   2. Nothing shown to a farmer is ever a decimal.
 *
 * See docs/UNITS_AND_MEASUREMENT.md
 */

export {
  ACRE_SQM,
  CHAINS,
  HECTARE_SQM,
  KARAM_M,
  KILLA_LONG_SIDE_M,
  KILLA_SHORT_SIDE_M,
  LOCALES,
  MARLA,
  MARLA_SQM,
  SQM,
  UNITS,
  type DisplayChain,
  type Locale,
  type Unit,
} from './constants.js';

export { convert, fromSqm, toSqm, toWholeMarla } from './convert.js';

export {
  areaParts,
  formatArea,
  formatAreaShort,
  type AreaPart,
  type FormatOptions,
} from './format.js';

export { resolveUnit, unitName } from './names.js';

export { parseArea, type ParseResult } from './parse.js';
