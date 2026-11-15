import type { CropId } from "../engine/types";

/**
 * A single growth-stage pixel sprite. `rows` is a grid of characters
 * ('#' = --color-pixel, 'o' = --color-pixel-light, anything else = empty).
 * `groundRow` is how many leading rows sit ABOVE the ground line; any rows
 * after that (used only by "roots") render below it as the root itself.
 */
export interface CropSprite {
  rows: string[];
  groundRow: number;
}

export interface CropSpriteSet {
  sprout: CropSprite;
  young: CropSprite;
  full: CropSprite;
}

export type CropSpriteCategory =
  | "leafy_greens"
  | "fruiting"
  | "grains"
  | "legumes"
  | "roots"
  | "squash_vine"
  | "cover_crop"
  | "generic";

function aboveGround(rows: string[]): CropSprite {
  return { rows, groundRow: rows.length };
}

export const CROP_SPRITES: Record<CropSpriteCategory, CropSpriteSet> = {
  leafy_greens: {
    sprout: aboveGround(["..#..", ".###."]),
    young: aboveGround(["..#..", "#####", ".###."]),
    full: aboveGround([".#.#.", "#####", "#####", ".###."]),
  },
  fruiting: {
    sprout: aboveGround(["..#..", ".###."]),
    young: aboveGround(["..#..", ".###.", "..#..", ".###."]),
    full: aboveGround([".o#o.", "#####", ".###.", "..#..", ".###."]),
  },
  grains: {
    sprout: aboveGround(["..#..", "..#.."]),
    young: aboveGround([".#.#.", "..#..", "..#..", "..#.."]),
    full: aboveGround([".#.#.", "#####", "..#..", "..#..", "..#..", "..#.."]),
  },
  legumes: {
    sprout: aboveGround([".#.#.", "..#.."]),
    young: aboveGround([".#.#.", "#####", "..#.."]),
    full: aboveGround([".#.#.", "#####", "#o#o#", "#####"]),
  },
  roots: {
    sprout: aboveGround(["..#.."]),
    young: aboveGround([".#.#.", "..#.."]),
    full: { rows: [".#.#.", "#####", "..#..", ".###.", "..#.."], groundRow: 2 },
  },
  squash_vine: {
    sprout: aboveGround([".#.#.", "..#.."]),
    young: aboveGround([".#.#.", "#####", "..#.."]),
    full: aboveGround(["#.....#", "#######", ".ooooo.", "..ooo.."]),
  },
  // Every cover crop (grown for soil benefit, not yield) gets the same
  // simple grass-tuft sprite regardless of botanical family — the point is
  // to read as "cover crop" at a glance, not to distinguish clover from rye.
  cover_crop: {
    sprout: aboveGround([".#."]),
    young: aboveGround(["#.#", ".#."]),
    full: aboveGround(["#.#.#", ".#.#.", "..#.."]),
  },
  generic: {
    sprout: aboveGround(["..#.."]),
    young: aboveGround(["..#..", ".###."]),
    full: aboveGround(["..#..", "#####", ".###."]),
  },
};

export const CROP_CATEGORY_BY_ID: Record<CropId, CropSpriteCategory> = {
  tomato: "fruiting",
  bell_pepper: "fruiting",
  bush_bean: "legumes",
  corn: "grains",
  soybean: "legumes",
  summer_squash: "squash_vine",
  buckwheat: "cover_crop",
  sorghum_sudangrass: "cover_crop",
  winter_wheat: "grains",
  lettuce: "leafy_greens",
  carrot: "roots",
  onion: "roots",
  peas: "legumes",
  crimson_clover: "cover_crop",
  winter_rye: "cover_crop",
  hairy_vetch: "cover_crop",
  oats: "cover_crop",
  tillage_radish: "cover_crop",
  fallow: "generic", // never actually rendered — fallow is always a bare segment
};

export function getCropSpriteCategory(cropId: CropId): CropSpriteCategory {
  return CROP_CATEGORY_BY_ID[cropId] ?? "generic";
}

export function getCropSpriteSet(cropId: CropId): CropSpriteSet {
  return CROP_SPRITES[getCropSpriteCategory(cropId)];
}
