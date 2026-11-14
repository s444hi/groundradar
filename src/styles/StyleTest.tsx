const wrapStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-sans)',
  padding: '48px 24px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '32px',
}

const bigNumberStyle: React.CSSProperties = {
  fontFamily: 'var(--font-serif)',
  fontWeight: 400,
  letterSpacing: '-0.02em',
  fontSize: '96px',
  margin: 0,
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-cream)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-card)',
  padding: '32px',
  maxWidth: '420px',
  width: '100%',
}

const pillButtonStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  fontSize: '16px',
  background: 'var(--color-olive)',
  color: 'var(--color-text-on-dark)',
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  padding: '12px 28px',
  cursor: 'pointer',
}

const tagStyle: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  fontSize: '14px',
  background: 'var(--color-pale-green)',
  color: 'var(--color-olive)',
  borderRadius: 'var(--radius-pill)',
  padding: '6px 16px',
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

export default function StyleTest() {
  return (
    <div style={wrapStyle}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, letterSpacing: '-0.02em', fontSize: '56px', margin: 0 }}>
        Style test
      </h1>

      <button
        style={pillButtonStyle}
        onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-olive-hover)')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'var(--color-olive)')}
      >
        Find a better order
      </button>

      <div style={cardStyle}>
        <div style={labelStyle}>Rotation A · Year 1</div>
        <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text)', marginTop: '8px' }}>
          A sample card using the cream background, hairline border, and 20px radius.
        </p>
        <span style={tagStyle}>Cover crop</span>
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={bigNumberStyle}>78%</p>
        <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-muted)', margin: 0 }}>
          Overall success score
        </p>
      </div>
    </div>
  )
}
