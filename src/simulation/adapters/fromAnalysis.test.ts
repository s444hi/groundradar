import { describe, expect, it } from "vitest";
import cropsJson from "../data/crops.json";
import { runSimulation } from "../engine";
import { getFrostWeek } from "../engine/frost";
import type { CropsById } from "../engine/types";
import demoAnalysisJson from "../fixtures/demo-analysis.json";
import {
  estimatePorosity,
  fromAnalysis,
  YOUR_PLAN_STRATEGY_ID,
  type AnalysisResult,
} from "./fromAnalysis";

const crops = cropsJson.crops as unknown as CropsById;
const demoAnalysis = demoAnalysisJson as unknown as AnalysisResult;

// Pinned so year assertions don't drift with the real calendar.
const CURRENT_YEAR = 2026;

function convert(overrides: Partial<AnalysisResult> = {}) {
  return fromAnalysis({ ...demoAnalysis, ...overrides }, { currentYear: CURRENT_YEAR });
}

/** Deep clone so a test's edits can't leak into the shared fixture object. */
function clone(analysis: AnalysisResult): AnalysisResult {
  return JSON.parse(JSON.stringify(analysis)) as AnalysisResult;
}

describe("fromAnalysis lanes", () => {
  it("puts the user's planned rotation first as the baseline", () => {
    const [yourPlan] = convert().rotation_strategies;

    expect(yourPlan.strategy_id).toBe(YOUR_PLAN_STRATEGY_ID);
    expect(yourPlan.title).toBe("Your plan");
    expect(yourPlan.is_baseline).toBe(true);
    expect(yourPlan.timeline.map((slot) => slot.crops)).toEqual([["bell_pepper"]]);
  });

  it("appends the three generated strategies in payload order, id -> strategy_id and name -> title", () => {
    const strategies = convert().rotation_strategies;

    expect(strategies).toHaveLength(4);
    expect(strategies.slice(1).map((s) => s.strategy_id)).toEqual([
      "soil_regenerative",
      "pest_disease_break",
      "water_income_balanced",
    ]);
    expect(strategies.slice(1).map((s) => s.title)).toEqual([
      "Soil & Moisture Regenerative Plan",
      "3-Family Pest & Pathogen Break",
      "High-Return Water-Smart Rotation",
    ]);
    expect(strategies.slice(1).every((s) => s.is_baseline === false)).toBe(true);
  });

  it("leaves every lane's scores null for runSimulation to fill", () => {
    for (const strategy of convert().rotation_strategies) {
      expect(strategy.simulation_scores?.overall_success_score).toBeNull();
      expect(strategy.simulation_scores?.seasons).toBeNull();
    }
  });
});

describe("fromAnalysis years", () => {
  it("maps plan years 1 and 2 onto calendar years starting at the current year", () => {
    const regenerative = convert().rotation_strategies[1];

    expect(regenerative.timeline.map((slot) => slot.year)).toEqual([2026, 2026, 2027, 2027]);
  });

  it("uses the same year axis for the user's plan as for the strategies", () => {
    const field = convert();

    expect(field.rotation_strategies[0].timeline[0].year).toBe(2026);
    expect(field.survey_inputs.planned_rotation[0].year).toBe(2026);
  });

  it("lands the most recent past season in the year before the plan starts", () => {
    // The survey records past crops as year 0, one step behind planned year 1.
    expect(convert().survey_inputs.past_rotation).toEqual([
      { year: 2025, season: "warm_season", crops: ["tomato"] },
    ]);
  });

  it("steps multiple past seasons back from that year", () => {
    const analysis = clone(demoAnalysis);
    analysis.survey.past_rotation = [
      { year: -1, season: "warm_season", crops: ["corn"] },
      { year: 0, season: "cool_season", crops: ["winter_wheat"] },
    ];

    expect(fromAnalysis(analysis, { currentYear: CURRENT_YEAR }).survey_inputs.past_rotation.map((s) => s.year)).toEqual(
      [2024, 2025],
    );
  });

  it("defaults to the real current year when none is given", () => {
    const field = fromAnalysis(demoAnalysis);

    expect(field.rotation_strategies[0].timeline[0].year).toBe(new Date().getFullYear());
  });
});

describe("fromAnalysis slots", () => {
  it("marks a two-crop slot as a mix and a single-crop slot as not", () => {
    const regenerative = convert().rotation_strategies[1];

    expect(regenerative.timeline[1].crops).toEqual(["crimson_clover", "winter_rye"]);
    expect(regenerative.timeline[1].is_mix).toBe(true);
    expect(regenerative.timeline[0].is_mix).toBe(false);
  });

  it("derives purpose from the season and the crop's role in crops.json", () => {
    const strategies = convert().rotation_strategies;

    // bell_pepper: warm season, heavy feeder, not a cover crop.
    expect(strategies[0].timeline[0].purpose).toBe("Main warm-season cash crop");
    // soybean: warm season, nitrogen fixer, not a cover crop.
    expect(strategies[1].timeline[2].purpose).toBe("Warm-season cash crop that fixes its own nitrogen");
    // oats: cool-season cover crop, shallow roots, light feeder.
    expect(strategies[1].timeline[3].purpose).toBe("Cover crop: covers bare cool-season soil");
  });

  it("combines both crops' roles in a mix's purpose", () => {
    const coverMix = convert().rotation_strategies[1].timeline[1];

    // crimson_clover fixes nitrogen, winter_rye is a deep-rooted holder.
    expect(coverMix.purpose).toBe("Cover-crop mix: adds nitrogen for the next cash crop and holds soil with deep roots");
  });

  it("calls a fallow slot an unplanted bare period with no alternates", () => {
    const analysis = clone(demoAnalysis);
    analysis.survey.planned_rotation = [
      { year: 1, season: "warm_season", crops: ["bell_pepper"] },
      { year: 1, season: "cool_season", crops: ["fallow"] },
    ];
    const yourPlan = fromAnalysis(analysis, { currentYear: CURRENT_YEAR }).rotation_strategies[0];

    expect(yourPlan.timeline[1].purpose).toBe("Unplanted bare period");
    expect(yourPlan.timeline[1].alternate_crop_ids).toEqual([]);
  });

  it("falls back to a plain season label for a crop missing from crops.json", () => {
    const analysis = clone(demoAnalysis);
    analysis.survey.planned_rotation = [{ year: 1, season: "cool_season", crops: ["quinoa"] }];
    const yourPlan = fromAnalysis(analysis, { currentYear: CURRENT_YEAR }).rotation_strategies[0];

    expect(yourPlan.timeline[0].purpose).toBe("Cool-season planting");
    expect(yourPlan.timeline[0].alternate_crop_ids).toEqual([]);
  });
});

describe("fromAnalysis alternates", () => {
  it("offers up to three same-season, same-status, mode-fitting swaps", () => {
    const slot = convert().rotation_strategies[0].timeline[0];

    expect(slot.alternate_crop_ids.length).toBeLessThanOrEqual(3);
    expect(slot.alternate_crop_ids).not.toContain("bell_pepper");
    for (const id of slot.alternate_crop_ids) {
      const crop = crops[id];
      expect(crop.is_cover_crop).toBe(false);
      expect(crop.fits).toContain("farm");
      expect(["warm_season", "any"]).toContain(crop.season_type);
    }
  });

  it("offers cover crops as alternates for a cover-crop slot", () => {
    const coverSlot = convert().rotation_strategies[1].timeline[3];

    expect(coverSlot.crops).toEqual(["oats"]);
    expect(coverSlot.alternate_crop_ids.length).toBeGreaterThan(0);
    for (const id of coverSlot.alternate_crop_ids) {
      expect(crops[id].is_cover_crop).toBe(true);
    }
  });

  it("never offers a crop already in the slot", () => {
    for (const strategy of convert().rotation_strategies) {
      for (const slot of strategy.timeline) {
        for (const id of slot.crops) {
          expect(slot.alternate_crop_ids).not.toContain(id);
        }
      }
    }
  });

  it("drops farm-only crops in garden mode", () => {
    const analysis = clone(demoAnalysis);
    analysis.field_profile.mode = "garden";
    const field = fromAnalysis(analysis, { currentYear: CURRENT_YEAR });

    for (const strategy of field.rotation_strategies) {
      for (const slot of strategy.timeline) {
        for (const id of slot.alternate_crop_ids) {
          expect(crops[id].fits).toContain("garden");
        }
      }
    }
  });
});

describe("fromAnalysis qualitative analysis", () => {
  it("maps summary, rationale, badge and check_locally onto a strategy", () => {
    const strategy = convert().rotation_strategies[1];
    const source = demoAnalysis.strategies[0];

    expect(strategy.qualitative_analysis.why_suggested).toBe(source.summary);
    expect(strategy.qualitative_analysis.nasa_evidence).toBe(source.agronomist_rationale);
    expect(strategy.qualitative_analysis.benefits).toEqual([source.badge]);
    expect(strategy.qualitative_analysis.information_gaps).toEqual(demoAnalysis.check_locally);
    expect(strategy.qualitative_analysis.local_risks_for_review).toEqual(demoAnalysis.check_locally);
  });

  it("explains the user's own lane with its NASA numbers", () => {
    const { qualitative_analysis } = convert().rotation_strategies[0];

    expect(qualitative_analysis.why_suggested).toContain("entered in the survey");
    expect(qualitative_analysis.nasa_evidence).toContain(
      `${demoAnalysis.nasa_environment.climate_summary.annual_rainfall_mm} mm`,
    );
    expect(qualitative_analysis.local_risks_for_review).toEqual(demoAnalysis.check_locally);
  });
});

describe("fromAnalysis climate data", () => {
  it("turns frost weeks back into MM-DD dates that read as the same weeks", () => {
    const { frost_dates } = convert().climate_data;
    const { last_spring_frost_week, first_fall_frost_week } = demoAnalysis.nasa_environment.climate_summary;

    expect(getFrostWeek(frost_dates.last_spring_frost)).toBe(last_spring_frost_week);
    expect(getFrostWeek(frost_dates.first_fall_frost)).toBe(first_fall_frost_week);
  });

  it("converts frost-free weeks into days", () => {
    expect(convert().climate_data.frost_dates.frost_free_days).toBe(34 * 7);
  });

  it("estimates porosity from sand and clay, landing near 0.45 for a loam", () => {
    expect(estimatePorosity(42, 20)).toBeCloseTo(0.448, 3);
    expect(estimatePorosity(85, 5)).toBeLessThan(estimatePorosity(20, 45));
  });

  it("scales 0-1 wetness into m3/m3 volumetric moisture by that porosity", () => {
    const porosity = estimatePorosity(42, 20);
    const weekly = convert().climate_data.weekly_climatology;
    const source = demoAnalysis.nasa_environment.weekly_series;

    expect(weekly).toHaveLength(52);
    expect(weekly[0].soil_moisture_m3_m3).toBeCloseTo(source[0].soil_moisture * porosity, 3);
    // A plausible volumetric range, not the raw 0-1 wetness fraction.
    for (const entry of weekly) {
      expect(entry.soil_moisture_m3_m3).toBeGreaterThan(0);
      expect(entry.soil_moisture_m3_m3).toBeLessThan(0.55);
    }
  });

  it("carries temperature and rainfall across unchanged, ordered by week", () => {
    const weekly = convert().climate_data.weekly_climatology;

    expect(weekly.map((entry) => entry.week)).toEqual(demoAnalysis.nasa_environment.weekly_series.map((p) => p.week));
    expect(weekly[0].rainfall_mm).toBe(demoAnalysis.nasa_environment.weekly_series[0].rainfall_mm);
    expect(weekly[0].temp_low_c).toBe(demoAnalysis.nasa_environment.weekly_series[0].temp_low_c);
    expect(weekly[0].temp_high_c).toBe(demoAnalysis.nasa_environment.weekly_series[0].temp_high_c);
  });

  it("sorts an out-of-order weekly series", () => {
    const analysis = clone(demoAnalysis);
    analysis.nasa_environment.weekly_series.reverse();
    const weekly = fromAnalysis(analysis, { currentYear: CURRENT_YEAR }).climate_data.weekly_climatology;

    expect(weekly[0].week).toBe(1);
    expect(weekly[51].week).toBe(52);
  });

  it("leaves the blocks the engine doesn't read at neutral defaults", () => {
    const { long_term_trends, nasa_diagnostics_summary } = convert().climate_data;

    expect(long_term_trends).toEqual({
      temp_trend_c_per_decade: 0,
      precip_trend_pct_per_decade: 0,
      grace_groundwater_cm_per_yr: 0,
    });
    expect(nasa_diagnostics_summary.typical_bare_soil_months).toEqual([]);
    expect(nasa_diagnostics_summary.heat_stress_days_above_35c).toBe(0);
  });
});

describe("fromAnalysis field profile", () => {
  it("renames the soil fields onto the engine's soil profile", () => {
    const { soil } = convert().field_profile;
    const source = demoAnalysis.nasa_environment.soil;

    expect(soil.texture_class).toBe(source.texture_class);
    expect(soil.sand_percent).toBe(source.sand_pct);
    expect(soil.silt_percent).toBe(source.silt_pct);
    expect(soil.clay_percent).toBe(source.clay_pct);
    expect(soil.organic_carbon_g_kg).toBe(source.organic_carbon_g_kg);
    expect(soil.organic_matter_level).toBe(source.organic_matter_level);
    expect(soil.drainage_runoff_risk).toBe(demoAnalysis.field_profile.drainage_runoff_risk);
  });

  it("takes nitrogen_level from organic matter, the closest proxy the payload carries", () => {
    const analysis = clone(demoAnalysis);
    analysis.nasa_environment.soil.organic_matter_level = "high";

    expect(fromAnalysis(analysis, { currentYear: CURRENT_YEAR }).field_profile.soil.nitrogen_level).toBe("high");
  });

  it("reads pest carryover off the first past crop, high when the plan repeats its family", () => {
    // Fixture: tomato last year, bell peppers planned - both solanaceae.
    const { soil } = convert().field_profile;

    expect(soil.pest_carryover_family).toBe("solanaceae");
    expect(soil.pest_carryover_risk).toBe("high");
  });

  it("drops carryover risk to medium when the plan changes family", () => {
    const analysis = clone(demoAnalysis);
    analysis.survey.past_rotation = [{ year: 0, season: "warm_season", crops: ["corn"] }];
    const { soil } = fromAnalysis(analysis, { currentYear: CURRENT_YEAR }).field_profile;

    expect(soil.pest_carryover_family).toBe("poaceae");
    expect(soil.pest_carryover_risk).toBe("medium");
  });

  it("reports no carryover when the survey recorded no past crop", () => {
    const analysis = clone(demoAnalysis);
    analysis.survey.past_rotation = [];
    const { soil } = fromAnalysis(analysis, { currentYear: CURRENT_YEAR }).field_profile;

    expect(soil.pest_carryover_family).toBe("none");
    expect(soil.pest_carryover_risk).toBe("low");
  });

  it("carries location, area, elevation, slope and mode across", () => {
    const { field_profile } = convert();
    const source = demoAnalysis.field_profile;

    expect(field_profile.location).toEqual({ latitude: source.latitude, longitude: source.longitude });
    expect(field_profile.area_acres).toBe(source.area_acres);
    expect(field_profile.elevation_m).toBe(source.elevation_m);
    expect(field_profile.slope_percent).toBe(source.slope_percent);
    expect(field_profile.mode).toBe(source.mode);
  });

  it("omits location_name unless one is supplied, so the UI falls back to coordinates", () => {
    expect(convert().field_profile.location_name).toBeUndefined();
    expect(
      fromAnalysis(demoAnalysis, { currentYear: CURRENT_YEAR, locationName: "Folsom, CA" }).field_profile.location_name,
    ).toBe("Folsom, CA");
  });

  it("takes the field id from options", () => {
    expect(fromAnalysis(demoAnalysis, { fieldId: "field-42" }).field_profile.field_id).toBe("field-42");
  });

  it("passes the survey priorities straight through", () => {
    expect(convert().survey_inputs.priorities).toEqual(demoAnalysis.survey.priorities);
  });
});

describe("fromAnalysis determinism", () => {
  it("returns the same field JSON for the same input", () => {
    expect(convert()).toEqual(convert());
  });

  it("never mutates the analysis it was given", () => {
    const before = JSON.stringify(demoAnalysis);
    convert();

    expect(JSON.stringify(demoAnalysis)).toBe(before);
  });
});

describe("fromAnalysis feeds the engine", () => {
  const scored = runSimulation(convert());

  it("scores all four lanes end to end", () => {
    expect(scored.rotation_strategies).toHaveLength(4);

    for (const strategy of scored.rotation_strategies) {
      const scores = strategy.simulation_scores;
      expect(scores).not.toBeNull();
      for (const key of [
        "overall_success_score",
        "water_efficiency_score",
        "erosion_protection_score",
        "pest_break_score",
        "season_fit_score",
        "income_score",
      ] as const) {
        expect(scores?.[key]).toBeGreaterThanOrEqual(0);
        expect(scores?.[key]).toBeLessThanOrEqual(100);
      }
      expect(scores?.soil_health_delta).toBeGreaterThanOrEqual(-100);
      expect(scores?.soil_health_delta).toBeLessThanOrEqual(100);
      expect(scores?.confidence?.level).toMatch(/^(High|Medium|Low)$/);
      expect(scores?.seasons?.length).toBeGreaterThan(0);
    }
  });

  it("gives every season a reason for its score", () => {
    for (const strategy of scored.rotation_strategies) {
      for (const season of strategy.simulation_scores?.seasons ?? []) {
        expect(season.reasons.length).toBeGreaterThan(0);
        for (const reason of season.reasons) {
          expect(reason.text.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("seeds check_locally from the analysis's own local checks", () => {
    const flags = scored.rotation_strategies[1].simulation_scores?.check_locally ?? [];

    for (const check of demoAnalysis.check_locally) {
      expect(flags).toContain(check);
    }
  });
});
