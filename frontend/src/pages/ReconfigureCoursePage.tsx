import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2, MapPin } from 'lucide-react'
import type { CourseContinuationResponse, RecommendResponse } from '@/types'
import { buildCourseUrl, fetchCoursePayload } from '@/lib/courseClient'
import { commitReconfigureIntoRecommend } from '@/lib/commitReconfigureCourse'
import { reconfigureContextForTag, type ReconfigureTag } from '@/lib/reconfigureBias'
import {
  categoryForPlaceName,
  coordsForPlaceName,
  FALLBACK_COORDS,
  rowForPlaceName,
} from '@/lib/recommendGeo'
import { toResultQueryString, tripFormFromSearchParams } from '@/lib/tripParams'
import { Button } from '@/components/ui/button'
import ServiceFooter from '@/components/ServiceFooter'
import { APP_NAME } from '@/config/app'

const HINTS: { label: string; value: Exclude<ReconfigureTag, ''> }[] = [
  { label: '식사 중심', value: 'meal' },
  { label: '카페·휴식', value: 'cafe' },
  { label: '실내 위주', value: 'indoor' },
  { label: '사진·뷰', value: 'photo' },
  { label: '아이 동반', value: 'kids' },
]

export default function ReconfigureCoursePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const form = useMemo(() => tripFormFromSearchParams(searchParams), [searchParams])
  const qs = toResultQueryString(form)

  const data = (location.state as { data?: RecommendResponse } | null)?.data ?? null
  const top = data?.top_course
  const baselineRef = useRef<RecommendResponse | null>(null)
  if (data && baselineRef.current === null) {
    baselineRef.current = JSON.parse(JSON.stringify(data)) as RecommendResponse
  }

  const [hint, setHint] = useState<ReconfigureTag>('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<CourseContinuationResponse | null>(null)

  useEffect(() => {
    document.title = `${APP_NAME} · 코스 다시 짜기`
  }, [])

  useEffect(() => {
    if (!data || !top?.steps?.length) {
      navigate(`/?${qs}`, { replace: true })
    }
  }, [data, top, navigate, qs])

  if (!data || !top?.steps?.length) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        이동 중…
      </div>
    )
  }

  const lastStep = top.steps[top.steps.length - 1]
  const coords =
    coordsForPlaceName(data, lastStep.name) ?? FALLBACK_COORDS
  const category = categoryForPlaceName(data, lastStep.name)
  const row = rowForPlaceName(data, lastStep.name)
  const hour = new Date().getHours()

  async function runReconfigure() {
    if (!data || !top?.steps?.length) return
    setErr(null)
    setLoading(true)
    setResult(null)
    try {
      const biasCtx = reconfigureContextForTag(hint)
      const ctx = {
        weather: data.weather,
        duration: form.tripDuration,
        companion: form.companion,
        trip_goal: form.tripGoal,
        transport: form.transport,
        adult_count: form.adultCount,
        child_count: form.childCount,
        coursePath: 'ai' as const,
        spotName: lastStep.name,
        spotId: row?.id,
        mlNextSceneAssist: true,
        ...biasCtx,
      }
      if (import.meta.env.DEV) {
        const url = buildCourseUrl(coords.lat, coords.lng, category, hour, ctx)
        // eslint-disable-next-line no-console
        console.debug('[reconfigure] /api/course', url, { tag: hint || '(none)', ctx })
      }
      const payload = await fetchCoursePayload(coords.lat, coords.lng, category, hour, ctx)
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[reconfigure] course_control', payload.course_control)
      }
      setResult(payload)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '요청에 실패했어요.')
    } finally {
      setLoading(false)
    }
  }

  const refinedNote =
    result?.ml_next_scene?.model_used === true
      ? '다음 흐름을 조금 더 세밀하게 맞춰 봤어요.'
      : null

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-white max-w-lg mx-auto w-full">
      <div className="pt-[max(0.35rem,env(safe-area-inset-top))] pl-1 pr-3 h-[3.15rem] flex items-center justify-between border-b border-white/10">
        <button
          type="button"
          onClick={() => navigate(`/result?${qs}`, { state: { data } })}
          className="inline-flex items-center gap-0.5 text-sm font-medium text-white/90 pl-1 py-2 pr-1"
        >
          <ArrowLeft className="w-4 h-4" />
          뒤로
        </button>
        <span className="text-sm font-bold text-white/95">코스 다시 짜기</span>
        <span className="w-10" />
      </div>

      <div className="flex-1 bg-zinc-50 text-foreground px-4 py-5 pb-28">
        <p className="text-sm text-foreground/85 leading-relaxed">
          지금 보신 코스의 마지막 지점(
          <strong className="text-foreground">{lastStep.name}</strong>)을 기준으로, 다음에 이어갈
          흐름을 다시 맞춰 볼게요.
        </p>

        <p className="text-xs font-semibold text-muted-foreground mt-5 mb-2">어떤 쪽으로 바꿔볼까요?</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setHint('')}
            className={`text-xs font-medium px-3 py-2 rounded-full border transition ${
              hint === ''
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-foreground/80 border-border/60'
            }`}
          >
            지금 흐름에 맡기기
          </button>
          {HINTS.map(h => (
            <button
              key={h.value}
              type="button"
              onClick={() => setHint(h.value)}
              className={`text-xs font-medium px-3 py-2 rounded-full border transition ${
                hint === h.value
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-foreground/80 border-border/60'
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>

        <Button
          type="button"
          className="w-full mt-6 rounded-2xl font-semibold"
          disabled={loading}
          onClick={() => void runReconfigure()}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              다음 단계를 불러오는 중…
            </span>
          ) : (
            '다음 단계 다시 추천받기'
          )}
        </Button>

        {err && (
          <p className="text-sm text-destructive mt-4" role="alert">
            {err}
          </p>
        )}

        {result && (
          <div className="mt-8 space-y-4 rounded-2xl border border-border/40 bg-white p-4 shadow-sm">
            {refinedNote && (
              <p className="text-xs font-medium text-primary">{refinedNote}</p>
            )}
            <div>
              <p className="text-[10px] font-bold text-primary/90 uppercase tracking-wide">
                이어갈 흐름
              </p>
              <p className="text-base font-bold text-foreground mt-0.5">{result.next_stage?.title}</p>
              {result.next_stage?.headline ? (
                <p className="text-sm text-foreground/75 mt-1">{result.next_stage.headline}</p>
              ) : null}
            </div>
            {result.primary_recommendation?.name && (
              <div className="rounded-xl border border-border/50 bg-zinc-50/80 px-3 py-3">
                <p className="text-[10px] font-semibold text-muted-foreground">다음으로 가볼 만한 곳</p>
                <p className="text-sm font-bold text-foreground mt-1">
                  {result.primary_recommendation.name}
                </p>
                {result.primary_recommendation.address ? (
                  <p className="text-xs text-muted-foreground mt-1 flex gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {result.primary_recommendation.address}
                  </p>
                ) : null}
              </div>
            )}
            {result.alternatives && result.alternatives.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">함께 볼 만한 후보</p>
                <ul className="space-y-2">
                  {result.alternatives.slice(0, 5).map(p => (
                    <li key={`${p.name}-${p.lat}`} className="text-xs flex gap-1.5 text-foreground/90">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-primary/80" />
                      {p.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                className="w-full rounded-2xl font-semibold"
                onClick={() => {
                  const merged = commitReconfigureIntoRecommend(data, result, hint)
                  navigate(`/result?${qs}`, { state: { data: merged } })
                }}
              >
                이 코스로 반영하기
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full rounded-2xl font-semibold"
                disabled={loading}
                onClick={() => void runReconfigure()}
              >
                다시 추천받기
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-2xl font-semibold"
                onClick={() =>
                  navigate(`/result?${qs}`, {
                    state: { data: baselineRef.current ?? data },
                  })
                }
              >
                취소하고 원래 코스로 돌아가기
              </Button>
            </div>
          </div>
        )}

        <div className="mt-10">
          <ServiceFooter />
        </div>
      </div>
    </div>
  )
}
