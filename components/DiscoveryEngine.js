'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PRODUCTS, CONTEXT_DIMS, SEASON_DATA, SF_TEMPLATES, SF_TYPES, LISTENING_MIND_DATA, CREATOR_DATA } from '@/lib/data'
import DAiCreativeEngine from './DAiCreativeEngine'

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
  // activeTab: 'insight' | 0(제품분석) | 1(맥락발견) | 2(숏폼제작) | 3(시즌전략)
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

  // ─── TAB CONFIG ───
  // 프로세스 스텝: ① 제품 분석 → ② 맥락 발견 → ③ 숏폼 제작 → ④ 시즌 전략
  // AI 성과 Insight는 별도 대시보드 탭 (스텝 번호 없음)
  const stepTabs = [
    { label: '제품 분석', icon: '◈', step: 1 },
    { label: '맥락 발견', icon: '⬡', step: 2 },
    { label: '숏폼 제작', icon: '▸', step: 3 },
    { label: '시즌 전략', icon: '◐', step: 4 },
  ]

  // 완료 단계 추적 (product selected, context matched, ideas generated, season)
  const completedSteps = new Set()
  if (selectedProduct) completedSteps.add(0)
  if (matchedContexts) completedSteps.add(1)
  if (generatedIdeas) completedSteps.add(2)

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
      tier: i < 4 ? 'safe' : i < 7 ? 'cross' : 'experimental',
    }))
    const fallbacks = {
      clenser: base([
        { rank: 1, thinking_direction: "forward", sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "자취 1년차 사회초년생", PAIN: "세안해도 남아있는 잔여 메이크업", conversion_score: 96, hook_copy: "이거 안 쓰면 세안 반만 한 거임", ai_producible: true, insight: "WHO의 시간 부족 + PAIN의 잔여물 고민", data_evidence: "🟢 검색: '클렌저 추천' 월 8,100회 | VOC: '피부 매끈' 만족 반응 최다" },
        { rank: 2, thinking_direction: "forward", sf_type: "B", axes_used: ["PAIN", "NEED"], PAIN: "일반 세안으로 잔여 메이크업이 안 지워짐", NEED: "눈에 보이는 세정력 차이", conversion_score: 93, hook_copy: "손으로 세안 vs 진동클렌저, 잔여물 차이 봐봐", ai_producible: false, insight: "초미세진동 12,000회 vs 손세안 비교 기능 증명", data_evidence: "🟡 검색: '클렌저 세정력 비교' I 85%" },
        { rank: 3, thinking_direction: "forward", sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "뷰티 관심 대학생", PAIN: "피부 트러블 반복되는데 원인 모름", conversion_score: 90, hook_copy: "트러블 원인이 세안법이었다고?", ai_producible: true, insight: "트러블 원인 미지 — 세안법 솔루션", data_evidence: "🟢 검색: '피부 트러블 원인' 월 5,400회" },
        { rank: 4, thinking_direction: "forward", sf_type: "C", axes_used: ["WHO", "INTEREST"], WHO: "갓생러 루틴 관심자", INTEREST: "자기계발/갓생", conversion_score: 85, hook_copy: "갓생 루틴의 시작은 세안부터", ai_producible: true, insight: "자기계발 관심사와 스킨케어 루틴 연결", data_evidence: "🟡 검색: '갓생 루틴' 1월 +140%" },
        { rank: 5, thinking_direction: "reverse", sf_type: "B", axes_used: ["PAIN", "NEED"], PAIN: "초미세 진동 12,000회가 일반 손세안 대비 모공 속 잔여물 90% 제거", NEED: "수치로 증명되는 세정력", conversion_score: 88, hook_copy: "12,000회 진동이 피부에서 뭘 하는지 보여줄게", ai_producible: true, insight: "제품 스펙(12,000회 초미세진동)에서 역으로 세정력 불안 소비자를 타겟", data_evidence: "🟢 검색: '진동클렌저 효과' 월 3,200회 | VOC: '진동 차이 체감'" },
        { rank: 6, thinking_direction: "reverse", sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "IPX7 방수 필요한 욕실 사용자", PAIN: "클렌저 물 들어가서 고장남", conversion_score: 82, hook_copy: "욕실에서 쓰는 클렌저, 방수 안 되면 3개월 수명", ai_producible: true, insight: "IPX7 방수 스펙에서 출발 → 욕실 사용 중 고장 경험자 타겟", data_evidence: "🟡 검색: '방수 클렌저' 월 1,800회 | '클렌저 고장' 검색 존재" },
        { rank: 7, thinking_direction: "reverse", sf_type: "C", axes_used: ["WHO", "INTEREST"], WHO: "부모님 선물 고민 자녀", INTEREST: "효도/가족", conversion_score: 80, hook_copy: "3만원으로 엄마 피부 바꿔드렸더니...", ai_producible: false, insight: "선물 카테고리와 뷰티 연결", data_evidence: "🟢 검색: '어버이날 선물 추천' 급증" },
        { rank: 8, thinking_direction: "extended", sf_type: "A", axes_used: ["WHO", "SWITCH_FROM"], WHO: "다이소 클렌저 사용자", SWITCH_FROM: "다이소 3,000원 진동클렌저", conversion_score: 75, hook_copy: "다이소 클렌저 3개 사고 결국 이거 샀다", ai_producible: true, insight: "SWITCH_FROM 축: 저가 대안에서 전환하는 소비자 타겟", data_evidence: "🟡 검색: '다이소 클렌저 후기' 월 2,100회" },
        { rank: 9, thinking_direction: "extended", sf_type: "C", axes_used: ["WHO", "TRIGGER"], WHO: "피부과 상담 후 스킨케어 시작하는 사람", TRIGGER: "피부과 방문 직후", conversion_score: 70, hook_copy: "피부과에서 세안법 바꾸라고 했는데 뭘로?", ai_producible: false, insight: "TRIGGER 축: 피부과 방문이라는 생애 이벤트가 구매 촉발", data_evidence: "🔵 신규 기회 — '피부과 후 관리' 검색 증가 추세" },
        { rank: 10, thinking_direction: "extended", sf_type: "B", axes_used: ["PAIN", "BARRIER"], PAIN: "진동클렌저가 피부에 자극될까 걱정", BARRIER: "민감성 피부 자극 우려", conversion_score: 68, hook_copy: "민감성인데 진동클렌저 써도 되냐고요?", ai_producible: true, insight: "BARRIER 축: 구매를 막는 우려를 정면 돌파하는 콘텐츠", data_evidence: "🔵 신규 기회 — '진동클렌저 부작용' 검색 284회/월" },
      ]),
    }
    const defaultFallback = (p) => base([
      { rank: 1, thinking_direction: "forward", sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "일반 소비자", PAIN: `${p.strengths?.[0]?.tag || p.name} 없어서 불편`, conversion_score: 90, hook_copy: "이거 없이 어떻게 살았지?", ai_producible: true, insight: "기본 페인포인트 자극", data_evidence: "🟡 기본 폴백" },
      { rank: 2, thinking_direction: "reverse", sf_type: "B", axes_used: ["PAIN", "NEED"], PAIN: "기존 제품이 불만족", NEED: `${p.strengths?.[1]?.tag || '편의성'}`, conversion_score: 85, hook_copy: "기존 거 vs 이거, 차이 실화?", ai_producible: false, insight: "기능 비교 증명", data_evidence: "🟡 기본 폴백" },
      { rank: 3, thinking_direction: "extended", sf_type: "C", axes_used: ["WHO", "WHEN", "WHERE"], WHO: "트렌드 민감 소비자", WHEN: "일상 속", WHERE: "집에서", conversion_score: 80, hook_copy: "요즘 핫한 거 발견했는데...", ai_producible: true, insight: "라이프스타일 배치", data_evidence: "🟡 기본 폴백" },
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
    setActiveTab(1) // 맥락 발견 탭으로 이동
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

  // AI 성과 Insight 탭 진입 시 채널 데이터 로드
  useEffect(() => {
    if (activeTab === 'insight' && !channelData && !isLoadingChannel) {
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

        {/* ═══ ListeningMind 검색 데이터 섹션 ═══ */}
        {LISTENING_MIND_DATA && (() => {
          const lm = LISTENING_MIND_DATA
          const brand = lm.brand
          // 제품별 검색량 비교 데이터
          const productSearchData = Object.entries(lm.products)
            .map(([id, data]) => {
              const topKw = data.keywords.reduce((max, kw) => kw.monthly_avg > max.monthly_avg ? kw : max, data.keywords[0])
              return { id, name: data.name, topKeyword: topKw.keyword, monthly_avg: topKw.monthly_avg, trend: topKw.trend, gender: data.gender, age: data.age }
            })
            .sort((a, b) => b.monthly_avg - a.monthly_avg)
          const maxSearchVol = productSearchData[0]?.monthly_avg || 1

          return (
            <>
              {/* Brand Search Trend */}
              <div style={{ background: `linear-gradient(135deg, ${C.accent}10, ${C.blue}08)`, border: `1px solid ${C.accent}30`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 16 }}>🔍</span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.accent, margin: 0 }}>리스닝마인드 검색 데이터</h3>
                  <span style={{ fontSize: 10, color: C.textDim, marginLeft: 'auto' }}>실제 소비자 검색 행동 기반</span>
                </div>
                {/* Brand overview cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                  <div style={{ background: C.card, borderRadius: 10, padding: 14, textAlign: 'center', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>브랜드 월검색량</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>{brand.monthly_avg.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: brand.trend >= 0 ? C.green : C.red, fontWeight: 600 }}>{brand.trend >= 0 ? '▲' : '▼'} {Math.abs(brand.trend * 100).toFixed(0)}%</div>
                  </div>
                  <div style={{ background: C.card, borderRadius: 10, padding: 14, textAlign: 'center', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>여성 비율</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.pink }}>{brand.gender.female.toFixed(0)}%</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>남성 {brand.gender.male.toFixed(0)}%</div>
                  </div>
                  <div style={{ background: C.card, borderRadius: 10, padding: 14, textAlign: 'center', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>핵심 연령대</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.blue }}>30대</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>{brand.age['30-39']}%</div>
                  </div>
                  <div style={{ background: C.card, borderRadius: 10, padding: 14, textAlign: 'center', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>제품 수</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{Object.keys(lm.products).length}</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>카테고리</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, padding: '10px 14px', background: C.card, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  💡 {brand.insight}
                </div>
              </div>

              {/* Product Search Volume Comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: C.accent }}>📊</span> 제품별 검색량 비교
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {productSearchData.map((pd) => {
                      const p = PRODUCTS.find(pp => pp.id === pd.id)
                      return (
                        <div key={pd.id} style={{ padding: '10px 12px', background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 16 }}>{p?.emoji || '📦'}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1 }}>{pd.name}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: pd.trend >= 0 ? C.green : C.red }}>{pd.trend >= 0 ? '▲' : '▼'}{Math.abs(pd.trend * 100).toFixed(0)}%</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${(pd.monthly_avg / maxSearchVol * 100)}%`, height: '100%', background: C.accent, borderRadius: 3, transition: 'width 0.6s ease' }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, minWidth: 60, textAlign: 'right' }}>{pd.monthly_avg.toLocaleString()}/월</span>
                          </div>
                          <div style={{ fontSize: 10, color: C.textDim, marginTop: 3 }}>"{pd.topKeyword}"</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Competitor Comparison */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: C.red }}>⚔️</span> 경쟁 환경
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {Object.entries(lm.competitive_landscape).map(([key, desc]) => (
                      <div key={key} style={{ padding: '12px 14px', background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.red}` }}>
                        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{desc}</div>
                      </div>
                    ))}
                  </div>
                  {/* Product-level competitors */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>제품별 경쟁사</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Object.entries(lm.products).flatMap(([id, data]) =>
                        data.competitors.map(comp => ({ id, comp }))
                      ).reduce((acc, { comp }) => {
                        if (!acc.find(c => c === comp)) acc.push(comp)
                        return acc
                      }, []).slice(0, 12).map((comp, i) => (
                        <span key={i} style={{ fontSize: 10, padding: '3px 8px', background: `${C.red}12`, color: C.red, borderRadius: 10, border: `1px solid ${C.red}20` }}>{comp}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Insights Cards */}
              <div style={{ background: `linear-gradient(135deg, ${C.orange}10, ${C.green}06)`, border: `1px solid ${C.orange}30`, borderRadius: 14, padding: 20, marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 16 }}>💡</span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.orange, margin: 0 }}>검색 데이터 기반 숏폼 핵심 인사이트</h3>
                  <span style={{ fontSize: 10, color: C.textDim, marginLeft: 'auto' }}>{lm.key_insights_for_shortform.length}개</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {lm.key_insights_for_shortform.map((insight, i) => {
                    const colors = [C.accent, C.blue, C.green, C.orange, C.pink, C.purple, C.red, C.accent, C.blue]
                    const color = colors[i % colors.length]
                    return (
                      <div key={i} style={{ padding: '14px', background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, borderTop: `3px solid ${color}` }}>
                        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{insight}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )
        })()}

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
      return <EmptyState icon="⬡" message="제품 분석 탭에서 제품을 먼저 선택해주세요" action="제품 선택하러 가기 →" onAction={() => setActiveTab(0)} />
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

        {/* Matched Results — Phone Preview + Detail List */}
        {matchedContexts && (() => {
          const SF_TYPE_BG = {
            A: 'linear-gradient(160deg, #1a0808 0%, #2d1111 40%, #1a0505 100%)',
            B: 'linear-gradient(160deg, #081a0e 0%, #112d18 40%, #051a0a 100%)',
            C: 'linear-gradient(160deg, #0d081a 0%, #18112d 40%, #0a051a 100%)',
          }
          const SF_TYPE_BG_DEFAULT = 'linear-gradient(160deg, #0a0a1a 0%, #11112d 40%, #05051a 100%)'

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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {matchedContexts.map((ctx, idx) => {
                  const isBlueOcean = ctx.data_evidence?.startsWith('🔵') || ctx.tier === 'experimental'
                  const sfType = ctx.sf_type && SF_TYPES[ctx.sf_type] ? SF_TYPES[ctx.sf_type] : null
                  const phoneBg = SF_TYPE_BG[ctx.sf_type] || SF_TYPE_BG_DEFAULT
                  const phoneBorder = isBlueOcean ? C.blue : (sfType ? sfType.color + '60' : C.border)
                  const isSelected = selectedContextIdx === idx
                  const scenes = ctx.scene_flow || [
                    ctx.WHO ? `${ctx.WHO} 등장` : '일상 장면',
                    ctx.PAIN || ctx.NEED || '문제 인식',
                    `${selectedProduct?.name} 사용`,
                    ctx.insight?.slice(0, 20) + '...' || 'CTA',
                  ]

                  return (
                    <div key={idx} onClick={() => setSelectedContextIdx(idx)} style={{
                      display: 'flex', gap: 20, padding: 20, cursor: 'pointer',
                      background: isSelected ? C.surfaceHover : C.card,
                      border: `1px solid ${isSelected ? C.accent : C.border}`,
                      borderRadius: 16, transition: 'all 0.3s ease',
                      position: 'relative',
                    }}>
                      {/* ─── LEFT: Phone Frame ─── */}
                      <div style={{ flexShrink: 0, position: 'relative' }}>
                        {isBlueOcean && (
                          <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', zIndex: 2, padding: '1px 8px', borderRadius: 6, background: C.blue, fontSize: 8, fontWeight: 800, color: '#fff', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>BLUE OCEAN</div>
                        )}
                        <div style={{
                          width: 140, height: 248, borderRadius: 16, overflow: 'hidden', position: 'relative',
                          border: `2px solid ${phoneBorder}`,
                          background: phoneBg,
                          boxShadow: isSelected ? `0 0 20px ${(sfType?.color || C.accent)}30` : 'none',
                        }}>
                          {/* Notch */}
                          <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: 40, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.1)', zIndex: 3 }} />
                          {/* Type badge */}
                          {sfType && (
                            <div style={{ position: 'absolute', top: 16, left: 8, zIndex: 3, padding: '2px 6px', borderRadius: 4, background: `${sfType.color}30`, backdropFilter: 'blur(4px)' }}>
                              <span style={{ fontSize: 8, fontWeight: 700, color: sfType.color }}>{sfType.icon} {sfType.label}</span>
                            </div>
                          )}
                          {/* Hook copy center */}
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '36px 12px 40px' }}>
                            <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: 1.5, margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.6)', wordBreak: 'keep-all' }}>
                              {ctx.hook_copy ? `"${ctx.hook_copy}"` : `"${ctx.insight?.slice(0, 30) || '후킹 카피'}"`}
                            </p>
                          </div>
                          {/* Bottom social icons */}
                          <div style={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', zIndex: 3 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span style={{ fontSize: 14 }}>♡</span>
                              <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>{Math.floor(Math.random() * 900 + 100)}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span style={{ fontSize: 12 }}>💬</span>
                              <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>{Math.floor(Math.random() * 90 + 10)}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span style={{ fontSize: 12 }}>↗</span>
                            </div>
                          </div>
                          {/* Bottom bar */}
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${sfType?.color || C.accent}, transparent)` }} />
                        </div>
                      </div>

                      {/* ─── RIGHT: Detail Info ─── */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Header: rank + title + score */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ background: isSelected ? C.accent : C.border, color: isSelected ? C.bg : C.textMuted, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{ctx.rank || idx + 1}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ctx.insight?.split(/[.。!！]/)[0] || '맥락 조합 아이디어'}
                          </span>
                          <div style={{ background: C.accentDim, padding: '2px 10px', borderRadius: 12, flexShrink: 0 }}>
                            <span style={{ fontSize: 16, fontWeight: 800, color: C.accent }}>{ctx.conversion_score}</span>
                          </div>
                        </div>

                        {/* Description */}
                        <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 8px 0', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{ctx.insight}</p>

                        {/* Context Tags */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                          {sfType && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: `${sfType.color}20`, color: sfType.color }}>{sfType.icon} {ctx.sf_type}</span>
                          )}
                          {ctx.thinking_direction && (() => {
                            const dirMap = { forward: { icon: '👤', label: '소비자 기점', color: C.green }, reverse: { icon: '🔧', label: '제품 기점', color: C.orange }, extended: { icon: '🔮', label: '확장 탐색', color: C.purple } }
                            const dir = dirMap[ctx.thinking_direction] || dirMap.forward
                            return <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: `${dir.color}20`, color: dir.color }}>{dir.icon} {dir.label}</span>
                          })()}
                          {(ctx.axes_used || []).filter(dim => ctx[dim]).map(dim => (
                            <span key={dim} style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 5, background: `${dimColor(dim)}15`, color: dimColor(dim) }}>{dim}: {ctx[dim]}</span>
                          ))}
                        </div>

                        {/* Data Evidence */}
                        {ctx.data_evidence && (
                          <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start', marginBottom: 8 }}>
                            <span style={{ fontSize: 10, flexShrink: 0 }}>📊</span>
                            <span style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.5 }}>{ctx.data_evidence}</span>
                          </div>
                        )}

                        {/* Hook copy preview */}
                        {ctx.hook_copy && (
                          <div style={{ borderLeft: `2px solid ${C.orange}`, paddingLeft: 10, marginBottom: 8 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: C.orange, letterSpacing: '0.05em' }}>🎣 HOOK</span>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.4, marginTop: 2 }}>"{ctx.hook_copy}"</div>
                          </div>
                        )}

                        {/* 4-Scene Mini Flow */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 10 }}>
                          {scenes.slice(0, 4).map((s, i) => (
                            <div key={i} style={{ background: C.surface, borderRadius: 6, padding: '4px 6px', textAlign: 'center', border: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 8, fontWeight: 700, color: C.textDim, marginBottom: 2 }}>씬{i + 1}</div>
                              <div style={{ fontSize: 9, color: C.textMuted, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeof s === 'string' ? s : s.desc || s.text || `씬 ${i+1}`}</div>
                            </div>
                          ))}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {ctx.ai_producible !== undefined && (
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: ctx.ai_producible ? `${C.purple}18` : `${C.blue}18`, color: ctx.ai_producible ? C.purple : C.blue }}>
                              {ctx.ai_producible ? '🤖 AI 영상 가능' : '📷 촬영 추천'}
                            </span>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); setSelectedContextIdx(idx); setActiveTab(2) }} style={{
                            fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: `linear-gradient(135deg, ${C.accent}, ${C.green})`, color: C.bg,
                          }}>촬영 스토리보드 생성 →</button>
                          <button onClick={(e) => { e.stopPropagation(); runContextMatching(selectedProduct) }} disabled={isMatching} style={{
                            fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.textMuted, cursor: isMatching ? 'wait' : 'pointer',
                          }}>↻ 재생성</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
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
      return <EmptyState icon="▸" message="맥락 발견을 먼저 실행해주세요" action="맥락 발견으로 →" onAction={() => setActiveTab(1)} />
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
              <button onClick={() => { setActiveTab(1); setGeneratedIdeas(null) }} style={{ padding: '10px 28px', background: C.card, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>⬡ 다른 맥락 선택하러</button>
              <button onClick={() => {
                const studioData = { product: selectedProduct, context: matchedContexts[selectedContextIdx], ideas: generatedIdeas }
                localStorage.setItem('meliens_studio_data', JSON.stringify(studioData))
                router.push('/studio')
              }} style={{ padding: '10px 28px', background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: `0 2px 12px ${C.purple}44` }}>
                📋 촬영 스토리보드 생성
              </button>
            </div>

            {/* ─── 크리에이터 협업 방안 ─── */}
            {renderCreatorCollaboration()}
          </>
        )}
      </div>
    )
  }

  // ─── 크리에이터 협업 방안 렌더링 ───
  function renderCreatorCollaboration() {
    if (!selectedProduct || !CREATOR_DATA) return null

    const productName = selectedProduct.name
    const ctx = matchedContexts?.[selectedContextIdx]

    // 제품명에 매칭되는 카테고리 필터링 (group_purchase 제외)
    const matchedCategories = Object.entries(CREATOR_DATA.categories)
      .filter(([key, cat]) => key !== 'group_purchase' && cat.relevantProducts.some(rp => productName.includes(rp) || rp.includes(productName.split(' ')[0])))
    const groupPurchase = CREATOR_DATA.categories.group_purchase

    // 매칭된 카테고리가 없으면 전체 표시 (group_purchase 제외)
    const categoriesToShow = matchedCategories.length > 0
      ? matchedCategories
      : Object.entries(CREATOR_DATA.categories).filter(([key]) => key !== 'group_purchase')

    // 모든 크리에이터를 티어별로 그룹핑
    const allCreators = categoriesToShow.flatMap(([, cat]) => cat.creators.map(c => ({ ...c, category: cat.name })))
    const byTier = { MEGA: [], MID: [], MICRO: [] }
    allCreators.forEach(c => { if (byTier[c.tier]) byTier[c.tier].push(c) })

    // 협업 맥락 텍스트 생성
    const collabContext = ctx
      ? `"${ctx.hook_copy || ctx.insight || ''}" — ${(ctx.axes_used || []).filter(d => ctx[d]).map(d => ctx[d]).join(' × ')} 타겟`
      : `${productName} 숏폼 콘텐츠 협업`

    const collabDirection = ctx
      ? `${ctx.WHO || '타겟 소비자'}의 "${ctx.PAIN || '일상 불편'}" 문제를 크리에이터가 직접 체험 → 솔직한 사용기로 공감 유발`
      : `${productName}의 핵심 강점을 크리에이터의 일상에 자연스럽게 배치하여 발견형 구매 유도`

    // 크리에이터 유형 태그
    const creatorTypeTags = ctx?.INTEREST
      ? [`${ctx.INTEREST} 크리에이터`, '일상 브이로거', '리뷰 전문']
      : ['생활 리뷰어', '일상 브이로거', '가성비 큐레이터']

    const tagColors = [C.pink, C.green, C.orange]

    function CreatorCard({ creator, tierColor }) {
      const tierInfo = CREATOR_DATA.tiers[creator.tier]
      return (
        <div style={{
          background: C.surface, borderLeft: `3px solid ${tierColor}`, borderRadius: 10,
          padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: tierColor, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{creator.name}</span>
              {tierInfo?.recommended && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: `${C.green}22`, color: C.green, border: `1px solid ${C.green}33` }}>추천</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: C.textDim }}>{creator.platform}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: tierColor }}>{creator.subs}</span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: C.textMuted, margin: 0, lineHeight: 1.4 }}>{creator.desc}</p>
          <p style={{ fontSize: 10, color: C.accent, margin: 0, lineHeight: 1.4 }}>{creator.matchReason}</p>
        </div>
      )
    }

    return (
      <div style={{ marginTop: 32 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 18, color: C.accent }}>🤝</span>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.02em' }}>크리에이터 협업 방안</h2>
          </div>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0, marginLeft: 28 }}>발견된 기회에서 크리에이터와 협업하면 숏폼의 도달과 신뢰를 동시에 높일 수 있습니다</p>
        </div>

        {/* 협업 맥락 카드 */}
        <div style={{
          background: C.card, borderLeft: `3px solid ${C.accent}`, borderRadius: 12,
          padding: 18, marginBottom: 20,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.06em', marginBottom: 8 }}>협업 콘텐츠 방향</div>
          <p style={{ fontSize: 13, color: C.text, fontWeight: 600, margin: '0 0 8px 0', lineHeight: 1.5 }}>{collabDirection}</p>
          <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic', marginBottom: 10 }}>{collabContext}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {creatorTypeTags.map((tag, i) => (
              <span key={i} style={{
                fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                background: `${tagColors[i % tagColors.length]}18`, color: tagColors[i % tagColors.length],
                border: `1px solid ${tagColors[i % tagColors.length]}30`,
              }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* 티어별 크리에이터 추천 */}
        {['MEGA', 'MID', 'MICRO'].map(tierKey => {
          const creators = byTier[tierKey]
          if (!creators.length) return null
          const tierInfo = CREATOR_DATA.tiers[tierKey]
          return (
            <div key={tierKey} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: tierInfo.color }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: tierInfo.color }}>{tierInfo.label}</span>
                {tierInfo.recommended && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${C.green}18`, color: C.green }}>비용 효율적, 전환율 높은 충성 팬층</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {creators.map((c, i) => <CreatorCard key={i} creator={c} tierColor={tierInfo.color} />)}
              </div>
            </div>
          )
        })}

        {/* 공동구매 크리에이터 */}
        {groupPurchase && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>🛒</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.pink }}>공동구매 크리에이터</span>
            </div>
            <div style={{
              background: `${C.pink}08`, border: `1px solid ${C.pink}22`, borderRadius: 12,
              padding: 16, marginBottom: 12,
            }}>
              <div style={{ fontSize: 11, color: C.pink, fontWeight: 600, marginBottom: 6 }}>공동구매 기획 방향</div>
              <p style={{ fontSize: 12, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>
                멜리언스 특가 + 한정수량 FOMO + 크리에이터 전용 할인코드 조합.
                시즌 이벤트(설/추석/블프)와 연계하면 전환율 극대화.
                번들 구성(예: 거치대+카드지갑+링홀더 세트) 시 객단가 상승 효과.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groupPurchase.creators.map((c, i) => <CreatorCard key={i} creator={c} tierColor={C.pink} />)}
            </div>
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setActiveTab(0)}>
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

      {/* STEP INDICATOR NAV + AI 성과 Insight (별도 탭) */}
      <nav style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', padding: '0 24px', overflowX: 'auto', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Process Steps */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {stepTabs.map((tab, i) => {
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
                  {i < stepTabs.length - 1 && (
                    <div style={{
                      width: 24, height: 2, flexShrink: 0,
                      background: completedSteps.has(i) ? `${C.green}40` : C.border,
                    }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* 별도 대시보드 탭들 (스텝 번호 없음) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 16 }}>
            <button onClick={() => setActiveTab('insight')} style={{
              padding: '14px 16px', background: 'transparent',
              border: 'none', borderBottom: `2px solid ${activeTab === 'insight' ? C.purple : 'transparent'}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.2s ease',
            }}>
              <span style={{
                fontSize: 16, color: activeTab === 'insight' ? C.purple : C.textDim,
                transition: 'all 0.3s ease',
              }}>◉</span>
              <span style={{
                fontSize: 13, fontWeight: activeTab === 'insight' ? 700 : 400,
                color: activeTab === 'insight' ? C.purple : C.textDim,
                whiteSpace: 'nowrap',
              }}>
                AI 성과 Insight
              </span>
            </button>
            <button onClick={() => setActiveTab('dai-creative')} style={{
              padding: '14px 16px', background: 'transparent',
              border: 'none', borderBottom: `2px solid ${activeTab === 'dai-creative' ? '#f59e0b' : 'transparent'}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.2s ease',
            }}>
              <span style={{
                fontSize: 16, color: activeTab === 'dai-creative' ? '#f59e0b' : C.textDim,
                transition: 'all 0.3s ease',
              }}>◆</span>
              <span style={{
                fontSize: 13, fontWeight: activeTab === 'dai-creative' ? 700 : 400,
                color: activeTab === 'dai-creative' ? '#f59e0b' : C.textDim,
                whiteSpace: 'nowrap',
              }}>
                DAi Creative
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* CONTENT */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {activeTab === 'dai-creative' && <DAiCreativeEngine />}
        {activeTab === 'insight' && renderChannelInsight()}
        {activeTab === 0 && renderProductAnalysis()}
        {activeTab === 1 && renderContextDiscovery()}
        {activeTab === 2 && renderShortformFactory()}
        {activeTab === 3 && renderSeasonStrategy()}
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
