import type { CourseContinuationResponse, CourseStep, Destination, RecommendResponse } from '@/types'
import { reconfigureTagLabel, type ReconfigureTag } from '@/lib/reconfigureBias'

/**
 * /api/course 미리보기 결과를 메인 추천 코스(top_course)에 한 단계 append + recommendations 보강.
 */
export function commitReconfigureIntoRecommend(
  data: RecommendResponse,
  result: CourseContinuationResponse,
  tag: ReconfigureTag,
): RecommendResponse {
  const pick =
    result.next_places?.find(p => p.name === result.primary_recommendation?.name) ??
    result.next_places?.[0]
  const name = result.primary_recommendation?.name ?? pick?.name
  if (!name || !data.top_course?.steps?.length) return data

  const top = data.top_course
  const order = top.steps.length + 1
  const hintLabel = reconfigureTagLabel(tag)
  const stepLabel =
    (result.next_stage?.title && result.next_stage.title.slice(0, 28)) ||
    `다음 코스 (${hintLabel})`

  const whyLines = result.primary_recommendation?.why ?? []
  const newStep: CourseStep = {
    order,
    step_label: stepLabel,
    name,
    one_line:
      result.next_stage?.headline ||
      (whyLines[0] as string | undefined) ||
      `「${hintLabel}」흐름으로 이어진 코스예요.`,
    image: pick?.photo_url ?? undefined,
    address: pick?.address ?? result.primary_recommendation?.address ?? '',
    detail_intro: whyLines.filter(Boolean).join('\n'),
    detail_bullets: (result.alternatives ?? []).slice(0, 5).map(p => p.name),
    tag_labels: tag ? [`다시 짜기 · ${hintLabel}`] : ['다시 짜기'],
    rating: pick?.rating,
    review_count: pick?.review_count,
  }

  const newDest: Destination = {
    name: pick?.name ?? name,
    address: pick?.address ?? result.primary_recommendation?.address ?? '',
    tags: [],
    score: 0,
    weather_score: 0,
    distance_km: pick?.distance_from_prev_km ?? 0,
    copy: newStep.one_line,
    coords: pick ? { lat: pick.lat, lng: pick.lng } : undefined,
    image: pick?.photo_url ?? undefined,
    id: pick?.place_id,
    rating: pick?.rating,
    review_count: pick?.review_count,
  }

  const recommendations = [...(data.recommendations ?? [])]
  if (!recommendations.some(r => r.name === newDest.name)) recommendations.push(newDest)

  const pitchExtra = result.next_stage?.headline ? `\n${result.next_stage.headline}` : ''
  return {
    ...data,
    recommendations,
    top_course: {
      ...top,
      steps: [...top.steps, newStep],
      hero_name: name,
      hero_image: pick?.photo_url ?? top.hero_image,
      pitch: `${top.pitch}${pitchExtra}`.slice(0, 900),
      reasons: [
        `「${hintLabel}」방향으로 다음 장소를 코스에 반영했어요.`,
        ...(top.reasons ?? []).slice(0, 2),
      ],
    },
  }
}
