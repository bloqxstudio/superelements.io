import React, { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Plus, Search, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ElementorThumbnail } from '@/features/elementor-preview/ElementorThumbnail'
import type { ElementorCustomization } from '@/features/elementor-preview/useElementorDocument'
import { fold } from '@/features/section-pack/categories'
import { useSpaceStore } from '@/store/spaceStore'
import { brandCustomization } from './brand/applyBrand'
import { useActiveBrand } from './brand/brandStore'
import { parseSectionElements } from './landingPage'
import { createLandingTemplates, type LandingTemplate } from './landingTemplates'

/** Seções do topo que a miniatura desenha: navbar, hero e o começo da seguinte. */
const PREVIEW_SECTIONS = 3

// Cada modelo monta a árvore Elementor inteira: só na primeira abertura, e uma vez por sessão
let registry: LandingTemplate[] | undefined
const getTemplates = () => (registry ??= createLandingTemplates())

/** Busca por nome, público, descrição ou nome de seção: "zelo", "fintech", "rodapé", "hero". */
const searchText = (template: LandingTemplate) =>
  fold([template.name, template.audience, template.description, ...template.sections.map((s) => s.title), ...(template.componentIds ?? [])].join(' '))

const sectionCount = (n: number) => `${n} ${n === 1 ? 'seção' : 'seções'}`

interface LandingTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Página que recebeu o modelo. */
  onLoaded: (pageId: string) => void
}

export const LandingTemplateDialog: React.FC<LandingTemplateDialogProps> = ({ open, onOpenChange, onLoaded }) => {
  /** O modelo entra na página ativa, se ela estiver vazia; senão, vira uma página nova. O resto do canvas fica. */
  const loadTemplate = useCallback(
    (template: LandingTemplate) => {
      const store = useSpaceStore.getState()
      const active = store.pages.find((p) => p.id === store.activePageId)
      const pageId = active && !active.sectionIds.length ? active.id : store.addPage(template.name)
      useSpaceStore.getState().addSections(template.sections, { pageId, leftInset: 32 })
      const page = useSpaceStore.getState().pages.find((p) => p.id === pageId)
      onOpenChange(false)
      onLoaded(pageId)
      toast.success(`${template.name} carregado em ${page?.name ?? 'uma página'}`, {
        description: `${sectionCount(template.sections.length)} prontas para personalizar e exportar.`,
      })
    },
    [onOpenChange, onLoaded]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Altura fixa: filtrar não faz o diálogo pular, e a lista rola por dentro */}
      <DialogContent className="flex h-[min(88vh,820px)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <TemplateGallery onUse={loadTemplate} />
      </DialogContent>
    </Dialog>
  )
}

/** Só monta com o diálogo aberto. */
const TemplateGallery: React.FC<{ onUse: (template: LandingTemplate) => void }> = ({ onUse }) => {
  const [templates] = useState(getTemplates)
  const haystacks = useMemo(() => new Map(templates.map((t) => [t.id, searchText(t)])), [templates])
  const [query, setQuery] = useState('')
  const [audience, setAudience] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

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

  // Públicos na ordem do registro; a contagem segue a busca, para mostrar onde estão os resultados
  const audiences = useMemo(() => [...new Set(templates.map((t) => t.audience))], [templates])
  const foundCounts = useMemo(
    () => found.reduce((counts, t) => counts.set(t.audience, (counts.get(t.audience) ?? 0) + 1), new Map<string, number>()),
    [found]
  )
  const visible = audience ? found.filter((t) => t.audience === audience) : found
  const filtering = query.trim().length > 0 || audience !== null

  const changeFilter = (apply: () => void) => {
    apply()
    gridRef.current?.scrollTo({ top: 0 })
  }
  const clearFilters = () =>
    changeFilter(() => {
      setQuery('')
      setAudience(null)
    })

  const filters: Array<{ key: string | null; label: string; count: number }> = [
    { key: null, label: 'Todos', count: found.length },
    ...audiences.map((a) => ({ key: a, label: a, count: foundCounts.get(a) ?? 0 })),
  ]

  return (
    <>
      <DialogHeader className="shrink-0 gap-4 space-y-0 border-b bg-[#f7f7f3] px-6 pb-4 pt-5 text-left">
        <div className="flex items-start gap-3 pr-8">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#152017] text-[#d9ff43]">
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="min-w-0 space-y-1">
            <DialogTitle className="flex items-baseline gap-2">
              Modelos de landing page
              <span className="text-sm font-normal tabular-nums text-muted-foreground">
                {filtering ? `${visible.length} de ${templates.length}` : templates.length}
              </span>
            </DialogTitle>
            <DialogDescription className="max-sm:sr-only">
              Uma narrativa completa numa página do canvas. Todas as seções continuam editáveis e exportam para o Elementor.
            </DialogDescription>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
          <Input
            value={query}
            onChange={(e) => changeFilter(() => setQuery(e.target.value))}
            placeholder="Buscar por nome, público ou seção"
            aria-label="Buscar modelos"
            className="h-9 bg-white pl-8 pr-8"
          />
          {query && (
            <button
              onClick={() => changeFilter(() => setQuery(''))}
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Abaixo de md vira uma faixa que rola para o lado; acima, uma coluna que rola para baixo */}
        <nav
          aria-label="Filtrar por público"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-100 px-4 py-2 md:w-56 md:flex-col md:gap-0.5 md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-r md:px-3 md:py-3"
        >
          <p className="hidden px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 md:block">Público</p>
          {filters.map((f) => {
            const selected = audience === f.key
            return (
                <button
                key={f.key ?? '*'}
                onClick={() => changeFilter(() => setAudience(f.key))}
                aria-pressed={selected}
                className={`flex shrink-0 items-baseline justify-between gap-3 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="md:whitespace-normal">{f.label}</span>
                <span className={`text-[10px] tabular-nums ${f.count ? 'text-gray-400' : 'text-gray-300'}`}>{f.count}</span>
              </button>
            )
          })}
        </nav>

        <div ref={gridRef} className="min-h-0 flex-1 overflow-y-auto bg-[#f7f7f3] p-5">
          {visible.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((template) => (
                <TemplateCard key={template.id} template={template} customize={customize} onUse={onUse} />
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
              <p className="text-sm text-gray-500">
                {query.trim() ? `Nenhum modelo para “${query.trim()}”${audience ? ' neste público' : ''}.` : 'Nenhum modelo por aqui ainda.'}
              </p>
              {filtering && (
                <button
                  onClick={clearFilters}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.06)] transition-[box-shadow,transform] duration-150 hover:shadow-[0_0_0_1px_rgb(0_0_0/0.12),0_2px_6px_rgb(0_0_0/0.08)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="shrink-0 border-t px-6 py-3 text-xs text-muted-foreground">
        {emptyActivePage
          ? `O modelo entra na página “${emptyActivePage}”, que está vazia.`
          : 'O modelo entra numa página nova. As outras páginas continuam no canvas.'}
      </p>
    </>
  )
}

interface TemplateCardProps {
  template: LandingTemplate
  customize?: ElementorCustomization
  onUse: (template: LandingTemplate) => void
}

const TemplateCard: React.FC<TemplateCardProps> = memo(({ template, customize, onUse }) => {
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
      onClick={() => onUse(template)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onUse(template)
        }
      }}
      // rounded-2xl com p-1.5: a miniatura usa 10px (16 = 10 + 6)
      className="group flex cursor-pointer select-none flex-col rounded-2xl bg-white p-1.5 text-left shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.04)] transition-[box-shadow,transform] duration-150 ease-out hover:shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_4px_14px_-2px_rgb(0_0_0/0.12)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[10px] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]">
        <ElementorThumbnail component={preview} title={`Prévia de ${template.name}`} customize={customize} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-150 group-hover:bg-black/25 group-focus-visible:bg-black/25">
          <span className="flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-gray-900 opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
            <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Usar este modelo
          </span>
        </span>
      </div>
      <div className="px-2 pb-2 pt-2.5">
        <h3 className="text-sm font-semibold leading-snug text-gray-900">{template.name}</h3>
        <p className="mt-0.5 flex min-w-0 items-baseline gap-1 text-[11px] text-gray-500">
          <span className="truncate font-medium">{template.audience}</span>
          <span aria-hidden className="text-gray-300">·</span>
          <span className="shrink-0 tabular-nums">{sectionCount(template.sections.length)}</span>
        </p>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-500">{template.description}</p>
      </div>
    </div>
  )
})

TemplateCard.displayName = 'TemplateCard'
