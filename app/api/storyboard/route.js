/**
 * POST /api/storyboard
 *
 * Discovery Engine 맥락 데이터 + 숏폼 아이디어를 기반으로
 * AI 영상 스토리보드 JSON을 생성합니다.
 *
 * 비용: ~$0.01 (Claude API만 호출)
 */

import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const { product, context, ideas, videoStyle, platform, targetDuration, includeHuman, toneAndManner } = body

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured', success: false }, { status: 500 })
    }

    if (!product) {
      return NextResponse.json({ error: '제품 정보가 필요합니다', success: false }, { status: 400 })
    }

    // Discovery Engine 맥락 정보를 프롬프트에 주입
    const contextBlock = context
      ? `\n발견 커머스 맥락 (Discovery Engine 분석 결과):
- 타겟(WHO): ${context.WHO || '미지정'}
- 시간(WHEN): ${context.WHEN || '미지정'}
- 장소(WHERE): ${context.WHERE || '미지정'}
- 페인포인트(PAIN): ${context.PAIN || '미지정'}
- 니즈(NEED): ${context.NEED || '미지정'}
- 관심사(INTEREST): ${context.INTEREST || '미지정'}
- 전환 점수: ${context.conversion_score || 'N/A'}
- 인사이트: ${context.insight || '없음'}`
      : ''

    // 숏폼 아이디어가 있으면 참고 정보로 활용
    const platformKey = platform === 'shorts' ? 'youtube' : 'instagram'
    const ideaBlock = ideas?.[platformKey]
      ? `\n참고할 숏폼 아이디어 (Discovery Engine 생성):
- 제목: ${ideas[platformKey].title}
- 훅: ${ideas[platformKey].hook}
- 훅 패턴: ${ideas[platformKey].hook_pattern}
- 씬 플로우: ${ideas[platformKey].scene_flow?.join(' → ')}
- 증명 포인트: ${ideas[platformKey].proof_point}
- CTA: ${ideas[platformKey].cta}`
      : ''

    const strengthsText = product.strengths?.map(s => `${s.tag} (시각: ${s.visual})`).join(', ') || ''

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `당신은 숏폼 커머스 영상 전문 크리에이티브 디렉터입니다.
상품 정보와 발견 커머스 맥락 분석 데이터를 받아 숏폼 영상 스토리보드를 JSON으로 출력합니다.

제약: 영상 15~30초, 9:16, AI 영상 최대 3클립(각 5초), 나머지 motion_image 또는 generated_image
비용 참고: kling_2.5_turbo_pro $0.07/초, wan_2.2 $0.05/초, flux_pro $0.03/장

핵심 원칙:
- 훅: 첫 2초에 타겟의 페인포인트를 시각적으로 보여줘 스크롤을 멈추게 함
- 구조: Hook(0~2초)→Problem(2~7초)→Solution(7~18초)→Result(18~23초)→CTA
- 3초마다 시각적 변화, 자막 항상 포함
- 발견 커머스 맥락(WHO, WHERE, WHEN, PAIN)을 영상에 자연스럽게 반영

씬 타입:
- ai_video: model(kling_2.5_turbo_pro/wan_2.2), prompt(영어), reference_image(업로드 소스 key 가능), camera_movement
- motion_image: source(업로드된 소스 key, 예: source_1), motion(slow_zoom_in/slow_zoom_out/pan_left/pan_right/float_up/scale_up_center/ken_burns/shake_subtle)
- generated_image: generation_prompt(영어)

소스 활용 원칙:
- motion_image 씬: source_guide에 필요한 이미지를 구체적으로 명시 (예: "제품 정면 사진", "12종 컬러 라인업 이미지")
- ai_video 씬: reference_image가 필요하면 source_guide에 어떤 참조 이미지가 효과적인지 명시
- generated_image 씬: AI가 생성하므로 source_guide = null
- source_guide는 사용자에게 "이 씬에 어떤 소스를 업로드해야 하는지" 안내하는 텍스트
- motion_image는 반드시 source_guide를 포함해야 함 (사용자가 업로드할 이미지를 안내)

text_style: bold_center_white/info_bottom_bar/highlight_keyword/cta_animated/rating_display/split_comparison
transition: cut/fade/wipe_left/wipe_right/zoom_in/dissolve

JSON만 출력. 설명 없이.

출력 형식:
{
  "video_id": "string",
  "style": "string",
  "platform_primary": "reels|shorts",
  "duration_target": number,
  "estimated_cost": number,
  "hook_strategy": "string",
  "scenes": [
    {
      "scene_no": number,
      "type": "ai_video|motion_image|generated_image",
      "duration": number,
      "timestamp_start": number,
      "model": "string (ai_video만)",
      "prompt": "string (ai_video만, 영어)",
      "reference_image": "string (ai_video만, source key)",
      "camera_movement": "string (ai_video만)",
      "source": "string (motion_image만, source key 예: source_1)",
      "motion": "string (motion_image만)",
      "generation_prompt": "string (generated_image만, 영어)",
      "source_guide": "string|null (사용자에게 필요한 소스 안내, 예: '제품 정면 이미지 필요')",
      "text_overlay": "string (한글 자막)",
      "text_style": "string",
      "transition_in": "string"
    }
  ],
  "narration": {
    "engine": "openai_tts",
    "voice": "nova",
    "full_script": "string (한글)",
    "segments": [
      { "scene_no": number, "text": "string", "start_time": number, "end_time": number }
    ]
  },
  "bgm": {
    "mood": "string",
    "bpm_range": "string",
    "volume_ratio": number
  },
  "metadata": {
    "title": "string",
    "hashtags": ["string"],
    "description": "string",
    "thumbnail_scene": number
  }
}`,
        messages: [
          {
            role: 'user',
            content: `다음 상품의 ${videoStyle || 'before_after'} 숏폼 스토리보드를 생성해주세요.

상품명: ${product.name}
카테고리: ${product.category}
가격: ${product.price}
특장점: ${strengthsText}
${contextBlock}
${ideaBlock}

스타일: ${videoStyle || 'before_after'}
플랫폼: ${platform === 'shorts' ? 'YouTube Shorts' : 'Instagram Reels'}
길이: ${targetDuration || 22}초
사람: ${includeHuman ? '포함(손/턱아래만)' : '제품만'}
톤: ${toneAndManner || '솔직하고 드라마틱'}

motion_image와 ai_video 씬에는 source_guide를 반드시 포함하세요 (사용자가 어떤 이미지를 업로드해야 하는지 구체적으로 안내).
generated_image 씬은 source_guide를 null로 설정하세요.

첫 2초 훅을 매우 강력하게 만들어주세요. 맥락 데이터를 적극 활용하여 타겟이 공감할 수 있는 스토리를 구성하세요.`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`Claude API error: ${response.status} - ${errorData}`)
    }

    const data = await response.json()
    const text = data.content?.map(i => i.text || '').join('') || ''

    let storyboard
    try {
      storyboard = JSON.parse(text)
    } catch {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (match) {
        storyboard = JSON.parse(match[1])
      } else {
        throw new Error('스토리보드 JSON 파싱 실패')
      }
    }

    return NextResponse.json({
      success: true,
      storyboard,
      estimatedCost: storyboard.estimated_cost,
    })
  } catch (error) {
    console.error('[Storyboard API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error', success: false },
      { status: 500 }
    )
  }
}
