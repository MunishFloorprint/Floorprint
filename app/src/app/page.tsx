import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { count: buildingsCount } = await supabase
    .from('buildings')
    .select('*', { count: 'exact', head: true })

  const { count: floorsCount } = await supabase
    .from('floors')
    .select('*', { count: 'exact', head: true })

  const { count: componentsCount } = await supabase
    .from('components')
    .select('*', { count: 'exact', head: true })

  const { count: matchesCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })

  return (
    <main style={{ padding: '4rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        floorprint<span style={{ color: '#C9531C' }}>.</span>
      </h1>
      <p style={{ color: '#666', marginBottom: '3rem' }}>
        Operating system for office circularity
      </p>

      <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Live from the database:</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        <div style={{ padding: '1.5rem', border: '1px solid #E5E5E5', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buildings</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem' }}>{buildingsCount}</div>
        </div>
        <div style={{ padding: '1.5rem', border: '1px solid #E5E5E5', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Floors</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem' }}>{floorsCount}</div>
        </div>
        <div style={{ padding: '1.5rem', border: '1px solid #E5E5E5', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Components</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem' }}>{componentsCount}</div>
        </div>
        <div style={{ padding: '1.5rem', border: '1px solid #E5E5E5', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matches</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem' }}>{matchesCount}</div>
        </div>
      </div>

      <p style={{ color: '#999', fontSize: '0.875rem', marginTop: '3rem' }}>
        Numbers above are live from Supabase. Prototype v0.1.
      </p>
    </main>
  )
}