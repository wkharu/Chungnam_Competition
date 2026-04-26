import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Cloud, MapPin } from 'lucide-react'
import { useRecommendFromRoute } from '@/hooks/useRecommendFromRoute'
import { toResultQueryString } from '@/lib/tripParams'
import type { RecommendResponse } from '@/types'
import { APP_NAME } from '@/config/app'
import ServiceFooter from '@/components/ServiceFooter'
import { Button } from '@/components/ui/button'
import { saveConfirmedCourse } from '@/lib/confirmedCourseStorage'

function formatFcstTimeSlot(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = String(raw).replace(/\D/g, '')
  if (t.length === 4) return `${t.slice(0, 2)}:${t.slice(2)}`
  return raw
}

export default function MoreCoursesPage() {
  const navigate = useNavigate()
  const { form, data, loading, error } = useRecommendFromRoute()
  const qs = toResultQueryString(form)

  useEffect(() => {
    if (error) {
      document.title = `${APP_NAME} · 오류`
      return
    }
    if (loading && !data) {
      document.title = `${APP_NAME} · 다른 코스`
      return
    }
    if (data) {
      document.title = `${APP_NAME} · 비교 코스`
    }
  }, [error, data, loading])

  if (loading && !data) {
    return (
      <div className="min-h-dvh flex flex-col bg-slate-900 text-slate-400 text-sm items-center justify-center px-6">
        코스 목록을 불러오는 중…
      </div>
    )
  }
  if (error) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-destructive text-sm">
        {error}
        <Link to={`/?${qs}`} className="mt-4 text-foreground underline">
          홈으로
        </Link>
      </div>
    )
  }
  if (!data) return null

  const alts = data.alternative_courses ?? []
  const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  const fcstLabel = formatFcstTimeSlot(data.weather.fcst_time_slot)
  const weatherLine = [
    '단기예보',
    fcstLabel && `기준 ${fcstLabel}`,
    data.weather.sky_text,
    `${data.weather.temp}°`,
  ]
    .filter(Boolean)
    .join(' · ')

  const goCourse = (altId: string, payload: RecommendResponse) => {
    navigate(`/result/course?${qs}&altId=${encodeURIComponent(altId)}`, { state: { data: payload } })
  }

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-white max-w-lg mx-auto w-full overflow-x-hidden">
      <div className="pt-[max(0.35rem,env(safe-area-inset-top))] pl-1 pr-3 h-[3.15rem] flex items-center justify-between border-b border-white/10">
        <button
          type="button"
          onClick={() => navigate(`/result?${qs}`, { state: { data } })}
          className="inline-flex items-center gap-0.5 text-sm font-medium text-white/90 pl-1 py-2 pr-1"
        >
          <ArrowLeft className="w-4 h-4" />
          뒤로
        </button>
        <span className="text-sm font-bold tracking-tight text-white/95">비교해 볼 만한 코스</span>
        <span className="text-xs tabular-nums text-white/70 font-medium flex items-center gap-0.5">
          <Clock className="w-3.5 h-3.5 opacity-80" />
          {timeStr}
        </span>
      </div>
      <div className="px-4 py-2.5 border-b border-white/5 bg-slate-900/80">
        <p className="text-xs text-slate-300/95 leading-relaxed flex gap-1.5">
          <Cloud className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky-300/90" />
          {weatherLine}
        </p>
      </div>

      <div className="flex-1 bg-zinc-50 text-foreground rounded-t-2xl border-t border-white/10 px-4 pt-5 pb-8">
        {alts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            지금은 비교할 다른 코스가 없어요.
          </p>
        ) : (
          <div className="space-y-3">
            {alts.map((alt) => {
              const placeNames: string[] =
                alt.place_names?.length > 0
                  ? alt.place_names
                  : (alt.steps?.map(s => s.name).filter(Boolean) ?? [])
              return (
              <div
                key={alt.id}
                className="w-full text-left rounded-2xl border border-border/40 bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-bold text-foreground leading-snug">{alt.title}</p>
                {alt.one_liner ? (
                  <p className="text-xs text-foreground/75 mt-1.5 leading-relaxed">{alt.one_liner}</p>
                ) : null}
                <ul className="mt-2 space-y-1">
                  {placeNames.map((n) => (
                    <li
                      key={n}
                      className="text-xs text-foreground/90 flex items-start gap-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/80" />
                      {n}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-2 mt-3">
                  <Button
                    type="button"
                    className="w-full rounded-xl font-semibold"
                    onClick={() => {
                      const ok = saveConfirmedCourse({
                        resultQueryString: qs,
                        committedCourseAltId: alt.id,
                        recommendPayload: data,
                      })
                      if (!ok) {
                        window.alert('선택을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
                        return
                      }
                      navigate(`/?${qs}`)
                    }}
                  >
                    이 코스로 진행할게요
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl font-medium bg-white"
                    onClick={() => goCourse(alt.id, data)}
                  >
                    코스 상세히 보기
                  </Button>
                </div>
              </div>
              )
            })}
          </div>
        )}

        <div className="mt-8">
          <ServiceFooter />
        </div>
      </div>
    </div>
  )
}
