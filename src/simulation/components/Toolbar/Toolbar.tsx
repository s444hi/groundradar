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

/** Only "Rotation", "Priorities", and "Find a better order" are live today. */
export default function Toolbar({ prioritiesOpen, onTogglePriorities, onFindBetterOrder }: ToolbarProps) {
  return (
    <div style={toolbarStyle}>
      <div style={modeTabsStyle}>
        <button style={activeTabStyle}>Rotation</button>
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
