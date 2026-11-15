import { describe, expect, it } from "vitest";
import demoField from "../../fixtures/demo-field.json";
import type { FieldJson, Priorities } from "../../engine/types";
import { withLivePriorities } from "./livePriorityText";

const priorities: Priorities = { water: 9, income: 7, soil_health: 8, pests: 6 };
const field = demoField as unknown as FieldJson;

describe("withLivePriorities", () => {
  it("swaps a stale score for the slider's current value", () => {
    expect(withLivePriorities("to match your Soil Health priority (3/10).", priorities)).toBe(
      "to match your Soil Health priority (8/10).",
    );
  });

  it("leaves a score that already matches alone", () => {
    expect(withLivePriorities("Aligns with your Water priority (9/10) by cutting irrigation.", priorities)).toBe(
      "Aligns with your Water priority (9/10) by cutting irrigation.",
    );
  });

  it("handles every priority name, including the underscored form", () => {
    expect(withLivePriorities("Water priority (1/10)", priorities)).toBe("Water priority (9/10)");
    expect(withLivePriorities("Income priority (1/10)", priorities)).toBe("Income priority (7/10)");
    expect(withLivePriorities("soil_health priority (1/10)", priorities)).toBe("soil_health priority (8/10)");
    expect(withLivePriorities("Pests priority (1/10)", priorities)).toBe("Pests priority (6/10)");
  });

  it("rewrites more than one mention in the same sentence", () => {
    expect(
      withLivePriorities("Balances your Water priority (2/10) against your Income priority (2/10).", priorities),
    ).toBe("Balances your Water priority (9/10) against your Income priority (7/10).");
  });

  it("drops a score whose priority name it can't place", () => {
    expect(withLivePriorities("Set for your Harvest priority (4/10) this year.", priorities)).toBe(
      "Set for your Harvest priority this year.",
    );
  });

  it("drops a bare score with no priority name at all", () => {
    expect(withLivePriorities("Rated (7/10) overall.", priorities)).toBe("Rated overall.");
  });

  it("never swallows the sentence in front of the mention", () => {
    const text = "Addresses bare-soil winter erosion and replenishes nitrogen to match your Soil Health priority (8/10).";

    expect(withLivePriorities(text, { ...priorities, soil_health: 2 })).toBe(
      "Addresses bare-soil winter erosion and replenishes nitrogen to match your Soil Health priority (2/10).",
    );
  });

  it("leaves text without any score untouched", () => {
    const text = field.rotation_strategies[0].qualitative_analysis.why_suggested;

    expect(text).not.toContain("/10");
    expect(withLivePriorities(text, priorities)).toBe(text);
  });

  it("tracks the demo fixture's own mentions as the sliders move", () => {
    const soilText = field.rotation_strategies[1].qualitative_analysis.why_suggested;
    const waterText = field.rotation_strategies[2].qualitative_analysis.why_suggested;

    expect(withLivePriorities(soilText, priorities)).toContain("Soil Health priority (8/10)");
    expect(withLivePriorities(soilText, { ...priorities, soil_health: 0 })).toContain("Soil Health priority (0/10)");
    expect(withLivePriorities(waterText, { ...priorities, water: 10 })).toContain("Water priority (10/10)");
  });

  it("is idempotent", () => {
    const once = withLivePriorities("your Water priority (1/10).", priorities);

    expect(withLivePriorities(once, priorities)).toBe(once);
  });
});
