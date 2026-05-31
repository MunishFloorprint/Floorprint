import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

async function loadFloorData(floorId: string) {
  const { data: floor } = await supabase
    .from('floors')
    .select('*')
    .eq('id', floorId)
    .single()

  if (!floor) return null

  const { data: building } = await supabase
    .from('buildings')
    .select('*')
    .eq('id', floor.building_id)
    .single()

  const { data: tenancies } = await supabase
    .from('tenancies')
    .select('*')
    .eq('floor_id', floorId)
    .order('lease_start', { ascending: false })

  const sourceTenancy = tenancies?.find(t => t.status === 'vacating') || tenancies?.[0]

  const { data: components } = await supabase
    .from('components')
    .select('*')
    .eq('tenancy_id', sourceTenancy?.id || '00000000-0000-0000-0000-000000000000')
    .order('category')

  const componentIds = (components || []).map(c => c.id)

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .in('component_id', componentIds.length > 0 ? componentIds : ['00000000-0000-0000-0000-000000000000'])

  // Resolve destination floor/building for each match
  const destTenancyIds = [...new Set((matches || []).map(m => m.destination_tenancy_id))]
  const { data: destTenancies } = await supabase
    .from('tenancies')
    .select('*')
    .in('id', destTenancyIds.length > 0 ? destTenancyIds : ['00000000-0000-0000-0000-000000000000'])

  const destFloorIds = [...new Set((destTenancies || []).map(t => t.floor_id))]
  const { data: destFloors } = await supabase
    .from('floors')
    .select('*')
    .in('id', destFloorIds.length > 0 ? destFloorIds : ['00000000-0000-0000-0000-000000000000'])

  return {
    floor,
    building,
    tenancy: sourceTenancy,
    components: components || [],
    matches: matches || [],
    destTenancies: destTenancies || [],
    destFloors: destFloors || [],
  }
}

const fmt = (n: number) => n.toLocaleString('de-DE')

const CATEGORY_LABEL: Record<string, string> = {
  glass_partition: 'Glass partition',
  led_panel: 'LED panel',
  office_furniture: 'Office furniture',
  acoustic_pod: 'Acoustic pod',
  kitchen_module: 'Kitchen module',
  carpet_tile: 'Carpet tile',
  other: 'Other',
}

const LIFECYCLE_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  catalogued: { label: 'Catalogued', color: '#6B6B6B', bg: '#FAFAFA' },
  in_matching: { label: 'In matching', color: '#0A0A0A', bg: '#FAFAFA' },
  matched: { label: 'Matched', color: '#C9531C', bg: '#FBEDE4' },
  reinstalled: { label: 'Reinstalled', color: '#fff', bg: '#C9531C' },
  retired: { label: 'Retired', color: '#6B6B6B', bg: '#F5F5F5' },
}

export default async function FloorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await loadFloorData(id)
  if (!data) notFound()

  const { floor, building, tenancy, components, matches, destTenancies, destFloors } = data

  // For each component, find its match destination (if any)
  const componentMatchInfo = components.map(c => {
    const match = matches.find(m => m.component_id === c.id)
    const destTenancy = match ? destTenancies.find(t => t.id === match.destination_tenancy_id) : null
    const destFloor = destTenancy ? destFloors.find(f => f.id === destTenancy.floor_id) : null
    return { component: c, match, destTenancy, destFloor }
  })

  // Stats
  const totalCarbon = components.reduce((s, c) => s + Number(c.embodied_carbon_kg || 0), 0)
  const totalValue = matches.reduce((s, m) => s + Number(m.value_eur || 0), 0)
  const matchedCount = components.filter(c => c.lifecycle_state === 'matched').length
  const inMatchingCount = components.filter(c => c.lifecycle_state === 'in_matching').length

  const gradeA = components.filter(c => c.condition_grade === 'A').length
  const gradeB = components.filter(c => c.condition_grade === 'B').length
  const gradeC = components.filter(c => c.condition_grade === 'C').length

  // Categories present
  const categoryCounts: Record<string, number> = {}
  for (const c of components) {
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1
  }

  return (
    <main style={{ background: '#fff', minHeight: '100vh', color: '#0A0A0A', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header style={{ borderBottom: '1px solid #E8E8E8', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'baseline', textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>floorprint</span>
          <span style={{ width: 6, height: 6, background: '#C9531C', display: 'inline-block', marginLeft: 2, marginBottom: 2 }}></span>
        </Link>
        <div style={{ fontSize: 12, color: '#6B6B6B' }}>Aroundtown · Berlin portfolio</div>
      </header>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: '#6B6B6B', marginBottom: 12 }}>
          <Link href="/" style={{ color: '#6B6B6B', textDecoration: 'none' }}>Berlin office portfolio</Link>
          {' › '}
          <Link href={`/buildings/${building?.id}`} style={{ color: '#6B6B6B', textDecoration: 'none' }}>{building?.address}</Link>
          {' › '}
          <span style={{ color: '#0A0A0A' }}>Floor {floor.floor_label}</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: 11, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.5rem' }}>
            Materials passport · Floor {floor.floor_label}
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>
            {tenancy?.tenant_name || 'Floor inventory'}
          </h1>
          <p style={{ fontSize: 14, color: '#6B6B6B', marginTop: 4 }}>
            {building?.address} · {fmt(floor.sqm || 0)} m²
            {tenancy?.lease_end && ` · Lease ended ${tenancy.lease_end}`}
          </p>
        </div>

        {/* Hero stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '2rem' }}>
          <Stat label="Total components" value={`${components.length}`} unit="items" />
          <Stat label="Embodied carbon" value={fmt(Math.round(totalCarbon))} unit="kgCO₂e" />
          <Stat label="Matched" value={`${matchedCount}`} unit={`of ${components.length}`} highlight />
          <Stat label="Value retained" value={`€${fmt(Math.round(totalValue))}`} unit="" />
        </div>

        {/* Grade breakdown + Category chips */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 16, marginBottom: '2rem' }}>
          <div style={{ background: '#fff', border: '1px solid #E8E8E8', borderRadius: 12, padding: '1.25rem' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, marginBottom: 4 }}>Condition grading</h3>
            <p style={{ fontSize: 11, color: '#6B6B6B', margin: 0, marginBottom: 16 }}>Per DIN SPEC 91484</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <GradeBox grade="A" label="Pristine" count={gradeA} highlight />
              <GradeBox grade="B" label="Refurb" count={gradeB} />
              <GradeBox grade="C" label="Recycle" count={gradeC} muted />
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #E8E8E8', borderRadius: 12, padding: '1.25rem' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, marginBottom: 4 }}>Categories present</h3>
            <p style={{ fontSize: 11, color: '#6B6B6B', margin: 0, marginBottom: 16 }}>Component types catalogued from this floor</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(categoryCounts).map(([cat, count]) => (
                <span key={cat} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: '#FAFAFA', border: '1px solid #E8E8E8', fontSize: 11, fontWeight: 500 }}>
                  {CATEGORY_LABEL[cat] || cat} <span style={{ color: '#6B6B6B', fontWeight: 700 }}>{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Component grid */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Component inventory</h2>
            <p style={{ fontSize: 12, color: '#6B6B6B', margin: 0 }}>{components.length} items · live from database</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {componentMatchInfo.map(({ component: c, match, destTenancy, destFloor }) => (
              <ComponentCard
                key={c.id}
                category={CATEGORY_LABEL[c.category] || c.category}
                manufacturer={c.manufacturer || ''}
                productName={c.product_name || ''}
                dimensions={c.dimensions_text || ''}
                grade={c.condition_grade}
                photoUrl={c.photo_url}
                carbonKg={Number(c.embodied_carbon_kg || 0)}
                lifecycleState={c.lifecycle_state}
                availableFrom={c.available_from}
                matchValue={match ? Number(match.value_eur || 0) : 0}
                destTenant={destTenancy?.tenant_name}
                destFloorLabel={destFloor?.floor_label}
                destInSameBuilding={destFloor?.building_id === building?.id}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #E8E8E8', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA0A8' }}>
          <span>Floorprint · Live data · v0.4</span>
          <span>EN 15978 · ESRS E1 · DIN SPEC 91484</span>
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div style={{ border: '1px solid #E8E8E8', borderRadius: 12, padding: '1rem' }}>
      <p style={{ fontSize: 10, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: 0, marginBottom: 6 }}>{label}</p>
      <p style={{ fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 700, lineHeight: 1, margin: 0, color: highlight ? '#C9531C' : '#0A0A0A' }}>
        {value}{unit && <span style={{ fontSize: 12, color: '#6B6B6B', fontWeight: 500, marginLeft: 4 }}>{unit}</span>}
      </p>
    </div>
  )
}

function GradeBox({ grade, label, count, highlight, muted }: { grade: string; label: string; count: number; highlight?: boolean; muted?: boolean }) {
  return (
    <div style={{ border: '1px solid #E8E8E8', borderRadius: 8, padding: '0.75rem', textAlign: 'center' }}>
      <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: highlight ? '#C9531C' : muted ? '#6B6B6B' : '#0A0A0A' }}>{grade}</p>
      <p style={{ fontSize: 18, fontWeight: 700, margin: '4px 0 0 0', fontVariantNumeric: 'tabular-nums' }}>{count}</p>
      <p style={{ fontSize: 10, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: '4px 0 0 0' }}>{label}</p>
    </div>
  )
}

function ComponentCard(props: {
  category: string
  manufacturer: string
  productName: string
  dimensions: string
  grade: string
  photoUrl: string | null
  carbonKg: number
  lifecycleState: string
  availableFrom: string | null
  matchValue: number
  destTenant?: string
  destFloorLabel?: string
  destInSameBuilding?: boolean
}) {
  const lifecycle = LIFECYCLE_LABEL[props.lifecycleState] || LIFECYCLE_LABEL.catalogued
  const gradeColor = props.grade === 'A' ? '#C9531C' : props.grade === 'B' ? '#0A0A0A' : '#6B6B6B'

  return (
    <div style={{ background: '#fff', border: '1px solid #E8E8E8', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Photo */}
      <div style={{ height: 140, background: '#FAFAFA', backgroundImage: props.photoUrl ? `url(${props.photoUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
        <span style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', borderRadius: 4, background: '#fff', fontSize: 10, fontWeight: 700, color: gradeColor, border: `1px solid ${gradeColor}` }}>
          Grade {props.grade}
        </span>
        <span style={{ position: 'absolute', top: 8, right: 8, padding: '2px 8px', borderRadius: 4, background: lifecycle.bg, color: lifecycle.color, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {lifecycle.label}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '0.875rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <p style={{ fontSize: 10, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: 0 }}>{props.category}</p>
        <p style={{ fontSize: 13, fontWeight: 700, margin: '4px 0 0 0' }}>{props.manufacturer} {props.productName}</p>
        <p style={{ fontSize: 11, color: '#6B6B6B', margin: '2px 0 0 0' }}>{props.dimensions}</p>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid #F5F5F5' }}>
          <div>
            <p style={{ fontSize: 9, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, margin: 0 }}>Embodied carbon</p>
            <p style={{ fontSize: 12, fontWeight: 700, margin: '2px 0 0 0', fontVariantNumeric: 'tabular-nums' }}>{props.carbonKg} kgCO₂e</p>
          </div>
          {props.matchValue > 0 && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 9, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, margin: 0 }}>Value</p>
              <p style={{ fontSize: 12, fontWeight: 700, margin: '2px 0 0 0', fontVariantNumeric: 'tabular-nums', color: '#C9531C' }}>€{props.matchValue}</p>
            </div>
          )}
        </div>

        {/* Match destination */}
        {props.destTenant && props.destFloorLabel && (
          <div style={{ marginTop: 10, padding: '6px 10px', background: props.destInSameBuilding ? '#FBEDE4' : '#FAFAFA', border: `1px solid ${props.destInSameBuilding ? '#C9531C' : '#E8E8E8'}`, borderRadius: 6 }}>
            <p style={{ fontSize: 9, color: props.destInSameBuilding ? '#C9531C' : '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, margin: 0 }}>
              → {props.destInSameBuilding ? 'In-building reuse' : 'Cross-building match'}
            </p>
            <p style={{ fontSize: 11, fontWeight: 600, margin: '2px 0 0 0' }}>Floor {props.destFloorLabel} · {props.destTenant}</p>
          </div>
        )}
      </div>
    </div>
  )
}