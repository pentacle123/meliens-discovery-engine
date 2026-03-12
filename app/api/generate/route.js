/**
 * POST /api/generate
 *
 * 스토리보드 기반 전체 영상 생성 파이프라인 실행
 * fal.ai (에셋) → OpenAI TTS (나레이션) → Creatomate (합성) → MP4 URL 반환
 */

import { NextResponse } from 'next/server'
import { runPipeline } from '@/lib/pipeline'

export const maxDuration = 300 // 5분 타임아웃

export async function POST(request) {
  try {
    const body = await request.json()
    const { storyboard, images, sources } = body

    if (!storyboard || !storyboard.scenes?.length) {
      return NextResponse.json(
        { error: '스토리보드가 필요합니다. 먼저 스토리보드를 생성해주세요.', success: false },
        { status: 400 }
      )
    }

    // API 키 확인
    const missing = []
    if (!process.env.FAL_KEY) missing.push('FAL_KEY')
    if (!process.env.CREATOMATE_API_KEY) missing.push('CREATOMATE_API_KEY')
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `API 키가 설정되지 않았습니다: ${missing.join(', ')}`, success: false },
        { status: 500 }
      )
    }

    // 씬별 업로드 소스를 이미지 맵으로 변환
    // sources: [{ key: "source_scene_2", sceneNo: 2, dataUrl: "..." }, ...]
    const allImages = []
    if (sources?.length) {
      sources.forEach(s => {
        if (s.dataUrl) {
          // 씬별 소스: key를 scene의 source 필드와 매칭
          allImages.push({ key: s.key, description: s.description || '', url: s.dataUrl })
          // 해당 씬의 source 필드를 이 key로 업데이트
          if (s.sceneNo && storyboard.scenes) {
            const scene = storyboard.scenes.find(sc => sc.scene_no === s.sceneNo)
            if (scene) {
              scene.source = s.key
              // ai_video 씬이면 reference_image도 설정
              if (scene.type === 'ai_video') scene.reference_image = s.key
            }
          }
        }
      })
    }
    if (images?.length) {
      images.forEach(img => {
        if (img.url) allImages.push(img)
      })
    }

    const result = await runPipeline(storyboard, allImages)

    return NextResponse.json({
      success: true,
      videoUrl: result.videoUrl,
      totalCost: result.totalCost,
      generationTimeMs: result.generationTimeMs,
    })
  } catch (error) {
    console.error('[Generate API] Pipeline error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error', success: false },
      { status: 500 }
    )
  }
}
