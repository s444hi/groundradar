import { isBareSlot } from "../../engine/optimize";
import type { CropsById, RotationSlot, Season } from "../../engine/types";

const SEASON_LABEL: Record<Season, string> = { warm_season: "summer", cool_season: "winter" };

function cropLabel(slot: RotationSlot, crops: CropsById): string {
  return slot.crops.map((id) => crops[id]?.display_name ?? id).join(" + ");
}

/**
 * Plain-words description of what changed between a strategy's timeline
 * before and after an edit (currently: the optimizer's suggestion) — same
 * length arrays, index-aligned, since neither findBetterRotation's swap nor
 * its cover-crop-insert move changes the template's slot count.
 */
export function describeChanges(before: RotationSlot[], after: RotationSlot[], crops: CropsById): string[] {
  const changedIndices: number[] = [];
  for (let i = 0; i < before.length; i++) {
    if (JSON.stringify(before[i].crops) !== JSON.stringify(after[i].crops)) changedIndices.push(i);
  }

  const messages: string[] = [];
  const handled = new Set<number>();

  for (const i of changedIndices) {
    if (handled.has(i)) continue;

    // A clean swap: this slot's new crops are exactly some other changed
    // slot's old crops, and vice versa — describe both as one move instead
    // of two separate "changed" lines.
    const partner = changedIndices.find(
      (j) =>
        j !== i &&
        !handled.has(j) &&
        JSON.stringify(after[i].crops) === JSON.stringify(before[j].crops) &&
        JSON.stringify(after[j].crops) === JSON.stringify(before[i].crops),
    );
    if (partner !== undefined) {
      messages.push(
        `Swapped ${cropLabel(before[i], crops)} (${before[i].year}) and ${cropLabel(before[partner], crops)} (${before[partner].year})`,
      );
      handled.add(i);
      handled.add(partner);
      continue;
    }

    if (isBareSlot(before[i], crops)) {
      messages.push(`Added ${cropLabel(after[i], crops)} in the ${SEASON_LABEL[before[i].season]} ${before[i].year} gap`);
    } else {
      messages.push(`Changed ${cropLabel(before[i], crops)} (${before[i].year}) to ${cropLabel(after[i], crops)}`);
    }
    handled.add(i);
  }

  return messages;
}
