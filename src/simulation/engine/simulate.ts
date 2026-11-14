import { getFrostWeeks } from "./frost";
import { initSoilState, updateSoilAfterSeason } from "./soil";
import { scoreSeason, seasonHasCashCrop } from "./scoring";
import type {
  CropsById,
  FrostDates,
  PastRotationSlot,
  Priorities,
  RotationStrategy,
  SeasonResult,
  SimulationScores,
  SoilProfile,
  WeeklyClimatologyEntry,
} from "./types";

export interface SimulateInput {
  strategy: RotationStrategy;
  crops: CropsById;
  soil: SoilProfile;
  pastRotation: PastRotationSlot[];
  frostDates: FrostDates;
  weeklyClimatology: WeeklyClimatologyEntry[];
  slopePercent: number;
  priorities: Priorities;
  years?: number; // default 3, per engine rule 3
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

// Priority weighting (engine rule 8): water -> water; soil_health ->
// nitrogen + erosion; pests -> pests; income -> income. Season fit is a
// multiplier, not part of the weighted average: a crop that dies in frost
// (season_fit_score near 0) tanks the whole season's score regardless of how
// well it otherwise did, rather than being diluted into one more averaged
// term that a perfect fit would inflate equally for every season.
function weightedOverall(season: SeasonResult, priorities: Priorities): number {
  const { subscores } = season;
  const soilHealthComponent = (subscores.nitrogen_score + subscores.erosion_protection_score) / 2;

  const numerator =
    subscores.water_efficiency_score * priorities.water +
    soilHealthComponent * priorities.soil_health +
    subscores.pest_break_score * priorities.pests +
    subscores.income_score * priorities.income;
  const denominator = priorities.water + priorities.soil_health + priorities.pests + priorities.income;
  const weightedAverage = denominator > 0 ? numerator / denominator : 100;

  return weightedAverage * (subscores.season_fit_score / 100);
}

/**
 * Runs a rotation strategy for `years` repeats (default 3), threading soil
 * state season to season (engine rules 2, 3, 6) and scoring each season
 * (rule 5) to produce the strategy-level simulation_scores.
 */
export function simulateStrategy(input: SimulateInput): SimulationScores {
  const years = input.years ?? 3;
  const frostWeeks = getFrostWeeks(input.frostDates);

  const initialSoil = initSoilState(input.soil, input.pastRotation, input.crops);
  let soil = initialSoil;
  const seasons: SeasonResult[] = [];

  for (let yearOffset = 0; yearOffset < years; yearOffset++) {
    for (const baseSlot of input.strategy.timeline) {
      const season = scoreSeason({
        year: baseSlot.year + yearOffset,
        season: baseSlot.season,
        cropIds: baseSlot.crops,
        crops: input.crops,
        frostWeeks,
        weeklyClimatology: input.weeklyClimatology,
        slopePercent: input.slopePercent,
        soilBeforeSeason: soil,
      });
      seasons.push(season);
      soil = updateSoilAfterSeason(soil, baseSlot.crops, input.crops);
    }
  }

  const overallPerSeason = seasons.map((s) => weightedOverall(s, input.priorities));
  const estimatedIrrigationMm = seasons.reduce(
    (sum, s) => sum + Math.max(0, 100 - s.subscores.water_efficiency_score) * 2,
    0,
  );
  const soilHealthDelta =
    (soil.nitrogen + soil.organicMatter) / 2 - (initialSoil.nitrogen + initialSoil.organicMatter) / 2;

  // Fallow and cover-crop-only seasons aren't income failures, so they're
  // excluded from the income average rather than counted as a 0.
  const cashSeasons = seasons.filter((s) => seasonHasCashCrop(s.crops, input.crops));

  return {
    computed_by: "simulation_engine",
    overall_success_score: average(overallPerSeason),
    water_efficiency_score: average(seasons.map((s) => s.subscores.water_efficiency_score)),
    erosion_protection_score: average(seasons.map((s) => s.subscores.erosion_protection_score)),
    pest_break_score: average(seasons.map((s) => s.subscores.pest_break_score)),
    season_fit_score: average(seasons.map((s) => s.subscores.season_fit_score)),
    income_score: cashSeasons.length > 0 ? average(cashSeasons.map((s) => s.subscores.income_score)) : null,
    soil_health_delta: soilHealthDelta,
    estimated_irrigation_mm: estimatedIrrigationMm,
    nitrogen_balance_kg_ha: (soil.nitrogen - initialSoil.nitrogen) * 2,
    confidence: null, // populated by confidence.ts (not built yet)
    check_locally: null, // populated by flags.ts (not built yet)
    seasons,
  };
}
