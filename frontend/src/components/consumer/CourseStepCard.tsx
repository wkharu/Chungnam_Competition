import type { ConsumerStep } from '@/lib/consumerCourseTypes'
import { appImageSrc, COURSE_IMAGE_FALLBACK } from '@/lib/courseImageFallback'
import { useRef, useState } from 'react'

export function CourseStepCard({ step, onOpen }: { step: ConsumerStep; onOpen: () => void }) {
  const [broken, setBroken] = useState(false)
  const retryRef = useRef(0)
  const originalSrc = appImageSrc(step.image)
  const src = broken ? COURSE_IMAGE_FALLBACK : originalSrc

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-2xl border border-[#eadfce] bg-[#fffdf8] p-2.5 flex gap-3 active:scale-[0.99] transition"
    >
      <div className="relative shrink-0">
        <img
          src={src}
          alt=""
          className="w-[5rem] h-[5rem] rounded-lg object-cover bg-stone-100"
          onError={(e) => {
            if (retryRef.current < 1 && originalSrc !== COURSE_IMAGE_FALLBACK) {
              retryRef.current += 1
              // Retry after 1.5s — handles transient proxy/CDN glitches
              setTimeout(() => {
                const img = e.target as HTMLImageElement
                if (img) img.src = originalSrc + (originalSrc.includes('?') ? '&_r=1' : '?_r=1')
              }, 1500)
            } else {
              setBroken(true)
            }
          }}
        />
        <span className="absolute -top-1 -left-1 grid h-6 min-w-6 place-items-center rounded-full bg-[#f28c6b] px-1.5 text-[11px] font-black text-white">
          {step.id.match(/step-(\d+)/)?.[1] ? Number(step.id.match(/step-(\d+)/)?.[1]) + 1 : ''}
        </span>
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-[12px] font-bold text-[#c56642] uppercase tracking-wide">{step.role}</p>
        <p className="text-[16px] font-extrabold text-[#2b1b12] leading-snug mt-0.5">{step.name}</p>
        {(typeof step.rating === 'number' && step.rating > 0) ||
        (typeof step.reviewCount === 'number' && step.reviewCount > 0) ? (
          <p className="text-[12px] font-semibold text-amber-800/95 mt-1">
            {typeof step.rating === 'number' && step.rating > 0 ? <>★ {step.rating.toFixed(1)}</> : null}
            {typeof step.reviewCount === 'number' && step.reviewCount > 0 ? (
              <>
                {typeof step.rating === 'number' && step.rating > 0 ? ' · ' : null}
                리뷰 {step.reviewCount.toLocaleString('ko-KR')}건
              </>
            ) : null}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {step.tags.map(t => (
            <span key={t} className="text-[11px] font-semibold text-[#7b6a5c] bg-[#f5ede2] px-2 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}
