import type { Family } from "./types";

// Common names for each plant family, for display purposes only (not a crop
// trait — crops.json remains the sole source of per-crop facts).
export const FAMILY_LABELS: Record<Family, string> = {
  solanaceae: "Nightshade family (Solanaceae)",
  fabaceae: "Legume family (Fabaceae)",
  poaceae: "Grass family (Poaceae)",
  cucurbitaceae: "Gourd family (Cucurbitaceae)",
  polygonaceae: "Knotweed family (Polygonaceae)",
  asteraceae: "Daisy family (Asteraceae)",
  apiaceae: "Carrot family (Apiaceae)",
  amaryllidaceae: "Onion family (Amaryllidaceae)",
  brassicaceae: "Brassica family (Brassicaceae)",
  none: "No specific family",
};
