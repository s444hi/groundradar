import type { CropId, ExpandedRotationSlot, WeeklyTimeline } from "../../engine/types";

export interface OwnershipRange {
  start: number; // inclusive absolute week
  end: number; // inclusive absolute week
  slotIndexes: number[];
}

export interface TimelineSegment {
  cropIds: CropId[];
  isBare: boolean;
  startAbsoluteWeek: number; // inclusive
  endAbsoluteWeek: number; // inclusive
  weekCount: number;
  yearOffset: number; // of the first week in the segment
  slotIndexes: number[];
}

/**
 * Maps every absolute week to the ExpandedRotationSlot(s) it belongs to.
 * A bare slot (occupiedWeeks: []) carries no week range of its own, so its
 * ownership has to be inferred from slot sequence: a run of bare slots
 * since the last occupied slot "owns" the bare gap right before the next
 * occupied slot starts. A leading gap before any crop has ever been
 * planted (no bare slot preceded it yet) is attributed to the upcoming
 * slot itself — it's that slot's own pre-planting lead time.
 */
export function assignSlotOwnership(slots: ExpandedRotationSlot[], totalWeeks: number): OwnershipRange[] {
  const ranges: OwnershipRange[] = [];
  let cursor = 0;
  let pending: number[] = [];

  for (const slot of slots) {
    if (slot.occupiedWeeks.length > 0) {
      const occStart = Math.min(...slot.occupiedWeeks.map((o) => o.startAbsoluteWeek));
      const occEnd = Math.max(...slot.occupiedWeeks.map((o) => o.endAbsoluteWeek));

      if (cursor < occStart) {
        const owners = pending.length > 0 ? pending : [slot.slotIndex];
        ranges.push({ start: cursor, end: occStart - 1, slotIndexes: owners });
      }

      ranges.push({ start: occStart, end: occEnd, slotIndexes: [slot.slotIndex] });
      cursor = occEnd + 1;
      pending = [];
    } else {
      pending.push(slot.slotIndex);
    }
  }

  if (cursor <= totalWeeks - 1) {
    const owners = pending.length > 0 ? pending : [slots[slots.length - 1].slotIndex];
    ranges.push({ start: cursor, end: totalWeeks - 1, slotIndexes: owners });
  }

  return ranges;
}

function ownersFor(ranges: OwnershipRange[], startWeek: number, endWeek: number): number[] {
  const owners = new Set<number>();
  for (const range of ranges) {
    if (range.start <= endWeek && range.end >= startWeek) {
      for (const slotIndex of range.slotIndexes) owners.add(slotIndex);
    }
  }
  return [...owners].sort((a, b) => a - b);
}

/**
 * Run-length-encodes the weekly grid into contiguous crop/bare blocks,
 * each tagged with the slot(s) it belongs to (see assignSlotOwnership).
 */
export function groupWeeksIntoSegments(weeklyTimeline: WeeklyTimeline): TimelineSegment[] {
  const { weeks, slots, years } = weeklyTimeline;
  const ownershipRanges = assignSlotOwnership(slots, years * 52);

  const segments: TimelineSegment[] = [];
  let currentKey: string | null = null;

  for (const week of weeks) {
    const key = week.isBare ? "" : [...week.cropIds].sort().join("|");

    if (currentKey !== null && key === currentKey) {
      const last = segments[segments.length - 1];
      last.endAbsoluteWeek = week.absoluteWeek;
      last.weekCount += 1;
    } else {
      segments.push({
        cropIds: week.cropIds,
        isBare: week.isBare,
        startAbsoluteWeek: week.absoluteWeek,
        endAbsoluteWeek: week.absoluteWeek,
        weekCount: 1,
        yearOffset: week.yearOffset,
        slotIndexes: [],
      });
      currentKey = key;
    }
  }

  for (const segment of segments) {
    segment.slotIndexes = ownersFor(ownershipRanges, segment.startAbsoluteWeek, segment.endAbsoluteWeek);
  }

  return segments;
}
