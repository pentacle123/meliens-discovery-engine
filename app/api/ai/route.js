import { NextResponse } from 'next/server'

// JSON 배열 또는 객체를 텍스트에서 안전하게 추출
function extractJSON(text) {
  if (!text || !text.trim()) return null
  // 1) 코드펜스 제거
  let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  // 2) 배열 형태 추출 시도
  const arrMatch = clean.match(/\[[\s\S]*\]/)
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]) } catch {}
  }
  // 3) 객체 형태 추출 시도
  const objMatch = clean.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) } catch {}
  }
  // 4) 전체 텍스트 파싱 시도
  try { return JSON.parse(clean) } catch {}
  return null
}

export async function POST(request) {
  try {
    const { type, product, context, sfTypeFilter, channelInsights } = await request.json()

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

      // VOC 인사이트 구성
      const vocRef = product.voc_insights?.length
        ? product.voc_insights.map((v, i) => `  ${i + 1}. ${v}`).join('\n')
        : '(없음)'

      // 채널 분석 인사이트 블록 구성 (강화)
      const channelRef = channelInsights
        ? (() => {
            const lines = [
              `  평균 조회수: ${channelInsights.avgViews?.toLocaleString() || 'N/A'}`,
              `  평균 인게이지먼트: ${channelInsights.avgEngagement || 'N/A'}%`,
              `  평균 좋아요율: ${channelInsights.avgLikeRate || 'N/A'}%`,
            ]
            if (channelInsights.top3?.length) {
              lines.push('  TOP 성과 영상:')
              channelInsights.top3.forEach((v, i) => {
                const typeLabel = v.videoType?.label || '분류없음'
                const hooks = v.hookingPatterns?.map(h => h.label).join('+') || '없음'
                lines.push(`    ${i + 1}. "${v.title}" — 조회수 ${v.viewCount.toLocaleString()} | 유형: ${typeLabel} | 후킹: ${hooks}`)
              })
            }
            // 영상 유형별 성과
            if (channelInsights.typeStats && Object.keys(channelInsights.typeStats).length > 0) {
              lines.push('  영상 유형별 성과:')
              Object.entries(channelInsights.typeStats)
                .sort((a, b) => b[1].avgViews - a[1].avgViews)
                .forEach(([type, stats]) => {
                  lines.push(`    - ${stats.emoji} ${stats.label}: ${stats.count}개, 평균 ${stats.avgViews.toLocaleString()}회, 좋아요율 ${stats.likeRate}% (평균 대비 ${stats.viewsVsAvg}배)`)
                })
            }
            // 후킹 패턴별 성과
            if (channelInsights.hookStats && Object.keys(channelInsights.hookStats).length > 0) {
              lines.push('  후킹 패턴별 성과:')
              Object.entries(channelInsights.hookStats)
                .filter(([t]) => t !== 'plain')
                .sort((a, b) => b[1].avgViews - a[1].avgViews)
                .slice(0, 5)
                .forEach(([type, stats]) => {
                  lines.push(`    - ${stats.emoji} ${stats.label}: ${stats.count}개, 평균 ${stats.avgViews.toLocaleString()}회 (평균 대비 ${stats.viewsVsAvg}배)`)
                })
            }
            if (channelInsights.patterns?.length) {
              lines.push('  수치 기반 성과 패턴:')
              channelInsights.patterns.forEach(p => lines.push(`    - [${p.impact}] ${p.insight}`))
            }
            const productId = product.id
            if (channelInsights.productStats?.[productId]) {
              const ps = channelInsights.productStats[productId]
              lines.push(`  이 제품(${productId}) 채널 성과: ${ps.count}개 영상, 평균 조회수 ${ps.avgViews.toLocaleString()}, 인게이지먼트 ${ps.engagementRate}%`)
            }
            return lines.join('\n')
          })()
        : '(없음)'

      prompt = `당신은 발견 커머스(Discovery Commerce) 숏폼 콘텐츠 전문가입니다.

다음 제품에 대해 구매 전환 확률이 높은 "날카로운 맥락 조합" TOP 9를 JSON으로 생성하세요.

제품: ${product.name} (${product.category})
가격: ${product.price}
핵심 강점: ${product.strengths.map(s => s.tag).join(", ")}

[참고: 제품별 맥락 후보값]
${contextRef}

[참고: 실구매자 VOC 인사이트]
${vocRef}

[참고: YouTube 채널 성과 분석]
${channelRef}

═══ 3단계 아이디어 도출 프로세스 ═══
반드시 아래 3단계를 순서대로 따르세요:

STEP 1 — 자유 아이디어 생성:
위 제품 정보, 맥락 후보값, VOC 인사이트를 종합하여 먼저 아이디어 9개를 자유롭게 발상하세요.

STEP 2 — 검색 데이터 검증:
리스닝마인드의 intent_finder와 keyword_info 도구로 이 제품 관련 키워드를 검색하세요.
- intent_finder: 제품명, 카테고리, 핵심 강점 관련 키워드로 소비자 검색 의도 파악
- keyword_info: 주요 키워드의 검색량, 검색 의도(I/N/C/T), 인구통계 분석
gl(국가코드)은 "kr"로 설정하세요.
검색 데이터에서 실제 소비자가 어떤 기대와 우려를 갖고 검색하는지 확인하여 STEP 1 아이디어를 검증하세요.

STEP 3 — VOC 교차 검증:
위의 VOC 인사이트와 STEP 2 검색 데이터를 교차 확인하세요.
검색 데이터와 VOC 양쪽에서 근거가 있으면 → "🟢 (근거 요약)"
검색 데이터만 근거가 있으면 → "🟡 (근거 요약)"
VOC만 근거가 있으면 → "🟡 (근거 요약)"
근거가 없는 신규 아이디어면 → "🔵 신규 기회 — 블루오션: (아이디어 근거)"

═══ 3단계 아이디어 티어 시스템 (필수) ═══
9개 조합을 반드시 아래 3개 티어로 나누세요:

TIER 1 — "검증된 안전 조합" (rank 1~3):
- 검색 데이터와 VOC 근거가 가장 강한 조합
- 이미 소비자가 검색하고 후기를 남기는 검증된 수요
- data_evidence: 🟢 위주
- 이 티어의 tier값: "safe"

TIER 2 — "크로스 카테고리 조합" (rank 4~6):
- 제품 카테고리 바깥의 관심사와 연결하는 조합
- 예: 클렌저 × 자기계발, 거치대 × 캠핑, 보풀제거기 × 패션
- INTEREST 축을 적극 활용하여 기존 타겟 밖의 오디언스와 연결
- data_evidence: 🟡 또는 🔵 위주
- 이 티어의 tier값: "cross"

TIER 3 — "파격적/실험적 조합" (rank 7~9):
- 아무도 안 해본 블루오션 조합
- 의외의 상황, 반전 타겟, 역발상 시나리오
- 예: 보풀제거기 × 중고 거래 전 업사이클링, 클렌저 × 반려동물
- 실패 가능성 있지만 터지면 바이럴
- data_evidence: 🔵 위주
- 이 티어의 tier값: "experimental"

═══ 숏폼 유형 시스템 ═══
멜리언스 숏폼은 3가지 유형으로 작동합니다. 각 맥락 조합에 가장 적합한 유형을 배정하세요.

유형 A - "페인포인트 자극형" (전환율 최고)
  구조: 문제 상황 클로즈업 → 제품 등장 → Before/After → 가격+CTA
  맥락 축: WHO + PAIN 중심 (2축)

유형 B - "기능 증명형" (신뢰도 최고)
  구조: 실험/비교/테스트 → 수치 증명 → 결과 → CTA
  맥락 축: PAIN + 제품 강점 중심 (기능 소구)

유형 C - "상황 제안형" (도달 범위 최고)
  구조: 라이프스타일 장면 → 자연스러운 제품 배치 → 공감 → CTA
  맥락 축: WHO + WHEN + WHERE (3축, 상황 중심)

${sfTypeFilter ? `사용자가 유형 "${sfTypeFilter}"을 선택했습니다. 9개 조합 모두 유형 ${sfTypeFilter}로 생성하세요.` : '9개 조합에 유형을 다양하게 배분하세요. 제품 특성에 따라 유형 비중을 조절하세요.'}

═══ 핵심 원칙 ═══
1. 6개 축을 전부 연결하지 마세요. 2~3축만 날카롭게.
2. 매우 구체적이고 현실적인 상황을 묘사하세요. 추상적이면 안 됩니다.
3. 각 아이디어에 hook_copy를 반드시 포함하세요 — 숏폼 첫 3초에 사용할 후킹 카피 한 줄.
4. 9개 조합이 서로 겹치지 않아야 합니다. 각각 완전히 다른 관점이어야 합니다.
5. data_evidence는 STEP 3의 검증 결과 이모지(🟢/🟡/🔵)로 시작하세요.
6. 이전에 생성했던 결과와 완전히 다른 관점으로 생성하세요. 새로운 시각, 새로운 타겟, 새로운 상황을 탐색하세요.
7. ai_producible: 이 아이디어를 AI 영상(fal.ai Kling/FLUX)으로 100% 제작 가능한지 판단하세요.
   - true: 제품 클로즈업, Before/After, 이미지 기반 모션 등 AI로 생성 가능한 장면 위주
   - false: 실제 사람 연기, 특정 장소 로케이션, 실험/시연 촬영 등 실사 촬영 필요
8. YouTube 채널 성과 데이터가 있으면 적극 참고하세요.
   - TOP 성과 영상의 유형(비교형/기능증명형 등)과 후킹 패턴(질문형/놀람형 등)을 분석하여 유사한 패턴 활용
   - 영상 유형별 평균 조회수를 비교하여 가장 효과적인 유형 위주로 제작
   - 후킹 패턴별 성과 데이터를 참고하여 hook_copy 작성 시 효과적인 패턴 적용
   - 하위 성과 영상의 유형/패턴은 피하세요
   - 해당 제품의 채널 성과가 있으면 어떤 각도가 효과적이었는지 반영

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:
[
  {
    "rank": 1,
    "tier": "safe",
    "sf_type": "A",
    "axes_used": ["WHO", "PAIN"],
    "WHO": "구체적 타겟",
    "PAIN": "구체적 페인포인트",
    "WHEN": null,
    "WHERE": null,
    "NEED": null,
    "INTEREST": null,
    "conversion_score": 95,
    "hook_copy": "숏폼 첫 3초 후킹 카피 한 줄 (예: '이거 안 쓰면 세안 반만 한 거임')",
    "ai_producible": true,
    "insight": "이 조합이 효과적인 이유",
    "data_evidence": "🟢 검색: '키워드' 월 N회, 의도 T% | VOC: '관련 후기 요약'"
  }
]

주의:
- sf_type은 반드시 "A", "B", "C" 중 하나여야 합니다.
- tier는 반드시 "safe", "cross", "experimental" 중 하나여야 합니다.
- axes_used에 포함된 축만 구체적 값을 입력하고, 나머지는 null로 설정하세요.
- hook_copy는 반드시 포함하세요. 실제 숏폼 자막으로 바로 쓸 수 있는 한 줄 카피여야 합니다.
- ai_producible은 반드시 boolean(true/false)이어야 합니다.
- data_evidence는 반드시 🟢/🟡/🔵 이모지로 시작하세요.`
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

    // ─── API 호출 함수 ───
    async function callClaude({ useMCP = false } = {}) {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }

      const body = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: type === 'context_match' ? 12000 : 2000,
        temperature: type === 'context_match' ? 0.9 : 0.7,
        messages: [{ role: 'user', content: prompt }],
      }

      if (useMCP && type === 'context_match') {
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

      console.log(`[AI API] 호출 시작 — 타입: ${type}, 제품: ${product?.name || 'N/A'}, MCP: ${useMCP}, 모델: ${body.model}`)

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      const data = await response.json()
      console.log(`[AI API] 응답 — status: ${response.status}, stop_reason: ${data.stop_reason || 'N/A'}, 블록 수: ${data.content?.length || 0}`)

      if (!response.ok) {
        const errMsg = data.error?.message || `API 호출 실패 (${response.status})`
        console.error(`[AI API] 오류:`, errMsg)
        throw new Error(errMsg)
      }

      // MCP 응답에서 text 블록만 추출
      const textBlocks = (data.content || []).filter(block => block.type === 'text')
      const blockTypes = (data.content || []).map(b => b.type)
      console.log(`[AI API] 블록 타입: [${blockTypes.join(', ')}], text 블록 수: ${textBlocks.length}`)

      const text = textBlocks.map(block => block.text || '').join('')
      console.log(`[AI API] 추출된 텍스트 길이: ${text.length}자, 앞 200자: ${text.slice(0, 200)}`)

      return text
    }

    // ─── 실행: MCP 우선 시도 → 실패 시 MCP 없이 재시도 ───
    let parsed = null

    if (type === 'context_match') {
      // 1차: MCP 연결 시도
      try {
        console.log('[AI API] === 1차 시도: MCP 연결 ===')
        const text = await callClaude({ useMCP: true })
        parsed = extractJSON(text)
        if (parsed) {
          console.log(`[AI API] MCP 성공! 결과: ${Array.isArray(parsed) ? parsed.length + '개' : 'object'}`)
        } else {
          console.warn('[AI API] MCP 응답에서 JSON 추출 실패, 텍스트:', text.slice(0, 300))
          throw new Error('MCP 응답에서 JSON 추출 실패')
        }
      } catch (mcpError) {
        console.warn(`[AI API] MCP 실패 (${mcpError.message}), MCP 없이 재시도`)
        // 2차: MCP 없이 재시도
        try {
          console.log('[AI API] === 2차 시도: MCP 없이 ===')
          const text = await callClaude({ useMCP: false })
          parsed = extractJSON(text)
          if (parsed) {
            console.log(`[AI API] 직접호출 성공! 결과: ${Array.isArray(parsed) ? parsed.length + '개' : 'object'}`)
          } else {
            console.error('[AI API] 직접호출도 JSON 추출 실패')
            throw new Error('AI 응답에서 JSON을 추출할 수 없습니다')
          }
        } catch (directError) {
          console.error('[AI API] 2차 시도도 실패:', directError.message)
          throw directError
        }
      }
    } else {
      // generate_shortform: MCP 불필요
      const text = await callClaude({ useMCP: false })
      parsed = extractJSON(text)
      if (!parsed) {
        console.error('[AI API] 숏폼 JSON 추출 실패')
        throw new Error('AI 응답에서 JSON을 추출할 수 없습니다')
      }
      console.log(`[AI API] 숏폼 생성 성공`)
    }

    return NextResponse.json({ result: parsed, source: 'ai' })
  } catch (error) {
    console.error('[AI API] 최종 에러:', error.message || error)
    return NextResponse.json({ error: error.message, source: 'error' }, { status: 500 })
  }
}
