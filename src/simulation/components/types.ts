import type { RotationSlot, RotationStrategy, SimulationScores, WeeklyTimeline } from "../engine/types";

// After runSimulation, simulation_scores is always populated.
export type ScoredRotationStrategy = RotationStrategy & {
  simulation_scores: SimulationScores;
};

// "Find a better order"'s result for one lane, kept around until the user
// accepts or dismisses it.
export interface OptimizerSuggestion {
  newTimeline: RotationSlot[];
  beforeScore: number;
  afterScore: number;
  changes: string[];
  changedTemplateIndices: Set<number>;
  proposedTimeline: WeeklyTimeline;
}
