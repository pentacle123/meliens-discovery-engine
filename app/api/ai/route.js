import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { type, product, context } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    let prompt = ''

    if (type === 'context_match') {
      // 제품별 맥락 후보값 참고 정보 구성
      const contextRef = product.contexts
        ? Object.entries(product.contexts)
            .map(([axis, vals]) => `  ${axis}: ${vals.join(', ')}`)
            .join('\n')
        : '(없음)'

      prompt = `당신은 발견 커머스(Discovery Commerce) 숏폼 콘텐츠 전문가입니다.

다음 제품에 대해 구매 전환 확률이 높은 "날카로운 맥락 조합" TOP 5를 JSON으로 생성하세요.

제품: ${product.name} (${product.category})
가격: ${product.price}
핵심 강점: ${product.strengths.map(s => s.tag).join(", ")}

[참고: 제품별 맥락 후보값]
${contextRef}

═══ 데이터 기반 맥락 도출 ═══
맥락 조합을 생성하기 전에, 리스닝마인드의 intent_finder와 keyword_info 도구로 이 제품 관련 키워드를 검색하세요.
- intent_finder: 제품명, 카테고리, 핵심 강점 관련 키워드로 소비자 검색 의도 파악
- keyword_info: 주요 키워드의 검색량, 검색 의도(I/N/C/T), 인구통계 분석
이 검색 데이터를 근거로 실제 소비자가 어떤 기대와 우려를 갖고 검색하는지 파악한 뒤, 그 데이터를 기반으로 맥락 조합을 만드세요.
gl(국가코드)은 "kr"로 설정하세요.

═══ 핵심 원칙 ═══
1. 6개 축(WHO/WHEN/WHERE/PAIN/NEED/INTEREST)을 전부 연결하지 마세요.
2. 각 조합에서 2~3개 축만 선택하여 날카로운 연결을 만드세요.
   예: "WHO + PAIN + NEED" 또는 "WHO + WHEN + WHERE"
3. 축이 적을수록 메시지가 선명하고 실행 가능한 숏폼이 됩니다.
4. 같은 축 조합 패턴이 반복되지 않도록 다양하게 만드세요.
5. 매우 구체적이고 현실적인 상황을 묘사하세요.
   발견 커머스에서 스크롤 중 "어, 이거 나한테 필요한데?"라고 느끼게 만드는 맥락이어야 합니다.
6. 각 조합에 data_evidence 필드를 추가해서, 검색 데이터에서 발견한 근거를 한 줄로 요약하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:
[
  {
    "rank": 1,
    "axes_used": ["WHO", "PAIN", "NEED"],
    "WHO": "구체적 타겟",
    "PAIN": "구체적 페인포인트",
    "NEED": "구체적 니즈",
    "WHEN": null,
    "WHERE": null,
    "INTEREST": null,
    "conversion_score": 95,
    "insight": "이 조합이 효과적인 이유 (어떤 축의 연결이 핵심인지)",
    "data_evidence": "검색 데이터 근거 한 줄 요약 (예: '클렌저 추천' 월 12,000회 검색, 20대 여성 비율 68%)"
  }
]

주의:
- axes_used에 포함된 축만 구체적 값을 입력하세요.
- axes_used에 포함되지 않은 축은 반드시 null로 설정하세요.
- axes_used는 반드시 2개 또는 3개여야 합니다.
- data_evidence는 리스닝마인드 검색 데이터에서 발견한 구체적 수치나 인사이트를 반드시 포함하세요.`
    } else if (type === 'generate_shortform') {
      // 활성 축만 프롬프트에 포함
      const axisLabels = { WHO: '타겟', WHEN: '시간/시즌', WHERE: '장소', PAIN: '페인포인트', NEED: '니즈', INTEREST: '관심사' }
      const activeAxes = (context.axes_used || ['WHO', 'WHEN', 'WHERE', 'PAIN', 'NEED', 'INTEREST'])
        .filter(axis => context[axis])
      const contextLines = activeAxes
        .map(axis => `- ${axisLabels[axis]}(${axis}): ${context[axis]}`)
        .join('\n')

      prompt = `당신은 발견 커머스 숏폼 콘텐츠 크리에이터입니다. 즉각적 구매를 유발하는 숏폼에 특화되어 있습니다.

다음 제품과 맥락 조합을 바탕으로 YouTube Shorts용 1개, Instagram Reels용 1개의 숏폼 아이디어를 생성하세요.

제품: ${product.name} (${product.category})
가격: ${product.price}
핵심 강점: ${product.strengths.map(s => s.tag).join(", ")}

이 숏폼은 ${activeAxes.join(' + ')} 조합에 집중합니다.
맥락 조합:
${contextLines}

숏폼 구조 원칙:
1. HOOK (0~3초): 페인포인트/상황을 시각적으로 보여줘 스크롤을 멈추게 함
2. TRANSITION (3~10초): 제품 등장 + 작동
3. PROOF (10~25초): Before-After, 비교, 실사용
4. CTA (마지막 5초): 가격/혜택/링크

YouTube Shorts는 검색 의도가 있는 사용자를 위해 정보성+엔터테인먼트 밸런스.
Instagram Reels는 피드 스크롤 중 발견하는 사용자를 위해 시각적 임팩트+감성 중심.

반드시 아래 JSON 형식으로만 응답. 다른 텍스트 없이 JSON만:
{
  "youtube": {
    "title": "영상 제목 (후킹형, 15자 이내)",
    "hook": "처음 3초 후킹 카피 (자막/나레이션)",
    "hook_pattern": "후킹 패턴명 + 설명",
    "scene_flow": ["장면1: 구체적 촬영 디렉션", "장면2: 구체적 촬영 디렉션", "장면3: 구체적 촬영 디렉션", "장면4: 구체적 촬영 디렉션"],
    "proof_point": "영상에서 증명할 핵심 포인트",
    "cta": "마지막 행동 유도 문구",
    "hashtags": ["태그1", "태그2", "태그3", "태그4", "태그5"],
    "best_upload_time": "최적 업로드 시간과 이유",
    "target_cluster": "이 영상이 도달할 관심사 클러스터"
  },
  "instagram": {
    "title": "영상 제목 (후킹형, 15자 이내)",
    "hook": "처음 3초 후킹 카피",
    "hook_pattern": "후킹 패턴명 + 설명",
    "scene_flow": ["장면1: 구체적 촬영 디렉션", "장면2: 구체적 촬영 디렉션", "장면3: 구체적 촬영 디렉션", "장면4: 구체적 촬영 디렉션"],
    "proof_point": "영상에서 증명할 핵심 포인트",
    "cta": "마지막 행동 유도 문구",
    "hashtags": ["태그1", "태그2", "태그3", "태그4", "태그5"],
    "best_upload_time": "최적 업로드 시간과 이유",
    "target_cluster": "이 영상이 도달할 관심사 클러스터"
  }
}`
    }

    // context_match는 리스닝마인드 MCP 연결, generate_shortform은 기본 호출
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: type === 'context_match' ? 4096 : 2000,
      messages: [{ role: 'user', content: prompt }],
    }

    if (type === 'context_match') {
      headers['anthropic-beta'] = 'mcp-client-2025-11-20'
      body.mcp_servers = [
        {
          type: 'url',
          url: 'https://listeningmind-service-mcp.ascentlab.io',
          name: 'listeningmind',
        },
      ]
      body.tools = [
        {
          type: 'mcp_toolset',
          mcp_server_name: 'listeningmind',
        },
      ]
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const data = await response.json()
    // MCP 응답에서 text 블록만 추출 (mcp_tool_use, mcp_tool_result 블록은 스킵)
    const text = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text || '')
      .join('')
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return NextResponse.json({ result: parsed })
  } catch (error) {
    console.error('AI API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
