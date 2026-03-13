/**
 * POST /api/storyboard
 *
 * Discovery Engine 맥락 데이터 + 숏폼 아이디어를 기반으로
 * 촬영팀에게 바로 전달 가능한 촬영 스토리보드(가이드 시트) JSON을 생성합니다.
 *
 * AI 영상 생성 관련 필드 제거 — 스토리보드가 최종 산출물입니다.
 * 각 씬에 상세 촬영 스크립트(카메라, 환경, 연기, 자막, 전환, 음향, 촬영시간)를 포함합니다.
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
        max_tokens: 6000,
        system: `당신은 숏폼 커머스 영상 전문 촬영 감독입니다.
당신은 한국 시장에 정통한 숏폼 커머스 전문가입니다. 한국의 실제 물가, 소비 문화, 유행어, 생활 패턴을 정확히 반영하세요.
상품 정보와 발견 커머스 맥락 분석 데이터를 받아, 촬영팀이 현장에서 바로 쓸 수 있는 수준의 상세한 촬영 스토리보드(가이드 시트)를 JSON으로 출력합니다.

이 스토리보드는 실사 촬영 기준이며, 촬영 감독이 현장에서 이 문서만 보고 모든 씬을 촬영할 수 있어야 합니다.

═══ 한국 시장 컨텍스트 (필수 반영) ═══
- 가격 감각: 카페 커피 5,000원, 점심 만원대, 자취 월세 50~80만원, 신차 3,000만원~1억원+
- 소비자 언어: "가성비", "갓생", "꿀팁", "존맛", "핵이득", "혜자", "겟잇", "인생템" 등 실제 한국 MZ세대 표현 사용
- 유통 채널: 쿠팡, 네이버 쇼핑, 올리브영, 다이소, 무신사, 오늘의집 등 한국 소비자가 실제 사용하는 채널
- 생활 패턴: 출퇴근 지하철/버스, 원룸/투룸 자취, 편의점 문화, 배달앱, 카페 작업 등
- 촬영 환경: 한국의 실제 주거 환경(원룸, 아파트, 오피스텔), 한국식 욕실/주방/거실 반영
- 자막 톤: 한국 숏폼에서 실제로 사용되는 자연스러운 구어체 (존댓말/반말 상황에 맞게)
- 절대 비현실적인 가격이나 상황을 사용하지 마세요. 한국 소비자가 즉시 공감할 수 있는 현실적인 시나리오만 작성하세요.

═══ 핵심 원칙 ═══
1. 훅: 첫 2초에 타겟의 페인포인트를 시각적으로 보여줘 스크롤을 멈추게 함
2. 구조: Hook(0~2초)→Problem(2~7초)→Solution(7~18초)→Result(18~23초)→CTA(마지막 3초)
3. 3초마다 시각적 변화, 자막 항상 포함
4. 발견 커머스 맥락(WHO, WHERE, WHEN, PAIN)을 영상에 자연스럽게 반영

═══ 각 씬의 촬영 스크립트 (반드시 모든 필드 포함) ═══
각 씬마다 아래 7가지를 매우 구체적으로 작성하세요:

1. camera_angle (카메라 앵글/구도):
   - 구체적 예: "탑뷰 클로즈업, 니트 표면에 보풀이 보이도록 30cm 거리에서 촬영"
   - "45도 앵글 미디엄 숏, 제품을 들고 있는 손이 프레임 좌측 1/3에 위치"
   - 절대 "클로즈업"만 쓰지 말고, 거리/각도/피사체 위치까지 구체적으로

2. set_environment (촬영 환경):
   - 구체적 예: "자연광, 거실 소파 위, 배경에 쿠션과 잡지가 보이는 약간 어수선한 일상 느낌"
   - "밝은 욕실, 세면대 위에 스킨케어 제품 2-3개와 수건 배치, 인공조명 소프트박스"
   - 조명 종류, 배경 소품, 전체 분위기까지 지정

3. acting_direction (연기 디렉션):
   - 구체적 예: "한 손으로 보풀제거기를 들고 천천히 니트 위를 밀어줌. 2초간 보풀이 모이는 장면을 보여줌"
   - "카메라를 보지 않고, 자연스럽게 제품을 사용하다가 결과를 확인하며 살짝 고개를 끄덕임"
   - 행동/시선/표정/동작 속도까지 구체적으로

4. subtitle_text (자막 텍스트):
   - 실제 화면에 들어갈 한글 자막 전문
   - 숏폼 스타일: 짧고 임팩트 있게

5. subtitle_timing (자막 타이밍):
   - 자막이 나타나는 시점과 방식
   - 예: "씬 시작 0.5초 후 페이드 인, 2초 유지 후 사라짐"

6. transition (전환 효과):
   - 이전 씬에서 이 씬으로 넘어올 때의 전환 효과
   - 예: "컷 전환", "줌인 트랜지션", "와이프 레프트", "디졸브 0.3초"

7. audio_guide (음향/BGM 가이드):
   - 이 씬에서의 음향 디렉션
   - 예: "환경음 + 제품 작동 소리 강조, BGM 볼륨 낮게"
   - "BGM 빌드업 구간, 효과음 '뿅' 삽입 (자막 등장과 동시)"

8. estimated_shoot_time (촬영 예상 시간):
   - 실제 현장에서 이 씬을 촬영하는 데 걸리는 예상 시간
   - 예: "5~10분", "15분 (세팅 포함)", "3분"

추가 필드:
- section: "HOOK" | "PROBLEM" | "SOLUTION" | "RESULT" | "CTA" 중 하나
- description: 씬의 핵심 내용 한 줄 요약
- director_note: 촬영 시 특별히 주의할 사항 (선택)
- props: 이 씬에 필요한 소품/준비물 배열 (선택)

JSON만 출력. 설명 없이.

출력 형식:
{
  "video_id": "string",
  "style": "string",
  "platform_primary": "reels|shorts",
  "duration_target": number,
  "hook_strategy": "string (훅의 전략적 의도와 기대 효과를 설명)",
  "scenes": [
    {
      "scene_no": number,
      "section": "HOOK|PROBLEM|SOLUTION|RESULT|CTA",
      "duration": number,
      "timestamp_start": number,
      "description": "씬 핵심 내용 한 줄",
      "camera_angle": "매우 구체적인 카메라 앵글/구도 디렉션",
      "set_environment": "매우 구체적인 촬영 환경/조명/배경 설명",
      "acting_direction": "매우 구체적인 연기/동작 디렉션",
      "subtitle_text": "화면에 나타날 한글 자막",
      "subtitle_timing": "자막 등장 타이밍 설명",
      "transition": "이전 씬에서의 전환 효과",
      "audio_guide": "이 씬의 음향/BGM 디렉션",
      "estimated_shoot_time": "예상 촬영 시간",
      "director_note": "string|null (촬영 시 주의사항, 선택)",
      "props": ["소품1", "소품2"] 또는 null
    }
  ],
  "narration": {
    "full_script": "전체 나레이션 스크립트 (한글)",
    "segments": [
      { "scene_no": number, "text": "string", "start_time": number, "end_time": number }
    ]
  },
  "bgm": {
    "mood": "BGM 분위기",
    "bpm_range": "BPM 범위",
    "volume_ratio": number (0~1),
    "reference": "레퍼런스 음악/느낌 설명 (선택)"
  },
  "metadata": {
    "title": "영상 제목",
    "hashtags": ["#태그1", "#태그2"],
    "description": "영상 설명"
  }
}`,
        messages: [
          {
            role: 'user',
            content: `다음 상품의 ${videoStyle || 'before_after'} 숏폼 촬영 스토리보드를 생성해주세요.
촬영 감독이 현장에서 이 문서만 보고 모든 씬을 촬영할 수 있어야 합니다.

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

각 씬의 촬영 스크립트를 실제 촬영 감독 수준으로 매우 구체적으로 작성해주세요.
- camera_angle: "클로즈업" 같은 모호한 표현 금지. 거리, 각도, 피사체 위치까지 구체적으로
- set_environment: 조명 종류, 배경 소품, 전체 분위기까지 지정
- acting_direction: 행동, 시선, 표정, 동작 속도까지 구체적으로
- 모든 씬에 section 태그를 반드시 포함하세요 (HOOK/PROBLEM/SOLUTION/RESULT/CTA)`,
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
    })
  } catch (error) {
    console.error('[Storyboard API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error', success: false },
      { status: 500 }
    )
  }
}
