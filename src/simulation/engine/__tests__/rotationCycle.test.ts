import { describe, expect, it } from "vitest";
import { getRotationCycle, placementYearOffset } from "../rotationCycle";
import type { RotationSlot } from "../types";

function slot(year: number): RotationSlot {
  return { year, season: "warm_season", crops: ["bush_bean"], alternate_crop_ids: [], is_mix: false, purpose: "test" };
}

describe("getRotationCycle", () => {
  it("gives rotationLength 1 for a 1-year template", () => {
    const timeline = [slot(2026), slot(2026)];
    expect(getRotationCycle(timeline)).toEqual({ rotationLength: 1, minYear: 2026 });
  });

  it("gives rotationLength 2 for a 2-year template", () => {
    const timeline = [slot(2026), slot(2026), slot(2027), slot(2027)];
    expect(getRotationCycle(timeline)).toEqual({ rotationLength: 2, minYear: 2026 });
  });
});

describe("placementYearOffset", () => {
  it("matches the worked example: 2-year rotation tiled across a 3-year window", () => {
    const rotationLength = 2;
    const minYear = 2026;
    // Cycle 0: year 1's slot (2026) at offset 0, year 2's slot (2027) at offset 1.
    expect(placementYearOffset(0, rotationLength, 2026, minYear)).toBe(0);
    expect(placementYearOffset(0, rotationLength, 2027, minYear)).toBe(1);
    // Cycle 1: year 1's slot repeats at offset 2 (the window's 3rd year);
    // year 2's slot would land at offset 3, outside a 3-year window (caller clips it).
    expect(placementYearOffset(1, rotationLength, 2026, minYear)).toBe(2);
    expect(placementYearOffset(1, rotationLength, 2027, minYear)).toBe(3);
  });

  it("reduces to the old yearOffset-per-pass behavior for a 1-year rotation", () => {
    const rotationLength = 1;
    const minYear = 2026;
    for (let cycle = 0; cycle < 3; cycle++) {
      expect(placementYearOffset(cycle, rotationLength, 2026, minYear)).toBe(cycle);
    }
  });
});
