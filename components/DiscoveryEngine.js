'use client'

import { useState, useEffect } from 'react'
import { PRODUCTS, CONTEXT_DIMS, SEASON_DATA, SF_TEMPLATES } from '@/lib/data'

// ─── STYLE CONSTANTS ───
const C = {
  bg: '#0a0b0f', surface: '#12131a', surfaceHover: '#1a1b25',
  card: '#16171f', border: '#2a2b35', borderLight: '#3a3b45',
  text: '#e8e9ed', textMuted: '#8b8d9a', textDim: '#5a5c6a',
  accent: '#4ecdc4', accentDim: '#4ecdc433',
  purple: '#a78bfa', orange: '#f59e0b', pink: '#f472b6',
  blue: '#60a5fa', green: '#34d399', red: '#f87171',
}

const dimColor = (key) => CONTEXT_DIMS[key]?.color || C.accent

// ─── REUSABLE UI COMPONENTS ───

function ImpactBar({ value }) {
  const color = value > 90 ? C.accent : value > 80 ? C.blue : C.textDim
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.8s ease' }} />
      </div>
      <span style={{ fontSize: 11, color: C.textMuted, minWidth: 28, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

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
    <div style={{ marginBottom: 24 }}>
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

  const tabs = [
    { label: '제품 DNA', icon: '◈' },
    { label: '맥락 매칭 엔진', icon: '⬡' },
    { label: '숏폼 팩토리', icon: '▸' },
    { label: '시즌 캘린더', icon: '◐' },
  ]

  // ─── AI CALLS ───

  async function runContextMatching(product) {
    setIsMatching(true)
    setMatchedContexts(null)
    setGeneratedIdeas(null)
    setSelectedContextIdx(0)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'context_match', product }),
      })
      const data = await res.json()
      if (data.result) {
        setMatchedContexts(data.result)
      } else {
        throw new Error(data.error || 'AI 응답 오류')
      }
    } catch (e) {
      console.error('Context matching error:', e)
      // Fallback data for demo
      setMatchedContexts(generateFallbackContexts(product))
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
        throw new Error(data.error || 'AI 응답 오류')
      }
    } catch (e) {
      console.error('Shortform generation error:', e)
      setGeneratedIdeas(generateFallbackIdeas(selectedProduct, ctx))
    }
    setIsGenerating(false)
  }

  // ─── FALLBACK DATA (for demo without API key) ───

  function generateFallbackContexts(product) {
    const fallbacks = {
      clenser: [
        { rank: 1, WHO: "자취 1년차 사회초년생", WHEN: "아침 출근 30분 전", WHERE: "원룸 세면대", PAIN: "세안해도 남아있는 잔여 메이크업", NEED: "빠르고 확실한 클렌징", INTEREST: "갓생/루틴", conversion_score: 96, insight: "시간 부족 + 피부 고민이 겹치는 순간, 원터치 솔루션이 즉각 구매를 유발" },
        { rank: 2, WHO: "부모님 선물 고민 자녀", WHEN: "어버이날 시즌", WHERE: "온라인 쇼핑 중", PAIN: "실용적이면서 센스있는 선물을 모름", NEED: "선물 센스 인정받기", INTEREST: "효도/가족", conversion_score: 93, insight: "3만원대 가격 + 카카오프렌즈 에디션이 선물로 완벽한 밸런스" },
        { rank: 3, WHO: "뷰티 관심 대학생", WHEN: "환절기 피부 변화기", WHERE: "기숙사 공용 세면대", PAIN: "피부 트러블이 반복되는데 원인 모름", NEED: "확실한 피부 관리 루틴", INTEREST: "뷰티/스킨케어", conversion_score: 90, insight: "세안 방법 자체가 원인일 수 있다는 깨달음이 구매 동기" },
        { rank: 4, WHO: "갓생러 루틴 관심자", WHEN: "새해 첫 주", WHERE: "SNS 피드 스크롤 중", PAIN: "루틴을 시작하고 싶은데 뭘 사야 할지 모름", NEED: "시작하기 쉬운 루틴 아이템", INTEREST: "갓생/루틴", conversion_score: 87, insight: "새해 다짐 시즌 + 진입 장벽 낮은 가격이 충동 구매 트리거" },
        { rank: 5, WHO: "인플루언서/리뷰어", WHEN: "신제품 출시 시점", WHERE: "콘텐츠 촬영 스튜디오", PAIN: "리뷰할 만한 가성비 뷰티템 부족", NEED: "콘텐츠 소재 + 팔로워 반응", INTEREST: "뷰티/스킨케어", conversion_score: 84, insight: "12종 컬러 + ASMR 요소가 콘텐츠 소재로 매력적" },
      ],
      lint: [
        { rank: 1, WHO: "니트 즐겨 입는 직장인", WHEN: "겨울 니트 시즌 시작", WHERE: "드레스룸 거울 앞", PAIN: "좋아하는 니트에 보풀이 생겨 낡아 보임", NEED: "옷을 새것처럼 유지", INTEREST: "데일리룩/패션", conversion_score: 97, insight: "눈으로 즉시 확인 가능한 Before-After가 가장 강력한 구매 트리거" },
        { rank: 2, WHO: "자취 1년차", WHEN: "주말 대청소", WHERE: "원룸 소파/침구", PAIN: "소파에 보풀이 쌓여 지저분해 보임", NEED: "깔끔한 생활공간 유지", INTEREST: "자취생 꿀팁", conversion_score: 94, insight: "ASMR + 청소 만족감이 숏폼 시청 유지율을 극대화" },
        { rank: 3, WHO: "30대 워킹맘", WHEN: "아이 등원 준비 아침", WHERE: "아이 옷장 앞", PAIN: "아이 옷에 보풀이 계속 생김", NEED: "빠른 아침 준비", INTEREST: "육아/정리정돈", conversion_score: 91, insight: "아이 옷 관리라는 공감 맥락이 뷰티/패션 외 타겟까지 확장" },
      ],
      carholder: [
        { rank: 1, WHO: "차량 통근자", WHEN: "출퇴근 시간", WHERE: "차 안 운전석", PAIN: "기존 거치대가 주행중 흔들려서 불안", NEED: "안전하고 편한 내비 사용", INTEREST: "자동차/드라이빙", conversion_score: 96, insight: "과속방지턱 테스트 영상이 기능 증명의 결정적 장면" },
        { rank: 2, WHO: "신차 구매자", WHEN: "차량 인테리어 세팅 시점", WHERE: "차 안", PAIN: "차 인테리어에 맞는 깔끔한 거치대가 없음", NEED: "프리미엄 차량 액세서리", INTEREST: "자동차/드라이빙", conversion_score: 92, insight: "신차 세팅 콘텐츠 관심사에서 자연스럽게 발견" },
      ],
    }
    return fallbacks[product.id] || fallbacks.clenser
  }

  function generateFallbackIdeas(product, ctx) {
    return {
      youtube: {
        title: `${ctx.PAIN.slice(0, 8)}... 이거면 끝`,
        hook: `"솔직히 말할게, ${ctx.PAIN}"`,
        hook_pattern: "고백형 → 공감 유발 → 솔루션 제시",
        scene_flow: [
          `장면1: ${ctx.WHERE}에서 ${ctx.PAIN} 상황 재현 (클로즈업)`,
          `장면2: ${product.name} 등장 — 패키지 오픈 또는 사용 시작`,
          `장면3: ${product.strengths[0]?.tag} 시연 — ${product.strengths[0]?.visual}`,
          `장면4: Before vs After 비교 + 가격 자막`,
        ],
        proof_point: product.strengths[0]?.tag + " 실제 시연",
        cta: `프로필 링크에서 ${product.price}에 만나보세요`,
        hashtags: [product.name.replace(/\s/g, ''), ctx.INTEREST.split('/')[0], "멜리언스", "추천템", "꿀팁"],
        best_upload_time: "평일 오전 7시 (출근 전 스크롤 타임)",
        target_cluster: ctx.INTEREST,
      },
      instagram: {
        title: `${ctx.WHO}의 필수템 발견`,
        hook: `${ctx.WHERE}에서 이거 쓰는 사람 손?`,
        hook_pattern: "질문형 → 참여 유발 → 시각적 시연",
        scene_flow: [
          `장면1: ${ctx.WHERE} 분위기 있는 숏 — 일상 연출`,
          `장면2: 자연스럽게 ${product.name} 등장 (라이프스타일 무드)`,
          `장면3: ${product.strengths[0]?.visual} — 감성적 촬영`,
          `장면4: 사용 후 만족 표정 + 제품 풀샷`,
        ],
        proof_point: "실사용 장면 + 감성적 비주얼",
        cta: "저장해두고 다음에 장바구니 담기",
        hashtags: [product.name.replace(/\s/g, ''), ctx.INTEREST.split('/')[0], "멜리언스", "일상템", "추천"],
        best_upload_time: "평일 저녁 9시 (퇴근 후 릴스 타임)",
        target_cluster: ctx.INTEREST,
      },
    }
  }

  // ─── PRODUCT SELECTION ───
  function selectProduct(p) {
    setSelectedProduct(p)
    setMatchedContexts(null)
    setGeneratedIdeas(null)
    setActiveTab(1)
  }

  // ─── TAB 0: PRODUCT DNA ───
  function renderProductDNA() {
    return (
      <div>
        <SectionTitle icon="◈" title="제품 DNA 매트릭스" subtitle="멜리언스 전 제품의 영상화 가능 강점 카드 — 클릭하면 맥락 매칭으로 이동" />
        <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {PRODUCTS.map((p) => {
            const isSelected = selectedProduct?.id === p.id
            return (
              <div
                key={p.id}
                onClick={() => selectProduct(p)}
                style={{
                  background: isSelected ? C.surfaceHover : C.card,
                  border: `1px solid ${isSelected ? C.accent : C.border}`,
                  borderRadius: 16, padding: 20, cursor: 'pointer',
                  transition: 'all 0.25s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{p.emoji}</div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 4px 0' }}>{p.name}</h3>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Tag small color={C.purple}>{p.category}</Tag>
                      {p.bestseller && <Tag small color={C.orange}>BEST</Tag>}
                    </div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.accent }}>{p.price}</span>
                </div>
                <p style={{ fontSize: 12, color: C.textDim, marginBottom: 12, lineHeight: 1.5 }}>{p.description}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {p.strengths.slice(0, 4).map((s, j) => (
                    <div key={j}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 11, color: C.textMuted }}>{s.tag}</span>
                      </div>
                      <ImpactBar value={s.impact} />
                    </div>
                  ))}
                  {p.strengths.length > 4 && (
                    <span style={{ fontSize: 11, color: C.textDim, textAlign: 'right' }}>+{p.strengths.length - 4}개 강점 →</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── TAB 1: CONTEXT MATRIX ───
  function renderContextMatrix() {
    if (!selectedProduct) {
      return <EmptyState icon="⬡" message="제품 DNA 탭에서 제품을 먼저 선택해주세요" action="제품 선택하러 가기 →" onAction={() => setActiveTab(0)} />
    }

    return (
      <div>
        <SectionTitle icon="⬡" title="맥락 매칭 엔진" subtitle={`${selectedProduct.emoji} ${selectedProduct.name} — AI가 최적의 상황적 맥락 조합을 추천합니다`} />

        {/* Product Summary + AI Button */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 36 }}>{selectedProduct.emoji}</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 6px 0' }}>{selectedProduct.name}</h3>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {selectedProduct.strengths.slice(0, 5).map((s, i) => <Tag key={i} small>{s.tag}</Tag>)}
            </div>
          </div>
          <button
            onClick={() => runContextMatching(selectedProduct)}
            disabled={isMatching}
            className={isMatching ? '' : 'pulse-glow'}
            style={{
              padding: '12px 32px', background: isMatching ? C.border : `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
              color: '#fff', border: 'none', borderRadius: 10, cursor: isMatching ? 'wait' : 'pointer',
              fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.3s ease',
            }}
          >
            {isMatching ? '◌ AI 분석 중...' : '⬡ AI 맥락 매칭 실행'}
          </button>
        </div>

        {/* 6-Axis Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
          {Object.entries(CONTEXT_DIMS).map(([key, dim]) => (
            <div key={key} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: dim.color }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: dim.color, letterSpacing: '0.06em' }}>{key}</span>
                <span style={{ fontSize: 10, color: C.textDim, marginLeft: 'auto' }}>{dim.label}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {dim.values.slice(0, 5).map((v, i) => (
                  <span key={i} style={{ fontSize: 10, padding: '2px 7px', background: `${dim.color}18`, color: dim.color, borderRadius: 10, opacity: 0.85 }}>{v}</span>
                ))}
                {dim.values.length > 5 && <span style={{ fontSize: 10, color: C.textDim }}>+{dim.values.length - 5}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Matched Results */}
        {matchedContexts && (
          <div className="animate-fade-in-up">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.accent, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, display: 'inline-block' }} />
                AI 추천 맥락 조합 TOP {matchedContexts.length}
              </h3>
              <span style={{ fontSize: 11, color: C.textDim }}>클릭하여 숏폼 생성에 사용할 맥락 선택</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {matchedContexts.map((ctx, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedContextIdx(i)}
                  className="animate-fade-in-left"
                  style={{
                    background: selectedContextIdx === i ? C.surfaceHover : C.card,
                    border: `1px solid ${selectedContextIdx === i ? C.accent : i === 0 ? `${C.accent}66` : C.border}`,
                    borderRadius: 14, padding: 18, cursor: 'pointer',
                    transition: 'all 0.3s ease', animationDelay: `${i * 0.08}s`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      <span style={{
                        background: selectedContextIdx === i ? C.accent : i === 0 ? `${C.accent}88` : C.border,
                        color: selectedContextIdx === i || i === 0 ? C.bg : C.textMuted,
                        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                      }}>{ctx.rank || i + 1}</span>
                      <span style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.4 }}>{ctx.insight}</span>
                    </div>
                    <div style={{ background: C.accentDim, padding: '4px 14px', borderRadius: 20, marginLeft: 12, flexShrink: 0 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{ctx.conversion_score}</span>
                      <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 2 }}>점</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {['WHO', 'WHEN', 'WHERE', 'PAIN', 'NEED', 'INTEREST'].map(dim => (
                      <div key={dim} style={{ background: `${dimColor(dim)}12`, padding: '6px 10px', borderRadius: 8, border: `1px solid ${dimColor(dim)}20` }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: dimColor(dim), display: 'block', marginBottom: 2, letterSpacing: '0.06em' }}>{dim}</span>
                        <span style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>{ctx[dim]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button
                onClick={() => { setActiveTab(2) }}
                style={{
                  padding: '14px 40px', background: `linear-gradient(135deg, ${C.accent}, ${C.green})`,
                  color: C.bg, border: 'none', borderRadius: 12, cursor: 'pointer',
                  fontSize: 15, fontWeight: 700, transition: 'all 0.2s ease',
                }}
              >
                ▸ 이 맥락으로 숏폼 아이디어 생성하기
              </button>
              <p style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>
                선택된 맥락: #{(selectedContextIdx || 0) + 1} ({matchedContexts[selectedContextIdx]?.WHO})
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── TAB 2: SHORTFORM FACTORY ───
  function renderShortformFactory() {
    if (!selectedProduct || !matchedContexts?.length) {
      return <EmptyState icon="▸" message="맥락 매칭을 먼저 실행해주세요" action="맥락 매칭 엔진으로 →" onAction={() => setActiveTab(1)} />
    }
    const ctx = matchedContexts[selectedContextIdx]

    return (
      <div>
        <SectionTitle icon="▸" title="숏폼 팩토리" subtitle={`${selectedProduct.emoji} ${selectedProduct.name} — 발견 커머스 숏폼 아이디어 자동 생성`} />

        {/* Context Summary */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 20, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.textMuted, marginRight: 4 }}>적용 맥락:</span>
          {['WHO', 'WHEN', 'WHERE', 'PAIN', 'NEED', 'INTEREST'].map(dim => (
            <Tag key={dim} small color={dimColor(dim)}>{ctx[dim]}</Tag>
          ))}
        </div>

        {!generatedIdeas ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <button
              onClick={generateShortformIdeas}
              disabled={isGenerating}
              className={isGenerating ? '' : 'pulse-glow'}
              style={{
                padding: '18px 56px',
                background: isGenerating ? C.border : `linear-gradient(135deg, ${C.orange}, ${C.pink}, ${C.purple})`,
                color: '#fff', border: 'none', borderRadius: 14, cursor: isGenerating ? 'wait' : 'pointer',
                fontSize: 16, fontWeight: 700,
              }}
            >
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
                  <div key={platform} className="animate-fade-in-up" style={{
                    background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 16, overflow: 'hidden',
                  }}>
                    {/* Platform Header */}
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
                      {/* Title */}
                      <h4 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: '0 0 14px 0', lineHeight: 1.4 }}>
                        &ldquo;{idea.title}&rdquo;
                      </h4>

                      {/* Hook */}
                      <div style={{ background: `${C.orange}12`, border: `1px solid ${C.orange}28`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.orange, display: 'block', marginBottom: 4, letterSpacing: '0.05em' }}>🎣 HOOK (0~3초)</span>
                        <p style={{ fontSize: 14, color: C.text, margin: 0, fontWeight: 600 }}>{idea.hook}</p>
                        <span style={{ fontSize: 11, color: C.textMuted, marginTop: 4, display: 'block' }}>{idea.hook_pattern}</span>
                      </div>

                      {/* Scene Flow */}
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

                      {/* Proof */}
                      <div style={{ background: `${C.green}12`, borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.green, letterSpacing: '0.05em' }}>✓ PROOF</span>
                        <span style={{ fontSize: 12, color: C.text, marginLeft: 8 }}>{idea.proof_point}</span>
                      </div>

                      {/* CTA */}
                      <div style={{ background: C.accentDim, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.05em' }}>→ CTA</span>
                        <span style={{ fontSize: 12, color: C.text, marginLeft: 8 }}>{idea.cta}</span>
                      </div>

                      {/* Hashtags */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                        {idea.hashtags?.map((h, i) => (
                          <span key={i} style={{ fontSize: 11, color: C.textMuted, background: C.surface, padding: '2px 8px', borderRadius: 8 }}>#{h}</span>
                        ))}
                      </div>

                      {/* Meta */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                        <div>
                          <span style={{ fontSize: 10, color: C.textDim, display: 'block' }}>업로드 최적시간</span>
                          <span style={{ fontSize: 12, color: C.text }}>{idea.best_upload_time}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 10, color: C.textDim, display: 'block' }}>타겟 클러스터</span>
                          <span style={{ fontSize: 12, color: C.accent }}>{idea.target_cluster}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Actions */}
            <div style={{ textAlign: 'center', marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setGeneratedIdeas(null)} style={{ padding: '10px 28px', background: C.card, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
                ↻ 같은 맥락으로 재생성
              </button>
              <button onClick={() => { setActiveTab(1); setGeneratedIdeas(null) }} style={{ padding: '10px 28px', background: C.card, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
                ⬡ 다른 맥락 선택하러
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ─── TAB 3: SEASON CALENDAR ───
  function renderSeasonCalendar() {
    const currentSeason = SEASON_DATA[selectedMonth]

    return (
      <div>
        <SectionTitle icon="◐" title="시즌 & 트렌드 캘린더" subtitle="월별 최적 제품 × 맥락 조합 로드맵 — 연간 콘텐츠 전략" />

        {/* Month Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6, marginBottom: 24 }}>
          {SEASON_DATA.map((s, i) => (
            <button key={i} onClick={() => setSelectedMonth(i)} style={{
              padding: '10px 2px', background: selectedMonth === i ? C.accent : C.card,
              color: selectedMonth === i ? C.bg : C.textMuted,
              border: `1px solid ${selectedMonth === i ? C.accent : C.border}`,
              borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: selectedMonth === i ? 700 : 400,
              transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
              <span style={{ fontSize: 14 }}>{s.emoji}</span>
              <span>{s.month}</span>
            </button>
          ))}
        </div>

        {/* Month Detail */}
        <div className="animate-fade-in-up" style={{ background: C.card, border: `1px solid ${C.accent}33`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0 }}>
                {currentSeason.emoji} {currentSeason.month} — {currentSeason.theme}
              </h3>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {currentSeason.keywords.map((k, i) => <Tag key={i} small color={C.purple}>#{k}</Tag>)}
              </div>
            </div>
            <div style={{ background: C.accentDim, padding: '8px 16px', borderRadius: 10 }}>
              <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>추천 제품 {currentSeason.products.length}개</span>
            </div>
          </div>

          {/* Products */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(currentSeason.products.length, 4)}, 1fr)`, gap: 12 }}>
            {currentSeason.products.map((pid) => {
              const p = PRODUCTS.find(pp => pp.id === pid)
              if (!p) return null
              return (
                <div key={pid} onClick={() => selectProduct(p)} style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.2s ease',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{p.emoji}</div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 6px 0' }}>{p.name}</h4>
                  <Tag small color={C.orange}>{p.category}</Tag>
                  <div style={{ marginTop: 10, fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
                    {p.strengths.slice(0, 2).map(s => s.tag).join(' · ')}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: C.accent, fontWeight: 600 }}>맥락 매칭 →</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Annual Overview */}
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.textMuted, marginBottom: 14, letterSpacing: '0.05em' }}>📅 연간 콘텐츠 로드맵</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SEASON_DATA.map((s, i) => {
            const products = s.products.map(pid => PRODUCTS.find(pp => pp.id === pid)).filter(Boolean)
            return (
              <div key={i} onClick={() => setSelectedMonth(i)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: selectedMonth === i ? C.surfaceHover : 'transparent',
                padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                borderLeft: `3px solid ${selectedMonth === i ? C.accent : C.border}`,
                transition: 'all 0.2s ease',
              }}>
                <span style={{ fontSize: 14 }}>{s.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: selectedMonth === i ? C.accent : C.textMuted, minWidth: 32 }}>{s.month}</span>
                <span style={{ fontSize: 12, color: C.textMuted, flex: 1 }}>{s.theme}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {products.map(p => <span key={p.id} style={{ fontSize: 14 }} title={p.name}>{p.emoji}</span>)}
                </div>
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
                ALGORITHM PERFORMANCE PLATFORM FOR DISCOVERY COMMERCE
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
              <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>Powered by AI</span>
            </div>
          </div>
        </div>
      </header>

      {/* NAV TABS */}
      <nav style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', padding: '0 24px', overflowX: 'auto' }}>
          {tabs.map((tab, i) => (
            <button key={i} onClick={() => setActiveTab(i)} style={{
              padding: '13px 24px', background: 'transparent',
              color: activeTab === i ? C.accent : C.textMuted,
              border: 'none', borderBottom: `2px solid ${activeTab === i ? C.accent : 'transparent'}`,
              cursor: 'pointer', fontSize: 13, fontWeight: activeTab === i ? 700 : 400,
              display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}>
              <span style={{ fontSize: 15 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* CONTENT */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
        {activeTab === 0 && renderProductDNA()}
        {activeTab === 1 && renderContextMatrix()}
        {activeTab === 2 && renderShortformFactory()}
        {activeTab === 3 && renderSeasonCalendar()}
      </main>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '14px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: C.textDim, margin: 0 }}>
          MELIENS DISCOVERY ENGINE v1.0 — Pentacle × AI Algorithm Performance Platform
        </p>
      </footer>
    </div>
  )
}
