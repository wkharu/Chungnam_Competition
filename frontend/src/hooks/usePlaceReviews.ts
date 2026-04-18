import { useState, useCallback } from 'react'
import type { PlaceReview } from '@/types'

interface ReviewData {
  rating: number
  review_count: number
  reviews: PlaceReview[]
  website: string
  google_maps: string
  open_now: boolean | null
}

export function usePlaceReviews() {
  const [data, setData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const fetch = useCallback(async (name: string, lat: number, lng: number) => {
    if (fetched) return   // 이미 로딩했으면 재요청 안 함
    setLoading(true)
    try {
      const res = await window.fetch(
        `/api/place-reviews?name=${encodeURIComponent(name)}&lat=${lat}&lng=${lng}`
      )
      const json = await res.json()
      setData(json?.reviews ? json : null)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }, [fetched])

  const reset = useCallback(() => {
    setData(null)
    setFetched(false)
  }, [])

  return { data, loading, fetched, fetch, reset }
}
