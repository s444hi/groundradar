import { useDndContext } from "@dnd-kit/core";
import { useEffect, useRef } from "react";
import CoverCropPicker from "../CoverCropPicker/CoverCropPicker";
import type { CoverCropOptionWithDelta } from "../CoverCropPicker/CoverCropPicker";
import { weekToMonthName } from "../../engine/frost";
import { BARE_LABEL_THRESHOLD_PERCENT, TRACK_HEIGHT } from "../Timeline/layout";
import type { CropId, CropsById } from "../../engine/types";

export interface GapSlotProps {
  weekCount: number;
  startAbsoluteWeek: number;
  endAbsoluteWeek: number;
  widthPercent: number;
  currentWeek: number;
  crops: CropsById;
  isPickerOpen: boolean;
  pickerOptions: CoverCropOptionWithDelta[];
  onTogglePicker: () => void;
  onClosePicker: () => void;
  onPickCoverCrop: (cropId: CropId) => void;
}

const containerStyle: React.CSSProperties = {
  boxSizing: "border-box",
  flexShrink: 0,
  position: "relative",
  height: `${TRACK_HEIGHT}px`,
  cursor: "pointer",
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
// It IS a click target though — clicking opens the cover-crop picker.
export default function GapSlot({
  weekCount,
  startAbsoluteWeek,
  endAbsoluteWeek,
  widthPercent,
  currentWeek,
  crops,
  isPickerOpen,
  pickerOptions,
  onTogglePicker,
  onClosePicker,
  onPickCoverCrop,
}: GapSlotProps) {
  const startMonth = weekToMonthName((startAbsoluteWeek % 52) + 1);
  const endMonth = weekToMonthName((endAbsoluteWeek % 52) + 1);
  const monthLabel = startMonth === endMonth ? startMonth : `${startMonth}–${endMonth}`;
  const tooltip = `Bare soil — ${weekCount} wks · ${monthLabel} — click to add a cover crop`;
  const showLabel = widthPercent >= BARE_LABEL_THRESHOLD_PERCENT && currentWeek >= startAbsoluteWeek;

  const { active } = useDndContext();
  const dim = active != null;

  const containerRef = useRef<HTMLDivElement>(null);

  // Owns outside-click/Escape closing here (not inside CoverCropPicker
  // itself) because this ref spans both the popover AND the trigger that
  // opened it — a click on the trigger to toggle it closed must never read
  // as "outside click, close" and then race against the trigger's own
  // toggle handler re-opening it a moment later.
  useEffect(() => {
    if (!isPickerOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) onClosePicker();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClosePicker();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPickerOpen, onClosePicker]);

  return (
    <div
      ref={containerRef}
      style={{ ...containerStyle, width: `${widthPercent}%`, opacity: dim ? 0.35 : 1 }}
      title={tooltip}
      onClick={(e) => {
        // Must never reach Timeline's click-to-seek handler on the track.
        e.stopPropagation();
        onTogglePicker();
      }}
    >
      {showLabel && <p style={labelStyle}>Bare soil</p>}
      {isPickerOpen && <CoverCropPicker options={pickerOptions} crops={crops} onPick={onPickCoverCrop} />}
    </div>
  );
}
