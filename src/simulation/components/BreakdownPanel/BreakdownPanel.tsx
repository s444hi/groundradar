import { useState } from "react";
import type { Confidence, QualitativeAnalysis, SeasonResult } from "../../engine/types";
import { groupReasons } from "./groupReasons";

export interface BreakdownPanelProps {
  qualitativeAnalysis: QualitativeAnalysis;
  seasons: SeasonResult[];
  confidence: Confidence;
  checkLocally: string[];
}

type Tab = "overview" | "why" | "checklocally";

const panelStyle: React.CSSProperties = {
  background: "var(--color-bg-subtle)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  padding: "28px",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const tabBarStyle: React.CSSProperties = {
  display: "inline-flex",
  gap: "2px",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-pill)",
  padding: "4px",
  alignSelf: "flex-start",
};

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--font-sans)",
    fontWeight: 500,
    fontSize: "13px",
    border: "none",
    borderRadius: "var(--radius-pill)",
    padding: "6px 14px",
    cursor: "pointer",
    background: active ? "var(--color-olive)" : "transparent",
    color: active ? "var(--color-text-on-dark)" : "var(--color-text-muted)",
    transition: "background-color 150ms ease, color 150ms ease",
  };
}

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "14px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--color-text-muted)",
  margin: "0 0 8px 0",
};

const bodyTextStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "15px",
  color: "var(--color-text)",
  lineHeight: 1.5,
  margin: "0 0 8px 0",
};

const listStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "15px",
  color: "var(--color-text)",
  lineHeight: 1.5,
  margin: 0,
  paddingLeft: "20px",
};

const dividerStyle: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid var(--color-border)",
  margin: 0,
};

const reasonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  alignItems: "baseline",
  marginBottom: "8px",
};

const annotationStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  color: "var(--color-text-muted)",
};

const showAllButtonStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "13px",
  color: "var(--color-olive)",
  background: "none",
  border: "none",
  padding: 0,
  marginTop: "4px",
  cursor: "pointer",
  textAlign: "left",
};

function deltaBadgeStyle(delta: number): React.CSSProperties {
  return {
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    fontWeight: 500,
    color: delta < 0 ? "var(--color-sim-risk)" : "var(--color-sim-good)",
    minWidth: "40px",
  };
}

export default function BreakdownPanel({ qualitativeAnalysis, seasons, confidence, checkLocally }: BreakdownPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showAll, setShowAll] = useState(false);

  const groupedReasons = groupReasons(seasons);
  // A trend line's delta is its last year's, so a trend whose final year
  // happens to land at 0 would hide by default even if earlier years
  // weren't — not an issue for current demo data, but a known limitation.
  const visibleReasons = showAll ? groupedReasons : groupedReasons.filter((reason) => reason.delta !== 0);
  const hiddenCount = groupedReasons.length - visibleReasons.length;

  return (
    <div style={panelStyle}>
      <div style={tabBarStyle}>
        <button style={tabButtonStyle(activeTab === "overview")} onClick={() => setActiveTab("overview")}>
          Overview
        </button>
        <button style={tabButtonStyle(activeTab === "why")} onClick={() => setActiveTab("why")}>
          Why this score
        </button>
        <button style={tabButtonStyle(activeTab === "checklocally")} onClick={() => setActiveTab("checklocally")}>
          Check locally
        </button>
      </div>

      {activeTab === "overview" && (
        <>
          <div>
            <h3 style={sectionHeadingStyle}>Why this strategy</h3>
            <p style={bodyTextStyle}>{qualitativeAnalysis.why_suggested}</p>
            <p style={bodyTextStyle}>{qualitativeAnalysis.nasa_evidence}</p>
            {qualitativeAnalysis.benefits.length > 0 && (
              <ul style={listStyle}>
                {qualitativeAnalysis.benefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
            )}
            {qualitativeAnalysis.information_gaps.length > 0 && (
              <ul style={listStyle}>
                {qualitativeAnalysis.information_gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            )}
          </div>

          <hr style={dividerStyle} />

          <div>
            {/* The confidence badge itself now lives up in RotationLane's
                score row (always visible); this just lists the reasons. */}
            <h3 style={sectionHeadingStyle}>Confidence</h3>
            <ul style={listStyle}>
              {confidence.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      {activeTab === "why" && (
        <div>
          <h3 style={sectionHeadingStyle}>Why the score is what it is</h3>
          {visibleReasons.map((reason) => (
            <div key={reason.text} style={reasonRowStyle}>
              <span style={deltaBadgeStyle(reason.delta)}>
                {reason.delta >= 0 ? "+" : ""}
                {Math.round(reason.delta)}
              </span>
              <p style={{ ...bodyTextStyle, margin: 0 }}>
                {reason.text} {reason.annotation && <span style={annotationStyle}>{reason.annotation}</span>}
              </p>
            </div>
          ))}
          {hiddenCount > 0 && (
            <button style={showAllButtonStyle} onClick={() => setShowAll(!showAll)}>
              {showAll ? "Hide zero-impact details" : `Show all details (${hiddenCount} more)`}
            </button>
          )}
        </div>
      )}

      {activeTab === "checklocally" && (
        <div>
          <h3 style={sectionHeadingStyle}>Check locally</h3>
          <ul style={listStyle}>
            {checkLocally.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
