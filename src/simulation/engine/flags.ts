import { FAMILY_LABELS } from "./familyLabels";
import type { CropId, CropsById, Family, Priorities, RotationStrategy, SeasonResult } from "./types";

export interface FlagsInput {
  strategy: RotationStrategy;
  crops: CropsById;
  priorities: Priorities;
  seasons: SeasonResult[];
}

// Only cash crops count toward "a family repeats" (consistent with
// scoring.ts's pest-scoring exemption for cover crops/fallow).
function cashFamiliesOf(cropIds: CropId[], crops: CropsById): Set<Family> {
  const families = new Set<Family>();
  for (const id of cropIds) {
    const crop = crops[id];
    if (crop && crop.planting_window && !crop.is_cover_crop) families.add(crop.family);
  }
  return families;
}

// A cover/fallow season is transparent: it doesn't break the chain of "the
// same cash family came back after an off season," which is the real
// pest/disease concern this flag is meant to catch.
function detectRepeatedCashFamilies(seasons: SeasonResult[], crops: CropsById): Set<Family> {
  const repeated = new Set<Family>();
  let lastCashFamilies: Set<Family> | null = null;

  for (const season of seasons) {
    const families = cashFamiliesOf(season.crops, crops);
    if (families.size === 0) continue;
    if (lastCashFamilies) {
      for (const family of families) {
        if (lastCashFamilies.has(family)) repeated.add(family);
      }
    }
    lastCashFamilies = families;
  }
  return repeated;
}

/**
 * check_locally (engine rule 10): starts from the strategy's own
 * local_risks_for_review, then adds flags for market prices (income
 * priority >= 7), specific pests (a cash-crop family repeats), and
 * irrigation access (a season's water need exceeded seasonal supply).
 */
export function computeCheckLocally(input: FlagsInput): string[] {
  const flags = [...input.strategy.qualitative_analysis.local_risks_for_review];

  if (input.priorities.income >= 7) {
    flags.push(
      "Verify current local market prices for your cash crop(s) before committing — income priority is high and prices vary by region and season.",
    );
  }

  const repeatedFamilies = detectRepeatedCashFamilies(input.seasons, input.crops);
  if (repeatedFamilies.size > 0) {
    const labels = [...repeatedFamilies].map((family) => FAMILY_LABELS[family]).join(", ");
    flags.push(
      `Check locally for ${labels} pest/disease pressure — this rotation brings that cash-crop family back season after season.`,
    );
  }

  const hasIrrigationRisk = input.seasons.some((s) => s.subscores.water_efficiency_score < 100);
  if (hasIrrigationRisk) {
    flags.push(
      "Some seasons' crop water needs exceed typical seasonal rainfall and soil moisture — confirm irrigation access before planting.",
    );
  }

  return flags;
}
