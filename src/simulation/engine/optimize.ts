import { simulateStrategy } from "./simulate";
import type {
  CropId,
  CropsById,
  FarmMode,
  FrostDates,
  PastRotationSlot,
  Priorities,
  RotationSlot,
  RotationStrategy,
  SoilProfile,
  WeeklyClimatologyEntry,
} from "./types";

export interface OptimizeContext {
  crops: CropsById;
  soil: SoilProfile;
  pastRotation: PastRotationSlot[];
  frostDates: FrostDates;
  weeklyClimatology: WeeklyClimatologyEntry[];
  slopePercent: number;
  priorities: Priorities;
  mode: FarmMode;
  years?: number; // default 3, kept consistent with the main simulation
}

export interface OptimizeResult {
  strategy: RotationStrategy;
  overallScore: number;
  improved: boolean;
}

function scoreStrategy(strategy: RotationStrategy, ctx: OptimizeContext): number {
  const result = simulateStrategy({
    strategy,
    crops: ctx.crops,
    soil: ctx.soil,
    pastRotation: ctx.pastRotation,
    frostDates: ctx.frostDates,
    weeklyClimatology: ctx.weeklyClimatology,
    slopePercent: ctx.slopePercent,
    priorities: ctx.priorities,
    years: ctx.years,
  });
  return result.overall_success_score ?? 0;
}

function cloneTimeline(timeline: RotationSlot[]): RotationSlot[] {
  return timeline.map((slot) => ({ ...slot }));
}

// Swaps what's planted between two slots (crops, is_mix, alternate ids, and
// purpose travel together), leaving year/season in place. An agronomically
// bad swap (e.g. a frost-tender crop landing in the cool season) is never
// "kept" by the caller because season_fit's multiplier tanks its score.
function withSwappedSlots(strategy: RotationStrategy, i: number, j: number): RotationStrategy {
  const timeline = cloneTimeline(strategy.timeline);
  const a = timeline[i];
  const b = timeline[j];
  timeline[i] = { ...a, crops: b.crops, is_mix: b.is_mix, alternate_crop_ids: b.alternate_crop_ids, purpose: b.purpose };
  timeline[j] = { ...b, crops: a.crops, is_mix: a.is_mix, alternate_crop_ids: a.alternate_crop_ids, purpose: a.purpose };
  return { ...strategy, timeline };
}

// Only ever touches a slot that's already bare (fallow or an unknown crop
// id) — never a slot with a real cash crop in it, so this move can't trade
// away income to chase a higher score.
function withCoverCropInserted(strategy: RotationStrategy, slotIndex: number, cropId: CropId): RotationStrategy {
  const timeline = strategy.timeline.map((slot, idx) =>
    idx === slotIndex ? { ...slot, crops: [cropId], is_mix: false } : { ...slot },
  );
  return { ...strategy, timeline };
}

function isBareSlot(slot: RotationSlot, crops: CropsById): boolean {
  return slot.crops.every((id) => !crops[id] || !crops[id].planting_window);
}

function candidateCoverCrops(crops: CropsById, mode: FarmMode): CropId[] {
  return Object.entries(crops)
    .filter(([, crop]) => crop.is_cover_crop && crop.fits.includes(mode))
    .map(([id]) => id);
}

/**
 * "Find a better order" (engine rule 11): local search, not brute force.
 * Tries swapping crops between every pair of slots and inserting a cover
 * crop into every bare slot, keeping any change that raises
 * overall_success_score, until a full pass finds no further improvement.
 */
export function findBetterRotation(strategy: RotationStrategy, ctx: OptimizeContext): OptimizeResult {
  let current = strategy;
  let currentScore = scoreStrategy(current, ctx);
  let improvedAny = false;

  let improvedThisPass = true;
  while (improvedThisPass) {
    improvedThisPass = false;

    for (let i = 0; i < current.timeline.length; i++) {
      for (let j = i + 1; j < current.timeline.length; j++) {
        const candidate = withSwappedSlots(current, i, j);
        const candidateScore = scoreStrategy(candidate, ctx);
        if (candidateScore > currentScore) {
          current = candidate;
          currentScore = candidateScore;
          improvedThisPass = true;
          improvedAny = true;
        }
      }
    }

    for (let i = 0; i < current.timeline.length; i++) {
      if (!isBareSlot(current.timeline[i], ctx.crops)) continue;
      for (const coverCropId of candidateCoverCrops(ctx.crops, ctx.mode)) {
        const candidate = withCoverCropInserted(current, i, coverCropId);
        const candidateScore = scoreStrategy(candidate, ctx);
        if (candidateScore > currentScore) {
          current = candidate;
          currentScore = candidateScore;
          improvedThisPass = true;
          improvedAny = true;
        }
      }
    }
  }

  return { strategy: current, overallScore: currentScore, improved: improvedAny };
}
