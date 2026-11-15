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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Converts a 1-52 calendar week into its containing month's short name, using the week's approximate midpoint day-of-year against the same cumulative-days table getFrostWeek uses in reverse. */
export function weekToMonthName(calendarWeek: number): string {
  const dayOfYear = Math.min(365, Math.max(1, (calendarWeek - 1) * 7 + 4));
  let monthIndex = 0;
  for (let i = 0; i < 12; i++) {
    if (dayOfYear > CUMULATIVE_DAYS_BEFORE_MONTH[i]) monthIndex = i;
  }
  return MONTH_NAMES[monthIndex];
}
