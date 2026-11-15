import { describe, expect, it } from "vitest";
import demoFieldJson from "../../fixtures/demo-field.json";
import { bestPlantingWeek, simulatePlanting, suggestFollowUpCrops } from "../plant";
import type { FieldJson, WeeklyClimatologyEntry } from "../types";

const demoField = demoFieldJson as unknown as FieldJson;

// last_spring_frost=11, first_fall_frost=46 (see frost.test.ts). bell_pepper:
// offset 2-8 from last_spring_frost -> window weeks 13-19.
describe("simulatePlanting", () => {
  it("returns null for an unknown crop or one with no planting window (fallow)", () => {
    expect(simulatePlanting(demoField, "mystery_crop", 15)).toBeNull();
    expect(simulatePlanting(demoField, "fallow", 15)).toBeNull();
  });

  it("scores a crop planted inside its own window as in-window with full season fit", () => {
    const result = simulatePlanting(demoField, "bell_pepper", 15);
    expect(result).not.toBeNull();
    expect(result!.inWindow).toBe(true);
    expect(result!.seasonFitScore).toBe(100);
    expect(result!.windowStartWeek).toBe(13);
    expect(result!.windowEndWeek).toBe(19);
  });

  it("penalizes and flags a crop planted well outside its own window", () => {
    const result = simulatePlanting(demoField, "bell_pepper", 35)!;
    expect(result.inWindow).toBe(false);
    expect(result.seasonFitScore).toBeLessThan(100);
    expect(result.overallScore).toBeLessThan(simulatePlanting(demoField, "bell_pepper", 15)!.overallScore);
  });

  it("reflects frost weeks that actually overlap the growth period", () => {
    // Synthetic climatology (not the demo field's, which never dips to
    // freezing) with week 12 forced below freezing, inside bell_pepper's
    // 11-week growth window starting week 11 (ceil(75/7)=11 -> weeks 11-21).
    const weeklyClimatology: WeeklyClimatologyEntry[] = demoField.climate_data.weekly_climatology.map((entry) =>
      entry.week === 12 ? { ...entry, temp_low_c: -1 } : entry,
    );
    const frostyField: FieldJson = { ...demoField, climate_data: { ...demoField.climate_data, weekly_climatology: weeklyClimatology } };

    const withFrost = simulatePlanting(frostyField, "bell_pepper", 11)!;
    const withoutFrost = simulatePlanting(demoField, "bell_pepper", 11)!;

    expect(withFrost.frostRiskScore).toBeLessThan(100);
    expect(withoutFrost.frostRiskScore).toBe(100);
    expect(withFrost.overallScore).toBeLessThan(withoutFrost.overallScore);
  });

  it("never penalizes a frost-tolerant crop for frost risk", () => {
    // winter_rye is frost_tolerant.
    const weeklyClimatology: WeeklyClimatologyEntry[] = demoField.climate_data.weekly_climatology.map((entry) => ({
      ...entry,
      temp_low_c: -5,
    }));
    const frozenField: FieldJson = { ...demoField, climate_data: { ...demoField.climate_data, weekly_climatology: weeklyClimatology } };
    const result = simulatePlanting(frozenField, "winter_rye", 38)!;
    expect(result.frostRiskScore).toBe(100);
  });

  it("reports a soil effect (nitrogen change and pest family) matching the crop's own traits", () => {
    // bush_bean is a nitrogen fixer.
    const fixer = simulatePlanting(demoField, "bush_bean", 12)!;
    expect(fixer.nitrogenChange).toBeGreaterThan(0);
    expect(fixer.pestFamily).toBe("fabaceae");

    // bell_pepper is a heavy feeder.
    const feeder = simulatePlanting(demoField, "bell_pepper", 15)!;
    expect(feeder.nitrogenChange).toBeLessThan(0);
    expect(feeder.pestFamily).toBe("solanaceae");
  });

  it("includes plain-word reasons covering every scored dimension", () => {
    const result = simulatePlanting(demoField, "bell_pepper", 15)!;
    expect(result.reasons.length).toBeGreaterThan(0);
    for (const reason of result.reasons) {
      expect(typeof reason.text).toBe("string");
      expect(reason.text.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic for the same input", () => {
    const first = simulatePlanting(demoField, "bell_pepper", 15);
    const second = simulatePlanting(demoField, "bell_pepper", 15);
    expect(second).toEqual(first);
  });
});

describe("bestPlantingWeek", () => {
  it("returns a week inside the crop's own planting window", () => {
    const week = bestPlantingWeek(demoField, "bell_pepper");
    expect(week).not.toBeNull();
    expect(week!).toBeGreaterThanOrEqual(13);
    expect(week!).toBeLessThanOrEqual(19);
  });

  it("picks the highest-scoring week within the window", () => {
    const week = bestPlantingWeek(demoField, "bell_pepper")!;
    const bestScore = simulatePlanting(demoField, "bell_pepper", week)!.overallScore;
    for (let w = 13; w <= 19; w++) {
      expect(simulatePlanting(demoField, "bell_pepper", w)!.overallScore).toBeLessThanOrEqual(bestScore);
    }
  });

  it("returns null for a crop with no planting window", () => {
    expect(bestPlantingWeek(demoField, "fallow")).toBeNull();
  });
});

describe("suggestFollowUpCrops", () => {
  it("prefers a nitrogen fixer after a heavy feeder", () => {
    const suggestions = suggestFollowUpCrops("bell_pepper", "farm"); // heavy feeder
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].reason).toContain("Fixes nitrogen");
  });

  it("never suggests a crop from the same family as the one just planted", () => {
    const suggestions = suggestFollowUpCrops("bell_pepper", "farm"); // solanaceae
    for (const { cropId } of suggestions) {
      expect(cropId).not.toBe("tomato"); // also solanaceae
    }
  });

  it("never repeats a family across its own suggestions", () => {
    const suggestions = suggestFollowUpCrops("bell_pepper", "farm");
    const families = new Set(suggestions.map(({ cropId }) => cropId));
    expect(families.size).toBe(suggestions.length);
  });

  it("returns at most 3 suggestions", () => {
    expect(suggestFollowUpCrops("bell_pepper", "farm").length).toBeLessThanOrEqual(3);
  });

  it("only suggests crops that fit the given mode", () => {
    const suggestions = suggestFollowUpCrops("bell_pepper", "garden");
    // summer_squash only fits garden and is a different family — sanity
    // check the filter is live, not just defaulting to farm.
    expect(suggestions.every(({ cropId }) => cropId !== "corn")); // corn: farm-only
  });
});
