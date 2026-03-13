/**
 * GET /api/youtube
 *
 * YouTube Data API v3로 멜리언스 유튜브 채널(@meliens_official)의
 * 쇼츠 영상 목록 + 성과 데이터를 가져옵니다.
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

// AI 인사이트 생성 (서버사이드 분석)
function generateInsights(videos) {
  if (!videos.length) return { summary: '데이터 없음', patterns: [], recommendations: [] }

  const totalViews = videos.reduce((s, v) => s + v.viewCount, 0)
  const avgViews = Math.round(totalViews / videos.length)
  const avgLikes = Math.round(videos.reduce((s, v) => s + v.likeCount, 0) / videos.length)
  const avgComments = Math.round(videos.reduce((s, v) => s + v.commentCount, 0) / videos.length)

  // TOP/하위 성과 영상
  const sorted = [...videos].sort((a, b) => b.viewCount - a.viewCount)
  const top3 = sorted.slice(0, 3)
  const bottom3 = sorted.slice(-3).reverse()

  // 제품별 성과
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

  // 패턴 분석
  const patterns = []

  // 1) 제목 길이 분석
  const shortTitle = videos.filter(v => v.title.length <= 15)
  const longTitle = videos.filter(v => v.title.length > 15)
  if (shortTitle.length && longTitle.length) {
    const shortAvg = shortTitle.reduce((s, v) => s + v.viewCount, 0) / shortTitle.length
    const longAvg = longTitle.reduce((s, v) => s + v.viewCount, 0) / longTitle.length
    if (shortAvg > longAvg * 1.3) {
      patterns.push({ type: 'title_length', insight: '짧은 제목(15자 이하)이 긴 제목보다 평균 조회수가 높습니다', impact: 'high' })
    } else if (longAvg > shortAvg * 1.3) {
      patterns.push({ type: 'title_length', insight: '설명적인 긴 제목이 더 높은 조회수를 기록합니다', impact: 'high' })
    }
  }

  // 2) 영상 길이 분석
  const shortVids = videos.filter(v => v.durationSec <= 30)
  const longVids = videos.filter(v => v.durationSec > 30)
  if (shortVids.length && longVids.length) {
    const shortAvg = shortVids.reduce((s, v) => s + v.viewCount, 0) / shortVids.length
    const longAvg = longVids.reduce((s, v) => s + v.viewCount, 0) / longVids.length
    patterns.push({
      type: 'duration',
      insight: shortAvg > longAvg
        ? '30초 이하 쇼츠가 더 높은 조회수를 기록합니다'
        : '30초 초과 쇼츠가 더 높은 조회수를 기록합니다',
      impact: Math.abs(shortAvg - longAvg) / Math.max(shortAvg, longAvg) > 0.3 ? 'high' : 'medium',
    })
  }

  // 3) 인게이지먼트 분석
  const avgEngagement = totalViews > 0
    ? (videos.reduce((s, v) => s + v.likeCount + v.commentCount, 0) / totalViews * 100)
    : 0
  patterns.push({
    type: 'engagement',
    insight: `평균 인게이지먼트율 ${avgEngagement.toFixed(1)}% (좋아요+댓글/조회수)`,
    impact: avgEngagement > 5 ? 'high' : avgEngagement > 2 ? 'medium' : 'low',
  })

  // 4) 베스트 제품 분석
  const bestProduct = Object.entries(productStats)
    .filter(([id]) => id !== 'unknown')
    .sort((a, b) => b[1].avgViews - a[1].avgViews)[0]
  if (bestProduct) {
    patterns.push({
      type: 'best_product',
      insight: `'${bestProduct[0]}' 제품 쇼츠가 평균 조회수 ${bestProduct[1].avgViews.toLocaleString()}으로 가장 높은 성과`,
      impact: 'high',
    })
  }

  // 추천사항
  const recommendations = []
  if (top3[0] && top3[0].viewCount > avgViews * 2) {
    recommendations.push(`TOP 영상 "${top3[0].title.slice(0, 20)}..."의 포맷을 참고하세요 (평균 대비 ${Math.round(top3[0].viewCount / avgViews)}배 성과)`)
  }
  if (bestProduct) {
    recommendations.push(`${bestProduct[0]} 제품 관련 숏폼을 더 제작하면 채널 성장에 효과적입니다`)
  }
  if (avgEngagement < 3) {
    recommendations.push('댓글 유도 CTA나 질문형 제목으로 인게이지먼트를 높이세요')
  }

  return {
    summary: `총 ${videos.length}개 쇼츠, 평균 조회수 ${avgViews.toLocaleString()}, 평균 좋아요 ${avgLikes.toLocaleString()}`,
    avgViews,
    avgLikes,
    avgComments,
    totalViews,
    avgEngagement: Number(avgEngagement.toFixed(2)),
    top3: top3.map(v => ({ title: v.title, viewCount: v.viewCount, videoId: v.videoId })),
    bottom3: bottom3.map(v => ({ title: v.title, viewCount: v.viewCount, videoId: v.videoId })),
    productStats,
    patterns,
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

    // 4) 쇼츠만 필터링 (60초 이하) + 데이터 합치기
    const videos = playlist
      .filter(v => {
        const d = details[v.videoId]
        if (!d) return false
        const sec = parseDuration(d.duration)
        return sec > 0 && sec <= 180 // YouTube Shorts는 최대 3분
      })
      .map(v => {
        const d = details[v.videoId]
        const sec = parseDuration(d.duration)
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
          url: `https://youtube.com/shorts/${v.videoId}`,
        }
      })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))

    console.log(`[YouTube API] 쇼츠 ${videos.length}개 필터링 완료`)

    // 5) AI 인사이트 생성
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
