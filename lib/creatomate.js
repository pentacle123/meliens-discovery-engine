/**
 * Meliens AI Studio — Creatomate RenderScript 변환기
 *
 * 스토리보드 JSON + 에셋 URL → Creatomate RenderScript → MP4
 */

// ──────────────────────────────────────
// 스토리보드 → RenderScript 변환
// ──────────────────────────────────────

export function convertToRenderScript(storyboard, assets, narrationUrl, bgmUrl) {
  const elements = []

  // 1. 배경 (검은색)
  elements.push({
    type: 'shape',
    shape: 'rectangle',
    width: '100%',
    height: '100%',
    fill_color: '#000000',
    time: 0,
    duration: storyboard.duration_target,
  })

  // 2. 씬별 비주얼 레이어
  for (const scene of storyboard.scenes) {
    const assetUrl = assets[scene.scene_no]
    if (!assetUrl) continue

    if (scene.type === 'ai_video') {
      elements.push({
        type: 'video',
        source: assetUrl,
        time: scene.timestamp_start,
        duration: scene.duration,
        width: '100%',
        height: '100%',
        fit: 'cover',
        ...(scene.transition_in !== 'cut' && {
          animations: [getTransitionAnimation(scene.transition_in, 0.5)].filter(Boolean),
        }),
      })
    } else {
      const motionAnimations = getMotionAnimations(scene.motion, scene.duration)
      elements.push({
        type: 'image',
        source: assetUrl,
        time: scene.timestamp_start,
        duration: scene.duration,
        width: '110%',
        height: '110%',
        fit: 'cover',
        animations: [
          ...(scene.transition_in !== 'cut' ? [getTransitionAnimation(scene.transition_in, 0.5)] : []),
          ...motionAnimations,
        ].filter(Boolean),
      })
    }

    // 3. 텍스트 오버레이
    if (scene.text_overlay) {
      const textConfig = getTextConfig(scene.text_style || 'bold_center_white')
      elements.push({
        type: 'text',
        text: scene.text_overlay,
        time: scene.timestamp_start,
        duration: scene.duration,
        ...textConfig,
        animations: [{ type: 'text-appear', duration: 0.3, split: 'word' }],
      })
    }
  }

  // 4. 자막 레이어 (나레이션 세그먼트별)
  if (storyboard.narration?.segments) {
    for (const segment of storyboard.narration.segments) {
      if (!segment.text) continue
      elements.push({
        type: 'text',
        text: segment.text,
        time: segment.start_time,
        duration: segment.end_time - segment.start_time,
        x: '50%',
        y: '85%',
        width: '85%',
        height: 'auto',
        x_anchor: '50%',
        y_anchor: '50%',
        fill_color: '#FFFFFF',
        font_family: 'Noto Sans KR',
        font_weight: '700',
        font_size: '5.5 vmin',
        background_color: 'rgba(0,0,0,0.5)',
        background_x_padding: '10%',
        background_y_padding: '5%',
        background_border_radius: '5%',
        text_alignment: 'center',
        animations: [{ type: 'text-appear', duration: 0.2 }],
      })
    }
  }

  // 5. 나레이션 오디오
  if (narrationUrl) {
    elements.push({
      type: 'audio',
      source: narrationUrl,
      time: 0,
      duration: storyboard.duration_target,
      volume: '100%',
    })
  }

  // 6. BGM
  if (bgmUrl) {
    elements.push({
      type: 'audio',
      source: bgmUrl,
      time: 0,
      duration: storyboard.duration_target,
      volume: `${Math.round((storyboard.bgm?.volume_ratio || 0.3) * 100)}%`,
      audio_fade_out: 3,
    })
  }

  return {
    output_format: 'mp4',
    width: 1080,
    height: 1920,
    frame_rate: 30,
    duration: storyboard.duration_target,
    elements,
  }
}

// ──────────────────────────────────────
// Creatomate API 렌더링
// ──────────────────────────────────────

export async function renderWithCreatomate(renderScript, apiKey) {
  const response = await fetch('https://api.creatomate.com/v1/renders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source: renderScript }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Creatomate render failed: ${response.status} - ${error}`)
  }

  const renders = await response.json()
  const render = renders[0]
  console.log(`[Creatomate] Render started: ${render.id}, status: ${render.status}`)

  return await pollCreatomateRender(render.id, apiKey)
}

async function pollCreatomateRender(renderId, apiKey, timeoutMs = 120000) {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const response = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })

    if (!response.ok) throw new Error(`Creatomate poll failed: ${response.status}`)

    const render = await response.json()

    if (render.status === 'succeeded') {
      console.log(`[Creatomate] Render complete: ${render.url}`)
      return { id: render.id, url: render.url, status: 'succeeded' }
    }

    if (render.status === 'failed') {
      throw new Error(`Creatomate render failed: ${render.error_message || 'Unknown'}`)
    }

    await new Promise(resolve => setTimeout(resolve, 5000))
  }

  throw new Error(`Creatomate render timed out after ${timeoutMs / 1000}s`)
}

// ──────────────────────────────────────
// 헬퍼: 전환/모션/텍스트 스타일
// ──────────────────────────────────────

function getTransitionAnimation(transition, duration) {
  switch (transition) {
    case 'fade': return { type: 'fade', fade_duration: duration }
    case 'wipe_left': return { type: 'wipe', direction: 'left', duration }
    case 'wipe_right': return { type: 'wipe', direction: 'right', duration }
    case 'zoom_in': return { type: 'scale', start_scale: '80%', duration }
    case 'dissolve': return { type: 'fade', fade_duration: duration * 1.5 }
    default: return null
  }
}

function getMotionAnimations(motion, duration) {
  if (!motion) return []
  switch (motion) {
    case 'slow_zoom_in': return [{ type: 'scale', start_scale: '100%', end_scale: '115%', duration, easing: 'linear' }]
    case 'slow_zoom_out': return [{ type: 'scale', start_scale: '115%', end_scale: '100%', duration, easing: 'linear' }]
    case 'pan_left': return [{ type: 'pan', start_x: '5%', end_x: '-5%', duration, easing: 'linear' }]
    case 'pan_right': return [{ type: 'pan', start_x: '-5%', end_x: '5%', duration, easing: 'linear' }]
    case 'float_up': return [{ type: 'pan', start_y: '5%', end_y: '-3%', duration, easing: 'ease-out' }]
    case 'scale_up_center': return [{ type: 'scale', start_scale: '90%', end_scale: '110%', duration, easing: 'ease-out' }]
    case 'ken_burns': return [
      { type: 'scale', start_scale: '100%', end_scale: '112%', duration, easing: 'linear' },
      { type: 'pan', start_x: '-3%', end_x: '3%', duration, easing: 'linear' },
    ]
    case 'shake_subtle': return [{ type: 'shake', frequency: 3, amplitude: '0.5%', duration }]
    default: return [{ type: 'scale', start_scale: '100%', end_scale: '110%', duration, easing: 'linear' }]
  }
}

function getTextConfig(style) {
  const base = { font_family: 'Noto Sans KR', text_alignment: 'center', x_anchor: '50%' }
  switch (style) {
    case 'bold_center_white':
      return { ...base, x: '50%', y: '48%', y_anchor: '50%', width: '80%', fill_color: '#FFFFFF', font_weight: '900', font_size: '9 vmin', stroke_color: '#000000', stroke_width: '0.5 vmin' }
    case 'info_bottom_bar':
      return { ...base, x: '50%', y: '75%', y_anchor: '50%', width: '90%', fill_color: '#FFFFFF', font_weight: '600', font_size: '5 vmin', background_color: 'rgba(0,0,0,0.6)', background_x_padding: '12%', background_y_padding: '6%', background_border_radius: '6%' }
    case 'highlight_keyword':
      return { ...base, x: '50%', y: '50%', y_anchor: '50%', width: '80%', fill_color: '#FFD700', font_weight: '900', font_size: '11 vmin', stroke_color: '#000000', stroke_width: '0.6 vmin' }
    case 'cta_animated':
      return { ...base, x: '50%', y: '70%', y_anchor: '50%', width: '85%', fill_color: '#FFFFFF', font_weight: '800', font_size: '7 vmin', background_color: 'rgba(99,102,241,0.85)', background_x_padding: '15%', background_y_padding: '8%', background_border_radius: '8%' }
    case 'rating_display':
      return { ...base, x: '50%', y: '55%', y_anchor: '50%', width: '80%', fill_color: '#FFD700', font_weight: '900', font_size: '10 vmin' }
    case 'split_comparison':
      return { ...base, x: '50%', y: '15%', y_anchor: '50%', width: '80%', fill_color: '#FFFFFF', font_weight: '700', font_size: '6 vmin', stroke_color: '#000000', stroke_width: '0.3 vmin' }
    default:
      return { ...base, x: '50%', y: '50%', y_anchor: '50%', width: '80%', fill_color: '#FFFFFF', font_weight: '700', font_size: '7 vmin' }
  }
}
