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
    const { storyboard, images } = body

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

    // 제품 소스 이미지를 이미지 맵으로 변환
    // images: [{ key: "source_0", description: "파일명", url: dataUrl }, ...]
    const allImages = []
    if (images?.length) {
      images.forEach(img => {
        if (img.url) allImages.push(img)
      })
    }

    // 각 씬의 matched_source 인덱스를 실제 이미지 키로 매핑
    // matched_source: 0 → reference_image/source: "source_0"
    if (storyboard.scenes) {
      storyboard.scenes.forEach(scene => {
        if (scene.matched_source !== null && scene.matched_source !== undefined) {
          const sourceKey = `source_${scene.matched_source}`
          // ai_video 씬: reference_image 설정
          if (scene.type === 'ai_video') {
            scene.reference_image = sourceKey
          }
          // motion_image 씬: source 설정
          if (scene.type === 'motion_image') {
            scene.source = sourceKey
          }
        }
      })
    }

    const result = await runPipeline(storyboard, allImages)

    return NextResponse.json({
      success: true,
      videoUrl: result.videoUrl,
      totalCost: result.totalCost,
      generationTimeMs: result.generationTimeMs,
      assetErrors: result.assetErrors || null,
    })
  } catch (error) {
    console.error('[Generate API] Pipeline error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error', success: false },
      { status: 500 }
    )
  }
}
