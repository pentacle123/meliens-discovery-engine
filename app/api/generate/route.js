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

    // 업로드된 소스 이미지 + 레거시 images 병합
    // 유효한 URL이 있는 항목만 포함 (빈 문자열 제외)
    const allImages = []
    if (sources?.length) {
      sources.forEach(s => {
        if (s.dataUrl) allImages.push({ key: s.key, description: s.description, url: s.dataUrl })
      })
    }
    if (images?.length) {
      images.forEach(img => {
        if (img.url) allImages.push(img)
      })
    }
    // 유효한 이미지가 없으면 빈 배열 전달 (pipeline이 text-to-video 폴백 처리)
    const finalImages = allImages

    const result = await runPipeline(storyboard, finalImages)

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
