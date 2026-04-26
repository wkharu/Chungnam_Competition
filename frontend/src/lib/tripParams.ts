import type { TripDuration, RecommendFetchOptions } from '@/hooks/useRecommend'

export interface TripFormState {
  city: string
  tripDuration: TripDuration
  companion: string
  tripGoal: string
  transport: string
  adultCount: string
  childCount: string
}

const DUR: TripDuration[] = ['2h', 'half-day', 'full-day']

function parseDuration(raw: string | null): TripDuration {
  if (raw && DUR.includes(raw as TripDuration)) return raw as TripDuration
  return 'half-day'
}

export function tripFormFromSearchParams(sp: URLSearchParams): TripFormState {
  const companion = sp.get('companion')?.trim() || 'solo'
  const solo = companion === 'solo'
  return {
    city: sp.get('city')?.trim() || '전체',
    tripDuration: parseDuration(sp.get('duration')),
    companion,
    tripGoal: sp.get('trip_goal')?.trim() || 'healing',
    transport: sp.get('transport')?.trim() || 'car',
    adultCount: solo ? '1' : sp.get('adult_count')?.trim() || '2',
    childCount: solo ? '0' : sp.get('child_count')?.trim() || '0',
  }
}

export function toResultQueryString(f: TripFormState): string {
  return new URLSearchParams({
    city: f.city,
    duration: f.tripDuration,
    companion: f.companion,
    trip_goal: f.tripGoal,
    transport: f.transport,
    adult_count: f.adultCount,
    child_count: f.childCount,
  }).toString()
}

export function toRecommendOptions(f: TripFormState): RecommendFetchOptions {
  return {
    companion: f.companion,
    trip_goal: f.tripGoal,
    transport: f.transport,
    adult_count: f.adultCount,
    child_count: f.childCount,
  }
}

export function toRecommendQuery(f: TripFormState): string {
  const p = new URLSearchParams({
    city: f.city,
    top_n: '40',
    duration: f.tripDuration,
    companion: f.companion,
    trip_goal: f.tripGoal,
    transport: f.transport,
    adult_count: f.adultCount,
    child_count: f.childCount,
  })
  return p.toString()
}
