import { describe, expect, it } from "vitest";
import demoField from "../../fixtures/demo-field.json";
import { runSimulation } from "../index";
import type { FieldJson } from "../types";

const fieldJson = demoField as unknown as FieldJson;

describe("runSimulation", () => {
  it("fills every score field for all 3 demo strategies, leaving no nulls", () => {
    const result = runSimulation(fieldJson);

    expect(result.rotation_strategies).toHaveLength(3);
    for (const strategy of result.rotation_strategies) {
      const scores = strategy.simulation_scores;
      expect(scores).not.toBeNull();
      expect(scores!.overall_success_score).not.toBeNull();
      expect(scores!.water_efficiency_score).not.toBeNull();
      expect(scores!.erosion_protection_score).not.toBeNull();
      expect(scores!.pest_break_score).not.toBeNull();
      expect(scores!.season_fit_score).not.toBeNull();
      expect(scores!.income_score).not.toBeNull();
      expect(scores!.soil_health_delta).not.toBeNull();
      expect(scores!.estimated_irrigation_mm).not.toBeNull();
      expect(scores!.nitrogen_balance_kg_ha).not.toBeNull();
      expect(scores!.confidence).not.toBeNull();
      expect(scores!.check_locally).not.toBeNull();
      expect(scores!.seasons).not.toBeNull();
      expect(scores!.seasons!.length).toBeGreaterThan(0);
    }
  });

  it("does not mutate the input field JSON", () => {
    runSimulation(fieldJson);
    expect(fieldJson.rotation_strategies[0].simulation_scores!.overall_success_score).toBeNull();
  });

  it("is deterministic for the same input", () => {
    const first = runSimulation(fieldJson);
    const second = runSimulation(fieldJson);
    expect(second).toEqual(first);
  });
});
