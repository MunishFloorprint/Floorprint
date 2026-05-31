export default function Loading() {
  return (
    <main style={{ background: '#fff', minHeight: '100vh', color: '#0A0A0A', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'baseline', marginBottom: 16 }}>
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em' }}>floorprint</span>
          <span style={{ width: 8, height: 8, background: '#C9531C', display: 'inline-block', marginLeft: 3, marginBottom: 2, animation: 'fp-pulse 1.2s ease-in-out infinite' }}></span>
        </div>
        <p style={{ fontSize: 12, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, margin: 0 }}>Loading from database</p>
      </div>
      <style>{`
        @keyframes fp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.85); }
        }
      `}</style>
    </main>
  )
}