/**
 * Meliens AI Studio — 영상 생성 파이프라인
 *
 * 스토리보드 JSON + 에셋 URL → 최종 MP4
 * 1. fal.ai → AI 영상/이미지 에셋
 * 2. OpenAI TTS → 나레이션 오디오
 * 3. Creatomate → 최종 영상 합성
 */

import { convertToRenderScript, renderWithCreatomate } from './creatomate'

// ══════════════════════════════════════
// STAGE 2: fal.ai 에셋 생성
// ══════════════════════════════════════

export async function generateAssets(scenes, inputImages) {
  const assets = {}

  const tasks = scenes.map(async (scene) => {
    try {
      if (scene.type === 'ai_video') {
        const endpoint = getModelEndpoint(scene.model)
        const result = await callFalAI(endpoint, {
          prompt: scene.prompt,
          image_url: inputImages[scene.reference_image] || Object.values(inputImages)[0],
          duration: String(scene.duration),
          aspect_ratio: '9:16',
        })
        assets[scene.scene_no] = result.video?.url || result.output?.url

      } else if (scene.type === 'generated_image') {
        const result = await callFalAI('fal-ai/flux-pro/v1.1', {
          prompt: scene.generation_prompt,
          image_size: { width: 1080, height: 1920 },
          num_images: 1,
        })
        assets[scene.scene_no] = result.images?.[0]?.url

      } else if (scene.type === 'motion_image') {
        assets[scene.scene_no] = inputImages[scene.source] || Object.values(inputImages)[0]
      }
    } catch (err) {
      console.error(`[generateAssets] scene ${scene.scene_no} (${scene.type}) failed:`, err)
      if (scene.type !== 'motion_image') {
        assets[scene.scene_no] = inputImages[scene.reference_image || scene.source] || Object.values(inputImages)[0]
      }
    }
  })

  await Promise.all(tasks)
  return assets
}

function safeJsonParse(text) {
  const parsed = JSON.parse(text)
  return Array.isArray(parsed) ? parsed[0] : parsed
}

async function callFalAI(endpoint, input) {
  const submitRes = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${process.env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!submitRes.ok) {
    throw new Error(`fal.ai submit error: ${submitRes.status} - ${await submitRes.text()}`)
  }

  const submitText = await submitRes.text()
  const submitData = safeJsonParse(submitText)

  // 동기 응답 (결과가 바로 온 경우)
  if (!submitData.request_id) {
    if (submitData.video || submitData.images || submitData.output) {
      return submitData
    }
    throw new Error('fal.ai: no request_id and no result in response')
  }

  const { request_id } = submitData

  // 비동기 폴링
  const startTime = Date.now()
  while (Date.now() - startTime < 300000) {
    await new Promise(r => setTimeout(r, 8000))

    const statusRes = await fetch(
      `https://queue.fal.run/${endpoint}/requests/${request_id}/status`,
      { headers: { 'Authorization': `Key ${process.env.FAL_KEY}` } }
    )
    const statusText = await statusRes.text()
    const status = safeJsonParse(statusText)

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/${endpoint}/requests/${request_id}`,
        { headers: { 'Authorization': `Key ${process.env.FAL_KEY}` } }
      )
      const resultText = await resultRes.text()
      return safeJsonParse(resultText)
    }

    if (status.status === 'FAILED') {
      throw new Error(`fal.ai generation failed: ${status.error || 'unknown'}`)
    }
  }
  throw new Error('fal.ai timeout')
}

function getModelEndpoint(model) {
  const map = {
    'kling_2.5_turbo_pro': 'fal-ai/kling-video/v2.5/turbo/image-to-video',
    'kling_3.0': 'fal-ai/kling-video/v3/pro/image-to-video',
    'hailuo_2.3_pro': 'fal-ai/minimax-video/image-to-video',
    'wan_2.2': 'fal-ai/wan/v2.2/image-to-video',
  }
  return map[model] || map['kling_2.5_turbo_pro']
}

// ══════════════════════════════════════
// STAGE 3: TTS 나레이션 생성
// ══════════════════════════════════════

export async function generateNarration(script, voice) {
  if (!script || !process.env.OPENAI_API_KEY) return null

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: script,
      voice: voice || 'nova',
      response_format: 'mp3',
    }),
  })

  if (!response.ok) return null

  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return `data:audio/mp3;base64,${base64}`
}

// ══════════════════════════════════════
// STAGE 4: Creatomate 합성
// ══════════════════════════════════════

export async function composeVideo(storyboard, assets, narrationUrl) {
  const renderScript = convertToRenderScript(storyboard, assets, narrationUrl)
  const result = await renderWithCreatomate(renderScript, process.env.CREATOMATE_API_KEY)
  return result.url
}

// ══════════════════════════════════════
// 메인 파이프라인
// ══════════════════════════════════════

export async function runPipeline(storyboard, images) {
  const startTime = Date.now()
  let totalCost = 0

  // ── STAGE 2: 에셋 생성 ──
  const inputImages = {}
  images.forEach(img => { inputImages[img.key] = img.url })

  const assets = await generateAssets(storyboard.scenes, inputImages)

  // 비용 계산
  storyboard.scenes.forEach(s => {
    if (s.type === 'ai_video') {
      const costPerSec = s.model === 'kling_3.0' ? 0.10 : s.model === 'wan_2.2' ? 0.05 : 0.07
      totalCost += costPerSec * s.duration
    } else if (s.type === 'generated_image') {
      totalCost += 0.03
    }
  })

  // ── STAGE 3: 나레이션 ──
  const narrationUrl = await generateNarration(
    storyboard.narration?.full_script,
    storyboard.narration?.voice
  )
  totalCost += 0.005

  // ── STAGE 4: Creatomate 합성 ──
  const videoUrl = await composeVideo(storyboard, assets, narrationUrl)
  totalCost += 0.05

  return {
    videoUrl,
    totalCost,
    generationTimeMs: Date.now() - startTime,
  }
}
