import BreakdownPanel from "../BreakdownPanel/BreakdownPanel";
import ScoreBadge from "../ScoreBadge/ScoreBadge";
import Timeline from "../Timeline/Timeline";
import type { CropsById, WeeklyTimeline } from "../../engine/types";
import type { ScoredRotationStrategy } from "../types";

export interface RotationLaneProps {
  strategy: ScoredRotationStrategy;
  weeklyTimeline: WeeklyTimeline;
  crops: CropsById;
}

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
  alignItems: "center",
  gap: "32px",
  flexWrap: "wrap",
  marginBottom: "32px",
};

const smallScoreRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "24px",
  flexWrap: "wrap",
};

export default function RotationLane({ strategy, weeklyTimeline, crops }: RotationLaneProps) {
  const scores = strategy.simulation_scores;
  const baseYear = strategy.timeline[0]?.year ?? 0;

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
        <ScoreBadge label="Overall success" value={scores.overall_success_score ?? 0} size="large" />
        <div style={smallScoreRowStyle}>
          <ScoreBadge label="Water" value={scores.water_efficiency_score ?? 0} size="small" colorByScore />
          <ScoreBadge label="Erosion" value={scores.erosion_protection_score ?? 0} size="small" colorByScore />
          <ScoreBadge label="Pests" value={scores.pest_break_score ?? 0} size="small" colorByScore />
          <ScoreBadge label="Season fit" value={scores.season_fit_score ?? 0} size="small" colorByScore />
          <ScoreBadge label="Income" value={scores.income_score ?? 0} size="small" colorByScore />
        </div>
      </div>

      <Timeline weeklyTimeline={weeklyTimeline} crops={crops} baseYear={baseYear} />

      <BreakdownPanel
        qualitativeAnalysis={strategy.qualitative_analysis}
        seasons={scores.seasons ?? []}
        confidence={scores.confidence!}
        checkLocally={scores.check_locally ?? []}
      />
    </div>
  );
}
