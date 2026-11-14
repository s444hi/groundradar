import type { Season, SeasonResult } from "../../engine/types";

export interface GroupedReason {
  text: string;
  delta: number; // from the first occurrence in the bucket
  count: number;
  annotation: string | null; // "(every winter ×3)" | "(every summer ×3)" | "(×N)" | null
}

export const SEASON_LABELS: Record<Season, string> = {
  warm_season: "summer",
  cool_season: "winter",
};

interface TaggedReason {
  text: string;
  delta: number;
  season: Season;
}

/**
 * Buckets per-season reasons by exact text match across all seasons in a
 * strategy, so a reason that's identical every year (e.g. erosion, which
 * doesn't depend on soil state) collapses into one line with a count
 * annotation. A reason whose text genuinely changes year to year (nitrogen,
 * pests — both embed the current soil state) lands in its own bucket of
 * count 1, which is correct: that trend should stay visible, not be hidden.
 */
export function groupReasons(seasons: SeasonResult[]): GroupedReason[] {
  const tagged: TaggedReason[] = seasons.flatMap((season) =>
    season.reasons.map((reason) => ({ text: reason.text, delta: reason.delta, season: season.season })),
  );

  const buckets = new Map<string, TaggedReason[]>();
  for (const item of tagged) {
    const bucket = buckets.get(item.text);
    if (bucket) bucket.push(item);
    else buckets.set(item.text, [item]);
  }

  const grouped: GroupedReason[] = [];
  for (const items of buckets.values()) {
    const count = items.length;
    let annotation: string | null = null;
    if (count > 1) {
      const distinctSeasons = new Set(items.map((item) => item.season));
      annotation =
        distinctSeasons.size === 1 ? `(every ${SEASON_LABELS[items[0].season]} ×${count})` : `(×${count})`;
    }
    grouped.push({ text: items[0].text, delta: items[0].delta, count, annotation });
  }

  grouped.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return grouped;
}
