import type { FrostDates, FrostWeeks } from "./types";

// Cumulative days before the start of each month (1-based month index - 1),
// on a fixed 365-day non-leap calendar. Avoids Date objects so the result
// is timezone-independent and deterministic.
const CUMULATIVE_DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** Parses an "MM-DD" string into a 1-52 week-of-year number. */
export function getFrostWeek(mmdd: string): number {
  const [monthStr, dayStr] = mmdd.split("-");
  const month = Number(monthStr);
  const day = Number(dayStr);
  const dayOfYear = CUMULATIVE_DAYS_BEFORE_MONTH[month - 1] + day;
  const week = Math.ceil(dayOfYear / 7);
  return Math.min(52, Math.max(1, week));
}

/** Converts both frost dates at once into a FrostWeeks lookup keyed by anchor name. */
export function getFrostWeeks(frostDates: FrostDates): FrostWeeks {
  return {
    last_spring_frost: getFrostWeek(frostDates.last_spring_frost),
    first_fall_frost: getFrostWeek(frostDates.first_fall_frost),
  };
}
