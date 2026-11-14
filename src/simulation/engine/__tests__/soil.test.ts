import { describe, expect, it } from "vitest";
import cropsJson from "../../data/crops.json";
import { initSoilState, updateSoilAfterSeason } from "../soil";
import type { CropsById, PastRotationSlot, SoilProfile } from "../types";

const crops = cropsJson.crops as unknown as CropsById;

const baseSoilProfile: SoilProfile = {
  texture_class: "loam",
  sand_percent: 42,
  silt_percent: 38,
  clay_percent: 20,
  organic_carbon_g_kg: 18.5,
  organic_matter_level: "low",
  drainage_runoff_risk: "medium",
  nitrogen_level: "low",
  pest_carryover_risk: "medium",
  pest_carryover_family: "solanaceae",
};

describe("initSoilState", () => {
  it("maps low/medium/high field levels to the 25/50/75 scale", () => {
    const soil = initSoilState(baseSoilProfile, [], crops);
    expect(soil.nitrogen).toBe(25); // low
    expect(soil.organicMatter).toBe(25); // low
    expect(soil.pestPressureByFamily.solanaceae).toBe(50); // medium
  });

  it("primes pest pressure forward through past rotation", () => {
    const pastRotation: PastRotationSlot[] = [
      { year: 2025, season: "warm_season", crops: ["tomato"] },
      { year: 2025, season: "cool_season", crops: ["fallow"] },
    ];
    const soil = initSoilState(baseSoilProfile, pastRotation, crops);
    // starts at 50 (medium) -> +20 for tomato (solanaceae) -> -15 for fallow's "none" season = 55
    expect(soil.pestPressureByFamily.solanaceae).toBe(55);
  });
});

describe("updateSoilAfterSeason", () => {
  const fresh = initSoilState(baseSoilProfile, [], crops);

  it("drains nitrogen for a heavy feeder", () => {
    const next = updateSoilAfterSeason(fresh, ["bell_pepper"], crops);
    expect(next.nitrogen).toBeLessThan(fresh.nitrogen);
  });

  it("adds nitrogen for a nitrogen fixer", () => {
    const next = updateSoilAfterSeason(fresh, ["crimson_clover"], crops);
    expect(next.nitrogen).toBeGreaterThan(fresh.nitrogen);
  });

  it("adds organic matter for a cover crop", () => {
    const next = updateSoilAfterSeason(fresh, ["winter_rye"], crops);
    expect(next.organicMatter).toBeGreaterThan(fresh.organicMatter);
  });

  it("raises the grown family's pest pressure and decays the others", () => {
    const next = updateSoilAfterSeason(fresh, ["tomato"], crops);
    expect(next.pestPressureByFamily.solanaceae).toBeGreaterThan(fresh.pestPressureByFamily.solanaceae);
    expect(next.pestPressureByFamily.fabaceae).toBeLessThanOrEqual(fresh.pestPressureByFamily.fabaceae);
  });

  it("combines both crops' effects for a mix", () => {
    const next = updateSoilAfterSeason(fresh, ["crimson_clover", "winter_rye"], crops);
    // clover fixes nitrogen (+15), rye is a light feeder (-4) -> net +11
    expect(next.nitrogen).toBe(fresh.nitrogen + 11);
    // both are cover crops, but organic matter gain is per-crop, not capped to one
    expect(next.organicMatter).toBe(Math.min(100, fresh.organicMatter + 16));
  });

  it("is a no-op for an unknown crop id", () => {
    const next = updateSoilAfterSeason(fresh, ["mystery_crop"], crops);
    expect(next.nitrogen).toBe(fresh.nitrogen);
    expect(next.organicMatter).toBe(fresh.organicMatter);
  });
});
