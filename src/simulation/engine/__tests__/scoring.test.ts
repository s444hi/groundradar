import { describe, expect, it } from "vitest";
import cropsJson from "../../data/crops.json";
import demoField from "../../fixtures/demo-field.json";
import { getFrostWeeks } from "../frost";
import { initSoilState, updateSoilAfterSeason } from "../soil";
import { scoreSeason } from "../scoring";
import type { CropsById, FrostDates, FrostWeeks, SoilProfile, WeeklyClimatologyEntry } from "../types";

const crops = cropsJson.crops as unknown as CropsById;
const frostWeeks: FrostWeeks = getFrostWeeks(demoField.climate_data.frost_dates as unknown as FrostDates);
const weeklyClimatology = demoField.climate_data.weekly_climatology as unknown as WeeklyClimatologyEntry[];
const slopePercent = demoField.field_profile.slope_percent;

const neutralSoilProfile: SoilProfile = {
  texture_class: "loam",
  sand_percent: 40,
  silt_percent: 40,
  clay_percent: 20,
  organic_carbon_g_kg: 18,
  organic_matter_level: "medium",
  drainage_runoff_risk: "medium",
  nitrogen_level: "medium",
  pest_carryover_risk: "low",
  pest_carryover_family: "none",
};

describe("scoreSeason reasons", () => {
  it("produces a reason string for every subscore category", () => {
    const soil = initSoilState(neutralSoilProfile, [], crops);
    const result = scoreSeason({
      year: 2026,
      season: "warm_season",
      cropIds: ["bell_pepper"],
      crops,
      frostWeeks,
      weeklyClimatology,
      slopePercent,
      soilBeforeSeason: soil,
    });
    expect(result.reasons.length).toBeGreaterThan(0);
    for (const reason of result.reasons) {
      expect(typeof reason.text).toBe("string");
      expect(reason.text.length).toBeGreaterThan(0);
      expect(typeof reason.delta).toBe("number");
    }
  });
});

describe("pest-break scoring reflects rotation history", () => {
  it("scores pepper worse after tomato than after clover", () => {
    const fresh = initSoilState(neutralSoilProfile, [], crops);

    const soilAfterTomato = updateSoilAfterSeason(fresh, ["tomato"], crops);
    const pepperAfterTomato = scoreSeason({
      year: 2027,
      season: "warm_season",
      cropIds: ["bell_pepper"],
      crops,
      frostWeeks,
      weeklyClimatology,
      slopePercent,
      soilBeforeSeason: soilAfterTomato,
    });

    const soilAfterClover = updateSoilAfterSeason(fresh, ["crimson_clover"], crops);
    const pepperAfterClover = scoreSeason({
      year: 2027,
      season: "warm_season",
      cropIds: ["bell_pepper"],
      crops,
      frostWeeks,
      weeklyClimatology,
      slopePercent,
      soilBeforeSeason: soilAfterClover,
    });

    expect(pepperAfterTomato.subscores.pest_break_score).toBeLessThan(
      pepperAfterClover.subscores.pest_break_score,
    );
  });

  it("scores corn worse after corn than after soybeans", () => {
    const fresh = initSoilState(neutralSoilProfile, [], crops);

    const soilAfterCorn = updateSoilAfterSeason(fresh, ["corn"], crops);
    const cornAfterCorn = scoreSeason({
      year: 2027,
      season: "warm_season",
      cropIds: ["corn"],
      crops,
      frostWeeks,
      weeklyClimatology,
      slopePercent,
      soilBeforeSeason: soilAfterCorn,
    });

    const soilAfterSoybean = updateSoilAfterSeason(fresh, ["soybean"], crops);
    const cornAfterSoybean = scoreSeason({
      year: 2027,
      season: "warm_season",
      cropIds: ["corn"],
      crops,
      frostWeeks,
      weeklyClimatology,
      slopePercent,
      soilBeforeSeason: soilAfterSoybean,
    });

    expect(cornAfterCorn.subscores.pest_break_score).toBeLessThan(
      cornAfterSoybean.subscores.pest_break_score,
    );
  });
});

describe("erosion-protection scoring rewards cover over bare ground", () => {
  it("scores a winter fallow lower than winter rye", () => {
    const soil = initSoilState(neutralSoilProfile, [], crops);

    const fallow = scoreSeason({
      year: 2026,
      season: "cool_season",
      cropIds: ["fallow"],
      crops,
      frostWeeks,
      weeklyClimatology,
      slopePercent,
      soilBeforeSeason: soil,
    });

    const rye = scoreSeason({
      year: 2026,
      season: "cool_season",
      cropIds: ["winter_rye"],
      crops,
      frostWeeks,
      weeklyClimatology,
      slopePercent,
      soilBeforeSeason: soil,
    });

    expect(fallow.subscores.erosion_protection_score).toBeLessThan(rye.subscores.erosion_protection_score);
  });
});
