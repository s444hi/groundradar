import { scoreColor } from "../RotationLane/scoreColor";

export interface ScoreBadgeProps {
  label: string;
  // null renders "–" — used while the growth playback hasn't finished yet.
  value: number | null;
  size: "large" | "small";
  colorByScore?: boolean;
}

const wrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "2px",
};

const largeNumeralStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontWeight: 400,
  letterSpacing: "-0.02em",
  fontSize: "96px",
  lineHeight: 1,
  // Fixed height (matches fontSize * lineHeight) so "–" and "78%" occupy the
  // exact same box — switching between them never shifts "Overall success".
  height: "96px",
  margin: 0,
  color: "var(--color-text)",
};

const smallNumeralStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontWeight: 400,
  letterSpacing: "-0.02em",
  fontSize: "36px",
  margin: 0,
  color: "var(--color-text)",
};

const largeLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "16px",
  color: "var(--color-text-muted)",
  margin: 0,
};

const smallLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--color-text-muted)",
  margin: 0,
};

export default function ScoreBadge({ label, value, size, colorByScore = false }: ScoreBadgeProps) {
  const baseNumeralStyle = size === "large" ? largeNumeralStyle : smallNumeralStyle;
  const numeralStyle =
    colorByScore && value !== null ? { ...baseNumeralStyle, color: scoreColor(value) } : baseNumeralStyle;
  const labelStyle = size === "large" ? largeLabelStyle : smallLabelStyle;

  return (
    <div style={wrapStyle}>
      <p style={numeralStyle}>{value === null ? "–" : `${Math.round(value)}%`}</p>
      <p style={labelStyle}>{label}</p>
    </div>
  );
}
