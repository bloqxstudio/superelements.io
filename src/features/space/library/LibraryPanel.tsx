import React from 'react'
import { CloudDownload } from 'lucide-react'
import { useWordPressUi } from '@/features/wordpress/uiStore'
import { useActiveWordPress } from '@/features/wordpress/useWordPressConnection'
import { cn } from '@/lib/utils'
import { ElementsLibrary } from './ElementsLibrary'
import { SectionLibrary } from './SectionLibrary'
import { TemplateLibrary } from './TemplateLibrary'

export type LibraryKind = 'sections' | 'templates' | 'elements'

const KINDS: { id: LibraryKind; label: string; hint: string }[] = [
  { id: 'sections', label: 'Seções', hint: 'Seções prontas por tipo, para encaixar na página' },
  { id: 'templates', label: 'Modelos', hint: 'Uma página inteira pronta' },
  { id: 'elements', label: 'Elementos', hint: 'Títulos, textos, botões e layouts para montar do zero' },
]

/**
 * A Biblioteca: o que entra na página. Seções prontas, modelos de página
 * inteira e elementos para criar do zero são tipos dentro dela.
 */
export const LibraryPanel: React.FC<{ kind: LibraryKind; onKind: (kind: LibraryKind) => void }> = ({ kind, onKind }) => {
  const wordpress = useActiveWordPress()
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2 pt-1">
        <div role="tablist" aria-label="Tipo da biblioteca" className="grid grid-cols-3 gap-0.5 rounded-lg bg-gray-100 p-0.5">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={kind === k.id}
              title={k.hint}
              onClick={() => onKind(k.id)}
              className={cn(
                'h-7 rounded-md text-[12px] font-medium transition-[background-color,color,box-shadow]',
                kind === k.id ? 'bg-white text-gray-900 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.08)]' : 'text-gray-500 hover:text-gray-900'
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        {kind === 'templates' && wordpress && (
          <button
            type="button"
            onClick={useWordPressUi.getState().openImport}
            className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 px-2.5 py-2 text-left text-[11px] text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900"
          >
            <CloudDownload className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span className="min-w-0 truncate">Importar páginas de {wordpress.site.name}</span>
          </button>
        )}
      </div>
      {kind === 'sections' ? <SectionLibrary /> : kind === 'templates' ? <TemplateLibrary /> : <ElementsLibrary />}
    </div>
  )
}
