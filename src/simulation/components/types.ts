import type { RotationStrategy, SimulationScores } from "../engine/types";

// After runSimulation, simulation_scores is always populated.
export type ScoredRotationStrategy = RotationStrategy & {
  simulation_scores: SimulationScores;
};
