import { useState } from 'react'
import { MapPin, Star, ChevronRight } from 'lucide-react'
import { getPlaceEmoji } from '@/lib/weather'
import type { Destination } from '@/types'

interface Props {
  destination: Destination
  rank: number
  onNextCourse?: (d: Destination) => void
  isSelected?: boolean
  /** API 루트 `today_course_pitch` — 1위 카드에만 전달 */
  todayCoursePitch?: string | null
}

export default function DestinationCard({ destination: d, rank, onNextCourse, isSelected, todayCoursePitch }: Props) {
  const isFeatured = rank === 1
  return isFeatured
    ? <FeaturedCard destination={d} onNextCourse={onNextCourse} isSelected={isSelected} todayCoursePitch={todayCoursePitch} />
    : <CompactCard destination={d} rank={rank} onNextCourse={onNextCourse} isSelected={isSelected} />
}

/* ── 1위: 큰 히어로 카드 ─────────────────────────────────────────── */
function FeaturedCard({
  destination: d,
  onNextCourse,
  isSelected,
  todayCoursePitch,
}: {
  destination: Destination
  onNextCourse?: (d: Destination) => void
  isSelected?: boolean
  todayCoursePitch?: string | null
}) {
  const [imgError, setImgError] = useState(false)
  const emoji = getPlaceEmoji(d.tags)
  const score = d.total_score_100 ?? Math.round(d.score * 100)
  const axes = d.score_axis_display ?? []
  const bullets = d.why_recommend_bullets?.length
    ? d.why_recommend_bullets
    : (d.concise_explanation_lines ?? d.why ?? []).slice(0, 3)
  const pi = d.practical_info
  const conclusion = d.decision_conclusion ?? '오늘 가기 좋아요'
  const sum1 = d.place_identity_summary?.trim() || d.place_identity?.trim() || d.lead_weather_sentence || ''
  const sum2 = d.why_today_narrative?.trim() || d.lead_place_sentence || ''
  const expectPts = (d.expectation_points && d.expectation_points.length > 0)
    ? d.expectation_points
    : (d.expectation_bullets && d.expectation_bullets.length > 0)
      ? d.expectation_bullets
      : []

  return (
    <div className={`relative rounded-3xl overflow-hidden shadow-lg mb-2 transition-all ${
      isSelected ? 'ring-2 ring-primary' : 'active:scale-[0.99]'
    }`}>
      {/* 배경 이미지 */}
      {d.image && !imgError ? (
        <img
          src={d.image}
          alt={d.name}
          loading="lazy"
          onError={() => setImgError(true)}
          className="w-full h-64 object-cover"
        />
      ) : (
        <div className="w-full h-64 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-7xl">
          {emoji}
        </div>
      )}

      {/* 그라데이션 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* TOP 1 뱃지 */}
      <div className="absolute top-4 left-4 flex items-center gap-1 bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
        <Star className="w-3 h-3 fill-current" />
        오늘의 1위
      </div>

      {/* 하단 텍스트 */}
      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {d.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] bg-white/20 backdrop-blur-sm border border-white/20 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>
        <h2 className="text-xl font-bold leading-tight mb-1">{d.name}</h2>
        <p className="text-[11px] font-semibold text-emerald-200 mb-1.5">{conclusion}</p>
        <div className="flex items-center gap-1 text-xs opacity-80 mb-2">
          <MapPin className="w-3 h-3" />
          {d.address}
        </div>
        {sum1 ? (
          <p className="text-[10px] opacity-95 leading-snug mb-1 font-medium">{sum1}</p>
        ) : null}
        {todayCoursePitch && todayCoursePitch.trim() ? (
          <p className="text-[10px] opacity-90 leading-relaxed mb-2 whitespace-pre-line border-l-2 border-white/35 pl-2.5">
            {todayCoursePitch.trim()}
          </p>
        ) : null}
        {sum2 ? (
          <p className="text-[10px] opacity-88 leading-snug mb-2">{sum2}</p>
        ) : null}
        {pi?.mobility_line_distance || pi?.mobility_line_drive ? (
          <div className="text-[10px] opacity-75 leading-snug mb-2 space-y-0.5">
            {pi.mobility_line_distance ? <p>{pi.mobility_line_distance}</p> : null}
            {pi.mobility_line_drive ? <p>{pi.mobility_line_drive}</p> : null}
          </div>
        ) : pi?.mobility_line ? (
          <p className="text-[10px] opacity-75 leading-snug mb-2">{pi.mobility_line}</p>
        ) : null}
        {pi?.duration_fit_line ? (
          <p className="text-[10px] opacity-80 leading-snug mb-2">{pi.duration_fit_line}</p>
        ) : null}
        <p className="text-[10px] font-bold opacity-95 mb-1">왜 추천했나요?</p>
        <ul className="text-[10px] opacity-88 leading-snug mb-2 pl-3 list-disc space-y-0.5">
          {bullets.slice(0, 3).map(line => (
            <li key={line.slice(0, 48)}>{line}</li>
          ))}
        </ul>
        {expectPts.length > 0 ? (
          <>
            <p className="text-[10px] font-bold opacity-95 mb-1">기대해도 좋은 점</p>
            <ul className="text-[10px] opacity-88 leading-snug mb-2 pl-3 list-disc space-y-0.5">
              {expectPts.slice(0, 3).map(line => (
                <li key={line.slice(0, 48)}>{line}</li>
              ))}
            </ul>
          </>
        ) : null}
        {(d.story_summary || d.emotional_copy) && (d.storytelling_match_confidence ?? 0) >= 0.35 ? (
          <p className="text-[10px] opacity-75 italic leading-snug mb-2 border-l-2 border-white/40 pl-2">
            {d.emotional_copy?.trim() || d.story_summary?.trim()}
          </p>
        ) : !sum1 && d.copy ? (
          <p className="text-[10px] opacity-70 line-clamp-2 mb-2">{d.copy}</p>
        ) : null}
        {(d.why_detailed && d.why_detailed.length > 0) || axes.length > 0 ? (
          <details className="text-[10px] opacity-85 mb-2">
            <summary className="cursor-pointer font-semibold">추천 근거 자세히 보기</summary>
            <p className="mt-1.5 text-[9px] opacity-70">내부 참고 점수 {score} · 세부 축</p>
            {axes.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {axes.map(ax => (
                  <li key={ax.key}>
                    {ax.label} {ax.earned}/{ax.max}
                  </li>
                ))}
              </ul>
            ) : null}
            {d.why_detailed && d.why_detailed.length > 0 ? (
              <ul className="mt-1 pl-3 list-disc space-y-0.5">
                {d.why_detailed.map(x => (
                  <li key={x.slice(0, 32)}>{x}</li>
                ))}
              </ul>
            ) : null}
          </details>
        ) : null}
        {d.caution_lines && d.caution_lines.length > 0 ? (
          <div className="text-[9px] opacity-70 leading-snug mb-2 space-y-0.5">
            <p className="font-semibold opacity-85">출발 전 확인</p>
            {d.caution_lines.slice(0, 2).map(c => (
              <p key={c.slice(0, 40)}>· {c}</p>
            ))}
          </div>
        ) : null}

        {/* 다음 코스 버튼 */}
        {onNextCourse && (
          <button
            type="button"
            onClick={() => onNextCourse(d)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm
                       border border-white/30 text-white text-xs font-semibold
                       px-3 py-1.5 rounded-full transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            코스 이어가기
          </button>
        )}
      </div>
    </div>
  )
}

/* ── 2위~: 가로형 컴팩트 카드 ────────────────────────────────────── */
function CompactCard({
  destination: d,
  rank,
  onNextCourse,
  isSelected,
}: {
  destination: Destination
  rank: number
  onNextCourse?: (d: Destination) => void
  isSelected?: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const emoji = getPlaceEmoji(d.tags)

  return (
    <div className={`flex gap-3 bg-white rounded-2xl shadow-sm overflow-hidden transition-all border ${
      isSelected ? 'border-primary ring-1 ring-primary' : 'border-border/50 active:scale-[0.99]'
    }`}>
      {/* 썸네일 */}
      <div className="relative flex-shrink-0 w-28 h-28">
        {d.image && !imgError ? (
          <img
            src={d.image}
            alt={d.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-background flex items-center justify-center text-3xl">
            {emoji}
          </div>
        )}
        {/* 순위 오버레이 */}
        <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {rank}
        </div>
      </div>

      {/* 내용 */}
      <div className="flex-1 py-3 pr-3 min-w-0">
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <h3 className="text-[15px] font-bold leading-snug line-clamp-1">{d.name}</h3>
        </div>
        {d.decision_conclusion ? (
          <p className="text-[10px] font-semibold text-teal-600 mb-1">{d.decision_conclusion}</p>
        ) : null}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="line-clamp-1">{d.address}</span>
        </div>
        {(d.story_summary || d.emotional_copy) && (d.storytelling_match_confidence ?? 0) >= 0.35 ? (
          <p className="text-[10px] text-primary/80 italic leading-snug line-clamp-2 mb-1">
            {d.emotional_copy?.trim() || d.story_summary?.trim()}
          </p>
        ) : null}
        {(d.lead_weather_sentence || d.concise_explanation_lines?.[0]) && (
          <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2 mb-1">
            {d.lead_weather_sentence ?? d.concise_explanation_lines?.[0]}
          </p>
        )}
        {(d.lead_place_sentence || d.concise_explanation_lines?.[1]) && (
          <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2 mb-2">
            {d.lead_place_sentence ?? d.concise_explanation_lines?.[1]}
          </p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {d.tags.slice(0, 2).map(tag => (
              <span
                key={tag}
                className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
          {onNextCourse && (
            <button
              type="button"
              onClick={() => onNextCourse(d)}
              className="flex items-center gap-0.5 text-[11px] text-primary font-semibold
                         hover:underline flex-shrink-0"
            >
              코스 이어가기
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
