import CropCard from "../CropCard/CropCard";
import GapSlot from "../GapSlot/GapSlot";
import type { CropsById, WeeklyTimeline } from "../../engine/types";
import { BELOW_GROUND_HEIGHT, GROUND_LINE_BOTTOM, GROUND_LINE_HEIGHT, LABEL_HEIGHT, seededRandom, TRACK_HEIGHT } from "./layout";
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

const trackAreaStyle: React.CSSProperties = {
  position: "relative",
  height: `${TRACK_HEIGHT}px`,
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  overflow: "hidden",
};

const groundLineStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: `${GROUND_LINE_BOTTOM}px`,
  height: `${GROUND_LINE_HEIGHT}px`,
  background: "var(--color-pixel)",
};

const segmentRowStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  width: "100%",
  height: "100%",
};

function yearTickStyle(leftPercent: number): React.CSSProperties {
  return {
    position: "absolute",
    left: `${leftPercent}%`,
    bottom: `${GROUND_LINE_BOTTOM - 3}px`,
    width: "2px",
    height: `${GROUND_LINE_HEIGHT + 6}px`,
    background: "var(--color-pixel)",
  };
}

// Dirt specks under the ground line: deterministic per absolute week (not
// per segment), so they never jump around on re-render or future reorders.
function DirtSpecks({ totalWeeks }: { totalWeeks: number }) {
  const specks = [];
  for (let week = 0; week < totalWeeks; week++) {
    if (seededRandom(week * 7 + 3) > 0.5) continue; // leave roughly half the weeks bare for a scattered look
    const x = week + seededRandom(week * 13 + 1) * 0.6 + 0.2;
    const y = seededRandom(week * 17 + 5) * 7;
    specks.push(
      <rect key={week} x={x} y={y} width={0.6} height={1.2} fill="var(--color-pixel-light)" shapeRendering="crispEdges" />,
    );
  }
  return (
    <svg
      viewBox={`0 0 ${totalWeeks} 10`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: 0,
        bottom: `${LABEL_HEIGHT}px`,
        width: "100%",
        height: `${BELOW_GROUND_HEIGHT}px`,
      }}
    >
      {specks}
    </svg>
  );
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

      <div style={trackAreaStyle}>
        <DirtSpecks totalWeeks={totalWeeks} />
        <div style={groundLineStyle} />
        {Array.from({ length: weeklyTimeline.years - 1 }, (_, i) => i + 1).map((yearBoundary) => (
          <div key={yearBoundary} style={yearTickStyle((yearBoundary * 52 / totalWeeks) * 100)} />
        ))}

        <div style={segmentRowStyle}>
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
        </div>
      </div>
    </div>
  );
}
