import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ConfirmedCourseState } from '@/lib/confirmedCourseStorage'
import { clearConfirmedCourse } from '@/lib/confirmedCourseStorage'
import { recommendPayloadWithCommittedAsTop } from '@/lib/recommendPayloadForCommitted'
import { resolveTopCourseForDetail } from '@/lib/resolveTopCourse'
import { Button } from '@/components/ui/button'
import { MapPin } from 'lucide-react'

interface Props {
  confirmed: ConfirmedCourseState
}

export default function ConfirmedCourseHomeCard({ confirmed }: Props) {
  const navigate = useNavigate()
  const qs = confirmed.resultQueryString

  const top = useMemo(
    () => resolveTopCourseForDetail(confirmed.recommendPayload, confirmed.committedCourseAltId),
    [confirmed.recommendPayload, confirmed.committedCourseAltId],
  )

  if (!top) return null

  const stepsPreview = top.steps.slice(0, 3).map(s => s.name)
  const altQ =
    confirmed.committedCourseAltId != null
      ? `&altId=${encodeURIComponent(confirmed.committedCourseAltId)}`
      : ''

  const payloadForFlow = recommendPayloadWithCommittedAsTop(
    confirmed.recommendPayload,
    confirmed.committedCourseAltId,
  )

  return (
    <section className="mb-5 rounded-2xl border border-emerald-200/80 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-2.5">
        <p className="text-[11px] font-semibold text-emerald-50/95 uppercase tracking-wide">
          내가 고른 오늘의 코스
        </p>
        <p className="text-sm font-bold text-white mt-0.5 leading-snug">{top.title}</p>
      </div>
      <div className="px-4 py-3 space-y-2 text-sm text-foreground/90">
        <ol className="space-y-1.5">
          {stepsPreview.map((name, i) => (
            <li key={`${name}-${i}`} className="flex gap-2 text-xs">
              <span className="font-bold text-primary w-5 shrink-0">{i + 1}</span>
              <span className="flex gap-1 min-w-0">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/80" />
                <span className="leading-relaxed">{name}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
          {[top.estimated_duration && `예상 ${top.estimated_duration}`, top.movement_burden, top.weather_fit]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            className="w-full rounded-xl font-semibold"
            onClick={() =>
              navigate(`/result/course?${qs}${altQ}`, { state: { data: confirmed.recommendPayload } })
            }
          >
            이 코스 이어서 보기
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full rounded-xl font-semibold"
            onClick={() => navigate(`/result/reconfigure?${qs}`, { state: { data: payloadForFlow } })}
          >
            코스 수정하기
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl font-medium"
            onClick={() => {
              clearConfirmedCourse()
            }}
          >
            다시 추천받기
          </Button>
        </div>
      </div>
    </section>
  )
}
