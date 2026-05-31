import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

async function loadBuildingData(buildingId: string) {
  const { data: building } = await supabase
    .from('buildings')
    .select('*')
    .eq('id', buildingId)
    .single()

  if (!building) return null

  const { data: floors } = await supabase
    .from('floors')
    .select('*')
    .eq('building_id', buildingId)
    .order('floor_number', { ascending: false })

  const floorIds = (floors || []).map(f => f.id)

  const { data: tenancies } = await supabase
    .from('tenancies')
    .select('*')
    .in('floor_id', floorIds.length > 0 ? floorIds : ['00000000-0000-0000-0000-000000000000'])

  const tenancyIds = (tenancies || []).map(t => t.id)

  const { data: components } = await supabase
    .from('components')
    .select('*')
    .in('tenancy_id', tenancyIds.length > 0 ? tenancyIds : ['00000000-0000-0000-0000-000000000000'])

  const componentIds = (components || []).map(c => c.id)

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .in('component_id', componentIds.length > 0 ? componentIds : ['00000000-0000-0000-0000-000000000000'])

  return {
    building,
    floors: floors || [],
    tenancies: tenancies || [],
    components: components || [],
    matches: matches || [],
  }
}

const fmt = (n: number) => n.toLocaleString('de-DE')

function getFloorStyle(status: string) {
  switch (status) {
    case 'disassembly':
      return { background: '#C9531C', color: '#fff', border: '1px solid #C9531C' }
    case 'incoming':
      return { background: '#FBEDE4', color: '#0A0A0A', border: '1px solid #C9531C' }
    case 'awaiting_tenant':
      return { background: '#fff', color: '#0A0A0A', border: '1px dashed #C9531C' }
    case 'leasing_soon':
      return { background: '#FDF7F3', color: '#0A0A0A', border: '1px solid #E8E8E8' }
    case 'amenity':
      return { background: '#F5F5F5', color: '#6B6B6B', border: '1px solid #E8E8E8' }
    default:
      return { background: '#fff', color: '#0A0A0A', border: '1px solid #E8E8E8' }
  }
}

const STATUS_LABEL: Record<string, string> = {
  disassembly: 'Disassembly',
  incoming: 'Incoming',
  awaiting_tenant: 'Awaiting',
  leasing_soon: 'Leasing soon',
  amenity: 'Amenity',
  leased: 'Leased',
}

export default async function BuildingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await loadBuildingData(id)
  if (!data) notFound()

  const { building, floors, tenancies, components, matches } = data

  const activeFloor = floors.find(f => f.status === 'disassembly')
  const activeTenancy = activeFloor ? tenancies.find(t => t.floor_id === activeFloor.id && t.status === 'vacating') : null
  const activeFloorComponents = activeTenancy ? components.filter(c => c.tenancy_id === activeTenancy.id) : []

  const buildingTenancyIds = new Set(tenancies.map(t => t.id))
  const inBuildingMatches = matches.filter(m => {
    const comp = components.find(c => c.id === m.component_id)
    return comp && buildingTenancyIds.has(comp.tenancy_id) && buildingTenancyIds.has(m.destination_tenancy_id)
  })

  const activeFloorMatches = activeFloorComponents.length > 0
    ? matches.filter(m => activeFloorComponents.some(c => c.id === m.component_id))
    : []

  const destinationTenancyId = activeFloorMatches[0]?.destination_tenancy_id
  const destinationTenancy = destinationTenancyId ? tenancies.find(t => t.id === destinationTenancyId) : null
  const destinationFloor = destinationTenancy ? floors.find(f => f.id === destinationTenancy.floor_id) : null

  const magicValue = activeFloorMatches.reduce((s, m) => s + Number(m.value_eur || 0), 0)
  const magicCarbon = activeFloorMatches.reduce((s, m) => s + Number(m.carbon_avoided_kg || 0), 0)

  const byCategory: Record<string, number> = {}
  for (const c of activeFloorComponents) {
    byCategory[c.category] = (byCategory[c.category] || 0) + 1
  }

  const gradeA = activeFloorComponents.filter(c => c.condition_grade === 'A').length
  const gradeB = activeFloorComponents.filter(c => c.condition_grade === 'B').length
  const gradeC = activeFloorComponents.filter(c => c.condition_grade === 'C').length

  const ytdTonnes = Math.round(matches.reduce((s, m) => s + Number(m.carbon_avoided_kg || 0), 0) / 1000 * 10) / 10
  const ytdCo2e = Math.round(matches.reduce((s, m) => s + Number(m.carbon_avoided_kg || 0), 0))

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

        <Link href="/" style={{ fontSize: 12, color: '#6B6B6B', textDecoration: 'none', marginBottom: 12, display: 'inline-block' }}>← Berlin office portfolio</Link>

        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: 11, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.5rem' }}>{building.district}</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>{building.address}</h1>
          <p style={{ fontSize: 14, color: '#6B6B6B', marginTop: 4 }}>
            {building.floors_count} floors · {fmt(building.total_sqm)} m² · {building.occupancy_pct}% occupancy
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
          <MiniStat label="Diverted YTD" value={`${ytdTonnes}`} unit="t" />
          <MiniStat label="Scope 3 avoided" value={fmt(ytdCo2e)} unit="kgCO₂e" />
          <MiniStat label="Active intercepts" value={`${floors.filter(f => f.status === 'disassembly').length}`} unit="floors" />
          <MiniStat label="In-building matches" value={`${inBuildingMatches.length}`} unit="components" highlight />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>

          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 1rem 0' }}>Building cross-section</h2>
            <p style={{ fontSize: 11, color: '#6B6B6B', margin: '0 0 12px 0' }}>Click any floor to open materials passport</p>
            <div style={{ background: '#FAFAFA', padding: 8, borderRadius: 12, border: '1px solid #E8E8E8' }}>
              {floors.map(f => {
                const fStyle = getFloorStyle(f.status)
                const tenancy = tenancies.find(t => t.floor_id === f.id && (t.status === 'active' || t.status === 'vacating' || t.status === 'incoming'))
                const tenantName = tenancy?.tenant_name || (f.status === 'awaiting_tenant' ? '— vacant —' : (f.status === 'amenity' ? (f.floor_number === 0 ? 'Lobby + retail' : 'Roof terrace') : '—'))
                return (
                  <Link
                    key={f.id}
                    href={`/floors/${f.id}`}
                    style={{
                      ...fStyle,
                      padding: '0 10px',
                      height: 34,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 11,
                      borderRadius: 4,
                      marginBottom: 2,
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ width: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>{f.floor_label}</span>
                    <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{tenantName}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{STATUS_LABEL[f.status] || f.status}</span>
                  </Link>
                )
              })}
              <div style={{ height: 14, background: '#1A1A1A', borderRadius: '0 0 4px 4px', marginTop: 4, opacity: 0.8 }}></div>
            </div>

            <div style={{ marginTop: 16, fontSize: 11 }}>
              <p style={{ fontSize: 10, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 8 }}>Legend</p>
              <LegendRow color="#C9531C" label="Disassembly in progress" />
              <LegendRow color="#FBEDE4" label="Incoming tenant" border="1px solid #C9531C" />
              <LegendRow color="#fff" label="Awaiting tenant" border="1px dashed #C9531C" />
              <LegendRow color="#FDF7F3" label="Lease ending soon" />
              <LegendRow color="#fff" label="Stable lease" border="1px solid #E8E8E8" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {activeFloor && activeTenancy && (
              <div style={{ background: '#fff', border: '1px solid #E8E8E8', borderRadius: 12, padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ width: 56, height: 56, background: '#C9531C', color: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', flexShrink: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', opacity: 0.8 }}>Floor</div>
                    <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{activeFloor.floor_label}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, color: '#C9531C', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, margin: 0, marginBottom: 4 }}>Active intervention</p>
                    <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>Disassembly in progress</h2>
                    <p style={{ fontSize: 13, color: '#6B6B6B', margin: 0, marginTop: 4 }}>
                      Outgoing tenant: {activeTenancy.tenant_name} · {fmt(activeFloor.sqm)} m² · Lease ended {activeTenancy.lease_end}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeFloorMatches.length > 0 && destinationTenancy && destinationFloor && (
              <div style={{ background: '#FBEDE4', border: '1px solid #C9531C', borderRadius: 12, padding: '1.5rem' }}>
                <p style={{ fontSize: 10, color: '#C9531C', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, margin: 0, marginBottom: 8 }}>In-building reuse · The magic moment</p>
                <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4, margin: 0 }}>
                  {activeFloorMatches.length} components from this floor are matched to <span style={{ color: '#C9531C' }}>Floor {destinationFloor.floor_label} · {destinationTenancy.tenant_name}</span>
                </p>
                <p style={{ fontSize: 12, color: '#6B6B6B', margin: 0, marginTop: 6 }}>
                  Same building. Same materials. Reinstall scheduled at lease start.
                </p>
                <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
                  <MagicStat label="Value retained" value={`€${fmt(magicValue)}`} />
                  <MagicStat label="Carbon avoided" value={`${fmt(Math.round(magicCarbon))} kgCO₂e`} />
                  <MagicStat label="Distance" value={`${Math.abs(destinationFloor.floor_number - activeFloor.floor_number)} floors`} />
                </div>
              </div>
            )}

            {activeFloorComponents.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #E8E8E8', borderRadius: 12, padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Components catalogued</h3>
                  <Link href={`/floors/${activeFloor!.id}`} style={{ fontSize: 11, color: '#C9531C', fontWeight: 600, textDecoration: 'none' }}>
                    View full materials passport →
                  </Link>
                </div>
                <p style={{ fontSize: 11, color: '#6B6B6B', margin: 0, marginBottom: 16 }}>A/B/C grading per DIN SPEC 91484</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                  <GradeStat number={activeFloorComponents.length} label="Total" />
                  <GradeStat number={gradeA} label="Grade A · pristine" highlight />
                  <GradeStat number={gradeB} label="Grade B · refurb" />
                  <GradeStat number={gradeC} label="Grade C · recycle" muted />
                </div>
                <p style={{ fontSize: 10, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>By category</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(byCategory).map(([cat, count]) => (
                    <span key={cat} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: '#FAFAFA', border: '1px solid #E8E8E8', fontSize: 11, fontWeight: 500 }}>
                      {cat.replace(/_/g, ' ')} <span style={{ color: '#6B6B6B', fontWeight: 600 }}>{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #E8E8E8', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA0A8' }}>
          <span>Floorprint · Live data · v0.7</span>
          <span>EN 15978 · ESRS E1 · DIN SPEC 91484</span>
        </div>
      </div>
    </main>
  )
}

function MiniStat({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div style={{ border: '1px solid #E8E8E8', borderRadius: 12, padding: '1rem' }}>
      <p style={{ fontSize: 10, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: 0, marginBottom: 6 }}>{label}</p>
      <p style={{ fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 700, lineHeight: 1, margin: 0, color: highlight ? '#C9531C' : '#0A0A0A' }}>
        {value}<span style={{ fontSize: 12, color: '#6B6B6B', fontWeight: 500, marginLeft: 4 }}>{unit}</span>
      </p>
    </div>
  )
}

function LegendRow({ color, label, border }: { color: string; label: string; border?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ width: 12, height: 12, background: color, border: border || '1px solid transparent', borderRadius: 2 }}></span>
      <span style={{ fontWeight: 500 }}>{label}</span>
    </div>
  )
}

function MagicStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: 0 }}>{label}</p>
      <p style={{ fontVariantNumeric: 'tabular-nums', fontSize: 16, fontWeight: 700, margin: 0 }}>{value}</p>
    </div>
  )
}

function GradeStat({ number, label, highlight, muted }: { number: number; label: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div>
      <p style={{ fontVariantNumeric: 'tabular-nums', fontSize: 24, fontWeight: 700, margin: 0, color: highlight ? '#C9531C' : muted ? '#6B6B6B' : '#0A0A0A' }}>{number}</p>
      <p style={{ fontSize: 10, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: '4px 0 0 0' }}>{label}</p>
    </div>
  )
}