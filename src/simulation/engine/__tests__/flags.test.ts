import { describe, expect, it } from "vitest";
import cropsJson from "../../data/crops.json";
import demoField from "../../fixtures/demo-field.json";
import { computeCheckLocally } from "../flags";
import { simulateStrategy } from "../simulate";
import type {
  CropId,
  CropsById,
  FrostDates,
  PastRotationSlot,
  Priorities,
  QualitativeAnalysis,
  RotationStrategy,
  SeasonResult,
  SoilProfile,
  WeeklyClimatologyEntry,
} from "../types";

const crops = cropsJson.crops as unknown as CropsById;

function makeStrategy(localRisks: string[]): RotationStrategy {
  const qualitative_analysis: QualitativeAnalysis = {
    why_suggested: "",
    nasa_evidence: "",
    benefits: [],
    information_gaps: [],
    local_risks_for_review: localRisks,
  };
  return {
    strategy_id: "test",
    title: "test",
    is_baseline: true,
    timeline: [],
    simulation_scores: null,
    qualitative_analysis,
  };
}

function makeSeason(cropIds: CropId[], waterScore = 90): SeasonResult {
  return {
    year: 2026,
    season: "warm_season",
    crops: cropIds,
    score: 90,
    subscores: {
      water_efficiency_score: waterScore,
      erosion_protection_score: 90,
      pest_break_score: 90,
      season_fit_score: 90,
      income_score: 90,
      nitrogen_score: 90,
    },
    reasons: [],
    weather_events: [],
  };
}

const basePriorities: Priorities = { water: 5, income: 3, soil_health: 5, pests: 5 };

describe("computeCheckLocally", () => {
  it("starts from the strategy's own local_risks_for_review", () => {
    const strategy = makeStrategy(["Existing local risk A", "Existing local risk B"]);
    const flags = computeCheckLocally({ strategy, crops, priorities: basePriorities, seasons: [] });
    expect(flags[0]).toBe("Existing local risk A");
    expect(flags[1]).toBe("Existing local risk B");
  });

  it("adds a market-price flag only when income priority is >= 7", () => {
    const strategy = makeStrategy([]);
    const lowIncome = computeCheckLocally({
      strategy,
      crops,
      priorities: { ...basePriorities, income: 6 },
      seasons: [],
    });
    const highIncome = computeCheckLocally({
      strategy,
      crops,
      priorities: { ...basePriorities, income: 7 },
      seasons: [],
    });
    expect(lowIncome.some((f) => f.includes("market prices"))).toBe(false);
    expect(highIncome.some((f) => f.includes("market prices"))).toBe(true);
  });

  it("flags a repeated cash-crop family, skipping over a cover-crop or fallow season in between", () => {
    const strategy = makeStrategy([]);
    const seasons = [
      makeSeason(["bell_pepper"]), // solanaceae
      makeSeason(["winter_rye"]), // cover crop, transparent
      makeSeason(["tomato"]), // solanaceae again -> repeat
    ];
    const flags = computeCheckLocally({ strategy, crops, priorities: basePriorities, seasons });
    expect(flags.some((f) => f.includes("solanaceae"))).toBe(true);
  });

  it("does not flag a family repeat when cash crops alternate families", () => {
    const strategy = makeStrategy([]);
    const seasons = [makeSeason(["bell_pepper"]), makeSeason(["bush_bean"]), makeSeason(["corn"])];
    const flags = computeCheckLocally({ strategy, crops, priorities: basePriorities, seasons });
    expect(flags.some((f) => f.includes("pest/disease pressure"))).toBe(false);
  });

  it("adds an irrigation-access flag when any season's water need exceeds supply", () => {
    const strategy = makeStrategy([]);
    const comfortable = computeCheckLocally({
      strategy,
      crops,
      priorities: basePriorities,
      seasons: [makeSeason(["bell_pepper"], 100)],
    });
    const shortfall = computeCheckLocally({
      strategy,
      crops,
      priorities: basePriorities,
      seasons: [makeSeason(["bell_pepper"], 60)],
    });
    expect(comfortable.some((f) => f.includes("irrigation access"))).toBe(false);
    expect(shortfall.some((f) => f.includes("irrigation access"))).toBe(true);
  });

  it("produces the expected flags on the real demo field's baseline strategy", () => {
    const strategy = demoField.rotation_strategies[0] as unknown as RotationStrategy;
    const soil = demoField.field_profile.soil as unknown as SoilProfile;
    const pastRotation = demoField.survey_inputs.past_rotation as unknown as PastRotationSlot[];
    const frostDates = demoField.climate_data.frost_dates as unknown as FrostDates;
    const weeklyClimatology = demoField.climate_data.weekly_climatology as unknown as WeeklyClimatologyEntry[];
    const slopePercent = demoField.field_profile.slope_percent;
    const priorities = demoField.survey_inputs.priorities as unknown as Priorities;

    const simResult = simulateStrategy({
      strategy,
      crops,
      soil,
      pastRotation,
      frostDates,
      weeklyClimatology,
      slopePercent,
      priorities,
    });

    const flags = computeCheckLocally({ strategy, crops, priorities, seasons: simResult.seasons ?? [] });

    for (const localRisk of strategy.qualitative_analysis.local_risks_for_review) {
      expect(flags).toContain(localRisk);
    }
    expect(flags.some((f) => f.includes("market prices"))).toBe(true); // priorities.income is 7
    expect(flags.some((f) => f.includes("pest/disease pressure"))).toBe(true); // bell_pepper repeats every year
  });
});
