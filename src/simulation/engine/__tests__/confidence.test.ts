import { describe, expect, it } from "vitest";
import cropsJson from "../../data/crops.json";
import demoField from "../../fixtures/demo-field.json";
import { computeConfidence } from "../confidence";
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
  WeatherEvent,
  WeeklyClimatologyEntry,
} from "../types";

const crops = cropsJson.crops as unknown as CropsById;

const emptyQualitativeAnalysis: QualitativeAnalysis = {
  why_suggested: "",
  nasa_evidence: "",
  benefits: [],
  information_gaps: [],
  local_risks_for_review: [],
};

function makeStrategy(cropIds: CropId[]): RotationStrategy {
  return {
    strategy_id: "test",
    title: "test",
    is_baseline: true,
    timeline: [
      { year: 2026, season: "warm_season", crops: cropIds, alternate_crop_ids: [], is_mix: false, purpose: "test" },
    ],
    simulation_scores: null,
    qualitative_analysis: emptyQualitativeAnalysis,
  };
}

function makeSeason(cropIds: CropId[], weatherEvents: WeatherEvent[] = []): SeasonResult {
  return {
    year: 2026,
    season: "warm_season",
    crops: cropIds,
    score: 90,
    subscores: {
      water_efficiency_score: 90,
      erosion_protection_score: 90,
      pest_break_score: 90,
      season_fit_score: 90,
      income_score: 90,
      nitrogen_score: 90,
    },
    reasons: [],
    weather_events: weatherEvents,
  };
}

describe("computeConfidence", () => {
  it("is High when the plot is large, crops are known, and there's no extreme weather", () => {
    const confidence = computeConfidence({
      areaAcres: 50,
      strategy: makeStrategy(["bell_pepper"]),
      crops,
      seasons: [makeSeason(["bell_pepper"])],
    });
    expect(confidence.level).toBe("High");
    expect(confidence.reasons).toHaveLength(1);
  });

  it("drops to Medium for a small plot alone", () => {
    const confidence = computeConfidence({
      areaAcres: 2,
      strategy: makeStrategy(["bell_pepper"]),
      crops,
      seasons: [makeSeason(["bell_pepper"])],
    });
    expect(confidence.level).toBe("Medium");
    expect(confidence.reasons.some((r) => r.includes("NASA"))).toBe(true);
  });

  it("flags a crop missing from crops.json", () => {
    const confidence = computeConfidence({
      areaAcres: 50,
      strategy: makeStrategy(["mystery_crop"]),
      crops,
      seasons: [makeSeason(["mystery_crop"])],
    });
    expect(confidence.reasons.some((r) => r.includes("mystery_crop"))).toBe(true);
  });

  it("flags extreme weather weeks", () => {
    const confidence = computeConfidence({
      areaAcres: 50,
      strategy: makeStrategy(["bell_pepper"]),
      crops,
      seasons: [makeSeason(["bell_pepper"], [{ week: 10, type: "frost" }])],
    });
    expect(confidence.reasons.some((r) => r.includes("extreme weather"))).toBe(true);
  });

  it("drops to Low when multiple issues stack up", () => {
    const confidence = computeConfidence({
      areaAcres: 2,
      strategy: makeStrategy(["mystery_crop"]),
      crops,
      seasons: [makeSeason(["mystery_crop"], [{ week: 10, type: "frost" }])],
    });
    expect(confidence.level).toBe("Low");
    expect(confidence.reasons).toHaveLength(3);
  });

  it("is Low on the real demo field (small plot + extreme weather weeks)", () => {
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

    const confidence = computeConfidence({
      areaAcres: demoField.field_profile.area_acres,
      strategy,
      crops,
      seasons: simResult.seasons ?? [],
    });

    expect(confidence.level).toBe("Low");
  });
});
