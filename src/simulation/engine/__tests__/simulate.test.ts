import { describe, expect, it } from "vitest";
import cropsJson from "../../data/crops.json";
import demoField from "../../fixtures/demo-field.json";
import { simulateStrategy } from "../simulate";
import type {
  CropsById,
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
});
