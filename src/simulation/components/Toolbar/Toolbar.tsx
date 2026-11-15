const toolbarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "16px",
  margin: "0 0 24px 0",
};

const modeTabsStyle: React.CSSProperties = {
  display: "inline-flex",
  gap: "2px",
  background: "var(--color-bg-subtle)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-pill)",
  padding: "4px",
};

const activeTabStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "14px",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "8px 18px",
  background: "var(--color-olive)",
  color: "var(--color-text-on-dark)",
  cursor: "default",
};

const disabledTabStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "14px",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "8px 18px",
  background: "transparent",
  color: "var(--color-text-muted)",
  opacity: 0.55,
  cursor: "not-allowed",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const outlinePillDisabledStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "14px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-pill)",
  padding: "8px 18px",
  background: "var(--color-bg)",
  color: "var(--color-text-muted)",
  opacity: 0.55,
  cursor: "not-allowed",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const filledPillDisabledStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "14px",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "8px 18px",
  background: "var(--color-olive)",
  color: "var(--color-text-on-dark)",
  opacity: 0.45,
  cursor: "not-allowed",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const soonChipStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  background: "var(--color-pale-green)",
  color: "var(--color-olive)",
  borderRadius: "var(--radius-pill)",
  padding: "2px 6px",
};

/**
 * Static placeholder toolbar: only "Rotation" is live today. Plant mode,
 * Priorities, and the optimizer are real `disabled` buttons (correct
 * semantics) with an always-visible "Soon" chip, so they read as clearly
 * not-yet-wired rather than looking broken.
 */
export default function Toolbar() {
  return (
    <div style={toolbarStyle}>
      <div style={modeTabsStyle}>
        <button style={activeTabStyle}>Rotation</button>
        <button style={disabledTabStyle} disabled title="Coming soon">
          Plant <span style={soonChipStyle}>Soon</span>
        </button>
      </div>
      <div style={actionsStyle}>
        <button style={outlinePillDisabledStyle} disabled title="Coming soon">
          Priorities <span style={soonChipStyle}>Soon</span>
        </button>
        <button style={filledPillDisabledStyle} disabled title="Coming soon">
          Find a better order <span style={soonChipStyle}>Soon</span>
        </button>
      </div>
    </div>
  );
}
