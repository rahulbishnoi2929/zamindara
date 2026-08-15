import type { Unit } from './constants.js';
import { toSqm } from './convert.js';
import { resolveUnit } from './names.js';

export interface ParseResult {
  sqm: number;
  parts: Array<{ unit: Unit; amount: number }>;
}

/**
 * Parse a written area into square metres.
 *
 *     parseArea('2 killa 3 kanal 8 marla')  →  9813.63 m²
 *     parseArea('4 ਕਿੱਲੇ')                  →  16187.4 m²
 *     parseArea('2.5 acre')                 →  10117.1 m²
 *
 * Used on the "declare" capture path, where a farmer types his area instead of
 * walking it, and when transcribing from a jamabandi. Those fields are flagged
 * unverified — see fields.capture_method in DATA_MODEL.md.
 *
 * Returns null if nothing parseable is found. Callers must handle that;
 * guessing at an area is how someone gets billed wrong.
 */
export function parseArea(input: string): ParseResult | null {
  if (typeof input !== 'string') return null;

  // Devanagari and Gurmukhi digits, so a farmer typing in his own keyboard works.
  const normalised = input
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[੦-੯]/g, (d) => String(d.charCodeAt(0) - 0x0a66))
    .toLowerCase();

  // <number> <unit-word>, repeated. Tolerates commas, hyphens and extra spaces.
  const pattern = /(\d+(?:\.\d+)?)\s*([^\d\s,\-]+)/gu;
  const parts: Array<{ unit: Unit; amount: number }> = [];
  const seen = new Set<Unit>();

  for (const match of normalised.matchAll(pattern)) {
    const amount = Number(match[1]);
    const unit = resolveUnit(match[2] ?? '');

    if (unit === null || !Number.isFinite(amount) || amount < 0) continue;
    if (seen.has(unit)) continue; // "2 killa 3 killa" — take the first only
    seen.add(unit);
    parts.push({ unit, amount });
  }

  if (parts.length === 0) return null;

  const sqm = parts.reduce((total, p) => total + toSqm(p.amount, p.unit), 0);
  return { sqm, parts };
}
