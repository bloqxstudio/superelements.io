import React from 'react'
import { X } from 'lucide-react'
import { useSpaceStore } from '@/store/spaceStore'
import { ISLAND_SURFACE } from '../ToolbarIsland'
import { canvasSections } from '../pages/pages'
import { BrandLayerLevel } from './BrandLayerLevel'
import { levelInfo } from './levels'
import { MotionLevel } from './MotionLevel'

export const LEVEL_PANEL_WIDTH = 340

/** Seleção de seções que o nível mostra e onde ele aplica. */
const SelectionBar: React.FC = () => {
  const nodes = useSpaceStore((s) => s.nodes)
  const pages = useSpaceStore((s) => s.pages)
  const selectedIds = useSpaceStore((s) => s.selectedIds)
  const setSelection = useSpaceStore((s) => s.setSelection)
  const clearSelection = useSpaceStore((s) => s.clearSelection)
  const sections = canvasSections(pages, nodes)
  const count = sections.filter((s) => selectedIds.includes(s.id)).length
  const link = 'rounded px-1.5 py-0.5 font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-40'

  return (
    <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2 text-[11px]">
      <span className={count ? 'font-medium text-violet-700' : 'text-gray-500'}>
        {count ? `${count} de ${sections.length} seç${sections.length === 1 ? 'ão' : 'ões'} selecionada${count === 1 ? '' : 's'}` : 'Nenhuma seção selecionada'}
      </span>
      <div className="flex items-center gap-1">
        <button className={link} disabled={!sections.length || count === sections.length} onClick={() => setSelection(sections.map((s) => s.id))}>
          Todas
        </button>
        <button className={link} disabled={!count} onClick={clearSelection}>
          Limpar
        </button>
      </div>
    </div>
  )
}

/** Painel à direita do canvas com o nível em edição. Some no nível Estrutura. */
export const LevelPanel: React.FC = () => {
  const editLevel = useSpaceStore((s) => s.editLevel)
  const setEditLevel = useSpaceStore((s) => s.setEditLevel)
  if (editLevel === 'structure') return null
  const info = levelInfo(editLevel)
  const Icon = info.icon

  return (
    <aside
      className={`absolute bottom-3 right-3 top-16 z-40 flex flex-col overflow-hidden rounded-xl ${ISLAND_SURFACE}`}
      style={{ width: LEVEL_PANEL_WIDTH }}
      onWheel={(e) => e.stopPropagation()}
    >
      <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Icon className="h-4 w-4 text-violet-600" />
            {info.label}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{info.hint}</p>
        </div>
        <button
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          title="Voltar para Estrutura"
          onClick={() => setEditLevel('structure')}
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <SelectionBar />
      {editLevel === 'motion' ? <MotionLevel /> : editLevel === 'photos' ? null : <BrandLayerLevel level={editLevel} />}
    </aside>
  )
}
