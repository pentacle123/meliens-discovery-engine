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

    // 이미지 기본값 (없으면 플레이스홀더)
    const finalImages = images?.length ? images : [
      { key: 'image_1', description: '제품 정면 이미지', url: '' },
      { key: 'image_2', description: '제품 디테일 이미지', url: '' },
    ]

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
