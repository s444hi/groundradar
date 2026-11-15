import type { RotationSlot } from "../../engine/types";

/**
 * Swaps what's planted in two template slots (crops, is_mix, alternate ids,
 * and purpose travel together; year/season stay put) — the manual
 * equivalent of optimize.ts's swap move, triggered by drag-to-reorder.
 */
export function swapTemplateSlots(timeline: RotationSlot[], indexA: number, indexB: number): RotationSlot[] {
  if (
    indexA === indexB ||
    indexA < 0 ||
    indexB < 0 ||
    indexA >= timeline.length ||
    indexB >= timeline.length
  ) {
    return timeline;
  }

  const next = timeline.map((slot) => ({ ...slot }));
  const a = timeline[indexA];
  const b = timeline[indexB];
  next[indexA] = { ...a, crops: b.crops, is_mix: b.is_mix, alternate_crop_ids: b.alternate_crop_ids, purpose: b.purpose };
  next[indexB] = { ...b, crops: a.crops, is_mix: a.is_mix, alternate_crop_ids: a.alternate_crop_ids, purpose: a.purpose };
  return next;
}

/**
 * Toggles a template slot between its current crop(s) and its alternates —
 * reversible, since swapping again swaps back.
 */
export function swapAlternateCrop(timeline: RotationSlot[], templateIndex: number): RotationSlot[] {
  if (templateIndex < 0 || templateIndex >= timeline.length) return timeline;
  const slot = timeline[templateIndex];
  if (slot.alternate_crop_ids.length === 0) return timeline;

  const next = timeline.map((s) => ({ ...s }));
  next[templateIndex] = {
    ...slot,
    crops: slot.alternate_crop_ids,
    alternate_crop_ids: slot.crops,
    is_mix: slot.alternate_crop_ids.length > 1,
  };
  return next;
}
