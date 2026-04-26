import type { CourseFetchContext } from '@/lib/courseClient'

export type ReconfigureTag = '' | 'meal' | 'cafe' | 'indoor' | 'photo' | 'kids'

const TAG_LABEL: Record<Exclude<ReconfigureTag, ''>, string> = {
  meal: '식사 중심',
  cafe: '카페·휴식',
  indoor: '실내 위주',
  photo: '사진·뷰',
  kids: '아이 동반',
}

export function reconfigureTagLabel(tag: ReconfigureTag): string {
  if (!tag) return '지금 흐름'
  return TAG_LABEL[tag]
}

/** 태그 → /api/course 쿼리(단계 고정 + 랭킹 바이어스) */
export function reconfigureContextForTag(tag: ReconfigureTag): Partial<CourseFetchContext> {
  if (!tag) {
    return {
      mealBias: 0,
      cafeBias: 0,
      indoorBias: 0,
      scenicBias: 0,
      familyBias: 0,
    }
  }
  switch (tag) {
    case 'meal':
      return {
        userNextHint: 'meal',
        desiredNextScene: 'meal',
        mealBias: 1,
        cafeBias: 0.08,
        indoorBias: 0,
        scenicBias: 0,
        familyBias: 0.2,
        desiredCourseStyle: 'meal_focus',
      }
    case 'cafe':
      return {
        userNextHint: 'cafe',
        desiredNextScene: 'cafe_rest',
        mealBias: 0.06,
        cafeBias: 1,
        indoorBias: 0,
        scenicBias: 0,
        familyBias: 0,
        desiredCourseStyle: 'cafe_rest_focus',
      }
    case 'indoor':
      return {
        userNextHint: 'indoor',
        desiredNextScene: 'indoor_backup',
        mealBias: 0,
        cafeBias: 0,
        indoorBias: 1,
        scenicBias: 0,
        familyBias: 0.15,
        desiredCourseStyle: 'indoor_focus',
      }
    case 'photo':
      return {
        userNextHint: 'photo',
        desiredNextScene: 'sunset_finish',
        mealBias: 0,
        cafeBias: 0,
        indoorBias: 0,
        scenicBias: 1,
        familyBias: 0,
        desiredCourseStyle: 'scenic_focus',
      }
    case 'kids':
      return {
        userNextHint: 'kids',
        desiredNextScene: 'meal',
        mealBias: 0.4,
        cafeBias: 0.2,
        indoorBias: 0.25,
        scenicBias: 0.25,
        familyBias: 1,
        desiredCourseStyle: 'family_focus',
      }
    default:
      return {}
  }
}
