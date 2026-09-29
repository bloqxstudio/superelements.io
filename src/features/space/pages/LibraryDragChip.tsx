import React from 'react'
import { createPortal } from 'react-dom'
import { FileText, LayoutTemplate, SquarePlus, X } from 'lucide-react'
import { useSpaceStore } from '@/store/spaceStore'
import { useInsertDrag } from '@/features/space/editor/insertDrag'
import type { SectionNodeData } from '@/types/space'

/**
 * Cartão que segue o cursor enquanto um card da biblioteca (ou um elemento do
 * painel Inserir) é arrastado: o nome e onde ele entra se for solto agora.
 */
export const LibraryDragChip: React.FC = () => {
  const pointer = useSpaceStore((s) => s.libraryPointer)
  const pageName = useSpaceStore((s) => (s.dropTarget && !s.dropTarget.sectionId ? s.pages.find((p) => p.id === s.dropTarget?.pageId)?.name : undefined))
  const loose = useSpaceStore((s) => !!s.libraryGhost)
  const insertSection = useInsertDrag((s) => s.drop?.sectionId)
  const sectionTitle = useSpaceStore((s) => {
    const node = insertSection ? s.nodes.find((n) => n.id === insertSection) : undefined
    return node ? (node.data as SectionNodeData).title : undefined
  })
  if (!pointer) return null

  const [Icon, hint] = insertSection
    ? [SquarePlus, `Entra em ${sectionTitle || 'esta seção'}`]
    : pageName
    ? [FileText, `Entra na página ${pageName}`]
    : loose
      ? [LayoutTemplate, 'Fica solta no canvas']
      : [X, 'Soltar aqui cancela']

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[100] flex max-w-72 items-center gap-2 rounded-lg bg-gray-900 py-1.5 pl-2 pr-3 text-white shadow-[0_8px_24px_-8px_rgb(0_0_0/0.45)]"
      style={{ transform: `translate(${pointer.x + 14}px, ${pointer.y + 14}px)` }}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${insertSection || pageName || loose ? 'text-violet-300' : 'text-gray-400'}`} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">{pointer.title}</span>
        <span className="block truncate text-[11px] text-gray-300">{hint}</span>
      </span>
    </div>,
    document.body
  )
}
