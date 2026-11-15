import PixelSprite from "../PixelSprite";
import { getCropSpriteSet } from "../sprites";
import { weekToMonthName } from "../../engine/frost";
import {
  LABEL_THRESHOLD_PERCENT,
  PIXEL_SIZE,
  spriteBottomOffset,
  TRACK_HEIGHT,
  WIDE_THRESHOLD_PERCENT,
} from "../Timeline/layout";
import type { CropId, CropsById } from "../../engine/types";

export interface CropCardProps {
  cropIds: CropId[];
  crops: CropsById;
  weekCount: number;
  startAbsoluteWeek: number;
  endAbsoluteWeek: number;
  widthPercent: number;
}

const containerStyle: React.CSSProperties = {
  boxSizing: "border-box",
  flexShrink: 0,
  position: "relative",
  height: `${TRACK_HEIGHT}px`,
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

export default function CropCard({
  cropIds,
  crops,
  weekCount,
  startAbsoluteWeek,
  endAbsoluteWeek,
  widthPercent,
}: CropCardProps) {
  // A mix is co-planted in one shared window (same decision as timeline.ts);
  // the primary crop's category stands in for the whole segment's sprite.
  const spriteSet = getCropSpriteSet(cropIds[0]);
  const names = cropIds.map((id) => crops[id]?.display_name ?? id).join(" + ");
  const startMonth = weekToMonthName((startAbsoluteWeek % 52) + 1);
  const endMonth = weekToMonthName((endAbsoluteWeek % 52) + 1);
  const monthLabel = startMonth === endMonth ? startMonth : `${startMonth}–${endMonth}`;
  const tooltip = `${names} — ${weekCount} wks · ${monthLabel}`;

  const isWide = widthPercent >= WIDE_THRESHOLD_PERCENT;
  const showLabel = widthPercent >= LABEL_THRESHOLD_PERCENT;
  const stages = isWide
    ? [
        { sprite: spriteSet.sprout, leftPercent: 18 },
        { sprite: spriteSet.young, leftPercent: 50 },
        { sprite: spriteSet.full, leftPercent: 82 },
      ]
    : [{ sprite: spriteSet.full, leftPercent: 50 }];

  return (
    <div style={{ ...containerStyle, width: `${widthPercent}%` }} title={tooltip}>
      {stages.map(({ sprite, leftPercent }, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: `${leftPercent}%`,
            transform: "translateX(-50%)",
            bottom: `${spriteBottomOffset(sprite)}px`,
          }}
        >
          <PixelSprite grid={sprite.rows} pixelSize={PIXEL_SIZE} />
        </div>
      ))}
      {showLabel && <p style={labelStyle}>{names}</p>}
    </div>
  );
}
