import { describe, expect, it } from "vitest";
import cropsJson from "../../data/crops.json";
import demoField from "../../fixtures/demo-field.json";
import { simulateStrategy } from "../simulate";
import type {
  CropsById,
  FrostDates,
  PastRotationSlot,
  Priorities,
  QualitativeAnalysis,
  RotationStrategy,
  SoilProfile,
  WeeklyClimatologyEntry,
} from "../types";

const emptyQualitativeAnalysis: QualitativeAnalysis = {
  why_suggested: "",
  nasa_evidence: "",
  benefits: [],
  information_gaps: [],
  local_risks_for_review: [],
};

const crops = cropsJson.crops as unknown as CropsById;
const soil = demoField.field_profile.soil as unknown as SoilProfile;
const pastRotation = demoField.survey_inputs.past_rotation as unknown as PastRotationSlot[];
const frostDates = demoField.climate_data.frost_dates as unknown as FrostDates;
const weeklyClimatology = demoField.climate_data.weekly_climatology as unknown as WeeklyClimatologyEntry[];
const slopePercent = demoField.field_profile.slope_percent;
const priorities = demoField.survey_inputs.priorities as unknown as Priorities;

const baselineStrategy = demoField.rotation_strategies[0] as unknown as RotationStrategy;
const soilBuilderStrategy = demoField.rotation_strategies[1] as unknown as RotationStrategy;

function simulate(strategy: RotationStrategy) {
  return simulateStrategy({
    strategy,
    crops,
    soil,
    pastRotation,
    frostDates,
    weeklyClimatology,
    slopePercent,
    priorities,
  });
}

describe("simulateStrategy", () => {
  it("is deterministic for the same input", () => {
    const first = simulate(baselineStrategy);
    const second = simulate(baselineStrategy);
    expect(second).toEqual(first);
  });

  it("produces 3 years of seasons by default", () => {
    const result = simulate(baselineStrategy);
    expect(result.seasons).not.toBeNull();
    expect(result.seasons!.length).toBe(baselineStrategy.timeline.length * 3);
  });

  it("scores the soil_builder_legume strategy higher overall than the existing baseline on the demo field", () => {
    const baseline = simulate(baselineStrategy);
    const soilBuilder = simulate(soilBuilderStrategy);

    expect(soilBuilder.overall_success_score).toBeGreaterThan(baseline.overall_success_score!);
  });

  it("never scores soil_builder_legume worse than existing_baseline on pests", () => {
    const baseline = simulate(baselineStrategy);
    const soilBuilder = simulate(soilBuilderStrategy);

    expect(soilBuilder.pest_break_score).toBeGreaterThanOrEqual(baseline.pest_break_score!);
  });

  it("scores existing_baseline's erosion protection in the 15-40 range (a bare, sloped winter every year)", () => {
    const baseline = simulate(baselineStrategy);

    expect(baseline.erosion_protection_score).toBeGreaterThanOrEqual(15);
    expect(baseline.erosion_protection_score).toBeLessThanOrEqual(40);
  });

  it("scores existing_baseline and soil_builder_legume equally on income (same cash crop, different non-cash winter)", () => {
    const baseline = simulate(baselineStrategy);
    const soilBuilder = simulate(soilBuilderStrategy);

    expect(soilBuilder.income_score).toBe(baseline.income_score);
  });

  it("multiplies by season fit instead of averaging it in, so a frost-killed crop tanks the score", () => {
    // tomato is not frost tolerant; forcing it into the cool season (an
    // agronomically wrong but deterministic scenario) triggers the
    // season_fit penalty and isolates the multiplier's effect.
    const frostRiskStrategy: RotationStrategy = {
      strategy_id: "frost_risk_test",
      title: "Frost risk test",
      is_baseline: true,
      timeline: [
        { year: 2026, season: "cool_season", crops: ["tomato"], alternate_crop_ids: [], is_mix: false, purpose: "test" },
      ],
      simulation_scores: null,
      qualitative_analysis: emptyQualitativeAnalysis,
    };

    const result = simulateStrategy({
      strategy: frostRiskStrategy,
      crops,
      soil,
      pastRotation,
      frostDates,
      weeklyClimatology,
      slopePercent,
      priorities,
      years: 1,
    });
    const season = result.seasons![0];
    expect(season.subscores.season_fit_score).toBeLessThan(100);

    // The weighted average of the other components, with no fit multiplier.
    const denominator = priorities.water + priorities.soil_health + priorities.pests + priorities.income;
    const soilHealthComponent = (season.subscores.nitrogen_score + season.subscores.erosion_protection_score) / 2;
    const othersWeightedAverage =
      (season.subscores.water_efficiency_score * priorities.water +
        soilHealthComponent * priorities.soil_health +
        season.subscores.pest_break_score * priorities.pests +
        season.subscores.income_score * priorities.income) /
      denominator;

    expect(result.overall_success_score).toBeCloseTo(
      othersWeightedAverage * (season.subscores.season_fit_score / 100),
      5,
    );
    expect(result.overall_success_score!).toBeLessThan(othersWeightedAverage);
  });
});
