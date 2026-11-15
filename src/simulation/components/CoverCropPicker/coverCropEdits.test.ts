import { describe, expect, it } from "vitest";
import cropsJson from "../../data/crops.json";
import demoField from "../../fixtures/demo-field.json";
import { getFrostWeeks } from "../../engine/frost";
import type { CropsById, FrostDates, FrostWeeks, RotationSlot } from "../../engine/types";
import {
  coverCropReason,
  fillFallowSlot,
  gapOwnsAFallowSlot,
  getCoverCropOptions,
  insertCoverCropSlot,
  removeCoverCropSlot,
} from "./coverCropEdits";

const crops = cropsJson.crops as unknown as CropsById;
const frostWeeks: FrostWeeks = getFrostWeeks(demoField.climate_data.frost_dates as unknown as FrostDates);

function slot(overrides: Partial<RotationSlot> = {}): RotationSlot {
  return {
    year: 2026,
    season: "warm_season",
    crops: ["bell_pepper"],
    alternate_crop_ids: [],
    is_mix: false,
    purpose: "test",
    ...overrides,
  };
}

describe("getCoverCropOptions", () => {
  it("includes a cool-season cover crop whose planting window starts inside the gap", () => {
    // first_fall_frost (46) - 8 = week 38 -> startAbsoluteWeek 37, within this range.
    const options = getCoverCropOptions(
      { startAbsoluteWeek: 30, endAbsoluteWeek: 52, yearOffset: 0 },
      crops,
      frostWeeks,
      "farm",
    );
    expect(options).toContain("crimson_clover");
    expect(options).toContain("winter_rye");
  });

  it("excludes a cover crop whose planting window starts outside the gap", () => {
    const options = getCoverCropOptions(
      { startAbsoluteWeek: 0, endAbsoluteWeek: 5, yearOffset: 0 },
      crops,
      frostWeeks,
      "farm",
    );
    expect(options).not.toContain("crimson_clover");
  });

  it("excludes crops that don't fit the mode", () => {
    // summer_squash only fits "garden".
    const options = getCoverCropOptions(
      { startAbsoluteWeek: 0, endAbsoluteWeek: 156, yearOffset: 0 },
      crops,
      frostWeeks,
      "farm",
    );
    expect(options).not.toContain("summer_squash");
  });

  it("checks both the gap's starting year and the next, for a gap spanning a year boundary", () => {
    // crimson_clover plants at first_fall_frost(46)-8=week38 -> absolute
    // week 37 within yearOffset 0, or 89 within yearOffset 1. A gap tagged
    // yearOffset:0 but whose range only brackets the yearOffset+1
    // occurrence should still catch it.
    const spanning = getCoverCropOptions(
      { startAbsoluteWeek: 80, endAbsoluteWeek: 95, yearOffset: 0 },
      crops,
      frostWeeks,
      "farm",
    );
    expect(spanning).toContain("crimson_clover");
  });
});

describe("coverCropReason", () => {
  it("prioritizes nitrogen fixing over root depth", () => {
    expect(coverCropReason(crops.hairy_vetch)).toBe("Adds nitrogen for next year's crop");
  });

  it("falls back to erosion protection for a deep-rooted non-fixer, worded by season", () => {
    expect(coverCropReason(crops.winter_rye)).toBe("Holds soil through winter rain");
    expect(coverCropReason(crops.sorghum_sudangrass)).toBe("Holds soil through summer storms");
  });

  it("falls back to a generic ground-cover reason otherwise", () => {
    expect(coverCropReason(crops.oats)).toBe("Covers bare soil until the next planting");
  });
});

describe("gapOwnsAFallowSlot", () => {
  it("is true for an actual fallow slot", () => {
    const timeline = [slot({ season: "warm_season", crops: ["bell_pepper"] }), slot({ season: "cool_season", crops: ["fallow"] })];
    expect(gapOwnsAFallowSlot(timeline, 1, crops)).toBe(true);
  });

  it("is false for a real crop's own slot", () => {
    const timeline = [slot({ season: "warm_season", crops: ["bell_pepper"] }), slot({ season: "cool_season", crops: ["fallow"] })];
    expect(gapOwnsAFallowSlot(timeline, 0, crops)).toBe(false);
  });
});

describe("fillFallowSlot / insertCoverCropSlot / removeCoverCropSlot round trip", () => {
  const originalTimeline = [
    slot({ year: 2026, season: "warm_season", crops: ["bell_pepper"], purpose: "Primary cash crop yield" }),
    slot({ year: 2026, season: "cool_season", crops: ["fallow"], purpose: "Unplanted overwinter period" }),
  ];

  it("fills a fallow slot in place, keeping its year and season", () => {
    const filled = fillFallowSlot(originalTimeline, 1, "crimson_clover", ["winter_rye"]);
    expect(filled[1]).toMatchObject({
      year: 2026,
      season: "cool_season",
      crops: ["crimson_clover"],
      alternate_crop_ids: ["winter_rye"],
      purpose: "Cover crop added in simulation",
    });
    expect(filled[0]).toEqual(originalTimeline[0]); // untouched
  });

  it("removing a filled fallow slot reverts it to its original content", () => {
    const filled = fillFallowSlot(originalTimeline, 1, "crimson_clover", ["winter_rye"]);
    const removed = removeCoverCropSlot(filled, originalTimeline, 1, crops);
    expect(removed).toEqual(originalTimeline);
  });

  it("inserts a new slot before the owning slot, reusing its template year", () => {
    const inserted = insertCoverCropSlot(originalTimeline, 0, "crimson_clover", [], crops);
    expect(inserted).toHaveLength(3);
    expect(inserted[0]).toMatchObject({ year: 2026, season: "cool_season", crops: ["crimson_clover"], purpose: "Cover crop added in simulation" });
    expect(inserted[1]).toEqual(originalTimeline[0]); // bell_pepper shifted to index 1
    expect(inserted[2]).toEqual(originalTimeline[1]); // fallow shifted to index 2
  });

  it("removing an inserted slot deletes it entirely, even if it collides in year+season with a real (non-fallow) slot", () => {
    // Build a timeline with no fallow slot at all (like strategy 2/3), so
    // the inserted cool-season crop's (year, season) coincidentally matches
    // the real cool-season mix slot already there.
    const noFallowTimeline = [
      slot({ year: 2026, season: "warm_season", crops: ["bell_pepper"] }),
      slot({ year: 2026, season: "cool_season", crops: ["crimson_clover", "winter_rye"], is_mix: true }),
    ];
    const inserted = insertCoverCropSlot(noFallowTimeline, 0, "oats", [], crops);
    // oats is cool_season -> inserted[0] now collides in (year, season) with
    // the real mix slot (now at index 2).
    expect(inserted[0].season).toBe("cool_season");
    expect(inserted[2].crops).toEqual(["crimson_clover", "winter_rye"]);

    const removed = removeCoverCropSlot(inserted, noFallowTimeline, 0, crops);
    // Must delete the inserted oats slot, not revert it to the mix's content.
    expect(removed).toEqual(noFallowTimeline);
  });
});
