import type { RecommendResponse } from '@/types'

/** 추천 목록에서 장소 좌표(없으면 null) */
export function coordsForPlaceName(
  data: RecommendResponse,
  name: string,
): { lat: number; lng: number } | null {
  const row = data.recommendations?.find(r => r.name === name)
  const c = row?.coords
  if (c && typeof c.lat === 'number' && typeof c.lng === 'number') return { lat: c.lat, lng: c.lng }
  return null
}

export function categoryForPlaceName(data: RecommendResponse, name: string): string {
  const row = data.recommendations?.find(r => r.name === name)
  const cat = row?.category
  if (cat === 'indoor' || cat === 'outdoor') return cat
  return 'outdoor'
}

export function rowForPlaceName(data: RecommendResponse, name: string) {
  return data.recommendations?.find(r => r.name === name)
}

/** 좌표를 못 찾을 때(희귀) — 아산 시청 인근 기본값 */
export const FALLBACK_COORDS = { lat: 36.7898, lng: 127.0022 }
