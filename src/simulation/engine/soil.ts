import type { CropId, CropsById, Family, Level, PastRotationSlot, SoilProfile, SoilState } from "./types";

const LEVEL_SCORE: Record<Level, number> = { low: 25, medium: 50, high: 75 };

const ALL_FAMILIES: Family[] = [
  "solanaceae",
  "fabaceae",
  "poaceae",
  "cucurbitaceae",
  "polygonaceae",
  "asteraceae",
  "apiaceae",
  "amaryllidaceae",
  "brassicaceae",
  "none",
];

const PEST_PRESSURE_RAISE = 20;
// Cover crops aren't grown for yield and are typically chosen to be
// low-pest-risk rotation partners, so they build up pest pressure for their
// own family much more slowly than a repeated cash crop would.
const COVER_CROP_PEST_PRESSURE_RAISE = 3;
const PEST_PRESSURE_DECAY = 15;
const NITROGEN_FIXER_GAIN = 15;
const HEAVY_FEEDER_DRAIN = 12;
const LIGHT_FEEDER_DRAIN = 4;
const COVER_CROP_ORGANIC_GAIN = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function familiesGrownBy(cropIds: CropId[], crops: CropsById, wantCoverCrop: boolean): Set<Family> {
  const families = new Set<Family>();
  for (const id of cropIds) {
    const crop = crops[id];
    if (crop && crop.is_cover_crop === wantCoverCrop) families.add(crop.family);
  }
  return families;
}

// Shared by past-rotation priming and post-season updates: families grown
// as a cash crop raise pest pressure fully; families grown only as a cover
// crop raise it much less (see COVER_CROP_PEST_PRESSURE_RAISE); every other
// family decays.
function applyPestCarryover(pressure: Record<Family, number>, cropIds: CropId[], crops: CropsById): void {
  const cashFamilies = familiesGrownBy(cropIds, crops, false);
  const coverFamilies = familiesGrownBy(cropIds, crops, true);
  for (const family of ALL_FAMILIES) {
    if (cashFamilies.has(family)) {
      pressure[family] = clamp(pressure[family] + PEST_PRESSURE_RAISE, 0, 100);
    } else if (coverFamilies.has(family)) {
      pressure[family] = clamp(pressure[family] + COVER_CROP_PEST_PRESSURE_RAISE, 0, 100);
    } else {
      pressure[family] = clamp(pressure[family] - PEST_PRESSURE_DECAY, 0, 100);
    }
  }
}

/**
 * Starting soil state: nitrogen/organic matter from the field's levels,
 * pest pressure from pest_carryover_family/risk, then primed forward through
 * the recorded past rotation so recent real-world history is reflected.
 */
export function initSoilState(
  soil: SoilProfile,
  pastRotation: PastRotationSlot[],
  crops: CropsById,
): SoilState {
  const pestPressureByFamily = Object.fromEntries(ALL_FAMILIES.map((family) => [family, 0])) as Record<
    Family,
    number
  >;
  pestPressureByFamily[soil.pest_carryover_family] = LEVEL_SCORE[soil.pest_carryover_risk];

  for (const slot of pastRotation) {
    applyPestCarryover(pestPressureByFamily, slot.crops, crops);
  }

  return {
    nitrogen: LEVEL_SCORE[soil.nitrogen_level],
    organicMatter: LEVEL_SCORE[soil.organic_matter_level],
    pestPressureByFamily,
  };
}

/**
 * Applies one season's effect on soil state (engine rule 6): nitrogen
 * fixers add nitrogen, heavy/light feeders drain it, cover crops add organic
 * matter, and pest pressure shifts per familiesGrown vs. everyone else. A
 * mix's crops are combined by iterating all of them (rule 7).
 */
export function updateSoilAfterSeason(soil: SoilState, cropIds: CropId[], crops: CropsById): SoilState {
  let nitrogen = soil.nitrogen;
  let organicMatter = soil.organicMatter;

  for (const id of cropIds) {
    const crop = crops[id];
    if (!crop) continue;
    if (crop.nutrient_role === "nitrogen_fixer") nitrogen += NITROGEN_FIXER_GAIN;
    if (crop.nutrient_role === "heavy_feeder") nitrogen -= HEAVY_FEEDER_DRAIN;
    if (crop.nutrient_role === "light_feeder") nitrogen -= LIGHT_FEEDER_DRAIN;
    if (crop.is_cover_crop) organicMatter += COVER_CROP_ORGANIC_GAIN;
  }

  const pestPressureByFamily = { ...soil.pestPressureByFamily };
  applyPestCarryover(pestPressureByFamily, cropIds, crops);

  return {
    nitrogen: clamp(nitrogen, 0, 100),
    organicMatter: clamp(organicMatter, 0, 100),
    pestPressureByFamily,
  };
}
