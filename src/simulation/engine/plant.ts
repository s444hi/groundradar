import cropsJson from "../data/crops.json";
import { getFrostWeeks, weekToMonthDay } from "./frost";
import { scoreIncome, scoreNitrogen, scorePests, scoreWater } from "./scoring";
import { initSoilState, updateSoilAfterSeason } from "./soil";
import type { Crop, CropId, CropsById, FarmMode, FieldJson, Family, ScoreReason, WeeklyClimatologyEntry } from "./types";

const crops = cropsJson.crops as unknown as CropsById;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Wraps any integer week (including negative or >52, from a frost-anchored
// offset) onto the 1-52 calendar.
function wrapWeek(week: number): number {
  return (((week - 1) % 52) + 52) % 52 + 1;
}

function growthWeeks(plantingWeek: number, durationWeeks: number): number[] {
  const weeks: number[] = [];
  for (let i = 0; i < durationWeeks; i++) weeks.push(wrapWeek(plantingWeek + i));
  return weeks;
}

function climatologyForWeek(weeklyClimatology: WeeklyClimatologyEntry[], week: number): WeeklyClimatologyEntry | undefined {
  return weeklyClimatology.find((entry) => entry.week === week);
}

// Whether `week` falls inside the inclusive window [start, end] on a wrapped
// 1-52 calendar — the window itself may cross the year boundary (e.g. a
// cool-season crop planted in autumn, maturing the following spring).
function isWeekInWindow(week: number, start: number, end: number): boolean {
  if (start <= end) return week >= start && week <= end;
  return week >= start || week <= end;
}

function scorePlantingSeasonFit(
  crop: Crop,
  plantingWeek: number,
  windowStart: number,
  windowEnd: number,
): { score: number; reasons: ScoreReason[] } {
  if (isWeekInWindow(plantingWeek, windowStart, windowEnd)) {
    return {
      score: 100,
      reasons: [
        {
          delta: 0,
          text: `${crop.display_name} is planted within its normal planting window (${weekToMonthDay(windowStart)} – ${weekToMonthDay(windowEnd)}).`,
          category: "season_fit",
        },
      ],
    };
  }

  const distanceFrom = (target: number) => {
    const diff = Math.abs(plantingWeek - target);
    return Math.min(diff, 52 - diff);
  };
  const weeksOutside = Math.min(distanceFrom(windowStart), distanceFrom(windowEnd));
  const penalty = clamp(weeksOutside * 8, 0, 80);
  return {
    score: clamp(100 - penalty, 0, 100),
    reasons: [
      {
        delta: -penalty,
        text: `${crop.display_name} is normally planted ${weekToMonthDay(windowStart)} – ${weekToMonthDay(windowEnd)}; planting around ${weekToMonthDay(plantingWeek)} is ${weeksOutside} week(s) outside that window.`,
        category: "season_fit",
      },
    ],
  };
}

function scorePlantingFrostRisk(
  crop: Crop,
  weeks: number[],
  weeklyClimatology: WeeklyClimatologyEntry[],
): { score: number; reasons: ScoreReason[] } {
  if (crop.frost_tolerant) {
    return {
      score: 100,
      reasons: [{ delta: 0, text: `${crop.display_name} is frost tolerant, so frost isn't a risk during its growth.`, category: "season_fit" }],
    };
  }

  const frostWeeksHit = weeks.filter((week) => {
    const climate = climatologyForWeek(weeklyClimatology, week);
    return climate != null && climate.temp_low_c <= 0;
  });

  if (frostWeeksHit.length === 0) {
    return {
      score: 100,
      reasons: [{ delta: 0, text: `No frost weeks overlap ${crop.display_name}'s growth period.`, category: "season_fit" }],
    };
  }

  const penalty = clamp(frostWeeksHit.length * 25, 0, 100);
  return {
    score: clamp(100 - penalty, 0, 100),
    reasons: [
      {
        delta: -penalty,
        text: `${crop.display_name} is not frost tolerant, and ${frostWeeksHit.length} week(s) of its growth period (around ${frostWeeksHit.map(weekToMonthDay).join(", ")}) overlap expected frost.`,
        category: "season_fit",
      },
    ],
  };
}

export interface PlantingResult {
  cropId: CropId;
  plantingWeek: number; // 1-52, as chosen (may be outside the crop's own window)
  durationWeeks: number;
  endWeek: number; // 1-52, wrapped
  windowStartWeek: number; // 1-52, the crop's own declared window
  windowEndWeek: number; // 1-52
  inWindow: boolean;
  overallScore: number;
  seasonFitScore: number;
  waterScore: number;
  frostRiskScore: number;
  soilScore: number;
  incomeScore: number;
  nitrogenChange: number;
  pestFamily: Family;
  reasons: ScoreReason[];
}

/**
 * Plant mode (engine side): scores a single crop planted in otherwise-fresh
 * soil (the field's own soil levels, but no past-rotation priming) at a
 * chosen week — which need not be inside the crop's own planting window, so
 * the UI's slider can show what happens (and warn) outside it. Reuses
 * scoring.ts's scoreWater/scoreNitrogen/scorePests/scoreIncome directly;
 * season fit and frost risk are planting-mode-specific (a single arbitrary
 * week, not a season slot), so they're computed here.
 */
export function simulatePlanting(fieldJson: FieldJson, cropId: CropId, plantingWeek: number): PlantingResult | null {
  const crop = crops[cropId];
  if (!crop || !crop.planting_window || crop.days_to_maturity == null) return null;

  const frostWeeks = getFrostWeeks(fieldJson.climate_data.frost_dates);
  const windowStartWeek = wrapWeek(frostWeeks[crop.planting_window.anchor] + crop.planting_window.start_week_offset);
  const windowEndWeek = wrapWeek(frostWeeks[crop.planting_window.anchor] + crop.planting_window.end_week_offset);
  const durationWeeks = Math.ceil(crop.days_to_maturity / 7);
  const weeks = growthWeeks(plantingWeek, durationWeeks);
  const endWeek = weeks[weeks.length - 1];
  const inWindow = isWeekInWindow(plantingWeek, windowStartWeek, windowEndWeek);

  const freshSoil = initSoilState(fieldJson.field_profile.soil, [], crops);

  const seasonFit = scorePlantingSeasonFit(crop, plantingWeek, windowStartWeek, windowEndWeek);
  const frostRisk = scorePlantingFrostRisk(crop, weeks, fieldJson.climate_data.weekly_climatology);
  const water = scoreWater([cropId], crops, weeks, fieldJson.climate_data.weekly_climatology);
  const nitrogen = scoreNitrogen([cropId], crops, freshSoil);
  const pests = scorePests([cropId], crops, freshSoil);
  const income = scoreIncome([cropId], crops);

  const soilScore = (nitrogen.score + pests.score) / 2;
  const afterSoil = updateSoilAfterSeason(freshSoil, [cropId], crops);
  const nitrogenChange = afterSoil.nitrogen - freshSoil.nitrogen;

  const priorities = fieldJson.survey_inputs.priorities;
  const denominator = priorities.water + priorities.soil_health + priorities.pests + priorities.income;
  const numerator =
    water.score * priorities.water +
    nitrogen.score * priorities.soil_health +
    pests.score * priorities.pests +
    income.score * priorities.income;
  const weightedAverage = denominator > 0 ? numerator / denominator : 100;
  // Season fit and frost risk both act as multipliers (engine rule 8's
  // "season fit always counts at full weight", extended here with a second
  // multiplier for frost specifically) rather than being averaged in, so
  // either one tanking the score isn't diluted by the other components.
  const overallScore = weightedAverage * (seasonFit.score / 100) * (frostRisk.score / 100);

  const reasons: ScoreReason[] = [
    ...seasonFit.reasons,
    ...frostRisk.reasons,
    ...water.reasons,
    ...nitrogen.reasons,
    ...pests.reasons,
    ...income.reasons,
  ];

  return {
    cropId,
    plantingWeek,
    durationWeeks,
    endWeek,
    windowStartWeek,
    windowEndWeek,
    inWindow,
    overallScore,
    seasonFitScore: seasonFit.score,
    waterScore: water.score,
    frostRiskScore: frostRisk.score,
    soilScore,
    incomeScore: income.score,
    nitrogenChange,
    pestFamily: crop.family,
    reasons,
  };
}

/** Scans every week inside the crop's own planting window and returns the one that scores highest. */
export function bestPlantingWeek(fieldJson: FieldJson, cropId: CropId): number | null {
  const crop = crops[cropId];
  if (!crop || !crop.planting_window) return null;

  const frostWeeks = getFrostWeeks(fieldJson.climate_data.frost_dates);
  const rawStart = frostWeeks[crop.planting_window.anchor] + crop.planting_window.start_week_offset;
  const rawEnd = frostWeeks[crop.planting_window.anchor] + crop.planting_window.end_week_offset;

  let bestWeek: number | null = null;
  let bestScore = -Infinity;
  for (let raw = rawStart; raw <= rawEnd; raw++) {
    const week = wrapWeek(raw);
    const result = simulatePlanting(fieldJson, cropId, week);
    if (result && result.overallScore > bestScore) {
      bestScore = result.overallScore;
      bestWeek = week;
    }
  }
  return bestWeek;
}

export interface FollowUpSuggestion {
  cropId: CropId;
  reason: string;
}

function followUpReason(justPlanted: Crop, candidate: Crop): string {
  if (candidate.nutrient_role === "nitrogen_fixer" && justPlanted.nutrient_role === "heavy_feeder") {
    return `Fixes nitrogen that ${justPlanted.display_name} used up.`;
  }
  if (candidate.nutrient_role === "nitrogen_fixer") {
    return "Adds nitrogen for the next planting.";
  }
  if (candidate.is_cover_crop) {
    return "Covers and protects the soil before the next cash crop.";
  }
  return "A different plant family helps break pest and disease cycles.";
}

/**
 * Up to 3 good crops to follow the one just planted: different families
 * (never repeats the planted crop's own family, to actually break its pest
 * cycle), preferring a nitrogen fixer first when the planted crop was a
 * heavy feeder.
 */
export function suggestFollowUpCrops(cropId: CropId, mode: FarmMode): FollowUpSuggestion[] {
  const justPlanted = crops[cropId];
  if (!justPlanted) return [];

  const candidates = Object.entries(crops)
    .filter(([id, crop]) => id !== cropId && crop.planting_window != null && crop.family !== justPlanted.family && crop.fits.includes(mode))
    .map(([id, crop]) => ({ id, crop }));

  const prefersNitrogenFixer = justPlanted.nutrient_role === "heavy_feeder";
  candidates.sort((a, b) => {
    if (prefersNitrogenFixer) {
      const aFixer = a.crop.nutrient_role === "nitrogen_fixer" ? 1 : 0;
      const bFixer = b.crop.nutrient_role === "nitrogen_fixer" ? 1 : 0;
      if (aFixer !== bFixer) return bFixer - aFixer;
    }
    return 0;
  });

  const picked: FollowUpSuggestion[] = [];
  const usedFamilies = new Set<Family>();
  for (const { id, crop } of candidates) {
    if (usedFamilies.has(crop.family)) continue;
    usedFamilies.add(crop.family);
    picked.push({ cropId: id, reason: followUpReason(justPlanted, crop) });
    if (picked.length === 3) break;
  }
  return picked;
}
