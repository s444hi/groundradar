import { useEffect, useState } from "react";
import PixelSprite from "../PixelSprite";
import { getCropSpriteSet } from "../sprites";
import type { CropSprite } from "../sprites";
import { weekToMonthName } from "../../engine/frost";
import { getVisibleStages } from "../Timeline/getVisibleStages";
import type { GrowthStageKey } from "../Timeline/getVisibleStages";
import { LABEL_THRESHOLD_PERCENT, PIXEL_SIZE, spriteBottomOffset, TRACK_HEIGHT } from "../Timeline/layout";
import { useDragSwap } from "../Timeline/useDragSwap";
import type { CropId, CropsById, Season } from "../../engine/types";

export interface CropCardProps {
  cropIds: CropId[];
  crops: CropsById;
  weekCount: number;
  startAbsoluteWeek: number;
  endAbsoluteWeek: number;
  widthPercent: number;
  currentWeek: number;
  dragDropId: string;
  season: Season;
  alternateIds: CropId[];
  onSwapAlternate?: () => void;
  isAddedCoverCrop: boolean;
  onRemoveCoverCrop?: () => void;
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

const swapButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: "50%",
  transform: "translateX(-50%)",
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  lineHeight: 1,
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-pill)",
  padding: "2px 6px",
  background: "var(--color-bg)",
  color: "var(--color-olive)",
  cursor: "pointer",
};

const removeButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  lineHeight: 1,
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-pill)",
  padding: "2px 6px",
  background: "var(--color-bg)",
  color: "var(--color-sim-risk)",
  cursor: "pointer",
};

// Pops a newly-visible stage up from the ground. Keyed by the caller so a
// *new* stage mounts fresh (and animates in) while an already-visible one
// re-rendering every animation frame keeps its instance (and stays settled).
function AnimatedStage({ sprite }: { sprite: CropSprite }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      style={{
        transform: entered ? "scaleY(1)" : "scaleY(0)",
        transformOrigin: "bottom",
        transition: "transform 200ms steps(5, end)",
      }}
    >
      <PixelSprite grid={sprite.rows} pixelSize={PIXEL_SIZE} />
    </div>
  );
}

export default function CropCard({
  cropIds,
  crops,
  weekCount,
  startAbsoluteWeek,
  endAbsoluteWeek,
  widthPercent,
  currentWeek,
  dragDropId,
  season,
  alternateIds,
  onSwapAlternate,
  isAddedCoverCrop,
  onRemoveCoverCrop,
}: CropCardProps) {
  // A mix is co-planted in one shared window (same decision as timeline.ts);
  // the primary crop's category stands in for the whole segment's sprite.
  const spriteSet = getCropSpriteSet(cropIds[0]);
  const spriteFor: Record<GrowthStageKey, CropSprite> = {
    sprout: spriteSet.sprout,
    young: spriteSet.young,
    full: spriteSet.full,
  };

  const names = cropIds.map((id) => crops[id]?.display_name ?? id).join(" + ");
  const startMonth = weekToMonthName((startAbsoluteWeek % 52) + 1);
  const endMonth = weekToMonthName((endAbsoluteWeek % 52) + 1);
  const monthLabel = startMonth === endMonth ? startMonth : `${startMonth}–${endMonth}`;
  const tooltip = `${names} — ${weekCount} wks · ${monthLabel}`;

  const visibleStages = getVisibleStages({ startAbsoluteWeek, weekCount }, widthPercent, currentWeek);
  const showLabel = widthPercent >= LABEL_THRESHOLD_PERCENT && visibleStages.length > 0;

  const drag = useDragSwap(dragDropId, { season });

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
      {visibleStages.map(({ stageKey, leftPercent }) => (
        <div
          key={stageKey}
          style={{
            position: "absolute",
            left: `${leftPercent}%`,
            transform: "translateX(-50%)",
            bottom: `${spriteBottomOffset(spriteFor[stageKey])}px`,
          }}
        >
          <AnimatedStage sprite={spriteFor[stageKey]} />
        </div>
      ))}
      {showLabel && <p style={labelStyle}>{names}</p>}
      {alternateIds.length > 0 && onSwapAlternate && (
        <button
          style={swapButtonStyle}
          title={`Swap for ${alternateIds.map((id) => crops[id]?.display_name ?? id).join(" + ")}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSwapAlternate();
          }}
        >
          ⇄
        </button>
      )}
      {isAddedCoverCrop && onRemoveCoverCrop && (
        <button
          style={removeButtonStyle}
          title="Remove this cover crop"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemoveCoverCrop();
          }}
        >
          Remove
        </button>
      )}
    </div>
  );
}
