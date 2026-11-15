import { describe, expect, it } from "vitest";
import cropsJson from "../../data/crops.json";
import demoField from "../../fixtures/demo-field.json";
import { getFrostWeeks } from "../../engine/frost";
import { buildTimeline } from "../../engine/timeline";
import { assignSlotOwnership, groupWeeksIntoSegments } from "./groupWeeksIntoSegments";
import type { CropsById, ExpandedRotationSlot, FrostDates, RotationStrategy, TimelineWeek } from "../../engine/types";

const crops = cropsJson.crops as unknown as CropsById;
const frostWeeks = getFrostWeeks(demoField.climate_data.frost_dates as unknown as FrostDates);
const baselineStrategy = demoField.rotation_strategies[0] as unknown as RotationStrategy;

function makeWeek(absoluteWeek: number, cropIds: string[]): TimelineWeek {
  return {
    absoluteWeek,
    yearOffset: Math.floor(absoluteWeek / 52),
    week: (absoluteWeek % 52) + 1,
    cropIds,
    isBare: cropIds.length === 0,
  };
}

describe("groupWeeksIntoSegments", () => {
  it("merges a bare/crop/bare pattern into 3 segments with correct bounds", () => {
    const weeks: TimelineWeek[] = [
      makeWeek(0, []),
      makeWeek(1, []),
      makeWeek(2, ["tomato"]),
      makeWeek(3, ["tomato"]),
      makeWeek(4, []),
    ];
    const slots: ExpandedRotationSlot[] = [
      {
        year: 2026,
        season: "warm_season",
        crops: ["tomato"],
        alternate_crop_ids: [],
        is_mix: false,
        purpose: "",
        slotIndex: 0,
        yearOffset: 0,
        occupiedWeeks: [{ cropId: "tomato", startAbsoluteWeek: 2, endAbsoluteWeek: 3 }],
      },
    ];
    const segments = groupWeeksIntoSegments({ strategyId: "t", years: 1, slots, weeks });

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ isBare: true, startAbsoluteWeek: 0, endAbsoluteWeek: 1, weekCount: 2 });
    expect(segments[1]).toMatchObject({ isBare: false, cropIds: ["tomato"], startAbsoluteWeek: 2, endAbsoluteWeek: 3, weekCount: 2 });
    expect(segments[2]).toMatchObject({ isBare: true, startAbsoluteWeek: 4, endAbsoluteWeek: 4, weekCount: 1 });
  });

  it("merges adjacent weeks with the same crop ids regardless of array order", () => {
    const weeks: TimelineWeek[] = [makeWeek(0, ["a", "b"]), makeWeek(1, ["b", "a"])];
    const slots: ExpandedRotationSlot[] = [
      {
        year: 2026,
        season: "cool_season",
        crops: ["a", "b"],
        alternate_crop_ids: [],
        is_mix: true,
        purpose: "",
        slotIndex: 0,
        yearOffset: 0,
        occupiedWeeks: [
          { cropId: "a", startAbsoluteWeek: 0, endAbsoluteWeek: 1 },
          { cropId: "b", startAbsoluteWeek: 0, endAbsoluteWeek: 1 },
        ],
      },
    ];
    const segments = groupWeeksIntoSegments({ strategyId: "t", years: 1, slots, weeks });
    expect(segments).toHaveLength(1);
    expect(segments[0].weekCount).toBe(2);
  });

  it("produces exactly 7 segments with the right week counts and slot ownership on the real baseline strategy", () => {
    const weeklyTimeline = buildTimeline(baselineStrategy, crops, frostWeeks, 3);
    const segments = groupWeeksIntoSegments(weeklyTimeline);

    expect(segments.map((s) => s.weekCount)).toEqual([12, 11, 41, 11, 41, 11, 29]);
    expect(segments.map((s) => s.isBare)).toEqual([true, false, true, false, true, false, true]);
    expect(segments.map((s) => s.slotIndexes)).toEqual([[0], [0], [1], [2], [3], [4], [5]]);

    // Segment 3 (the merged bare stretch) crosses the calendar-year boundary.
    expect(segments[2].startAbsoluteWeek).toBe(23);
    expect(segments[2].endAbsoluteWeek).toBe(63);
    expect(Math.floor(segments[2].startAbsoluteWeek / 52)).toBe(0);
    expect(Math.floor(segments[2].endAbsoluteWeek / 52)).toBe(1);
  });
});

describe("assignSlotOwnership", () => {
  it("attributes the leading gap to the first slot when no bare slot precedes it", () => {
    const slots: ExpandedRotationSlot[] = [
      {
        year: 2026,
        season: "warm_season",
        crops: ["tomato"],
        alternate_crop_ids: [],
        is_mix: false,
        purpose: "",
        slotIndex: 0,
        yearOffset: 0,
        occupiedWeeks: [{ cropId: "tomato", startAbsoluteWeek: 5, endAbsoluteWeek: 10 }],
      },
    ];
    const ranges = assignSlotOwnership(slots, 52);
    expect(ranges[0]).toEqual({ start: 0, end: 4, slotIndexes: [0] });
  });

  it("attributes a trailing gap with no following occupied slot to the last slot", () => {
    const slots: ExpandedRotationSlot[] = [
      {
        year: 2026,
        season: "warm_season",
        crops: ["tomato"],
        alternate_crop_ids: [],
        is_mix: false,
        purpose: "",
        slotIndex: 0,
        yearOffset: 0,
        occupiedWeeks: [{ cropId: "tomato", startAbsoluteWeek: 0, endAbsoluteWeek: 5 }],
      },
      {
        year: 2026,
        season: "cool_season",
        crops: ["fallow"],
        alternate_crop_ids: [],
        is_mix: false,
        purpose: "",
        slotIndex: 1,
        yearOffset: 0,
        occupiedWeeks: [],
      },
    ];
    const ranges = assignSlotOwnership(slots, 52);
    const trailing = ranges[ranges.length - 1];
    expect(trailing).toEqual({ start: 6, end: 51, slotIndexes: [1] });
  });
});
