'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ─── STYLE CONSTANTS (Meliens 디자인 시스템) ───
const C = {
  bg: '#0a0b0f', surface: '#12131a', surfaceHover: '#1a1b25',
  card: '#16171f', border: '#2a2b35', borderLight: '#3a3b45',
  text: '#e8e9ed', textMuted: '#8b8d9a', textDim: '#5a5c6a',
  accent: '#4ecdc4', accentDim: '#4ecdc433',
  purple: '#a78bfa', orange: '#f59e0b', pink: '#f472b6',
  blue: '#60a5fa', green: '#34d399', red: '#f87171',
}

const VIDEO_STYLES = [
  { id: 'product_demo', label: '제품 시연', icon: '▶' },
  { id: 'before_after', label: '비포&애프터', icon: '◐' },
  { id: 'review_unboxing', label: '리뷰/언박싱', icon: '◻' },
]

const PLATFORMS = [
  { id: 'shorts', label: 'YouTube Shorts', color: '#ff0000' },
  { id: 'reels', label: 'Instagram Reels', color: '#e1306c' },
]

// 씬 섹션 색상
const SECTION_COLORS = {
  HOOK: C.red,
  PROBLEM: C.orange,
  SOLUTION: C.accent,
  RESULT: C.green,
  CTA: C.purple,
}

// ─── MAIN COMPONENT ───
export default function StudioEngine() {
  const [product, setProduct] = useState(null)
  const [context, setContext] = useState(null)
  const [ideas, setIdeas] = useState(null)

  const [videoStyle, setVideoStyle] = useState('before_after')
  const [platform, setPlatform] = useState('reels')
  const [targetDuration, setTargetDuration] = useState(22)
  const [toneAndManner, setToneAndManner] = useState('솔직하고 드라마틱')

  const [tab, setTab] = useState('input')
  const [loading, setLoading] = useState(false)
  const [storyboard, setStoryboard] = useState(null)
  const [error, setError] = useState(null)
  const [stage, setStage] = useState('')
  const [progress, setProgress] = useState(0)
  const [expandedScene, setExpandedScene] = useState(null)

  // ─── Discovery Engine 데이터 수신 ───
  useEffect(() => {
    try {
      const saved = localStorage.getItem('meliens_studio_data')
      if (saved) {
        const data = JSON.parse(saved)
        if (data.product) setProduct(data.product)
        if (data.context) setContext(data.context)
        if (data.ideas) setIdeas(data.ideas)
        if (data.platform === 'youtube') setPlatform('shorts')
        if (data.platform === 'instagram') setPlatform('reels')
      }
    } catch (e) {
      console.error('Failed to load studio data:', e)
    }
  }, [])

  // ─── 스토리보드 생성 ───
  const handleGenerateStoryboard = useCallback(async () => {
    if (!product) {
      setError('제품 정보가 없습니다. Discovery Engine에서 제품을 선택해주세요.')
      return
    }
    setLoading(true)
    setError(null)
    setStage('AI 크리에이티브 디렉터가 촬영 스토리보드를 설계하고 있습니다...')
    setProgress(30)

    try {
      const res = await fetch('/api/storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product,
          context,
          ideas,
          videoStyle,
          platform,
          targetDuration,
          toneAndManner,
        }),
      })

      setProgress(80)
      setStage('스토리보드 구성 완료, 촬영 가이드 시트를 정리하고 있습니다...')

      const data = await res.json()
      if (!data.success) throw new Error(data.error || '스토리보드 생성 실패')

      setStoryboard(data.storyboard)
      setTab('storyboard')
      setProgress(100)
      setStage('촬영 스토리보드 완성!')
      setExpandedScene(0)
    } catch (err) {
      setError(err.message || '스토리보드 생성 실패')
    } finally {
      setLoading(false)
    }
  }, [product, context, ideas, videoStyle, platform, targetDuration, toneAndManner])

  // ─── SUB COMPONENTS ───
  function ContextTag({ dim, value }) {
    const colors = { WHO: C.accent, WHEN: C.orange, WHERE: C.blue, PAIN: C.red, NEED: C.green, INTEREST: C.purple }
    const color = colors[dim] || C.accent
    return (
      <span style={{
        display: 'inline-block', padding: '3px 10px',
        background: `${color}18`, color, borderRadius: 16,
        fontSize: 11, fontWeight: 500, border: `1px solid ${color}30`,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, marginRight: 4, opacity: 0.7 }}>{dim}</span>{value}
      </span>
    )
  }

  function DetailRow({ icon, label, value, color = C.textMuted }) {
    if (!value) return null
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{value}</div>
        </div>
      </div>
    )
  }

  // ─── RENDER: INPUT TAB ───
  function renderInput() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* 제품 + 맥락 요약 */}
        {product ? (
          <div style={{ background: C.card, border: `1px solid ${C.accent}44`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 36 }}>{product.emoji}</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 4px 0' }}>{product.name}</h3>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', background: `${C.purple}22`, color: C.purple, borderRadius: 10 }}>{product.category}</span>
                  <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>{product.price}</span>
                </div>
              </div>
              <div style={{ padding: '4px 10px', background: `${C.green}18`, borderRadius: 8, fontSize: 10, color: C.green, fontWeight: 600 }}>
                Discovery Engine 연동
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
              {product.strengths?.slice(0, 5).map((s, i) => (
                <span key={i} style={{ fontSize: 10, padding: '3px 8px', background: `${C.accent}14`, color: C.accent, borderRadius: 10, border: `1px solid ${C.accent}22` }}>
                  {s.tag}
                </span>
              ))}
            </div>
            {context && (
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>적용 맥락</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {['WHO', 'WHEN', 'WHERE', 'PAIN', 'NEED', 'INTEREST'].map(dim => (
                    context[dim] ? <ContextTag key={dim} dim={dim} value={context[dim]} /> : null
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 36, opacity: 0.3, marginBottom: 12 }}>◈</div>
            <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 16 }}>제품 데이터가 없습니다</p>
            <Link href="/" style={{
              padding: '8px 20px', background: C.accentDim, color: C.accent,
              border: `1px solid ${C.accent}44`, borderRadius: 8, fontSize: 13, textDecoration: 'none',
            }}>
              Discovery Engine에서 제품 선택 →
            </Link>
          </div>
        )}

        {/* 숏폼 아이디어 */}
        {ideas && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.orange, letterSpacing: '0.06em', display: 'block', marginBottom: 10 }}>
              DISCOVERY ENGINE 생성 아이디어
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['youtube', 'instagram'].map(p => {
                const idea = ideas[p]
                if (!idea) return null
                return (
                  <div key={p} style={{ background: C.surface, borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, color: p === 'youtube' ? '#ff0000' : '#e1306c', fontWeight: 700, marginBottom: 4 }}>
                      {p === 'youtube' ? '▶ YouTube' : '◎ Instagram'}
                    </div>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 6 }}>&ldquo;{idea.title}&rdquo;</div>
                    <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>
                      <span style={{ color: C.orange }}>Hook:</span> {idea.hook}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 촬영 설정 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>촬영 설정</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 8, letterSpacing: '0.04em' }}>영상 스타일</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {VIDEO_STYLES.map(s => (
                <button key={s.id} onClick={() => setVideoStyle(s.id)} style={{
                  padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  border: videoStyle === s.id ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                  background: videoStyle === s.id ? C.accentDim : C.surface,
                  color: videoStyle === s.id ? C.accent : C.textMuted,
                }}>{s.icon} {s.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 8, letterSpacing: '0.04em' }}>플랫폼</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => setPlatform(p.id)} style={{
                  padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  border: platform === p.id ? `1.5px solid ${p.color}` : `1px solid ${C.border}`,
                  background: platform === p.id ? `${p.color}18` : C.surface,
                  color: platform === p.id ? p.color : C.textMuted,
                }}>{p.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 8, letterSpacing: '0.04em' }}>
              목표 길이: {targetDuration}초
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[15, 20, 22, 25, 30].map(d => (
                <button key={d} onClick={() => setTargetDuration(d)} style={{
                  padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  border: targetDuration === d ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                  background: targetDuration === d ? C.accentDim : C.surface,
                  color: targetDuration === d ? C.accent : C.textMuted,
                }}>{d}s</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 8, letterSpacing: '0.04em' }}>톤 & 매너</label>
            <input value={toneAndManner} onChange={e => setToneAndManner(e.target.value)} style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              background: C.surface, border: `1px solid ${C.border}`, color: C.text,
              fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }} />
          </div>
        </div>

        {/* 생성 버튼 */}
        <button onClick={handleGenerateStoryboard} disabled={loading || !product}
          style={{
            width: '100%', padding: 16, borderRadius: 12, border: 'none',
            background: loading || !product ? C.border : `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
            color: loading || !product ? C.textDim : '#fff',
            fontSize: 15, fontWeight: 700,
            cursor: loading || !product ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          {loading ? '◌ 촬영 스토리보드 생성 중...' : '📋 촬영 스토리보드 생성'}
        </button>
      </div>
    )
  }

  // ─── RENDER: STORYBOARD TAB (촬영 가이드 시트) ───
  function renderStoryboard() {
    if (!storyboard) {
      return (
        <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>
          <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 16 }}>📋</div>
          <p style={{ fontSize: 14 }}>제품 & 설정 탭에서 촬영 스토리보드를 먼저 생성해주세요</p>
        </div>
      )
    }

    const totalDuration = storyboard.scenes?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0

    return (
      <div>
        {/* 상단 요약 바 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: '0 0 6px 0' }}>
                📋 {storyboard.metadata?.title || `${product?.name} 촬영 스토리보드`}
              </h2>
              <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>
                {storyboard.metadata?.description || '촬영팀 전달용 가이드 시트'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ padding: '8px 14px', background: C.surface, borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.06em', marginBottom: 2 }}>플랫폼</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: platform === 'shorts' ? '#ff0000' : '#e1306c' }}>
                  {platform === 'shorts' ? 'YouTube' : 'Instagram'}
                </div>
              </div>
              <div style={{ padding: '8px 14px', background: C.surface, borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.06em', marginBottom: 2 }}>총 길이</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{totalDuration}초</div>
              </div>
              <div style={{ padding: '8px 14px', background: C.surface, borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.06em', marginBottom: 2 }}>씬 수</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>{storyboard.scenes?.length || 0}개</div>
              </div>
              <div style={{ padding: '8px 14px', background: C.surface, borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.06em', marginBottom: 2 }}>스타일</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.purple }}>{videoStyle}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 훅 전략 */}
        {storyboard.hook_strategy && (
          <div style={{ background: `${C.orange}0a`, border: `1px solid ${C.orange}30`, borderRadius: 14, padding: 18, marginBottom: 24, borderLeft: `4px solid ${C.orange}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>🎣</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.orange, letterSpacing: '0.06em' }}>훅 전략</span>
            </div>
            <p style={{ fontSize: 14, color: C.text, margin: 0, lineHeight: 1.6 }}>{storyboard.hook_strategy}</p>
          </div>
        )}

        {/* 타임라인 바 */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: '0.06em' }}>TIMELINE</span>
            <span style={{ fontSize: 10, color: C.textDim }}>({totalDuration}초)</span>
          </div>
          <div style={{ display: 'flex', gap: 2, background: C.border, borderRadius: 8, overflow: 'hidden', padding: 2 }}>
            {storyboard.scenes?.map((s, i) => {
              const sectionColor = SECTION_COLORS[s.section?.toUpperCase()] || C.textDim
              const widthPercent = totalDuration > 0 ? (s.duration / totalDuration * 100) : (100 / (storyboard.scenes?.length || 1))
              return (
                <button key={i} onClick={() => setExpandedScene(expandedScene === i ? null : i)} style={{
                  width: `${widthPercent}%`, minWidth: 28, height: 44, borderRadius: 6, cursor: 'pointer',
                  border: expandedScene === i ? '2px solid #fff' : '1px solid transparent',
                  background: `${sectionColor}${expandedScene === i ? '' : '60'}`,
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 1, overflow: 'hidden', transition: 'all 0.2s ease',
                }}>
                  <span style={{ fontSize: 8, opacity: 0.8, textTransform: 'uppercase' }}>{s.section || ''}</span>
                  <span>{s.duration}s</span>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 9, color: C.textDim, fontFamily: 'monospace' }}>0:00</span>
            <span style={{ fontSize: 9, color: C.textDim, fontFamily: 'monospace' }}>0:{String(totalDuration).padStart(2, '0')}</span>
          </div>
        </div>

        {/* 씬별 촬영 스크립트 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {storyboard.scenes?.map((s, i) => {
            const isExpanded = expandedScene === i
            const sectionColor = SECTION_COLORS[s.section?.toUpperCase()] || C.accent
            const timeStart = storyboard.scenes.slice(0, i).reduce((sum, sc) => sum + (sc.duration || 0), 0)
            const timeEnd = timeStart + (s.duration || 0)

            return (
              <div key={i} style={{
                background: C.card, border: `1px solid ${isExpanded ? sectionColor : C.border}`,
                borderLeft: `4px solid ${sectionColor}`,
                borderRadius: 14, overflow: 'hidden', transition: 'all 0.3s ease',
              }}>
                {/* 씬 헤더 (항상 표시) */}
                <div onClick={() => setExpandedScene(isExpanded ? null : i)} style={{
                  padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                  background: isExpanded ? `${sectionColor}08` : 'transparent',
                }}>
                  {/* 씬 번호 */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: isExpanded ? sectionColor : `${sectionColor}30`,
                    color: isExpanded ? '#fff' : sectionColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800, flexShrink: 0,
                  }}>{s.scene_no}</div>

                  {/* 씬 요약 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                        background: `${sectionColor}22`, color: sectionColor, letterSpacing: '0.08em',
                      }}>{s.section || 'SCENE'}</span>
                      <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>
                        {Math.floor(timeStart / 60)}:{String(timeStart % 60).padStart(2, '0')} — {Math.floor(timeEnd / 60)}:{String(timeEnd % 60).padStart(2, '0')}
                      </span>
                      <span style={{ fontSize: 10, color: C.textDim }}>({s.duration}초)</span>
                      {s.estimated_shoot_time && (
                        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: `${C.purple}18`, color: C.purple }}>
                          촬영 {s.estimated_shoot_time}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.subtitle_text || s.description || ''}
                    </div>
                  </div>

                  {/* 확장 아이콘 */}
                  <span style={{ fontSize: 16, color: C.textDim, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>▾</span>
                </div>

                {/* 씬 상세 (확장 시) */}
                {isExpanded && (
                  <div style={{ padding: '0 20px 20px 20px' }}>
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                      {/* 촬영 스크립트 디테일 */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
                        <DetailRow icon="📸" label="카메라 앵글 / 구도" value={s.camera_angle} color={C.blue} />
                        <DetailRow icon="🌅" label="촬영 환경" value={s.set_environment} color={C.green} />
                        <DetailRow icon="🎬" label="연기 디렉션" value={s.acting_direction} color={C.orange} />
                        <DetailRow icon="💬" label="자막 텍스트" value={s.subtitle_text} color={C.accent} />
                        <DetailRow icon="⏱️" label="자막 타이밍" value={s.subtitle_timing} color={C.textMuted} />
                        <DetailRow icon="🔀" label="전환 효과" value={s.transition} color={C.purple} />
                        <DetailRow icon="🔊" label="음향 / BGM 가이드" value={s.audio_guide} color={C.pink} />
                        <DetailRow icon="⏰" label="예상 촬영 시간" value={s.estimated_shoot_time} color={C.purple} />
                      </div>

                      {/* 추가 노트 */}
                      {s.director_note && (
                        <div style={{ marginTop: 14, padding: '12px 16px', background: `${C.purple}0a`, border: `1px solid ${C.purple}20`, borderRadius: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 12 }}>📝</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: C.purple, letterSpacing: '0.06em' }}>감독 노트</span>
                          </div>
                          <p style={{ fontSize: 12, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>{s.director_note}</p>
                        </div>
                      )}

                      {/* 소품/준비물 */}
                      {s.props && (
                        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, marginRight: 4 }}>준비물:</span>
                          {(Array.isArray(s.props) ? s.props : [s.props]).map((prop, pi) => (
                            <span key={pi} style={{ fontSize: 10, padding: '3px 8px', background: C.surface, color: C.textMuted, borderRadius: 6, border: `1px solid ${C.border}` }}>{prop}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 나레이션 */}
        {storyboard.narration && (
          <div style={{ marginTop: 24, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 16 }}>🎙</span>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>나레이션 스크립트</h3>
            </div>
            <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.8, margin: '0 0 14px 0', padding: '12px 16px', background: C.surface, borderRadius: 10 }}>
              {storyboard.narration.full_script}
            </p>
            {storyboard.narration.segments?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.06em' }}>씬별 나레이션</span>
                {storyboard.narration.segments.map((seg, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', background: C.surface, borderRadius: 8 }}>
                    <span style={{ fontSize: 10, color: C.accent, fontWeight: 700, fontFamily: 'monospace', flexShrink: 0, marginTop: 2 }}>
                      #{seg.scene_no}
                    </span>
                    <span style={{ fontSize: 12, color: C.text, lineHeight: 1.5, flex: 1 }}>{seg.text}</span>
                    <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace', flexShrink: 0 }}>
                      {seg.start_time}s~{seg.end_time}s
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BGM 가이드 */}
        {storyboard.bgm && (
          <div style={{ marginTop: 16, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>🎵</span>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>BGM 가이드</h3>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ padding: '8px 14px', background: C.surface, borderRadius: 10 }}>
                <span style={{ fontSize: 10, color: C.textDim, display: 'block', marginBottom: 2 }}>분위기</span>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{storyboard.bgm.mood}</span>
              </div>
              <div style={{ padding: '8px 14px', background: C.surface, borderRadius: 10 }}>
                <span style={{ fontSize: 10, color: C.textDim, display: 'block', marginBottom: 2 }}>BPM</span>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{storyboard.bgm.bpm_range}</span>
              </div>
              <div style={{ padding: '8px 14px', background: C.surface, borderRadius: 10 }}>
                <span style={{ fontSize: 10, color: C.textDim, display: 'block', marginBottom: 2 }}>볼륨 비율</span>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{storyboard.bgm.volume_ratio * 100}%</span>
              </div>
              {storyboard.bgm.reference && (
                <div style={{ padding: '8px 14px', background: C.surface, borderRadius: 10 }}>
                  <span style={{ fontSize: 10, color: C.textDim, display: 'block', marginBottom: 2 }}>레퍼런스</span>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{storyboard.bgm.reference}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 해시태그 */}
        {storyboard.metadata?.hashtags?.length > 0 && (
          <div style={{ marginTop: 16, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 14, color: C.purple }}>#</span>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>업로드 메타데이터</h3>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {storyboard.metadata.hashtags.map((tag, i) => (
                <span key={i} style={{ padding: '4px 10px', background: `${C.purple}18`, borderRadius: 8, fontSize: 11, color: C.purple }}>{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* 하단 액션 */}
        <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { setStoryboard(null); setTab('input') }} style={{
            padding: '12px 28px', borderRadius: 10, border: `1px solid ${C.border}`,
            background: C.card, color: C.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>↻ 스토리보드 재생성</button>
          <button onClick={() => {
            const printContent = storyboard.scenes?.map(s => [
              `── 씬 ${s.scene_no} [${s.section}] (${s.duration}초) ──`,
              `📸 카메라: ${s.camera_angle || '-'}`,
              `🌅 환경: ${s.set_environment || '-'}`,
              `🎬 연기: ${s.acting_direction || '-'}`,
              `💬 자막: ${s.subtitle_text || '-'}`,
              `⏱️ 타이밍: ${s.subtitle_timing || '-'}`,
              `🔀 전환: ${s.transition || '-'}`,
              `🔊 음향: ${s.audio_guide || '-'}`,
              `⏰ 촬영시간: ${s.estimated_shoot_time || '-'}`,
              s.props ? `📦 준비물: ${Array.isArray(s.props) ? s.props.join(', ') : s.props}` : '',
              s.director_note ? `📝 감독노트: ${s.director_note}` : '',
            ].filter(Boolean).join('\n')).join('\n\n')

            const fullText = [
              `═══ ${storyboard.metadata?.title || product?.name} 촬영 스토리보드 ═══`,
              `플랫폼: ${platform === 'shorts' ? 'YouTube Shorts' : 'Instagram Reels'}`,
              `총 길이: ${totalDuration}초 | 씬 수: ${storyboard.scenes?.length}개`,
              `훅 전략: ${storyboard.hook_strategy || '-'}`,
              '',
              printContent,
              '',
              `── 나레이션 ──`,
              storyboard.narration?.full_script || '-',
              '',
              `── BGM ──`,
              `분위기: ${storyboard.bgm?.mood || '-'} | BPM: ${storyboard.bgm?.bpm_range || '-'}`,
            ].join('\n')

            navigator.clipboard.writeText(fullText).then(() => {
              alert('촬영 가이드 시트가 클립보드에 복사되었습니다!')
            }).catch(() => {
              const blob = new Blob([fullText], { type: 'text/plain' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `storyboard_${product?.id || 'meliens'}.txt`
              a.click()
              URL.revokeObjectURL(url)
            })
          }} style={{
            padding: '12px 28px', borderRadius: 10, border: 'none',
            background: `linear-gradient(135deg, ${C.accent}, ${C.green})`,
            color: C.bg, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>📋 촬영 가이드 시트 복사 / 다운로드</button>
        </div>
      </div>
    )
  }

  // ─── MAIN RENDER ───
  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${C.border}`,
        background: `linear-gradient(180deg, ${C.surface} 0%, ${C.bg} 100%)`,
        padding: '14px 24px',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, fontWeight: 900, color: '#fff',
              }}>S</div>
              <div>
                <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, letterSpacing: '-0.03em', color: C.text }}>
                  MELIENS <span style={{ color: C.purple }}>STORYBOARD</span>
                </h1>
                <p style={{ fontSize: 10, color: C.textDim, margin: 0, letterSpacing: '0.1em' }}>
                  Pentacle × AI SHOOTING GUIDE SHEET
                </p>
              </div>
            </Link>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {product && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 16 }}>{product.emoji}</span>
                <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{product.name}</span>
              </div>
            )}
            <Link href="/" style={{
              padding: '5px 12px', background: C.accentDim, borderRadius: 8,
              fontSize: 11, color: C.accent, fontWeight: 600, textDecoration: 'none',
              border: `1px solid ${C.accent}33`,
            }}>← Discovery Engine</Link>
          </div>
        </div>
      </header>

      {/* Tabs — 2 tabs only */}
      <nav style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', padding: '0 24px' }}>
          {[
            { id: 'input', label: '제품 & 설정', icon: '◈' },
            { id: 'storyboard', label: '촬영 스토리보드', icon: '📋' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '13px 24px', background: 'transparent',
              color: tab === t.id ? C.purple : C.textMuted,
              border: 'none', borderBottom: `2px solid ${tab === t.id ? C.purple : 'transparent'}`,
              cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
              display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize: 15 }}>{t.icon}</span>
              {t.label}
              {t.id === 'storyboard' && storyboard && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Progress */}
      {loading && (
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 24px 0' }}>
          <div style={{ background: C.card, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>{stage}</span>
              <span style={{ fontSize: 12, color: C.textDim, fontFamily: 'monospace' }}>{progress}%</span>
            </div>
            <div style={{ background: C.border, borderRadius: 6, height: 5, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, ${C.purple}, ${C.accent})`, borderRadius: 6, transition: 'width 0.5s' }} />
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 24px 0' }}>
          <div style={{ padding: '12px 16px', background: `${C.red}12`, border: `1px solid ${C.red}33`, borderRadius: 10, fontSize: 13, color: C.red, display: 'flex', justifyContent: 'space-between' }}>
            {error}
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        </div>
      )}

      {/* Content — full width */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px' }}>
        {tab === 'input' && renderInput()}
        {tab === 'storyboard' && renderStoryboard()}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '14px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: C.textDim, margin: 0 }}>
          Pentacle × AI Algorithm Performance Platform — MELIENS STORYBOARD v2.0
        </p>
      </footer>
    </div>
  )
}
