import React from 'react'
import { MousePointerClick } from 'lucide-react'

/** Aviso do painel de nível quando falta selecionar seções. */
export const SelectionHint: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <p className="flex gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5 text-[11px] leading-relaxed text-gray-500">
    <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0" />
    <span>{children ?? 'Clique numa seção do canvas para selecionar. Shift + clique junta outras.'}</span>
  </p>
)
