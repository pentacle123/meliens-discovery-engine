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
// base64 → fal.ai Storage 업로드
// Creatomate는 base64 data URL을 source로 받지 못함
// fal.ai storage에 업로드하여 호스팅 URL로 변환
// ══════════════════════════════════════

async function uploadToFalStorage(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl

  const matches = dataUrl.match(/^data:(.+?);base64,(.+)$/)
  if (!matches) return dataUrl

  const contentType = matches[1]
  const base64Data = matches[2]
  const buffer = Buffer.from(base64Data, 'base64')
  const ext = contentType.split('/')[1]?.split('+')[0] || 'bin'
  const fileName = `upload_${Date.now()}.${ext}`

  console.log(`[uploadToFalStorage] 업로드 시작: ${contentType}, ${buffer.length} bytes`)

  // Step 1: fal.ai storage 업로드 초기화
  const initRes = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${process.env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content_type: contentType, file_name: fileName }),
  })

  if (!initRes.ok) {
    const errText = await initRes.text()
    throw new Error(`fal.ai storage initiate failed: ${initRes.status} - ${errText}`)
  }

  const { upload_url, file_url } = await initRes.json()

  // Step 2: 파일 업로드
  const uploadRes = await fetch(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: buffer,
  })

  if (!uploadRes.ok) {
    throw new Error(`fal.ai storage upload failed: ${uploadRes.status}`)
  }

  console.log(`[uploadToFalStorage] 완료: ${file_url}`)
  return file_url
}

// base64이면 호스팅 URL로 변환, 이미 URL이면 그대로 반환
async function ensureHostedUrl(url) {
  if (!url) return null
  if (!url.startsWith('data:')) return url
  try {
    return await uploadToFalStorage(url)
  } catch (err) {
    console.error('[ensureHostedUrl] 업로드 실패:', err.message)
    return url // 실패 시 원본 반환 (Creatomate에서 에러 나더라도 로그로 추적 가능)
  }
}

// ══════════════════════════════════════
// STAGE 2: fal.ai 에셋 생성
// ══════════════════════════════════════

export async function generateAssets(scenes, inputImages) {
  const assets = {}

  // 유효한 입력 이미지만 필터링 (빈 URL 제외)
  const validImages = Object.fromEntries(
    Object.entries(inputImages).filter(([, url]) => url && url.length > 0)
  )
  const firstValidImage = Object.values(validImages)[0] || null

  const tasks = scenes.map(async (scene) => {
    try {
      if (scene.type === 'ai_video') {
        const refImage = validImages[scene.reference_image] || firstValidImage

        if (refImage) {
          // 참조 이미지가 있으면 image-to-video (fal.ai는 base64 data URL 지원)
          const endpoint = getModelEndpoint(scene.model)
          const result = await callFalAI(endpoint, {
            prompt: scene.prompt,
            image_url: refImage,
            duration: String(scene.duration),
            aspect_ratio: '9:16',
          })
          // fal.ai가 반환한 호스팅 URL을 그대로 사용
          assets[scene.scene_no] = result.video?.url || result.output?.url
        } else {
          // 참조 이미지가 없으면 text-to-video 사용
          console.log(`[generateAssets] scene ${scene.scene_no}: no reference image, using text-to-video`)
          const endpoint = getTextToVideoEndpoint(scene.model)
          const result = await callFalAI(endpoint, {
            prompt: scene.prompt,
            duration: String(scene.duration),
            aspect_ratio: '9:16',
          })
          assets[scene.scene_no] = result.video?.url || result.output?.url
        }

      } else if (scene.type === 'generated_image') {
        const result = await callFalAI('fal-ai/flux-pro/v1.1', {
          prompt: scene.generation_prompt,
          image_size: { width: 1080, height: 1920 },
          num_images: 1,
        })
        // fal.ai가 반환한 호스팅 URL
        assets[scene.scene_no] = result.images?.[0]?.url

      } else if (scene.type === 'motion_image') {
        const sourceUrl = validImages[scene.source]
        if (sourceUrl) {
          // base64 data URL이면 fal.ai storage에 업로드하여 호스팅 URL로 변환
          assets[scene.scene_no] = await ensureHostedUrl(sourceUrl)
        } else {
          // 소스 이미지가 없으면 generated_image로 폴백
          console.log(`[generateAssets] scene ${scene.scene_no}: source "${scene.source}" not found, generating image`)
          const fallbackPrompt = scene.generation_prompt || scene.text_overlay || 'product photo, studio lighting, 9:16 vertical'
          const result = await callFalAI('fal-ai/flux-pro/v1.1', {
            prompt: fallbackPrompt,
            image_size: { width: 1080, height: 1920 },
            num_images: 1,
          })
          assets[scene.scene_no] = result.images?.[0]?.url
        }
      }
    } catch (err) {
      console.error(`[generateAssets] scene ${scene.scene_no} (${scene.type}) failed:`, err)
      // 최종 폴백: AI 이미지 생성 시도
      try {
        console.log(`[generateAssets] scene ${scene.scene_no}: attempting fallback image generation`)
        const fallbackPrompt = scene.prompt || scene.generation_prompt || scene.text_overlay || 'product photo, minimalist, 9:16'
        const result = await callFalAI('fal-ai/flux-pro/v1.1', {
          prompt: fallbackPrompt,
          image_size: { width: 1080, height: 1920 },
          num_images: 1,
        })
        // fal.ai가 반환한 호스팅 URL 사용
        assets[scene.scene_no] = result.images?.[0]?.url
      } catch (fallbackErr) {
        console.error(`[generateAssets] scene ${scene.scene_no}: fallback also failed:`, fallbackErr)
        // 유효한 소스 이미지라도 있으면 호스팅 URL로 변환 후 사용
        if (firstValidImage) {
          assets[scene.scene_no] = await ensureHostedUrl(firstValidImage)
        }
      }
    }
  })

  await Promise.all(tasks)

  // 에셋 상태 로그
  const total = scenes.length
  const filled = Object.values(assets).filter(v => v && v.length > 0).length
  const base64Count = Object.values(assets).filter(v => v && v.startsWith('data:')).length
  console.log(`[generateAssets] result: ${filled}/${total} scenes have valid assets${base64Count > 0 ? ` (WARNING: ${base64Count} still base64!)` : ''}`)

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

function getTextToVideoEndpoint(model) {
  const map = {
    'kling_2.5_turbo_pro': 'fal-ai/kling-video/v2.5/turbo/text-to-video',
    'kling_3.0': 'fal-ai/kling-video/v3/pro/text-to-video',
    'hailuo_2.3_pro': 'fal-ai/minimax-video/text-to-video',
    'wan_2.2': 'fal-ai/wan/v2.2/text-to-video',
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
  const dataUrl = `data:audio/mp3;base64,${base64}`

  // Creatomate는 base64 audio도 지원하지 않으므로 fal.ai storage에 업로드
  try {
    const hostedUrl = await uploadToFalStorage(dataUrl)
    console.log(`[generateNarration] 나레이션 업로드 완료: ${hostedUrl}`)
    return hostedUrl
  } catch (err) {
    console.error('[generateNarration] fal.ai storage 업로드 실패, base64 반환:', err.message)
    return dataUrl
  }
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
