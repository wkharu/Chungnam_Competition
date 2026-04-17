import { MapPin, Star, Clock, ChevronRight } from 'lucide-react'
import type { NextPlace } from '@/types'
import type { CourseStep } from '@/hooks/useCourse'

interface Props {
  chain: CourseStep[]
  onSelectPlace: (stepIdx: number, place: NextPlace) => void
  onClose: () => void
}

const TYPE_LABEL: Record<string, string> = {
  restaurant:         '식당',
  korean_restaurant:  '한식',
  chinese_restaurant: '중식',
  cafe:               '카페',
  coffee_shop:        '카페',
  bakery:             '베이커리',
}

const STEP_ICONS = ['🍽️', '☕', '🌅']

function getTypeLabel(types: string[]): string {
  for (const t of types) {
    if (TYPE_LABEL[t]) return TYPE_LABEL[t]
  }
  return '식당'
}

export default function CoursePanel({ chain, onSelectPlace, onClose }: Props) {
  if (chain.length === 0) return null

  return (
    <div className="mt-2 mb-4 rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-primary">코스 추천</span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          닫기
        </button>
      </div>

      {/* 단계별 렌더링 */}
      <div className="px-4 py-3 flex flex-col gap-4">
        {chain.map((step, stepIdx) => (
          <div key={stepIdx}>
            {/* 단계 레이블 */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{STEP_ICONS[stepIdx]}</span>
              <span className="text-xs font-bold text-foreground">
                {stepIdx + 2}번 코스 — {step.label}
              </span>
              {stepIdx > 0 && step.places.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  (선택한 장소 근처)
                </span>
              )}
            </div>

            {/* 장소 목록 */}
            {step.loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2].map(i => (
                  <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : step.places.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 pl-1">
                근처 장소를 찾지 못했습니다.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {step.places.map((p, i) => (
                  <NextPlaceCard
                    key={i}
                    place={p}
                    isSelected={step.selected?.name === p.name}
                    hasNext={stepIdx < 1}   // 마지막 단계엔 "다음" 버튼 없음
                    onClick={() => onSelectPlace(stepIdx, p)}
                  />
                ))}
              </div>
            )}

            {/* 단계 연결 화살표 */}
            {stepIdx < chain.length - 1 && chain[stepIdx].selected && (
              <div className="flex items-center gap-1 mt-3 text-xs text-primary font-medium pl-1">
                <ChevronRight className="w-3.5 h-3.5" />
                {chain[stepIdx].selected!.name} 근처에서 다음 코스
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function NextPlaceCard({
  place: p,
  isSelected,
  hasNext,
  onClick,
}: {
  place: NextPlace
  isSelected: boolean
  hasNext: boolean
  onClick: () => void
}) {
  const typeLabel = getTypeLabel(p.types)

  return (
    <div
      onClick={onClick}
      className={`flex gap-3 bg-white rounded-xl overflow-hidden shadow-sm border transition-all cursor-pointer
        ${isSelected
          ? 'border-primary ring-1 ring-primary'
          : 'border-border/40 hover:border-primary/40'
        }`}
    >
      {/* 썸네일 */}
      <div className="flex-shrink-0 w-20 h-20">
        {p.photo_url ? (
          <img
            src={p.photo_url}
            alt={p.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center text-2xl">
            🍽️
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="flex-1 py-2.5 pr-3 min-w-0">
        <div className="flex items-start justify-between gap-1 mb-1">
          <div className="min-w-0">
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full mr-1">
              {typeLabel}
            </span>
            <span className="text-[13px] font-bold">{p.name}</span>
          </div>
          {p.open_now !== null && (
            <span className={`flex-shrink-0 text-[10px] font-semibold flex items-center gap-0.5 ${
              p.open_now ? 'text-emerald-600' : 'text-rose-500'
            }`}>
              <Clock className="w-2.5 h-2.5" />
              {p.open_now ? '영업중' : '영업종료'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 mb-1">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span className="text-xs font-bold">{p.rating.toFixed(1)}</span>
          <span className="text-[11px] text-muted-foreground">
            ({p.review_count.toLocaleString()}개)
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="line-clamp-1">{p.address}</span>
          </div>
          {hasNext && !isSelected && (
            <span className="flex-shrink-0 text-[10px] text-primary font-semibold flex items-center gap-0.5 ml-1">
              선택
              <ChevronRight className="w-3 h-3" />
            </span>
          )}
          {isSelected && (
            <span className="flex-shrink-0 text-[10px] text-primary font-bold ml-1">✓ 선택됨</span>
          )}
        </div>
      </div>
    </div>
  )
}
