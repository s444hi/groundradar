import { getSeasonCalendarWeeks, getSlotCalendarWeeks } from "./scoring";
import type {
  Confidence,
  ConfidenceLevel,
  CropId,
  CropsById,
  FrostWeeks,
  RotationStrategy,
  SeasonResult,
  WeeklyClimatologyEntry,
} from "./types";

// NASA products this engine relies on resolve far coarser than a small plot:
// SMAP ~9km, GPM ~10km pixels. Below this, field-level estimates are
// meaningfully coarser than the field itself.
const SMALL_PLOT_ACRES_THRESHOLD = 5;

// Weather is judged against THIS FIELD'S OWN climatology, not a universal
// absolute number: a ±3-week circular window around a target week stands in
// for "normal for this time of year here." A smooth, strongly seasonal
// climate (e.g. a wet winter peak or a bone-dry summer) should never look
// "extreme" against its own immediate neighbors, even though it would
// against the whole year's mixed average.
const LOCAL_WINDOW_RADIUS_WEEKS = 3;
const ANOMALY_STD_MULTIPLIER = 2;
const MIN_HEAVY_RAIN_MM = 5; // floor so a near-zero local stddev can't flag a trivial drizzle
const MAX_DROUGHT_RAIN_MM = 1; // floor so "unusually dry" still requires essentially no rain that week

export interface ConfidenceInput {
  areaAcres: number;
  strategy: RotationStrategy;
  crops: CropsById;
  seasons: SeasonResult[];
  weeklyClimatology: WeeklyClimatologyEntry[];
  frostWeeks: FrostWeeks;
}

function wrapWeek(week: number): number {
  return ((week - 1 + 52) % 52) + 1;
}

function climatologyForWeek(
  weeklyClimatology: WeeklyClimatologyEntry[],
  week: number,
): WeeklyClimatologyEntry | undefined {
  return weeklyClimatology.find((entry) => entry.week === week);
}

function localStats(
  weeklyClimatology: WeeklyClimatologyEntry[],
  centerWeek: number,
  selector: (entry: WeeklyClimatologyEntry) => number,
): { mean: number; std: number } {
  const values: number[] = [];
  for (let offset = -LOCAL_WINDOW_RADIUS_WEEKS; offset <= LOCAL_WINDOW_RADIUS_WEEKS; offset++) {
    const entry = climatologyForWeek(weeklyClimatology, wrapWeek(centerWeek + offset));
    if (entry) values.push(selector(entry));
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

// Frost stays an absolute check (freezing is freezing, regardless of local
// statistics); heavy rain and drought are judged relative to this field's
// own nearby weeks.
function isAnomalousWeek(week: number, weeklyClimatology: WeeklyClimatologyEntry[]): boolean {
  const entry = climatologyForWeek(weeklyClimatology, week);
  if (!entry) return false;
  if (entry.temp_low_c <= 0) return true;

  const rain = localStats(weeklyClimatology, week, (e) => e.rainfall_mm);
  if (entry.rainfall_mm >= MIN_HEAVY_RAIN_MM && entry.rainfall_mm > rain.mean + ANOMALY_STD_MULTIPLIER * rain.std) {
    return true;
  }

  if (entry.rainfall_mm <= MAX_DROUGHT_RAIN_MM) {
    const moisture = localStats(weeklyClimatology, week, (e) => e.soil_moisture_m3_m3);
    if (entry.soil_moisture_m3_m3 < moisture.mean - ANOMALY_STD_MULTIPLIER * moisture.std) {
      return true;
    }
  }

  return false;
}

function seasonHasWeatherAnomaly(
  season: SeasonResult,
  crops: CropsById,
  frostWeeks: FrostWeeks,
  weeklyClimatology: WeeklyClimatologyEntry[],
): boolean {
  const slotWeeks = getSlotCalendarWeeks(season.crops, crops, frostWeeks);
  const relevantWeeks = slotWeeks.length > 0 ? slotWeeks : getSeasonCalendarWeeks(season.season, frostWeeks);
  return relevantWeeks.some((week) => isAnomalousWeek(week, weeklyClimatology));
}

/**
 * Confidence drops (engine rule 9) for: a plot small relative to NASA data
 * resolution, crops missing from crops.json, or weather weeks that are
 * unusual for THIS FIELD'S OWN climatology (not a fixed absolute threshold —
 * a normal seasonal wet peak or dry stretch shouldn't count as "extreme").
 */
export function computeConfidence(input: ConfidenceInput): Confidence {
  const reasons: string[] = [];

  if (input.areaAcres < SMALL_PLOT_ACRES_THRESHOLD) {
    reasons.push(
      `This ${input.areaAcres}-acre plot is small relative to NASA satellite data resolution (e.g. SMAP ~9km, GPM ~10km pixels), so field-level estimates are coarser than ideal.`,
    );
  }

  const missingCropIds = new Set<CropId>();
  for (const slot of input.strategy.timeline) {
    for (const id of slot.crops) {
      if (!input.crops[id]) missingCropIds.add(id);
    }
  }
  if (missingCropIds.size > 0) {
    const names = [...missingCropIds].join(", ");
    reasons.push(
      `${names} ${missingCropIds.size > 1 ? "are" : "is"} missing from the crop database, so ${missingCropIds.size > 1 ? "those crops were" : "it was"} treated as unplanted in scoring.`,
    );
  }

  const extremeWeatherSeasons = input.seasons.filter((s) =>
    seasonHasWeatherAnomaly(s, input.crops, input.frostWeeks, input.weeklyClimatology),
  );
  if (extremeWeatherSeasons.length > 0) {
    reasons.push(
      `${extremeWeatherSeasons.length} season(s) include weather weeks that are unusual for this field's own typical conditions (frost, an unusually wet week, or an unusually dry week relative to its seasonal norm), adding uncertainty to those seasons' scores.`,
    );
  }

  const level: ConfidenceLevel = reasons.length === 0 ? "High" : reasons.length === 1 ? "Medium" : "Low";
  if (reasons.length === 0) {
    reasons.push("Plot size, crop data, and weather conditions are all within normal ranges for this estimate.");
  }

  return { level, reasons };
}
