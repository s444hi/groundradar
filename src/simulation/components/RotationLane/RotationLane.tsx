import BreakdownPanel from "../BreakdownPanel/BreakdownPanel";
import { CONFIDENCE_COLORS } from "../confidenceColor";
import ScoreBadge from "../ScoreBadge/ScoreBadge";
import Timeline from "../Timeline/Timeline";
import type { PlaybackApi } from "../Timeline/usePlayback";
import { useCountUp } from "./useCountUp";
import type { CropsById, WeeklyTimeline } from "../../engine/types";
import type { ScoredRotationStrategy } from "../types";

export interface RotationLaneProps {
  strategy: ScoredRotationStrategy;
  weeklyTimeline: WeeklyTimeline;
  crops: CropsById;
  playback: PlaybackApi;
}

const SCORE_COUNT_UP_MS = 600;

// Off by default: a reminder, for internal reference only, of what this
// static-preview lane deliberately doesn't implement yet (drag-and-drop,
// the swap-for-alternates button, the cover-crop picker, the play button).
const SHOW_SCOPE_NOTE = false;

const laneStyle: React.CSSProperties = {
  background: "var(--color-cream)",
  border: "2px solid var(--color-olive)",
  borderRadius: "var(--radius-card)",
  padding: "28px",
  marginTop: "24px",
  transition: "transform 180ms ease, box-shadow 180ms ease",
};

const laneTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontWeight: 400,
  letterSpacing: "-0.02em",
  fontSize: "32px",
  margin: "0 0 8px 0",
};

const baselineTagStyle: React.CSSProperties = {
  display: "inline-block",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "13px",
  background: "var(--color-pale-green)",
  color: "var(--color-olive)",
  borderRadius: "var(--radius-pill)",
  padding: "4px 12px",
  marginBottom: "16px",
};

const scopeNoteStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "11px",
  color: "var(--color-text-muted)",
  margin: "0 0 24px 0",
};

const scoreRowStyle: React.CSSProperties = {
  display: "flex",
  // Top-aligned, not centered: centering would vertically offset the much
  // shorter mini-score column relative to the tall "78%" badge, pushing
  // "Overall success" down away from its own numeral instead of sitting
  // right under it.
  alignItems: "flex-start",
  gap: "32px",
  flexWrap: "wrap",
  marginBottom: "32px",
};

const smallScoreRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "24px",
  flexWrap: "wrap",
  flex: 1,
};

const confidenceBadgeStyle = (color: string): React.CSSProperties => ({
  display: "inline-block",
  alignSelf: "flex-start",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "14px",
  color,
  background: `color-mix(in srgb, ${color} 18%, var(--color-bg))`,
  borderRadius: "var(--radius-pill)",
  padding: "6px 16px",
  marginLeft: "auto",
});

export default function RotationLane({ strategy, weeklyTimeline, crops, playback }: RotationLaneProps) {
  const scores = strategy.simulation_scores;
  const baseYear = strategy.timeline[0]?.year ?? 0;

  const [overall, water, erosion, pests, seasonFit, income] = useCountUp(
    [
      scores.overall_success_score ?? 0,
      scores.water_efficiency_score ?? 0,
      scores.erosion_protection_score ?? 0,
      scores.pest_break_score ?? 0,
      scores.season_fit_score ?? 0,
      scores.income_score ?? 0,
    ],
    SCORE_COUNT_UP_MS,
    playback.isFinished,
  );

  return (
    <div
      style={laneStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 10px 24px color-mix(in srgb, var(--color-text) 10%, transparent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {strategy.is_baseline && <span style={baselineTagStyle}>Baseline</span>}
      <h2 style={laneTitleStyle}>{strategy.title}</h2>
      {SHOW_SCOPE_NOTE && (
        <p style={scopeNoteStyle}>
          Static preview — drag-and-drop cards, the swap-for-alternates button, the cover-crop picker, and the
          play button are not implemented in this view.
        </p>
      )}

      <div style={scoreRowStyle}>
        <ScoreBadge label="Overall success" value={overall} size="large" />
        <div style={smallScoreRowStyle}>
          <ScoreBadge label="Water" value={water} size="small" colorByScore />
          <ScoreBadge label="Erosion" value={erosion} size="small" colorByScore />
          <ScoreBadge label="Pests" value={pests} size="small" colorByScore />
          <ScoreBadge label="Season fit" value={seasonFit} size="small" colorByScore />
          <ScoreBadge label="Income" value={income} size="small" colorByScore />
          <span style={confidenceBadgeStyle(CONFIDENCE_COLORS[scores.confidence!.level])}>
            {scores.confidence!.level}
          </span>
        </div>
      </div>

      <Timeline weeklyTimeline={weeklyTimeline} crops={crops} baseYear={baseYear} playback={playback} />

      <BreakdownPanel
        qualitativeAnalysis={strategy.qualitative_analysis}
        seasons={scores.seasons ?? []}
        confidence={scores.confidence!}
        checkLocally={scores.check_locally ?? []}
      />
    </div>
  );
}
