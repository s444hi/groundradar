import Disclaimer from "../Disclaimer/Disclaimer";

const footerStyle: React.CSSProperties = {
  borderTop: "1px solid var(--color-border)",
  background: "var(--color-bg-subtle)",
  marginTop: "48px",
};

const innerStyle: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  alignItems: "flex-start",
};

const dataSourceStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  color: "var(--color-text-muted)",
  margin: 0,
};

export default function AppFooter() {
  return (
    <footer style={footerStyle}>
      <div style={innerStyle}>
        <Disclaimer />
        <p style={dataSourceStyle}>Data: NASA POWER, GPM, SMAP, SRTM · SoilGrids</p>
      </div>
    </footer>
  );
}
