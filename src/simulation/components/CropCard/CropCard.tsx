import { weekToMonthName } from "../../engine/frost";
import type { CropId, CropsById } from "../../engine/types";

export interface CropCardProps {
  cropIds: CropId[];
  crops: CropsById;
  weekCount: number;
  startAbsoluteWeek: number;
  endAbsoluteWeek: number;
  widthPercent: number;
}

const nameStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "13px",
  color: "var(--color-text)",
  margin: 0,
  overflowWrap: "break-word",
};

const weekLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  color: "var(--color-text-muted)",
  margin: 0,
};

export default function CropCard({
  cropIds,
  crops,
  weekCount,
  startAbsoluteWeek,
  endAbsoluteWeek,
  widthPercent,
}: CropCardProps) {
  const hasCoverCrop = cropIds.some((id) => crops[id]?.is_cover_crop);
  // No per-segment radius or full border: the Timeline's outer track owns
  // the rounded, bordered "strip" shape (overflow:hidden + radius); each
  // segment just needs a right-edge seam against its neighbor.
  const cardStyle: React.CSSProperties = {
    width: `${widthPercent}%`,
    boxSizing: "border-box",
    flexShrink: 0,
    minHeight: "72px",
    background: hasCoverCrop ? "var(--color-sage)" : "var(--color-bg)",
    borderRight: "1px solid var(--color-border)",
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "4px",
  };

  const names = cropIds.map((id) => crops[id]?.display_name ?? id).join(" + ");
  const startMonth = weekToMonthName((startAbsoluteWeek % 52) + 1);
  const endMonth = weekToMonthName((endAbsoluteWeek % 52) + 1);
  const monthLabel = startMonth === endMonth ? startMonth : `${startMonth}–${endMonth}`;

  return (
    <div style={cardStyle}>
      <p style={nameStyle}>{names}</p>
      <p style={weekLabelStyle}>
        {weekCount} wks · {monthLabel}
      </p>
    </div>
  );
}
