import { describe, expect, it } from "vitest";
import cropsJson from "../../data/crops.json";
import demoField from "../../fixtures/demo-field.json";
import { findBetterRotation } from "../optimize";
import { simulateStrategy } from "../simulate";
import type {
  CropsById,
  FarmMode,
  FrostDates,
  PastRotationSlot,
  Priorities,
  RotationStrategy,
  SoilProfile,
  WeeklyClimatologyEntry,
} from "../types";

const crops = cropsJson.crops as unknown as CropsById;
const soil = demoField.field_profile.soil as unknown as SoilProfile;
const pastRotation = demoField.survey_inputs.past_rotation as unknown as PastRotationSlot[];
const frostDates = demoField.climate_data.frost_dates as unknown as FrostDates;
const weeklyClimatology = demoField.climate_data.weekly_climatology as unknown as WeeklyClimatologyEntry[];
const slopePercent = demoField.field_profile.slope_percent;
const priorities = demoField.survey_inputs.priorities as unknown as Priorities;
const mode = demoField.field_profile.mode as FarmMode;

const ctx = { crops, soil, pastRotation, frostDates, weeklyClimatology, slopePercent, priorities, mode };

const baselineStrategy = demoField.rotation_strategies[0] as unknown as RotationStrategy;
const soilBuilderStrategy = demoField.rotation_strategies[1] as unknown as RotationStrategy;
const droughtStrategy = demoField.rotation_strategies[2] as unknown as RotationStrategy;

function overallScoreOf(strategy: RotationStrategy): number {
  const result = simulateStrategy({
    strategy, crops, soil, pastRotation, frostDates, weeklyClimatology, slopePercent, priorities,
  });
  return result.overall_success_score ?? 0;
}

describe("findBetterRotation", () => {
  it("never returns a lower score than the starting rotation", () => {
    for (const strategy of [baselineStrategy, soilBuilderStrategy, droughtStrategy]) {
      const startingScore = overallScoreOf(strategy);
      const result = findBetterRotation(strategy, ctx);
      expect(result.overallScore).toBeGreaterThanOrEqual(startingScore);
    }
  });

  it("finds an improvement for existing_baseline by covering its bare fallow slot", () => {
    const startingScore = overallScoreOf(baselineStrategy);
    const result = findBetterRotation(baselineStrategy, ctx);

    expect(result.improved).toBe(true);
    expect(result.overallScore).toBeGreaterThan(startingScore);

    const allCrops = result.strategy.timeline.flatMap((slot) => slot.crops);
    expect(allCrops).not.toContain("fallow");
  });

  it("respects priorities: with income at 7/10, it keeps the cash crop rather than dropping it to chase a higher score", () => {
    expect(priorities.income).toBe(7);

    const result = findBetterRotation(baselineStrategy, ctx);
    const allCrops = result.strategy.timeline.flatMap((slot) => slot.crops);
    expect(allCrops).toContain("bell_pepper");
  });

  it("finds an improvement for soil_builder_legume by reordering its warm-season crops (order now actually matters)", () => {
    const startingScore = overallScoreOf(soilBuilderStrategy);
    const result = findBetterRotation(soilBuilderStrategy, ctx);

    expect(result.improved).toBe(true);
    expect(result.overallScore).toBeGreaterThan(startingScore);
  });

  it("is deterministic", () => {
    const first = findBetterRotation(baselineStrategy, ctx);
    const second = findBetterRotation(baselineStrategy, ctx);
    expect(second).toEqual(first);
  });
});
