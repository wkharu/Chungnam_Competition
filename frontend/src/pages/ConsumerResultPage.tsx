import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Camera,
  Check,
  ChevronDown,
  Clock,
  Cloud,
  MapPin,
  TreePine,
} from 'lucide-react'
import { useRecommendFromRoute } from '@/hooks/useRecommendFromRoute'
import { toResultQueryString } from '@/lib/tripParams'
import type {
  AlternativeCourse,
  CourseSummary,
  RecommendResponse,
  ServiceNotice,
  TopCourse,
} from '@/types'
import { Button } from '@/components/ui/button'
import { getTheme } from '@/lib/weather'
import ServiceFooter from '@/components/ServiceFooter'
import { APP_NAME } from '@/config/app'
import { saveConfirmedCourse } from '@/lib/confirmedCourseStorage'

function formatFcstTimeSlot(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = String(raw).replace(/\D/g, '')
  if (t.length === 4) return `${t.slice(0, 2)}:${t.slice(2)}`
  return raw
}

function MiniScores({ scores, total }: { scores: RecommendResponse['scores']; total: number }) {
  const items = [
    { k: 'outdoor' as const, L: '야외', I: TreePine, c: 'bg-emerald-500' },
    { k: 'photo' as const, L: '사진', I: Camera, c: 'bg-violet-500' },
    { k: 'indoor' as const, L: '실내', I: Building2, c: 'bg-sky-500' },
  ]
  return (
    <div className="rounded-2xl border border-border/40 bg-white/70 p-3 text-left">
      <p className="text-[10px] text-muted-foreground mb-2">지역 기준 {total}곳</p>
      <div className="flex gap-2">
        {items.map(({ k, L, I, c }) => (
          <div key={k} className="flex-1 min-w-0">
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground mb-0.5">
              <I className="w-3 h-3" />
              {L}
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${c}`}
                style={{ width: `${Math.round(scores[k] * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ConsumerResultPage() {
  const navigate = useNavigate()
  const { form, data, loading, error } = useRecommendFromRoute()
  const [pitchOpen, setPitchOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [viewMode, setViewMode] = useState<'course' | 'places'>('course')
  const [now, setNow] = useState(() => new Date())
  const [commitErr, setCommitErr] = useState<string | null>(null)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (error) {
      document.title = `${APP_NAME} · 오류`
      return
    }
    if (loading && !data) {
      document.title = `${APP_NAME} · 추천 준비`
      return
    }
    if (data) {
      document.title = `${APP_NAME} · 오늘의 추천`
    }
  }, [error, data, loading])

  const qs = toResultQueryString(form)

  if (loading && !data) {
    return (
      <div className="min-h-dvh flex flex-col bg-slate-900">
        <div className="pt-[max(0.5rem,env(safe-area-inset-top))] px-4 h-12 flex items-center">
          <span className="text-white/50 text-sm font-medium">{APP_NAME}</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm px-6 text-center">
          날씨와 동선을 맞춰 코스를 세우고 있어요…
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-200">
        <div className="pt-[max(0.5rem,env(safe-area-inset-top))] px-4 h-12 flex items-center border-b border-white/10">
          <span className="text-sm font-medium text-white/80">{APP_NAME}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
          <Link
            to={`/?${qs}`}
            className="mt-5 text-sm font-semibold text-amber-300/95 underline"
          >
            홈에서 다시 시도
          </Link>
        </div>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="min-h-dvh flex flex-col bg-slate-900">
        <div className="pt-[max(0.5rem,env(safe-area-inset-top))] px-4 h-12 flex items-center">
          <span className="text-white/50 text-sm font-medium">{APP_NAME}</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm px-6 text-center">
          화면을 준비하고 있어요…
        </div>
      </div>
    )
  }

  const theme = getTheme(data.weather.sky, data.weather.precip_prob)
  const areaTint =
    theme === 'rainy' ? 'from-slate-200 to-slate-100' : theme === 'cloudy' ? 'from-zinc-200 to-zinc-50' : 'from-amber-100/90 to-amber-50/50'
  const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  const fcstLabel = formatFcstTimeSlot(data.weather.fcst_time_slot)
  const weatherLine = [
    '단기예보',
    fcstLabel && `기준 ${fcstLabel}`,
    data.weather.sky_text,
    `${data.weather.temp}°`,
    `강수 ${data.weather.precip_prob}%`,
  ]
    .filter(Boolean)
    .join(' · ')

  const summary: CourseSummary | undefined = data.summary
  const topCourse: TopCourse | undefined = data.top_course
  const notice: ServiceNotice | undefined = data.notice
  const alternativeCourses: AlternativeCourse[] = data.alternative_courses ?? []

  if (!topCourse) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-4 bg-slate-950 text-slate-100">
        <p className="text-sm text-center text-slate-300/95">
          지금은 코스를 꾸리지 못했어요. 조건을 바꿔 다시 시도해 주세요.
        </p>
        <Link
          to={`/?${qs}`}
          className="mt-4 text-sm font-semibold text-amber-300/95 underline"
        >
          홈에서 다시 제출
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-white max-w-lg mx-auto w-full overflow-x-hidden">
      <div className="pt-[max(0.35rem,env(safe-area-inset-top))] pl-1 pr-3 h-[3.15rem] flex items-center justify-between border-b border-white/10">
        <Link
          to={`/?${qs}`}
          className="inline-flex items-center gap-0.5 text-sm font-medium text-white/90 pl-1 py-2 pr-1"
        >
          <ArrowLeft className="w-4 h-4" />
          뒤로
        </Link>
        <span className="text-sm font-bold tracking-tight text-white/95">오늘의 추천</span>
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
        <p className="text-[10px] text-slate-500/95 mt-1.5 pl-[1.35rem] leading-relaxed">
          {APP_NAME}는 단기 날씨·이동·일정·동행을 규칙으로 맞추고, 장소 후보에는 있을 경우{' '}
          <strong className="text-slate-400 font-semibold">Google Places 평점·리뷰 수</strong>도
          참고합니다. 리뷰 본문은 연동하지 않습니다.
        </p>
      </div>

      <div className="flex-1 min-h-0 text-foreground rounded-t-2xl bg-zinc-50 border-t border-white/10">
        <header
          className={`text-center pt-5 pb-3 px-4 max-w-lg mx-auto bg-gradient-to-b ${areaTint} border-b border-black/[0.04] rounded-t-2xl`}
        >
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {summary?.headline ?? '오늘의 추천 코스'}
        </h1>
        <p className="text-sm text-foreground/80 mt-2 leading-relaxed">
          {summary?.one_liner ?? data.today_course_pitch?.split('\n')[0] ?? '가볍게 다녀오기 좋은 코스예요.'}
        </p>
        {!!summary?.badges?.length && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-3">
            {summary.badges.map(b => (
              <span
                key={b.key}
                className="text-[11px] font-medium bg-white/80 border border-border/50 px-2.5 py-1 rounded-full text-foreground/85 shadow-sm"
              >
                {b.value}
              </span>
            ))}
          </div>
        )}
        </header>

        {topCourse && (
        <section className="max-w-lg mx-auto px-4">
          <div className="rounded-3xl overflow-hidden bg-white border border-border/30 shadow-sm">
            {topCourse.hero_image ? (
              <div className="aspect-[16/9] w-full bg-zinc-100">
                <img
                  src={topCourse.hero_image}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            ) : null}
            <div className="p-4 sm:p-5">
              <p className="text-xs font-medium text-primary mb-0.5">{topCourse.title}</p>
              {topCourse.hero_name && (
                <h2 className="text-lg font-bold text-foreground leading-tight">
                  {topCourse.hero_name}
                </h2>
              )}
              {topCourse.pitch && topCourse.pitch !== summary?.one_liner && (
                <p
                  className={`text-sm text-foreground/75 mt-2 leading-relaxed ${
                    pitchOpen ? '' : 'line-clamp-2'
                  }`}
                >
                  {topCourse.pitch}
                </p>
              )}
              {topCourse.pitch && (topCourse.pitch.length > 100 || (topCourse.pitch.split('\n').length ?? 0) > 2) && (
                <button
                  type="button"
                  onClick={() => setPitchOpen(p => !p)}
                  className="text-xs font-medium text-primary mt-1"
                >
                  {pitchOpen ? '접기' : '더 읽기'}
                </button>
              )}

              <p className="text-sm font-semibold text-foreground mt-5 mb-2">
                {topCourse.reasons_title}
              </p>
              <ul className="space-y-2">
                {topCourse.reasons.slice(0, 3).map((r, i) => (
                  <li
                    key={i}
                    className="text-sm text-foreground/85 pl-1 flex gap-2.5"
                  >
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
              {topCourse.reason_tags && topCourse.reason_tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {topCourse.reason_tags.map(tag => (
                    <span
                      key={tag}
                      className="text-[10px] font-medium bg-white border border-border/55 text-foreground/75 px-2 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {(topCourse.estimated_duration ||
                topCourse.movement_burden ||
                topCourse.weather_fit) && (
                <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                  {[
                    topCourse.estimated_duration && `일정 ${topCourse.estimated_duration}`,
                    topCourse.movement_burden,
                    topCourse.weather_fit,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}

              <div className="mt-5 pt-4 border-t border-border/40">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  {viewMode === 'course' ? '오늘의 동선' : '장소별로 보기'}
                </p>
                {viewMode === 'course' ? (
                  <ol className="space-y-0 border-l-2 border-primary/25 pl-3 ml-0.5">
                    {topCourse.steps.map((s) => (
                      <li
                        key={s.order}
                        className="pb-4 last:pb-0 relative -left-0.5 pl-0"
                      >
                        <div className="absolute -left-[1.1rem] top-0.5 w-3.5 h-3.5 rounded-full bg-primary text-[10px] text-primary-foreground font-bold flex items-center justify-center">
                          {s.order}
                        </div>
                        <p className="text-xs font-bold text-primary/90">{s.step_label}</p>
                        <p className="text-base font-bold text-foreground leading-snug">{s.name}</p>
                        {s.one_line && (
                          <p className="text-xs text-muted-foreground mt-0.5">{s.one_line}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="space-y-3">
                    {topCourse.steps.map((s) => (
                      <div
                        key={s.order}
                        className="rounded-2xl border border-border/45 bg-zinc-50/90 px-3 py-3 text-left"
                      >
                        <p className="text-[10px] font-bold text-primary/90">{s.step_label}</p>
                        <p className="text-sm font-bold text-foreground mt-0.5">{s.name}</p>
                        {s.address ? (
                          <p className="text-[10px] text-muted-foreground mt-1 flex gap-1">
                            <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                            {s.address}
                          </p>
                        ) : null}
                        {s.one_line ? (
                          <p className="text-xs text-foreground/80 mt-2 leading-relaxed">{s.one_line}</p>
                        ) : null}
                        {s.detail_intro ? (
                          <p className="text-xs text-foreground/75 mt-2 leading-relaxed whitespace-pre-wrap">
                            {s.detail_intro}
                          </p>
                        ) : null}
                        {s.detail_bullets && s.detail_bullets.length > 0 && (
                          <ul className="mt-2 space-y-1 text-xs text-foreground/80">
                            {s.detail_bullets.map((b, j) => (
                              <li key={j} className="flex gap-2 pl-0.5">
                                <span className="text-primary shrink-0">·</span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {s.tag_labels && s.tag_labels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {s.tag_labels.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] bg-white border border-border/55 px-2 py-0.5 rounded-full text-foreground/75"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {(s.review_count ?? 0) > 0 || (s.rating ?? 0) > 0 ? (
                          <p className="text-[11px] text-foreground/70 mt-2">
                            평점 {(s.rating ?? 0).toFixed(1)} · 리뷰 {(s.review_count ?? 0).toLocaleString()}건
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div id="before-visit" className="mt-4 rounded-2xl bg-amber-50/80 border border-amber-100/80 px-3 py-2.5 text-xs text-foreground/85">
                방문 전 운영시간을 확인해 주세요. 일부 정보는 실제와 다를 수 있어요.
              </div>

              {commitErr && (
                <p className="text-sm text-destructive mt-3" role="alert">
                  {commitErr}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button
                  type="button"
                  className="rounded-2xl font-semibold flex-1"
                  onClick={() => {
                    setCommitErr(null)
                    const ok = saveConfirmedCourse({
                      resultQueryString: qs,
                      committedCourseAltId: null,
                      recommendPayload: data,
                    })
                    if (!ok) {
                      setCommitErr('선택을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
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
                  className="rounded-2xl font-semibold flex-1 bg-white"
                  onClick={() => setShowAlternatives(true)}
                >
                  다른 코스도 볼까요?
                </Button>
              </div>
              <div className="mt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full rounded-2xl font-medium"
                  onClick={() => navigate(`/result/course?${qs}`, { state: { data } })}
                >
                  코스 상세히 보기
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl font-medium flex-1 bg-white text-foreground border-dashed"
                  onClick={() => setViewMode((m) => (m === 'course' ? 'places' : 'course'))}
                >
                  {viewMode === 'course' ? '장소별로 다시 보기' : '코스 한눈에 보기'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-2xl font-medium flex-1"
                  onClick={() =>
                    navigate(`/result/reconfigure?${qs}`, { state: { data } })
                  }
                >
                  이 코스 기준으로 다시 짜기
                </Button>
              </div>
            </div>
          </div>
        </section>
        )}

        {showAlternatives && alternativeCourses.length > 0 && (
          <section className="max-w-lg mx-auto px-4 mt-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-foreground">다른 코스도 볼까요?</h3>
              <button
                type="button"
                onClick={() => setShowAlternatives(false)}
                className="text-xs font-medium text-muted-foreground shrink-0"
              >
                접기
              </button>
            </div>
            <div className="space-y-3">
              {alternativeCourses.map((alt) => (
                <div
                  key={alt.id}
                  className="w-full text-left rounded-2xl border border-border/40 bg-white p-4 shadow-sm"
                >
                  <p className="text-sm font-bold text-foreground leading-snug">{alt.title}</p>
                  {alt.one_liner ? (
                    <p className="text-xs text-foreground/75 mt-1.5 leading-relaxed">{alt.one_liner}</p>
                  ) : null}
                  <ul className="mt-2 space-y-1">
                    {(alt.place_names?.length
                      ? alt.place_names
                      : (alt.steps?.map((s) => s.name).filter(Boolean) ?? [])
                    ).map((n) => (
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
                        setCommitErr(null)
                        const ok = saveConfirmedCourse({
                          resultQueryString: qs,
                          committedCourseAltId: alt.id,
                          recommendPayload: data,
                        })
                        if (!ok) {
                          setCommitErr('선택을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
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
                      onClick={() =>
                        navigate(`/result/course?${qs}&altId=${encodeURIComponent(alt.id)}`, {
                          state: { data },
                        })
                      }
                    >
                      코스 상세히 보기
                    </Button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => navigate(`/result/more?${qs}`, { state: { data } })}
                className="w-full text-center text-xs font-semibold text-primary py-2"
              >
                전체 화면에서 더 보기
              </button>
            </div>
          </section>
        )}

      <div className="max-w-lg mx-auto px-4 mt-6">
        <button
          type="button"
          onClick={() => setMoreOpen(o => !o)}
          className="w-full text-left text-xs font-medium text-muted-foreground flex items-center justify-between py-2"
        >
          <span>추가 정보 & 안내</span>
          <ChevronDown className={`w-4 h-4 transition ${moreOpen ? 'rotate-180' : ''}`} />
        </button>
        {moreOpen && (
          <div className="space-y-3 text-xs text-muted-foreground">
            {notice && (
              <>
                <p className="text-foreground/80">{notice.disclaimer}</p>
                <ul className="list-disc pl-4 space-y-1">
                  {notice.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </>
            )}
            <MiniScores scores={data.scores} total={data.total_fetched} />
          </div>
        )}
      </div>
      </div>

      <div className="bg-zinc-50 max-w-lg mx-auto w-full">
        <ServiceFooter />
      </div>
      <div className="pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-zinc-50" />
    </div>
  )
}
