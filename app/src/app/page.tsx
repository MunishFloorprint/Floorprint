import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Building = {
  id: string
  address: string
  district: string
  floors_count: number
  total_sqm: number
  occupancy_pct: number
}

type ActivityEvent = {
  id: string
  ts: string
  title: string
  detail: string
  highlighted: boolean
}

async function loadDashboardData() {
  const { data: matches } = await supabase
    .from('matches')
    .select('id, value_eur, carbon_avoided_kg, status, matched_at, destination_tenancy_id, component_id')

  const { data: components } = await supabase
    .from('components')
    .select('id, tenancy_id, lifecycle_state, embodied_carbon_kg')

  const { data: tenancies } = await supabase
    .from('tenancies')
    .select('id, floor_id, tenant_name, status')

  const { data: buildings } = await supabase
    .from('buildings')
    .select('id, address, district, floors_count, total_sqm, occupancy_pct')
    .order('address')

  const { data: floors } = await supabase
    .from('floors')
    .select('id, building_id, floor_number, floor_label, sqm, status')

  return {
    matches: matches || [],
    components: components || [],
    tenancies: tenancies || [],
    buildings: (buildings || []) as Building[],
    floors: floors || [],
  }
}

function computeKPIs(data: Awaited<ReturnType<typeof loadDashboardData>>) {
  const totalCarbonKg = data.matches.reduce((s, m) => s + Number(m.carbon_avoided_kg || 0), 0)
  const totalValueEur = data.matches.reduce((s, m) => s + Number(m.value_eur || 0), 0)
  const tonnesDiverted = Math.round(totalCarbonKg / 1000 * 100) / 100

  const disassemblyFloorIds = new Set(
    data.floors.filter(f => f.status === 'disassembly').map(f => f.id)
  )

  const inMatching = data.components.filter(c => c.lifecycle_state === 'in_matching').length

  return {
    tonnesDiverted,
    tonnesCo2e: Math.round(totalCarbonKg),
    activeIntercepts: disassemblyFloorIds.size,
    inventoryValueM: Math.round(totalValueEur / 1000) / 1000,
    inMatching,
  }
}

function computeBuildingStats(
  building: Building,
  data: Awaited<ReturnType<typeof loadDashboardData>>
) {
  const buildingFloorIds = new Set(
    data.floors.filter(f => f.building_id === building.id).map(f => f.id)
  )

  const buildingTenancyIds = new Set(
    data.tenancies.filter(t => buildingFloorIds.has(t.floor_id)).map(t => t.id)
  )

  const buildingComponents = data.components.filter(c => buildingTenancyIds.has(c.tenancy_id))

  const buildingMatches = data.matches.filter(m => {
    const comp = data.components.find(c => c.id === m.component_id)
    return comp && buildingTenancyIds.has(comp.tenancy_id)
  })

  const carbonKg = buildingMatches.reduce((s, m) => s + Number(m.carbon_avoided_kg || 0), 0)
  const diverted = Math.round(carbonKg / 1000 * 10) / 10

  const activeFloors = data.floors.filter(
    f => f.building_id === building.id && f.status === 'disassembly'
  ).length

  const upcomingFloors = data.floors.filter(
    f => f.building_id === building.id && (f.status === 'leasing_soon' || f.status === 'disassembly')
  )
  const upcomingSqm = upcomingFloors.reduce((s, f) => s + Number(f.sqm || 0), 0)

  const inMatching = buildingComponents.filter(c => c.lifecycle_state === 'in_matching').length

  return {
    diverted,
    activeFloors,
    upcomingFloorsCount: upcomingFloors.length,
    upcomingSqm,
    inMatching,
    carbonTonnes: Math.round(carbonKg / 1000),
  }
}

function buildActivityFeed(data: Awaited<ReturnType<typeof loadDashboardData>>): ActivityEvent[] {
  const events: ActivityEvent[] = []

  const matchesByDest = new Map<string, typeof data.matches>()
  for (const m of data.matches) {
    if (!matchesByDest.has(m.destination_tenancy_id)) matchesByDest.set(m.destination_tenancy_id, [])
    matchesByDest.get(m.destination_tenancy_id)!.push(m)
  }

  for (const [destTenancyId, ms] of matchesByDest.entries()) {
    const destTenancy = data.tenancies.find(t => t.id === destTenancyId)
    if (!destTenancy) continue
    const destFloor = data.floors.find(f => f.id === destTenancy.floor_id)
    const destBuilding = destFloor ? data.buildings.find(b => b.id === destFloor.building_id) : null
    const value = ms.reduce((s, m) => s + Number(m.value_eur || 0), 0)
    events.push({
      id: `match-${destTenancyId}`,
      ts: ms[0].matched_at,
      title: `${ms.length} components matched`,
      detail: `→ ${destTenancy.tenant_name}${destBuilding ? ` (${destBuilding.address})` : ''} · €${value.toLocaleString('de-DE')} value`,
      highlighted: false,
    })
  }

  events.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
  return events.slice(0, 5)
}

// ─────────────────────────────────────────────────────────────
// Format a timestamp as a relative human string (e.g. "2 days ago")
// ─────────────────────────────────────────────────────────────
function relativeTime(ts: string): string {
  if (!ts) return ''
  const then = new Date(ts).getTime()
  const now = Date.now()
  const diffSec = Math.max(0, Math.round((now - then) / 1000))
  if (diffSec < 60) return 'just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay === 1) return 'yesterday'
  if (diffDay < 7) return `${diffDay} days ago`
  const diffWeek = Math.round(diffDay / 7)
  if (diffWeek < 5) return `${diffWeek} week${diffWeek === 1 ? '' : 's'} ago`
  const diffMonth = Math.round(diffDay / 30)
  if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? '' : 's'} ago`
  return 'over a year ago'
}

const fmt = (n: number) => n.toLocaleString('de-DE')

export default async function Home() {
  const data = await loadDashboardData()
  const kpi = computeKPIs(data)
  const activity = buildActivityFeed(data)

  return (
    <main style={{ background: '#fff', minHeight: '100vh', color: '#0A0A0A', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header style={{ borderBottom: '1px solid #E8E8E8', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0' }}>
          <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.01em' }}>floorprint</span>
          <span style={{ width: 6, height: 6, background: '#C9531C', display: 'inline-block', marginLeft: 2, marginBottom: 2 }}></span>
        </div>
        <div style={{ fontSize: 12, color: '#6B6B6B' }}>Aroundtown · Berlin portfolio</div>
      </header>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '2rem 1.5rem' }}>

        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: 11, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.5rem' }}>Portfolio overview</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>Berlin office portfolio · YTD 2026</h1>
          <p style={{ fontSize: 14, color: '#6B6B6B', marginTop: 4 }}>
            Verified circular interventions across {data.buildings.length} buildings · {data.floors.length} floors · {fmt(data.buildings.reduce((s, b) => s + Number(b.total_sqm || 0), 0))} m²
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
          <KpiCard label="Material diverted" value={`${kpi.tonnesDiverted}`} unit="t" tag="LIVE" />
          <KpiCard label="Scope 3 avoided" value={fmt(kpi.tonnesCo2e)} unit="kgCO₂e" tag="CSRD READY" />
          <KpiCard label="Active intercepts" value={`${kpi.activeIntercepts}`} unit="floors" />
          <KpiCard label="Components in matching" value={`${kpi.inMatching}`} unit="items" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '2rem' }}>
          <Link href="/matching" style={{ display: 'block', padding: '14px 18px', background: '#fff', border: '1px solid #E8E8E8', borderRadius: 10, textDecoration: 'none', color: 'inherit' }}>
            <p style={{ fontSize: 10, color: '#C9531C', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, margin: 0 }}>Matching engine</p>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '4px 0 0 0' }}>Find components for an incoming brief →</p>
          </Link>
          <Link href="/reports/csrd" style={{ display: 'block', padding: '14px 18px', background: '#fff', border: '1px solid #E8E8E8', borderRadius: 10, textDecoration: 'none', color: 'inherit' }}>
            <p style={{ fontSize: 10, color: '#C9531C', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, margin: 0 }}>CSRD report</p>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '4px 0 0 0' }}>Open Q3 disclosure draft →</p>
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>

          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 1rem 0' }}>Buildings</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.buildings.map(b => {
                const stats = computeBuildingStats(b, data)
                return (
                  <Link key={b.id} href={`/buildings/${b.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <BuildingCard building={b} stats={stats} />
                  </Link>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: '#0A0A0A', color: '#fff', padding: '1.25rem', borderRadius: 12 }}>
              <p style={{ fontSize: 10, color: '#C9531C', fontWeight: 700, letterSpacing: '0.08em', margin: 0, marginBottom: 12 }}>CSRD · ESRS E1</p>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, marginBottom: 4 }}>Q3 disclosure draft ready</h3>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, margin: 0, marginBottom: 16 }}>
                {fmt(kpi.tonnesCo2e)} kgCO₂e Scope 3 reduction documented per EN 15978. Awaiting EY review.
              </p>
              <Link href="/reports/csrd" style={{ display: 'block', width: '100%', background: '#fff', color: '#0A0A0A', fontSize: 12, fontWeight: 600, padding: '0.5rem', borderRadius: 6, textAlign: 'center', textDecoration: 'none' }}>
                Open draft report →
              </Link>
            </div>

            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 1rem 0' }}>Recent activity</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {activity.map(e => <ActivityRow key={e.id} event={e} />)}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #E8E8E8', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA0A8' }}>
          <span>Floorprint · Live data · v0.8</span>
          <span>EN 15978 · ESRS E1 · DIN SPEC 91484</span>
        </div>
      </div>
    </main>
  )
}

function KpiCard({ label, value, unit, tag }: { label: string; value: string; unit: string; tag?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E8E8E8', borderRadius: 12, padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</span>
        {tag && <span style={{ fontSize: 10, color: '#C9531C', fontWeight: 600, background: '#FBEDE4', padding: '2px 6px', borderRadius: 4 }}>{tag}</span>}
      </div>
      <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}<span style={{ fontSize: 14, color: '#6B6B6B', fontWeight: 500, marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  )
}

function BuildingCard({ building, stats }: { building: Building; stats: ReturnType<typeof computeBuildingStats> }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E8E8E8', borderRadius: 12, padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{building.district}</span>
            {stats.activeFloors > 0 && (
              <span style={{ fontSize: 10, color: '#C9531C', fontWeight: 600, background: '#FBEDE4', padding: '2px 6px', borderRadius: 4 }}>{stats.activeFloors} ACTIVE</span>
            )}
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>{building.address}</h3>
          <p style={{ fontSize: 12, color: '#6B6B6B', marginTop: 2 }}>
            {building.floors_count} floors · {fmt(building.total_sqm)} m² · {building.occupancy_pct}% occupancy
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
            {stats.diverted}<span style={{ fontSize: 12, color: '#6B6B6B', fontWeight: 500, marginLeft: 4 }}>t</span>
          </div>
          <p style={{ fontSize: 10, color: '#6B6B6B', marginTop: 4 }}>YTD diverted</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', paddingTop: 16, borderTop: '1px solid #E8E8E8' }}>
        <Stat label="Upcoming lease ends" value={`${stats.upcomingFloorsCount} floors`} sub={`${fmt(stats.upcomingSqm)} m²`} />
        <Stat label="In matching" value={`${stats.inMatching} components`} sub="ready to reuse" />
        <Stat label="Scope 3 YTD" value={`${stats.carbonTonnes} tCO₂e`} sub="EN 15978" highlight />
      </div>
    </div>
  )
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: 0, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11, color: highlight ? '#C9531C' : '#6B6B6B', margin: 0 }}>{sub}</p>
    </div>
  )
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ width: 8, height: 8, background: '#C9531C', borderRadius: '50%', marginTop: 6, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, color: '#6B6B6B', margin: 0 }}>{relativeTime(event.ts)}</p>
        <p style={{ fontSize: 13, lineHeight: 1.4, margin: '2px 0 0 0' }}>
          <span style={{ fontWeight: 600 }}>{event.title}</span>
        </p>
        <p style={{ fontSize: 11, color: '#6B6B6B', margin: '2px 0 0 0' }}>{event.detail}</p>
      </div>
    </div>
  )
}