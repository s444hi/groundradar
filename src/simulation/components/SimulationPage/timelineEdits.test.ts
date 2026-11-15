import { describe, expect, it } from "vitest";
import { swapAlternateCrop, swapTemplateSlots } from "./timelineEdits";
import type { RotationSlot } from "../../engine/types";

function makeSlot(overrides: Partial<RotationSlot> = {}): RotationSlot {
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

describe("swapTemplateSlots", () => {
  it("swaps crops/is_mix/alternate_crop_ids/purpose between two same-season slots, keeping year/season", () => {
    const timeline = [
      makeSlot({ year: 2026, season: "warm_season", crops: ["bell_pepper"], purpose: "cash crop" }),
      makeSlot({ year: 2027, season: "warm_season", crops: ["bush_bean"], purpose: "second-year cash crop" }),
    ];
    const result = swapTemplateSlots(timeline, 0, 1);
    expect(result[0]).toMatchObject({ year: 2026, season: "warm_season", crops: ["bush_bean"], purpose: "second-year cash crop" });
    expect(result[1]).toMatchObject({ year: 2027, season: "warm_season", crops: ["bell_pepper"], purpose: "cash crop" });
  });

  it("is a no-op for the same index or an out-of-range index", () => {
    const timeline = [makeSlot(), makeSlot()];
    expect(swapTemplateSlots(timeline, 0, 0)).toBe(timeline);
    expect(swapTemplateSlots(timeline, 0, 5)).toBe(timeline);
    expect(swapTemplateSlots(timeline, -1, 1)).toBe(timeline);
  });

  it("is a no-op across different seasons (warm cannot swap with cool)", () => {
    const timeline = [
      makeSlot({ season: "warm_season", crops: ["bell_pepper"] }),
      makeSlot({ season: "cool_season", crops: ["fallow"] }),
    ];
    expect(swapTemplateSlots(timeline, 0, 1)).toBe(timeline);
  });

  it("does not mutate the input array", () => {
    const timeline = [makeSlot({ crops: ["a"] }), makeSlot({ crops: ["b"] })];
    swapTemplateSlots(timeline, 0, 1);
    expect(timeline[0].crops).toEqual(["a"]);
    expect(timeline[1].crops).toEqual(["b"]);
  });
});

describe("swapAlternateCrop", () => {
  it("swaps a slot's crops with its alternates, reversibly", () => {
    const timeline = [makeSlot({ crops: ["bush_bean"], alternate_crop_ids: ["bell_pepper"] })];
    const swapped = swapAlternateCrop(timeline, 0);
    expect(swapped[0]).toMatchObject({ crops: ["bell_pepper"], alternate_crop_ids: ["bush_bean"] });

    const swappedBack = swapAlternateCrop(swapped, 0);
    expect(swappedBack[0]).toMatchObject({ crops: ["bush_bean"], alternate_crop_ids: ["bell_pepper"] });
  });

  it("sets is_mix when the alternates are themselves a mix", () => {
    const timeline = [makeSlot({ crops: ["winter_rye"], alternate_crop_ids: ["crimson_clover", "winter_rye"] })];
    const swapped = swapAlternateCrop(timeline, 0);
    expect(swapped[0].is_mix).toBe(true);
  });

  it("is a no-op when the slot has no alternates", () => {
    const timeline = [makeSlot({ alternate_crop_ids: [] })];
    expect(swapAlternateCrop(timeline, 0)).toBe(timeline);
  });
});
