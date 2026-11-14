import { describe, expect, it } from "vitest";
import { groupReasons } from "./groupReasons";
import type { Season, SeasonResult } from "../../engine/types";

function makeSeason(season: Season, reasons: { text: string; delta: number }[]): SeasonResult {
  return {
    year: 2026,
    season,
    crops: [],
    score: 90,
    subscores: {
      water_efficiency_score: 90,
      erosion_protection_score: 90,
      pest_break_score: 90,
      season_fit_score: 90,
      income_score: 90,
      nitrogen_score: 90,
    },
    reasons,
    weather_events: [],
  };
}

describe("groupReasons", () => {
  it("annotates a reason repeated identically across the same season every year", () => {
    const seasons = [
      makeSeason("cool_season", [{ text: "Bare winter raised erosion risk.", delta: -40 }]),
      makeSeason("cool_season", [{ text: "Bare winter raised erosion risk.", delta: -40 }]),
      makeSeason("cool_season", [{ text: "Bare winter raised erosion risk.", delta: -40 }]),
    ];
    const grouped = groupReasons(seasons);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ count: 3, annotation: "(every winter ×3)" });
  });

  it("annotates with a bare count when the repeat spans both season types", () => {
    const seasons = [
      makeSeason("warm_season", [{ text: "Shared text.", delta: -10 }]),
      makeSeason("cool_season", [{ text: "Shared text.", delta: -10 }]),
    ];
    const grouped = groupReasons(seasons);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ count: 2, annotation: "(×2)" });
  });

  it("gives a single occurrence no annotation", () => {
    const seasons = [makeSeason("warm_season", [{ text: "Unique text.", delta: -5 }])];
    const grouped = groupReasons(seasons);
    expect(grouped[0]).toMatchObject({ count: 1, annotation: null });
  });

  it("sorts grouped reasons by absolute delta descending", () => {
    const seasons = [
      makeSeason("warm_season", [
        { text: "Small change.", delta: -3 },
        { text: "Big change.", delta: -40 },
        { text: "Medium change.", delta: 10 },
      ]),
    ];
    const grouped = groupReasons(seasons);
    expect(grouped.map((g) => g.text)).toEqual(["Big change.", "Medium change.", "Small change."]);
  });

  it("does not collapse reasons whose text legitimately differs each year", () => {
    const seasons = [
      makeSeason("warm_season", [{ text: "Nitrogen at 25/100.", delta: -30 }]),
      makeSeason("warm_season", [{ text: "Nitrogen at 13/100.", delta: -40 }]),
    ];
    const grouped = groupReasons(seasons);
    expect(grouped).toHaveLength(2);
    expect(grouped.every((g) => g.count === 1 && g.annotation === null)).toBe(true);
  });
});
