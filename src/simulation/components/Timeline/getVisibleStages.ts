import { WIDE_THRESHOLD_PERCENT } from "./layout";

export type GrowthStageKey = "sprout" | "young" | "full";

export interface VisibleStage {
  stageKey: GrowthStageKey;
  leftPercent: number;
}

export interface SegmentTiming {
  startAbsoluteWeek: number;
  weekCount: number;
}

// Same x-positions CropCard renders stages at when a segment is wide.
const WIDE_STAGE_POSITIONS: VisibleStage[] = [
  { stageKey: "sprout", leftPercent: 18 },
  { stageKey: "young", leftPercent: 50 },
  { stageKey: "full", leftPercent: 82 },
];
const NARROW_STAGE_LEFT_PERCENT = 50;

/**
 * Pure: which growth stage(s) should be visible right now for a segment,
 * given how far the playhead (currentWeek) has progressed through it.
 * Nothing is visible before the segment starts. A wide segment reveals each
 * stage independently once the playhead passes that stage's x position
 * (so sprout/young/full can all be visible at once, at their own spots). A
 * narrow segment has only one rendered position, so it swaps sprout -> young
 * -> full in place based on progress through the segment's duration.
 */
export function getVisibleStages(
  segment: SegmentTiming,
  widthPercent: number,
  currentWeek: number,
): VisibleStage[] {
  if (currentWeek < segment.startAbsoluteWeek) return [];

  const progress =
    segment.weekCount > 0 ? Math.min(1, (currentWeek - segment.startAbsoluteWeek) / segment.weekCount) : 1;

  if (widthPercent < WIDE_THRESHOLD_PERCENT) {
    const stageKey: GrowthStageKey = progress < 1 / 3 ? "sprout" : progress < 2 / 3 ? "young" : "full";
    return [{ stageKey, leftPercent: NARROW_STAGE_LEFT_PERCENT }];
  }

  return WIDE_STAGE_POSITIONS.filter((position) => progress >= position.leftPercent / 100);
}
