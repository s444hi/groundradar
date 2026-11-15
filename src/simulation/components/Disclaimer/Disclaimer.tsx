export interface DisclaimerProps {
  /**
   * "pill" is the standalone page's footer badge. "line" is the quieter form
   * for when the simulation is embedded in the Results page, where a second
   * pale-green pill would compete with the teammate's own chrome.
   */
  variant?: "pill" | "line";
}

const pillStyle: React.CSSProperties = {
  display: "inline-block",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "14px",
  background: "var(--color-pale-green)",
  color: "var(--color-olive)",
  borderRadius: "var(--radius-pill)",
  padding: "10px 20px",
};

const lineStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "12px",
  color: "var(--color-text-muted)",
  margin: 0,
};

export default function Disclaimer({ variant = "pill" }: DisclaimerProps = {}) {
  return <p style={variant === "line" ? lineStyle : pillStyle}>This supports, not replaces, your judgment.</p>;
}
