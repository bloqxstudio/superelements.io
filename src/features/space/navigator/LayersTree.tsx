import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  ChevronRight,
  CircleDot,
  Code2,
  Columns3,
  Copy,
  FormInput,
  Heading1,
  Image,
  Layers3,
  LayoutGrid,
  List,
  Map,
  MousePointerClick,
  Rows3,
  Search,
  Text,
  Trash2,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useSpaceStore } from '@/store/spaceStore'
import { parseSectionElements, type SectionElement } from '@/features/space/landingPage'
import { pageSections } from '@/features/space/pages/pages'
import { MOD_KEY } from '@/features/space/pages/clipboard'
import type { SectionNodeData } from '@/types/space'
import { PanelBoundary } from '@/features/space/editor/PanelBoundary'
import { deleteSelectedElement, duplicateSelectedElement, moveElementAcross, selectElement } from '@/features/space/editor/actions'
import { accepts, containsId, locate, settingsOf } from '@/features/space/editor/tree'
import { findElement } from './elementorContentEditor'
import { layerKind, layerName, layerSearchText, type LayerContext } from './navigatorLabels'


interface NavigatorSection {
  id: string
  title: string
  elements: SectionElement[] | null
  labels?: Record<string, string>
}

const WIDGET_ICONS: Record<string, LucideIcon> = {
  heading: Heading1,
  'text-editor': Text,
  image: Image,
  button: MousePointerClick,
  icon: CircleDot,
  'icon-list': List,
  form: FormInput,
  video: Video,
  google_maps: Map,
  html: Code2,
}

const elementIcon = (element: SectionElement): LucideIcon => {
  if (element.widgetType) return WIDGET_ICONS[element.widgetType] ?? CircleDot
  if (element.elType !== 'container') return Box
  const settings = settingsOf(element)
  if (settings.container_type === 'grid') return LayoutGrid
  return String(settings.flex_direction ?? '').startsWith('row') ? Columns3 : Rows3
}

const includesQuery = (element: SectionElement, query: string, context: LayerContext): boolean => {
  if (layerSearchText(element, context).includes(query)) return true
  const children = element.elements ?? []
  return children.some((child, index) =>
    includesQuery(child, query, { ...context, depth: context.depth + 1, index, siblings: children, parent: element })
  )
}

// ---------------------------------------------------------------------------
// Arrastar camadas na árvore

interface TreeDrop {
  sectionId: string
  parentId: string | null
  index: number
  /** Linha da árvore que recebe e onde: antes, depois ou dentro dela. */
  rowKey: string
  position: 'before' | 'after' | 'inside'
}

interface TreeDragApi {
  drop: TreeDrop | null
  dragging: string | null
  start: (event: React.PointerEvent, sectionId: string, element: SectionElement) => void
}

const TreeDragContext = createContext<TreeDragApi>({ drop: null, dragging: null, start: () => {} })

const DRAG_SLOP = 5

interface ElementRowProps {
  element: SectionElement
  sectionId: string
  sectionTitle: string
  depth: number
  index: number
  siblings: SectionElement[]
  parent?: SectionElement
  customLabels?: Record<string, string>
  query: string
  expanded: Set<string>
  onToggle: (key: string) => void
}

const ElementRow: React.FC<ElementRowProps> = ({ element, sectionId, sectionTitle, depth, index, siblings, parent, customLabels, query, expanded, onToggle }) => {
  const selection = useSpaceStore((state) => state.navigatorSelection)
  const hovered = useSpaceStore((state) => state.hoveredElement)
  const hover = useSpaceStore((state) => state.hoverNavigatorElement)
  const drag = useContext(TreeDragContext)
  const rowRef = useRef<HTMLDivElement>(null)
  const children = element.elements ?? []
  const key = `${sectionId}:${element.id ?? `depth-${depth}`}`
  const open = query ? true : expanded.has(key)
  const selected = !!element.id && selection?.sectionId === sectionId && selection.elementId === element.id
  const isHovered = !!element.id && hovered?.sectionId === sectionId && hovered.elementId === element.id
  const Icon = elementIcon(element)
  const context = { sectionTitle, depth, index, siblings, parent, customLabels }
  const name = layerName(element, context)
  const dropHere = drag.drop?.rowKey === key ? drag.drop.position : null

  // A camada escolhida no canvas aparece na árvore sem precisar rolar
  useEffect(() => {
    if (selected) rowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (query && !includesQuery(element, query, context)) return null

  const act = (action: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation()
    if (!element.id) return
    selectElement(sectionId, element.id)
    action()
  }

  return (
    <li role="treeitem" aria-expanded={children.length ? open : undefined} aria-selected={selected} className="relative">
      {dropHere === 'before' && <span aria-hidden className="pointer-events-none absolute inset-x-2 top-0 z-10 h-0.5 rounded bg-violet-600" style={{ left: 8 + depth * 16 }} />}
      <div
        ref={rowRef}
        data-layer-row={key}
        data-section-id={sectionId}
        data-element-id={element.id ?? ''}
        data-parent-id={parent?.id ?? ''}
        data-index={index}
        data-accepts={element.elType === 'container' || element.elType === 'column' ? element.elType : ''}
        data-children={children.length}
        className={`group flex h-8 items-center rounded-lg pr-1 text-xs transition-[color,background-color,box-shadow] ${
          selected ? 'bg-violet-100 text-violet-950' : isHovered ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
        } ${dropHere === 'inside' ? 'shadow-[inset_0_0_0_2px_rgb(124_58_237)]' : ''} ${drag.dragging === element.id ? 'opacity-40' : ''}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onPointerEnter={() => element.id && hover({ sectionId, elementId: element.id })}
        onPointerLeave={() => hover(null)}
      >
        {children.length ? (
          <button
            type="button"
            className="mr-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition-[color,background-color,transform] hover:bg-white hover:text-gray-700 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            aria-label={open ? `Recolher ${name}` : `Expandir ${name}`}
            onClick={() => onToggle(key)}
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="mr-0.5 h-6 w-6 shrink-0" />
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-default items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          onClick={() => element.id && selectElement(sectionId, element.id)}
          onPointerDown={(event) => drag.start(event, sectionId, element)}
          disabled={!element.id}
          title="Clique para selecionar. Arraste para mudar de lugar."
        >
          <Icon className={`h-3.5 w-3.5 shrink-0 ${selected ? 'text-violet-700' : 'text-gray-400'}`} strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
          <span className="max-w-20 truncate text-[10px] font-normal text-gray-400 group-hover:hidden">{layerKind(element)}</span>
        </button>
        {element.id && (
          <span className="hidden shrink-0 items-center group-hover:flex">
            <button type="button" onClick={act(duplicateSelectedElement)} className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700" aria-label={`Duplicar ${name}`} title={`Duplicar (${MOD_KEY}D)`}>
              <Copy className="h-3 w-3" />
            </button>
            <button type="button" onClick={act(deleteSelectedElement)} className="rounded p-1 text-gray-400 hover:bg-white hover:text-red-600" aria-label={`Apagar ${name}`} title="Apagar (Delete)">
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        )}
      </div>
      {dropHere === 'after' && <span aria-hidden className="pointer-events-none absolute inset-x-2 bottom-0 z-10 h-0.5 rounded bg-violet-600" style={{ left: 8 + depth * 16 }} />}
      {children.length > 0 && open && (
        <ul role="group">
          {children.map((child, childIndex) => (
            <ElementRow
              key={child.id ?? `${key}-${childIndex}`}
              element={child}
              sectionId={sectionId}
              sectionTitle={sectionTitle}
              depth={depth + 1}
              index={childIndex}
              siblings={children}
              parent={element}
              customLabels={customLabels}
              query={query}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Camadas da página ativa (a árvore nativa de containers e widgets), na aba
 * Camadas do painel da esquerda. Passar o mouse numa camada a destaca no
 * canvas; arrastar muda de lugar, inclusive para outra seção. As propriedades
 * da camada escolhida ficam na aba Estilo, à direita.
 */
export const LayersTree: React.FC = () => {
  const pages = useSpaceStore((state) => state.pages)
  const nodes = useSpaceStore((state) => state.nodes)
  const activePageId = useSpaceStore((state) => state.activePageId)
  const selectedIds = useSpaceStore((state) => state.selectedIds)
  const selection = useSpaceStore((state) => state.navigatorSelection)
  const setSelection = useSpaceStore((state) => state.setSelection)
  const selectNavigatorElement = useSpaceStore((state) => state.selectNavigatorElement)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [drop, setDrop] = useState<TreeDrop | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const knownTreeKeys = useRef<Set<string>>(new Set())

  const page = pages.find((candidate) => candidate.id === activePageId) ?? pages[0]
  const sections = useMemo<NavigatorSection[]>(
    () =>
      page
        ? pageSections(page, nodes).map((section) => {
            const data = section.data as SectionNodeData
            return {
              id: section.id,
              title: data.title || 'Seção sem nome',
              elements: parseSectionElements(data.elementorJson),
              labels: data.navigatorLabels,
            }
          })
        : [],
    [page, nodes]
  )

  useEffect(() => {
    const valid = new Set<string>()
    const defaults = new Set<string>()
    const collect = (sectionId: string, elements: SectionElement[]) => {
      for (const element of elements) {
        if (element.id) valid.add(`${sectionId}:${element.id}`)
        collect(sectionId, element.elements ?? [])
      }
    }

    for (const section of sections) {
      const sectionKey = `section:${section.id}`
      valid.add(sectionKey)
      defaults.add(sectionKey)
      for (const element of section.elements ?? []) {
        if (element.id) defaults.add(`${section.id}:${element.id}`)
      }
      collect(section.id, section.elements ?? [])
    }

    setExpanded((current) => {
      const next = new Set([...current].filter((key) => valid.has(key)))
      for (const key of defaults) {
        if (!knownTreeKeys.current.has(key)) next.add(key)
      }
      knownTreeKeys.current = valid

      const unchanged = next.size === current.size && [...next].every((key) => current.has(key))
      return unchanged ? current : next
    })
  }, [sections])

  // Camada escolhida no canvas: abre os pais dela na árvore
  useEffect(() => {
    if (!selection) return
    const section = sections.find((s) => s.id === selection.sectionId)
    const location = section?.elements ? locate(section.elements, selection.elementId) : null
    if (!location) return
    const keys = [`section:${selection.sectionId}`, ...location.ancestors.map((a) => `${selection.sectionId}:${a.id}`)]
    setExpanded((current) => (keys.every((k) => current.has(k)) ? current : new Set([...current, ...keys])))
  }, [selection, sections])

  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const selectSection = (sectionId: string) => {
    selectNavigatorElement(null)
    setSelection([sectionId])
  }

  /** Arrasto de uma linha da árvore, com eventos de ponteiro (o arrastar nativo falha dentro do preview do Ship Studio). */
  const dragApi = useMemo<TreeDragApi>(
    () => ({
      drop,
      dragging,
      start: (event, sectionId, element) => {
        if (event.button !== 0 || !element.id) return
        const source = event.currentTarget as HTMLElement
        const origin = { x: event.clientX, y: event.clientY }
        const pointerId = event.pointerId
        let active = false
        let target: TreeDrop | null = null

        const compute = (x: number, y: number): TreeDrop | null => {
          const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-layer-row]')
          if (!row) return null
          const rowSection = row.dataset.sectionId!
          const tree = sections.find((s) => s.id === rowSection)?.elements ?? []
          // Linha de seção: entra no fim da raiz dela
          if (row.dataset.layerSection) return { sectionId: rowSection, parentId: null, index: tree.length, rowKey: row.dataset.layerRow!, position: 'inside' }
          const rowId = row.dataset.elementId!
          if (!rowId || (rowSection === sectionId && containsId(element, rowId))) return null
          const box = row.getBoundingClientRect()
          const rel = (y - box.top) / box.height
          const rowElement = findElement(tree, rowId)
          const canHold = !!row.dataset.accepts && !!rowElement && accepts(rowElement, element)
          const position = canHold && rel > 0.28 && rel < 0.72 ? 'inside' : rel < 0.5 ? 'before' : 'after'
          if (position === 'inside') return { sectionId: rowSection, parentId: rowId, index: Number(row.dataset.children) || 0, rowKey: row.dataset.layerRow!, position }
          const index = Number(row.dataset.index) || 0
          return { sectionId: rowSection, parentId: row.dataset.parentId || null, index: position === 'before' ? index : index + 1, rowKey: row.dataset.layerRow!, position }
        }

        const move = (ev: PointerEvent) => {
          if (!active) {
            if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < DRAG_SLOP) return
            active = true
            setDragging(element.id!)
            document.body.style.cursor = 'grabbing'
            document.body.style.userSelect = 'none'
            window.getSelection()?.removeAllRanges()
          }
          target = compute(ev.clientX, ev.clientY)
          setDrop(target)
        }
        const up = () => {
          source.removeEventListener('pointermove', move)
          source.removeEventListener('pointerup', up)
          source.removeEventListener('pointercancel', cancel)
          if (source.hasPointerCapture(pointerId)) source.releasePointerCapture(pointerId)
          document.body.style.cursor = ''
          document.body.style.userSelect = ''
          setDrop(null)
          setDragging(null)
          if (active && target) moveElementAcross(sectionId, element.id!, target.sectionId, { parentId: target.parentId, index: target.index })
        }
        const cancel = () => {
          target = null
          up()
        }
        source.setPointerCapture(pointerId)
        source.addEventListener('pointermove', move)
        source.addEventListener('pointerup', up)
        source.addEventListener('pointercancel', cancel)
      },
    }),
    [drop, dragging, sections]
  )

  const visibleSections = sections.filter(
    (section) =>
      !normalizedQuery ||
      section.title.toLocaleLowerCase('pt-BR').includes(normalizedQuery) ||
      (section.elements ?? []).some((element, index, siblings) =>
        includesQuery(element, normalizedQuery, {
          sectionTitle: section.title,
          depth: 1,
          index,
          siblings,
          customLabels: section.labels,
        })
      )
  )

  return (
    <div data-space-navigator className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-gray-100 p-2">
        <label className="flex h-8 items-center gap-2 rounded-lg bg-gray-100 px-2.5 text-gray-500 focus-within:bg-white focus-within:shadow-[0_0_0_2px_rgb(124_58_237/0.45)]">
          <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span className="sr-only">Buscar camadas</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar camadas"
            className="min-w-0 flex-1 bg-transparent text-xs text-gray-900 outline-none placeholder:text-gray-400"
          />
          {query && (
            <button type="button" aria-label="Limpar busca" className="rounded text-gray-400 hover:text-gray-700" onClick={() => setQuery('')}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
      </div>

      <TreeDragContext.Provider value={dragApi}>
        <div className="min-h-0 overflow-y-auto p-2" style={{ flex: '1 1 auto' }}>
          <PanelBoundary what="as camadas desta página" resetKey={`${page?.id}:${sections.length}`}>
          {visibleSections.length ? (
            <ul role="tree" aria-label={`Camadas de ${page?.name ?? 'página'}`} className="space-y-1">
              {visibleSections.map((section, index) => {
                const sectionKey = `section:${section.id}`
                const open = normalizedQuery ? true : expanded.has(sectionKey)
                const selected = selectedIds.includes(section.id) && !selection
                const dropInside = drop?.rowKey === sectionKey
                return (
                  <li key={section.id} role="treeitem" aria-expanded={open} aria-selected={selected}>
                    <div
                      data-layer-row={sectionKey}
                      data-layer-section="1"
                      data-section-id={section.id}
                      className={`flex h-9 items-center rounded-lg pr-2 text-xs transition-[color,background-color,box-shadow] ${
                        selected ? 'bg-gray-900 text-white' : 'text-gray-800 hover:bg-gray-100'
                      } ${dropInside ? 'shadow-[inset_0_0_0_2px_rgb(124_58_237)]' : ''}`}
                    >
                      <button
                        type="button"
                        className={`ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-[color,background-color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                          selected ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'text-gray-400 hover:bg-white hover:text-gray-700'
                        }`}
                        aria-label={open ? `Recolher ${section.title}` : `Expandir ${section.title}`}
                        onClick={() => toggle(sectionKey)}
                      >
                        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
                      </button>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        onClick={() => selectSection(section.id)}
                      >
                        <Layers3 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        <span className="min-w-0 flex-1 truncate font-semibold">{section.title}</span>
                        <span className={`text-[10px] tabular-nums ${selected ? 'text-gray-300' : 'text-gray-400'}`}>{index + 1}</span>
                      </button>
                    </div>
                    {open &&
                      (section.elements?.length ? (
                        <ul role="group">
                          {section.elements.map((element, elementIndex) => (
                            <ElementRow
                              key={element.id ?? `${section.id}-${elementIndex}`}
                              element={element}
                              sectionId={section.id}
                              sectionTitle={section.title}
                              depth={1}
                              index={elementIndex}
                              siblings={section.elements!}
                              customLabels={section.labels}
                              query={normalizedQuery}
                              expanded={expanded}
                              onToggle={toggle}
                            />
                          ))}
                        </ul>
                      ) : (
                        <p className="py-2 pl-12 pr-3 text-[11px] text-gray-400">{section.elements ? 'Seção vazia: insira um elemento' : 'JSON vazio ou inválido'}</p>
                      ))}
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center">
              <Layers3 className="h-5 w-5 text-gray-300" strokeWidth={1.5} />
              <p className="mt-2 text-xs font-medium text-gray-600">{normalizedQuery ? 'Nenhuma camada encontrada' : 'Esta página está vazia'}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                {normalizedQuery ? 'Tente outro nome, tipo de widget ou ID.' : 'Adicione uma seção, ou crie uma em branco pelo painel Inserir.'}
              </p>
            </div>
          )}
          </PanelBoundary>
        </div>
      </TreeDragContext.Provider>

    </div>
  )
}
