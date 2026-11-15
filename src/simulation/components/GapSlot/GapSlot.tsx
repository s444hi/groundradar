import { useDndContext } from "@dnd-kit/core";
import { weekToMonthName } from "../../engine/frost";
import { BARE_LABEL_THRESHOLD_PERCENT, TRACK_HEIGHT } from "../Timeline/layout";

export interface GapSlotProps {
  weekCount: number;
  startAbsoluteWeek: number;
  endAbsoluteWeek: number;
  widthPercent: number;
  currentWeek: number;
}

const containerStyle: React.CSSProperties = {
  boxSizing: "border-box",
  flexShrink: 0,
  position: "relative",
  height: `${TRACK_HEIGHT}px`,
  transition: "opacity 120ms ease",
};

const labelStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  margin: 0,
  textAlign: "center",
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  color: "var(--color-text-muted)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  padding: "0 2px",
};

// Bare soil is just empty ground — Timeline's shared ground line and dirt
// specks already show through underneath; this only adds the conditional
// label, and keeps it hidden until the playhead actually reaches this
// stretch, consistent with the rest of the timeline revealing progressively.
// Not a drag source or drop target: dragging a crop onto bare soil does
// nothing (there's no "same season" slot content here to swap into), so it
// dims instead, like any other invalid target, whenever a drag is active.
export default function GapSlot({
  weekCount,
  startAbsoluteWeek,
  endAbsoluteWeek,
  widthPercent,
  currentWeek,
}: GapSlotProps) {
  const startMonth = weekToMonthName((startAbsoluteWeek % 52) + 1);
  const endMonth = weekToMonthName((endAbsoluteWeek % 52) + 1);
  const monthLabel = startMonth === endMonth ? startMonth : `${startMonth}–${endMonth}`;
  const tooltip = `Bare soil — ${weekCount} wks · ${monthLabel}`;
  const showLabel = widthPercent >= BARE_LABEL_THRESHOLD_PERCENT && currentWeek >= startAbsoluteWeek;

  const { active } = useDndContext();
  const dim = active != null;

  return (
    <div
      style={{ ...containerStyle, width: `${widthPercent}%`, opacity: dim ? 0.35 : 1 }}
      title={tooltip}
    >
      {showLabel && <p style={labelStyle}>Bare soil</p>}
    </div>
  );
}
