import React, { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sizeOf } from '@/features/criativos/types'
import { STAGE_LABEL, STAGE_TONE, type Stage } from './rules'

export const StageChip: React.FC<{ stage: Stage; className?: string }> = ({ stage, className }) => (
  <span className={cn('inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[11px] font-medium', STAGE_TONE[stage].chip, className)}>{STAGE_LABEL[stage]}</span>
)

/** Proporção de cada formato do Criativos (largura / altura). */
export const ratioOf = (format: string) => {
  const { width, height } = sizeOf(format)
  return width / height
}

/**
 * Os slides de um post, um por vez, com setas, contador e pontos. Teclado: ← e → quando focado.
 * `onSlide` avisa o slide aberto (para o comentário dizer sobre qual slide é).
 */
export const SlideViewer: React.FC<{ urls: string[]; ratio?: number; onSlide?: (index: number) => void; className?: string; label?: string }> = ({ urls, ratio = 4 / 5, onSlide, className, label }) => {
  const [i, setI] = useState(0)
  useEffect(() => setI(0), [urls])
  useEffect(() => onSlide?.(i), [i, onSlide])
  if (!urls.length) return null
  const go = (d: number) => setI((v) => Math.min(urls.length - 1, Math.max(0, v + d)))
  return (
    <div
      className={cn('group relative overflow-hidden rounded-lg bg-gray-100', className)}
      style={{ aspectRatio: String(ratio) }}
      tabIndex={0}
      role="region"
      aria-roledescription="carrossel"
      aria-label={label ?? 'Slides'}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
    >
      <img src={urls[i]} alt={`Slide ${i + 1} de ${urls.length}`} className="h-full w-full object-contain" loading="lazy" decoding="async" />
      {urls.length > 1 && (
        <>
          <button type="button" aria-label="Slide anterior" disabled={i === 0} onClick={() => go(-1)} className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-sm transition-opacity disabled:opacity-0">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" aria-label="Próximo slide" disabled={i === urls.length - 1} onClick={() => go(1)} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-sm transition-opacity disabled:opacity-0">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {i + 1}/{urls.length}
          </span>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1" aria-hidden>
            {urls.map((_, k) => (
              <span key={k} className={cn('h-1.5 rounded-full transition-all', k === i ? 'w-4 bg-white' : 'w-1.5 bg-white/60')} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export const timeLabel = (at: number) => new Date(at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
