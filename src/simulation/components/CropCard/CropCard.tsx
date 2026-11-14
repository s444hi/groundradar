import type { CropId, CropsById } from "../../engine/types";

export interface CropCardProps {
  cropIds: CropId[];
  crops: CropsById;
  weekCount: number;
  startAbsoluteWeek: number;
  endAbsoluteWeek: number;
  widthPx: number;
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

export default function CropCard({ cropIds, crops, weekCount, startAbsoluteWeek, endAbsoluteWeek, widthPx }: CropCardProps) {
  const cardStyle: React.CSSProperties = {
    width: `${widthPx}px`,
    minHeight: "72px",
    background: "var(--color-cream)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "4px",
  };

  const names = cropIds.map((id) => crops[id]?.display_name ?? id).join(" + ");
  const startCalendarWeek = (startAbsoluteWeek % 52) + 1;
  const endCalendarWeek = (endAbsoluteWeek % 52) + 1;

  return (
    <div style={cardStyle}>
      <p style={nameStyle}>{names}</p>
      <p style={weekLabelStyle}>
        {weekCount} wks · Wk {startCalendarWeek}–{endCalendarWeek}
      </p>
    </div>
  );
}
