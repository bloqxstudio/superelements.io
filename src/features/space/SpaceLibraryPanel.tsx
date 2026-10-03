import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignLeft,
  ArrowLeft,
  BarChart3,
  Box,
  FileText,
  HelpCircle,
  Image,
  Layers,
  LayoutGrid,
  Library,
  ListOrdered,
  Loader2,
  Mail,
  MousePointerClick,
  Newspaper,
  PanelBottom,
  PanelTop,
  Plus,
  Presentation,
  Quote,
  Search,
  Shapes,
  Tag,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ElementorThumbnail } from '@/features/elementor-preview/ElementorThumbnail'
import {
  FORMAT_LABELS,
  SECTION_CATEGORIES,
  countBy,
  getCategory,
  matchesQuery,
  type SectionCategoryKey,
  type SectionFormat,
} from '@/features/section-pack/categories'
import { isComplete } from '@/features/section-pack/filters'
import { loadPackIndex, missingWidgets, type PackComponent, type PackEntry, type PackIndex } from '@/features/section-pack/pack'
import { usePagedPack } from '@/features/section-pack/usePagedPack'
import { useSpaceStore } from '@/store/spaceStore'
import { withFreshIds } from './landingPage'
import { consumeLibraryDrop, startLibraryDrag } from './pages/libraryDrag'
import { brandCustomization } from './brand/applyBrand'
import { usePackBrand } from './brand/usePackBrand'
import { fillWithProjectCopy, type ProjectCopy } from './copy/projectCopy'
import { useProjectCopy } from './copy/useProjectCopy'
import type { ElementorCustomization } from '@/features/elementor-preview/useElementorDocument'
import type { Brand } from './brand/designMd'
import { ISLAND_SURFACE } from './ToolbarIsland'

export const LIBRARY_PANEL_WIDTH = 320
const PAGE_SIZE = 16

const CATEGORY_ICONS: Record<SectionCategoryKey, LucideIcon> = {
  headers: PanelTop,
  hero: Presentation,
  content: AlignLeft,
  features: LayoutGrid,
  steps: ListOrdered,
  numbers: BarChart3,
  media: Image,
  logos: Shapes,
  team: Users,
  testimonials: Quote,
  pricing: Tag,
  faq: HelpCircle,
  cta: MousePointerClick,
  contact: Mail,
  footers: PanelBottom,
  listings: Newspaper,
  special: FileText,
  backgrounds: Layers,
  other: Box,
}

type FormatFilter = SectionFormat | 'all'

const NO_ENTRIES: PackEntry[] = []

// Escolha de cada pessoa neste navegador: ver as seções com os textos do projeto ou com os do pack
const PROJECT_COPY_FLAG = 'se-library-project-copy'
const readProjectCopyFlag = () => {
  try {
    return localStorage.getItem(PROJECT_COPY_FLAG) !== 'off'
  } catch {
    return true
  }
}
const saveProjectCopyFlag = (on: boolean) => {
  try {
    localStorage.setItem(PROJECT_COPY_FLAG, on ? 'on' : 'off')
  } catch {
    // Sem armazenamento a escolha vale só enquanto o painel está aberto
  }
}

/** Miniatura como a seção vai entrar na página: com os textos do projeto e a marca por cima. */
function libraryCustomization(brand: Brand | null, copy: ProjectCopy | null): ElementorCustomization | undefined {
  if (!brand && !copy) return undefined
  const branded = brand ? brandCustomization(brand) : null
  return {
    key: `${branded?.key ?? ''}|${copy?.key ?? ''}`,
    transform: (elements) => {
      const filled = copy ? fillWithProjectCopy(elements, copy) : elements
      return branded ? branded.transform(filled) : filled
    },
    kit: branded?.kit,
  }
}

interface SpaceLibraryPanelProps {
  onClose: () => void
}

/** Seções do pack Section Express para montar a landing page no canvas, separadas em caixinhas. */
export const SpaceLibraryPanel: React.FC<SpaceLibraryPanelProps> = ({ onClose }) => {
  const addSection = useSpaceStore((s) => s.addSection)
  // As miniaturas já mostram a seção como ela vai entrar na página
  const brand = usePackBrand()
  const projectCopy = useProjectCopy()
  const [projectText, setProjectText] = useState(readProjectCopyFlag)
  const copy = projectText ? projectCopy : null
  const customize = useMemo(() => libraryCustomization(brand, copy), [brand, copy])
  const [index, setIndex] = useState<PackIndex | null | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<SectionCategoryKey | null>(null)
  const [format, setFormat] = useState<FormatFilter>('all')
  const [onlyComplete, setOnlyComplete] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadPackIndex()
      .then(setIndex)
      .catch(() => setIndex(null))
  }, [])

  // Cards de loop são o molde de um item de grid, não uma seção de página
  const sections = useMemo(() => (index?.entries ?? []).filter((e) => e.kind !== 'loop'), [index])
  const categoryCounts = useMemo(() => countBy(sections, (e) => e.category), [sections])
  const inCategory = useMemo(
    () => (category ? sections.filter((e) => e.category === category) : sections),
    [sections, category]
  )
  const formatCounts = useMemo(() => countBy(inCategory, (e) => e.format), [inCategory])

  const searching = query.trim().length > 0
  const showCategories = !category && !searching

  const filtered = useMemo(
    () =>
      inCategory.filter(
        (e) =>
          (format === 'all' || e.format === format) && (!onlyComplete || isComplete(e)) && matchesQuery(e, query)
      ),
    [inCategory, format, onlyComplete, query]
  )

  // Na tela das caixinhas nenhuma miniatura é aberta
  const { visible, components, failed, hasMore, sentinelRef, reset } = usePagedPack(
    showCategories ? NO_ENTRIES : filtered,
    PAGE_SIZE
  )

  const changeFilter = (apply: () => void) => {
    apply()
    reset()
    listRef.current?.scrollTo({ top: 0 })
  }

  const openCategory = (key: SectionCategoryKey | null) =>
    changeFilter(() => {
      setCategory(key)
      setFormat('all')
    })

  // A seção entra com os mesmos textos da miniatura (o sorteio usa os ids originais, antes dos novos)
  const sectionData = (entry: PackEntry, component: PackComponent) => {
    const elements = component.meta._elementor_data
    return {
      title: entry.title,
      sourceId: entry.id,
      elementorJson: JSON.stringify(withFreshIds(copy ? fillWithProjectCopy(elements, copy) : elements)),
    }
  }

  const handleAdd = (entry: PackEntry, component: PackComponent) => {
    const pageId = addSection(sectionData(entry, component), { leftInset: LIBRARY_PANEL_WIDTH + 24 })
    const page = useSpaceStore.getState().pages.find((p) => p.id === pageId)
    toast.success(`${entry.title} adicionada à página ${page?.name ?? ''}`.trim())
  }

  const current = category ? getCategory(category) : null
  const CurrentIcon = current ? CATEGORY_ICONS[current.key] : null
  const formats = (Object.keys(FORMAT_LABELS) as SectionFormat[]).filter((f) => formatCounts.has(f))

  return (
    <div
      data-space-library
      className={`absolute left-3 top-16 bottom-3 z-40 flex flex-col rounded-xl ${ISLAND_SURFACE}`}
      style={{ width: LIBRARY_PANEL_WIDTH }}
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Library className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-700">Biblioteca de seções</span>
          {index && <span className="text-[10px] text-gray-400">{showCategories ? sections.length : filtered.length}</span>}
        </div>
        <button
          onClick={onClose}
          className="-mr-1 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Fechar a biblioteca"
          title="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {index === undefined && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {index === null && (
        <div className="p-4 text-xs text-gray-500 space-y-2">
          <p>A biblioteca não carregou. Feche e abra de novo para tentar outra vez.</p>
          {import.meta.env.DEV && (
            <>
              <p>Para usar o pack neste computador, importe no terminal:</p>
              <pre className="overflow-x-auto rounded-md bg-muted px-2 py-1.5 text-[10px]">
                npm run sections:import -- "caminho/do/3500-sections.zip"
              </pre>
            </>
          )}
        </div>
      )}

      {index && (
        <>
          <div className="space-y-2 border-b border-gray-100 p-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => changeFilter(() => setQuery(e.target.value))}
                placeholder={current ? `Buscar em ${current.label}` : 'Buscar: rodapé, preços, c1849…'}
                className="h-8 pl-7 text-xs"
              />
            </div>

            {current && (
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => openCategory(null)}
                  className="flex items-center gap-1 rounded-md py-0.5 pr-1.5 text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-800"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Caixinhas
                </button>
                <span className="flex items-center gap-1.5 truncate text-xs font-semibold text-gray-800">
                  {CurrentIcon && <CurrentIcon className="h-3.5 w-3.5 text-gray-400" />}
                  {current.label}
                </span>
              </div>
            )}

            {!showCategories && formats.length > 1 && (
              <div className="grid grid-cols-3 gap-1 rounded-md bg-gray-100 p-0.5">
                {(['all', ...formats] as FormatFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => changeFilter(() => setFormat(f))}
                    className={`rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
                      format === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {f === 'all' ? 'Todas' : FORMAT_LABELS[f]}
                    <span className="ml-1 text-[10px] text-gray-400">
                      {f === 'all' ? inCategory.length : formatCounts.get(f)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {!showCategories && (
              <label className="flex items-center justify-between text-[11px] text-gray-600">
                Só as que o preview desenha por completo
                <Switch checked={onlyComplete} onCheckedChange={(v) => changeFilter(() => setOnlyComplete(v))} />
              </label>
            )}

            {!showCategories && projectCopy && (
              <label
                className="flex items-center justify-between text-[11px] text-gray-600"
                title="Troca o lorem ipsum por títulos, textos e botões das páginas do projeto. Contato, números e nomes ficam como estão."
              >
                Com os textos do projeto
                <Switch
                  checked={projectText}
                  onCheckedChange={(v) => {
                    setProjectText(v)
                    saveProjectCopyFlag(v)
                  }}
                />
              </label>
            )}
          </div>

          {showCategories ? (
            <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-3">
              {SECTION_CATEGORIES.filter((c) => categoryCounts.has(c.key)).map((c) => {
                const Icon = CATEGORY_ICONS[c.key]
                return (
                  <button
                    key={c.key}
                    onClick={() => openCategory(c.key)}
                    className="flex min-h-[68px] flex-col items-start justify-between gap-2 rounded-lg border border-gray-200 p-2.5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon className="h-4 w-4 text-gray-400" />
                    <span className="flex w-full items-end justify-between gap-1">
                      <span className="text-[12px] font-medium leading-tight text-gray-800">{c.label}</span>
                      <span className="text-[10px] tabular-nums text-gray-400">{categoryCounts.get(c.key)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
              {visible.map((entry) => {
                const component = components.get(entry.id)
                if (!component) {
                  return failed.has(entry.id) ? null : <Skeleton key={entry.id} className="aspect-[16/10] w-full rounded-lg" />
                }
                const missing = missingWidgets(entry)
                return (
                  <div
                    key={entry.id}
                    role="button"
                    tabIndex={0}
                    // Arrastar leva o card até qualquer ponto do canvas; clicar adiciona no fim da página
                    onPointerDown={(e) => startLibraryDrag(e, () => sectionData(entry, component))}
                    onDragStart={(e) => e.preventDefault()}
                    onClick={() => !consumeLibraryDrop() && handleAdd(entry, component)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleAdd(entry, component)
                      }
                    }}
                    className="group block w-full cursor-grab select-none overflow-hidden rounded-lg active:cursor-grabbing border border-gray-200 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={`Clique para adicionar ${entry.title} ao fim da página, ou arraste até o ponto de uma página`}
                  >
                    <div className="relative aspect-[16/10] w-full">
                      <ElementorThumbnail component={component} title={`Preview de ${entry.title}`} customize={customize} />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                        <span className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-800 opacity-0 shadow transition-opacity group-hover:opacity-100">
                          <Plus className="h-3 w-3" /> Adicionar ou arrastar
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        <span className="truncate text-[11px] font-medium text-gray-700">{entry.title}</span>
                        <span className="font-mono text-[10px] text-gray-400">{entry.id}</span>
                      </span>
                      <span className="flex flex-shrink-0 items-center gap-1">
                        {!category && entry.category && (
                          <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">
                            {getCategory(entry.category).label}
                          </span>
                        )}
                        {entry.format === 'carousel' && (
                          <span className="rounded bg-sky-50 px-1 text-[10px] font-medium text-sky-700">Carrossel</span>
                        )}
                        {missing.length > 0 && (
                          <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800" title={missing.join(', ')}>
                            {missing.length} sem preview
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}

              {hasMore && (
                <div ref={sentinelRef} className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!hasMore && filtered.length === 0 && (
                <p className="py-6 text-center text-xs text-gray-400">Nenhuma seção encontrada</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
