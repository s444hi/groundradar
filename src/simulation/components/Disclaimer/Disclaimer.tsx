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

export default function Disclaimer() {
  return <p style={pillStyle}>This supports, not replaces, your judgment.</p>;
}
