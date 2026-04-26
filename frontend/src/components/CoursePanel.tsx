import { MapPin, Star, Clock, ChevronRight } from 'lucide-react'
import type { NextPlace } from '@/types'
import type { CourseStep } from '@/hooks/useCourse'
import type { TripDuration } from '@/hooks/useRecommend'

interface Props {
  chain: CourseStep[]
  onSelectPlace: (stepIdx: number, place: NextPlace) => void
  onClose: () => void
  tripDuration?: TripDuration
}

const TYPE_LABEL: Record<string, string> = {
  restaurant:         '식당',
  korean_restaurant:  '한식',
  chinese_restaurant: '중식',
  cafe:               '카페',
  coffee_shop:        '카페',
  bakery:             '베이커리',
}

const STEP_ICONS = ['🌿', '➜', '📍', '🌙']

function getTypeLabel(types: string[]): string {
  for (const t of types) {
    if (TYPE_LABEL[t]) return TYPE_LABEL[t]
  }
  return '장소'
}

export default function CoursePanel({ chain, onSelectPlace, onClose, tripDuration = 'half-day' }: Props) {
  if (chain.length === 0) return null

  const flowHint =
    tripDuration === '2h'
      ? '2시간 일정: 다음은 한 단계만 강하게 이어가요.'
      : tripDuration === 'full-day'
        ? '종일 일정: 쉼·오후·마무리까지 단계를 나눠 볼 수 있어요.'
        : '반나절: 쉬었다가 다음 장면까지 이어가기 좋아요.'

  return (
    <div className="mt-2 mb-4 rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-primary">코스 이어가기 · 다음 장면</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          닫기
        </button>
      </div>
      <p className="text-[10px] text-teal-900/90 px-4 py-2 bg-teal-50/80 border-b border-teal-100">{flowHint}</p>

      <div className="px-4 py-3 flex flex-col gap-4">
        {chain.map((step, stepIdx) => {
          const stageType = step.payload?.next_stage?.type ?? ''
          const isMealStage = stageType === 'meal'
          const split = Boolean(step.payload?.meta?.indoor_transition_split)
          const showComfortPanels = isMealStage
          return (
          <div key={stepIdx}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{STEP_ICONS[stepIdx % STEP_ICONS.length] ?? '📍'}</span>
              <span className="text-xs font-bold text-foreground">
                {stepIdx + 1}단계 — {step.label}
              </span>
              {stepIdx > 0 && step.places.length > 0 && (
                <span className="text-[10px] text-muted-foreground">(선택한 장소 기준)</span>
              )}
            </div>

            {step.payload?.next_stage && (
              <div className="mb-3 rounded-xl bg-background/80 border border-border/50 p-3 text-sm">
                {(() => {
                  const scene = step.payload.next_scene ?? step.payload.next_stage
                  const sm = step.payload.scene_mode
                  const wmn = step.payload.next_scene?.why_meal_now ?? []
                  const hl =
                    step.payload.next_step_headline ??
                    scene.headline ??
                    scene.title
                  const gnotes = step.payload.guided_flow_notes ?? []
                  return (
                    <>
                <p className="text-[10px] font-bold text-primary tracking-wide">다음 단계 추천</p>
                <p className="text-sm font-extrabold text-foreground leading-snug mt-0.5">{hl}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{scene.title}</p>
                {gnotes.length > 0 && (
                  <ul className="mt-2 text-[11px] text-teal-800/90 list-disc pl-4 space-y-0.5">
                    {gnotes.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                )}
                <p className="text-[10px] font-bold text-primary mt-2">왜 이렇게 판단했나요?</p>
                <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4 space-y-0.5">
                  {(scene.why ?? []).slice(0, 3).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                {sm?.title ? (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <p className="text-[10px] font-bold text-primary">
                      {split ? '실내 전환 방식' : '다음 장면 방식'}
                    </p>
                    <p className="text-xs font-bold text-foreground mt-0.5 leading-snug">{sm.title}</p>
                    <p className="text-[10px] font-bold text-primary mt-2">왜 이 방식인가요?</p>
                    <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4 space-y-0.5">
                      {(sm.why ?? []).slice(0, 3).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {showComfortPanels && wmn.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <p className="text-[11px] font-bold text-primary">왜 지금 식사인가</p>
                    <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4 space-y-0.5">
                      {wmn.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                    </>
                  )
                })()}
                {showComfortPanels &&
                  step.payload.meal_style?.label &&
                  step.payload.meal_style.key !== 'none' &&
                  step.payload.meal_style.key !== 'cafe_rest' && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <p className="text-xs font-bold text-primary">
                      {isMealStage ? '추천 식사 스타일' : '추천 실내 무드'}:{' '}
                      <span className="text-foreground">{step.payload.meal_style.label}</span>
                    </p>
                    {step.payload.meal_style.secondary_key && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        보조 스타일:{' '}
                        {step.payload.meal_style.secondary_label ?? step.payload.meal_style.secondary_key}
                      </p>
                    )}
                    {(step.payload.meal_style.why?.length ?? 0) > 0 && (
                      <>
                        <p className="text-[11px] font-bold text-primary mt-2">
                          {isMealStage ? '왜 이 스타일인가' : '왜 이 무드인가'}
                        </p>
                        <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4 space-y-0.5">
                          {(step.payload.meal_style.why ?? []).slice(0, 4).map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {step.payload.cuisine_bias && Object.keys(step.payload.cuisine_bias).length > 0 && (
                      <details className="mt-2 text-[10px] text-muted-foreground">
                        <summary className="cursor-pointer font-semibold text-primary">요리 편향(보조)</summary>
                        <p className="mt-1 leading-relaxed">
                          한 {step.payload.cuisine_bias.korean?.toFixed(2) ?? '-'} · 중{' '}
                          {step.payload.cuisine_bias.chinese?.toFixed(2) ?? '-'} · 일{' '}
                          {step.payload.cuisine_bias.japanese?.toFixed(2) ?? '-'} · 서양{' '}
                          {step.payload.cuisine_bias.western?.toFixed(2) ?? '-'}
                        </p>
                      </details>
                    )}
                  </div>
                )}
                {step.payload.primary_recommendation?.name && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <p className="text-[11px] font-bold text-primary mb-1">1순위 추천</p>
                    <p className="text-sm font-bold text-foreground">{step.payload.primary_recommendation.name}</p>
                    {step.payload.primary_recommendation.data_source_note ? (
                      <p className="text-[10px] text-teal-600 mt-1">
                        {step.payload.primary_recommendation.data_source_note}
                      </p>
                    ) : null}
                    {step.payload.primary_recommendation.practical_info?.mobility_line && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {step.payload.primary_recommendation.practical_info.mobility_line}
                      </p>
                    )}
                    <details className="mt-1 text-[10px] text-muted-foreground">
                      <summary className="cursor-pointer font-semibold text-primary">점수·세부 근거</summary>
                      {step.payload.primary_recommendation.score != null && (
                        <p className="mt-1">
                          내부 참고 점수 {step.payload.primary_recommendation.score.toFixed(1)} / 100
                        </p>
                      )}
                    </details>
                    <p className="text-[11px] font-bold text-primary mt-2">
                      {isMealStage ? '왜 이 식당인가' : '왜 이 장소인가'}
                    </p>
                    {step.payload.primary_recommendation.why?.map((w, i) => (
                      <p key={i} className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        · {w}
                      </p>
                    ))}
                    {!(step.payload.after_this && step.payload.after_this.length > 0) && (
                      <>
                        <p className="text-[11px] font-bold text-primary mt-2">
                          {step.payload.primary_recommendation.after_this_title ?? '이후 이어가기'}
                        </p>
                        <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4 space-y-0.5">
                          {(step.payload.primary_recommendation.after_this ?? []).map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
                {step.payload.alternatives && step.payload.alternatives.length > 0 && (
                  <details className="mt-2 pt-2 border-t border-border/30 text-xs">
                    <summary className="cursor-pointer font-bold text-primary">다른 선택지 이름만 보기</summary>
                    <ul className="text-muted-foreground mt-1 list-disc pl-4 space-y-0.5">
                      {step.payload.alternatives.slice(0, 6).map((p, i) => (
                        <li key={i}>{p.name}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {step.payload.after_this && step.payload.after_this.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <p className="text-[11px] font-bold text-primary">
                      {stageType === 'meal' ? '식사 후 이어가기' : '이후 이어가기'}
                    </p>
                    <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4 space-y-0.5">
                      {step.payload.after_this.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!step.payload.primary_recommendation && step.payload.meta?.fallback_note && (
                  <p className="text-xs text-muted-foreground mt-2">{step.payload.meta.fallback_note}</p>
                )}
              </div>
            )}

            {step.loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2].map(i => (
                  <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : step.places.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 pl-1">
                {step.payload?.meta?.fallback_note || '근처 장소를 찾지 못했습니다.'}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold text-muted-foreground pl-1">
                  마음에 들면 그대로, 아니면 한 번에 바꿔 이어가기
                </p>
                {step.places[0] && (
                  <NextPlaceCard
                    key={`${step.places[0].name}-0`}
                    place={step.places[0]}
                    isSelected={step.selected?.name === step.places[0].name}
                    isPrimary
                    hasNext={stepIdx < 1}
                    onClick={() => onSelectPlace(stepIdx, step.places[0])}
                  />
                )}
                {step.places.length > 1 && (
                  <details className="rounded-xl border border-border/40 bg-background/60">
                    <summary className="cursor-pointer text-[11px] font-bold text-primary px-3 py-2">
                      다른 선택지도 보기 ({step.places.length - 1}곳)
                    </summary>
                    <div className="flex flex-col gap-2 px-2 pb-2 pt-0">
                      {step.places.slice(1).map((p, i) => (
                        <NextPlaceCard
                          key={`${p.name}-${i + 1}`}
                          place={p}
                          isSelected={step.selected?.name === p.name}
                          isPrimary={false}
                          hasNext={stepIdx < 1}
                          onClick={() => onSelectPlace(stepIdx, p)}
                        />
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {stepIdx < chain.length - 1 && chain[stepIdx].selected && (
              <div className="flex items-center gap-1 mt-3 text-xs text-primary font-medium pl-1">
                <ChevronRight className="w-3.5 h-3.5" />
                {chain[stepIdx].selected!.name} 기준으로 다음 코스
              </div>
            )}
          </div>
          )
        })}
      </div>
    </div>
  )
}

function NextPlaceCard({
  place: p,
  isSelected,
  isPrimary,
  hasNext,
  onClick,
}: {
  place: NextPlace
  isSelected: boolean
  isPrimary: boolean
  hasNext: boolean
  onClick: () => void
}) {
  const typeLabel = getTypeLabel(p.types)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      className={`flex gap-3 bg-white rounded-xl overflow-hidden shadow-sm border transition-all cursor-pointer
        ${isSelected
          ? 'border-primary ring-1 ring-primary'
          : isPrimary
            ? 'border-primary border-2'
            : 'border-border/40 hover:border-primary/40'
        }`}
    >
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
            📍
          </div>
        )}
      </div>

      <div className="flex-1 py-2.5 pr-3 min-w-0">
        <div className="flex items-start justify-between gap-1 mb-1">
          <div className="min-w-0">
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full mr-1">
              {typeLabel}
            </span>
            <span className="text-[13px] font-bold">{p.name}</span>
            {p.public_data_match || p.source_mix === 'merged' ? (
              <span className="block text-[9px] text-teal-600 font-medium mt-0.5">
                {p.source_mix === 'merged' ? '공공데이터 + 지도 검색 보강' : '공공 관광 데이터 기반 후보'}
              </span>
            ) : null}
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
