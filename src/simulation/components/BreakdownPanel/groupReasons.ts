import type { ScoreCategory, Season, SeasonResult } from "../../engine/types";

export interface GroupedReason {
  text: string;
  delta: number;
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
  category?: ScoreCategory;
  trendValue?: number;
  subjectLabel?: string;
}

type TrendDirection = "up" | "down" | "flat";

const TREND_TEMPLATES: Record<string, Record<TrendDirection, (subject: string, values: number[]) => string>> = {
  nitrogen: {
    down: (s, v) => `${s} drained soil nitrogen each year (${v.join(" → ")}).`,
    up: (s, v) => `${s} replenished soil nitrogen each year (${v.join(" → ")}).`,
    flat: (s, v) => `${s}'s effect on soil nitrogen fluctuated across the rotation (${v.join(" → ")}).`,
  },
  pests: {
    up: (s, v) => `${s} pest pressure built up each year (${v.join(" → ")}).`,
    down: (s, v) => `${s} pest pressure eased each year (${v.join(" → ")}).`,
    flat: (s, v) => `${s} pest pressure fluctuated across the rotation (${v.join(" → ")}).`,
  },
};

function defaultTrendTemplate(subject: string, values: number[]): string {
  return `${subject} changed each year (${values.join(" → ")}).`;
}

// Same category, different subject -> different bucket (fixes a real case:
// a strategy mixing a nitrogen-fixing cover crop's constant bonus reason
// with a heavy feeder's changing-number trend reason, both category
// "nitrogen" — bucketing by category alone would lump them together and
// break the trend collapse for both). Reasons with no category (or legacy
// callers) fall back to exact-text bucketing, same as before this change.
function bucketKey(item: TaggedReason): string {
  if (!item.category) return `text:${item.text}`;
  return `${item.category}:${item.subjectLabel ?? item.text}`;
}

/**
 * Buckets per-season reasons by category+subject across all seasons in a
 * strategy. An identical-every-time reason (e.g. erosion, water, income —
 * none depend on soil state) collapses into one line with a count
 * annotation. A reason whose text changes year to year because it tracks a
 * real number (nitrogen, pests) collapses into one trend line instead of
 * repeating near-duplicate lines.
 */
export function groupReasons(seasons: SeasonResult[]): GroupedReason[] {
  const tagged: TaggedReason[] = seasons.flatMap((season) =>
    season.reasons.map((reason) => ({
      text: reason.text,
      delta: reason.delta,
      season: season.season,
      category: reason.category,
      trendValue: reason.trendValue,
      subjectLabel: reason.subjectLabel,
    })),
  );

  const buckets = new Map<string, TaggedReason[]>();
  for (const item of tagged) {
    const key = bucketKey(item);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const grouped: GroupedReason[] = [];
  for (const items of buckets.values()) {
    const distinctTexts = new Set(items.map((item) => item.text));

    if (distinctTexts.size === 1) {
      const count = items.length;
      const distinctSeasons = new Set(items.map((item) => item.season));
      const annotation =
        count === 1
          ? null
          : distinctSeasons.size === 1
            ? `(every ${SEASON_LABELS[items[0].season]} ×${count})`
            : `(×${count})`;
      grouped.push({ text: items[0].text, delta: items[0].delta, count, annotation });
      continue;
    }

    const canTrend = items.every((item) => item.trendValue != null && item.category != null);
    if (canTrend) {
      const category = items[0].category!;
      const values = items.map((item) => Math.round(item.trendValue!));
      const first = values[0];
      const last = values[values.length - 1];
      const direction: TrendDirection = last > first ? "up" : last < first ? "down" : "flat";
      const subject = [...new Set(items.map((item) => item.subjectLabel).filter((s): s is string => Boolean(s)))].join(
        " / ",
      ) || "This category";
      const template = TREND_TEMPLATES[category]?.[direction] ?? defaultTrendTemplate;
      grouped.push({
        text: template(subject, values),
        delta: items[items.length - 1].delta,
        count: items.length,
        annotation: null,
      });
    } else {
      for (const item of items) grouped.push({ text: item.text, delta: item.delta, count: 1, annotation: null });
    }
  }

  grouped.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return grouped;
}
