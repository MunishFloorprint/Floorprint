import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────
// THE BRIEF (hardcoded for demo — Helbling Studios incoming)
// ─────────────────────────────────────────────────────────────
const BRIEF = {
  tenantName: 'Helbling Studios',
  destinationBuildingId: '11111111-1111-1111-1111-111111111111',
  destinationFloorLabel: '12',
  destinationBuildingAddress: 'Friedrichstraße 188',
  floorAreaSqm: 1500,
  moveInDate: '2026-11-14',
  desiredCategories: ['glass_partition', 'led_panel', 'office_furniture', 'acoustic_pod', 'kitchen_module'],
  minimumGrade: 'B' as 'A' | 'B' | 'C',
}

// ─────────────────────────────────────────────────────────────
// Loader: pull all available components from the platform
// ─────────────────────────────────────────────────────────────
async function loadMatchingData() {
  // All components in matching pool (in_matching OR matched but tied to this brief)
  const { data: components } = await supabase
    .from('components')
    .select('*')
    .in('lifecycle_state', ['in_matching', 'matched'])
    .order('embodied_carbon_kg', { ascending: false })

  const tenancyIds = [...new Set((components || []).map(c => c.tenancy_id))]
  const { data: tenancies } = await supabase
    .from('tenancies')
    .select('*')
    .in('id', tenancyIds.length > 0 ? tenancyIds : ['00000000-0000-0000-0000-000000000000'])

  const floorIds = [...new Set((tenancies || []).map(t => t.floor_id))]
  const { data: floors } = await supabase
    .from('floors')
    .select('*')
    .in('id', floorIds.length > 0 ? floorIds : ['00000000-0000-0000-0000-000000000000'])

  const buildingIds = [...new Set((floors || []).map(f => f.building_id))]
  const { data: buildings } = await supabase
    .from('buildings')
    .select('*')
    .in('id', buildingIds.length > 0 ? buildingIds : ['00000000-0000-0000-0000-000000000000'])

  return {
    components: components || [],
    tenancies: tenancies || [],
    floors: floors || [],
    buildings: buildings || [],
  }
}

// ─────────────────────────────────────────────────────────────
// The matching algorithm — rule-based, deterministic, explainable
// ─────────────────────────────────────────────────────────────
type MatchScore = {
  componentId: string
  totalScore: number
  reasons: string[]
  inBuildingBonus: boolean
}

function scoreComponent(
  component: any,
  data: Awaited<ReturnType<typeof loadMatchingData>>
): MatchScore {
  let score = 0
  const reasons: string[] = []
  let inBuildingBonus = false

  // Rule 1: Category match — required
  if (BRIEF.desiredCategories.includes(component.category)) {
    score += 30
    reasons.push('Category match')
  } else {
    return { componentId: component.id, totalScore: 0, reasons: ['Not in desired categories'], inBuildingBonus: false }
  }

  // Rule 2: Grade A/B preference (A = +20, B = +12, C = +0)
  if (component.condition_grade === 'A') {
    score += 20
    reasons.push('Grade A condition')
  } else if (component.condition_grade === 'B') {
    score += 12
    reasons.push('Grade B condition')
  }

  // Rule 3: Available before move-in date (+15)
  if (component.available_from && component.available_from <= BRIEF.moveInDate) {
    score += 15
    reasons.push('Available before move-in')
  }

  // Rule 4: In-building bonus — same building as the brief (+25, the big one)
  const tenancy = data.tenancies.find(t => t.id === component.tenancy_id)
  const floor = tenancy ? data.floors.find(f => f.id === tenancy.floor_id) : null
  if (floor?.building_id === BRIEF.destinationBuildingId) {
    score += 25
    reasons.push('In-building reuse')
    inBuildingBonus = true
  }

  // Rule 5: High embodied carbon = high impact match (+10)
  if (Number(component.embodied_carbon_kg) >= 100) {
    score += 10
    reasons.push('High carbon impact')
  }

  return { componentId: component.id, totalScore: score, reasons, inBuildingBonus }
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

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default async function MatchingPage() {
  const data = await loadMatchingData()

  // Score every component
  const scoredComponents = data.components
    .map(c => ({
      component: c,
      score: scoreComponent(c, data),
    }))
    .filter(item => item.score.totalScore > 0)
    .sort((a, b) => b.score.totalScore - a.score.totalScore)

  // Top 30 results
  const topMatches = scoredComponents.slice(0, 30)

  // Stats
  const totalCarbonAvoided = topMatches.reduce((s, m) => s + Number(m.component.embodied_carbon_kg || 0), 0)
  const inBuildingMatches = topMatches.filter(m => m.score.inBuildingBonus).length
  const estimatedValue = topMatches.length * 2200 // €2,200 average per component (placeholder)
  const newBuildEquivalentValue = topMatches.length * 5500 // €5,500 per item at new cost (40% saving)

  return (
    <main style={{ background: '#fff', minHeight: '100vh', color: '#0A0A0A', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top bar */}
      <header style={{ borderBottom: '1px solid #E8E8E8', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'baseline', textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>floorprint</span>
          <span style={{ width: 6, height: 6, background: '#C9531C', display: 'inline-block', marginLeft: 2, marginBottom: 2 }}></span>
        </Link>
        <div style={{ fontSize: 12, color: '#6B6B6B' }}>Aroundtown · Berlin portfolio</div>
      </header>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '2rem 1.5rem' }}>

        <Link href="/" style={{ fontSize: 12, color: '#6B6B6B', textDecoration: 'none', marginBottom: 12, display: 'inline-block' }}>← Berlin office portfolio</Link>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: 11, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.5rem' }}>Matching engine</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>Components matched to incoming brief</h1>
          <p style={{ fontSize: 14, color: '#6B6B6B', marginTop: 4 }}>
            Rule-based engine · Reading {data.components.length} available components from inventory
          </p>
        </div>

        {/* The brief */}
        <div style={{ background: '#FBEDE4', border: '1px solid #C9531C', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: 10, color: '#C9531C', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, margin: 0, marginBottom: 8 }}>Incoming tenant brief</p>
          <p style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, margin: 0 }}>
            {BRIEF.tenantName} · Floor {BRIEF.destinationFloorLabel}, {BRIEF.destinationBuildingAddress}
          </p>
          <p style={{ fontSize: 12, color: '#6B6B6B', margin: '6px 0 0 0' }}>
            {fmt(BRIEF.floorAreaSqm)} m² · Move-in {BRIEF.moveInDate} · Categories: {BRIEF.desiredCategories.map(c => CATEGORY_LABEL[c]).join(', ')} · Min grade {BRIEF.minimumGrade}
          </p>
        </div>

        {/* Hero results */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '2rem' }}>
          <ResultStat label="Compatible components" value={`${topMatches.length}`} unit="items" />
          <ResultStat label="In-building reuse" value={`${inBuildingMatches}`} unit={`of ${topMatches.length}`} highlight />
          <ResultStat label="Embodied carbon avoided" value={fmt(Math.round(totalCarbonAvoided))} unit="kgCO₂e" />
          <ResultStat label="Estimated savings vs new" value={`€${fmt(newBuildEquivalentValue - estimatedValue)}`} unit="" />
        </div>

        {/* Scoring rules legend */}
        <div style={{ background: '#FAFAFA', border: '1px solid #E8E8E8', borderRadius: 12, padding: '1rem', marginBottom: '2rem' }}>
          <p style={{ fontSize: 10, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, margin: 0, marginBottom: 12 }}>Matching rules applied</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, fontSize: 11 }}>
            <RuleChip num="01" label="Category match" weight="+30" />
            <RuleChip num="02" label="Condition grade" weight="+0–20" />
            <RuleChip num="03" label="Lead-time fit" weight="+15" />
            <RuleChip num="04" label="In-building reuse" weight="+25" highlight />
            <RuleChip num="05" label="High carbon impact" weight="+10" />
          </div>
        </div>

        {/* Results header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Ranked matches</h2>
          <p style={{ fontSize: 12, color: '#6B6B6B', margin: 0 }}>Top {topMatches.length} · ordered by match score</p>
        </div>

        {/* Results grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {topMatches.map(({ component: c, score: s }, index) => {
            const tenancy = data.tenancies.find(t => t.id === c.tenancy_id)
            const floor = tenancy ? data.floors.find(f => f.id === tenancy.floor_id) : null
            const building = floor ? data.buildings.find(b => b.id === floor.building_id) : null

            return (
              <MatchResultCard
                key={c.id}
                rank={index + 1}
                category={CATEGORY_LABEL[c.category] || c.category}
                manufacturer={c.manufacturer || ''}
                productName={c.product_name || ''}
                dimensions={c.dimensions_text || ''}
                grade={c.condition_grade}
                photoUrl={c.photo_url}
                carbonKg={Number(c.embodied_carbon_kg || 0)}
                score={s.totalScore}
                reasons={s.reasons}
                inBuilding={s.inBuildingBonus}
                sourceBuildingAddress={building?.address || '—'}
                sourceFloorLabel={floor?.floor_label || '—'}
              />
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #E8E8E8', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA0A8' }}>
          <span>Floorprint · Live matching · v0.5</span>
          <span>EN 15978 · ESRS E1 · DIN SPEC 91484</span>
        </div>
      </div>
    </main>
  )
}

function ResultStat({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div style={{ border: '1px solid #E8E8E8', borderRadius: 12, padding: '1rem' }}>
      <p style={{ fontSize: 10, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: 0, marginBottom: 6 }}>{label}</p>
      <p style={{ fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 700, lineHeight: 1, margin: 0, color: highlight ? '#C9531C' : '#0A0A0A' }}>
        {value}{unit && <span style={{ fontSize: 12, color: '#6B6B6B', fontWeight: 500, marginLeft: 4 }}>{unit}</span>}
      </p>
    </div>
  )
}

function RuleChip({ num, label, weight, highlight }: { num: string; label: string; weight: string; highlight?: boolean }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${highlight ? '#C9531C' : '#E8E8E8'}`, borderRadius: 8, padding: '0.6rem 0.75rem' }}>
      <p style={{ fontSize: 9, color: '#6B6B6B', fontWeight: 600, margin: 0 }}>RULE {num}</p>
      <p style={{ fontSize: 11, fontWeight: 600, margin: '2px 0 0 0' }}>{label}</p>
      <p style={{ fontSize: 10, color: highlight ? '#C9531C' : '#6B6B6B', fontWeight: 700, margin: '2px 0 0 0', fontVariantNumeric: 'tabular-nums' }}>{weight}</p>
    </div>
  )
}

function MatchResultCard(props: {
  rank: number
  category: string
  manufacturer: string
  productName: string
  dimensions: string
  grade: string
  photoUrl: string | null
  carbonKg: number
  score: number
  reasons: string[]
  inBuilding: boolean
  sourceBuildingAddress: string
  sourceFloorLabel: string
}) {
  const gradeColor = props.grade === 'A' ? '#C9531C' : props.grade === 'B' ? '#0A0A0A' : '#6B6B6B'

  return (
    <div style={{ background: '#fff', border: `1px solid ${props.inBuilding ? '#C9531C' : '#E8E8E8'}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Photo */}
      <div style={{ height: 120, background: '#FAFAFA', backgroundImage: props.photoUrl ? `url(${props.photoUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
        <span style={{ position: 'absolute', top: 8, left: 8, padding: '4px 8px', borderRadius: 4, background: '#0A0A0A', color: '#fff', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          #{props.rank}
        </span>
        <span style={{ position: 'absolute', top: 8, right: 8, padding: '2px 8px', borderRadius: 4, background: '#fff', fontSize: 10, fontWeight: 700, color: gradeColor, border: `1px solid ${gradeColor}` }}>
          Grade {props.grade}
        </span>
        {props.inBuilding && (
          <span style={{ position: 'absolute', bottom: 8, left: 8, padding: '2px 8px', borderRadius: 4, background: '#C9531C', color: '#fff', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            In-building
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '0.875rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <p style={{ fontSize: 10, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: 0 }}>{props.category}</p>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#C9531C', margin: 0 }}>Score {props.score}</p>
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, margin: '4px 0 0 0' }}>{props.manufacturer} {props.productName}</p>
        <p style={{ fontSize: 11, color: '#6B6B6B', margin: '2px 0 0 0' }}>{props.dimensions}</p>
        <p style={{ fontSize: 11, color: '#6B6B6B', margin: '4px 0 0 0' }}>
          From: <span style={{ color: '#0A0A0A', fontWeight: 600 }}>{props.sourceBuildingAddress} · Floor {props.sourceFloorLabel}</span>
        </p>

        {/* Reasons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {props.reasons.map(r => (
            <span key={r} style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 999, background: r === 'In-building reuse' ? '#FBEDE4' : '#FAFAFA', color: r === 'In-building reuse' ? '#C9531C' : '#6B6B6B' }}>
              {r}
            </span>
          ))}
        </div>

        {/* Carbon at bottom */}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F5F5F5' }}>
          <p style={{ fontSize: 9, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, margin: 0 }}>Embodied carbon avoided</p>
          <p style={{ fontSize: 14, fontWeight: 700, margin: '2px 0 0 0', fontVariantNumeric: 'tabular-nums' }}>{props.carbonKg} kgCO₂e</p>
        </div>
      </div>
    </div>
  )
}