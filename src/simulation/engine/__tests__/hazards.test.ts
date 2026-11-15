import { describe, expect, it } from "vitest";
import { fillFallowSlot } from "../../components/CoverCropPicker/coverCropEdits";
import demoFieldJson from "../../fixtures/demo-field.json";
import { getHazards } from "../hazards";
import type { FieldJson } from "../types";

const demoField = demoFieldJson as unknown as FieldJson;

describe("getHazards", () => {
  it("turns a heavy-rain hit on bare soil into a cleared hazard once a cover crop fills that gap", () => {
    // Baseline's fallow slot (template index 1) is bare over week 50
    // (absoluteWeek 49), which the demo field's climatology marks as heavy
    // rain (rainfall_mm >= 20) — a hit on bare soil.
    const before = getHazards(demoField, 0).find((h) => h.absoluteWeek === 49 && h.type === "heavy_rain");
    expect(before).toBeDefined();
    expect(before!.cleared).toBe(false);
    expect(before!.reason).toContain("bare soil");

    // Filling that same slot with a cover crop (crimson_clover's 26-week
    // window covers week 50) should clear the same hazard.
    const newTimeline = fillFallowSlot(demoField.rotation_strategies[0].timeline, 1, "crimson_clover", []);
    const editedField: FieldJson = {
      ...demoField,
      rotation_strategies: demoField.rotation_strategies.map((s, i) => (i === 0 ? { ...s, timeline: newTimeline } : s)),
    };
    const after = getHazards(editedField, 0).find((h) => h.absoluteWeek === 49 && h.type === "heavy_rain");
    expect(after).toBeDefined();
    expect(after!.cleared).toBe(true);
    expect(after!.reason).toContain("Crimson Clover");
  });
});
