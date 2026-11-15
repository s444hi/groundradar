import type { Priorities } from "../../engine/types";

export interface PrioritySlidersProps {
  priorities: Priorities;
  onChange: (priorities: Priorities) => void;
  onReset: () => void;
}

const PRIORITY_FIELDS: { key: keyof Priorities; label: string }[] = [
  { key: "water", label: "Water" },
  { key: "soil_health", label: "Soil health" },
  { key: "pests", label: "Pests" },
  { key: "income", label: "Income" },
];

const panelStyle: React.CSSProperties = {
  background: "var(--color-bg-subtle)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  padding: "20px 24px",
  marginBottom: "24px",
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  flexWrap: "wrap",
  gap: "8px",
  marginBottom: "16px",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontWeight: 400,
  fontSize: "18px",
  margin: 0,
};

const resetLinkStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "13px",
  color: "var(--color-olive)",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "20px",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const labelRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "14px",
  color: "var(--color-text)",
};

const valueStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  color: "var(--color-text-muted)",
};

const sliderStyle: React.CSSProperties = {
  width: "100%",
  accentColor: "var(--color-olive)",
};

const helperTextStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "12px",
  color: "var(--color-text-muted)",
  margin: "16px 0 0 0",
};

/**
 * Small inline panel (toggled by the Toolbar's Priorities button) for
 * reweighting overall_success_score's priority terms (engine rule 8). Every
 * change is handed straight to the caller, which re-runs the engine for all
 * 3 lanes — this component holds no score/engine logic of its own.
 */
export default function PrioritySliders({ priorities, onChange, onReset }: PrioritySlidersProps) {
  function handleSliderChange(key: keyof Priorities, value: number) {
    onChange({ ...priorities, [key]: value });
  }

  return (
    <div style={panelStyle}>
      <div style={headerRowStyle}>
        <h3 style={titleStyle}>Priorities</h3>
        <button style={resetLinkStyle} onClick={onReset}>
          Reset to survey priorities
        </button>
      </div>
      <div style={gridStyle}>
        {PRIORITY_FIELDS.map(({ key, label }) => (
          <div key={key} style={rowStyle}>
            <div style={labelRowStyle}>
              <span>{label}</span>
              <span style={valueStyle}>{priorities[key]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={priorities[key]}
              onChange={(e) => handleSliderChange(key, Number(e.target.value))}
              style={sliderStyle}
              aria-label={label}
            />
          </div>
        ))}
      </div>
      <p style={helperTextStyle}>This changes how much each goal counts, not your field.</p>
    </div>
  );
}
