/**
 * @zamindara/pricing
 *
 * What a job costs, and what the going rate is nearby.
 *
 * Duplicated from the SQL in supabase/migrations on purpose: the database
 * prices authoritatively, the app must show a figure before the farmer
 * commits, and the two must never disagree. The tests assert they round
 * identically.
 */
export {
  quote,
  rateGuidance,
  roadKm,
  round2,
  type Quote,
  type QuoteInput,
  type RateGuidance,
} from './quote.js';
