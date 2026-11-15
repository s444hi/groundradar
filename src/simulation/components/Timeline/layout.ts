import type { CropSprite } from "../sprites";

// Shared geometry so Timeline's background ground line/dirt specks and each
// segment's own sprite/label line up exactly, even though they're rendered
// by separate components stacked on top of one another.
export const PIXEL_SIZE = 4;
export const ABOVE_GROUND_HEIGHT = 36; // room for the tallest above-ground sprite stage (grains, 7 rows)
export const GROUND_LINE_HEIGHT = 2;
export const BELOW_GROUND_HEIGHT = 20; // room for root sprites + dirt specks
export const LABEL_HEIGHT = 18; // one line of small mono text
export const TRACK_HEIGHT = ABOVE_GROUND_HEIGHT + GROUND_LINE_HEIGHT + BELOW_GROUND_HEIGHT + LABEL_HEIGHT;

// Distance from the container's bottom edge up to the bottom/top of the
// ground line itself.
export const GROUND_LINE_BOTTOM = LABEL_HEIGHT + BELOW_GROUND_HEIGHT;
export const GROUND_LINE_TOP = GROUND_LINE_BOTTOM + GROUND_LINE_HEIGHT;

// A sprite's own bottom edge: for an above-ground-only sprite (groundRow ===
// rows.length) this sits exactly on the ground; for a "roots" sprite, the
// rows below groundRow hang down into the below-ground band.
export function spriteBottomOffset(sprite: CropSprite): number {
  const belowGroundRows = sprite.rows.length - sprite.groundRow;
  return GROUND_LINE_TOP - belowGroundRows * PIXEL_SIZE;
}

// Width thresholds (as a % of the full timeline) below which a crop segment
// shows just its full-grown sprite/no label, calibrated against this page's
// ~1140px usable track width.
export const WIDE_THRESHOLD_PERCENT = 6;
export const LABEL_THRESHOLD_PERCENT = 4;
export const BARE_LABEL_THRESHOLD_PERCENT = 4;

/** Cheap deterministic pseudo-random number in [0, 1), seeded by an integer. */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 999331 + 1) * 10000;
  return x - Math.floor(x);
}
