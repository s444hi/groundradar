import { candidateCoverCrops, isBareSlot } from "../../engine/optimize";
import type { Crop, CropId, CropsById, FarmMode, FrostWeeks, RotationSlot } from "../../engine/types";

export interface GapInfo {
  startAbsoluteWeek: number;
  endAbsoluteWeek: number;
  yearOffset: number;
}

export const ADDED_COVER_CROP_PURPOSE = "Cover crop added in simulation";

/**
 * Cover crops (fitting the field's mode) whose planting window starts
 * somewhere inside this specific bare gap. Checks both the gap's own
 * starting year and the next one, since a gap can span a year boundary
 * (e.g. a fallow stretch running from late one year into early the next).
 */
export function getCoverCropOptions(
  gap: GapInfo,
  crops: CropsById,
  frostWeeks: FrostWeeks,
  mode: FarmMode,
): CropId[] {
  return candidateCoverCrops(crops, mode).filter((cropId) => {
    const crop = crops[cropId];
    if (!crop.planting_window) return false;
    const rawPlantingWeek = frostWeeks[crop.planting_window.anchor] + crop.planting_window.start_week_offset;
    for (const yearOffset of [gap.yearOffset, gap.yearOffset + 1]) {
      const absolutePlantingWeek = yearOffset * 52 + (rawPlantingWeek - 1);
      if (absolutePlantingWeek >= gap.startAbsoluteWeek && absolutePlantingWeek <= gap.endAbsoluteWeek) {
        return true;
      }
    }
    return false;
  });
}

/** A one-line, plain-words reason a grower would plant this cover crop. */
export function coverCropReason(crop: Crop): string {
  if (crop.nutrient_role === "nitrogen_fixer") return "Adds nitrogen for next year's crop";
  if (crop.root_depth === "deep") {
    return crop.season_type === "cool_season" ? "Holds soil through winter rain" : "Holds soil through summer storms";
  }
  return "Covers bare soil until the next planting";
}

/**
 * Whether the template slot this gap belongs to is itself a fallow/bare
 * slot (e.g. `crops: ["fallow"]`) — if so, picking a cover crop fills that
 * existing slot in place rather than inserting a new one.
 */
export function gapOwnsAFallowSlot(timeline: RotationSlot[], templateIndex: number, crops: CropsById): boolean {
  return isBareSlot(timeline[templateIndex], crops);
}

/** Replaces an existing fallow slot's contents with the chosen cover crop. */
export function fillFallowSlot(
  timeline: RotationSlot[],
  templateIndex: number,
  cropId: CropId,
  alternateIds: CropId[],
): RotationSlot[] {
  const next = timeline.map((slot) => ({ ...slot }));
  next[templateIndex] = {
    ...next[templateIndex],
    crops: [cropId],
    alternate_crop_ids: alternateIds,
    is_mix: false,
    purpose: ADDED_COVER_CROP_PURPOSE,
  };
  return next;
}

/**
 * Inserts a brand-new slot for a gap that isn't an existing fallow slot
 * (e.g. the lead-in stretch before a cash crop's own planting window).
 * Inserted immediately before `templateIndex`'s slot: per
 * groupWeeksIntoSegments' ownership rule, a gap with no preceding bare slot
 * to claim it is attributed to the *next* real slot, meaning it
 * chronologically precedes that slot — so the new slot must too, for
 * correct season-to-season soil threading in simulate.ts. Reuses that
 * slot's own template `year` so the rotation's cycle length is unaffected.
 */
export function insertCoverCropSlot(
  timeline: RotationSlot[],
  templateIndex: number,
  cropId: CropId,
  alternateIds: CropId[],
  crops: CropsById,
): RotationSlot[] {
  const year = timeline[templateIndex].year;
  const season = crops[cropId].season_type === "cool_season" ? "cool_season" : "warm_season";
  const newSlot: RotationSlot = {
    year,
    season,
    crops: [cropId],
    alternate_crop_ids: alternateIds,
    is_mix: false,
    purpose: ADDED_COVER_CROP_PURPOSE,
  };
  const next = timeline.map((slot) => ({ ...slot }));
  next.splice(templateIndex, 0, newSlot);
  return next;
}

/**
 * Removes a cover crop the picker added: reverts a filled fallow slot back
 * to its original contents, or deletes the slot entirely if it was newly
 * inserted.
 *
 * Distinguishing the two isn't just "does year+season match an original
 * slot": an *inserted* slot's (year, season) can coincidentally collide
 * with a real, different original slot (e.g. a cool-season insert landing
 * on the same year+season as an existing cool-season mix slot it was
 * inserted next to) — reverting to that unrelated slot's content would
 * silently duplicate it. Only a match against a genuinely bare/fallow
 * original slot means "this position was filled, not inserted."
 */
export function removeCoverCropSlot(
  currentTimeline: RotationSlot[],
  originalTimeline: RotationSlot[],
  templateIndex: number,
  crops: CropsById,
): RotationSlot[] {
  const slot = currentTimeline[templateIndex];
  const originalMatch = originalTimeline.find((s) => s.year === slot.year && s.season === slot.season);
  if (originalMatch && isBareSlot(originalMatch, crops)) {
    return currentTimeline.map((s, i) => (i === templateIndex ? { ...originalMatch } : s));
  }
  return currentTimeline.filter((_, i) => i !== templateIndex);
}
