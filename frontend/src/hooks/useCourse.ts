import { useState, useCallback } from 'react'
import type { NextPlace } from '@/types'

export interface CourseStep {
  label: string
  places: NextPlace[]
  selected: NextPlace | null
  loading: boolean
}

const STEP_LABELS = ['식사', '카페 · 디저트']

const RESTAURANT_TYPES = new Set([
  'restaurant', 'korean_restaurant', 'chinese_restaurant',
  'japanese_restaurant', 'food',
])

function placeCategory(place: NextPlace): string {
  for (const t of place.types) {
    if (RESTAURANT_TYPES.has(t)) return 'restaurant'
  }
  return 'cafe'
}

async function fetchPlaces(
  lat: number, lng: number, category: string, hour: number
): Promise<NextPlace[]> {
  const res = await window.fetch(
    `/api/course?lat=${lat}&lng=${lng}&category=${encodeURIComponent(category)}&hour=${hour}`
  )
  const data = await res.json()
  return data.next_places ?? []
}

export function useCourse() {
  const [chain, setChain] = useState<CourseStep[]>([])

  // 첫 번째 코스 — 메인 장소 누를 때
  const fetchFirst = useCallback(async (lat: number, lng: number, category: string) => {
    setChain([{ label: STEP_LABELS[0], places: [], selected: null, loading: true }])
    try {
      const hour = new Date().getHours()
      const places = await fetchPlaces(lat, lng, category, hour)
      setChain([{ label: STEP_LABELS[0], places, selected: null, loading: false }])
    } catch {
      setChain([{ label: STEP_LABELS[0], places: [], selected: null, loading: false }])
    }
  }, [])

  // 코스 내 장소 선택 → 다음 단계 추가
  const selectPlace = useCallback(async (stepIdx: number, place: NextPlace) => {
    // 선택 표시
    setChain(prev => prev.map((s, i) =>
      i === stepIdx ? { ...s, selected: place } : s
    ))

    const nextIdx = stepIdx + 1
    if (nextIdx >= STEP_LABELS.length) return

    // 다음 단계 로딩 추가
    const nextStep: CourseStep = {
      label: STEP_LABELS[nextIdx] ?? '다음 코스',
      places: [],
      selected: null,
      loading: true,
    }
    setChain(prev => [...prev.slice(0, nextIdx), nextStep])

    try {
      const hour = new Date().getHours() + (nextIdx * 2)
      const category = placeCategory(place)   // 선택한 장소가 식당인지 카페인지
      const places = await fetchPlaces(place.lat, place.lng, category, hour)
      setChain(prev => prev.map((s, i) =>
        i === nextIdx ? { ...s, places, loading: false } : s
      ))
    } catch {
      setChain(prev => prev.map((s, i) =>
        i === nextIdx ? { ...s, loading: false } : s
      ))
    }
  }, [])

  const clear = useCallback(() => setChain([]), [])

  return { chain, fetchFirst, selectPlace, clear }
}
