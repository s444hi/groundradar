import { weekToMonthName } from "../../engine/frost";
import { BARE_LABEL_THRESHOLD_PERCENT, TRACK_HEIGHT } from "../Timeline/layout";
import { useDragSwap } from "../Timeline/useDragSwap";

export interface GapSlotProps {
  weekCount: number;
  startAbsoluteWeek: number;
  endAbsoluteWeek: number;
  widthPercent: number;
  currentWeek: number;
  dragDropId: string;
}

const containerStyle: React.CSSProperties = {
  boxSizing: "border-box",
  flexShrink: 0,
  position: "relative",
  height: `${TRACK_HEIGHT}px`,
  // Without these, a mouse-down-and-drag over the label text starts a
  // native text selection instead of registering as a dnd-kit drag.
  userSelect: "none",
  touchAction: "none",
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
// Still a drag source/target like CropCard — dragging a crop onto a bare
// slot (or vice versa) swaps what's planted there.
export default function GapSlot({
  weekCount,
  startAbsoluteWeek,
  endAbsoluteWeek,
  widthPercent,
  currentWeek,
  dragDropId,
}: GapSlotProps) {
  const startMonth = weekToMonthName((startAbsoluteWeek % 52) + 1);
  const endMonth = weekToMonthName((endAbsoluteWeek % 52) + 1);
  const monthLabel = startMonth === endMonth ? startMonth : `${startMonth}–${endMonth}`;
  const tooltip = `Bare soil — ${weekCount} wks · ${monthLabel}`;
  const showLabel = widthPercent >= BARE_LABEL_THRESHOLD_PERCENT && currentWeek >= startAbsoluteWeek;

  const drag = useDragSwap(dragDropId);

  return (
    <div
      ref={drag.setNodeRef}
      // dnd-kit's `transform` is plain re-render-triggering state, not a
      // React ref — this flags as a false positive.
      // eslint-disable-next-line react/refs
      style={{ ...containerStyle, width: `${widthPercent}%`, ...drag.style }}
      title={tooltip}
      {...drag.attributes}
      {...drag.listeners}
    >
      {showLabel && <p style={labelStyle}>Bare soil</p>}
    </div>
  );
}
