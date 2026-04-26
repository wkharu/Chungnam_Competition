import { useState, useCallback } from 'react'
import type { RecommendResponse } from '@/types'

export type TripDuration = '2h' | 'half-day' | 'full-day'

export interface RecommendFetchOptions {
  companion?: string
  trip_goal?: string
  transport?: string
  adult_count?: string
  child_count?: string
}

export function useRecommend() {
  const [data, setData] = useState<RecommendResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hydrate = useCallback((payload: RecommendResponse) => {
    setData(payload)
    setError(null)
    setLoading(false)
  }, [])

  const fetch = useCallback(
    async (city: string, duration: TripDuration = 'half-day', opts?: RecommendFetchOptions) => {
      setLoading(true)
      setError(null)
      try {
        const q = new URLSearchParams({
          city,
          top_n: '40',
          duration,
          companion: opts?.companion ?? 'solo',
          trip_goal: opts?.trip_goal ?? 'healing',
          transport: opts?.transport ?? 'car',
          adult_count: opts?.adult_count ?? '2',
          child_count: opts?.child_count ?? '0',
        })
        const res = await window.fetch(`/api/recommend?${q.toString()}`)
        if (!res.ok) throw new Error(`서버 오류 (${res.status})`)
        const json: RecommendResponse = await res.json()
        setData(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : '알 수 없는 오류')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { data, loading, error, fetch, hydrate }
}
