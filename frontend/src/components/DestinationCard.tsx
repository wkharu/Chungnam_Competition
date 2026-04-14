import { useState } from 'react'
import { MapPin, Star } from 'lucide-react'
import { getPlaceEmoji } from '@/lib/weather'
import type { Destination } from '@/types'

interface Props {
  destination: Destination
  rank: number
}

export default function DestinationCard({ destination: d, rank }: Props) {
  const isFeatured = rank === 1
  return isFeatured
    ? <FeaturedCard destination={d} />
    : <CompactCard destination={d} rank={rank} />
}

/* ── 1위: 큰 히어로 카드 ─────────────────────────────────────────── */
function FeaturedCard({ destination: d }: { destination: Destination }) {
  const [imgError, setImgError] = useState(false)
  const emoji = getPlaceEmoji(d.tags)
  const score = Math.round(d.score * 100)

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-lg mb-2 active:scale-[0.99] transition-transform">
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

      {/* 점수 */}
      <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-sm font-bold px-3 py-1 rounded-full">
        {score}점
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
        <div className="flex items-center gap-1 text-xs opacity-80 mb-2">
          <MapPin className="w-3 h-3" />
          {d.address}
        </div>
        <p className="text-xs opacity-75 leading-relaxed line-clamp-2">{d.copy}</p>
      </div>
    </div>
  )
}

/* ── 2위~: 가로형 컴팩트 카드 ────────────────────────────────────── */
function CompactCard({ destination: d, rank }: { destination: Destination; rank: number }) {
  const [imgError, setImgError] = useState(false)
  const emoji = getPlaceEmoji(d.tags)
  const score = Math.round(d.score * 100)

  return (
    <div className="flex gap-3 bg-white rounded-2xl shadow-sm overflow-hidden active:scale-[0.99] transition-transform border border-border/50">
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
        <div className="flex items-start justify-between gap-1 mb-1">
          <h3 className="text-[15px] font-bold leading-snug line-clamp-1">{d.name}</h3>
          <span className="flex-shrink-0 text-[11px] font-bold text-primary">{score}점</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="line-clamp-1">{d.address}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {d.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
