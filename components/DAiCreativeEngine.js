'use client'
import { useState, useCallback, useMemo } from 'react'
import { DA_CREATIVE_DATA, LISTENING_MIND_DATA } from '@/lib/data'

const C = {
  bg: '#0a0b0f', surface: '#12131a', surfaceHover: '#1a1b25', card: '#16171f',
  border: '#2a2b35', borderLight: '#3a3b45',
  text: '#e8e9ed', textMuted: '#8b8d9a', textDim: '#5a5c6a',
  accent: '#4ecdc4', accentDim: '#4ecdc433',
  purple: '#a78bfa', orange: '#f59e0b', pink: '#f472b6',
  blue: '#60a5fa', green: '#34d399', red: '#f87171',
}

const TYPE_COLORS = {
  'FOMO형': '#f87171', '사회적증거형': '#f59e0b', '기능소구형': '#60a5fa',
  '타겟소구형': '#f472b6', '공감형': '#34d399',
}

export default function DAiCreativeEngine() {
  const [data, setData] = useState(DA_CREATIVE_DATA.creatives)
  const [insights, setInsights] = useState(null)
  const [nextCreatives, setNextCreatives] = useState(null)
  const [loadingInsight, setLoadingInsight] = useState(false)
  const [loadingNext, setLoadingNext] = useState(false)
  const [error, setError] = useState(null)

  // ─── COMPUTED STATS ───
  const stats = useMemo(() => {
    if (!data.length) return null

    // 상품별
    const byProduct = {}
    data.forEach(d => {
      if (!byProduct[d.product]) byProduct[d.product] = []
      byProduct[d.product].push(d)
    })
    const productStats = Object.entries(byProduct).map(([name, items]) => ({
      name,
      count: items.length,
      avgCtr: +(items.reduce((s, i) => s + i.ctr, 0) / items.length).toFixed(2),
      avgCvr: +(items.reduce((s, i) => s + i.cvr, 0) / items.length).toFixed(2),
      avgCpa: Math.round(items.reduce((s, i) => s + i.cpa, 0) / items.length),
      avgRoas: +(items.reduce((s, i) => s + i.roas, 0) / items.length).toFixed(1),
      totalImpressions: items.reduce((s, i) => s + i.impressions, 0),
      totalConversions: items.reduce((s, i) => s + i.conversions, 0),
    }))

    // 소재유형별
    const byType = {}
    data.forEach(d => {
      if (!byType[d.type]) byType[d.type] = []
      byType[d.type].push(d)
    })
    const typeStats = Object.entries(byType).map(([name, items]) => ({
      name,
      count: items.length,
      avgCtr: +(items.reduce((s, i) => s + i.ctr, 0) / items.length).toFixed(2),
      avgCvr: +(items.reduce((s, i) => s + i.cvr, 0) / items.length).toFixed(2),
      avgCpa: Math.round(items.reduce((s, i) => s + i.cpa, 0) / items.length),
      avgRoas: +(items.reduce((s, i) => s + i.roas, 0) / items.length).toFixed(1),
    }))

    // TOP/BOTTOM
    const sorted = [...data].sort((a, b) => b.roas - a.roas)
    const top3 = sorted.slice(0, 3)
    const bottom3 = sorted.slice(-3).reverse()

    // Overall
    const totalImpressions = data.reduce((s, i) => s + i.impressions, 0)
    const totalClicks = data.reduce((s, i) => s + i.clicks, 0)
    const totalConversions = data.reduce((s, i) => s + i.conversions, 0)
    const avgRoas = +(data.reduce((s, i) => s + i.roas, 0) / data.length).toFixed(1)

    return { productStats, typeStats, top3, bottom3, totalImpressions, totalClicks, totalConversions, avgRoas }
  }, [data])

  // ─── AI INSIGHT ───
  const generateInsight = useCallback(async () => {
    setLoadingInsight(true)
    setError(null)
    try {
      const res = await fetch('/api/dai-creative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'insight', creatives: data }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || '인사이트 생성 실패')
      setInsights(result.insights)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingInsight(false)
    }
  }, [data])

  // ─── NEXT CREATIVE ───
  const generateNextCreatives = useCallback(async () => {
    setLoadingNext(true)
    setError(null)
    try {
      const res = await fetch('/api/dai-creative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'next_creative', creatives: data, insights }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || '소재 기획 생성 실패')
      setNextCreatives(result.nextCreatives)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingNext(false)
    }
  }, [data, insights])

  // ─── BAR HELPER ───
  function Bar({ value, max, color, label, suffix = '' }) {
    const pct = max > 0 ? (value / max) * 100 : 0
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: C.textMuted, width: 100, flexShrink: 0, textAlign: 'right' }}>{label}</span>
        <div style={{ flex: 1, height: 20, background: C.border, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
        </div>
        <span style={{ fontSize: 12, color: C.text, width: 60, flexShrink: 0, fontWeight: 600 }}>{value}{suffix}</span>
      </div>
    )
  }

  // ─── SECTION CARD ───
  function Section({ title, icon, children, action }) {
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: C.orange }}>{icon}</span> {title}
          </h2>
          {action}
        </div>
        {children}
      </div>
    )
  }

  if (!stats) return null

  const maxRoas = Math.max(...data.map(d => d.roas))
  const maxCtr = Math.max(...stats.typeStats.map(t => t.avgCtr))
  const maxTypeCvr = Math.max(...stats.typeStats.map(t => t.avgCvr))

  return (
    <div>
      {/* ─── SECTION 1: 리포트 업로드 / 데이터 테이블 ─── */}
      <Section title="DA 리포트 데이터" icon="◈">
        {/* Upload Area */}
        <div style={{
          border: `2px dashed ${C.border}`, borderRadius: 10, padding: '20px 24px',
          textAlign: 'center', marginBottom: 20, background: C.card,
          cursor: 'pointer', transition: 'border-color 0.2s',
        }}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.orange }}
          onDragLeave={e => { e.currentTarget.style.borderColor = C.border }}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.border }}
        >
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
            CSV / 엑셀 파일을 드래그하거나 클릭하여 업로드 <span style={{ color: C.textDim }}>(현재 데모 데이터 사용 중)</span>
          </p>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: '총 노출수', value: (stats.totalImpressions / 10000).toFixed(1) + '만', color: C.blue },
            { label: '총 클릭수', value: stats.totalClicks.toLocaleString(), color: C.accent },
            { label: '총 전환수', value: stats.totalConversions.toLocaleString(), color: C.green },
            { label: '평균 ROAS', value: stats.avgRoas + 'x', color: C.orange },
          ].map((s, i) => (
            <div key={i} style={{ background: C.card, borderRadius: 8, padding: '14px 16px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Data Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['ID', '상품', '소재유형', '헤드라인', '노출수', '클릭수', 'CTR', '전환수', 'CVR', 'CPA', 'ROAS'].map(h => (
                  <th key={h} style={{ padding: '10px 8px', color: C.textDim, fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                  <td style={{ padding: '8px', color: C.textMuted, fontFamily: 'monospace' }}>{d.id}</td>
                  <td style={{ padding: '8px', color: C.text }}>{d.product}</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      background: `${TYPE_COLORS[d.type] || C.accent}20`, color: TYPE_COLORS[d.type] || C.accent,
                    }}>{d.type}</span>
                  </td>
                  <td style={{ padding: '8px', color: C.text, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.headline}</td>
                  <td style={{ padding: '8px', color: C.textMuted }}>{(d.impressions / 10000).toFixed(1)}만</td>
                  <td style={{ padding: '8px', color: C.textMuted }}>{d.clicks.toLocaleString()}</td>
                  <td style={{ padding: '8px', color: d.ctr >= 1.5 ? C.green : C.textMuted, fontWeight: d.ctr >= 1.5 ? 600 : 400 }}>{d.ctr}%</td>
                  <td style={{ padding: '8px', color: C.textMuted }}>{d.conversions}</td>
                  <td style={{ padding: '8px', color: d.cvr >= 2.0 ? C.green : C.textMuted, fontWeight: d.cvr >= 2.0 ? 600 : 400 }}>{d.cvr}%</td>
                  <td style={{ padding: '8px', color: d.cpa <= 9000 ? C.green : d.cpa >= 13000 ? C.red : C.textMuted, fontWeight: 600 }}>{d.cpa.toLocaleString()}원</td>
                  <td style={{ padding: '8px', fontWeight: 700, color: d.roas >= 2.5 ? C.green : d.roas <= 1.5 ? C.red : C.orange }}>{d.roas}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ─── SECTION 2: 성과 분석 대시보드 ─── */}
      <Section title="AI 성과 분석 대시보드" icon="⬡">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* 상품별 ROAS */}
          <div style={{ background: C.card, borderRadius: 10, padding: 20, border: `1px solid ${C.border}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginTop: 0, marginBottom: 16 }}>상품별 평균 ROAS</h3>
            {stats.productStats.sort((a, b) => b.avgRoas - a.avgRoas).map(p => (
              <Bar key={p.name} label={p.name} value={p.avgRoas} max={maxRoas} color={C.orange} suffix="x" />
            ))}
          </div>

          {/* 상품별 CVR */}
          <div style={{ background: C.card, borderRadius: 10, padding: 20, border: `1px solid ${C.border}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginTop: 0, marginBottom: 16 }}>상품별 평균 CVR</h3>
            {stats.productStats.sort((a, b) => b.avgCvr - a.avgCvr).map(p => (
              <Bar key={p.name} label={p.name} value={p.avgCvr} max={3} color={C.green} suffix="%" />
            ))}
          </div>
        </div>

        {/* 소재유형별 성과 */}
        <div style={{ background: C.card, borderRadius: 10, padding: 20, border: `1px solid ${C.border}`, marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginTop: 0, marginBottom: 16 }}>소재유형별 성과 비교</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>평균 CTR</div>
              {stats.typeStats.sort((a, b) => b.avgCtr - a.avgCtr).map(t => (
                <Bar key={t.name} label={t.name} value={t.avgCtr} max={maxCtr} color={TYPE_COLORS[t.name] || C.accent} suffix="%" />
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>평균 ROAS</div>
              {stats.typeStats.sort((a, b) => b.avgRoas - a.avgRoas).map(t => (
                <Bar key={t.name} label={t.name} value={t.avgRoas} max={maxRoas} color={TYPE_COLORS[t.name] || C.accent} suffix="x" />
              ))}
            </div>
          </div>
        </div>

        {/* TOP 3 / 하위 3 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: C.card, borderRadius: 10, padding: 20, border: `1px solid ${C.border}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.green, marginTop: 0, marginBottom: 12 }}>TOP 3 소재</h3>
            {stats.top3.map((d, i) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 2 ? `1px solid ${C.border}22` : 'none' }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: C.green, width: 24 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{d.headline}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{d.product} · {d.type}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.green }}>{d.roas}x</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>ROAS</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: C.card, borderRadius: 10, padding: 20, border: `1px solid ${C.border}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.red, marginTop: 0, marginBottom: 12 }}>하위 3 소재</h3>
            {stats.bottom3.map((d, i) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 2 ? `1px solid ${C.border}22` : 'none' }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: C.red, width: 24 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{d.headline}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{d.product} · {d.type}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.red }}>{d.roas}x</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>ROAS</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── SECTION 3: AI 인사이트 ─── */}
      <Section title="AI 인사이트" icon="◉" action={
        <button onClick={generateInsight} disabled={loadingInsight} style={{
          padding: '8px 20px', borderRadius: 8, border: 'none', cursor: loadingInsight ? 'wait' : 'pointer',
          background: loadingInsight ? C.border : C.orange, color: '#fff', fontSize: 13, fontWeight: 600,
        }}>
          {loadingInsight ? '분석 중...' : insights ? '재분석' : 'AI 인사이트 생성'}
        </button>
      }>
        {!insights && !loadingInsight && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.textDim, fontSize: 13 }}>
            상단 버튼을 클릭하면 AI가 전체 DA 성과 데이터를 분석하여 인사이트를 도출합니다.
          </div>
        )}
        {loadingInsight && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 14, color: C.orange, fontWeight: 600, marginBottom: 8 }}>AI가 성과 데이터를 분석하고 있습니다...</div>
            <div style={{ fontSize: 12, color: C.textDim }}>소재유형별 패턴, 상품별 효율, 검색 데이터 연결 분석 중</div>
          </div>
        )}
        {insights && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{
                background: C.card, borderRadius: 10, padding: '16px 20px',
                border: `1px solid ${ins.impact === 'high' ? C.orange + '40' : ins.impact === 'medium' ? C.blue + '30' : C.border}`,
                borderLeft: `3px solid ${ins.impact === 'high' ? C.orange : ins.impact === 'medium' ? C.blue : C.textDim}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    padding: '1px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                    background: ins.impact === 'high' ? `${C.orange}20` : ins.impact === 'medium' ? `${C.blue}20` : `${C.textDim}20`,
                    color: ins.impact === 'high' ? C.orange : ins.impact === 'medium' ? C.blue : C.textDim,
                  }}>{ins.impact === 'high' ? 'HIGH' : ins.impact === 'medium' ? 'MEDIUM' : 'LOW'}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{ins.title}</span>
                </div>
                <p style={{ fontSize: 12, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>{ins.detail}</p>
                {ins.action && (
                  <div style={{ marginTop: 8, fontSize: 11, color: C.green, fontWeight: 600 }}>
                    → {ins.action}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── SECTION 4: AI 다음 소재 기획 ─── */}
      <Section title="AI 다음 소재 기획" icon="▸" action={
        <button onClick={generateNextCreatives} disabled={loadingNext || !insights} style={{
          padding: '8px 20px', borderRadius: 8, border: 'none',
          cursor: (!insights || loadingNext) ? 'not-allowed' : 'pointer',
          background: (!insights || loadingNext) ? C.border : C.accent, color: '#fff', fontSize: 13, fontWeight: 600,
          opacity: !insights ? 0.5 : 1,
        }}>
          {loadingNext ? '기획 중...' : nextCreatives ? '새로 기획하기' : 'AI 소재 기획 생성'}
        </button>
      }>
        {!insights && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.textDim, fontSize: 13 }}>
            먼저 AI 인사이트를 생성한 후 소재 기획을 진행할 수 있습니다.
          </div>
        )}
        {insights && !nextCreatives && !loadingNext && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.textDim, fontSize: 13 }}>
            인사이트 기반으로 AI가 다음 DA 소재 카피를 기획합니다.
          </div>
        )}
        {loadingNext && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 14, color: C.accent, fontWeight: 600, marginBottom: 8 }}>AI가 다음 소재를 기획하고 있습니다...</div>
            <div style={{ fontSize: 12, color: C.textDim }}>인사이트 + 검색 데이터 기반 카피 생성 중</div>
          </div>
        )}
        {nextCreatives && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {nextCreatives.map((nc, i) => (
              <div key={i} style={{
                background: C.card, borderRadius: 12, padding: 20,
                border: `1px solid ${C.border}`, position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: `linear-gradient(90deg, ${C.accent}, ${C.orange})`,
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', background: C.accentDim,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: C.accent,
                  }}>{i + 1}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                    background: `${TYPE_COLORS[nc.type] || C.accent}20`, color: TYPE_COLORS[nc.type] || C.accent,
                  }}>{nc.type}</span>
                  <span style={{ fontSize: 11, color: C.textDim }}>{nc.product}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>{nc.headline}</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>{nc.sub_copy}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {nc.channel && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: `${C.blue}15`, color: C.blue }}>매체: {nc.channel}</span>}
                  {nc.expected_roas && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: `${C.green}15`, color: C.green }}>예상 ROAS: {nc.expected_roas}x</span>}
                </div>
                {nc.visual_guide && (
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: C.textMuted }}>비주얼 가이드:</span> {nc.visual_guide}
                  </div>
                )}
                {nc.rationale && (
                  <div style={{
                    fontSize: 11, color: C.orange, background: `${C.orange}10`,
                    padding: '8px 12px', borderRadius: 6, lineHeight: 1.5,
                  }}>
                    근거: {nc.rationale}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {error && (
        <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: C.red, margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  )
}
