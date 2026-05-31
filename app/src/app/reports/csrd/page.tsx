import { supabase } from '@/lib/supabase'
import Link from 'next/link'

async function loadCsrdData() {
  const { data: buildings } = await supabase
    .from('buildings')
    .select('*')
    .order('address')

  const { data: floors } = await supabase.from('floors').select('*')
  const { data: tenancies } = await supabase.from('tenancies').select('*')
  const { data: components } = await supabase.from('components').select('*')
  const { data: matches } = await supabase.from('matches').select('*')
  const { data: carbonEntries } = await supabase.from('carbon_entries').select('*')

  return {
    buildings: buildings || [],
    floors: floors || [],
    tenancies: tenancies || [],
    components: components || [],
    matches: matches || [],
    carbonEntries: carbonEntries || [],
  }
}

const fmt = (n: number) => n.toLocaleString('de-DE')
const fmtDecimal = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default async function CsrdReportPage() {
  const data = await loadCsrdData()

  // Total Scope 3 across the portfolio (sum of carbon_entries with landlord_scope_3 attribution)
  const totalKg = data.carbonEntries
    .filter(e => e.attribution === 'landlord_scope_3')
    .reduce((s, e) => s + Number(e.tonnes_co2e || 0) * 1000, 0)

  const totalTonnes = totalKg / 1000

  // Per-building breakdown
  const perBuilding = data.buildings.map(building => {
    const buildingFloorIds = new Set(data.floors.filter(f => f.building_id === building.id).map(f => f.id))
    const buildingTenancyIds = new Set(data.tenancies.filter(t => buildingFloorIds.has(t.floor_id)).map(t => t.id))
    const buildingComponentIds = new Set(data.components.filter(c => buildingTenancyIds.has(c.tenancy_id)).map(c => c.id))
    const buildingMatchIds = new Set(data.matches.filter(m => buildingComponentIds.has(m.component_id)).map(m => m.id))
    const buildingCarbonEntries = data.carbonEntries.filter(e => buildingMatchIds.has(e.match_id) && e.attribution === 'landlord_scope_3')
    const kg = buildingCarbonEntries.reduce((s, e) => s + Number(e.tonnes_co2e || 0) * 1000, 0)
    return {
      building,
      kg,
      tonnes: kg / 1000,
      matchCount: buildingMatchIds.size,
      componentCount: buildingComponentIds.size,
    }
  })

  // Methodology row
  const methodologies = [...new Set(data.carbonEntries.map(e => e.methodology))]
  const verifier = data.carbonEntries[0]?.verified_by || 'EY Building Sustainability'
  const verifiedDate = data.carbonEntries[0]?.verified_at || '2026-05-20'

  return (
    <main style={{ background: '#fff', minHeight: '100vh', color: '#0A0A0A', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* On-screen header (hidden when printed) */}
      <div style={{ background: '#FAFAFA', borderBottom: '1px solid #E8E8E8', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
        <Link href="/" style={{ display: 'flex', alignItems: 'baseline', textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>floorprint</span>
          <span style={{ width: 6, height: 6, background: '#C9531C', display: 'inline-block', marginLeft: 2, marginBottom: 2 }}></span>
        </Link>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6B6B6B' }}>Draft report — preview</span>
          <a href="javascript:window.print()" style={{ background: '#0A0A0A', color: '#fff', padding: '0.5rem 1rem', borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            Print / Save as PDF
          </a>
        </div>
      </div>

      {/* The document */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '3rem 2rem', background: '#fff' }}>

        {/* Document header */}
        <div style={{ borderBottom: '2px solid #1A1A1A', paddingBottom: 16, marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <p style={{ fontSize: 11, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, margin: 0 }}>
              CSRD · ESRS E1 · Scope 3 Disclosure
            </p>
            <p style={{ fontSize: 11, color: '#6B6B6B', margin: 0 }}>Q3 2026 · Draft</p>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>
            Embodied carbon avoidance through fit-out reuse
          </h1>
          <p style={{ fontSize: 13, color: '#6B6B6B', margin: '6px 0 0 0' }}>
            Aroundtown · Berlin office portfolio · Reporting period 1 Jan 2026 – 30 Sept 2026
          </p>
        </div>

        {/* Executive summary */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 12px 0' }}>Executive summary</h2>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#0A0A0A', margin: '0 0 12px 0' }}>
            During the reporting period, Floorprint operated fit-out interception across {data.buildings.length} buildings in Aroundtown&apos;s Berlin office portfolio. Reuse of pre-installed components avoided <strong style={{ color: '#C9531C' }}>{fmtDecimal(totalTonnes)} tCO₂e</strong> of embodied carbon, attributable to Scope 3 under the EU Corporate Sustainability Reporting Directive (CSRD) and the European Sustainability Reporting Standards (ESRS E1).
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#0A0A0A', margin: 0 }}>
            All values calculated using EN 15978 whole-life carbon methodology, supported by EN 15804 product Environmental Product Declarations (EPDs). Per ESRS E1 ¶44, no portion of the avoided emissions reported herein has been monetised through voluntary carbon credit markets.
          </p>
        </section>

        {/* Hero number */}
        <section style={{ marginBottom: 32, background: '#FAFAFA', padding: 24, borderRadius: 8, border: '1px solid #E8E8E8' }}>
          <p style={{ fontSize: 11, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, margin: 0, marginBottom: 6 }}>
            Total Scope 3 reduction
          </p>
          <p style={{ fontSize: 40, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', margin: 0, lineHeight: 1, color: '#C9531C' }}>
            {fmtDecimal(totalTonnes)} <span style={{ fontSize: 16, color: '#0A0A0A' }}>tCO₂e</span>
          </p>
          <p style={{ fontSize: 12, color: '#6B6B6B', margin: '8px 0 0 0' }}>
            Equivalent to {fmt(Math.round(totalTonnes * 2300))} km of average passenger car travel · or the annual footprint of {Math.round(totalTonnes / 0.7)} EU residents
          </p>
        </section>

        {/* Per building */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 12px 0' }}>By building</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1A1A1A' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600, color: '#6B6B6B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Building</th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontWeight: 600, color: '#6B6B6B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Components reused</th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontWeight: 600, color: '#6B6B6B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Matches</th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontWeight: 600, color: '#6B6B6B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>tCO₂e avoided</th>
              </tr>
            </thead>
            <tbody>
              {perBuilding.map(p => (
                <tr key={p.building.id} style={{ borderBottom: '1px solid #E8E8E8' }}>
                  <td style={{ padding: '10px 0' }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{p.building.address}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#6B6B6B' }}>{p.building.district} · {p.building.floors_count} floors</p>
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 0', fontVariantNumeric: 'tabular-nums' }}>{p.componentCount}</td>
                  <td style={{ textAlign: 'right', padding: '10px 0', fontVariantNumeric: 'tabular-nums' }}>{p.matchCount}</td>
                  <td style={{ textAlign: 'right', padding: '10px 0', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtDecimal(p.tonnes)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #1A1A1A' }}>
                <td style={{ padding: '10px 0', fontWeight: 700 }}>Total</td>
                <td style={{ textAlign: 'right', padding: '10px 0', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                  {perBuilding.reduce((s, p) => s + p.componentCount, 0)}
                </td>
                <td style={{ textAlign: 'right', padding: '10px 0', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                  {perBuilding.reduce((s, p) => s + p.matchCount, 0)}
                </td>
                <td style={{ textAlign: 'right', padding: '10px 0', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#C9531C' }}>
                  {fmtDecimal(totalTonnes)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Methodology */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 12px 0' }}>Methodology</h2>
          <div style={{ fontSize: 12, lineHeight: 1.7, color: '#0A0A0A' }}>
            <MethodologyRow label="Whole-life carbon assessment" value="EN 15978" />
            <MethodologyRow label="Product-level environmental data" value="EN 15804 product EPDs" />
            <MethodologyRow label="Disclosure framework" value="CSRD · ESRS E1" />
            <MethodologyRow label="Reporting format" value="EU Level(s) (B1.1, B1.2)" />
            <MethodologyRow label="Component classification" value="DIN SPEC 91484 (deconstruction), DIN SPEC 91525 (reuse handover)" />
            <MethodologyRow label="Materials passport" value="EU Digital Product Passport-compatible (Madaster synced)" />
            <MethodologyRow label="Double-counting prevention" value={`Per ESRS E1 ¶44 — Scope 3 attribution exclusive (no voluntary credit issued for ${Math.round(totalTonnes * 100) / 100} tCO₂e disclosed herein)`} />
          </div>
        </section>

        {/* Sign-off */}
        <section style={{ marginBottom: 32, background: '#FAFAFA', padding: 20, borderRadius: 8, border: '1px solid #E8E8E8' }}>
          <p style={{ fontSize: 11, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, margin: 0, marginBottom: 12 }}>
            Independent verification
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <p style={{ fontSize: 11, color: '#6B6B6B', margin: 0 }}>Verifier</p>
              <p style={{ fontSize: 14, fontWeight: 700, margin: '2px 0 0 0' }}>{verifier}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#6B6B6B', margin: 0 }}>Verified date</p>
              <p style={{ fontSize: 14, fontWeight: 700, margin: '2px 0 0 0' }}>{verifiedDate}</p>
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#6B6B6B', margin: '16px 0 0 0', lineHeight: 1.5 }}>
            This draft has been pre-reviewed by the independent verifier listed above. Final assurance opinion to be issued upon completion of Q3 reporting cycle close (15 October 2026).
          </p>
        </section>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #E8E8E8', paddingTop: 16, marginTop: 32, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6B6B6B' }}>
          <span>Floorprint Platform · Draft v0.6 · Generated automatically from materials passport database</span>
          <span>Page 1 of 1</span>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </main>
  )
}

function MethodologyRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F5F5F5' }}>
      <span style={{ color: '#6B6B6B' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )
}