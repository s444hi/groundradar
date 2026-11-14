import type {
  CropOccupancy,
  CropsById,
  ExpandedRotationSlot,
  FrostWeeks,
  RotationSlot,
  RotationStrategy,
  TimelineWeek,
  WeeklyTimeline,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// A mix's crops are co-planted: all crop ids in a slot share one occupancy
// window, derived from the first crop's planting_window + days_to_maturity.
// Fallow/unknown-crop slots fall out of this naturally (planting_window or
// days_to_maturity missing) by returning no occupancy at all.
function computeSlotOccupancy(
  slot: RotationSlot,
  crops: CropsById,
  frostWeeks: FrostWeeks,
  yearOffset: number,
  years: number,
): CropOccupancy[] {
  const primaryCropId = slot.crops[0];
  const crop = primaryCropId ? crops[primaryCropId] : undefined;
  if (!crop || !crop.planting_window || crop.days_to_maturity == null) {
    return [];
  }

  const totalWeeks = years * 52;
  const rawPlantingWeek = frostWeeks[crop.planting_window.anchor] + crop.planting_window.start_week_offset;
  const startAbsoluteWeek = clamp(yearOffset * 52 + (rawPlantingWeek - 1), 0, totalWeeks - 1);
  const durationWeeks = Math.ceil(crop.days_to_maturity / 7);
  const endAbsoluteWeek = clamp(startAbsoluteWeek + durationWeeks, 0, totalWeeks - 1);

  return slot.crops.map((cropId) => ({
    cropId,
    startAbsoluteWeek,
    endAbsoluteWeek,
  }));
}

/**
 * Tiles a strategy's one-year timeline forward `years` times and builds a
 * flat weekly grid, overlaying each slot's crop occupancy onto it. Weeks
 * with no occupancy stay bare (gaps and fallow).
 */
export function buildTimeline(
  strategy: RotationStrategy,
  crops: CropsById,
  frostWeeks: FrostWeeks,
  years: number = 3,
): WeeklyTimeline {
  const totalWeeks = years * 52;
  const weeks: TimelineWeek[] = Array.from({ length: totalWeeks }, (_, absoluteWeek) => ({
    absoluteWeek,
    yearOffset: Math.floor(absoluteWeek / 52),
    week: (absoluteWeek % 52) + 1,
    cropIds: [],
    isBare: true,
  }));

  const slots: ExpandedRotationSlot[] = [];

  for (let yearOffset = 0; yearOffset < years; yearOffset++) {
    for (let i = 0; i < strategy.timeline.length; i++) {
      const baseSlot = strategy.timeline[i];
      const occupiedWeeks = computeSlotOccupancy(baseSlot, crops, frostWeeks, yearOffset, years);

      const expandedSlot: ExpandedRotationSlot = {
        ...baseSlot,
        year: baseSlot.year + yearOffset,
        slotIndex: yearOffset * strategy.timeline.length + i,
        yearOffset,
        occupiedWeeks,
      };
      slots.push(expandedSlot);

      for (const occupancy of occupiedWeeks) {
        for (let w = occupancy.startAbsoluteWeek; w <= occupancy.endAbsoluteWeek; w++) {
          weeks[w].cropIds.push(occupancy.cropId);
          weeks[w].isBare = false;
        }
      }
    }
  }

  return {
    strategyId: strategy.strategy_id,
    years,
    slots,
    weeks,
  };
}
