import type { FieldProfile } from "../../engine/types";

export interface AppHeaderProps {
  fieldProfile: FieldProfile;
}

const headerStyle: React.CSSProperties = {
  background: "var(--color-bg)",
  borderBottom: "1px solid var(--color-border)",
};

const innerStyle: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "20px 24px 16px",
};

const barStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: "16px",
};

const wordmarkStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontWeight: 400,
  letterSpacing: "-0.02em",
  fontSize: "24px",
  margin: 0,
  justifySelf: "start",
};

const navStyle: React.CSSProperties = {
  display: "flex",
  gap: "28px",
  justifySelf: "center",
};

const navItemInertStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "15px",
  color: "var(--color-text-muted)",
  cursor: "default",
};

const navItemActiveStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "15px",
  fontWeight: 500,
  color: "var(--color-olive)",
};

const backButtonStyle: React.CSSProperties = {
  justifySelf: "end",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "14px",
  background: "var(--color-olive)",
  color: "var(--color-text-on-dark)",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "10px 20px",
  cursor: "pointer",
  transition: "background-color 150ms ease",
};

const breadcrumbRowStyle: React.CSSProperties = {
  marginTop: "16px",
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
};

const breadcrumbMutedStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
};

const breadcrumbCurrentStyle: React.CSSProperties = {
  color: "var(--color-text)",
  fontWeight: 500,
};

const chipRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "12px",
};

const chipStyle: React.CSSProperties = {
  display: "inline-block",
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  background: "var(--color-pale-green)",
  color: "var(--color-olive)",
  borderRadius: "var(--radius-pill)",
  padding: "4px 12px",
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatCoordinate(lat: number, lon: number): string {
  const latLabel = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
  const lonLabel = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
  return `${latLabel}, ${lonLabel}`;
}

export default function AppHeader({ fieldProfile }: AppHeaderProps) {
  const locationLabel =
    fieldProfile.location_name ?? formatCoordinate(fieldProfile.location.latitude, fieldProfile.location.longitude);

  return (
    <header style={headerStyle}>
      <div style={innerStyle}>
        <div style={barStyle}>
          <p style={wordmarkStyle}>Ground Radar</p>
          <nav style={navStyle}>
            <span style={navItemInertStyle}>Dashboard</span>
            <span style={navItemInertStyle}>Results</span>
            <span style={navItemActiveStyle}>Simulation</span>
          </nav>
          <button
            style={backButtonStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-olive-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-olive)")}
          >
            Back to results
          </button>
        </div>

        <p style={breadcrumbRowStyle}>
          <span style={breadcrumbMutedStyle}>Results</span>
          <span style={breadcrumbMutedStyle}> › </span>
          <span style={breadcrumbCurrentStyle}>Simulation</span>
        </p>

        <div style={chipRowStyle}>
          <span style={chipStyle}>{locationLabel}</span>
          <span style={chipStyle}>{fieldProfile.area_acres} acres</span>
          <span style={chipStyle}>{capitalize(fieldProfile.mode)} mode</span>
          <span style={chipStyle}>{capitalize(fieldProfile.soil.texture_class)} soil</span>
        </div>
      </div>
    </header>
  );
}
