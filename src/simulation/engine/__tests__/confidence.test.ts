import { describe, expect, it } from "vitest";
import cropsJson from "../../data/crops.json";
import demoField from "../../fixtures/demo-field.json";
import { computeConfidence } from "../confidence";
import { getFrostWeeks } from "../frost";
import { simulateStrategy } from "../simulate";
import type {
  CropId,
  CropsById,
  FrostDates,
  FrostWeeks,
  PastRotationSlot,
  Priorities,
  QualitativeAnalysis,
  RotationStrategy,
  SeasonResult,
  SoilProfile,
  WeeklyClimatologyEntry,
} from "../types";

const crops = cropsJson.crops as unknown as CropsById;

// Matches the demo field's real frost weeks so bell_pepper's occupied
// calendar weeks (13-23) are known and controllable in these tests.
const FROST_WEEKS: FrostWeeks = { last_spring_frost: 11, first_fall_frost: 46 };

// Flat/uniform by default (zero local variance -> never "unusual"), with
// per-week overrides for deliberately injecting a genuine anomaly.
function makeClimatology(overrides: Record<number, Partial<WeeklyClimatologyEntry>> = {}): WeeklyClimatologyEntry[] {
  return Array.from({ length: 52 }, (_, i) => {
    const week = i + 1;
    const base: WeeklyClimatologyEntry = {
      week,
      temp_low_c: 10,
      temp_high_c: 20,
      rainfall_mm: 10,
      soil_moisture_m3_m3: 0.2,
    };
    return { ...base, ...(overrides[week] ?? {}) };
  });
}

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

function makeSeason(cropIds: CropId[]): SeasonResult {
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
    weather_events: [],
  };
}

describe("computeConfidence", () => {
  it("is High when the plot is large, crops are known, and there's no unusual weather", () => {
    const confidence = computeConfidence({
      areaAcres: 50,
      strategy: makeStrategy(["bell_pepper"]),
      crops,
      seasons: [makeSeason(["bell_pepper"])],
      weeklyClimatology: makeClimatology(),
      frostWeeks: FROST_WEEKS,
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
      weeklyClimatology: makeClimatology(),
      frostWeeks: FROST_WEEKS,
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
      weeklyClimatology: makeClimatology(),
      frostWeeks: FROST_WEEKS,
    });
    expect(confidence.reasons.some((r) => r.includes("mystery_crop"))).toBe(true);
  });

  it("flags a frost week landing inside the crop's own occupied weeks", () => {
    // bell_pepper occupies calendar weeks 13-23 given FROST_WEEKS; week 15 falls inside.
    const confidence = computeConfidence({
      areaAcres: 50,
      strategy: makeStrategy(["bell_pepper"]),
      crops,
      seasons: [makeSeason(["bell_pepper"])],
      weeklyClimatology: makeClimatology({ 15: { temp_low_c: -5 } }),
      frostWeeks: FROST_WEEKS,
    });
    expect(confidence.reasons.some((r) => r.includes("unusual"))).toBe(true);
  });

  it("does NOT flag a normal seasonal rainfall peak relative to its own neighbors", () => {
    // A smooth, deliberately wet week surrounded by similarly wet neighbors
    // (a "normal seasonal peak") should not look unusual against itself.
    const wetWeekOverrides: Record<number, Partial<WeeklyClimatologyEntry>> = {};
    for (let w = 48; w <= 52; w++) wetWeekOverrides[w] = { rainfall_mm: 22 };
    for (let w = 1; w <= 4; w++) wetWeekOverrides[w] = { rainfall_mm: 22 };

    const confidence = computeConfidence({
      areaAcres: 50,
      strategy: makeStrategy(["fallow"]),
      crops,
      seasons: [{ ...makeSeason(["fallow"]), season: "cool_season" }],
      weeklyClimatology: makeClimatology(wetWeekOverrides),
      frostWeeks: FROST_WEEKS,
    });
    expect(confidence.level).toBe("High");
  });

  it("drops to Low when multiple issues stack up", () => {
    const confidence = computeConfidence({
      areaAcres: 2,
      strategy: makeStrategy(["mystery_crop"]),
      crops,
      seasons: [makeSeason(["mystery_crop"])],
      weeklyClimatology: makeClimatology({ 15: { temp_low_c: -5 } }),
      frostWeeks: FROST_WEEKS,
    });
    expect(confidence.level).toBe("Low");
    expect(confidence.reasons).toHaveLength(3);
  });

  it("reports confidence on the real demo field without a normal seasonal rain peak falsely counting as unusual", () => {
    const strategy = demoField.rotation_strategies[0] as unknown as RotationStrategy;
    const soil = demoField.field_profile.soil as unknown as SoilProfile;
    const pastRotation = demoField.survey_inputs.past_rotation as unknown as PastRotationSlot[];
    const frostDates = demoField.climate_data.frost_dates as unknown as FrostDates;
    const weeklyClimatology = demoField.climate_data.weekly_climatology as unknown as WeeklyClimatologyEntry[];
    const slopePercent = demoField.field_profile.slope_percent;
    const priorities = demoField.survey_inputs.priorities as unknown as Priorities;
    const frostWeeks = getFrostWeeks(frostDates);

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
      weeklyClimatology,
      frostWeeks,
    });

    // The field is a small plot (4.2 acres), which alone still drops
    // confidence from High to Medium -- but the old false "extreme weather"
    // flag (a normal winter rain peak tripping a fixed >=20mm threshold)
    // should no longer also drag it down to Low.
    expect(confidence.level).toBe("Medium");
    expect(confidence.reasons).toHaveLength(1);
  });
});
