import CropCard from "../CropCard/CropCard";
import GapSlot from "../GapSlot/GapSlot";
import type { CropsById, WeeklyTimeline } from "../../engine/types";
import { groupWeeksIntoSegments } from "./groupWeeksIntoSegments";

export interface TimelineProps {
  weeklyTimeline: WeeklyTimeline;
  crops: CropsById;
  baseYear: number;
}

const WEEK_PX = 10;
const MIN_SEGMENT_WIDTH_PX = 56;

const outerStyle: React.CSSProperties = {
  overflowX: "auto",
  paddingBottom: "12px",
  marginBottom: "32px",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: "4px",
  minWidth: "max-content",
};

const yearLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  color: "var(--color-text-muted)",
  marginBottom: "4px",
};

export default function Timeline({ weeklyTimeline, crops, baseYear }: TimelineProps) {
  const segments = groupWeeksIntoSegments(weeklyTimeline);

  return (
    <div style={outerStyle}>
      <div style={rowStyle}>
        {segments.map((segment) => {
          const widthPx = Math.max(MIN_SEGMENT_WIDTH_PX, segment.weekCount * WEEK_PX);
          const startYear = baseYear + segment.yearOffset;
          const endYear = baseYear + Math.floor(segment.endAbsoluteWeek / 52);
          const yearLabel = startYear === endYear ? `${startYear}` : `${startYear}–${endYear}`;

          return (
            <div key={segment.startAbsoluteWeek} style={{ width: `${widthPx}px`, flexShrink: 0 }}>
              <p style={yearLabelStyle}>{yearLabel}</p>
              {segment.isBare ? (
                <GapSlot
                  weekCount={segment.weekCount}
                  startAbsoluteWeek={segment.startAbsoluteWeek}
                  endAbsoluteWeek={segment.endAbsoluteWeek}
                  widthPx={widthPx}
                />
              ) : (
                <CropCard
                  cropIds={segment.cropIds}
                  crops={crops}
                  weekCount={segment.weekCount}
                  startAbsoluteWeek={segment.startAbsoluteWeek}
                  endAbsoluteWeek={segment.endAbsoluteWeek}
                  widthPx={widthPx}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
