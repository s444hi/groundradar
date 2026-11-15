import { weekToMonthName } from "../../engine/frost";

export interface GapSlotProps {
  weekCount: number;
  startAbsoluteWeek: number;
  endAbsoluteWeek: number;
  widthPercent: number;
}

const labelPillStyle: React.CSSProperties = {
  background: "color-mix(in srgb, var(--color-bg) 70%, transparent)",
  borderRadius: "var(--radius-pill)",
  padding: "4px 10px",
  textAlign: "center",
};

const textStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "12px",
  color: "var(--color-text)",
  margin: 0,
};

const weekLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  color: "var(--color-text-muted)",
  margin: 0,
};

export default function GapSlot({ weekCount, startAbsoluteWeek, endAbsoluteWeek, widthPercent }: GapSlotProps) {
  // See CropCard: no per-segment radius/full border — the Timeline track
  // owns the rounded strip shape; each segment gets a right-edge seam.
  const cardStyle: React.CSSProperties = {
    width: `${widthPercent}%`,
    boxSizing: "border-box",
    flexShrink: 0,
    minHeight: "72px",
    borderRight: "1px solid var(--color-border)",
    background: `repeating-linear-gradient(45deg,
      color-mix(in srgb, var(--color-sim-bare-soil) 55%, transparent) 0 6px,
      color-mix(in srgb, var(--color-sim-bare-soil) 20%, transparent) 6px 12px)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const startMonth = weekToMonthName((startAbsoluteWeek % 52) + 1);
  const endMonth = weekToMonthName((endAbsoluteWeek % 52) + 1);
  const monthLabel = startMonth === endMonth ? startMonth : `${startMonth}–${endMonth}`;

  return (
    <div style={cardStyle}>
      <div style={labelPillStyle}>
        <p style={textStyle}>Bare soil</p>
        <p style={weekLabelStyle}>
          {weekCount} wks · {monthLabel}
        </p>
      </div>
    </div>
  );
}
