'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PRODUCTS, CONTEXT_DIMS, SEASON_DATA, SF_TEMPLATES, SF_TYPES } from '@/lib/data'

// ─── STYLE CONSTANTS ───
const C = {
  bg: '#0a0b0f', surface: '#12131a', surfaceHover: '#1a1b25',
  card: '#16171f', border: '#2a2b35', borderLight: '#3a3b45',
  text: '#e8e9ed', textMuted: '#8b8d9a', textDim: '#5a5c6a',
  accent: '#4ecdc4', accentDim: '#4ecdc433',
  purple: '#a78bfa', orange: '#f59e0b', pink: '#f472b6',
  blue: '#60a5fa', green: '#34d399', red: '#f87171',
}

// 카테고리별 색상 매핑
const CATEGORY_COLORS = {
  '뷰티 디바이스': '#f472b6',
  '생활가전': '#34d399',
  '테크 액세서리': '#60a5fa',
  '오피스 액세서리': '#a78bfa',
  '여행 액세서리': '#f59e0b',
}
const catColor = (cat) => CATEGORY_COLORS[cat] || C.accent

const dimColor = (key) => CONTEXT_DIMS[key]?.color || C.accent

// ─── REUSABLE UI COMPONENTS ───

function Tag({ children, color = C.accent, small }) {
  return (
    <span style={{
      display: 'inline-block', padding: small ? '2px 8px' : '4px 12px',
      background: `${color}22`, color,
      borderRadius: 20, fontSize: small ? 10 : 12, fontWeight: 500,
      border: `1px solid ${color}33`, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 18, color: C.accent }}>{icon}</span>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.02em' }}>{title}</h2>
      </div>
      {subtitle && <p style={{ fontSize: 13, color: C.textMuted, margin: 0, marginLeft: 28 }}>{subtitle}</p>}
    </div>
  )
}

function EmptyState({ icon, message, action, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>{icon}</div>
      <p style={{ fontSize: 16, marginBottom: 16 }}>{message}</p>
      {action && (
        <button onClick={onAction} style={{
          padding: '8px 24px', background: C.accentDim, color: C.accent,
          border: `1px solid ${C.accent}44`, borderRadius: 8, cursor: 'pointer', fontSize: 14,
        }}>{action}</button>
      )}
    </div>
  )
}

// ─── MAIN ENGINE COMPONENT ───

export default function DiscoveryEngine() {
  const [activeTab, setActiveTab] = useState(0)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [matchedContexts, setMatchedContexts] = useState(null)
  const [isMatching, setIsMatching] = useState(false)
  const [generatedIdeas, setGeneratedIdeas] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedContextIdx, setSelectedContextIdx] = useState(0)
  const [sfTypeFilter, setSfTypeFilter] = useState(null)
  const [dataSource, setDataSource] = useState(null)
  const router = useRouter()

  const [channelData, setChannelData] = useState(null)
  const [isLoadingChannel, setIsLoadingChannel] = useState(false)
  const [channelError, setChannelError] = useState(null)
  const [channelSort, setChannelSort] = useState({ key: 'viewCount', dir: 'desc' })

  // ─── TAB CONFIG (NEW ORDER) ───
  // ① AI 성과 Insight → ② 제품 분석 → ③ 맥락 발견 → ④ 숏폼 제작 → ⑤ 시즌 전략
  const tabs = [
    { label: 'AI 성과 Insight', icon: '◉', step: 1 },
    { label: '제품 분석', icon: '◈', step: 2 },
    { label: '맥락 발견', icon: '⬡', step: 3 },
    { label: '숏폼 제작', icon: '▸', step: 4 },
    { label: '시즌 전략', icon: '◐', step: 5 },
  ]

  // 완료 단계 추적 (channel loaded, product selected, context matched, ideas generated)
  const completedSteps = new Set()
  if (channelData) completedSteps.add(0)
  if (selectedProduct) completedSteps.add(1)
  if (matchedContexts) completedSteps.add(2)
  if (generatedIdeas) completedSteps.add(3)

  // ─── AI CALLS ───

  async function runContextMatching(product) {
    setIsMatching(true)
    setMatchedContexts(null)
    setGeneratedIdeas(null)
    setSelectedContextIdx(0)
    setDataSource(null)
    try {
      const channelInsights = channelData?.insights ? {
        avgViews: channelData.insights.avgViews,
        avgEngagement: channelData.insights.avgEngagement,
        avgLikeRate: channelData.insights.avgLikeRate,
        top3: channelData.insights.top3,
        patterns: channelData.insights.patterns,
        productStats: channelData.insights.productStats,
        typeStats: channelData.insights.typeStats,
        hookStats: channelData.insights.hookStats,
        thumbnailStats: channelData.insights.thumbnailStats,
        deepInsights: channelData.insights.deepInsights,
      } : null

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'context_match', product, sfTypeFilter, channelInsights }),
      })
      const data = await res.json()
      if (data.result) {
        setMatchedContexts(data.result)
        setDataSource('ai')
      } else {
        throw new Error(data.error || 'AI error')
      }
    } catch (e) {
      setMatchedContexts(generateFallbackContexts(product))
      setDataSource('fallback')
    }
    setIsMatching(false)
  }

  async function generateShortformIdeas() {
    if (!selectedProduct || !matchedContexts?.length) return
    setIsGenerating(true)
    setGeneratedIdeas(null)
    const ctx = matchedContexts[selectedContextIdx]
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'generate_shortform', product: selectedProduct, context: ctx }),
      })
      const data = await res.json()
      if (data.result) {
        setGeneratedIdeas(data.result)
      } else {
        throw new Error(data.error || 'AI error')
      }
    } catch (e) {
      setGeneratedIdeas(generateFallbackIdeas(selectedProduct, ctx))
    }
    setIsGenerating(false)
  }

  // ─── FALLBACK DATA ───

  function generateFallbackContexts(product) {
    const base = (items) => items.map((item, i) => ({
      ...item,
      tier: i < 3 ? 'safe' : i < 6 ? 'cross' : 'experimental',
    }))
    const fallbacks = {
      clenser: base([
        { rank: 1, sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "자취 1년차 사회초년생", PAIN: "세안해도 남아있는 잔여 메이크업", conversion_score: 96, hook_copy: "이거 안 쓰면 세안 반만 한 거임", ai_producible: true, insight: "WHO의 시간 부족 + PAIN의 잔여물 고민", data_evidence: "🟢 검색: '클렌저 추천' 월 8,100회 | VOC: '피부 매끈' 만족 반응 최다" },
        { rank: 2, sf_type: "B", axes_used: ["PAIN", "NEED"], PAIN: "일반 세안으로 잔여 메이크업이 안 지워짐", NEED: "눈에 보이는 세정력 차이", conversion_score: 93, hook_copy: "손으로 세안 vs 진동클렌저, 잔여물 차이 봐봐", ai_producible: false, insight: "초미세진동 12,000회 vs 손세안 비교 기능 증명", data_evidence: "🟡 검색: '클렌저 세정력 비교' I 85%" },
        { rank: 3, sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "뷰티 관심 대학생", PAIN: "피부 트러블 반복되는데 원인 모름", conversion_score: 90, hook_copy: "트러블 원인이 세안법이었다고?", ai_producible: true, insight: "트러블 원인 미지 — 세안법 솔루션", data_evidence: "🟢 검색: '피부 트러블 원인' 월 5,400회" },
        { rank: 4, sf_type: "C", axes_used: ["WHO", "INTEREST"], WHO: "갓생러 루틴 관심자", INTEREST: "자기계발/갓생", conversion_score: 85, hook_copy: "갓생 루틴의 시작은 세안부터", ai_producible: true, insight: "자기계발 관심사와 스킨케어 루틴 연결", data_evidence: "🟡 검색: '갓생 루틴' 1월 +140%" },
        { rank: 5, sf_type: "C", axes_used: ["WHO", "INTEREST"], WHO: "부모님 선물 고민 자녀", INTEREST: "효도/가족", conversion_score: 83, hook_copy: "3만원으로 엄마 피부 바꿔드렸더니...", ai_producible: false, insight: "선물 카테고리와 뷰티 연결", data_evidence: "🟢 검색: '어버이날 선물 추천' 급증" },
        { rank: 6, sf_type: "A", axes_used: ["WHO", "INTEREST"], WHO: "ASMR 좋아하는 시청자", INTEREST: "ASMR", conversion_score: 80, hook_copy: "클렌저 ASMR 듣다가 잠듦ㅋㅋ", ai_producible: true, insight: "ASMR 관심사와 클렌저 진동음 연결", data_evidence: "🟡 ASMR 대량 검색 — 콘텐츠 크로스 가능" },
        { rank: 7, sf_type: "C", axes_used: ["WHO", "WHERE"], WHO: "반려동물 집사", WHERE: "강아지 목욕 후", conversion_score: 72, hook_copy: "강아지 발바닥도 진동클렌징 된다고?", ai_producible: false, insight: "반려동물 케어와 클렌저 기능 연결", data_evidence: "🔵 신규 기회 — 펫 그루밍 시장 교차" },
        { rank: 8, sf_type: "B", axes_used: ["PAIN"], PAIN: "캠핑에서 세안이 불편", conversion_score: 68, hook_copy: "캠핑장 세면대에서 이거 꺼내면 반응이...", ai_producible: false, insight: "캠핑 상황의 세안 불편 해결", data_evidence: "🔵 신규 기회 — 캠핑족 위생 니즈" },
        { rank: 9, sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "중년 남성", PAIN: "피부 관리 시작하고 싶은데 뭘 해야 할지 모름", conversion_score: 65, hook_copy: "40대 남자인데 이거 하나로 피부 달라짐", ai_producible: true, insight: "남성 스킨케어 입문 시장", data_evidence: "🔵 신규 기회 — 남성 그루밍 시장 성장 중" },
      ]),
    }
    const defaultFallback = (p) => base([
      { rank: 1, sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "일반 소비자", PAIN: `${p.strengths?.[0]?.tag || p.name} 없어서 불편`, conversion_score: 90, hook_copy: "이거 없이 어떻게 살았지?", ai_producible: true, insight: "기본 페인포인트 자극", data_evidence: "🟡 기본 폴백" },
      { rank: 2, sf_type: "B", axes_used: ["PAIN", "NEED"], PAIN: "기존 제품이 불만족", NEED: `${p.strengths?.[1]?.tag || '편의성'}`, conversion_score: 85, hook_copy: "기존 거 vs 이거, 차이 실화?", ai_producible: false, insight: "기능 비교 증명", data_evidence: "🟡 기본 폴백" },
      { rank: 3, sf_type: "C", axes_used: ["WHO", "WHEN", "WHERE"], WHO: "트렌드 민감 소비자", WHEN: "일상 속", WHERE: "집에서", conversion_score: 80, hook_copy: "요즘 핫한 거 발견했는데...", ai_producible: true, insight: "라이프스타일 배치", data_evidence: "🟡 기본 폴백" },
    ])
    return fallbacks[product.id] || defaultFallback(product)
  }

  function generateFallbackIdeas(product, ctx) {
    const hookText = ctx.PAIN || ctx.WHO || product.strengths[0]?.tag || product.name
    const placeText = ctx.WHERE || '일상 속'
    const interestText = ctx.INTEREST || product.category
    const targetText = ctx.WHO || '일상 소비자'
    return {
      youtube: {
        title: `${hookText.slice(0, 8)}... 이거면 끝`, hook: `"솔직히 말할게, ${hookText}"`,
        hook_pattern: "고백형 → 공감 유발 → 솔루션 제시",
        scene_flow: [`장면1: ${placeText}에서 ${hookText} 상황 재현`, `장면2: ${product.name} 등장`, `장면3: ${product.strengths[0]?.tag} 시연`, `장면4: Before vs After 비교`],
        proof_point: product.strengths[0]?.tag + " 실제 시연", cta: `프로필 링크에서 만나보세요`,
        hashtags: [product.name.replace(/\s/g, ''), interestText.split('/')[0], "멜리언스", "추천템"],
        best_upload_time: "평일 오전 7시", target_cluster: interestText,
      },
      instagram: {
        title: `${targetText}의 필수템 발견`, hook: `${placeText}에서 이거 쓰는 사람 손?`,
        hook_pattern: "질문형 → 참여 유발 → 시각적 시연",
        scene_flow: [`장면1: ${placeText} 분위기 숏`, `장면2: ${product.name} 등장`, `장면3: ${product.strengths[0]?.visual}`, `장면4: 사용 후 만족`],
        proof_point: "실사용 장면 + 감성적 비주얼", cta: "저장해두고 다음에 장바구니 담기",
        hashtags: [product.name.replace(/\s/g, ''), interestText.split('/')[0], "멜리언스", "일상템"],
        best_upload_time: "평일 저녁 9시", target_cluster: interestText,
      },
    }
  }

  // ─── PRODUCT SELECTION ───
  function selectProduct(p) {
    setSelectedProduct(p)
    setMatchedContexts(null)
    setGeneratedIdeas(null)
    setActiveTab(2) // 맥락 발견 탭으로 이동
  }

  // ─── CHANNEL ANALYSIS DATA FETCH ───
  const fetchChannelData = useCallback(async () => {
    if (channelData || isLoadingChannel) return
    setIsLoadingChannel(true)
    setChannelError(null)
    try {
      const res = await fetch('/api/youtube')
      const data = await res.json()
      if (!data.success) throw new Error(data.error || '채널 데이터 로드 실패')
      setChannelData(data)
    } catch (e) {
      setChannelError(e.message)
    }
    setIsLoadingChannel(false)
  }, [channelData, isLoadingChannel])

  // AI 성과 Insight가 첫 탭이므로, 사이트 진입 시 바로 로드
  useEffect(() => {
    if (activeTab === 0 && !channelData && !isLoadingChannel) {
      fetchChannelData()
    }
  }, [activeTab, channelData, isLoadingChannel, fetchChannelData])

  // ─── TAB 0: AI 성과 INSIGHT (구 채널 분석) ───
  function renderChannelInsight() {
    if (isLoadingChannel) {
      return (
        <div style={{ textAlign: 'center', padding: 80, color: C.textMuted }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>◉</div>
          <p style={{ fontSize: 16 }}>YouTube 채널 데이터 로딩 중...</p>
          <p style={{ fontSize: 12, color: C.textDim }}>YouTube Data API v3에서 쇼츠 성과를 가져오고 있습니다</p>
        </div>
      )
    }
    if (channelError) {
      return (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>⚠</div>
          <p style={{ fontSize: 14, color: C.red, marginBottom: 12 }}>{channelError}</p>
          <button onClick={() => { setChannelData(null); setChannelError(null) }} style={{
            padding: '8px 24px', background: C.accentDim, color: C.accent,
            border: `1px solid ${C.accent}44`, borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}>다시 시도</button>
        </div>
      )
    }
    if (!channelData) return <EmptyState icon="◉" message="채널 데이터를 불러오는 중..." />

    const { channel, videos, insights } = channelData
    const PRODUCT_NAMES = { clenser: '진동클렌저', lint: '보풀제거기', stand: '거치대', humidifier: '가습기', nail: '네일드릴', massager: '안마기', toothbrush: '전동칫솔', epilator: '제모기', unknown: '기타' }
    const PRODUCT_EMOJIS = { clenser: '🧴', lint: '🧹', stand: '📱', humidifier: '💧', nail: '💅', massager: '💆', toothbrush: '🪥', epilator: '✨', unknown: '📦' }

    const sortedVideos = [...videos].sort((a, b) => {
      const mul = channelSort.dir === 'desc' ? -1 : 1
      if (channelSort.key === 'title') return mul * a.title.localeCompare(b.title)
      if (channelSort.key === 'publishedAt') return mul * (new Date(a.publishedAt) - new Date(b.publishedAt))
      return mul * ((a[channelSort.key] || 0) - (b[channelSort.key] || 0))
    })
    const handleSort = (key) => setChannelSort(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }))
    const sortIcon = (key) => channelSort.key === key ? (channelSort.dir === 'desc' ? ' ▾' : ' ▴') : ''
    const StatBar = ({ value, max, color }) => (
      <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${max > 0 ? (value / max * 100) : 0}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
    )

    return (
      <div>
        <SectionTitle icon="◉" title="AI 성과 Insight" subtitle="YouTube @meliens_official 쇼츠 성과 데이터 기반 인사이트" />

        {/* Channel Overview — 6 stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 28 }}>
          {[
            { label: '구독자', value: channel.subscriberCount.toLocaleString(), color: C.red },
            { label: '총 조회수', value: channel.totalViews.toLocaleString(), color: C.blue },
            { label: '쇼츠 수', value: `${videos.length}개`, color: C.accent },
            { label: '평균 조회수', value: insights.avgViews?.toLocaleString() || '0', color: C.green },
            { label: '좋아요율', value: `${insights.avgLikeRate || 0}%`, color: C.orange },
            { label: '인게이지먼트', value: `${insights.avgEngagement || 0}%`, color: C.purple },
          ].map((stat, i) => (
            <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4, letterSpacing: '0.05em' }}>{stat.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Deep Insights Cards */}
        {insights.deepInsights?.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
            {insights.deepInsights.map((di, i) => (
              <div key={i} style={{
                background: `linear-gradient(135deg, ${di.color}12, ${di.color}06)`,
                border: `1px solid ${di.color}30`, borderRadius: 14, padding: 16,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: di.color, letterSpacing: '0.05em', marginBottom: 8 }}>{di.title}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: di.color, marginBottom: 6 }}>{di.metric}</div>
                <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>{di.detail}</div>
              </div>
            ))}
          </div>
        )}

        {/* AI Insights Panel */}
        <div style={{ background: `linear-gradient(135deg, ${C.purple}12, ${C.accent}08)`, border: `1px solid ${C.purple}30`, borderRadius: 14, padding: 20, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>🧠</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: C.purple, margin: 0 }}>AI 인사이트</h3>
            <span style={{ fontSize: 11, color: C.textDim, marginLeft: 'auto' }}>{insights.patterns?.length || 0}개 패턴 발견</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {insights.patterns?.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: C.card, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6, flexShrink: 0, marginTop: 2, background: p.impact === 'high' ? `${C.green}20` : p.impact === 'medium' ? `${C.orange}20` : `${C.textDim}20`, color: p.impact === 'high' ? C.green : p.impact === 'medium' ? C.orange : C.textDim }}>{p.impact.toUpperCase()}</span>
                <span style={{ fontSize: 12, color: C.text, flex: 1, lineHeight: 1.5 }}>{p.insight}</span>
              </div>
            ))}
          </div>
          {insights.recommendations?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 8, letterSpacing: '0.05em' }}>추천 액션</div>
              {insights.recommendations.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ color: C.accent, fontSize: 12, flexShrink: 0 }}>→</span>
                  <span style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Three columns: Video Type + Hooking Pattern + Thumbnail */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
          {/* Video Type Stats */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: C.blue }}>🎬</span> 영상 유형별 성과
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(insights.typeStats || {}).sort((a, b) => b[1].avgViews - a[1].avgViews).map(([typeId, stats]) => {
                const maxViews = Math.max(...Object.values(insights.typeStats || {}).map(s => s.avgViews))
                return (
                  <div key={typeId} style={{ padding: '10px 12px', background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{stats.emoji}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1 }}>{stats.label}</span>
                      <span style={{ fontSize: 10, color: C.textDim }}>{stats.count}개</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatBar value={stats.avgViews} max={maxViews} color={C.blue} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, minWidth: 50, textAlign: 'right' }}>{stats.avgViews.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: stats.viewsVsAvg >= 1 ? C.green : C.red }}>{stats.viewsVsAvg >= 1 ? '▲' : '▼'} {stats.viewsVsAvg}배</span>
                      <span style={{ fontSize: 10, color: C.textDim }}>좋아요율 {stats.likeRate}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Hooking Pattern Stats */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: C.orange }}>🎣</span> 후킹 패턴별 성과
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(insights.hookStats || {}).sort((a, b) => b[1].avgViews - a[1].avgViews).map(([hookId, stats]) => {
                const maxViews = Math.max(...Object.values(insights.hookStats || {}).map(s => s.avgViews))
                return (
                  <div key={hookId} style={{ padding: '10px 12px', background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{stats.emoji}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1 }}>{stats.label}</span>
                      <span style={{ fontSize: 10, color: C.textDim }}>{stats.count}개</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatBar value={stats.avgViews} max={maxViews} color={C.orange} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.orange, minWidth: 50, textAlign: 'right' }}>{stats.avgViews.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: stats.viewsVsAvg >= 1 ? C.green : C.red }}>{stats.viewsVsAvg >= 1 ? '▲' : '▼'} {stats.viewsVsAvg}배</span>
                      <span style={{ fontSize: 10, color: C.textDim }}>인게이지먼트 {stats.engagementRate}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Thumbnail Composition Stats */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: C.pink }}>🖼️</span> 썸네일 구성별 성과
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(insights.thumbnailStats || {}).sort((a, b) => b[1].avgViews - a[1].avgViews).map(([thumbId, stats]) => {
                const maxViews = Math.max(...Object.values(insights.thumbnailStats || {}).map(s => s.avgViews))
                return (
                  <div key={thumbId} style={{ padding: '10px 12px', background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: stats.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1 }}>{stats.label}</span>
                      <span style={{ fontSize: 10, color: C.textDim }}>{stats.count}개</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatBar value={stats.avgViews} max={maxViews} color={stats.color} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: stats.color, minWidth: 50, textAlign: 'right' }}>{stats.avgViews.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: stats.viewsVsAvg >= 1 ? C.green : C.red }}>{stats.viewsVsAvg >= 1 ? '▲' : '▼'} {stats.viewsVsAvg}배</span>
                      <span style={{ fontSize: 10, color: C.textDim }}>좋아요율 {stats.likeRate}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Product Stats + TOP/Bottom */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 14px 0' }}><span style={{ color: C.accent }}>◈</span> 제품별 성과 비교</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(insights.productStats || {}).filter(([id]) => id !== 'unknown').sort((a, b) => b[1].avgViews - a[1].avgViews).map(([productId, stats]) => (
                <div key={productId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 20 }}>{PRODUCT_EMOJIS[productId] || '📦'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{PRODUCT_NAMES[productId] || productId}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>{stats.count}개 영상</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{stats.avgViews.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>평균 조회</div>
                  </div>
                  <div style={{ width: 48, textAlign: 'center', padding: '4px 0', borderRadius: 8, background: stats.engagementRate > 5 ? `${C.green}18` : stats.engagementRate > 2 ? `${C.orange}18` : `${C.textDim}18`, color: stats.engagementRate > 5 ? C.green : stats.engagementRate > 2 ? C.orange : C.textDim, fontSize: 11, fontWeight: 700 }}>{stats.engagementRate}%</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.green, margin: '0 0 12px 0' }}>🏆 TOP 3</h3>
              {insights.top3?.map((v, i) => (
                <div key={v.videoId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', background: i === 0 ? `${C.orange}30` : C.border, color: i === 0 ? C.orange : C.textMuted }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                      {v.videoType && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${C.blue}18`, color: C.blue }}>{v.videoType.emoji} {v.videoType.label}</span>}
                      {v.hookingPatterns?.slice(0, 2).map((h, hi) => <span key={hi} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${C.orange}18`, color: C.orange }}>{h.emoji} {h.label}</span>)}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.green, flexShrink: 0 }}>{v.viewCount.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.red, margin: '0 0 12px 0' }}>📉 하위 3</h3>
              {insights.bottom3?.map((v, i) => (
                <div key={v.videoId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.border, color: C.textDim }}>-</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.red, flexShrink: 0 }}>{v.viewCount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Video Table */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>영상별 성과 테이블</h3>
            <button onClick={() => { setChannelData(null); setChannelError(null) }} style={{ padding: '5px 14px', background: C.surface, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>↻ 새로고침</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {[{ key: 'title', label: '제목' }, { key: 'productId', label: '제품' }, { key: 'videoType', label: '유형' }, { key: 'hookType', label: '후킹' }, { key: 'viewCount', label: '조회수' }, { key: 'likeCount', label: '좋아요' }, { key: 'durationSec', label: '길이' }, { key: 'publishedAt', label: '업로드' }].map(col => (
                    <th key={col.key} onClick={() => handleSort(col.key)} style={{ padding: '10px 8px', textAlign: col.key === 'title' ? 'left' : 'center', color: channelSort.key === col.key ? C.accent : C.textMuted, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', fontSize: 11 }}>
                      {col.label}{sortIcon(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedVideos.map((v, i) => {
                  const isTop = insights.top3?.some(t => t.videoId === v.videoId)
                  const isBottom = insights.bottom3?.some(t => t.videoId === v.videoId)
                  return (
                    <tr key={v.videoId} style={{ borderBottom: `1px solid ${C.border}`, background: isTop ? `${C.green}06` : isBottom ? `${C.red}06` : (i % 2 === 0 ? 'transparent' : C.surface) }}>
                      <td style={{ padding: '10px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>
                        {isTop && <span style={{ color: C.green, marginRight: 4 }}>▲</span>}
                        {isBottom && <span style={{ color: C.red, marginRight: 4 }}>▼</span>}
                        <a href={v.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }} title={v.title}>{v.title}</a>
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'center' }}><span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: `${C.accent}15`, color: C.accent, whiteSpace: 'nowrap' }}>{PRODUCT_EMOJIS[v.productId] || ''} {PRODUCT_NAMES[v.productId] || '기타'}</span></td>
                      <td style={{ padding: '10px 4px', textAlign: 'center' }}><span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: `${C.blue}15`, color: C.blue, whiteSpace: 'nowrap' }}>{v.videoType?.emoji} {v.videoType?.label || '기타'}</span></td>
                      <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {v.hookingPatterns?.slice(0, 2).map((h, hi) => <span key={hi} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: `${C.orange}15`, color: C.orange, whiteSpace: 'nowrap' }}>{h.emoji}{h.label}</span>)}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: v.viewCount > insights.avgViews ? C.green : C.textMuted }}>{v.viewCount.toLocaleString()}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: C.textMuted }}>{v.likeCount.toLocaleString()}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: C.textDim, fontFamily: 'monospace' }}>{v.durationSec}s</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: C.textDim, whiteSpace: 'nowrap' }}>{new Date(v.publishedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ─── TAB 1: 제품 분석 (NEW DESIGN) ───
  function renderProductAnalysis() {
    const bestProducts = PRODUCTS.filter(p => p.bestseller)
    const otherProducts = PRODUCTS.filter(p => !p.bestseller)

    return (
      <div>
        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: 40, padding: '32px 0' }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: '0 0 10px 0', letterSpacing: '-0.03em', lineHeight: 1.4 }}>
            멜리언스의 <span style={{ color: C.accent }}>발견 커머스</span>를<br />데이터로 설계합니다
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, margin: '0 0 28px 0' }}>AI가 성과 데이터 + 소비자 맥락을 분석하여 숏폼 콘텐츠 전략을 자동화합니다</p>

          {/* Mini Flow */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0 }}>
            {[
              { icon: '📊', label: '데이터 분석', color: C.blue },
              { icon: '⬡', label: '맥락 발견', color: C.accent },
              { icon: '▸', label: '숏폼 생성', color: C.orange },
              { icon: '📈', label: '성과 학습', color: C.green },
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '0 16px' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: `${step.color}18`, border: `2px solid ${step.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>{step.icon}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: step.color }}>{step.label}</span>
                </div>
                {i < 3 && <div style={{ width: 40, height: 2, background: `linear-gradient(90deg, ${step.color}40, ${[C.blue, C.accent, C.orange, C.green][i + 1]}40)`, flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        </div>

        {/* BEST Products — Large Cards */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Tag color={C.orange}>BEST</Tag>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>베스트 제품</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bestProducts.length}, 1fr)`, gap: 16, marginBottom: 32 }}>
            {bestProducts.map((p) => {
              const cc = catColor(p.category)
              const isSelected = selectedProduct?.id === p.id
              return (
                <div key={p.id} onClick={() => selectProduct(p)} style={{
                  background: C.card, border: `2px solid ${isSelected ? cc : C.border}`,
                  borderRadius: 18, padding: 24, cursor: 'pointer', transition: 'all 0.3s ease', position: 'relative',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = cc; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${cc}22` }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  {isSelected && <div style={{ position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: '50%', background: cc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700 }}>✓</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <span style={{ fontSize: 36 }}>{p.emoji}</span>
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>{p.name}</h3>
                      <Tag small color={cc}>{p.category}</Tag>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 14px 0', lineHeight: 1.5 }}>{p.description}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                    {p.strengths.slice(0, 3).map((s, j) => <Tag key={j} small color={cc}>{s.tag}</Tag>)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 11, color: C.textMuted }}>리뷰 {(p.review_count || 0).toLocaleString()}건</span>
                    <span style={{ fontSize: 12, color: cc, fontWeight: 600 }}>맥락 분석 →</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Other Products — Small Icon Cards */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.textMuted }}>전체 제품</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {otherProducts.map((p) => {
              const cc = catColor(p.category)
              const isSelected = selectedProduct?.id === p.id
              return (
                <div key={p.id} onClick={() => selectProduct(p)} style={{
                  background: C.card, border: `1.5px solid ${isSelected ? cc : C.border}`,
                  borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'all 0.25s ease',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = cc; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <span style={{ fontSize: 28 }}>{p.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Tag small color={cc}>{p.category}</Tag>
                      <span style={{ fontSize: 10, color: C.textDim }}>{(p.review_count || 0).toLocaleString()}건</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ─── TAB 2: 맥락 발견 (REDESIGNED) ───
  function renderContextDiscovery() {
    if (!selectedProduct) {
      return <EmptyState icon="⬡" message="제품 분석 탭에서 제품을 먼저 선택해주세요" action="제품 선택하러 가기 →" onAction={() => setActiveTab(1)} />
    }

    const cc = catColor(selectedProduct.category)

    return (
      <div>
        <SectionTitle icon="⬡" title="맥락 발견" subtitle={`${selectedProduct.emoji} ${selectedProduct.name} — AI가 최적의 상황적 맥락 조합을 추천합니다`} />

        {/* Product Summary + AI Button */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 36 }}>{selectedProduct.emoji}</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 6px 0' }}>{selectedProduct.name}</h3>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {selectedProduct.strengths.slice(0, 5).map((s, i) => <Tag key={i} small color={cc}>{s.tag}</Tag>)}
            </div>
          </div>
          <button onClick={() => runContextMatching(selectedProduct)} disabled={isMatching} style={{
            padding: '12px 32px', background: isMatching ? C.border : `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
            color: '#fff', border: 'none', borderRadius: 10, cursor: isMatching ? 'wait' : 'pointer',
            fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.3s ease',
          }}>
            {isMatching ? '◌ AI 분석 중...' : '⬡ AI 맥락 매칭 실행'}
          </button>
        </div>

        {/* 숏폼 유형 선택 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>숏폼 유형 필터</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setSfTypeFilter(null)} style={{ padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: sfTypeFilter === null ? C.accent : C.card, color: sfTypeFilter === null ? C.bg : C.textMuted, border: `1px solid ${sfTypeFilter === null ? C.accent : C.border}`, transition: 'all 0.2s ease' }}>AI 자동 추천</button>
            {Object.values(SF_TYPES).map(t => (
              <button key={t.id} onClick={() => setSfTypeFilter(sfTypeFilter === t.id ? null : t.id)} style={{ padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: sfTypeFilter === t.id ? `${t.color}22` : C.card, color: sfTypeFilter === t.id ? t.color : C.textMuted, border: `1px solid ${sfTypeFilter === t.id ? t.color : C.border}`, transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{t.icon}</span><span>{t.id}. {t.label}</span><span style={{ fontSize: 10, opacity: 0.7 }}>({t.badge})</span>
              </button>
            ))}
          </div>
        </div>

        {/* 6-Axis Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 28 }}>
          {Object.entries(CONTEXT_DIMS).map(([key, dim]) => {
            const productValues = selectedProduct.contexts?.[key] || dim.values.slice(0, 5)
            return (
              <div key={key} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: dim.color }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: dim.color, letterSpacing: '0.06em' }}>{key}</span>
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, lineHeight: 1.4 }}>{dim.question}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {productValues.map((v, i) => <span key={i} style={{ fontSize: 10, padding: '3px 8px', background: `${dim.color}18`, color: dim.color, borderRadius: 10 }}>{v}</span>)}
                </div>
              </div>
            )
          })}
        </div>

        {/* Matched Results (REDESIGNED) */}
        {matchedContexts && (() => {
          const TIER_CONFIG = {
            safe: { label: 'TIER 1 — 검증된 안전 조합', color: C.green, icon: '🟢' },
            cross: { label: 'TIER 2 — 크로스 카테고리', color: C.orange, icon: '🟡' },
            experimental: { label: 'TIER 3 — 파격적/실험적', color: C.purple, icon: '🔵' },
          }
          const tiers = ['safe', 'cross', 'experimental']
          const grouped = {}
          tiers.forEach(t => grouped[t] = [])
          matchedContexts.forEach((ctx, i) => {
            const t = ctx.tier || (i < 3 ? 'safe' : i < 6 ? 'cross' : 'experimental')
            if (grouped[t]) grouped[t].push({ ...ctx, _idx: i })
            else grouped.safe.push({ ...ctx, _idx: i })
          })

          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.accent, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, display: 'inline-block' }} />
                    AI 추천 맥락 조합 TOP {matchedContexts.length}
                  </h3>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: dataSource === 'ai' ? `${C.green}20` : `${C.orange}20`, color: dataSource === 'ai' ? C.green : C.orange, border: `1px solid ${dataSource === 'ai' ? C.green : C.orange}40` }}>
                    {dataSource === 'ai' ? 'AI 실시간 생성' : 'Fallback 데이터'}
                  </span>
                </div>
                <button onClick={() => runContextMatching(selectedProduct)} disabled={isMatching} style={{ padding: '6px 16px', borderRadius: 8, cursor: isMatching ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600, background: C.card, color: C.textMuted, border: `1px solid ${C.border}` }}>
                  {isMatching ? '◌ 생성 중...' : '↻ 재생성'}
                </button>
              </div>

              {tiers.map(tier => {
                const items = grouped[tier]
                if (!items.length) return null
                const cfg = TIER_CONFIG[tier]
                return (
                  <div key={tier} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <span style={{ fontSize: 12 }}>{cfg.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, letterSpacing: '0.04em' }}>{cfg.label}</span>
                      <span style={{ fontSize: 10, color: C.textDim }}>({items.length}개)</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {items.map((ctx) => (
                        <div key={ctx._idx} onClick={() => setSelectedContextIdx(ctx._idx)} style={{
                          background: selectedContextIdx === ctx._idx ? C.surfaceHover : C.card,
                          border: `1px solid ${selectedContextIdx === ctx._idx ? C.accent : C.border}`,
                          borderLeft: `3px solid ${cfg.color}`, borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all 0.3s ease',
                        }}>
                          {/* Header row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                              <span style={{ background: selectedContextIdx === ctx._idx ? C.accent : C.border, color: selectedContextIdx === ctx._idx ? C.bg : C.textMuted, width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{ctx.rank || ctx._idx + 1}</span>
                              {ctx.sf_type && SF_TYPES[ctx.sf_type] && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: `${SF_TYPES[ctx.sf_type].color}20`, color: SF_TYPES[ctx.sf_type].color, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <span>{SF_TYPES[ctx.sf_type].icon}</span>{ctx.sf_type}
                                </span>
                              )}
                              {ctx.axes_used?.map((axis) => (
                                <span key={axis} style={{ fontSize: 10, fontWeight: 700, color: dimColor(axis), background: `${dimColor(axis)}18`, padding: '2px 7px', borderRadius: 8 }}>{axis}</span>
                              ))}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {/* AI producible / 촬영 추천 badge */}
                              {ctx.ai_producible !== undefined && (
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: ctx.ai_producible ? `${C.purple}18` : `${C.blue}18`, color: ctx.ai_producible ? C.purple : C.blue, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  {ctx.ai_producible ? '📷 간편 촬영' : '🎬 연출 촬영'}
                                </span>
                              )}
                              {/* 블루오션 badge */}
                              {ctx.data_evidence?.startsWith('🔵') && (
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: `${C.blue}18`, color: C.blue }}>🔵 블루오션</span>
                              )}
                              <div style={{ background: C.accentDim, padding: '3px 12px', borderRadius: 16, flexShrink: 0 }}>
                                <span style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>{ctx.conversion_score}</span>
                              </div>
                            </div>
                          </div>

                          {/* Hook copy — 🎣 */}
                          {ctx.hook_copy && (
                            <div style={{ marginBottom: 12, padding: '10px 14px', background: `${C.orange}0a`, borderRadius: 10, border: `1px solid ${C.orange}20` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{ fontSize: 14 }}>🎣</span>
                                <span style={{ fontSize: 9, fontWeight: 700, color: C.orange, letterSpacing: '0.06em' }}>HOOK COPY</span>
                              </div>
                              <div style={{ fontSize: 14, color: C.text, fontWeight: 600, lineHeight: 1.4 }}>"{ctx.hook_copy}"</div>
                            </div>
                          )}

                          {/* Axis values */}
                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min((ctx.axes_used || []).filter(a => ctx[a]).length || 1, 3)}, 1fr)`, gap: 6, marginBottom: 10 }}>
                            {(ctx.axes_used || []).filter(dim => ctx[dim]).map(dim => (
                              <div key={dim} style={{ background: `${dimColor(dim)}12`, padding: '6px 10px', borderRadius: 8, border: `1px solid ${dimColor(dim)}20` }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: dimColor(dim), display: 'block', marginBottom: 2, letterSpacing: '0.06em' }}>{dim}</span>
                                <span style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>{ctx[dim]}</span>
                              </div>
                            ))}
                          </div>

                          {/* Insight */}
                          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5, marginBottom: 8 }}>{ctx.insight}</div>

                          {/* Data evidence */}
                          {ctx.data_evidence && (
                            <div style={{ padding: '6px 10px', background: `${C.blue}08`, borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                              <span style={{ fontSize: 11, flexShrink: 0 }}>📊</span>
                              <span style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>{ctx.data_evidence}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Actions */}
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => { setActiveTab(3) }} style={{
                    padding: '14px 40px', background: `linear-gradient(135deg, ${C.accent}, ${C.green})`,
                    color: C.bg, border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 700, transition: 'all 0.2s ease',
                  }}>▸ 이 맥락으로 숏폼 아이디어 생성하기</button>
                </div>
                <p style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>선택된 맥락: #{(selectedContextIdx || 0) + 1} ({matchedContexts[selectedContextIdx]?.WHO || matchedContexts[selectedContextIdx]?.PAIN || '-'})</p>
              </div>
            </div>
          )
        })()}
      </div>
    )
  }

  // ─── TAB 3: 숏폼 제작 ───
  function renderShortformFactory() {
    if (!selectedProduct || !matchedContexts?.length) {
      return <EmptyState icon="▸" message="맥락 발견을 먼저 실행해주세요" action="맥락 발견으로 →" onAction={() => setActiveTab(2)} />
    }
    const ctx = matchedContexts[selectedContextIdx]

    return (
      <div>
        <SectionTitle icon="▸" title="숏폼 제작" subtitle={`${selectedProduct.emoji} ${selectedProduct.name} — 발견 커머스 숏폼 아이디어 자동 생성`} />

        {/* Context Summary */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 24, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {ctx.sf_type && SF_TYPES[ctx.sf_type] && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, marginRight: 4, background: `${SF_TYPES[ctx.sf_type].color}20`, color: SF_TYPES[ctx.sf_type].color, border: `1px solid ${SF_TYPES[ctx.sf_type].color}40` }}>{SF_TYPES[ctx.sf_type].icon} {ctx.sf_type}. {SF_TYPES[ctx.sf_type].label}</span>
          )}
          {(ctx.axes_used || []).filter(dim => ctx[dim]).map(dim => <Tag key={dim} small color={dimColor(dim)}>{dim}: {ctx[dim]}</Tag>)}
        </div>

        {!generatedIdeas ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <button onClick={generateShortformIdeas} disabled={isGenerating} style={{
              padding: '18px 56px', background: isGenerating ? C.border : `linear-gradient(135deg, ${C.orange}, ${C.pink}, ${C.purple})`,
              color: '#fff', border: 'none', borderRadius: 14, cursor: isGenerating ? 'wait' : 'pointer', fontSize: 16, fontWeight: 700,
            }}>
              {isGenerating ? '◌ AI가 숏폼 아이디어를 생성하고 있습니다...' : '▸ 숏폼 아이디어 생성'}
            </button>
            <p style={{ fontSize: 12, color: C.textDim, marginTop: 14 }}>YouTube Shorts + Instagram Reels 각 1개씩 생성됩니다</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {['youtube', 'instagram'].map((platform) => {
                const idea = generatedIdeas[platform]
                if (!idea) return null
                const tmpl = SF_TEMPLATES[platform]
                return (
                  <div key={platform} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', background: `${tmpl.color}12`, borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18, color: tmpl.color }}>{tmpl.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{tmpl.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Tag small color={tmpl.color}>MAX {tmpl.maxSec}s</Tag>
                        <Tag small color={C.textMuted}>{tmpl.ratio}</Tag>
                      </div>
                    </div>
                    <div style={{ padding: 18 }}>
                      <h4 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: '0 0 14px 0', lineHeight: 1.4 }}>&ldquo;{idea.title}&rdquo;</h4>
                      <div style={{ background: `${C.orange}12`, border: `1px solid ${C.orange}28`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.orange, display: 'block', marginBottom: 4, letterSpacing: '0.05em' }}>🎣 HOOK (0~3초)</span>
                        <p style={{ fontSize: 14, color: C.text, margin: 0, fontWeight: 600 }}>{idea.hook}</p>
                        <span style={{ fontSize: 11, color: C.textMuted, marginTop: 4, display: 'block' }}>{idea.hook_pattern}</span>
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.blue, letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>🎬 SCENE FLOW</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {idea.scene_flow?.map((scene, i) => (
                            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <span style={{ background: `${C.blue}22`, color: C.blue, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                              <span style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>{scene}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ background: `${C.green}12`, borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.green, letterSpacing: '0.05em' }}>✓ PROOF</span>
                        <span style={{ fontSize: 12, color: C.text, marginLeft: 8 }}>{idea.proof_point}</span>
                      </div>
                      <div style={{ background: C.accentDim, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.05em' }}>→ CTA</span>
                        <span style={{ fontSize: 12, color: C.text, marginLeft: 8 }}>{idea.cta}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                        {idea.hashtags?.map((h, i) => <span key={i} style={{ fontSize: 11, color: C.textMuted, background: C.surface, padding: '2px 8px', borderRadius: 8 }}>#{h}</span>)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                        <div><span style={{ fontSize: 10, color: C.textDim, display: 'block' }}>업로드 최적시간</span><span style={{ fontSize: 12, color: C.text }}>{idea.best_upload_time}</span></div>
                        <div style={{ textAlign: 'right' }}><span style={{ fontSize: 10, color: C.textDim, display: 'block' }}>타겟 클러스터</span><span style={{ fontSize: 12, color: C.accent }}>{idea.target_cluster}</span></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ textAlign: 'center', marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setGeneratedIdeas(null)} style={{ padding: '10px 28px', background: C.card, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>↻ 같은 맥락으로 재생성</button>
              <button onClick={() => { setActiveTab(2); setGeneratedIdeas(null) }} style={{ padding: '10px 28px', background: C.card, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>⬡ 다른 맥락 선택하러</button>
              <button onClick={() => {
                const studioData = { product: selectedProduct, context: matchedContexts[selectedContextIdx], ideas: generatedIdeas }
                localStorage.setItem('meliens_studio_data', JSON.stringify(studioData))
                router.push('/studio')
              }} style={{ padding: '10px 28px', background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: `0 2px 12px ${C.purple}44` }}>
                📋 촬영 스토리보드 생성
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ─── TAB 4: 시즌 전략 ───
  function renderSeasonStrategy() {
    const currentSeason = SEASON_DATA[selectedMonth]
    return (
      <div>
        <SectionTitle icon="◐" title="시즌 전략" subtitle="월별 최적 제품 × 맥락 조합 로드맵 — 연간 콘텐츠 전략" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6, marginBottom: 28 }}>
          {SEASON_DATA.map((s, i) => (
            <button key={i} onClick={() => setSelectedMonth(i)} style={{
              padding: '10px 2px', background: selectedMonth === i ? C.accent : C.card,
              color: selectedMonth === i ? C.bg : C.textMuted, border: `1px solid ${selectedMonth === i ? C.accent : C.border}`,
              borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: selectedMonth === i ? 700 : 400,
              transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
              <span style={{ fontSize: 14 }}>{s.emoji}</span><span>{s.month}</span>
            </button>
          ))}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.accent}33`, borderRadius: 16, padding: 24, marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0 }}>{currentSeason.emoji} {currentSeason.month} — {currentSeason.theme}</h3>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {currentSeason.keywords.map((k, i) => <Tag key={i} small color={C.purple}>#{k}</Tag>)}
              </div>
            </div>
            <div style={{ background: C.accentDim, padding: '8px 16px', borderRadius: 10 }}>
              <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>추천 제품 {currentSeason.products.length}개</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(currentSeason.products.length, 4)}, 1fr)`, gap: 12 }}>
            {currentSeason.products.map((pid) => {
              const p = PRODUCTS.find(pp => pp.id === pid)
              if (!p) return null
              const cc = catColor(p.category)
              return (
                <div key={pid} onClick={() => selectProduct(p)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = cc }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{p.emoji}</div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 6px 0' }}>{p.name}</h4>
                  <Tag small color={cc}>{p.category}</Tag>
                  <div style={{ marginTop: 10, fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>{p.strengths.slice(0, 2).map(s => s.tag).join(' · ')}</div>
                  <div style={{ marginTop: 10, fontSize: 11, color: cc, fontWeight: 600 }}>맥락 분석 →</div>
                </div>
              )
            })}
          </div>
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.textMuted, marginBottom: 14, letterSpacing: '0.05em' }}>📅 연간 콘텐츠 로드맵</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SEASON_DATA.map((s, i) => {
            const products = s.products.map(pid => PRODUCTS.find(pp => pp.id === pid)).filter(Boolean)
            return (
              <div key={i} onClick={() => setSelectedMonth(i)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: selectedMonth === i ? C.surfaceHover : 'transparent', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', borderLeft: `3px solid ${selectedMonth === i ? C.accent : C.border}`, transition: 'all 0.2s ease' }}>
                <span style={{ fontSize: 14 }}>{s.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: selectedMonth === i ? C.accent : C.textMuted, minWidth: 32 }}>{s.month}</span>
                <span style={{ fontSize: 12, color: C.textMuted, flex: 1 }}>{s.theme}</span>
                <div style={{ display: 'flex', gap: 4 }}>{products.map(p => <span key={p.id} style={{ fontSize: 14 }} title={p.name}>{p.emoji}</span>)}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── MAIN RENDER ───
  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      {/* HEADER */}
      <header style={{
        borderBottom: `1px solid ${C.border}`,
        background: `linear-gradient(180deg, ${C.surface} 0%, ${C.bg} 100%)`,
        padding: '14px 24px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, fontWeight: 900, color: C.bg,
            }}>M</div>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, letterSpacing: '-0.03em', color: C.text }}>
                MELIENS <span style={{ color: C.accent }}>DISCOVERY ENGINE</span>
              </h1>
              <p style={{ fontSize: 10, color: C.textDim, margin: 0, letterSpacing: '0.1em' }}>
                Pentacle × AI ALGORITHM PERFORMANCE PLATFORM
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {selectedProduct && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 16 }}>{selectedProduct.emoji}</span>
                <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{selectedProduct.name}</span>
              </div>
            )}
            <div style={{ background: C.accentDim, borderRadius: 8, padding: '5px 12px' }}>
              <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>Pentacle × AI</span>
            </div>
          </div>
        </div>
      </header>

      {/* STEP INDICATOR NAV */}
      <nav style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', padding: '0 24px', overflowX: 'auto', justifyContent: 'center' }}>
          {tabs.map((tab, i) => {
            const isActive = activeTab === i
            const isCompleted = completedSteps.has(i) && !isActive
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <button onClick={() => setActiveTab(i)} style={{
                  padding: '14px 20px', background: 'transparent',
                  border: 'none', borderBottom: `2px solid ${isActive ? C.accent : 'transparent'}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'all 0.2s ease',
                }}>
                  {/* Step circle */}
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                    background: isActive ? C.accent : isCompleted ? `${C.green}20` : C.border,
                    color: isActive ? C.bg : isCompleted ? C.green : C.textDim,
                    border: isActive ? `2px solid ${C.accent}` : isCompleted ? `2px solid ${C.green}60` : `2px solid ${C.border}`,
                    transition: 'all 0.3s ease',
                  }}>
                    {isCompleted ? '✓' : tab.step}
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: isActive ? 700 : 400,
                    color: isActive ? C.accent : isCompleted ? C.green : C.textMuted,
                    whiteSpace: 'nowrap',
                  }}>
                    {tab.label}
                  </span>
                </button>
                {/* Connector line */}
                {i < tabs.length - 1 && (
                  <div style={{
                    width: 24, height: 2, flexShrink: 0,
                    background: completedSteps.has(i) ? `${C.green}40` : C.border,
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* CONTENT */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {activeTab === 0 && renderChannelInsight()}
        {activeTab === 1 && renderProductAnalysis()}
        {activeTab === 2 && renderContextDiscovery()}
        {activeTab === 3 && renderShortformFactory()}
        {activeTab === 4 && renderSeasonStrategy()}
      </main>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '16px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: C.textDim, margin: 0 }}>
          Pentacle × AI Algorithm Performance Platform — MELIENS DISCOVERY ENGINE v2.0
        </p>
      </footer>
    </div>
  )
}
