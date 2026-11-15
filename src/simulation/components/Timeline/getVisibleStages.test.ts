import { describe, expect, it } from "vitest";
import { getVisibleStages } from "./getVisibleStages";
import { WIDE_THRESHOLD_PERCENT } from "./layout";

const WIDE = WIDE_THRESHOLD_PERCENT + 5;
const NARROW = WIDE_THRESHOLD_PERCENT - 1;

describe("getVisibleStages", () => {
  it("shows nothing before the segment starts", () => {
    expect(getVisibleStages({ startAbsoluteWeek: 10, weekCount: 10 }, WIDE, 9)).toEqual([]);
    expect(getVisibleStages({ startAbsoluteWeek: 10, weekCount: 10 }, NARROW, 9)).toEqual([]);
  });

  describe("wide segment", () => {
    it("reveals only sprout once the playhead passes the sprout position", () => {
      const segment = { startAbsoluteWeek: 0, weekCount: 100 };
      const stages = getVisibleStages(segment, WIDE, 18); // 18% progress
      expect(stages.map((s) => s.stageKey)).toEqual(["sprout"]);
    });

    it("reveals sprout and young once the playhead passes 50%", () => {
      const segment = { startAbsoluteWeek: 0, weekCount: 100 };
      const stages = getVisibleStages(segment, WIDE, 50);
      expect(stages.map((s) => s.stageKey)).toEqual(["sprout", "young"]);
    });

    it("reveals all three once the playhead passes 82%", () => {
      const segment = { startAbsoluteWeek: 0, weekCount: 100 };
      const stages = getVisibleStages(segment, WIDE, 82);
      expect(stages.map((s) => s.stageKey)).toEqual(["sprout", "young", "full"]);
    });

    it("shows nothing yet just before the sprout threshold", () => {
      const segment = { startAbsoluteWeek: 0, weekCount: 100 };
      expect(getVisibleStages(segment, WIDE, 17)).toEqual([]);
    });

    it("stays fully grown once the playhead has passed the segment entirely", () => {
      const segment = { startAbsoluteWeek: 0, weekCount: 100 };
      const stages = getVisibleStages(segment, WIDE, 500);
      expect(stages.map((s) => s.stageKey)).toEqual(["sprout", "young", "full"]);
    });
  });

  describe("narrow segment", () => {
    const segment = { startAbsoluteWeek: 20, weekCount: 30 };

    it("shows sprout for the first third of the segment", () => {
      const stages = getVisibleStages(segment, NARROW, 20); // progress 0
      expect(stages).toEqual([{ stageKey: "sprout", leftPercent: 50 }]);
    });

    it("shows young for the middle third", () => {
      const stages = getVisibleStages(segment, NARROW, 20 + 15); // progress 0.5
      expect(stages).toEqual([{ stageKey: "young", leftPercent: 50 }]);
    });

    it("shows full for the final third", () => {
      const stages = getVisibleStages(segment, NARROW, 20 + 25); // progress ~0.83
      expect(stages).toEqual([{ stageKey: "full", leftPercent: 50 }]);
    });

    it("stays full once the playhead has passed the segment entirely", () => {
      const stages = getVisibleStages(segment, NARROW, 1000);
      expect(stages).toEqual([{ stageKey: "full", leftPercent: 50 }]);
    });
  });

  it("treats a zero-length segment as fully grown immediately", () => {
    const stages = getVisibleStages({ startAbsoluteWeek: 5, weekCount: 0 }, NARROW, 5);
    expect(stages).toEqual([{ stageKey: "full", leftPercent: 50 }]);
  });
});
