import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppOnboardingForm from '@/components/AppOnboardingForm'
import ConfirmedCourseHomeCard from '@/components/ConfirmedCourseHomeCard'
import ServiceFooter from '@/components/ServiceFooter'
import { loadConfirmedCourse } from '@/lib/confirmedCourseStorage'
import { Button } from '@/components/ui/button'
import { toRecommendQuery, toResultQueryString, tripFormFromSearchParams } from '@/lib/tripParams'
import type { TripFormState } from '@/lib/tripParams'
import type { RecommendResponse } from '@/types'
import { Loader2 } from 'lucide-react'
import { APP_NAME, APP_TAGLINE } from '@/config/app'

export default function HomePage() {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<TripFormState>(() => tripFormFromSearchParams(searchParams))
  const [pending, setPending] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirmedSnapshot, setConfirmedSnapshot] = useState(() => loadConfirmedCourse())
  const navigate = useNavigate()

  useEffect(() => {
    setForm(tripFormFromSearchParams(searchParams))
  }, [searchParams])

  useEffect(() => {
    const onConfirmed = () => setConfirmedSnapshot(loadConfirmedCourse())
    window.addEventListener('chungnam-confirmed-course-changed', onConfirmed)
    return () => window.removeEventListener('chungnam-confirmed-course-changed', onConfirmed)
  }, [])

  useEffect(() => {
    const c = loadConfirmedCourse()
    if (c?.resultQueryString && !searchParams.toString()) {
      navigate(`/?${c.resultQueryString}`, { replace: true })
    }
  }, [searchParams, navigate])

  useEffect(() => {
    document.title = `${APP_NAME} · 조건 선택`
  }, [])

  async function onCta() {
    setErr(null)
    setPending(true)
    try {
      const q = toRecommendQuery(form)
      const res = await window.fetch(`/api/recommend?${q}`)
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`)
      const data = (await res.json()) as RecommendResponse
      const back = toResultQueryString(form)
      navigate(`/result?${back}`, { state: { data } as { data: RecommendResponse } })
    } catch (e) {
      setErr(e instanceof Error ? e.message : '알 수 없는 오류')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900">
      {/* 1면 상단: 프로젝트(서비스) 제목 — 추천/날씨는 여기에 없음 */}
      <div className="pt-[max(1.25rem,env(safe-area-inset-top))] px-4 pb-4 text-center text-white">
        <div
          className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center text-lg font-black tracking-tight"
          aria-hidden
        >
          CN
        </div>
        <h1 className="text-[1.65rem] font-extrabold tracking-tight leading-tight">{APP_NAME}</h1>
        <p className="text-sm text-slate-300/90 mt-1.5 leading-relaxed px-1">{APP_TAGLINE}</p>
        <p className="text-[11px] text-slate-500 mt-2">아래를 선택한 뒤 맨 아래에서 제출하세요</p>
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-t-[1.5rem] bg-zinc-100 shadow-[0_-8px_32px_rgba(0,0,0,0.35)]">
        <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-4 pb-32">
          {confirmedSnapshot ? <ConfirmedCourseHomeCard confirmed={confirmedSnapshot} /> : null}
          <AppOnboardingForm value={form} onChange={setForm} />
          {err && (
            <p className="text-sm text-destructive mt-3 text-center" role="alert">
              {err}
            </p>
          )}
          <ServiceFooter />
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-zinc-100 via-zinc-100/98 to-zinc-100/0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto">
          <Button
            type="button"
            size="lg"
            className="w-full rounded-2xl text-base font-bold shadow-lg h-12 bg-slate-900 text-white hover:bg-slate-800"
            onClick={onCta}
            disabled={pending}
          >
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                코스를 준비해요…
              </span>
            ) : (
              '이 조건으로 코스 추천받기'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
