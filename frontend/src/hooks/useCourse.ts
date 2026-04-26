import { useState, useCallback, useRef } from 'react'

import type { CourseContinuationResponse, NextPlace, Weather } from '@/types'
import type { TripDuration } from '@/hooks/useRecommend'
import {
  fetchCoursePayload,
  type CourseFetchContext,
} from '@/lib/courseClient'

export type { CourseFetchContext } from '@/lib/courseClient'

export interface CourseStep {
  label: string
  places: NextPlace[]
  payload?: CourseContinuationResponse | null
  selected: NextPlace | null
  loading: boolean
}

const RESTAURANT_TYPES = new Set([
  'restaurant',
  'korean_restaurant',
  'chinese_restaurant',
  'japanese_restaurant',
  'food',
])

/** 일정 길이별 최대 코스 단계 수(첫 화면 포함): 2h→2, 반나절→3, 종일→4 */
export function maxCourseStepsForDuration(d: TripDuration): number {
  if (d === '2h') return 2
  if (d === 'full-day') return 4
  return 3
}

function continuationLabels(d: TripDuration): string[] {
  if (d === '2h') return ['다음 한 곳']
  if (d === 'full-day') return ['점심·휴식', '오후 장면', '저녁·마무리']
  return ['쉬었다 가기', '마무리 동선']
}

function placeCategory(place: NextPlace): string {
  for (const t of place.types) {
    if (RESTAURANT_TYPES.has(t)) return 'restaurant'
  }
  return 'cafe'
}

export function useCourse() {
  const [chain, setChain] = useState<CourseStep[]>([])
  const lastWeatherRef = useRef<Weather | null>(null)
  const lastDurationRef = useRef<TripDuration>('half-day')
  const lastIntentRef = useRef({
    companion: 'solo',
    trip_goal: 'healing',
    transport: 'car',
    adult_count: '2',
    child_count: '0',
  })

  const fetchFirst = useCallback(
    async (
      lat: number,
      lng: number,
      category: string,
      ctx?: CourseFetchContext,
    ) => {
      lastWeatherRef.current = ctx?.weather ?? null
      lastDurationRef.current = ctx?.duration ?? 'half-day'
      lastIntentRef.current = {
        companion: ctx?.companion ?? 'solo',
        trip_goal: ctx?.trip_goal ?? 'healing',
        transport: ctx?.transport ?? 'car',
        adult_count: ctx?.adult_count ?? '2',
        child_count: ctx?.child_count ?? '0',
      }

      setChain([{ label: '코스 이어가기', places: [], payload: null, selected: null, loading: true }])
      try {
        const hour = new Date().getHours()
        const data = await fetchCoursePayload(lat, lng, category, hour, ctx)
        setChain([
          {
            label: '코스 이어가기',
            places: data.next_places ?? [],
            payload: data,
            selected: null,
            loading: false,
          },
        ])
      } catch {
        setChain([{ label: '코스 이어가기', places: [], payload: null, selected: null, loading: false }])
      }
    },
    [],
  )

  const selectPlace = useCallback(async (stepIdx: number, place: NextPlace) => {
    setChain(prev => prev.map((s, i) => (i === stepIdx ? { ...s, selected: place } : s)))
    const nextIdx = stepIdx + 1
    const maxSteps = maxCourseStepsForDuration(lastDurationRef.current)
    if (nextIdx >= maxSteps) return

    const labels = continuationLabels(lastDurationRef.current)
    const lbl = labels[nextIdx - 1] ?? `다음 코스 ${nextIdx}`

    const nextStep: CourseStep = {
      label: lbl,
      places: [],
      payload: null,
      selected: null,
      loading: true,
    }
    setChain(prev => [...prev.slice(0, nextIdx), nextStep])

    try {
      const hour = new Date().getHours()
      const category = placeCategory(place)
      const data = await fetchCoursePayload(place.lat, place.lng, category, hour, {
        spotId: place.place_id,
        spotName: place.name,
        weather: lastWeatherRef.current ?? undefined,
        duration: lastDurationRef.current,
        companion: lastIntentRef.current.companion,
        trip_goal: lastIntentRef.current.trip_goal,
        transport: lastIntentRef.current.transport,
        adult_count: lastIntentRef.current.adult_count,
        child_count: lastIntentRef.current.child_count,
      })
      setChain(prev =>
        prev.map((s, i) =>
          i === nextIdx
            ? { ...s, places: data.next_places ?? [], payload: data, loading: false }
            : s,
        ),
      )
    } catch {
      setChain(prev =>
        prev.map((s, i) => (i === nextIdx ? { ...s, loading: false } : s)),
      )
    }
  }, [])

  const clear = useCallback(() => setChain([]), [])

  return { chain, fetchFirst, selectPlace, clear }
}
