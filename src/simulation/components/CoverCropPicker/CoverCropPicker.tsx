import PixelSprite from "../PixelSprite";
import { getCropSpriteSet } from "../sprites";
import type { CropId, CropsById } from "../../engine/types";

export interface CoverCropOptionWithDelta {
  cropId: CropId;
  reason: string;
  scoreDelta: number;
}

export interface CoverCropPickerProps {
  options: CoverCropOptionWithDelta[];
  crops: CropsById;
  onPick: (cropId: CropId) => void;
}

const PICKER_PIXEL_SIZE = 2;

const popoverStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: "50%",
  transform: "translateX(-50%)",
  marginTop: "6px",
  width: "260px",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  boxShadow: "0 10px 24px color-mix(in srgb, var(--color-text) 14%, transparent)",
  padding: "8px",
  zIndex: 20,
  // This whole segment lives inside a draggable/droppable-free area, but
  // sibling CropCards are drag sources — keep the popover from inheriting
  // their cursor/select suppression.
  cursor: "default",
  userSelect: "text",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "12px",
  color: "var(--color-text-muted)",
  margin: "4px 8px 8px",
};

const optionRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  textAlign: "left",
  border: "none",
  background: "none",
  borderRadius: "12px",
  padding: "8px",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};

const spriteBoxStyle: React.CSSProperties = {
  flexShrink: 0,
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
};

const textColStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const nameStyle: React.CSSProperties = {
  fontWeight: 500,
  fontSize: "13px",
  color: "var(--color-text)",
};

const reasonStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text-muted)",
};

const emptyStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "12px",
  color: "var(--color-text-muted)",
  padding: "8px",
};

function deltaStyle(delta: number): React.CSSProperties {
  const color = delta > 0 ? "var(--color-sim-good)" : delta < 0 ? "var(--color-sim-risk)" : "var(--color-text-muted)";
  return {
    flexShrink: 0,
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    fontWeight: 500,
    color,
  };
}

function formatDelta(delta: number): string {
  const rounded = Math.round(delta);
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

/**
 * Popover listing cover crop options for one bare-soil gap (sprite, a
 * plain-words reason, and the predicted overall_success_score change).
 * Picking an option is the caller's job to act on (this component holds no
 * engine/edit logic of its own). Open/close (including outside-click and
 * Escape) is owned by the parent GapSlot, which wraps both this popover and
 * its own trigger — not this component, since a listener scoped to only
 * this popover's own DOM would see a click back on the trigger itself as
 * "outside" and race against the trigger's own toggle handler.
 */
export default function CoverCropPicker({ options, crops, onPick }: CoverCropPickerProps) {
  return (
    <div
      style={popoverStyle}
      // Stop this from ever reaching Timeline's click-to-seek handler or
      // being misread as the start of a crop drag.
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p style={titleStyle}>Add a cover crop</p>
      {options.length === 0 ? (
        <p style={emptyStyle}>No cover crops fit this window.</p>
      ) : (
        options.map(({ cropId, reason, scoreDelta }) => {
          const crop = crops[cropId];
          const sprite = getCropSpriteSet(cropId).full;
          return (
            <button
              key={cropId}
              style={optionRowStyle}
              onClick={() => onPick(cropId)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-subtle)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <span style={spriteBoxStyle}>
                <PixelSprite grid={sprite.rows} pixelSize={PICKER_PIXEL_SIZE} />
              </span>
              <span style={textColStyle}>
                <div style={nameStyle}>{crop.display_name}</div>
                <div style={reasonStyle}>{reason}</div>
              </span>
              <span style={deltaStyle(scoreDelta)}>{formatDelta(scoreDelta)}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
