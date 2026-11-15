import { forwardRef, useState } from "react";
import BreakdownPanel from "../BreakdownPanel/BreakdownPanel";
import { CONFIDENCE_COLORS } from "../confidenceColor";
import type { CoverCropOptionWithDelta } from "../CoverCropPicker/CoverCropPicker";
import type { GapInfo } from "../CoverCropPicker/coverCropEdits";
import OptimizerSuggestionCard from "../OptimizerSuggestionCard/OptimizerSuggestionCard";
import ScoreBadge from "../ScoreBadge/ScoreBadge";
import Timeline from "../Timeline/Timeline";
import type { PlaybackApi } from "../Timeline/usePlayback";
import { useCountUp } from "./useCountUp";
import type { Hazard } from "../../engine/hazards";
import type { CropId, CropsById, WeeklyTimeline } from "../../engine/types";
import type { OptimizerSuggestion, ScoredRotationStrategy } from "../types";

export interface RotationLaneProps {
  strategy: ScoredRotationStrategy;
  weeklyTimeline: WeeklyTimeline;
  crops: CropsById;
  playback: PlaybackApi;
  rank: number;
  strategyIndex: number;
  templateLength: number;
  isEdited: boolean;
  onSwapAlternate: (templateIndex: number) => void;
  onReset: () => void;
  openGapKey: string | null;
  pickerOptions: CoverCropOptionWithDelta[];
  onToggleGap: (gapKey: string, templateIndex: number, gapInfo: GapInfo) => void;
  onClosePicker: () => void;
  onPickCoverCrop: (cropId: CropId) => void;
  onRemoveCoverCrop: (templateIndex: number) => void;
  suggestion: OptimizerSuggestion | null;
  onAcceptSuggestion: () => void;
  onDismissSuggestion: () => void;
  hazards: Hazard[];
}

const SCORE_COUNT_UP_MS = 600;

// Off by default: a reminder, for internal reference only, of what this
// view still doesn't implement (DinoRunner's own obstacle-course replay).
const SHOW_SCOPE_NOTE = false;

function laneStyle(isTopRanked: boolean): React.CSSProperties {
  return {
    background: "var(--color-cream)",
    border: isTopRanked ? "2px solid var(--color-olive)" : "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "28px",
    marginTop: "24px",
    transition: "transform 180ms ease, box-shadow 180ms ease",
  };
}

const laneTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontWeight: 400,
  letterSpacing: "-0.02em",
  fontSize: "32px",
  margin: "0 0 8px 0",
};

const tagRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  marginBottom: "16px",
};

const tagStyle: React.CSSProperties = {
  display: "inline-block",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "13px",
  background: "var(--color-pale-green)",
  color: "var(--color-olive)",
  borderRadius: "var(--radius-pill)",
  padding: "4px 12px",
};

const rankTagStyle: React.CSSProperties = {
  ...tagStyle,
  fontFamily: "var(--font-mono)",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
};

const scopeNoteStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "11px",
  color: "var(--color-text-muted)",
  margin: "0 0 24px 0",
};

const editedBannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  color: "var(--color-text-muted)",
  background: "var(--color-bg-subtle)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-pill)",
  padding: "8px 16px",
  margin: "0 0 20px 0",
};

const resetButtonStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "13px",
  color: "var(--color-olive)",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
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

const showDetailsButtonStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "13px",
  color: "var(--color-olive)",
  background: "none",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-pill)",
  padding: "6px 16px",
  cursor: "pointer",
};

const RotationLane = forwardRef<HTMLDivElement, RotationLaneProps>(function RotationLane(
  {
    strategy,
    weeklyTimeline,
    crops,
    playback,
    rank,
    strategyIndex,
    templateLength,
    isEdited,
    onSwapAlternate,
    onReset,
    openGapKey,
    pickerOptions,
    onToggleGap,
    onClosePicker,
    onPickCoverCrop,
    onRemoveCoverCrop,
    suggestion,
    onAcceptSuggestion,
    onDismissSuggestion,
    hazards,
  },
  ref,
) {
  const scores = strategy.simulation_scores;
  const baseYear = strategy.timeline[0]?.year ?? 0;
  const isTopRanked = rank === 1;
  // "By default" means on first render at this rank — a user's manual
  // toggle afterward should stick even if an edit later changes the rank.
  const [breakdownExpanded, setBreakdownExpanded] = useState(isTopRanked);

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
      ref={ref}
      style={laneStyle(isTopRanked)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 10px 24px color-mix(in srgb, var(--color-text) 10%, transparent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={tagRowStyle}>
        <span style={rankTagStyle}>#{rank}</span>
        {strategy.is_baseline && <span style={tagStyle}>Baseline</span>}
      </div>
      <h2 style={laneTitleStyle}>{strategy.title}</h2>
      {SHOW_SCOPE_NOTE && (
        <p style={scopeNoteStyle}>Static preview — DinoRunner's own obstacle-course replay is not implemented in this view.</p>
      )}

      {isEdited && (
        <div style={editedBannerStyle}>
          <span>You changed this rotation, so the explanation is for the original.</span>
          <button style={resetButtonStyle} onClick={onReset}>
            Reset
          </button>
        </div>
      )}

      {suggestion && (
        <OptimizerSuggestionCard
          changes={suggestion.changes}
          beforeScore={suggestion.beforeScore}
          afterScore={suggestion.afterScore}
          proposedTimeline={suggestion.proposedTimeline}
          templateLength={templateLength}
          changedTemplateIndices={suggestion.changedTemplateIndices}
          crops={crops}
          onAccept={onAcceptSuggestion}
          onDismiss={onDismissSuggestion}
        />
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

      <Timeline
        weeklyTimeline={weeklyTimeline}
        crops={crops}
        baseYear={baseYear}
        playback={playback}
        strategyIndex={strategyIndex}
        templateLength={templateLength}
        onSwapAlternate={onSwapAlternate}
        openGapKey={openGapKey}
        pickerOptions={pickerOptions}
        onToggleGap={onToggleGap}
        onClosePicker={onClosePicker}
        onPickCoverCrop={onPickCoverCrop}
        onRemoveCoverCrop={onRemoveCoverCrop}
        hazards={hazards}
      />

      {breakdownExpanded ? (
        <BreakdownPanel
          qualitativeAnalysis={strategy.qualitative_analysis}
          seasons={scores.seasons ?? []}
          confidence={scores.confidence!}
          checkLocally={scores.check_locally ?? []}
        />
      ) : (
        <button style={showDetailsButtonStyle} onClick={() => setBreakdownExpanded(true)}>
          Show details
        </button>
      )}
      {breakdownExpanded && !isTopRanked && (
        <button style={{ ...showDetailsButtonStyle, marginTop: "12px" }} onClick={() => setBreakdownExpanded(false)}>
          Hide details
        </button>
      )}
    </div>
  );
});

export default RotationLane;
