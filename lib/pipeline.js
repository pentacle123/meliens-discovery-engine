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
  const errors = {} // 씬별 에러 추적

  // 유효한 입력 이미지만 필터링 (빈 URL 제외)
  const validImages = Object.fromEntries(
    Object.entries(inputImages).filter(([, url]) => url && url.length > 0)
  )
  const firstValidImage = Object.values(validImages)[0] || null

  console.log(`[generateAssets] ═══ 에셋 생성 시작 ═══`)
  console.log(`[generateAssets]   씬 수: ${scenes.length}, 입력 이미지: ${Object.keys(validImages).length}개 (keys: ${Object.keys(validImages).join(', ') || 'none'})`)
  console.log(`[generateAssets]   첫 번째 유효 이미지: ${firstValidImage ? (firstValidImage.startsWith('data:') ? 'base64(' + firstValidImage.length + ')' : firstValidImage.slice(0, 80)) : 'none'}`)

  const tasks = scenes.map(async (scene) => {
    console.log(`[generateAssets] ── scene ${scene.scene_no} (${scene.type}) 처리 시작 ──`)
    try {
      if (scene.type === 'ai_video') {
        // matched_source가 있으면 해당 소스 이미지 우선, 없으면 기존 로직
        const matchedKey = scene.matched_source !== null && scene.matched_source !== undefined
          ? `source_${scene.matched_source}` : null
        const refImage = (matchedKey && validImages[matchedKey])
          || validImages[scene.reference_image]
          || firstValidImage
        // source_prompt가 있으면 i2v 프롬프트로 우선 사용 (AI가 소스에 맞춰 생성한 프롬프트)
        const i2vPrompt = scene.source_prompt || scene.prompt

        console.log(`[generateAssets]   scene ${scene.scene_no}: matched_source=${scene.matched_source ?? 'N/A'}, reference_image="${scene.reference_image || 'N/A'}", refImage=${refImage ? (refImage.startsWith('data:') ? 'base64' : 'URL') : 'none'}`)
        console.log(`[generateAssets]   scene ${scene.scene_no}: prompt=${scene.source_prompt ? 'source_prompt' : 'scene.prompt'}: "${(i2vPrompt || '').slice(0, 80)}"`)

        if (refImage) {
          // 참조 이미지가 있으면 image-to-video
          const endpoint = getModelEndpoint(scene.model)
          console.log(`[generateAssets]   scene ${scene.scene_no}: i2v → ${endpoint}`)
          const result = await callFalAI(endpoint, {
            prompt: i2vPrompt,
            image_url: refImage,
            duration: String(scene.duration),
            aspect_ratio: '9:16',
          })
          const url = result.video?.url || result.output?.url
          console.log(`[generateAssets]   scene ${scene.scene_no}: 결과 URL = ${url || 'EMPTY!'}`)
          assets[scene.scene_no] = url
        } else {
          // 참조 이미지가 없으면 text-to-video 사용
          const endpoint = getTextToVideoEndpoint(scene.model)
          console.log(`[generateAssets]   scene ${scene.scene_no}: t2v → ${endpoint} (no ref image)`)
          const result = await callFalAI(endpoint, {
            prompt: scene.prompt,
            duration: String(scene.duration),
            aspect_ratio: '9:16',
          })
          const url = result.video?.url || result.output?.url
          console.log(`[generateAssets]   scene ${scene.scene_no}: 결과 URL = ${url || 'EMPTY!'}`)
          assets[scene.scene_no] = url
        }

      } else if (scene.type === 'generated_image') {
        // FLUX로 고퀄 이미지 생성 후, image-to-video로 영상화
        console.log(`[generateAssets]   scene ${scene.scene_no}: FLUX 이미지 생성 시작`)
        const imgResult = await callFalAI('fal-ai/flux-pro/v1.1', {
          prompt: scene.generation_prompt,
          image_size: { width: 1080, height: 1920 },
          num_images: 1,
        })
        const generatedImageUrl = imgResult.images?.[0]?.url
        console.log(`[generateAssets]   scene ${scene.scene_no}: FLUX 이미지 = ${generatedImageUrl || 'EMPTY!'}`)
        if (generatedImageUrl) {
          // image-to-video로 모션 영상 생성
          const motionPrompt = scene.generation_prompt || 'Subtle camera movement, professional product shot, 9:16 vertical'
          console.log(`[generateAssets]   scene ${scene.scene_no}: generated_image → Kling i2v`)
          try {
            const videoResult = await callFalAI('fal-ai/kling-video/v2.5/turbo/image-to-video', {
              prompt: motionPrompt,
              image_url: generatedImageUrl,
              duration: String(scene.duration || 5),
              aspect_ratio: '9:16',
            })
            const url = videoResult.video?.url || videoResult.output?.url || generatedImageUrl
            console.log(`[generateAssets]   scene ${scene.scene_no}: i2v 결과 = ${url.slice(0, 100)}`)
            assets[scene.scene_no] = url
          } catch (i2vErr) {
            console.warn(`[generateAssets]   scene ${scene.scene_no}: ✗ i2v 실패 → 정적 이미지 사용:`, i2vErr.message)
            errors[scene.scene_no] = `i2v 실패: ${i2vErr.message}`
            assets[scene.scene_no] = generatedImageUrl
          }
        } else {
          errors[scene.scene_no] = 'FLUX 이미지 생성 결과 없음'
        }

      } else if (scene.type === 'motion_image') {
        // motion_image: 이미지 → image-to-video로 실제 AI 영상 생성
        // matched_source가 있으면 해당 소스 이미지 우선 사용
        const matchedKey = scene.matched_source !== null && scene.matched_source !== undefined
          ? `source_${scene.matched_source}` : null
        let imageUrl = (matchedKey && validImages[matchedKey]) || validImages[scene.source]
        console.log(`[generateAssets]   scene ${scene.scene_no}: matched_source=${scene.matched_source ?? 'N/A'}, source="${scene.source || 'N/A'}", found=${!!imageUrl}`)

        if (!imageUrl) {
          // 소스 이미지가 없으면 FLUX로 생성
          console.log(`[generateAssets]   scene ${scene.scene_no}: source not found → FLUX 이미지 생성`)
          const fallbackPrompt = scene.generation_prompt || scene.text_overlay || 'product photo, studio lighting, 9:16 vertical'
          const imgResult = await callFalAI('fal-ai/flux-pro/v1.1', {
            prompt: fallbackPrompt,
            image_size: { width: 1080, height: 1920 },
            num_images: 1,
          })
          imageUrl = imgResult.images?.[0]?.url
          console.log(`[generateAssets]   scene ${scene.scene_no}: FLUX 생성 이미지 = ${imageUrl || 'EMPTY!'}`)
        } else {
          imageUrl = await ensureHostedUrl(imageUrl)
          console.log(`[generateAssets]   scene ${scene.scene_no}: 호스팅 URL = ${imageUrl?.slice(0, 80) || 'EMPTY!'}`)
        }

        if (imageUrl) {
          // source_prompt가 있으면 i2v 프롬프트로 우선 사용
          const motionPrompt = scene.source_prompt || scene.prompt || scene.text_overlay || `Product shot with subtle ${scene.motion || 'slow_zoom_in'} motion, professional lighting, 9:16 vertical`
          console.log(`[generateAssets]   scene ${scene.scene_no}: motion_image → Kling i2v (prompt: ${scene.source_prompt ? 'source_prompt' : 'fallback'})`)
          try {
            const videoResult = await callFalAI('fal-ai/kling-video/v2.5/turbo/image-to-video', {
              prompt: motionPrompt,
              image_url: imageUrl,
              duration: String(scene.duration || 5),
              aspect_ratio: '9:16',
            })
            const url = videoResult.video?.url || videoResult.output?.url || imageUrl
            console.log(`[generateAssets]   scene ${scene.scene_no}: i2v 결과 = ${url.slice(0, 100)}`)
            assets[scene.scene_no] = url
          } catch (i2vErr) {
            console.warn(`[generateAssets]   scene ${scene.scene_no}: ✗ i2v 실패 → 정적 이미지 사용:`, i2vErr.message)
            errors[scene.scene_no] = `i2v 실패: ${i2vErr.message}`
            assets[scene.scene_no] = imageUrl
          }
        } else {
          errors[scene.scene_no] = '소스 이미지 없음 + FLUX 생성도 실패'
        }
      }
    } catch (err) {
      console.error(`[generateAssets] ✗ scene ${scene.scene_no} (${scene.type}) 완전 실패:`, err.message)
      errors[scene.scene_no] = `${scene.type} 실패: ${err.message}`
      // 최종 폴백: AI 이미지 생성 시도
      try {
        console.log(`[generateAssets]   scene ${scene.scene_no}: 폴백 FLUX 이미지 생성 시도`)
        const fallbackPrompt = scene.prompt || scene.generation_prompt || scene.text_overlay || 'product photo, minimalist, 9:16'
        const result = await callFalAI('fal-ai/flux-pro/v1.1', {
          prompt: fallbackPrompt,
          image_size: { width: 1080, height: 1920 },
          num_images: 1,
        })
        const url = result.images?.[0]?.url
        console.log(`[generateAssets]   scene ${scene.scene_no}: 폴백 이미지 = ${url || 'EMPTY!'}`)
        assets[scene.scene_no] = url
      } catch (fallbackErr) {
        console.error(`[generateAssets]   scene ${scene.scene_no}: ✗✗ 폴백도 실패:`, fallbackErr.message)
        errors[scene.scene_no] += ` | 폴백도 실패: ${fallbackErr.message}`
        // 유효한 소스 이미지라도 있으면 호스팅 URL로 변환 후 사용
        if (firstValidImage) {
          assets[scene.scene_no] = await ensureHostedUrl(firstValidImage)
        }
      }
    }
  })

  await Promise.all(tasks)

  // ═══ 에셋 상태 최종 리포트 ═══
  const total = scenes.length
  const filled = Object.values(assets).filter(v => v && v.length > 0).length
  const emptyScenes = scenes.filter(s => !assets[s.scene_no] || assets[s.scene_no].length === 0)
  const base64Count = Object.values(assets).filter(v => v && v.startsWith('data:')).length
  const videoCount = Object.values(assets).filter(v => v && (v.includes('.mp4') || v.includes('.webm') || v.includes('/video'))).length
  const imageCount = filled - videoCount

  console.log(`[generateAssets] ═══ 최종 리포트 ═══`)
  console.log(`[generateAssets]   총 씬: ${total}, 에셋 확보: ${filled}/${total}`)
  console.log(`[generateAssets]   영상: ${videoCount}개, 이미지: ${imageCount}개${base64Count > 0 ? `, ⚠ base64: ${base64Count}개` : ''}`)
  if (emptyScenes.length > 0) {
    console.error(`[generateAssets]   ⚠ 에셋 없는 씬: ${emptyScenes.map(s => `#${s.scene_no}(${s.type})`).join(', ')}`)
  }
  if (Object.keys(errors).length > 0) {
    console.error(`[generateAssets]   ⚠ 에러 발생 씬: ${JSON.stringify(errors)}`)
  }
  Object.entries(assets).forEach(([sceneNo, url]) => {
    console.log(`[generateAssets]   scene #${sceneNo}: ${url ? url.slice(0, 100) : 'EMPTY'}`)
  })

  return { assets, errors }
}

function safeJsonParse(text) {
  const parsed = JSON.parse(text)
  return Array.isArray(parsed) ? parsed[0] : parsed
}

async function callFalAI(endpoint, input) {
  console.log(`[callFalAI] ▶ 요청 시작: ${endpoint}`)
  console.log(`[callFalAI]   입력 파라미터: prompt=${(input.prompt || '').slice(0, 80)}..., image_url=${input.image_url ? (input.image_url.startsWith('data:') ? 'base64(' + input.image_url.length + ')' : input.image_url.slice(0, 80)) : 'none'}, duration=${input.duration || 'N/A'}`)

  const submitRes = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${process.env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!submitRes.ok) {
    const errBody = await submitRes.text()
    console.error(`[callFalAI] ✗ submit 실패: ${submitRes.status} — ${errBody.slice(0, 300)}`)
    throw new Error(`fal.ai submit error: ${submitRes.status} - ${errBody}`)
  }

  const submitText = await submitRes.text()
  console.log(`[callFalAI]   submit 응답 (${submitText.length}자): ${submitText.slice(0, 200)}`)
  const submitData = safeJsonParse(submitText)

  // 동기 응답 (결과가 바로 온 경우)
  if (!submitData.request_id) {
    if (submitData.video || submitData.images || submitData.output) {
      const resultUrl = submitData.video?.url || submitData.images?.[0]?.url || submitData.output?.url || 'N/A'
      console.log(`[callFalAI] ✓ 동기 응답 수신: ${resultUrl.slice(0, 100)}`)
      return submitData
    }
    console.error(`[callFalAI] ✗ 동기 응답에 결과 없음:`, JSON.stringify(submitData).slice(0, 300))
    throw new Error('fal.ai: no request_id and no result in response')
  }

  const { request_id } = submitData
  console.log(`[callFalAI]   비동기 작업 시작: request_id=${request_id}`)

  // 비동기 폴링
  const startTime = Date.now()
  let pollCount = 0
  while (Date.now() - startTime < 300000) {
    await new Promise(r => setTimeout(r, 8000))
    pollCount++

    const statusRes = await fetch(
      `https://queue.fal.run/${endpoint}/requests/${request_id}/status`,
      { headers: { 'Authorization': `Key ${process.env.FAL_KEY}` } }
    )
    const statusText = await statusRes.text()
    const status = safeJsonParse(statusText)
    console.log(`[callFalAI]   폴링 #${pollCount}: status=${status.status}, elapsed=${Math.round((Date.now() - startTime) / 1000)}s`)

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/${endpoint}/requests/${request_id}`,
        { headers: { 'Authorization': `Key ${process.env.FAL_KEY}` } }
      )
      const resultText = await resultRes.text()
      const result = safeJsonParse(resultText)
      const resultUrl = result.video?.url || result.images?.[0]?.url || result.output?.url || 'N/A'
      console.log(`[callFalAI] ✓ 완료: ${resultUrl.slice(0, 120)}`)
      return result
    }

    if (status.status === 'FAILED') {
      console.error(`[callFalAI] ✗ 생성 실패: ${JSON.stringify(status).slice(0, 300)}`)
      throw new Error(`fal.ai generation failed: ${status.error || 'unknown'}`)
    }
  }
  console.error(`[callFalAI] ✗ 타임아웃 (${Math.round((Date.now() - startTime) / 1000)}s, ${pollCount}회 폴링)`)
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

  console.log(`[runPipeline] ═══ 파이프라인 시작 ═══`)
  console.log(`[runPipeline]   씬 수: ${storyboard.scenes?.length}, 이미지 수: ${images?.length}`)

  // ── STAGE 2: 에셋 생성 ──
  const inputImages = {}
  images.forEach(img => { inputImages[img.key] = img.url })
  console.log(`[runPipeline]   입력 이미지 키: ${Object.keys(inputImages).join(', ') || 'none'}`)

  const assetResult = await generateAssets(storyboard.scenes, inputImages)
  const assets = assetResult.assets || assetResult // 호환성
  const assetErrors = assetResult.errors || {}

  // 에셋 없는 씬 체크
  const missingAssets = storyboard.scenes.filter(s => !assets[s.scene_no])
  if (missingAssets.length > 0) {
    console.error(`[runPipeline] ⚠ ${missingAssets.length}개 씬의 에셋이 없습니다: ${missingAssets.map(s => `#${s.scene_no}`).join(', ')}`)
  }

  // 비용 계산 (모든 씬 타입이 이제 AI 영상 생성)
  storyboard.scenes.forEach(s => {
    if (s.type === 'ai_video') {
      const costPerSec = s.model === 'kling_3.0' ? 0.10 : s.model === 'wan_2.2' ? 0.05 : 0.07
      totalCost += costPerSec * s.duration
    } else if (s.type === 'generated_image') {
      totalCost += 0.03 // FLUX 이미지
      totalCost += 0.07 * (s.duration || 5) // Kling i2v
    } else if (s.type === 'motion_image') {
      totalCost += 0.07 * (s.duration || 5) // Kling i2v
    }
  })

  // ── STAGE 3: 나레이션 ──
  console.log(`[runPipeline] ── STAGE 3: 나레이션 생성 ──`)
  const narrationUrl = await generateNarration(
    storyboard.narration?.full_script,
    storyboard.narration?.voice
  )
  console.log(`[runPipeline]   나레이션: ${narrationUrl ? narrationUrl.slice(0, 80) : 'SKIP (no script or API key)'}`)
  totalCost += 0.005

  // ── STAGE 4: Creatomate 합성 ──
  console.log(`[runPipeline] ── STAGE 4: Creatomate 합성 ──`)
  console.log(`[runPipeline]   에셋 전달: ${JSON.stringify(Object.entries(assets).map(([k, v]) => `#${k}=${v ? v.slice(0, 60) : 'EMPTY'}`))}`)
  const videoUrl = await composeVideo(storyboard, assets, narrationUrl)
  totalCost += 0.05

  console.log(`[runPipeline] ═══ 파이프라인 완료 ═══`)
  console.log(`[runPipeline]   영상 URL: ${videoUrl}`)
  console.log(`[runPipeline]   총 비용: $${totalCost.toFixed(3)}, 소요시간: ${Math.round((Date.now() - startTime) / 1000)}s`)

  return {
    videoUrl,
    totalCost,
    generationTimeMs: Date.now() - startTime,
    assetErrors: Object.keys(assetErrors).length > 0 ? assetErrors : undefined,
  }
}
