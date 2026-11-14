import type {
  Crop,
  CropId,
  CropsById,
  FrostWeeks,
  IncomeValue,
  Season,
  SeasonResult,
  SeasonSubscores,
  ScoreReason,
  SoilState,
  WaterNeed,
  WeatherEvent,
  WeeklyClimatologyEntry,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const WATER_NEED_SCORE: Record<WaterNeed, number> = { none: 0, low: 25, medium: 50, high: 75 };
const INCOME_VALUE_SCORE: Record<IncomeValue, number> = { none: 0, low: 35, medium: 65, high: 100 };
const EROSION_RISK_SCALE = 1; // points of erosion score lost per unit of accumulated weekly risk

export interface ScoreSeasonInput {
  year: number;
  season: Season;
  cropIds: CropId[];
  crops: CropsById;
  frostWeeks: FrostWeeks;
  weeklyClimatology: WeeklyClimatologyEntry[];
  slopePercent: number;
  soilBeforeSeason: SoilState;
}

function getLivingCrops(cropIds: CropId[], crops: CropsById): Crop[] {
  const result: Crop[] = [];
  for (const id of cropIds) {
    const crop = crops[id];
    if (crop && crop.planting_window) result.push(crop);
  }
  return result;
}

function climatologyForWeek(
  weeklyClimatology: WeeklyClimatologyEntry[],
  week: number,
): WeeklyClimatologyEntry | undefined {
  return weeklyClimatology.find((entry) => entry.week === week);
}

// A mix's crops are co-planted (same decision as timeline.ts): the shared
// window comes from the first crop's planting_window + days_to_maturity,
// expressed as wrapped calendar weeks (1-52) since scoring works one
// season at a time against the repeating annual climatology.
function getSlotCalendarWeeks(cropIds: CropId[], crops: CropsById, frostWeeks: FrostWeeks): number[] {
  const primary = crops[cropIds[0]];
  if (!primary || !primary.planting_window || primary.days_to_maturity == null) return [];

  const plantingWeek = frostWeeks[primary.planting_window.anchor] + primary.planting_window.start_week_offset;
  const durationWeeks = Math.ceil(primary.days_to_maturity / 7);
  const weeks: number[] = [];
  for (let i = 0; i < durationWeeks; i++) {
    const raw = plantingWeek + i - 1;
    weeks.push(((raw % 52) + 52) % 52 + 1);
  }
  return weeks;
}

// The whole season's calendar weeks, independent of what's planted, so a
// bare/fallow slot is still scored against the full window.
function getSeasonCalendarWeeks(season: Season, frostWeeks: FrostWeeks): number[] {
  const spring = frostWeeks.last_spring_frost;
  const fall = frostWeeks.first_fall_frost;
  const weeks: number[] = [];
  if (season === "warm_season") {
    for (let w = spring; w <= fall - 1; w++) weeks.push(w);
  } else {
    for (let w = fall; w <= 52; w++) weeks.push(w);
    for (let w = 1; w <= spring - 1; w++) weeks.push(w);
  }
  return weeks;
}

function scoreSeasonFit(
  cropIds: CropId[],
  crops: CropsById,
  season: Season,
): { score: number; reasons: ScoreReason[] } {
  let score = 100;
  const reasons: ScoreReason[] = [];

  for (const id of cropIds) {
    const crop = crops[id];
    if (!crop || !crop.planting_window) continue;

    if (crop.frost_tolerant === false && season === "cool_season") {
      score -= 30;
      reasons.push({
        delta: -30,
        text: `${crop.display_name} is not frost tolerant but is planted during the cool season, risking frost damage.`,
      });
    }
    if (crop.planting_window.end_week_offset < crop.planting_window.start_week_offset) {
      score -= 20;
      reasons.push({
        delta: -20,
        text: `${crop.display_name}'s planting window end offset falls before its start offset.`,
      });
    }
  }

  if (reasons.length === 0) {
    reasons.push({
      delta: 0,
      text: "All planted crops fit their planting window and frost tolerance requirements this season.",
    });
  }
  return { score: clamp(score, 0, 100), reasons };
}

function scoreWater(
  cropIds: CropId[],
  crops: CropsById,
  slotWeeks: number[],
  weeklyClimatology: WeeklyClimatologyEntry[],
): { score: number; reasons: ScoreReason[] } {
  const livingCrops = getLivingCrops(cropIds, crops);
  if (livingCrops.length === 0 || slotWeeks.length === 0) {
    return { score: 100, reasons: [{ delta: 0, text: "No crop planted this season, so no irrigation need." }] };
  }

  const entries = slotWeeks
    .map((w) => climatologyForWeek(weeklyClimatology, w))
    .filter((e): e is WeeklyClimatologyEntry => Boolean(e));
  const avgRainfall = entries.reduce((sum, e) => sum + e.rainfall_mm, 0) / Math.max(1, entries.length);
  const avgMoisture = entries.reduce((sum, e) => sum + e.soil_moisture_m3_m3, 0) / Math.max(1, entries.length);
  const supply = avgRainfall + avgMoisture * 100;

  const needScore = Math.max(...livingCrops.map((c) => WATER_NEED_SCORE[c.water_need]));
  const neediest = livingCrops.find((c) => WATER_NEED_SCORE[c.water_need] === needScore)!;
  const names = livingCrops.map((c) => c.display_name).join(" + ");

  const deficit = needScore - supply;
  if (deficit > 0) {
    const penalty = clamp(deficit * 1.2, 0, 100);
    return {
      score: clamp(100 - penalty, 0, 100),
      reasons: [
        {
          delta: -penalty,
          text: `${names} need${livingCrops.length > 1 ? "" : "s"} ${neediest.water_need} water but seasonal rainfall and soil moisture averaged only ${supply.toFixed(1)}, a likely shortfall requiring irrigation (estimate).`,
        },
      ],
    };
  }
  return {
    score: 100,
    reasons: [
      { delta: 0, text: `Seasonal rainfall and soil moisture comfortably cover ${names}'s ${neediest.water_need} water need.` },
    ],
  };
}

function scoreNitrogen(
  cropIds: CropId[],
  crops: CropsById,
  soilBeforeSeason: SoilState,
): { score: number; reasons: ScoreReason[] } {
  const livingCrops = getLivingCrops(cropIds, crops);
  let score = 100;
  const reasons: ScoreReason[] = [];

  for (const crop of livingCrops) {
    if (crop.nutrient_role === "heavy_feeder") {
      const penalty = clamp((100 - soilBeforeSeason.nitrogen) * 0.4, 0, 40);
      if (penalty > 0) {
        score -= penalty;
        reasons.push({
          delta: -penalty,
          text: `${crop.display_name} is a heavy feeder and soil nitrogen is only at ${soilBeforeSeason.nitrogen.toFixed(0)}/100, limiting growth.`,
        });
      }
    }
    if (crop.nutrient_role === "nitrogen_fixer") {
      score += 10;
      reasons.push({
        delta: 10,
        text: `${crop.display_name} fixes its own nitrogen, replenishing soil nitrogen for future seasons.`,
      });
    }
  }

  if (reasons.length === 0) {
    reasons.push({
      delta: 0,
      text: "No heavy feeders or nitrogen fixers planted this season; nitrogen levels are unaffected.",
    });
  }
  return { score: clamp(score, 0, 100), reasons };
}

function scorePests(
  cropIds: CropId[],
  crops: CropsById,
  soilBeforeSeason: SoilState,
): { score: number; reasons: ScoreReason[] } {
  const livingCrops = getLivingCrops(cropIds, crops);
  const families = new Set(livingCrops.map((c) => c.family));
  let score = 100;
  const reasons: ScoreReason[] = [];

  for (const family of families) {
    const pressure = soilBeforeSeason.pestPressureByFamily[family] ?? 0;
    const penalty = (pressure / 100) * 50;
    if (penalty > 0) {
      score -= penalty;
      reasons.push({
        delta: -penalty,
        text: `${family} pest pressure carried over from recent rotations (${pressure.toFixed(0)}/100) reduced this season's pest-break score.`,
      });
    } else {
      reasons.push({ delta: 0, text: `No carryover pest pressure detected for ${family} this season.` });
    }
  }

  if (reasons.length === 0) {
    reasons.push({ delta: 0, text: "No crop planted this season, so no pest exposure." });
  }
  return { score: clamp(score, 0, 100), reasons };
}

// Bare ground gives no protection; a living but shallow-rooted, non-cover
// crop gives partial protection; deep roots or cover-crop residue protect
// strongly (rule 5: "Deep roots and cover crops protect").
function protectionFactor(crop: Crop): number {
  if (crop.root_depth === "deep" && crop.is_cover_crop) return 1;
  if (crop.root_depth === "deep" || crop.is_cover_crop) return 0.85;
  if (crop.planting_window) return 0.4;
  return 0;
}

function scoreErosion(
  cropIds: CropId[],
  crops: CropsById,
  season: Season,
  frostWeeks: FrostWeeks,
  weeklyClimatology: WeeklyClimatologyEntry[],
  slopePercent: number,
): { score: number; reasons: ScoreReason[] } {
  const livingCrops = getLivingCrops(cropIds, crops);
  const occupiedWeeks = new Set(getSlotCalendarWeeks(cropIds, crops, frostWeeks));
  const protection = livingCrops.length > 0 ? Math.max(...livingCrops.map(protectionFactor)) : 0;

  const seasonWeeks = getSeasonCalendarWeeks(season, frostWeeks);
  let totalRisk = 0;
  let bareWeekCount = 0;
  let protectedWeekCount = 0;

  for (const week of seasonWeeks) {
    const climate = climatologyForWeek(weeklyClimatology, week);
    const rainfall = climate?.rainfall_mm ?? 0;
    const weekProtection = occupiedWeeks.has(week) ? protection : 0;
    if (weekProtection < 0.5) bareWeekCount++;
    else protectedWeekCount++;
    totalRisk += rainfall * (slopePercent / 10) * (1 - weekProtection);
  }

  const score = clamp(100 - totalRisk * EROSION_RISK_SCALE, 0, 100);
  const reasons: ScoreReason[] = [];
  if (bareWeekCount > 0) {
    reasons.push({
      delta: -(totalRisk * EROSION_RISK_SCALE),
      text: `${bareWeekCount} bare or lightly-covered week(s) this season on a ${slopePercent}% slope raised erosion risk.`,
    });
  }
  if (protectedWeekCount > 0) {
    reasons.push({
      delta: 0,
      text: `${protectedWeekCount} week(s) this season were covered by root/canopy protection, limiting erosion risk.`,
    });
  }
  if (reasons.length === 0) {
    reasons.push({ delta: 0, text: "No erosion risk factors detected this season." });
  }
  return { score, reasons };
}

function scoreIncome(cropIds: CropId[], crops: CropsById): { score: number; reasons: ScoreReason[] } {
  const livingCrops = getLivingCrops(cropIds, crops);
  if (livingCrops.length === 0) {
    return { score: 0, reasons: [{ delta: -100, text: "No crop planted this season, so no income is generated." }] };
  }

  const values = livingCrops.map((c) => INCOME_VALUE_SCORE[c.income_value]);
  const score = clamp(values.reduce((a, b) => a + b, 0) / values.length, 0, 100);
  const names = livingCrops.map((c) => c.display_name).join(" + ");
  return {
    score,
    reasons: [{ delta: score - 100, text: `${names} income potential sets this season's income score to ${score.toFixed(0)}.` }],
  };
}

function buildWeatherEvents(
  slotWeeks: number[],
  season: Season,
  frostWeeks: FrostWeeks,
  weeklyClimatology: WeeklyClimatologyEntry[],
): WeatherEvent[] {
  const relevantWeeks = slotWeeks.length > 0 ? slotWeeks : getSeasonCalendarWeeks(season, frostWeeks);
  const events: WeatherEvent[] = [];
  for (const week of relevantWeeks) {
    const climate = climatologyForWeek(weeklyClimatology, week);
    if (!climate) continue;
    if (climate.temp_low_c <= 0) events.push({ week, type: "frost" });
    if (climate.rainfall_mm >= 20) events.push({ week, type: "heavy_rain" });
    if (climate.rainfall_mm <= 1 && climate.soil_moisture_m3_m3 <= 0.1) events.push({ week, type: "drought" });
  }
  return events;
}

/**
 * Scores one season slot (engine rule 5): season fit, water, nitrogen,
 * pests, erosion, and income, each with a reason string per point change.
 */
export function scoreSeason(input: ScoreSeasonInput): SeasonResult {
  const { year, season, cropIds, crops, frostWeeks, weeklyClimatology, slopePercent, soilBeforeSeason } = input;

  const seasonFit = scoreSeasonFit(cropIds, crops, season);
  const slotWeeks = getSlotCalendarWeeks(cropIds, crops, frostWeeks);
  const water = scoreWater(cropIds, crops, slotWeeks, weeklyClimatology);
  const nitrogen = scoreNitrogen(cropIds, crops, soilBeforeSeason);
  const pests = scorePests(cropIds, crops, soilBeforeSeason);
  const erosion = scoreErosion(cropIds, crops, season, frostWeeks, weeklyClimatology, slopePercent);
  const income = scoreIncome(cropIds, crops);

  const subscores: SeasonSubscores = {
    season_fit_score: seasonFit.score,
    water_efficiency_score: water.score,
    nitrogen_score: nitrogen.score,
    pest_break_score: pests.score,
    erosion_protection_score: erosion.score,
    income_score: income.score,
  };

  const reasons: ScoreReason[] = [
    ...seasonFit.reasons,
    ...water.reasons,
    ...nitrogen.reasons,
    ...pests.reasons,
    ...erosion.reasons,
    ...income.reasons,
  ];

  const score =
    (subscores.season_fit_score +
      subscores.water_efficiency_score +
      subscores.nitrogen_score +
      subscores.pest_break_score +
      subscores.erosion_protection_score +
      subscores.income_score) /
    6;

  return {
    year,
    season,
    crops: cropIds,
    score,
    subscores,
    reasons,
    weather_events: buildWeatherEvents(slotWeeks, season, frostWeeks, weeklyClimatology),
  };
}
