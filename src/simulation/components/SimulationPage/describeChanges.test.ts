import { describe, expect, it } from "vitest";
import cropsJson from "../../data/crops.json";
import type { CropsById, RotationSlot } from "../../engine/types";
import { describeChanges } from "./describeChanges";

const crops = cropsJson.crops as unknown as CropsById;

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

describe("describeChanges", () => {
  it("describes a clean swap as one message, not two", () => {
    const before = [
      slot({ year: 2026, season: "warm_season", crops: ["bell_pepper"] }),
      slot({ year: 2026, season: "cool_season", crops: ["fallow"] }),
      slot({ year: 2027, season: "warm_season", crops: ["bush_bean"] }),
    ];
    const after = [
      slot({ year: 2026, season: "warm_season", crops: ["bush_bean"] }),
      slot({ year: 2026, season: "cool_season", crops: ["fallow"] }),
      slot({ year: 2027, season: "warm_season", crops: ["bell_pepper"] }),
    ];
    const changes = describeChanges(before, after, crops);
    expect(changes).toEqual(["Swapped Bell Peppers (2026) and Bush Beans (2027)"]);
  });

  it("describes filling a bare gap as 'Added'", () => {
    const before = [slot({ year: 2027, season: "cool_season", crops: ["fallow"] })];
    const after = [slot({ year: 2027, season: "cool_season", crops: ["crimson_clover"] })];
    expect(describeChanges(before, after, crops)).toEqual(["Added Crimson Clover in the winter 2027 gap"]);
  });

  it("describes a non-swap, non-bare change as 'Changed'", () => {
    const before = [slot({ year: 2026, season: "warm_season", crops: ["bell_pepper"] })];
    const after = [slot({ year: 2026, season: "warm_season", crops: ["bush_bean"] })];
    expect(describeChanges(before, after, crops)).toEqual(["Changed Bell Peppers (2026) to Bush Beans"]);
  });

  it("returns an empty list when nothing changed", () => {
    const timeline = [slot()];
    expect(describeChanges(timeline, timeline, crops)).toEqual([]);
  });

  it("handles a mix slot's crops jointly in its label", () => {
    const before = [slot({ year: 2026, season: "cool_season", crops: ["fallow"] })];
    const after = [slot({ year: 2026, season: "cool_season", crops: ["crimson_clover", "winter_rye"], is_mix: true })];
    expect(describeChanges(before, after, crops)).toEqual(["Added Crimson Clover + Winter Rye in the winter 2026 gap"]);
  });
});
