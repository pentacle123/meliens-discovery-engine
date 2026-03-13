'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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

const TYPE_COLORS = {
  ai_video: '#a78bfa',
  motion_image: '#4ecdc4',
  generated_image: '#f59e0b',
}

const TYPE_LABELS = {
  ai_video: 'AI VIDEO',
  motion_image: 'MOTION',
  generated_image: 'AI IMAGE',
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

// ─── MAIN COMPONENT ───
export default function StudioEngine() {
  const [product, setProduct] = useState(null)
  const [context, setContext] = useState(null)
  const [ideas, setIdeas] = useState(null)

  const [videoStyle, setVideoStyle] = useState('before_after')
  const [platform, setPlatform] = useState('reels')
  const [targetDuration, setTargetDuration] = useState(22)
  const [includeHuman, setIncludeHuman] = useState(false)
  const [toneAndManner, setToneAndManner] = useState('솔직하고 드라마틱')

  const [tab, setTab] = useState('input')
  const [loading, setLoading] = useState(false)
  const [storyboard, setStoryboard] = useState(null)
  const [error, setError] = useState(null)
  const [stage, setStage] = useState('')
  const [progress, setProgress] = useState(0)
  const [activeScene, setActiveScene] = useState(0)
  const [videoUrl, setVideoUrl] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [assetErrors, setAssetErrors] = useState(null)

  // 제품 소스 이미지 (통합 업로드)
  const [sourceFiles, setSourceFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

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

  // ─── 제품 소스 파일 처리 ───
  const handleSourceFiles = useCallback((files) => {
    const newFiles = Array.from(files).filter(f => {
      const isImage = f.type.startsWith('image/')
      const isVideo = f.type.startsWith('video/')
      return (isImage || isVideo) && f.size <= 20 * 1024 * 1024
    }).map(f => ({
      file: f,
      name: f.name,
      size: f.size,
      type: f.type.startsWith('video/') ? 'video' : 'image',
      previewUrl: URL.createObjectURL(f),
    }))
    setSourceFiles(prev => [...prev, ...newFiles])
  }, [])

  const removeSourceFile = useCallback((idx) => {
    setSourceFiles(prev => {
      const updated = [...prev]
      if (updated[idx]?.previewUrl) URL.revokeObjectURL(updated[idx].previewUrl)
      updated.splice(idx, 1)
      return updated
    })
  }, [])

  // ─── 스토리보드 생성 (소스 정보 포함) ───
  const handleGenerateStoryboard = useCallback(async () => {
    if (!product) {
      setError('제품 정보가 없습니다. Discovery Engine에서 제품을 선택해주세요.')
      return
    }
    setLoading(true)
    setError(null)
    setStage('AI 크리에이티브 디렉터가 스토리보드를 설계하고 있습니다...')
    setProgress(20)

    try {
      // 업로드된 소스 파일 정보를 API에 전달 (파일 내용이 아닌 메타데이터만)
      const uploadedSources = sourceFiles.map((sf, i) => ({
        index: i,
        name: sf.name,
        type: sf.type,
      }))

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
          includeHuman,
          toneAndManner,
          uploadedSources,
        }),
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error || '스토리보드 생성 실패')

      setStoryboard(data.storyboard)
      setTab('storyboard')
      setProgress(100)
      setStage('스토리보드 완성!')
    } catch (err) {
      setError(err.message || '스토리보드 생성 실패')
    } finally {
      setLoading(false)
    }
  }, [product, context, ideas, videoStyle, platform, targetDuration, includeHuman, toneAndManner, sourceFiles])

  // ─── 파일 → base64 변환 헬퍼 ───
  const fileToDataUrl = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [])

  // ─── 씬의 소스 매칭 변경 ───
  const updateSceneMatch = useCallback((sceneNo, newSourceIdx) => {
    if (!storyboard) return
    setStoryboard(prev => ({
      ...prev,
      scenes: prev.scenes.map(s =>
        s.scene_no === sceneNo
          ? { ...s, matched_source: newSourceIdx === 'null' ? null : Number(newSourceIdx) }
          : s
      ),
    }))
  }, [storyboard])

  // ─── 영상 생성 ───
  const handleGenerateVideo = useCallback(async () => {
    if (!storyboard) return
    setGenerating(true)
    setError(null)
    setStage('AI 영상 클립 생성 중... (2~4분 소요)')
    setProgress(10)

    const stages = [
      { p: 30, msg: 'fal.ai에서 AI 영상 클립 생성 중...' },
      { p: 60, msg: '에셋 생성 완료, 나레이션 생성 중...' },
      { p: 80, msg: 'Creatomate에서 최종 영상 합성 중...' },
    ]
    let stageIdx = 0
    const interval = setInterval(() => {
      if (stageIdx < stages.length) {
        setProgress(stages[stageIdx].p)
        setStage(stages[stageIdx].msg)
        stageIdx++
      }
    }, 30000)

    try {
      // 제품 소스 이미지를 base64로 변환하여 전달
      const imagesPayload = await Promise.all(
        sourceFiles.map(async (sf, i) => ({
          key: `source_${i}`,
          description: sf.name,
          url: await fileToDataUrl(sf.file),
        }))
      )

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyboard,
          images: imagesPayload,
        }),
      })

      clearInterval(interval)
      const data = await res.json()
      if (!data.success) throw new Error(data.error || '영상 생성 실패')

      setVideoUrl(data.videoUrl)
      setAssetErrors(data.assetErrors || null)
      setTab('output')
      setProgress(100)
      setStage(`완료! 총 비용: $${data.totalCost?.toFixed(2)}`)
    } catch (err) {
      clearInterval(interval)
      setError(err.message || '영상 생성 실패')
    } finally {
      setGenerating(false)
    }
  }, [storyboard, sourceFiles, fileToDataUrl])

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

        {/* 제품 소스 이미지 업로드 */}
        <div style={{ background: C.card, border: `1px solid ${sourceFiles.length > 0 ? C.accent : C.border}44`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>📷 제품 소스 이미지</h3>
            {sourceFiles.length > 0 && (
              <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>{sourceFiles.length}장 업로드</span>
            )}
          </div>
          <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
            제품 사진/영상을 3~5장 업로드하면, AI가 스토리보드를 보고 <strong style={{ color: C.accent }}>각 씬에 가장 적합한 소스를 자동 매칭</strong>합니다.
          </p>

          {/* 업로드된 파일 그리드 */}
          {sourceFiles.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 12 }}>
              {sourceFiles.map((sf, i) => (
                <div key={i} style={{
                  position: 'relative', borderRadius: 10, overflow: 'hidden',
                  border: `1px solid ${C.accent}33`, background: C.surface,
                }}>
                  <img src={sf.previewUrl} alt={sf.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  <button onClick={() => removeSourceFile(i)} style={{
                    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>×</button>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'rgba(0,0,0,0.7)', padding: '4px 6px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 8, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{sf.name}</span>
                    <span style={{ fontSize: 9, color: C.accent, fontWeight: 700, marginLeft: 4, flexShrink: 0 }}>#{i}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 드래그 앤 드롭 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleSourceFiles(e.dataTransfer.files) }}
            style={{
              border: `2px dashed ${dragOver ? C.accent : C.border}`,
              borderRadius: 10, padding: '18px 12px', textAlign: 'center',
              cursor: 'pointer', transition: 'all 0.2s',
              background: dragOver ? `${C.accent}08` : 'transparent',
            }}
          >
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }}
              onChange={e => { handleSourceFiles(e.target.files); e.target.value = '' }} />
            <div style={{ fontSize: 24, opacity: 0.4, marginBottom: 6 }}>📷</div>
            <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>클릭 또는 드래그하여 업로드</div>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>이미지/영상 여러 장 가능 · 20MB 이내 · 선택사항</div>
          </div>
        </div>

        {/* 영상 설정 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>영상 설정</h3>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>사람 등장 (손/턱 아래만)</span>
            <button onClick={() => setIncludeHuman(!includeHuman)} style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: includeHuman ? C.accent : C.border, position: 'relative',
            }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: includeHuman ? 23 : 3, transition: 'left 0.2s' }} />
            </button>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 8, letterSpacing: '0.04em' }}>톤 & 매너</label>
            <input value={toneAndManner} onChange={e => setToneAndManner(e.target.value)} style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              background: C.surface, border: `1px solid ${C.border}`, color: C.text,
              fontSize: 13, outline: 'none', fontFamily: 'inherit',
            }} />
          </div>
        </div>

        {/* 생성 버튼 */}
        <button onClick={handleGenerateStoryboard} disabled={loading || !product}
          className={loading || !product ? '' : 'pulse-glow'}
          style={{
            width: '100%', padding: 16, borderRadius: 12, border: 'none',
            background: loading || !product ? C.border : `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
            color: loading || !product ? C.textDim : '#fff',
            fontSize: 15, fontWeight: 700,
            cursor: loading || !product ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          {loading ? '◌ 스토리보드 생성 중...' : `⚡ AI 스토리보드 생성 (~$0.01)${sourceFiles.length > 0 ? ` · 소스 ${sourceFiles.length}장 자동 매칭` : ''}`}
        </button>
      </div>
    )
  }

  // ─── RENDER: STORYBOARD TAB ───
  function renderStoryboard() {
    if (!storyboard) {
      return (
        <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>
          <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 16 }}>🎬</div>
          <p style={{ fontSize: 14 }}>상품 입력 탭에서 스토리보드를 먼저 생성해주세요</p>
        </div>
      )
    }

    const scene = storyboard.scenes?.[activeScene]
    const matchedCount = storyboard.scenes?.filter(s => s.matched_source !== null && s.matched_source !== undefined).length || 0

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Left: Scene list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Hook */}
          <div style={{ background: C.card, borderRadius: 12, padding: 14, borderLeft: `3px solid ${C.orange}` }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.orange, letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>🎣 훅 전략</span>
            <span style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{storyboard.hook_strategy}</span>
          </div>

          {/* 소스 매칭 요약 */}
          {sourceFiles.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.06em' }}>🤖 AI 소스 자동 매칭</span>
                <span style={{ fontSize: 10, color: C.textMuted }}>{matchedCount}/{storyboard.scenes?.length}개 씬 매칭</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {sourceFiles.map((sf, i) => {
                  const usedBy = storyboard.scenes?.filter(s => s.matched_source === i).length || 0
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                      background: usedBy > 0 ? `${C.accent}12` : C.surface,
                      borderRadius: 8, border: `1px solid ${usedBy > 0 ? C.accent : C.border}30`,
                    }}>
                      <img src={sf.previewUrl} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
                      <span style={{ fontSize: 10, color: usedBy > 0 ? C.accent : C.textDim, fontWeight: 600 }}>
                        #{i} {usedBy > 0 ? `→ ${usedBy}씬` : '미사용'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Scenes */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>씬 구성</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {storyboard.scenes?.map((s, i) => {
                const hasMatch = s.matched_source !== null && s.matched_source !== undefined
                const matchedFile = hasMatch ? sourceFiles[s.matched_source] : null
                return (
                  <div key={i} style={{
                    background: C.surface, borderRadius: 10, overflow: 'hidden',
                    borderLeft: `3px solid ${TYPE_COLORS[s.type] || C.textDim}`,
                    opacity: activeScene === i ? 1 : 0.75, transition: 'opacity 0.2s',
                  }}>
                    {/* 씬 헤더 */}
                    <div onClick={() => setActiveScene(i)} style={{
                      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', background: C.border,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: C.textMuted, flexShrink: 0,
                      }}>{s.scene_no}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: TYPE_COLORS[s.type], fontFamily: 'monospace' }}>
                            {TYPE_LABELS[s.type] || s.type}
                          </span>
                          {s.model && <span style={{ fontSize: 9, color: C.textDim }}>{s.model}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.text_overlay || s.prompt?.substring(0, 60) || s.motion || ''}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace', flexShrink: 0 }}>{s.duration}s</span>
                    </div>

                    {/* AI 소스 매칭 결과 */}
                    <div style={{ padding: '0 14px 10px 14px' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                        background: hasMatch ? `${C.accent}08` : `${C.purple}08`,
                        borderRadius: 8, border: `1px solid ${hasMatch ? C.accent : C.purple}20`,
                      }}>
                        {hasMatch && matchedFile ? (
                          <>
                            <img src={matchedFile.previewUrl} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 10, color: C.accent, fontWeight: 700 }}>소스 #{s.matched_source} 매칭</div>
                              <div style={{ fontSize: 9, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {s.source_prompt?.slice(0, 60) || ''}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: C.purple, fontWeight: 700 }}>🤖 순수 AI 생성</div>
                            <div style={{ fontSize: 9, color: C.textDim }}>소스 불필요 — AI가 장면을 생성합니다</div>
                          </div>
                        )}
                        {/* 소스 변경 드롭다운 */}
                        {sourceFiles.length > 0 && (
                          <select
                            value={hasMatch ? s.matched_source : 'null'}
                            onChange={e => updateSceneMatch(s.scene_no, e.target.value)}
                            style={{
                              fontSize: 10, padding: '3px 6px', borderRadius: 6,
                              background: C.bg, color: C.textMuted, border: `1px solid ${C.border}`,
                              cursor: 'pointer', flexShrink: 0,
                            }}
                          >
                            <option value="null">AI 생성</option>
                            {sourceFiles.map((_, si) => (
                              <option key={si} value={si}>소스 #{si}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Narration */}
          {storyboard.narration && (
            <div style={{ background: C.card, borderRadius: 12, padding: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.green, letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>🎙 나레이션</span>
              <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7, margin: 0 }}>{storyboard.narration.full_script}</p>
            </div>
          )}

          {/* Metadata */}
          {storyboard.metadata && (
            <div style={{ background: C.card, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 6 }}>{storyboard.metadata.title}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {storyboard.metadata.hashtags?.map((tag, i) => (
                  <span key={i} style={{ padding: '2px 7px', background: `${C.purple}18`, borderRadius: 6, fontSize: 10, color: C.purple }}>{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Cost + actions */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, padding: '10px 14px', background: C.card, borderRadius: 10, fontSize: 12 }}>
              <span style={{ color: C.textMuted }}>예상 비용: </span>
              <span style={{ color: C.green, fontWeight: 700 }}>${storyboard.estimated_cost?.toFixed?.(2) || '0.80'}</span>
              <span style={{ color: C.textDim, marginLeft: 8 }}>{storyboard.duration_target || targetDuration}초</span>
            </div>
            <button onClick={() => { setStoryboard(null); setTab('input') }} style={{
              padding: '10px 20px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.card, color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>↻ 재생성</button>
            <button onClick={handleGenerateVideo} disabled={generating} style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: generating ? C.border : C.green,
              color: generating ? C.textDim : C.bg,
              fontSize: 12, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer',
            }}>
              {generating ? '◌ 생성 중...' : '🎬 영상 생성 (~$0.80)'}
            </button>
          </div>
        </div>

        {/* Right: Preview sidebar */}
        {scene && (
          <div style={{ position: 'sticky', top: 20, alignSelf: 'start' }}>
            <div style={{ background: C.card, borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}` }}>
              <div style={{
                aspectRatio: '9/16', maxHeight: 420, background: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #000 70%)' }} />
                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: 20 }}>
                  <span style={{
                    padding: '3px 8px', background: TYPE_COLORS[scene.type] || C.textDim,
                    borderRadius: 5, fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: '0.08em',
                  }}>
                    {TYPE_LABELS[scene.type] || scene.type}
                  </span>
                  {scene.text_overlay && (
                    <div style={{
                      marginTop: 16, fontSize: scene.text_style === 'bold_center_white' ? 18 : 14,
                      fontWeight: 800, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.8)', lineHeight: 1.4,
                    }}>{scene.text_overlay}</div>
                  )}
                  {scene.source_prompt && (
                    <div style={{ marginTop: 10, fontSize: 10, color: C.accent, lineHeight: 1.4, maxWidth: 220, margin: '10px auto 0', opacity: 0.8 }}>
                      i2v: {scene.source_prompt.substring(0, 80)}...
                    </div>
                  )}
                  {scene.prompt && !scene.source_prompt && (
                    <div style={{ marginTop: 10, fontSize: 10, color: C.purple, lineHeight: 1.4, maxWidth: 220, margin: '10px auto 0', opacity: 0.7 }}>
                      {scene.prompt.substring(0, 100)}...
                    </div>
                  )}
                  {scene.motion && (
                    <div style={{ marginTop: 8, fontSize: 10, color: C.accent, fontFamily: 'monospace', opacity: 0.6 }}>
                      motion: {scene.motion}
                    </div>
                  )}
                  {/* 매칭된 소스 프리뷰 */}
                  {scene.matched_source !== null && scene.matched_source !== undefined && sourceFiles[scene.matched_source] && (
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                      <img src={sourceFiles[scene.matched_source].previewUrl} alt="matched"
                        style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', border: `2px solid ${C.accent}` }} />
                    </div>
                  )}
                </div>
                <div style={{ position: 'absolute', top: 8, left: 10, background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, color: C.text }}>
                  {scene.scene_no}/{storyboard.scenes.length}
                </div>
                <div style={{ position: 'absolute', top: 8, right: 10, background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: C.textMuted, fontFamily: 'monospace' }}>
                  {scene.duration}s
                </div>
              </div>
              {/* Timeline */}
              <div style={{ padding: '10px 12px', background: C.bg }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {storyboard.scenes.map((s, i) => (
                    <button key={i} onClick={() => setActiveScene(i)} style={{
                      flex: s.duration / (storyboard.duration_target || targetDuration),
                      height: 28, borderRadius: 5, cursor: 'pointer',
                      border: activeScene === i ? '2px solid #fff' : '1px solid transparent',
                      background: `${TYPE_COLORS[s.type] || C.textDim}${activeScene === i ? '' : '40'}`,
                      fontSize: 8, fontWeight: 600,
                      color: activeScene === i ? '#fff' : C.textMuted,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    }}>
                      {s.duration >= 4 ? `${s.duration}s` : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
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
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
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
                  MELIENS <span style={{ color: C.purple }}>AI STUDIO</span>
                </h1>
                <p style={{ fontSize: 10, color: C.textDim, margin: 0, letterSpacing: '0.1em' }}>
                  SHORTFORM VIDEO STORYBOARD ENGINE
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

      {/* Tabs */}
      <nav style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', padding: '0 24px' }}>
          {[
            { id: 'input', label: '제품 & 설정', icon: '◈' },
            { id: 'storyboard', label: '스토리보드', icon: '🎬' },
            { id: 'output', label: '최종 출력', icon: '✅' },
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
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px 0' }}>
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
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px 0' }}>
          <div style={{ padding: '12px 16px', background: `${C.red}12`, border: `1px solid ${C.red}33`, borderRadius: 10, fontSize: 13, color: C.red, display: 'flex', justifyContent: 'space-between' }}>
            {error}
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        </div>
      )}

      {/* Content */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>
        {tab === 'input' && renderInput()}
        {tab === 'storyboard' && renderStoryboard()}
        {tab === 'output' && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 40, textAlign: 'center' }}>
            {videoUrl ? (
              <>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8 }}>영상 생성 완료!</h2>
                <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>
                  {storyboard?.metadata?.title || product?.name}
                </p>
                {assetErrors && Object.keys(assetErrors).length > 0 && (
                  <div style={{
                    textAlign: 'left', marginBottom: 20, padding: 14,
                    background: `${C.orange}0a`, border: `1px solid ${C.orange}33`,
                    borderRadius: 10, maxWidth: 480, margin: '0 auto 20px',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚠</span> 일부 씬에서 AI 영상 생성 문제 발생
                    </div>
                    {Object.entries(assetErrors).map(([sceneNo, errMsg]) => (
                      <div key={sceneNo} style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, display: 'flex', gap: 8 }}>
                        <span style={{ color: C.orange, fontWeight: 700, flexShrink: 0 }}>씬 #{sceneNo}</span>
                        <span>{errMsg}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 8 }}>
                      문제 씬은 정적 이미지로 대체되었습니다.
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
                  <div style={{ padding: '7px 14px', background: C.surface, borderRadius: 8, fontSize: 12 }}>
                    <span style={{ color: C.textDim }}>길이 </span>
                    <span style={{ color: C.text, fontWeight: 700 }}>{storyboard?.duration_target || targetDuration}초</span>
                  </div>
                </div>
                <a href={videoUrl} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-block', padding: '12px 28px', borderRadius: 10, border: 'none',
                  background: `linear-gradient(135deg, ${C.purple}, ${C.accent})`, color: '#fff',
                  fontSize: 14, fontWeight: 700, textDecoration: 'none',
                }}>📥 영상 다운로드</a>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}>🎬</div>
                <p style={{ fontSize: 14, color: C.textMuted }}>스토리보드 탭에서 &quot;영상 생성&quot; 버튼을 눌러주세요</p>
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '14px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: C.textDim, margin: 0 }}>
          MELIENS AI STUDIO v1.0 — Discovery Engine × ShortForm Factory Pipeline
        </p>
      </footer>
    </div>
  )
}
