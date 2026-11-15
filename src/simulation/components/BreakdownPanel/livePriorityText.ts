import type { Priorities } from "../../engine/types";

/**
 * A "(N/10)" score, optionally preceded by the priority it belongs to:
 * "to match your Soil Health priority (8/10)". The name is capped at two
 * words so it can't swallow the rest of the sentence (every priority we
 * know is one or two words).
 */
const PRIORITY_SCORE = /(?:\b((?:[A-Za-z]+[ _-])?[A-Za-z]+)\s+priority)?(\s*)\((\d+)\s*\/\s*10\)/g;

const PRIORITY_KEYS: Record<string, keyof Priorities> = {
  water: "water",
  income: "income",
  "soil health": "soil_health",
  soil: "soil_health",
  pests: "pests",
  pest: "pests",
};

function priorityKey(label: string): keyof Priorities | undefined {
  const normalized = label.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  // The captured label can pick up a leading filler word ("your Water"), so
  // fall back to its last word before giving up.
  const lastWord = normalized.slice(normalized.lastIndexOf(" ") + 1);
  return PRIORITY_KEYS[normalized] ?? PRIORITY_KEYS[lastWord];
}

/**
 * Rewrites the "(N/10)" in a strategy's why_suggested to the priority's
 * current slider value, so the sentence keeps up when the sliders move
 * instead of quoting whatever was true when the text was generated.
 *
 * A score whose priority we can't place is dropped rather than left stale —
 * the surrounding words still read correctly without it.
 */
export function withLivePriorities(text: string, priorities: Priorities): string {
  return text.replace(PRIORITY_SCORE, (_match, label: string | undefined, gap: string) => {
    const key = label === undefined ? undefined : priorityKey(label);
    if (key === undefined) {
      // Keep any priority name the sentence needs; drop the number, and the
      // space in front of it when nothing precedes it.
      return label === undefined ? "" : `${label} priority`;
    }
    return `${label} priority${gap}(${priorities[key]}/10)`;
  });
}
