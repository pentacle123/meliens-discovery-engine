import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { type, product, context, sfTypeFilter } = await request.json()

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

═══ 숏폼 유형 시스템 ═══
멜리언스 숏폼은 3가지 유형으로 작동합니다. 각 맥락 조합에 가장 적합한 유형을 배정하세요.

유형 A - "페인포인트 자극형" (전환율 최고)
  구조: 문제 상황 클로즈업 → 제품 등장 → Before/After → 가격+CTA
  맥락 축: WHO + PAIN 중심 (2축)
  예: "니트 즐겨입는 직장인 + 옷이 낡아보여서 스트레스"

유형 B - "기능 증명형" (신뢰도 최고)
  구조: 실험/비교/테스트 → 수치 증명 → 결과 → CTA
  맥락 축: PAIN + 제품 강점 중심 (기능 소구)
  예: "거치대가 흔들리는 문제 + 과속방지턱 테스트"

유형 C - "상황 제안형" (도달 범위 최고)
  구조: 라이프스타일 장면 → 자연스러운 제품 배치 → 공감 → CTA
  맥락 축: WHO + WHEN + WHERE (3축, 상황 중심)
  예: "자취 1년차 + 아침 출근 전 + 원룸 세면대"

${sfTypeFilter ? `사용자가 유형 "${sfTypeFilter}"을 선택했습니다. 5개 조합 모두 유형 ${sfTypeFilter}로 생성하세요.` : '5개 조합에 유형을 다양하게 배분하세요 (A 2개, B 1~2개, C 1~2개 권장). 제품 특성에 따라 유형 비중을 조절하세요.'}

═══ 핵심 원칙 ═══
1. 6개 축(WHO/WHEN/WHERE/PAIN/NEED/INTEREST)을 전부 연결하지 마세요.
2. 유형에 따라 적합한 축 조합을 사용하세요:
   - 유형 A: WHO + PAIN (2축)
   - 유형 B: PAIN 필수 + 제품 강점 연결 (1~2축)
   - 유형 C: WHO + WHEN + WHERE (3축)
3. 매우 구체적이고 현실적인 상황을 묘사하세요.
   발견 커머스에서 스크롤 중 "어, 이거 나한테 필요한데?"라고 느끼게 만드는 맥락이어야 합니다.
4. 각 조합에 data_evidence 필드를 추가해서, 검색 데이터에서 발견한 근거를 한 줄로 요약하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:
[
  {
    "rank": 1,
    "sf_type": "A",
    "axes_used": ["WHO", "PAIN"],
    "WHO": "구체적 타겟",
    "PAIN": "구체적 페인포인트",
    "WHEN": null,
    "WHERE": null,
    "NEED": null,
    "INTEREST": null,
    "conversion_score": 95,
    "insight": "이 조합이 효과적인 이유",
    "data_evidence": "검색 데이터 근거 한 줄 요약"
  }
]

주의:
- sf_type은 반드시 "A", "B", "C" 중 하나여야 합니다.
- axes_used에 포함된 축만 구체적 값을 입력하고, 나머지는 null로 설정하세요.
- data_evidence는 리스닝마인드 검색 데이터에서 발견한 구체적 수치나 인사이트를 반드시 포함하세요.`
    } else if (type === 'generate_shortform') {
      // 활성 축만 프롬프트에 포함
      const axisLabels = { WHO: '타겟', WHEN: '시간/시즌', WHERE: '장소', PAIN: '페인포인트', NEED: '니즈', INTEREST: '관심사' }
      const activeAxes = (context.axes_used || ['WHO', 'WHEN', 'WHERE', 'PAIN', 'NEED', 'INTEREST'])
        .filter(axis => context[axis])
      const contextLines = activeAxes
        .map(axis => `- ${axisLabels[axis]}(${axis}): ${context[axis]}`)
        .join('\n')

      const sfType = context.sf_type || 'A'
      const typeStructures = {
        A: `유형 A "페인포인트 자극형" — 전환율 극대화
  1. HOOK (0~3초): 페인포인트/문제 상황 클로즈업으로 스크롤 정지
  2. REVEAL (3~8초): 제품 등장 — 문제 해결 시작
  3. PROOF (8~22초): Before/After 극적 비교
  4. CTA (마지막 5초): 가격 + 구매 링크`,
        B: `유형 B "기능 증명형" — 신뢰도 극대화
  1. HOOK (0~3초): 도발적 질문 또는 실험 예고
  2. TEST (3~15초): 실험/비교/테스트 과정 시연
  3. RESULT (15~22초): 수치/증거로 결과 증명
  4. CTA (마지막 5초): 기능 요약 + 구매 링크`,
        C: `유형 C "상황 제안형" — 도달 범위 극대화
  1. HOOK (0~3초): 공감 가는 라이프스타일 장면
  2. BLEND (3~12초): 자연스러운 제품 배치 (일상 속 사용)
  3. VIBE (12~22초): 사용 후 분위기/감성 전환
  4. CTA (마지막 5초): 감성 CTA + 저장/공유 유도`,
      }

      prompt = `당신은 발견 커머스 숏폼 콘텐츠 크리에이터입니다. 즉각적 구매를 유발하는 숏폼에 특화되어 있습니다.

다음 제품과 맥락 조합을 바탕으로 YouTube Shorts용 1개, Instagram Reels용 1개의 숏폼 아이디어를 생성하세요.

제품: ${product.name} (${product.category})
가격: ${product.price}
핵심 강점: ${product.strengths.map(s => s.tag).join(", ")}

이 숏폼은 ${activeAxes.join(' + ')} 조합에 집중합니다.
맥락 조합:
${contextLines}

═══ 숏폼 구조 (${sfType}유형 적용) ═══
${typeStructures[sfType] || typeStructures.A}

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
