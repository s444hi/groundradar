import cropsJson from "../data/crops.json";
import { computeConfidence } from "./confidence";
import { computeCheckLocally } from "./flags";
import { getFrostWeeks } from "./frost";
import { simulateStrategy } from "./simulate";
import type { CropsById, FieldJson, RotationStrategy } from "./types";

const crops = cropsJson.crops as unknown as CropsById;

/**
 * Public entry point for the Results page: runs the full engine (timeline,
 * soil, scoring, confidence, flags) over every rotation strategy in the
 * field JSON and returns a copy with each strategy's simulation_scores
 * filled in. Pure — the input is never mutated.
 */
export function runSimulation(fieldJson: FieldJson): FieldJson {
  const { field_profile, survey_inputs, climate_data } = fieldJson;
  const frostWeeks = getFrostWeeks(climate_data.frost_dates);

  const rotation_strategies: RotationStrategy[] = fieldJson.rotation_strategies.map((strategy) => {
    const simResult = simulateStrategy({
      strategy,
      crops,
      soil: field_profile.soil,
      pastRotation: survey_inputs.past_rotation,
      frostDates: climate_data.frost_dates,
      weeklyClimatology: climate_data.weekly_climatology,
      slopePercent: field_profile.slope_percent,
      priorities: survey_inputs.priorities,
    });
    const seasons = simResult.seasons ?? [];

    const confidence = computeConfidence({
      areaAcres: field_profile.area_acres,
      strategy,
      crops,
      seasons,
      weeklyClimatology: climate_data.weekly_climatology,
      frostWeeks,
    });

    const check_locally = computeCheckLocally({
      strategy,
      crops,
      priorities: survey_inputs.priorities,
      seasons,
    });

    return {
      ...strategy,
      simulation_scores: { ...simResult, confidence, check_locally },
    };
  });

  return { ...fieldJson, rotation_strategies };
}
