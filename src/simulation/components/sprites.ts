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
  // Bushy plant with 2-3 hanging fruits (pepper/tomato).
  fruiting: {
    sprout: aboveGround(["..#..", ".###.", "..#.."]),
    young: aboveGround(["..#..", ".###.", "#####", "#.#.#", ".###.", "..#..", "..#.."]),
    // 3 fruits hang unevenly off the outer edges/lower branches — different
    // columns AND no two sharing a row, so nothing can read as a mirrored
    // "eyes" pair or a centered "mouth".
    full: aboveGround([
      ".........",
      "...###...",
      "..#####..",
      ".#######.",
      "#########",
      "#########",
      ".#######.",
      ".o#####..",
      ".o#####..",
      "..#####o.",
      "..#####o.",
      "...###...",
      "...o#....",
      "...o#....",
      "....#....",
      "....#....",
    ]),
  },
  // Tall stalk with a tassel/seed head (corn/wheat).
  grains: {
    sprout: aboveGround([".#.", ".#.", ".#."]),
    young: aboveGround([".#.#.", "..#..", ".###.", "..#..", "..#..", "..#..", "..#..", "..#.."]),
    full: aboveGround([
      "..#..",
      ".#.#.",
      "..#..",
      ".###.",
      "..#..",
      ".#.#.",
      "..#..",
      "..#..",
      ".###.",
      "..#..",
      "..#..",
      "..#..",
      "..#..",
      "..#..",
      "..#..",
      "..#..",
    ]),
  },
  // Bushy plant with hanging pods (bush bean/soybean/peas).
  legumes: {
    sprout: aboveGround([".#.#.", "..#..", "..#.."]),
    young: aboveGround([".#.#.", "#####", "#.#.#", ".###.", "..#..", "..#..", "..#.."]),
    full: aboveGround([
      ".........",
      "..#...#..",
      ".#.###.#.",
      "#########",
      "#.#####.#",
      "#o#####o#",
      ".#.###.#.",
      "..#o#o#..",
      "..#####..",
      "...###...",
      "....#....",
      "....#....",
    ]),
  },
  // Round, low leafy rosette (lettuce) — deliberately squat, not tall.
  leafy_greens: {
    sprout: aboveGround(["#.#", ".#."]),
    young: aboveGround([".#.#.", "#####", "#####", ".###.", "..#.."]),
    full: aboveGround([
      ".........",
      "...#.#...",
      ".#######.",
      "#########",
      "#########",
      "#########",
      ".#######.",
      "..#####..",
      "...###...",
      "....#....",
    ]),
  },
  // Leaves above the ground line, tapering root below it (carrot/onion).
  roots: {
    sprout: aboveGround([".#.", "#.#"]),
    young: aboveGround([".#.#.", ".#.#.", "#.#.#", ".###.", "..#.."]),
    full: {
      rows: [
        ".#.#.#.#.",
        "..#.#.#..",
        ".#.#.#.#.",
        "..#.#.#..",
        ".#.#.#.#.",
        "..#####..",
        "...###...",
        "....#....",
        "....#....",
        "...###...",
        "...###...",
        "....#....",
        "....#....",
        "....#....",
        ".....#...",
        ".....#...",
      ],
      groundRow: 9,
    },
  },
  // Low, sprawling vine trailing sideways with a round squash.
  squash_vine: {
    sprout: aboveGround([".#.#.", ".###.", "..#.."]),
    young: aboveGround(["..#......", ".###.....", "..#.##...", "....###..", ".....#..."]),
    full: aboveGround([
      "..#...........",
      ".###..#.......",
      "..#..###......",
      ".....#####....",
      "....##ooo##...",
      "....#ooooo#...",
      ".....#####....",
    ]),
  },
  // Every cover crop (grown for soil benefit, not yield) gets the same
  // simple grass-tuft sprite regardless of botanical family — the point is
  // to read as "cover crop" at a glance, not to distinguish clover from rye.
  cover_crop: {
    sprout: aboveGround([".#."]),
    young: aboveGround(["#.#.#", ".#.#.", "..#.."]),
    full: aboveGround(["#.#.#.#", ".#.#.#.", "#.#.#.#", ".#.#.#.", "..###..", "...#..."]),
  },
  generic: {
    sprout: aboveGround([".#.", ".#."]),
    young: aboveGround(["..#..", ".###.", "#####", ".###.", "..#.."]),
    full: aboveGround([
      "..#.#..",
      ".#####.",
      ".#####.",
      "..###..",
      "..###..",
      "...#...",
      "...#...",
      "...#...",
    ]),
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
