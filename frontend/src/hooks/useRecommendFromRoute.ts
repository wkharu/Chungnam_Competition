import { useEffect, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useRecommend } from '@/hooks/useRecommend'
import { tripFormFromSearchParams } from '@/lib/tripParams'
import type { RecommendResponse } from '@/types'

/**
 * /result* 에서 URL 쿼리 + navigate state.data 로 추천 페이로드를 맞춤.
 */
export function useRecommendFromRoute() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const form = tripFormFromSearchParams(searchParams)
  const { data, loading, error, fetch, hydrate } = useRecommend()
  const fetchOnceRef = useRef(false)

  useEffect(() => {
    const fromNav = (location.state as { data?: RecommendResponse } | null)?.data
    if (fromNav) {
      hydrate(fromNav)
      return
    }
    if (fetchOnceRef.current) return
    fetchOnceRef.current = true
    void fetch(
      form.city,
      form.tripDuration,
      {
        companion: form.companion,
        trip_goal: form.tripGoal,
        transport: form.transport,
        adult_count: form.adultCount,
        child_count: form.childCount,
      },
    )
  }, [
    location.key,
    location.state,
    hydrate,
    fetch,
    form.city,
    form.tripDuration,
    form.companion,
    form.tripGoal,
    form.transport,
    form.adultCount,
    form.childCount,
  ])

  return { form, data, loading, error, searchParams }
}
