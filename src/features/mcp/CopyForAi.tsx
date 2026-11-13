import React, { useEffect } from 'react'
import { ClipboardCopy } from 'lucide-react'
import { copyAiContext } from './aiContext'

/**
 * Botão discreto em todas as telas e o atalho Alt+I: copia o que está aberto e escolhido (ids e as ferramentas
 * da Sinfy que abrem cada coisa) para colar no chat da IA conectada.
 */
export const CopyForAi: React.FC = () => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey || e.code !== 'KeyI') return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      e.preventDefault()
      void copyAiContext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <button
      type="button"
      onClick={() => void copyAiContext()}
      title="Copiar para a IA o que está aberto e escolhido aqui (Alt+I)"
      aria-label="Copiar para a IA o que está aberto e escolhido aqui"
      className="se-dock-inset fixed bottom-4 left-4 z-[55] flex h-9 items-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-medium text-gray-600 shadow-md ring-1 ring-black/5 backdrop-blur transition-colors hover:text-violet-700 md:left-auto md:right-4 md:bottom-16"
    >
      <ClipboardCopy className="h-3.5 w-3.5" aria-hidden /> Para a IA
    </button>
  )
}
