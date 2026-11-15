export interface ToolbarProps {
  prioritiesOpen: boolean;
  onTogglePriorities: () => void;
  onFindBetterOrder: () => void;
}

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

const outlinePillStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "14px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-pill)",
  padding: "8px 18px",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
};

const outlinePillActiveStyle: React.CSSProperties = {
  ...outlinePillStyle,
  border: "1px solid var(--color-olive)",
  background: "var(--color-pale-green)",
  color: "var(--color-olive)",
};

const filledPillStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "14px",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "8px 18px",
  background: "var(--color-olive)",
  color: "var(--color-text-on-dark)",
  cursor: "pointer",
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
 * Only "Rotation", "Priorities", and "Find a better order" are live today.
 * Plant mode is a real `disabled` button (correct semantics) with an
 * always-visible "Soon" chip, so it reads as clearly not-yet-wired rather
 * than looking broken.
 */
export default function Toolbar({ prioritiesOpen, onTogglePriorities, onFindBetterOrder }: ToolbarProps) {
  return (
    <div style={toolbarStyle}>
      <div style={modeTabsStyle}>
        <button style={activeTabStyle}>Rotation</button>
        <button style={disabledTabStyle} disabled title="Coming soon">
          Plant <span style={soonChipStyle}>Soon</span>
        </button>
      </div>
      <div style={actionsStyle}>
        <button
          style={prioritiesOpen ? outlinePillActiveStyle : outlinePillStyle}
          onClick={onTogglePriorities}
          aria-pressed={prioritiesOpen}
        >
          Priorities
        </button>
        <button style={filledPillStyle} onClick={onFindBetterOrder}>
          Find a better order
        </button>
      </div>
    </div>
  );
}
