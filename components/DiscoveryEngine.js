'use client'

import { useState, useEffect } from 'react'
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
  const [sfTypeFilter, setSfTypeFilter] = useState(null) // null = AI 자동, 'A'|'B'|'C' = 특정 유형
  const router = useRouter()

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
    console.log(`[DiscoveryEngine] 맥락 매칭 시작 — 제품: ${product.name} (${product.id}), 유형 필터: ${sfTypeFilter || 'AI 자동'}`)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'context_match', product, sfTypeFilter }),
      })
      const data = await res.json()
      console.log(`[DiscoveryEngine] API 응답 수신 — 상태: ${res.status}, 결과: ${data.result ? '성공' : '실패'}`)
      if (data.result) {
        console.log(`[DiscoveryEngine] AI 매칭 결과 ${data.result.length}개 수신`)
        setMatchedContexts(data.result)
      } else {
        throw new Error(data.error || 'AI 응답 오류')
      }
    } catch (e) {
      console.error('[DiscoveryEngine] Context matching error:', e)
      console.log(`[DiscoveryEngine] Fallback 데이터 사용 — 제품 ID: ${product.id}`)
      setMatchedContexts(generateFallbackContexts(product))
    }
    setIsMatching(false)
  }

  async function generateShortformIdeas() {
    if (!selectedProduct || !matchedContexts?.length) return
    setIsGenerating(true)
    setGeneratedIdeas(null)
    const ctx = matchedContexts[selectedContextIdx]
    console.log(`[DiscoveryEngine] 숏폼 생성 시작 — 제품: ${selectedProduct.name}, 맥락 #${selectedContextIdx + 1}, 유형: ${ctx.sf_type || 'N/A'}`)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'generate_shortform', product: selectedProduct, context: ctx }),
      })
      const data = await res.json()
      console.log(`[DiscoveryEngine] 숏폼 API 응답 — 상태: ${res.status}, 결과: ${data.result ? '성공' : '실패'}`)
      if (data.result) {
        setGeneratedIdeas(data.result)
      } else {
        throw new Error(data.error || 'AI 응답 오류')
      }
    } catch (e) {
      console.error('[DiscoveryEngine] Shortform generation error:', e)
      console.log(`[DiscoveryEngine] Fallback 숏폼 사용`)
      setGeneratedIdeas(generateFallbackIdeas(selectedProduct, ctx))
    }
    setIsGenerating(false)
  }

  // ─── FALLBACK DATA (for demo without API key) ───

  function generateFallbackContexts(product) {
    const fallbacks = {
      clenser: [
        { rank: 1, sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "자취 1년차 사회초년생", WHEN: null, WHERE: null, PAIN: "세안해도 남아있는 잔여 메이크업", NEED: null, INTEREST: null, conversion_score: 96, insight: "WHO의 시간 부족 + PAIN의 잔여물 고민이 원터치 솔루션으로 연결되어 즉각 구매를 유발", data_evidence: "🟢 검색: '클렌저 추천' 월 8,100회, 20대 여성 62% | VOC: '피부 매끈/뽀득' 만족 반응 최다" },
        { rank: 2, sf_type: "B", axes_used: ["PAIN", "NEED"], WHO: null, WHEN: null, WHERE: null, PAIN: "일반 세안으로 잔여 메이크업이 안 지워짐", NEED: "눈에 보이는 세정력 차이", INTEREST: null, conversion_score: 93, insight: "초미세진동 12,000회 vs 손세안 비교 테스트로 기능 증명 — 수치가 신뢰 트리거", data_evidence: "🟡 검색: '클렌저 세정력 비교' I 85%, 영상 SERP 노출 — 테스트 영상 수요 높음" },
        { rank: 3, sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "뷰티 관심 대학생", WHEN: null, WHERE: null, PAIN: "피부 트러블이 반복되는데 원인 모름", NEED: null, INTEREST: null, conversion_score: 90, insight: "WHO의 뷰티 관심 + PAIN의 트러블 원인 미지 — 세안법이 원인이라는 깨달음이 구매 동기", data_evidence: "🟢 검색: '피부 트러블 원인' 월 5,400회, I 85% | VOC: '설명서 안 보고 써서 자극' 사용법 콘텐츠 니즈" },
        { rank: 4, sf_type: "C", axes_used: ["WHO", "WHEN", "WHERE"], WHO: "갓생러 루틴 관심자", WHEN: "새해 첫 주 루틴 시작", WHERE: "원룸 세면대 앞", PAIN: null, NEED: null, INTEREST: null, conversion_score: 87, insight: "새해 아침루틴 장면에 자연스럽게 배치 — 라이프스타일 공감이 도달 범위 확대", data_evidence: "🟡 검색: '스킨케어 루틴 추천' 1월 +140%, T 45% — 시즌 타겟 유효" },
        { rank: 5, sf_type: "C", axes_used: ["WHO", "WHEN", "WHERE"], WHO: "부모님 선물 고민 자녀", WHEN: "어버이날 시즌", WHERE: "온라인 쇼핑 중", PAIN: null, NEED: null, INTEREST: null, conversion_score: 84, insight: "선물 고민 상황 + 언박싱 장면이 감성 CTA로 연결 — 3만원대 가격이 부담 없는 선택지", data_evidence: "🟢 검색: '어버이날 선물 추천' 4월 급증, C 78% | VOC: '어머니 선물/친구 추천' 선물 구매 빈출" },
      ],
      lint: [
        { rank: 1, sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "니트 즐겨 입는 직장인", WHEN: null, WHERE: null, PAIN: "좋아하는 니트에 보풀이 생겨 낡아 보임", NEED: null, INTEREST: null, conversion_score: 97, insight: "WHO의 니트 애정 + PAIN의 보풀 불만 — Before-After가 가장 강력한 구매 트리거", data_evidence: "🟢 검색: '보풀제거기 추천' 월 12,100회, T 72% | VOC: '인스타 광고 보고 샀다' 구매 경로 1위" },
        { rank: 2, sf_type: "B", axes_used: ["PAIN"], WHO: null, WHEN: null, WHERE: null, PAIN: "소파에 보풀이 쌓여 지저분해 보임", NEED: null, INTEREST: null, conversion_score: 94, insight: "3단 날 시스템의 절삭력을 소파/니트/침구 소재별로 비교 시연 — ASMR 효과 극대화", data_evidence: "🟢 검색: '자취 청소 꿀팁' 월 3,200회, 남녀 균등 | VOC: '옷감 손상 걱정했는데 없다' 핵심 우려 해소" },
        { rank: 3, sf_type: "C", axes_used: ["WHO", "WHEN", "WHERE"], WHO: "30대 워킹맘", WHEN: "아이 등원 준비 아침", WHERE: "아이 옷장 앞", PAIN: null, NEED: null, INTEREST: null, conversion_score: 91, insight: "바쁜 아침 라이프스타일 장면에서 자연스러운 사용 — 육아맘 공감 도달 확대", data_evidence: "🟡 검색: '아이 옷 보풀' 30대 여성 집중, C 65% — 비교 콘텐츠 효과적" },
      ],
      carholder: [
        { rank: 1, sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "차량 통근자", WHEN: null, WHERE: null, PAIN: "기존 거치대가 주행중 흔들려서 불안", NEED: null, INTEREST: null, conversion_score: 96, insight: "WHO의 매일 운전 + PAIN의 흔들림 불안이 과속방지턱 테스트 영상으로 연결", data_evidence: "🟢 검색: '차량 거치대 추천' 월 14,800회, T 81% | VOC: '과속방지턱에서도 안 흔들림' 기능 증명 리뷰 최다" },
        { rank: 2, sf_type: "B", axes_used: ["PAIN"], WHO: null, WHEN: null, WHERE: null, PAIN: "폰이 무거워지면서 기존 거치대가 못 버팀", NEED: null, INTEREST: null, conversion_score: 93, insight: "무게 테스트(아이폰 Pro Max 240g) + 과속방지턱 진동 테스트로 기능 증명", data_evidence: "🟡 검색: '차량 거치대 흔들림' 검색 증가, I 72% — 비교 영상 수요 높음" },
        { rank: 3, sf_type: "C", axes_used: ["WHO", "WHEN", "WHERE"], WHO: "신차 구매자", WHEN: "차량 인테리어 세팅 시점", WHERE: "차 안 운전석", PAIN: null, NEED: null, INTEREST: null, conversion_score: 90, insight: "신차 꾸미기 라이프스타일 영상에서 자연스러운 배치 — 인테리어 감성 도달 확대", data_evidence: "🟢 검색: '신차 필수템' 월 6,500회, N 41% | VOC: '디자인이 깔끔해서 인테리어에 안 어울리는 문제 해결'" },
      ],
      ringholder: [
        { rank: 1, sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "폰 자주 떨어뜨리는 사람", WHEN: null, WHERE: null, PAIN: "폰 자꾸 떨어뜨려서 액정 깨질까 불안", NEED: null, INTEREST: null, conversion_score: 94, insight: "WHO의 불안 + PAIN의 낙하 공포가 마그네틱 그립 안정감으로 직결", data_evidence: "🟢 검색: '폰 그립' 월 4,200회, C 68% | VOC: '스트랩이 안정감 있다' 그립감 만족 리뷰" },
        { rank: 2, sf_type: "B", axes_used: ["PAIN", "NEED"], WHO: null, WHEN: null, WHERE: null, PAIN: "거울 따로 들고 다니기 귀찮음", NEED: "올인원 편의성", INTEREST: null, conversion_score: 91, insight: "3in1 기능(홀더+거울+스트랩) 전환 시연으로 신뢰도 증명", data_evidence: "🟢 검색: '폰 링홀더 거울' I 75% | VOC: '거울이 생각보다 유용' 예상 밖 만족 리뷰 다수" },
        { rank: 3, sf_type: "C", axes_used: ["WHO", "WHEN", "WHERE"], WHO: "셀카 좋아하는 MZ세대", WHEN: "외출 준비 거울 필요할 때", WHERE: "카페에서 영상 시청", PAIN: null, NEED: null, INTEREST: null, conversion_score: 88, insight: "카페 라이프스타일 장면에서 거치대+거울 활용 — MZ 공감 도달 확대", data_evidence: "🟡 VOC: '커플 매칭으로 2개 샀다' — 커플템 포지셔닝 유효" },
      ],
      laptop: [
        { rank: 1, sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "목/어깨 통증 직장인", WHEN: null, WHERE: null, PAIN: "노트북 자세 때문에 목/어깨 통증 심해짐", NEED: null, INTEREST: null, conversion_score: 95, insight: "WHO의 통증 고민 + PAIN의 자세 문제가 인체공학 각도 솔루션으로 직결", data_evidence: "🟢 검색: '노트북 거치대 추천' 월 9,900회, C 71% | VOC: '자세가 확실히 편해짐' 인체공학 체감 후기" },
        { rank: 2, sf_type: "B", axes_used: ["PAIN", "NEED"], WHO: null, WHEN: null, WHERE: null, PAIN: "휴대할 수 있는 거치대가 없음", NEED: "가벼운 휴대성", INTEREST: null, conversion_score: 92, insight: "74g 무게 저울 측정 + 지갑 크기 비교로 기능 증명 — 수치가 신뢰 트리거", data_evidence: "🟢 검색: '노트북 거치대 휴대' I 80% | VOC: '74g이 진짜 가볍다' 저울 인증 리뷰 다수" },
        { rank: 3, sf_type: "C", axes_used: ["WHO", "WHEN", "WHERE"], WHO: "카페 작업족 노마드", WHEN: "카페 작업 시", WHERE: "카페 작업 공간", PAIN: null, NEED: null, INTEREST: null, conversion_score: 89, insight: "카페 작업 라이프스타일 장면에서 자연스러운 배치 — 노마드 공감 확대", data_evidence: "🟢 검색: '카페 노트북' 월 5,100회 | VOC: '카페에서 꺼내면 사람들이 물어봄' 자연 바이럴 후기" },
      ],
      multitap: [
        { rank: 1, sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "자취 1년차 사회초년생", WHEN: null, WHERE: null, PAIN: "콘센트가 항상 부족해서 스트레스", NEED: null, INTEREST: null, conversion_score: 93, insight: "WHO의 자취 시작 + PAIN의 콘센트 부족이 큐브 올인원 솔루션으로 연결", data_evidence: "🟢 검색: '멀티탭 추천' 월 18,100회, C 65% | VOC: 'USB 충전이 되니 충전기 따로 안 사도 됨' 올인원 만족" },
        { rank: 2, sf_type: "B", axes_used: ["PAIN", "NEED"], WHO: null, WHEN: null, WHERE: null, PAIN: "멀티탭 선이 지저분함", NEED: "공간 효율 극대화", INTEREST: null, conversion_score: 90, insight: "일반 멀티탭 vs 큐브 공간 비교로 기능 증명 — 깔끔함이 신뢰 트리거", data_evidence: "🟢 검색: '멀티탭 정리' I 78% | VOC: '큐브 디자인이 깔끔해서 인테리어에 안 튀어'" },
        { rank: 3, sf_type: "C", axes_used: ["WHO", "WHEN", "WHERE"], WHO: "이사 준비중인 신혼부부", WHEN: "이사 시즌 3~4월", WHERE: "거실 TV 뒤", PAIN: null, NEED: null, INTEREST: null, conversion_score: 87, insight: "새 집 꾸미기 라이프스타일 장면에서 자연스러운 배치 — 신혼부부 공감 확대", data_evidence: "🟡 검색: '이사 필수템' 3~4월 검색량 +120%, T 55% — 시즌 타겟 유효" },
      ],
      adapter: [
        { rank: 1, sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "해외여행 초심자", WHEN: null, WHERE: null, PAIN: "해외에서 충전기 안 맞아서 당황", NEED: null, INTEREST: null, conversion_score: 95, insight: "WHO의 여행 불안 + PAIN의 충전 문제가 200개국 호환 솔루션으로 직결", data_evidence: "🟢 검색: '해외 여행 어댑터' 월 12,400회, T 73% | VOC: '200개국 호환이 진짜인지 유럽에서 확인' 해외 인증 리뷰" },
        { rank: 2, sf_type: "B", axes_used: ["PAIN", "NEED"], WHO: null, WHEN: null, WHERE: null, PAIN: "어댑터 여러 개 챙기기 번거로움", NEED: "짐 줄이기", INTEREST: null, conversion_score: 92, insight: "어댑터 3개 vs 올인원 1개 비교 시연으로 기능 증명 — 짐 절약 수치화", data_evidence: "🟢 검색: '여행 충전기 올인원' I 82% | VOC: '가족 4명 디바이스 동시 충전 성공' 실증 리뷰" },
        { rank: 3, sf_type: "C", axes_used: ["WHO", "WHEN", "WHERE"], WHO: "가족 해외여행 계획자", WHEN: "여름 휴가 준비기", WHERE: "해외여행 호텔방", PAIN: null, NEED: null, INTEREST: null, conversion_score: 89, insight: "가족 여행 준비 라이프스타일 장면에서 자연스러운 배치 — 가족 공감 확대", data_evidence: "🟡 검색: '여름 해외여행 필수템' 6~7월 검색량 급증, C 61% — 시즌 타겟 유효" },
      ],
      cardwallet: [
        { rank: 1, sf_type: "A", axes_used: ["WHO", "PAIN"], WHO: "미니멀리스트", WHEN: null, WHERE: null, PAIN: "지갑 따로 들고 다니기 귀찮음", NEED: null, INTEREST: null, conversion_score: 94, insight: "WHO의 미니멀 지향 + PAIN의 지갑 번거로움이 3in1 올인원 솔루션으로 직결", data_evidence: "🟢 검색: '맥세이프 카드지갑' 월 6,800회, C 70% | VOC: '카드 3장 넣어도 넉넉' 수납력 만족 리뷰" },
        { rank: 2, sf_type: "B", axes_used: ["PAIN", "NEED"], WHO: null, WHEN: null, WHERE: null, PAIN: "선물 뭘 사야 할지 모름", NEED: "선물 센스 인정", INTEREST: null, conversion_score: 91, insight: "3in1 기능 시연 + 프리미엄 가죽 질감 → 가격 대비 가치 증명", data_evidence: "🟢 검색: '폰 악세서리 선물' C 75% | VOC: '부모님 선물로 드렸더니 좋아하셨다' 선물용 구매 경로 확인" },
        { rank: 3, sf_type: "C", axes_used: ["WHO", "WHEN", "WHERE"], WHO: "아이폰 유저 감성파", WHEN: "새 폰 구매 직후", WHERE: "카페에서 영상 시청", PAIN: null, NEED: null, INTEREST: null, conversion_score: 88, insight: "새 폰 꾸미기 라이프스타일 장면에서 자연스러운 배치 — 감성 도달 확대", data_evidence: "🟡 VOC: '가죽 질감이 가격 대비 고급스럽다' 프리미엄 감성 소구 유효" },
      ],
    }
    console.log(`[Fallback] 제품 ID: ${product.id}, fallback 데이터 ${fallbacks[product.id] ? '있음' : '없음 → clenser 폴백'}`)
    return fallbacks[product.id] || fallbacks.clenser
  }

  function generateFallbackIdeas(product, ctx) {
    const axes = ctx.axes_used || ['WHO', 'WHEN', 'WHERE', 'PAIN', 'NEED', 'INTEREST']
    const hookText = ctx.PAIN || ctx.WHO || product.strengths[0]?.tag || product.name
    const placeText = ctx.WHERE || '일상 속'
    const interestText = ctx.INTEREST || product.category
    const targetText = ctx.WHO || '일상 소비자'

    return {
      youtube: {
        title: `${hookText.slice(0, 8)}... 이거면 끝`,
        hook: `"솔직히 말할게, ${hookText}"`,
        hook_pattern: "고백형 → 공감 유발 → 솔루션 제시",
        scene_flow: [
          `장면1: ${placeText}에서 ${hookText} 상황 재현 (클로즈업)`,
          `장면2: ${product.name} 등장 — 패키지 오픈 또는 사용 시작`,
          `장면3: ${product.strengths[0]?.tag} 시연 — ${product.strengths[0]?.visual}`,
          `장면4: Before vs After 비교 + 가격 자막`,
        ],
        proof_point: product.strengths[0]?.tag + " 실제 시연",
        cta: `프로필 링크에서 ${product.price}에 만나보세요`,
        hashtags: [product.name.replace(/\s/g, ''), interestText.split('/')[0], "멜리언스", "추천템", "꿀팁"],
        best_upload_time: "평일 오전 7시 (출근 전 스크롤 타임)",
        target_cluster: interestText,
      },
      instagram: {
        title: `${targetText}의 필수템 발견`,
        hook: `${placeText}에서 이거 쓰는 사람 손?`,
        hook_pattern: "질문형 → 참여 유발 → 시각적 시연",
        scene_flow: [
          `장면1: ${placeText} 분위기 있는 숏 — 일상 연출`,
          `장면2: 자연스럽게 ${product.name} 등장 (라이프스타일 무드)`,
          `장면3: ${product.strengths[0]?.visual} — 감성적 촬영`,
          `장면4: 사용 후 만족 표정 + 제품 풀샷`,
        ],
        proof_point: "실사용 장면 + 감성적 비주얼",
        cta: "저장해두고 다음에 장바구니 담기",
        hashtags: [product.name.replace(/\s/g, ''), interestText.split('/')[0], "멜리언스", "일상템", "추천"],
        best_upload_time: "평일 저녁 9시 (퇴근 후 릴스 타임)",
        target_cluster: interestText,
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
        <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {PRODUCTS.map((p) => {
            const isSelected = selectedProduct?.id === p.id
            return (
              <div
                key={p.id}
                onClick={() => selectProduct(p)}
                style={{
                  background: isSelected ? C.surfaceHover : C.card,
                  border: `1.5px solid ${isSelected ? C.accent : C.border}`,
                  borderRadius: 14, padding: 16, cursor: 'pointer',
                  transition: 'all 0.25s ease', position: 'relative',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {isSelected && (
                  <div style={{ position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.bg, fontWeight: 700 }}>✓</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 28 }}>{p.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 3px 0' }}>{p.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Tag small color={C.purple}>{p.category}</Tag>
                      {p.bestseller && <Tag small color={C.orange}>BEST</Tag>}
                    </div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{p.price}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {p.strengths.slice(0, 3).map((s, j) => (
                    <Tag key={j} small>{s.tag}</Tag>
                  ))}
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

        {/* 숏폼 유형 선택 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>숏폼 유형 필터 — AI 자동 추천 또는 특정 유형 선택</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setSfTypeFilter(null)}
              style={{
                padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: sfTypeFilter === null ? C.accent : C.card,
                color: sfTypeFilter === null ? C.bg : C.textMuted,
                border: `1px solid ${sfTypeFilter === null ? C.accent : C.border}`,
                transition: 'all 0.2s ease',
              }}
            >
              AI 자동 추천
            </button>
            {Object.values(SF_TYPES).map(t => (
              <button
                key={t.id}
                onClick={() => setSfTypeFilter(sfTypeFilter === t.id ? null : t.id)}
                style={{
                  padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: sfTypeFilter === t.id ? `${t.color}22` : C.card,
                  color: sfTypeFilter === t.id ? t.color : C.textMuted,
                  border: `1px solid ${sfTypeFilter === t.id ? t.color : C.border}`,
                  transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span>{t.icon}</span>
                <span>{t.id}. {t.label}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>({t.badge})</span>
              </button>
            ))}
          </div>
        </div>

        {/* 6-Axis Overview (제품별 맞춤) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
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
                  {productValues.map((v, i) => (
                    <span key={i} style={{ fontSize: 10, padding: '3px 8px', background: `${dim.color}18`, color: dim.color, borderRadius: 10 }}>{v}</span>
                  ))}
                </div>
              </div>
            )
          })}
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
                      {ctx.sf_type && SF_TYPES[ctx.sf_type] && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8,
                          background: `${SF_TYPES[ctx.sf_type].color}20`,
                          color: SF_TYPES[ctx.sf_type].color,
                          border: `1px solid ${SF_TYPES[ctx.sf_type].color}40`,
                          whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          <span>{SF_TYPES[ctx.sf_type].icon}</span>
                          {ctx.sf_type}. {SF_TYPES[ctx.sf_type].label}
                        </span>
                      )}
                      <span style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.4 }}>{ctx.insight}</span>
                    </div>
                    <div style={{ background: C.accentDim, padding: '4px 14px', borderRadius: 20, marginLeft: 12, flexShrink: 0 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{ctx.conversion_score}</span>
                      <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 2 }}>점</span>
                    </div>
                  </div>
                  {/* 사용된 축 뱃지 */}
                  {ctx.axes_used && (
                    <div style={{ display: 'flex', gap: 5, marginBottom: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: C.textDim, marginRight: 2 }}>축 조합:</span>
                      {ctx.axes_used.map((axis, ai) => (
                        <span key={axis}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: dimColor(axis), background: `${dimColor(axis)}18`, padding: '2px 8px', borderRadius: 10 }}>{axis}</span>
                          {ai < ctx.axes_used.length - 1 && <span style={{ fontSize: 10, color: C.textDim, margin: '0 2px' }}>+</span>}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min((ctx.axes_used || ['WHO','WHEN','WHERE','PAIN','NEED','INTEREST']).filter(a => ctx[a]).length, 3)}, 1fr)`, gap: 8 }}>
                    {(ctx.axes_used || ['WHO', 'WHEN', 'WHERE', 'PAIN', 'NEED', 'INTEREST']).filter(dim => ctx[dim]).map(dim => (
                      <div key={dim} style={{ background: `${dimColor(dim)}12`, padding: '6px 10px', borderRadius: 8, border: `1px solid ${dimColor(dim)}20` }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: dimColor(dim), display: 'block', marginBottom: 2, letterSpacing: '0.06em' }}>{dim}</span>
                        <span style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>{ctx[dim]}</span>
                      </div>
                    ))}
                  </div>
                  {ctx.data_evidence && (
                    <div style={{ marginTop: 10, padding: '6px 10px', background: `${C.blue}10`, borderRadius: 8, border: `1px solid ${C.blue}18`, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>📊</span>
                      <span style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>{ctx.data_evidence}</span>
                    </div>
                  )}
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
          {ctx.sf_type && SF_TYPES[ctx.sf_type] && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, marginRight: 4,
              background: `${SF_TYPES[ctx.sf_type].color}20`, color: SF_TYPES[ctx.sf_type].color,
              border: `1px solid ${SF_TYPES[ctx.sf_type].color}40`,
            }}>{SF_TYPES[ctx.sf_type].icon} {ctx.sf_type}. {SF_TYPES[ctx.sf_type].label}</span>
          )}
          {(ctx.axes_used || ['WHO', 'WHEN', 'WHERE', 'PAIN', 'NEED', 'INTEREST']).filter(dim => ctx[dim]).map(dim => (
            <Tag key={dim} small color={dimColor(dim)}>{dim}: {ctx[dim]}</Tag>
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
            <div style={{ textAlign: 'center', marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setGeneratedIdeas(null)} style={{ padding: '10px 28px', background: C.card, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
                ↻ 같은 맥락으로 재생성
              </button>
              <button onClick={() => { setActiveTab(1); setGeneratedIdeas(null) }} style={{ padding: '10px 28px', background: C.card, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
                ⬡ 다른 맥락 선택하러
              </button>
              <button
                onClick={() => {
                  const studioData = {
                    product: selectedProduct,
                    context: matchedContexts[selectedContextIdx],
                    ideas: generatedIdeas,
                  }
                  localStorage.setItem('meliens_studio_data', JSON.stringify(studioData))
                  router.push('/studio')
                }}
                style={{
                  padding: '10px 28px',
                  background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
                  color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                  boxShadow: `0 2px 12px ${C.purple}44`,
                }}
              >
                🎬 AI Studio로 보내기
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
