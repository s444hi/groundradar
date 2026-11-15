import type { ConfidenceLevel } from "../engine/types";

export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  High: "var(--color-sim-good)",
  Medium: "var(--color-sim-warning)",
  Low: "var(--color-sim-risk)",
};
