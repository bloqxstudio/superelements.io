import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  ChevronRight,
  CircleDot,
  Code2,
  FormInput,
  Heading1,
  Image,
  Layers3,
  List,
  Map,
  MousePointerClick,
  Search,
  Text,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useSpaceStore } from '@/store/spaceStore'
import { parseSectionElements, type SectionElement } from '@/features/space/landingPage'
import { pageSections } from '@/features/space/pages/pages'
import { ISLAND_SURFACE } from '@/features/space/ToolbarIsland'
import type { SectionNodeData } from '@/types/space'
import { layerKind, layerName, layerSearchText, type LayerContext } from './navigatorLabels'

export const NAVIGATOR_PANEL_WIDTH = 340

interface ElementorNavigatorPanelProps {
  onClose: () => void
}

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

const elementIcon = (element: SectionElement) => WIDGET_ICONS[element.widgetType ?? ''] ?? (element.widgetType ? CircleDot : Box)

const includesQuery = (element: SectionElement, query: string, context: LayerContext): boolean => {
  if (layerSearchText(element, context).includes(query)) return true
  const children = element.elements ?? []
  return children.some((child, index) =>
    includesQuery(child, query, { ...context, depth: context.depth + 1, index, siblings: children, parent: element })
  )
}

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
  const select = useSpaceStore((state) => state.selectNavigatorElement)
  const children = element.elements ?? []
  const key = `${sectionId}:${element.id ?? `depth-${depth}`}`
  const open = query ? true : expanded.has(key)
  const selected = !!element.id && selection?.sectionId === sectionId && selection.elementId === element.id
  const Icon = elementIcon(element)
  const context = { sectionTitle, depth, index, siblings, parent, customLabels }
  const name = layerName(element, context)

  if (query && !includesQuery(element, query, context)) return null

  return (
    <li role="treeitem" aria-expanded={children.length ? open : undefined} aria-selected={selected}>
      <div
        className={`group flex h-8 items-center rounded-lg pr-2 text-xs transition-[color,background-color] ${
          selected ? 'bg-violet-100 text-violet-950' : 'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ paddingLeft: 8 + depth * 16 }}
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
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          onClick={() => element.id && select({ sectionId, elementId: element.id })}
          disabled={!element.id}
        >
          <Icon className={`h-3.5 w-3.5 shrink-0 ${selected ? 'text-violet-700' : 'text-gray-400'}`} strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
          <span className="max-w-20 truncate text-[10px] font-normal text-gray-400">{layerKind(element)}</span>
        </button>
      </div>
      {children.length > 0 && open && (
        <ul role="group">
          {children.map((child, index) => (
            <ElementRow
              key={child.id ?? `${key}-${index}`}
              element={child}
              sectionId={sectionId}
              sectionTitle={sectionTitle}
              depth={depth + 1}
              index={index}
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

export const ElementorNavigatorPanel: React.FC<ElementorNavigatorPanelProps> = ({ onClose }) => {
  const pages = useSpaceStore((state) => state.pages)
  const nodes = useSpaceStore((state) => state.nodes)
  const activePageId = useSpaceStore((state) => state.activePageId)
  const selectedIds = useSpaceStore((state) => state.selectedIds)
  const selection = useSpaceStore((state) => state.navigatorSelection)
  const selectElement = useSpaceStore((state) => state.selectNavigatorElement)
  const setSelection = useSpaceStore((state) => state.setSelection)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
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

  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const selectSection = (sectionId: string) => {
    selectElement(null)
    setSelection([sectionId])
  }

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
    <aside
      data-space-navigator
      className={`absolute bottom-3 right-3 top-16 z-40 flex flex-col overflow-hidden rounded-xl ${ISLAND_SURFACE}`}
      style={{ width: NAVIGATOR_PANEL_WIDTH }}
      onWheel={(event) => event.stopPropagation()}
    >
      <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Layers3 className="h-4 w-4 text-violet-600" />
            Navigator
          </p>
          <p className="mt-0.5 truncate text-[11px] text-gray-500">{page?.name ?? 'Nenhuma página ativa'}</p>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-gray-400 transition-[color,background-color,transform] hover:bg-gray-100 hover:text-gray-700 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          aria-label="Fechar Navigator"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="border-b border-gray-100 p-3">
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

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {visibleSections.length ? (
          <ul role="tree" aria-label={`Camadas de ${page?.name ?? 'página'}`} className="space-y-1">
            {visibleSections.map((section, index) => {
              const sectionKey = `section:${section.id}`
              const open = normalizedQuery ? true : expanded.has(sectionKey)
              const selected = selectedIds.includes(section.id) && !selection
              return (
                <li key={section.id} role="treeitem" aria-expanded={open} aria-selected={selected}>
                  <div
                    className={`flex h-9 items-center rounded-lg pr-2 text-xs transition-[color,background-color] ${
                      selected ? 'bg-gray-900 text-white' : 'text-gray-800 hover:bg-gray-100'
                    }`}
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
                  {open && (
                    section.elements?.length ? (
                      <ul role="group">
                        {section.elements.map((element, elementIndex) => (
                          <ElementRow
                            key={element.id ?? `${section.id}-${elementIndex}`}
                            element={element}
                            sectionId={section.id}
                            sectionTitle={section.title}
                            depth={1}
                            index={elementIndex}
                            siblings={section.elements}
                            customLabels={section.labels}
                            query={normalizedQuery}
                            expanded={expanded}
                            onToggle={toggle}
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="py-2 pl-12 pr-3 text-[11px] text-gray-400">JSON vazio ou inválido</p>
                    )
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center">
            <Layers3 className="h-5 w-5 text-gray-300" strokeWidth={1.5} />
            <p className="mt-2 text-xs font-medium text-gray-600">{normalizedQuery ? 'Nenhuma camada encontrada' : 'Esta página está vazia'}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
              {normalizedQuery ? 'Tente outro nome, tipo de widget ou ID.' : 'Adicione uma seção para ver sua estrutura Elementor.'}
            </p>
          </div>
        )}
      </div>

      <footer className="border-t border-gray-100 px-3 py-2 text-[10px] text-gray-400">
        {selection ? (
          <span className="flex items-center justify-between gap-2">
            <span className="truncate">Camada selecionada</span>
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">{selection.elementId}</code>
          </span>
        ) : (
          'Selecione uma camada para destacá-la no canvas.'
        )}
      </footer>
    </aside>
  )
}
