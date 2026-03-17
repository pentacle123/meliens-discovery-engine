import { NextResponse } from 'next/server'
import { LISTENING_MIND_DATA } from '@/lib/data'

function extractJSON(text) {
  if (!text || !text.trim()) return null
  let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const arrMatch = clean.match(/\[[\s\S]*\]/)
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]) } catch {}
  }
  const objMatch = clean.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) } catch {}
  }
  try { return JSON.parse(clean) } catch {}
  return null
}

export async function POST(request) {
  try {
    const { type, creatives, insights } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured', success: false }, { status: 500 })
    }

    if (type === 'insight') {
      // ─── AI 인사이트 생성 ───
      const lmData = LISTENING_MIND_DATA
      const prompt = `당신은 퍼포먼스 마케팅 전문가입니다. DA(디스플레이 광고) 성과 데이터를 분석하여 액션 가능한 인사이트를 도출하세요.

## DA 성과 데이터
${JSON.stringify(creatives, null, 2)}

## 리스닝마인드 검색 데이터 (소비자 실제 검색 행동)
- 브랜드 검색: ${lmData.brand.keyword} 월 ${lmData.brand.monthly_avg}회, 트렌드 ${lmData.brand.trend}
- 주요 소비자 우려: ${Object.entries(lmData.products).map(([k, v]) => `${v.keywords?.[0] || k}: ${v.consumer_concerns || ''}`).join(' / ')}
- 경쟁 위협: ${Object.values(lmData.competitive_landscape).map(v => typeof v === 'string' ? v : v.threat || v.insight || '').join(' / ')}

## 분석 요청
아래 관점에서 5~7개의 인사이트를 JSON 배열로 출력하세요:
1. 소재유형별 효율 비교 (어떤 유형이 가장 효율 높고 낮은지, 왜 그런지)
2. 상품별 예산 배분 추천 (ROAS 기반)
3. 카피/메시지 패턴 분석 (FOMO형 '죄송합니다' 패턴의 피로도 등)
4. 리스닝마인드 검색 데이터와 현재 DA 소재 간의 갭 (소비자가 검색하는 관심사가 DA 카피에 반영되지 않는 경우)
5. 구체적 개선 액션

JSON 형식:
[
  {
    "title": "인사이트 제목",
    "detail": "상세 설명 (데이터 근거 포함)",
    "impact": "high|medium|low",
    "action": "구체적 다음 액션"
  }
]

반드시 JSON 배열만 출력하세요.`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error.message || 'Claude API error')

      const text = data.content?.[0]?.text || ''
      const parsed = extractJSON(text)

      if (!parsed || !Array.isArray(parsed)) {
        throw new Error('인사이트 파싱 실패')
      }

      return NextResponse.json({ success: true, insights: parsed })

    } else if (type === 'next_creative') {
      // ─── 다음 소재 기획 ───
      const lmData = LISTENING_MIND_DATA
      const prompt = `당신은 DA(디스플레이 광고) 크리에이티브 디렉터입니다. 기존 성과 데이터와 AI 인사이트를 기반으로 다음 DA 소재 카피를 기획하세요.

## 기존 DA 성과 데이터
${JSON.stringify(creatives, null, 2)}

## AI 인사이트 분석 결과
${JSON.stringify(insights, null, 2)}

## 리스닝마인드 검색 데이터
- 주요 검색 키워드: ${Object.entries(lmData.products).map(([k, v]) => `${v.keywords?.slice(0, 3).join(', ') || k}`).join(' | ')}
- 소비자 우려: ${Object.entries(lmData.products).map(([k, v]) => v.consumer_concerns || '').filter(Boolean).join(' / ')}

## 기획 요청
기존 데이터에서 효율이 높았던 패턴을 강화하고, 인사이트에서 지적한 문제를 해결하는 새로운 DA 소재 카피 4~5안을 기획하세요.

각 안에 대해:
1. 기존에 없던 새로운 접근의 카피
2. 검색 데이터에서 발견한 소비자 관심사/우려를 반영
3. 구체적 성과 근거에 기반한 예상 효과

JSON 형식:
[
  {
    "headline": "헤드라인 카피",
    "sub_copy": "서브 카피",
    "type": "소재유형 (공감형/기능소구형/사회적증거형/비교형/상황제안형 등)",
    "product": "타겟 상품",
    "channel": "추천 매체",
    "visual_guide": "추천 비주얼 가이드 (간단한 설명)",
    "expected_roas": 예상ROAS숫자,
    "rationale": "이 카피를 추천하는 근거 (기존 데이터 + 검색 데이터 연결)"
  }
]

반드시 JSON 배열만 출력하세요.`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          temperature: 0.8,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error.message || 'Claude API error')

      const text = data.content?.[0]?.text || ''
      const parsed = extractJSON(text)

      if (!parsed || !Array.isArray(parsed)) {
        throw new Error('소재 기획 파싱 실패')
      }

      return NextResponse.json({ success: true, nextCreatives: parsed })
    }

    return NextResponse.json({ error: 'Invalid type', success: false }, { status: 400 })
  } catch (err) {
    console.error('DAi Creative API error:', err)
    return NextResponse.json({ error: err.message || 'Server error', success: false }, { status: 500 })
  }
}
