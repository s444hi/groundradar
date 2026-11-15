import { describe, expect, it } from "vitest";
import { groupReasons } from "./groupReasons";
import type { ScoreReason, Season, SeasonResult } from "../../engine/types";

function makeSeason(season: Season, reasons: ScoreReason[]): SeasonResult {
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

  it("does not collapse reasons whose text legitimately differs each year when no category is set", () => {
    const seasons = [
      makeSeason("warm_season", [{ text: "Nitrogen at 25/100.", delta: -30 }]),
      makeSeason("warm_season", [{ text: "Nitrogen at 13/100.", delta: -40 }]),
    ];
    const grouped = groupReasons(seasons);
    expect(grouped).toHaveLength(2);
    expect(grouped.every((g) => g.count === 1 && g.annotation === null)).toBe(true);
  });

  it("collapses a changing-number sequence into one downward trend line", () => {
    const seasons = [
      makeSeason("warm_season", [
        { text: "Bell Peppers at 25/100.", delta: -75, category: "nitrogen", trendValue: 25, subjectLabel: "Bell Peppers" },
      ]),
      makeSeason("warm_season", [
        { text: "Bell Peppers at 13/100.", delta: -87, category: "nitrogen", trendValue: 13, subjectLabel: "Bell Peppers" },
      ]),
      makeSeason("warm_season", [
        { text: "Bell Peppers at 1/100.", delta: -99, category: "nitrogen", trendValue: 1, subjectLabel: "Bell Peppers" },
      ]),
    ];
    const grouped = groupReasons(seasons);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].text).toBe("Bell Peppers drained soil nitrogen each year (25 → 13 → 1).");
    expect(grouped[0].delta).toBe(-99); // last occurrence's delta
    expect(grouped[0].count).toBe(3);
  });

  it("collapses an increasing pest-pressure sequence into one upward trend line", () => {
    const seasons = [
      makeSeason("warm_season", [
        { text: "p55", delta: -27.5, category: "pests", trendValue: 55, subjectLabel: "Nightshade family (Solanaceae)" },
      ]),
      makeSeason("warm_season", [
        { text: "p60", delta: -30, category: "pests", trendValue: 60, subjectLabel: "Nightshade family (Solanaceae)" },
      ]),
      makeSeason("warm_season", [
        { text: "p65", delta: -32.5, category: "pests", trendValue: 65, subjectLabel: "Nightshade family (Solanaceae)" },
      ]),
    ];
    const grouped = groupReasons(seasons);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].text).toBe("Nightshade family (Solanaceae) pest pressure built up each year (55 → 60 → 65).");
  });

  it("keeps a flat (non-monotonic) trend labeled as fluctuating", () => {
    const seasons = [
      makeSeason("warm_season", [
        { text: "a", delta: -75, category: "nitrogen", trendValue: 25, subjectLabel: "Bell Peppers" },
      ]),
      makeSeason("warm_season", [
        { text: "b", delta: -60, category: "nitrogen", trendValue: 40, subjectLabel: "Bell Peppers" },
      ]),
      makeSeason("warm_season", [
        { text: "c", delta: -75, category: "nitrogen", trendValue: 25, subjectLabel: "Bell Peppers" },
      ]),
    ];
    const grouped = groupReasons(seasons);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].text).toBe("Bell Peppers's effect on soil nitrogen fluctuated across the rotation (25 → 40 → 25).");
  });

  it("keeps different subjects in the same category in separate buckets (nitrogen fixer bonus vs. heavy feeder trend)", () => {
    const seasons = [
      makeSeason("warm_season", [
        { text: "Bell Peppers at 25/100.", delta: -75, category: "nitrogen", trendValue: 25, subjectLabel: "Bell Peppers" },
      ]),
      makeSeason("cool_season", [
        { text: "Crimson Clover also fixes its own nitrogen.", delta: 0, category: "nitrogen" },
      ]),
      makeSeason("warm_season", [
        { text: "Bell Peppers at 13/100.", delta: -87, category: "nitrogen", trendValue: 13, subjectLabel: "Bell Peppers" },
      ]),
      makeSeason("cool_season", [
        { text: "Crimson Clover also fixes its own nitrogen.", delta: 0, category: "nitrogen" },
      ]),
    ];
    const grouped = groupReasons(seasons);
    expect(grouped).toHaveLength(2);
    const trendLine = grouped.find((g) => g.text.includes("drained"));
    const bonusLine = grouped.find((g) => g.text.includes("fixes"));
    expect(trendLine?.text).toBe("Bell Peppers drained soil nitrogen each year (25 → 13).");
    expect(bonusLine).toMatchObject({ count: 2, annotation: "(every winter ×2)" });
  });

  it("falls back to listing items individually when trendValue is missing for some occurrences", () => {
    const seasons = [
      makeSeason("warm_season", [
        { text: "First.", delta: -10, category: "water", trendValue: 5, subjectLabel: "Bell Peppers" },
      ]),
      makeSeason("warm_season", [{ text: "Second.", delta: -20, category: "water", subjectLabel: "Bell Peppers" }]),
    ];
    const grouped = groupReasons(seasons);
    expect(grouped).toHaveLength(2);
    expect(grouped.map((g) => g.text).sort()).toEqual(["First.", "Second."]);
  });
});
