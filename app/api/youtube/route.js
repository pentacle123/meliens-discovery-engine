/**
 * GET /api/youtube
 *
 * YouTube Data API v3로 멜리언스 유튜브 채널(@meliens_official)의
 * 쇼츠 영상 목록 + 성과 데이터를 가져옵니다.
 *
 * 강화 분석:
 * - 영상 유형 자동 분류 (페인포인트형/기능증명형/상황제안형/리뷰형/언박싱형/비교형)
 * - 후킹 패턴 분석 (질문형/놀람형/비교형/꿀팁형/숫자형/감성형/도발형)
 * - 썸네일 구성 분류 (B/A 비교형/제품 중심형/상황 중심형/텍스트 중심형/인물 중심형)
 * - 구체적 수치 기반 인사이트
 *
 * 환경변수: YOUTUBE_API_KEY
 */

import { NextResponse } from 'next/server'

const CHANNEL_HANDLE = '@meliens_official'
const YT_API = 'https://www.googleapis.com/youtube/v3'

// 채널 핸들로 채널 ID 조회
async function getChannelId(apiKey) {
  const res = await fetch(
    `${YT_API}/channels?part=contentDetails,snippet,statistics&forHandle=${encodeURIComponent(CHANNEL_HANDLE)}&key=${apiKey}`
  )
  if (!res.ok) throw new Error(`YouTube channels API error: ${res.status}`)
  const data = await res.json()
  if (!data.items?.length) throw new Error(`채널을 찾을 수 없습니다: ${CHANNEL_HANDLE}`)
  const ch = data.items[0]
  return {
    channelId: ch.id,
    uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads,
    channelTitle: ch.snippet?.title,
    channelThumbnail: ch.snippet?.thumbnails?.default?.url,
    subscriberCount: Number(ch.statistics?.subscriberCount || 0),
    totalViews: Number(ch.statistics?.viewCount || 0),
    videoCount: Number(ch.statistics?.videoCount || 0),
  }
}

// 업로드 플레이리스트에서 영상 ID 목록 가져오기 (최대 50개)
async function getPlaylistVideos(playlistId, apiKey, maxResults = 50) {
  const videoIds = []
  let pageToken = ''
  let fetched = 0

  while (fetched < maxResults) {
    const take = Math.min(50, maxResults - fetched)
    const url = `${YT_API}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${take}&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ''}`
    const res = await fetch(url)
    if (!res.ok) break
    const data = await res.json()
    if (!data.items?.length) break

    data.items.forEach(item => {
      videoIds.push({
        videoId: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
        title: item.snippet?.title,
        publishedAt: item.snippet?.publishedAt,
        thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
      })
    })

    fetched += data.items.length
    pageToken = data.nextPageToken
    if (!pageToken) break
  }

  return videoIds
}

// 영상 상세 정보 (duration, statistics) 일괄 조회
async function getVideoDetails(videoIds, apiKey) {
  const details = {}
  // 50개씩 나눠서 호출 (API 제한)
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const ids = batch.map(v => v.videoId).join(',')
    const res = await fetch(
      `${YT_API}/videos?part=statistics,contentDetails,snippet&id=${ids}&key=${apiKey}`
    )
    if (!res.ok) continue
    const data = await res.json()
    data.items?.forEach(item => {
      details[item.id] = {
        duration: item.contentDetails?.duration, // ISO 8601
        viewCount: Number(item.statistics?.viewCount || 0),
        likeCount: Number(item.statistics?.likeCount || 0),
        commentCount: Number(item.statistics?.commentCount || 0),
        tags: item.snippet?.tags || [],
        description: item.snippet?.description || '',
      }
    })
  }
  return details
}

// ISO 8601 duration → 초
function parseDuration(iso) {
  if (!iso) return 0
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  return (Number(match[1] || 0) * 3600) + (Number(match[2] || 0) * 60) + Number(match[3] || 0)
}

// 제품 매칭 (제목/태그/설명에서 제품 키워드 감지)
function detectProduct(title, tags, description) {
  const text = `${title} ${tags.join(' ')} ${description}`.toLowerCase()
  const productMap = {
    '클렌저': 'clenser', '진동클렌저': 'clenser', '세안': 'clenser',
    '보풀': 'lint', '보풀제거': 'lint', '린트리무버': 'lint',
    '거치대': 'stand', '스탠드': 'stand', '핸드폰거치대': 'stand',
    '가습기': 'humidifier', '미니가습기': 'humidifier',
    '네일': 'nail', '네일드릴': 'nail', '네일머신': 'nail',
    '마사지': 'massager', '안마기': 'massager', '마사지건': 'massager',
    '칫솔': 'toothbrush', '전동칫솔': 'toothbrush', '음파칫솔': 'toothbrush',
    '제모': 'epilator', '제모기': 'epilator', 'ipl': 'epilator',
  }

  for (const [keyword, productId] of Object.entries(productMap)) {
    if (text.includes(keyword)) return productId
  }
  return 'unknown'
}

// ─── 영상 유형 자동 분류 ───
// 제목+설명+태그를 종합 분석하여 6가지 유형으로 분류
function classifyVideoType(title, tags, description) {
  const text = `${title} ${tags.join(' ')} ${description}`.toLowerCase()
  const titleLower = title.toLowerCase()

  // 비교형: Before/After, 비교, VS, 차이, 변화
  if (/비포.?애프터|before.?after|비교|vs\b|차이|변화|전후|사용\s?전|사용\s?후/.test(text)) {
    return { type: 'comparison', label: '비교형', emoji: '⚖️' }
  }

  // 언박싱형: 언박싱, 개봉, 첫 사용, 하울, 배송
  if (/언박싱|개봉|첫\s?사용|하울|배송|도착|택배|구매/.test(text)) {
    return { type: 'unboxing', label: '언박싱형', emoji: '📦' }
  }

  // 리뷰형: 리뷰, 후기, 솔직, 평가, 사용기, 장단점
  if (/리뷰|후기|솔직|평가|사용기|장단점|추천|비추|별점/.test(text)) {
    return { type: 'review', label: '리뷰형', emoji: '📝' }
  }

  // 페인포인트형: 고민, 문제, 해결, 불편, 못 참, 짜증, 스트레스
  if (/고민|문제|해결|불편|못\s?참|짜증|스트레스|걱정|답답|힘들|아직도|왜\s?아직/.test(text)) {
    return { type: 'painpoint', label: '페인포인트형', emoji: '😫' }
  }

  // 상황제안형: ~할 때, ~하는 날, 출근, 여행, 일상, 루틴, 꿀팁
  if (/할\s?때|하는\s?날|출근|여행|일상|루틴|꿀팁|활용|방법|이렇게|이럴\s?때/.test(text)) {
    return { type: 'situation', label: '상황제안형', emoji: '💡' }
  }

  // 기능증명형: 기능, 성능, 테스트, 실험, 효과, 진짜, 실제, 증명
  if (/기능|성능|테스트|실험|효과|진짜|실제|증명|결과|파워|세기|단계/.test(text)) {
    return { type: 'proof', label: '기능증명형', emoji: '🔬' }
  }

  // 기본값: 제목+설명이 짧고 제품명만 있으면 기능증명형
  return { type: 'proof', label: '기능증명형', emoji: '🔬' }
}

// ─── 후킹 패턴 분석 ───
// 제목에서 후킹 패턴 추출
function detectHookingPattern(title) {
  const patterns = []

  // 질문형: ~? 로 끝나거나 의문사 포함
  if (/\?|뭐|왜|어떻게|언제|어디|얼마|몇|아세요|알아|모르|할까/.test(title)) {
    patterns.push({ type: 'question', label: '질문형', emoji: '❓' })
  }

  // 놀람형: !, 대박, 충격, 소름, 미쳤, 놀라, 역대급, 레전드
  if (/[!]{1,}|대박|충격|소름|미쳤|놀라|역대급|레전드|ㄷㄷ|헐|와|실화|진짜/.test(title)) {
    patterns.push({ type: 'surprise', label: '놀람형', emoji: '😱' })
  }

  // 비교형: VS, 비교, 차이, ~보다, 전 vs 후
  if (/vs|비교|차이|보다|전후|비포|애프터/.test(title.toLowerCase())) {
    patterns.push({ type: 'compare', label: '비교형', emoji: '⚖️' })
  }

  // 꿀팁형: 팁, 꿀팁, 방법, 비법, 노하우, ~하는 법
  if (/팁|꿀팁|방법|비법|노하우|하는\s?법|비결|핵심|포인트/.test(title)) {
    patterns.push({ type: 'tip', label: '꿀팁형', emoji: '🍯' })
  }

  // 숫자형: 제목에 숫자 + 단위 (3가지, 5초, 1위 등)
  if (/\d+\s*(가지|초|분|위|개|단계|배|%|원|번|일)/.test(title)) {
    patterns.push({ type: 'number', label: '숫자형', emoji: '🔢' })
  }

  // 감성형: 감성적 단어, 이모티콘, 사랑, 최고, 인생
  if (/사랑|최고|인생|행복|예쁘|귀엽|감동|힐링|좋아|완벽/.test(title)) {
    patterns.push({ type: 'emotional', label: '감성형', emoji: '💖' })
  }

  // 도발형: 아직도, ~하지 마, 이것만, 절대, 무조건, 필수
  if (/아직도|하지\s?마|이것만|절대|무조건|필수|당장|지금\s?바로|모르면\s?손해/.test(title)) {
    patterns.push({ type: 'provocative', label: '도발형', emoji: '🔥' })
  }

  // 패턴이 없으면 일반형
  if (patterns.length === 0) {
    patterns.push({ type: 'plain', label: '일반형', emoji: '📌' })
  }

  return patterns
}

// ─── 썸네일 구성 분류 ───
// 제목/설명/태그에서 추론한 썸네일 구성 유형
function classifyThumbnailComposition(title, tags, description) {
  const text = `${title} ${tags.join(' ')} ${description}`.toLowerCase()
  const compositions = []

  // Before/After 비교 구성
  if (/비포|애프터|before|after|전후|사용\s?전|사용\s?후|비교/.test(text)) {
    compositions.push({ type: 'before_after', label: 'B/A 비교', color: '#f59e0b' })
  }

  // 텍스트 오버레이 (제목에 숫자/강조/이모지가 많으면)
  const hasStrongText = /[!?]{2,}|[ㄱ-ㅎ]{2,}|대박|충격|필수|꿀팁/.test(title)
  const hasNumbers = /\d+\s*(가지|초|분|위|개|단계|배|%)/.test(title)
  if (hasStrongText || hasNumbers) {
    compositions.push({ type: 'text_overlay', label: '텍스트 중심', color: '#a78bfa' })
  }

  // 상황 중심 (일상/상황 설명)
  if (/출근|여행|일상|루틴|할\s?때|하는\s?날|아침|저녁|주말/.test(text)) {
    compositions.push({ type: 'scene_based', label: '상황 중심', color: '#60a5fa' })
  }

  // 인물 중심 (직접, 착용, 사용 장면)
  if (/착용|직접|사용|사용기|써봤|써본|체험|도전/.test(text)) {
    compositions.push({ type: 'person_based', label: '인물 중심', color: '#f472b6' })
  }

  // 기본: 제품 중심
  if (compositions.length === 0) {
    compositions.push({ type: 'product_focused', label: '제품 중심', color: '#4ecdc4' })
  }

  return compositions
}


// ─── 강화된 AI 인사이트 생성 ───
function generateInsights(videos) {
  if (!videos.length) return {
    summary: '데이터 없음', patterns: [], recommendations: [],
    typeStats: {}, hookStats: {}, thumbnailStats: {}, deepInsights: [],
  }

  const totalViews = videos.reduce((s, v) => s + v.viewCount, 0)
  const avgViews = Math.round(totalViews / videos.length)
  const avgLikes = Math.round(videos.reduce((s, v) => s + v.likeCount, 0) / videos.length)
  const avgComments = Math.round(videos.reduce((s, v) => s + v.commentCount, 0) / videos.length)
  const totalLikes = videos.reduce((s, v) => s + v.likeCount, 0)
  const totalComments = videos.reduce((s, v) => s + v.commentCount, 0)

  // TOP/하위 성과 영상
  const sorted = [...videos].sort((a, b) => b.viewCount - a.viewCount)
  const top3 = sorted.slice(0, 3)
  const bottom3 = sorted.slice(-3).reverse()

  // ── 제품별 성과 ──
  const productStats = {}
  videos.forEach(v => {
    if (!productStats[v.productId]) {
      productStats[v.productId] = { count: 0, totalViews: 0, totalLikes: 0, totalComments: 0 }
    }
    const ps = productStats[v.productId]
    ps.count++
    ps.totalViews += v.viewCount
    ps.totalLikes += v.likeCount
    ps.totalComments += v.commentCount
  })

  Object.values(productStats).forEach(ps => {
    ps.avgViews = Math.round(ps.totalViews / ps.count)
    ps.avgLikes = Math.round(ps.totalLikes / ps.count)
    ps.engagementRate = ps.totalViews > 0
      ? Number(((ps.totalLikes + ps.totalComments) / ps.totalViews * 100).toFixed(2))
      : 0
  })

  // ── 영상 유형별 성과 분석 ──
  const typeStats = {}
  videos.forEach(v => {
    const t = v.videoType?.type || 'unknown'
    if (!typeStats[t]) {
      typeStats[t] = {
        label: v.videoType?.label || '기타',
        emoji: v.videoType?.emoji || '📌',
        count: 0, totalViews: 0, totalLikes: 0, totalComments: 0,
      }
    }
    const ts = typeStats[t]
    ts.count++
    ts.totalViews += v.viewCount
    ts.totalLikes += v.likeCount
    ts.totalComments += v.commentCount
  })

  Object.values(typeStats).forEach(ts => {
    ts.avgViews = Math.round(ts.totalViews / ts.count)
    ts.avgLikes = Math.round(ts.totalLikes / ts.count)
    ts.likeRate = ts.totalViews > 0
      ? Number((ts.totalLikes / ts.totalViews * 100).toFixed(2))
      : 0
    ts.engagementRate = ts.totalViews > 0
      ? Number(((ts.totalLikes + ts.totalComments) / ts.totalViews * 100).toFixed(2))
      : 0
    ts.viewsVsAvg = avgViews > 0 ? Number((ts.avgViews / avgViews).toFixed(2)) : 0
  })

  // ── 후킹 패턴별 성과 분석 ──
  const hookStats = {}
  videos.forEach(v => {
    const hooks = v.hookingPatterns || []
    hooks.forEach(h => {
      if (!hookStats[h.type]) {
        hookStats[h.type] = {
          label: h.label, emoji: h.emoji,
          count: 0, totalViews: 0, totalLikes: 0, totalComments: 0,
          videoIds: [],
        }
      }
      const hs = hookStats[h.type]
      hs.count++
      hs.totalViews += v.viewCount
      hs.totalLikes += v.likeCount
      hs.totalComments += v.commentCount
      hs.videoIds.push(v.videoId)
    })
  })

  Object.values(hookStats).forEach(hs => {
    hs.avgViews = Math.round(hs.totalViews / hs.count)
    hs.avgLikes = Math.round(hs.totalLikes / hs.count)
    hs.likeRate = hs.totalViews > 0
      ? Number((hs.totalLikes / hs.totalViews * 100).toFixed(2))
      : 0
    hs.engagementRate = hs.totalViews > 0
      ? Number(((hs.totalLikes + hs.totalComments) / hs.totalViews * 100).toFixed(2))
      : 0
    hs.viewsVsAvg = avgViews > 0 ? Number((hs.avgViews / avgViews).toFixed(2)) : 0
    delete hs.videoIds
  })

  // ── 썸네일 구성별 성과 분석 ──
  const thumbnailStats = {}
  videos.forEach(v => {
    const comps = v.thumbnailComposition || []
    comps.forEach(c => {
      if (!thumbnailStats[c.type]) {
        thumbnailStats[c.type] = {
          label: c.label, color: c.color,
          count: 0, totalViews: 0, totalLikes: 0, totalComments: 0,
        }
      }
      const cs = thumbnailStats[c.type]
      cs.count++
      cs.totalViews += v.viewCount
      cs.totalLikes += v.likeCount
      cs.totalComments += v.commentCount
    })
  })

  Object.values(thumbnailStats).forEach(cs => {
    cs.avgViews = Math.round(cs.totalViews / cs.count)
    cs.likeRate = cs.totalViews > 0
      ? Number((cs.totalLikes / cs.totalViews * 100).toFixed(2))
      : 0
    cs.engagementRate = cs.totalViews > 0
      ? Number(((cs.totalLikes + cs.totalComments) / cs.totalViews * 100).toFixed(2))
      : 0
    cs.viewsVsAvg = avgViews > 0 ? Number((cs.avgViews / avgViews).toFixed(2)) : 0
  })

  // ── 패턴 분석 (기존 + 강화) ──
  const patterns = []

  // 1) 제목 길이 분석 (구체적 수치 추가)
  const shortTitle = videos.filter(v => v.title.length <= 15)
  const longTitle = videos.filter(v => v.title.length > 15)
  if (shortTitle.length && longTitle.length) {
    const shortAvg = Math.round(shortTitle.reduce((s, v) => s + v.viewCount, 0) / shortTitle.length)
    const longAvg = Math.round(longTitle.reduce((s, v) => s + v.viewCount, 0) / longTitle.length)
    const ratio = shortAvg > longAvg ? (shortAvg / longAvg).toFixed(1) : (longAvg / shortAvg).toFixed(1)
    if (shortAvg > longAvg * 1.2) {
      patterns.push({
        type: 'title_length', impact: 'high',
        insight: `짧은 제목(15자 이하) 평균 조회수 ${shortAvg.toLocaleString()} vs 긴 제목 ${longAvg.toLocaleString()} → 짧은 제목이 ${ratio}배 높음`,
      })
    } else if (longAvg > shortAvg * 1.2) {
      patterns.push({
        type: 'title_length', impact: 'high',
        insight: `긴 제목(15자 초과) 평균 조회수 ${longAvg.toLocaleString()} vs 짧은 제목 ${shortAvg.toLocaleString()} → 설명형 제목이 ${ratio}배 높음`,
      })
    }
  }

  // 2) 영상 길이 분석 (구체적 수치)
  const shortVids = videos.filter(v => v.durationSec <= 30)
  const longVids = videos.filter(v => v.durationSec > 30)
  if (shortVids.length && longVids.length) {
    const shortAvg = Math.round(shortVids.reduce((s, v) => s + v.viewCount, 0) / shortVids.length)
    const longAvg = Math.round(longVids.reduce((s, v) => s + v.viewCount, 0) / longVids.length)
    const better = shortAvg > longAvg ? '30초 이하' : '30초 초과'
    const ratio = (Math.max(shortAvg, longAvg) / Math.min(shortAvg, longAvg)).toFixed(1)
    patterns.push({
      type: 'duration',
      insight: `${better} 쇼츠 평균 ${Math.max(shortAvg, longAvg).toLocaleString()}회 vs ${Math.min(shortAvg, longAvg).toLocaleString()}회 → ${ratio}배 차이 (${shortVids.length}개 vs ${longVids.length}개)`,
      impact: Number(ratio) > 1.5 ? 'high' : 'medium',
    })
  }

  // 3) 인게이지먼트 분석
  const avgEngagement = totalViews > 0
    ? (videos.reduce((s, v) => s + v.likeCount + v.commentCount, 0) / totalViews * 100)
    : 0
  const avgLikeRate = totalViews > 0 ? (totalLikes / totalViews * 100) : 0
  const avgCommentRate = totalViews > 0 ? (totalComments / totalViews * 100) : 0
  patterns.push({
    type: 'engagement',
    insight: `좋아요율 ${avgLikeRate.toFixed(1)}% + 댓글율 ${avgCommentRate.toFixed(2)}% = 인게이지먼트율 ${avgEngagement.toFixed(1)}%`,
    impact: avgEngagement > 5 ? 'high' : avgEngagement > 2 ? 'medium' : 'low',
  })

  // 4) 베스트 제품 분석 (구체적 비교)
  const bestProduct = Object.entries(productStats)
    .filter(([id]) => id !== 'unknown')
    .sort((a, b) => b[1].avgViews - a[1].avgViews)[0]
  const worstProduct = Object.entries(productStats)
    .filter(([id]) => id !== 'unknown')
    .sort((a, b) => a[1].avgViews - b[1].avgViews)[0]
  if (bestProduct && worstProduct && bestProduct[0] !== worstProduct[0]) {
    const ratio = (bestProduct[1].avgViews / worstProduct[1].avgViews).toFixed(1)
    patterns.push({
      type: 'best_product', impact: 'high',
      insight: `'${bestProduct[0]}' 평균 ${bestProduct[1].avgViews.toLocaleString()}회 vs '${worstProduct[0]}' ${worstProduct[1].avgViews.toLocaleString()}회 → ${ratio}배 차이`,
    })
  } else if (bestProduct) {
    patterns.push({
      type: 'best_product', impact: 'high',
      insight: `'${bestProduct[0]}' 제품 쇼츠가 평균 조회수 ${bestProduct[1].avgViews.toLocaleString()}으로 가장 높은 성과`,
    })
  }

  // 5) 유형별 베스트 (NEW)
  const typeSorted = Object.entries(typeStats).sort((a, b) => b[1].avgViews - a[1].avgViews)
  if (typeSorted.length >= 2) {
    const best = typeSorted[0]
    const worst = typeSorted[typeSorted.length - 1]
    patterns.push({
      type: 'best_video_type', impact: 'high',
      insight: `${best[1].emoji} ${best[1].label} 평균 조회수 ${best[1].avgViews.toLocaleString()} (전체 평균 대비 ${best[1].viewsVsAvg}배) — ${worst[1].emoji} ${worst[1].label}은 ${worst[1].avgViews.toLocaleString()}으로 가장 낮음`,
    })
  }

  // 6) 후킹 패턴 베스트 (NEW)
  const hookSorted = Object.entries(hookStats)
    .filter(([t]) => t !== 'plain')
    .sort((a, b) => b[1].avgViews - a[1].avgViews)
  if (hookSorted.length >= 2) {
    const best = hookSorted[0]
    patterns.push({
      type: 'best_hook', impact: 'high',
      insight: `${best[1].emoji} ${best[1].label} 후킹 평균 조회수 ${best[1].avgViews.toLocaleString()} (전체 대비 ${best[1].viewsVsAvg}배), 좋아요율 ${best[1].likeRate}%`,
    })
  }

  // 7) 썸네일 구성 베스트 (NEW)
  const thumbSorted = Object.entries(thumbnailStats).sort((a, b) => b[1].avgViews - a[1].avgViews)
  if (thumbSorted.length >= 2) {
    const best = thumbSorted[0]
    patterns.push({
      type: 'best_thumbnail', impact: best[1].viewsVsAvg > 1.3 ? 'high' : 'medium',
      insight: `'${best[1].label}' 썸네일 구성 평균 조회수 ${best[1].avgViews.toLocaleString()} (전체 대비 ${best[1].viewsVsAvg}배) — 인게이지먼트율 ${best[1].engagementRate}%`,
    })
  }

  // ── 구체적 수치 기반 딥 인사이트 (NEW) ──
  const deepInsights = []

  // 인게이지먼트 최고 영상
  const engagementSorted = [...videos]
    .filter(v => v.viewCount > avgViews * 0.5) // 조회수 너무 적은 건 제외
    .map(v => ({
      ...v,
      engagement: v.viewCount > 0 ? ((v.likeCount + v.commentCount) / v.viewCount * 100) : 0,
    }))
    .sort((a, b) => b.engagement - a.engagement)

  if (engagementSorted.length > 0) {
    const topEng = engagementSorted[0]
    deepInsights.push({
      type: 'top_engagement',
      title: '인게이지먼트 최강 영상',
      detail: `"${topEng.title}" — 인게이지먼트율 ${topEng.engagement.toFixed(1)}% (전체 평균 ${avgEngagement.toFixed(1)}%의 ${(topEng.engagement / avgEngagement).toFixed(1)}배)`,
      metric: `${topEng.engagement.toFixed(1)}%`,
      color: '#34d399',
    })
  }

  // 유형별 인게이지먼트 비교
  const typeEngSorted = Object.entries(typeStats).sort((a, b) => b[1].engagementRate - a[1].engagementRate)
  if (typeEngSorted.length >= 2) {
    const best = typeEngSorted[0]
    const globalEng = avgEngagement
    deepInsights.push({
      type: 'type_engagement',
      title: '유형별 인게이지먼트',
      detail: `${best[1].emoji} ${best[1].label}의 평균 좋아요율 ${best[1].likeRate}%로 전체 평균 ${avgLikeRate.toFixed(1)}% 대비 ${(best[1].likeRate / avgLikeRate).toFixed(1)}배 높음`,
      metric: `${best[1].likeRate}%`,
      color: '#f59e0b',
    })
  }

  // 최적 영상 길이
  const durationBuckets = {}
  videos.forEach(v => {
    const bucket = v.durationSec <= 15 ? '~15초' : v.durationSec <= 30 ? '16~30초' : v.durationSec <= 60 ? '31~60초' : '60초+'
    if (!durationBuckets[bucket]) durationBuckets[bucket] = { count: 0, totalViews: 0 }
    durationBuckets[bucket].count++
    durationBuckets[bucket].totalViews += v.viewCount
  })
  const bestDuration = Object.entries(durationBuckets)
    .map(([k, v]) => ({ bucket: k, avgViews: Math.round(v.totalViews / v.count), count: v.count }))
    .sort((a, b) => b.avgViews - a.avgViews)[0]
  if (bestDuration) {
    deepInsights.push({
      type: 'optimal_duration',
      title: '최적 영상 길이',
      detail: `${bestDuration.bucket} 구간 평균 조회수 ${bestDuration.avgViews.toLocaleString()} (${bestDuration.count}개 영상) — 이 길이가 가장 효과적`,
      metric: bestDuration.bucket,
      color: '#60a5fa',
    })
  }

  // 업로드 요일별 성과
  const dayStats = {}
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  videos.forEach(v => {
    const day = dayNames[new Date(v.publishedAt).getDay()]
    if (!dayStats[day]) dayStats[day] = { count: 0, totalViews: 0 }
    dayStats[day].count++
    dayStats[day].totalViews += v.viewCount
  })
  const bestDay = Object.entries(dayStats)
    .filter(([, v]) => v.count >= 2)
    .map(([k, v]) => ({ day: k, avgViews: Math.round(v.totalViews / v.count), count: v.count }))
    .sort((a, b) => b.avgViews - a.avgViews)[0]
  if (bestDay) {
    deepInsights.push({
      type: 'best_day',
      title: '최적 업로드 요일',
      detail: `${bestDay.day}요일 업로드 평균 조회수 ${bestDay.avgViews.toLocaleString()} (${bestDay.count}개 영상) — 전체 평균 대비 ${(bestDay.avgViews / avgViews).toFixed(1)}배`,
      metric: `${bestDay.day}요일`,
      color: '#a78bfa',
    })
  }

  // ── 추천사항 (강화) ──
  const recommendations = []
  if (top3[0] && top3[0].viewCount > avgViews * 2) {
    recommendations.push(`TOP 영상 "${top3[0].title.slice(0, 20)}..."의 포맷을 참고하세요 (평균 대비 ${Math.round(top3[0].viewCount / avgViews)}배 성과)`)
  }
  if (typeSorted.length >= 1) {
    const bestType = typeSorted[0]
    recommendations.push(`${bestType[1].emoji} ${bestType[1].label} 영상을 더 제작하세요 (평균 조회수 ${bestType[1].avgViews.toLocaleString()}, 전체 대비 ${bestType[1].viewsVsAvg}배)`)
  }
  if (hookSorted.length >= 1) {
    const bestHook = hookSorted[0]
    recommendations.push(`${bestHook[1].emoji} ${bestHook[1].label} 후킹 패턴 활용 시 평균 조회수 ${bestHook[1].avgViews.toLocaleString()} 기대 가능`)
  }
  if (bestProduct) {
    recommendations.push(`${bestProduct[0]} 제품 × ${typeSorted[0]?.[1]?.label || '기능증명형'} 조합으로 시너지를 노리세요`)
  }
  if (avgEngagement < 3) {
    recommendations.push('댓글 유도 CTA나 질문형 제목으로 인게이지먼트를 높이세요 (현재 평균 인게이지먼트율 ' + avgEngagement.toFixed(1) + '%)')
  }
  if (bestDay) {
    recommendations.push(`${bestDay.day}요일 업로드 시 평균 ${bestDay.avgViews.toLocaleString()}회 조회 가능 (최적 타이밍)`)
  }

  return {
    summary: `총 ${videos.length}개 쇼츠, 평균 조회수 ${avgViews.toLocaleString()}, 평균 좋아요 ${avgLikes.toLocaleString()}, 인게이지먼트율 ${avgEngagement.toFixed(1)}%`,
    avgViews,
    avgLikes,
    avgComments,
    totalViews,
    avgEngagement: Number(avgEngagement.toFixed(2)),
    avgLikeRate: Number(avgLikeRate.toFixed(2)),
    avgCommentRate: Number(avgCommentRate.toFixed(2)),
    top3: top3.map(v => ({ title: v.title, viewCount: v.viewCount, videoId: v.videoId, videoType: v.videoType, hookingPatterns: v.hookingPatterns })),
    bottom3: bottom3.map(v => ({ title: v.title, viewCount: v.viewCount, videoId: v.videoId, videoType: v.videoType, hookingPatterns: v.hookingPatterns })),
    productStats,
    typeStats,
    hookStats,
    thumbnailStats,
    patterns,
    deepInsights,
    recommendations,
  }
}


export async function GET() {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'YOUTUBE_API_KEY가 설정되지 않았습니다', success: false },
        { status: 500 }
      )
    }

    console.log('[YouTube API] 채널 분석 시작')

    // 1) 채널 정보 조회
    const channel = await getChannelId(apiKey)
    console.log(`[YouTube API] 채널: ${channel.channelTitle} (${channel.channelId}), 총 영상: ${channel.videoCount}`)

    if (!channel.uploadsPlaylistId) {
      throw new Error('업로드 플레이리스트를 찾을 수 없습니다')
    }

    // 2) 최근 영상 목록 (최대 50개)
    const playlist = await getPlaylistVideos(channel.uploadsPlaylistId, apiKey, 50)
    console.log(`[YouTube API] 플레이리스트에서 ${playlist.length}개 영상 조회`)

    // 3) 영상 상세 정보
    const details = await getVideoDetails(playlist, apiKey)

    // 4) 쇼츠만 필터링 (180초 이하) + 데이터 합치기 + 강화 분석
    const videos = playlist
      .filter(v => {
        const d = details[v.videoId]
        if (!d) return false
        const sec = parseDuration(d.duration)
        return sec > 0 && sec <= 180
      })
      .map(v => {
        const d = details[v.videoId]
        const sec = parseDuration(d.duration)
        const videoType = classifyVideoType(v.title, d.tags, d.description)
        const hookingPatterns = detectHookingPattern(v.title)
        const thumbnailComposition = classifyThumbnailComposition(v.title, d.tags, d.description)

        return {
          videoId: v.videoId,
          title: v.title,
          publishedAt: v.publishedAt,
          thumbnail: v.thumbnail,
          durationSec: sec,
          viewCount: d.viewCount,
          likeCount: d.likeCount,
          commentCount: d.commentCount,
          productId: detectProduct(v.title, d.tags, d.description),
          videoType,
          hookingPatterns,
          thumbnailComposition,
          url: `https://youtube.com/shorts/${v.videoId}`,
        }
      })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))

    console.log(`[YouTube API] 쇼츠 ${videos.length}개 필터링 + 유형/후킹/썸네일 분류 완료`)

    // 5) 강화된 인사이트 생성
    const insights = generateInsights(videos)

    return NextResponse.json({
      success: true,
      channel: {
        title: channel.channelTitle,
        thumbnail: channel.channelThumbnail,
        subscriberCount: channel.subscriberCount,
        totalViews: channel.totalViews,
        videoCount: channel.videoCount,
      },
      videos,
      insights,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[YouTube API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error', success: false },
      { status: 500 }
    )
  }
}
