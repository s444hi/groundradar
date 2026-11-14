import { describe, expect, it } from "vitest";
import cropsJson from "../../data/crops.json";
import demoField from "../../fixtures/demo-field.json";
import { getFrostWeeks } from "../frost";
import { buildTimeline } from "../timeline";
import type { CropsById, FrostDates, FrostWeeks, QualitativeAnalysis, RotationStrategy } from "../types";

const crops = cropsJson.crops as unknown as CropsById;
const frostWeeks: FrostWeeks = getFrostWeeks(
  demoField.climate_data.frost_dates as unknown as FrostDates,
);

const emptyQualitativeAnalysis: QualitativeAnalysis = {
  why_suggested: "",
  nasa_evidence: "",
  benefits: [],
  information_gaps: [],
  local_risks_for_review: [],
};

const baselineStrategy = demoField.rotation_strategies[0] as unknown as RotationStrategy;
const soilBuilderStrategy = demoField.rotation_strategies[1] as unknown as RotationStrategy;

describe("buildTimeline", () => {
  it("defaults to a 3-year repeat", () => {
    const result = buildTimeline(baselineStrategy, crops, frostWeeks);
    expect(result.years).toBe(3);
    expect(result.weeks.length).toBe(156);
    expect(result.slots.length).toBe(baselineStrategy.timeline.length * 3);
  });

  it("places a known crop across its exact maturity window and repeats it the next year", () => {
    const tomatoStrategy: RotationStrategy = {
      strategy_id: "tomato_test",
      title: "Tomato test",
      is_baseline: true,
      timeline: [
        {
          year: 2026,
          season: "warm_season",
          crops: ["tomato"],
          alternate_crop_ids: [],
          is_mix: false,
          purpose: "test",
        },
      ],
      simulation_scores: null,
      qualitative_analysis: emptyQualitativeAnalysis,
    };

    const result = buildTimeline(tomatoStrategy, crops, frostWeeks);

    // last_spring_frost week 11 + start_week_offset 1 = planting week 12
    // -> startAbsoluteWeek 11; ceil(75/7) = 11 weeks -> endAbsoluteWeek 21
    for (let w = 11; w <= 21; w++) {
      expect(result.weeks[w].cropIds).toContain("tomato");
      expect(result.weeks[w].isBare).toBe(false);
    }
    expect(result.weeks[10].isBare).toBe(true);
    expect(result.weeks[22].isBare).toBe(true);

    // Same window recurs shifted by exactly 52 weeks in year offset 1.
    for (let w = 11; w <= 21; w++) {
      expect(result.weeks[w + 52].cropIds).toContain("tomato");
      expect(result.weeks[w + 52].isBare).toBe(false);
    }
  });

  it("never paints the fallow slot and only counts the real crop's occupied weeks", () => {
    const result = buildTimeline(baselineStrategy, crops, frostWeeks);

    expect(result.weeks.every((w) => !w.cropIds.includes("fallow"))).toBe(true);

    const nonBareWeekCount = result.weeks.filter((w) => !w.isBare).length;
    // bell_pepper: ceil(75/7) = 11 occupied weeks per year, over 3 years.
    expect(nonBareWeekCount).toBe(3 * 11);
  });

  it("paints both crop ids of a mix into the same shared window, including a forward wrap", () => {
    const result = buildTimeline(soilBuilderStrategy, crops, frostWeeks);

    // first_fall_frost week 46 + start_week_offset -8 = planting week 38
    // -> startAbsoluteWeek 37; ceil(180/7) = 26 weeks -> endAbsoluteWeek 62
    expect(result.weeks[37].cropIds).toEqual(expect.arrayContaining(["crimson_clover", "winter_rye"]));
    expect(result.weeks[37].isBare).toBe(false);
    expect(result.weeks[62].cropIds).toEqual(expect.arrayContaining(["crimson_clover", "winter_rye"]));
    expect(result.weeks[62].isBare).toBe(false);

    // Forward wrap lands correctly in the next repeat year.
    expect(result.weeks[62].yearOffset).toBe(1);
    expect(result.weeks[62].week).toBe(11);

    // No backward bleed into the start of the timeline.
    expect(result.weeks[0].isBare).toBe(true);
    expect(result.weeks[0].cropIds).not.toContain("crimson_clover");
    expect(result.weeks[0].cropIds).not.toContain("winter_rye");
  });

  it("treats an unknown crop id like fallow instead of throwing", () => {
    const unknownCropStrategy: RotationStrategy = {
      strategy_id: "unknown_crop_test",
      title: "Unknown crop test",
      is_baseline: true,
      timeline: [
        {
          year: 2026,
          season: "warm_season",
          crops: ["mystery_crop"],
          alternate_crop_ids: [],
          is_mix: false,
          purpose: "test",
        },
      ],
      simulation_scores: null,
      qualitative_analysis: emptyQualitativeAnalysis,
    };

    let result: ReturnType<typeof buildTimeline>;
    expect(() => {
      result = buildTimeline(unknownCropStrategy, crops, frostWeeks, 1);
    }).not.toThrow();

    expect(result!.slots[0].occupiedWeeks).toEqual([]);
    expect(result!.weeks.every((w) => w.isBare)).toBe(true);
  });

  it("respects a custom years parameter", () => {
    const result = buildTimeline(baselineStrategy, crops, frostWeeks, 1);
    expect(result.years).toBe(1);
    expect(result.weeks.length).toBe(52);
    expect(result.slots.length).toBe(baselineStrategy.timeline.length);
  });
});
