import CropCard from "../CropCard/CropCard";
import GapSlot from "../GapSlot/GapSlot";
import type { CropsById, WeeklyTimeline } from "../../engine/types";
import { groupWeeksIntoSegments } from "./groupWeeksIntoSegments";

export interface TimelineProps {
  weeklyTimeline: WeeklyTimeline;
  crops: CropsById;
  baseYear: number;
}

const outerStyle: React.CSSProperties = {
  marginBottom: "32px",
};

const yearLabelRowStyle: React.CSSProperties = {
  position: "relative",
  height: "16px",
  marginBottom: "4px",
};

const yearLabelStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  color: "var(--color-text-muted)",
  whiteSpace: "nowrap",
};

const trackWrapperStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  width: "100%",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  overflow: "hidden",
};

function dividerStyle(leftPercent: number): React.CSSProperties {
  return {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: `${leftPercent}%`,
    width: "1px",
    background: "color-mix(in srgb, var(--color-border) 70%, transparent)",
    pointerEvents: "none",
  };
}

export default function Timeline({ weeklyTimeline, crops, baseYear }: TimelineProps) {
  const totalWeeks = weeklyTimeline.years * 52;
  const segments = groupWeeksIntoSegments(weeklyTimeline);

  // Percentage widths that sum to exactly 100: the last segment absorbs
  // whatever rounding remainder is left, so there's never a visible gap or
  // overflow at the right edge.
  const rawPercents = segments.map((segment) => (segment.weekCount / totalWeeks) * 100);
  const percentBeforeLast = rawPercents.slice(0, -1).reduce((sum, pct) => sum + pct, 0);
  const widths = rawPercents.map((pct, index) => (index === rawPercents.length - 1 ? 100 - percentBeforeLast : pct));

  return (
    <div style={outerStyle}>
      <div style={yearLabelRowStyle}>
        {Array.from({ length: weeklyTimeline.years }, (_, yearOffset) => (
          <span
            key={yearOffset}
            style={{ ...yearLabelStyle, left: `${(yearOffset * 52 / totalWeeks) * 100}%` }}
          >
            {baseYear + yearOffset}
          </span>
        ))}
      </div>

      <div style={trackWrapperStyle}>
        {segments.map((segment, index) =>
          segment.isBare ? (
            <GapSlot
              key={segment.startAbsoluteWeek}
              weekCount={segment.weekCount}
              startAbsoluteWeek={segment.startAbsoluteWeek}
              endAbsoluteWeek={segment.endAbsoluteWeek}
              widthPercent={widths[index]}
            />
          ) : (
            <CropCard
              key={segment.startAbsoluteWeek}
              cropIds={segment.cropIds}
              crops={crops}
              weekCount={segment.weekCount}
              startAbsoluteWeek={segment.startAbsoluteWeek}
              endAbsoluteWeek={segment.endAbsoluteWeek}
              widthPercent={widths[index]}
            />
          ),
        )}

        {Array.from({ length: weeklyTimeline.years - 1 }, (_, i) => i + 1).map((yearBoundary) => (
          <div key={yearBoundary} style={dividerStyle((yearBoundary * 52 / totalWeeks) * 100)} />
        ))}
      </div>
    </div>
  );
}
