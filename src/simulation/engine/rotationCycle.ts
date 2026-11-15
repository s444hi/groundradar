import type { RotationSlot } from "./types";

export interface RotationCycle {
  rotationLength: number; // distinct years spanned by one cycle of the template (1 for a 1-year strategy)
  minYear: number;
}

/**
 * How many years one pass through `timeline` spans, and where it starts.
 * `buildTimeline` and `simulateStrategy` both tile the template forward by
 * whole cycles of this length instead of assuming every slot repeats every
 * single year — that assumption would otherwise overlap a 2+ year rotation's
 * later years onto its first year's calendar weeks.
 */
export function getRotationCycle(timeline: RotationSlot[]): RotationCycle {
  const years = timeline.map((slot) => slot.year);
  const minYear = Math.min(...years);
  return { rotationLength: Math.max(...years) - minYear + 1, minYear };
}

/** Absolute (0-indexed) year offset for template slot `slotYear`'s `cycle`-th repetition. */
export function placementYearOffset(
  cycle: number,
  rotationLength: number,
  slotYear: number,
  minYear: number,
): number {
  return cycle * rotationLength + (slotYear - minYear);
}
