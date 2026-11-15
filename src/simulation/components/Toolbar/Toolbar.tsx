export type SimulationTab = "rotation" | "plant";

export interface ToolbarProps {
  activeTab: SimulationTab;
  onSelectTab: (tab: SimulationTab) => void;
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

const inactiveTabStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "14px",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "8px 18px",
  background: "transparent",
  color: "var(--color-text-muted)",
  cursor: "pointer",
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

const filledPillDisabledStyle: React.CSSProperties = {
  ...filledPillStyle,
  opacity: 0.45,
  cursor: "not-allowed",
};

/** Rotation, Plant, Priorities, and Find a better order are all live. Find a better order only makes sense for Rotation mode, so it's disabled (not hidden) on the Plant tab. */
export default function Toolbar({ activeTab, onSelectTab, prioritiesOpen, onTogglePriorities, onFindBetterOrder }: ToolbarProps) {
  return (
    <div style={toolbarStyle}>
      <div style={modeTabsStyle}>
        <button style={activeTab === "rotation" ? activeTabStyle : inactiveTabStyle} onClick={() => onSelectTab("rotation")}>
          Rotation
        </button>
        <button style={activeTab === "plant" ? activeTabStyle : inactiveTabStyle} onClick={() => onSelectTab("plant")}>
          Plant
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
        <button
          style={activeTab === "rotation" ? filledPillStyle : filledPillDisabledStyle}
          onClick={onFindBetterOrder}
          disabled={activeTab !== "rotation"}
          title={activeTab === "rotation" ? undefined : "Switch to Rotation mode to use this"}
        >
          Find a better order
        </button>
      </div>
    </div>
  );
}
