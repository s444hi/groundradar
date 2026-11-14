export interface ScoreBadgeProps {
  label: string;
  value: number;
  size: "large" | "small";
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

export default function ScoreBadge({ label, value, size }: ScoreBadgeProps) {
  const numeralStyle = size === "large" ? largeNumeralStyle : smallNumeralStyle;
  const labelStyle = size === "large" ? largeLabelStyle : smallLabelStyle;

  return (
    <div style={wrapStyle}>
      <p style={numeralStyle}>{Math.round(value)}%</p>
      <p style={labelStyle}>{label}</p>
    </div>
  );
}
