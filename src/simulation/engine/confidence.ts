import type { Confidence, ConfidenceLevel, CropId, CropsById, RotationStrategy, SeasonResult } from "./types";

// NASA products this engine relies on resolve far coarser than a small plot:
// SMAP ~9km, GPM ~10km pixels. Below this, field-level estimates are
// meaningfully coarser than the field itself.
const SMALL_PLOT_ACRES_THRESHOLD = 5;

export interface ConfidenceInput {
  areaAcres: number;
  strategy: RotationStrategy;
  crops: CropsById;
  seasons: SeasonResult[];
}

/**
 * Confidence drops (engine rule 9) for: a plot small relative to NASA data
 * resolution, crops missing from crops.json, or extreme weather weeks
 * (reusing scoring.ts's already-detected weather_events).
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

  const extremeWeatherSeasons = input.seasons.filter((s) => s.weather_events.length > 0);
  if (extremeWeatherSeasons.length > 0) {
    reasons.push(
      `${extremeWeatherSeasons.length} season(s) include extreme weather weeks (frost, drought, or heavy rain), adding uncertainty to those seasons' scores.`,
    );
  }

  const level: ConfidenceLevel = reasons.length === 0 ? "High" : reasons.length === 1 ? "Medium" : "Low";
  if (reasons.length === 0) {
    reasons.push("Plot size, crop data, and weather conditions are all within normal ranges for this estimate.");
  }

  return { level, reasons };
}
