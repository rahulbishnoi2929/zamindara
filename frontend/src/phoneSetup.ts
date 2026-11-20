/**
 * Phone setup (Stage 5). Pure, so it can be tested without a phone.
 *
 * Expo's AndroidImportance.HIGH. Below it, Android stops showing the ping as
 * a heads-up alert: it lands silently in the shade and he misses the work.
 */
const HEADS_UP = 6;

/** Is the work-request channel still strong enough to be seen? Null: unreadable, so no warning. */
export const alertOk = (importance: number | null): boolean => importance === null || importance >= HEADS_UP;

/** What he ticks himself: Android cannot tell us these. Kept on the phone only. */
export interface SetupTicks {
  battery: boolean;
  autostart: boolean;
  heard: boolean;
}

export const NO_TICKS: SetupTicks = { battery: false, autostart: false, heard: false };
