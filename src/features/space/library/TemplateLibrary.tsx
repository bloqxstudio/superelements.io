import React, { memo, useMemo, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { ElementorThumbnail } from '@/features/elementor-preview/ElementorThumbnail'
import type { ElementorCustomization } from '@/features/elementor-preview/useElementorDocument'
import { fold } from '@/features/section-pack/categories'
import { useSpaceStore } from '@/store/spaceStore'
import { brandCustomization } from '../brand/applyBrand'
import { useActiveBrand } from '../brand/brandStore'
import { parseSectionElements } from '../landingPage'
import { createLandingTemplates, type LandingTemplate } from '../landingTemplates'

/** Seções do topo que a miniatura desenha: navbar, hero e o começo da seguinte. */
const PREVIEW_SECTIONS = 3

// Cada modelo monta a árvore Elementor inteira: só na primeira abertura, e uma vez por sessão
let registry: LandingTemplate[] | undefined
const getTemplates = () => (registry ??= createLandingTemplates())

/** Busca por nome, público, descrição ou nome de seção: "zelo", "fintech", "rodapé", "hero". */
const searchText = (template: LandingTemplate) =>
  fold([template.name, template.audience, template.description, ...template.sections.map((s) => s.title), ...(template.componentIds ?? [])].join(' '))

const sectionCount = (n: number) => `${n} ${n === 1 ? 'seção' : 'seções'}`

/** O modelo entra na página ativa, se ela estiver vazia; senão, vira uma página nova. O resto do canvas fica. */
function loadTemplate(template: LandingTemplate) {
  const store = useSpaceStore.getState()
  const active = store.pages.find((p) => p.id === store.activePageId)
  const pageId = active && !active.sectionIds.length ? active.id : store.addPage(template.name)
  useSpaceStore.getState().addSections(template.sections, { pageId })
  useSpaceStore.getState().focusPage(pageId)
  const page = useSpaceStore.getState().pages.find((p) => p.id === pageId)
  toast.success(`${template.name} carregado em ${page?.name ?? 'uma página'}`, {
    description: `${sectionCount(template.sections.length)} prontas para personalizar e exportar.`,
  })
}

/** Modelos da Biblioteca: uma página inteira pronta, com a marca do projeto nas miniaturas. */
export const TemplateLibrary: React.FC = () => {
  const [templates] = useState(getTemplates)
  const haystacks = useMemo(() => new Map(templates.map((t) => [t.id, searchText(t)])), [templates])
  const [query, setQuery] = useState('')
  const [audience, setAudience] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // As miniaturas já mostram o modelo como ele vai entrar na página
  const brand = useActiveBrand()
  const customize = useMemo(() => (brand ? brandCustomization(brand) : undefined), [brand])

  // Nome da página ativa quando ela está vazia: é para lá que o modelo vai
  const emptyActivePage = useSpaceStore((s) => {
    const active = s.pages.find((p) => p.id === s.activePageId)
    return active && !active.sectionIds.length ? active.name : null
  })

  const found = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean)
    return templates.filter((t) => words.every((word) => haystacks.get(t.id)!.includes(word)))
  }, [templates, haystacks, query])
  const audiences = useMemo(() => [...new Set(templates.map((t) => t.audience))], [templates])
  const visible = audience ? found.filter((t) => t.audience === audience) : found

  const changeFilter = (apply: () => void) => {
    apply()
    listRef.current?.scrollTo({ top: 0 })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-gray-100 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => changeFilter(() => setQuery(e.target.value))}
            placeholder={`Buscar em ${templates.length} modelos`}
            aria-label="Buscar modelos"
            className="h-8 w-full rounded-lg bg-gray-100 pl-8 pr-7 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:bg-white focus:shadow-[0_0_0_2px_rgb(124_58_237/0.45)]"
          />
          {query && (
            <button
              onClick={() => changeFilter(() => setQuery(''))}
              className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:text-gray-700"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Uma linha só, que rola para o lado: são muitos públicos para o painel */}
        <div className="-mx-3 flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Público">
          {[null, ...audiences].map((a) => (
            <button
              key={a ?? '*'}
              onClick={() => changeFilter(() => setAudience(a))}
              aria-pressed={audience === a}
              className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                audience === a ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              {a ?? 'Todos'}
            </button>
          ))}
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {visible.length ? (
          visible.map((template) => <TemplateCard key={template.id} template={template} customize={customize} />)
        ) : (
          <p className="py-8 text-center text-xs text-gray-400">{query.trim() ? `Nenhum modelo para “${query.trim()}”.` : 'Nenhum modelo neste público.'}</p>
        )}
      </div>

      <p className="border-t border-gray-100 px-3 py-2 text-[10px] leading-relaxed text-gray-400">
        {emptyActivePage ? `O modelo entra na página “${emptyActivePage}”, que está vazia.` : 'O modelo entra numa página nova. As outras continuam no canvas.'}
      </p>
    </div>
  )
}

const TemplateCard: React.FC<{ template: LandingTemplate; customize?: ElementorCustomization }> = memo(({ template, customize }) => {
  // O topo da página numa miniatura só, como um print do site
  const preview = useMemo(
    () => ({
      id: `modelo-${template.id}`,
      title: template.name,
      meta: {
        _elementor_data: template.sections.slice(0, PREVIEW_SECTIONS).flatMap((s) => parseSectionElements(s.elementorJson) ?? []),
      },
    }),
    [template]
  )

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => loadTemplate(template)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          loadTemplate(template)
        }
      }}
      title={template.description}
      className="group block cursor-pointer select-none overflow-hidden rounded-lg border border-gray-200 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-[16/10] w-full">
        <ElementorThumbnail component={preview} title={`Prévia de ${template.name}`} customize={customize} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
          <span className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-800 opacity-0 shadow transition-opacity group-hover:opacity-100">
            <Plus className="h-3 w-3" /> Usar este modelo
          </span>
        </span>
      </div>
      <div className="px-2 py-1.5">
        <p className="truncate text-[12px] font-medium text-gray-800">{template.name}</p>
        <p className="flex min-w-0 items-baseline gap-1 text-[10px] text-gray-500">
          <span className="truncate">{template.audience}</span>
          <span aria-hidden className="text-gray-300">·</span>
          <span className="shrink-0 tabular-nums">{sectionCount(template.sections.length)}</span>
        </p>
      </div>
    </div>
  )
})

TemplateCard.displayName = 'TemplateCard'
