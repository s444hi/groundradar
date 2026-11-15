import { groupWeeksIntoSegments } from "../Timeline/groupWeeksIntoSegments";
import type { CropsById, WeeklyTimeline } from "../../engine/types";

export interface OptimizerSuggestionCardProps {
  changes: string[];
  beforeScore: number;
  afterScore: number;
  proposedTimeline: WeeklyTimeline;
  templateLength: number;
  changedTemplateIndices: Set<number>;
  crops: CropsById;
  onAccept: () => void;
  onDismiss: () => void;
}

const cardStyle: React.CSSProperties = {
  background: "var(--color-bg)",
  border: "1px solid var(--color-olive)",
  borderRadius: "var(--radius-card)",
  padding: "16px 20px",
  margin: "0 0 20px 0",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "8px",
  marginBottom: "8px",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "14px",
  color: "var(--color-olive)",
  margin: 0,
};

const scoreLineStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "13px",
  color: "var(--color-text)",
};

const changesListStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  color: "var(--color-text-muted)",
  margin: "0 0 12px 0",
  paddingLeft: "18px",
};

const previewRowStyle: React.CSSProperties = {
  display: "flex",
  width: "100%",
  height: "28px",
  borderRadius: "8px",
  overflow: "hidden",
  marginBottom: "14px",
};

function previewSegmentStyle(widthPercent: number, isChanged: boolean): React.CSSProperties {
  return {
    width: `${widthPercent}%`,
    flexShrink: 0,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-mono)",
    fontSize: "8px",
    color: "var(--color-text-muted)",
    background: "var(--color-bg-subtle)",
    border: isChanged ? "2px solid var(--color-olive)" : "1px solid var(--color-border)",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    padding: "0 2px",
  };
}

const actionsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
};

const acceptButtonStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "13px",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "6px 16px",
  background: "var(--color-olive)",
  color: "var(--color-text-on-dark)",
  cursor: "pointer",
};

const dismissButtonStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "13px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-pill)",
  padding: "6px 16px",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
};

/**
 * Shown inside a lane when "Find a better order" improves it by >=1 point.
 * The preview strip is a lightweight, static read of the proposed timeline
 * (not the full interactive Timeline — no playback/drag/picker needed here)
 * with changed segments outlined.
 */
export default function OptimizerSuggestionCard({
  changes,
  beforeScore,
  afterScore,
  proposedTimeline,
  templateLength,
  changedTemplateIndices,
  crops,
  onAccept,
  onDismiss,
}: OptimizerSuggestionCardProps) {
  const totalWeeks = proposedTimeline.years * 52;
  const segments = groupWeeksIntoSegments(proposedTimeline);
  const rawPercents = segments.map((segment) => (segment.weekCount / totalWeeks) * 100);
  const percentBeforeLast = rawPercents.slice(0, -1).reduce((sum, pct) => sum + pct, 0);
  const widths = rawPercents.map((pct, index) => (index === rawPercents.length - 1 ? 100 - percentBeforeLast : pct));

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <p style={titleStyle}>Suggested change</p>
        <span style={scoreLineStyle}>
          {Math.round(beforeScore)}% → {Math.round(afterScore)}%
        </span>
      </div>
      <ul style={changesListStyle}>
        {changes.map((change) => (
          <li key={change}>{change}</li>
        ))}
      </ul>
      <div style={previewRowStyle}>
        {segments.map((segment, index) => {
          const expandedSlotIndex = segment.slotIndexes[0] ?? 0;
          const templateIndex = expandedSlotIndex % templateLength;
          const label = segment.isBare ? "Bare soil" : segment.cropIds.map((id) => crops[id]?.display_name ?? id).join(" + ");
          return (
            <div key={segment.startAbsoluteWeek} style={previewSegmentStyle(widths[index], changedTemplateIndices.has(templateIndex))}>
              {label}
            </div>
          );
        })}
      </div>
      <div style={actionsRowStyle}>
        <button style={acceptButtonStyle} onClick={onAccept}>
          Accept
        </button>
        <button style={dismissButtonStyle} onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
