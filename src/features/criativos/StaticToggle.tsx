import React from 'react'
import { Clapperboard, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { hasMotion, hasMotionData, setPostStatic } from './motion'
import type { Post } from './types'

/**
 * Estático / Animado (2026-11-09): o post que já foi animado pode sair parado sem perder a animação,
 * e voltar a ser animado depois. Só aparece quando o post tem animação guardada.
 */
export const StaticToggle: React.FC<{ post: Post; onChange: (edit: (p: Post) => Post) => void; className?: string }> = ({ post, onChange, className }) => {
  if (!hasMotionData(post)) return null
  const animated = hasMotion(post)
  const set = (still: boolean) => {
    if (still === !animated) return
    onChange((p) => setPostStatic(p, still))
    toast.success(still ? 'Post estático: sai parado na aprovação e no Instagram. A animação ficou guardada.' : 'Post animado de novo.')
  }
  return (
    <div role="radiogroup" aria-label="Como o post sai" className={cn('flex rounded-md bg-gray-100 p-0.5 text-xs', className)}>
      <button type="button" role="radio" aria-checked={!animated} onClick={() => set(true)} title="Sai como imagem (ou carrossel de imagens); a animação fica guardada" className={cn('flex h-7 items-center gap-1 rounded px-2 font-medium', !animated ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
        <ImageIcon className="h-3.5 w-3.5" /> Estático
      </button>
      <button type="button" role="radio" aria-checked={animated} onClick={() => set(false)} title="Sai em vídeo, com a animação" className={cn('flex h-7 items-center gap-1 rounded px-2 font-medium', animated ? 'bg-white text-violet-800 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
        <Clapperboard className="h-3.5 w-3.5" /> Animado
      </button>
    </div>
  )
}
