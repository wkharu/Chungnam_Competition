import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TripFormState } from '@/lib/tripParams'
import type { TripDuration } from '@/hooks/useRecommend'
import { MapPin, Clock, Users, Car } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'

interface Props {
  value: TripFormState
  onChange: (next: TripFormState) => void
}

function Block({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/5 text-zinc-800">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-bold text-zinc-900">{title}</span>
      </div>
      {children}
    </div>
  )
}

/**
 * 앱 1화면: 태그·칩 느낌의 조건 입력 (제출은 부모)
 */
export default function AppOnboardingForm({ value: f, onChange }: Props) {
  const patch = (p: Partial<TripFormState>) => onChange({ ...f, ...p })

  const setCompanion = (k: TripFormState['companion']) => {
    if (k === 'solo') {
      onChange({ ...f, companion: 'solo', adultCount: '1', childCount: '0' })
      return
    }
    const wasSolo = f.companion === 'solo'
    onChange({
      ...f,
      companion: k,
      adultCount: wasSolo && f.adultCount === '1' ? '2' : f.adultCount,
    })
  }

  const isSolo = f.companion === 'solo'

  return (
    <div className="space-y-3.5">
      <Block icon={MapPin} title="어디 기준으로 볼까요?">
        <Select value={f.city ?? undefined} onValueChange={v => patch({ city: v ?? '전체' })}>
          <SelectTrigger className="h-11 w-full rounded-xl border-zinc-200 text-[15px] font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              '전체', '아산', '공주', '보령', '서산', '논산', '부여', '당진', '태안', '홍성',
              '천안', '금산', '서천', '예산', '청양',
            ].map(c => (
              <SelectItem key={c} value={c}>
                {c === '전체' ? '충남 전체' : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Block>

      <Block icon={Clock} title="얼마나 돌아볼까요?">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['2h', '2시간'],
              ['half-day', '반나절'],
              ['full-day', '하루'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => patch({ tripDuration: v as TripDuration })}
              className={`min-h-10 min-w-[4.5rem] rounded-full border-2 px-3.5 text-sm font-bold transition ${
                f.tripDuration === v
                  ? 'border-zinc-900 bg-zinc-900 text-white shadow-md'
                  : 'border-zinc-200 bg-zinc-50/80 text-zinc-600 active:scale-[0.98]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Block>

      <Block icon={Users} title="누구랑·무엇을?">
        <div className="space-y-2.5">
          <div>
            <p className="text-[11px] text-zinc-500 font-medium mb-1">동행</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['solo', '1인'],
                  ['couple', '커플'],
                  ['family', '가족'],
                  ['friends', '친구'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCompanion(k)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold border ${
                    f.companion === k
                      ? 'border-violet-600 bg-violet-50 text-violet-900'
                      : 'border-zinc-200 bg-white text-zinc-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500 font-medium mb-1">목적</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['healing', '힐링'],
                  ['photo', '사진'],
                  ['walking', '걷기'],
                  ['indoor', '실내'],
                  ['culture', '문화'],
                  ['kids', '키즈'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => patch({ tripGoal: k })}
                  className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold border ${
                    f.tripGoal === k
                      ? 'border-violet-600 bg-violet-50 text-violet-900'
                      : 'border-zinc-200 bg-white text-zinc-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Block>

      <Block icon={Car} title={isSolo ? '이동 수단' : '이동·인원'}>
        <div className={isSolo ? 'space-y-0' : 'grid grid-cols-2 gap-2'}>
          <div>
            {!isSolo && (
              <p className="text-[10px] text-zinc-500 mb-0.5">이동</p>
            )}
            <Select value={f.transport ?? undefined} onValueChange={v => patch({ transport: v ?? 'car' })}>
              <SelectTrigger className="h-10 rounded-xl text-xs font-semibold w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="car">자가용</SelectItem>
                <SelectItem value="public">대중교통</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isSolo && (
            <>
              <div>
                <p className="text-[10px] text-zinc-500 mb-0.5">성인</p>
                <Select value={f.adultCount ?? undefined} onValueChange={v => patch({ adultCount: v ?? '2' })}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1명</SelectItem>
                    <SelectItem value="2">2명</SelectItem>
                    <SelectItem value="3">3명</SelectItem>
                    <SelectItem value="4">4명</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] text-zinc-500 mb-0.5">어린이</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['0', '1', '2', '3'] as const).map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => patch({ childCount: n })}
                      className={`h-9 min-w-10 rounded-lg text-xs font-bold ${
                        f.childCount === n
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {n}명
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </Block>
    </div>
  )
}
