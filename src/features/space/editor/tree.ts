import type { SectionElement } from '@/features/space/landingPage'

/**
 * Operações do editor visual sobre o JSON nativo do Elementor de uma seção.
 * Tudo aqui é puro: recebe a árvore (ou o JSON) e devolve a árvore nova, sem
 * tocar no envelope do JSON (array cru, `content` ou `elements`).
 */

type Settings = Record<string, unknown>

const isRecord = (value: unknown): value is Settings => !!value && typeof value === 'object' && !Array.isArray(value)

/** Settings de leitura; o PHP do Elementor exporta settings vazio como []. */
export const settingsOf = (element: SectionElement | null | undefined): Settings => (isRecord(element?.settings) ? element.settings : {})

const writableSettings = (element: SectionElement): Settings => {
  if (!isRecord(element.settings)) element.settings = {}
  return element.settings as Settings
}

const childrenOf = (element: SectionElement): SectionElement[] => {
  if (!Array.isArray(element.elements)) element.elements = []
  return element.elements
}

// Mesmo formato de id do Elementor (7 caracteres hex).
export const newElementId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 7)
}

/** Cópia profunda com ids novos; devolve também o mapa de id antigo → novo. */
export function cloneWithFreshIds(element: SectionElement): { element: SectionElement; ids: Map<string, string> } {
  const copy: SectionElement = JSON.parse(JSON.stringify(element))
  const ids = new Map<string, string>()
  const visit = (el: SectionElement) => {
    const fresh = newElementId()
    if (el.id) ids.set(el.id, fresh)
    el.id = fresh
    for (const child of el.elements ?? []) visit(child)
  }
  visit(copy)
  return { element: copy, ids }
}

// ---------------------------------------------------------------------------
// Documento

interface OpenedSection {
  root: SectionElement[]
  serialize: () => string
}

/** Abre o JSON da seção guardando o envelope original para escrever de volta. */
export function openSection(json: string): OpenedSection | null {
  if (!json.trim()) return null
  try {
    const document = JSON.parse(json) as unknown
    const root = Array.isArray(document)
      ? document
      : isRecord(document) && Array.isArray(document.content)
        ? document.content
        : isRecord(document) && Array.isArray(document.elements)
          ? document.elements
          : null
    if (!root) return null
    return { root: root as SectionElement[], serialize: () => JSON.stringify(document) }
  } catch {
    return null
  }
}

/**
 * Aplica `edit` na árvore da seção e devolve o JSON novo. `edit` devolve false
 * quando não mudou nada (ou não pode), e aí o resultado é null.
 */
export function editSection<T = true>(json: string, edit: (root: SectionElement[]) => T | false | null | undefined): { json: string; result: T } | null {
  const opened = openSection(json)
  if (!opened) return null
  const result = edit(opened.root)
  if (result === false || result === null || result === undefined) return null
  return { json: opened.serialize(), result }
}

// ---------------------------------------------------------------------------
// Leitura

export interface Location {
  element: SectionElement
  /** null: o elemento está na raiz da seção. */
  parent: SectionElement | null
  siblings: SectionElement[]
  index: number
  /** Do mais externo ao pai direto. */
  ancestors: SectionElement[]
}

export function locate(root: SectionElement[], id: string): Location | null {
  const visit = (siblings: SectionElement[], parent: SectionElement | null, ancestors: SectionElement[]): Location | null => {
    for (let index = 0; index < siblings.length; index++) {
      const element = siblings[index]
      if (element.id === id) return { element, parent, siblings, index, ancestors }
      const found = visit(element.elements ?? [], element, [...ancestors, element])
      if (found) return found
    }
    return null
  }
  return visit(root, null, [])
}

export const containsId = (element: SectionElement, id: string): boolean =>
  element.id === id || (element.elements ?? []).some((child) => containsId(child, id))

export const isContainer = (element: SectionElement | null | undefined) => element?.elType === 'container'
export const isWidget = (element: SectionElement | null | undefined) => element?.elType === 'widget'

/**
 * Onde cada tipo pode entrar, como no Elementor: container aceita widgets e
 * containers; coluna antiga aceita widgets; seção antiga só colunas; na raiz
 * ficam containers (e seções antigas). Widget aninhado (acordeão, carrossel)
 * não recebe filhos novos: os itens dele são ligados às settings.
 */
export function accepts(parent: SectionElement | null, child: SectionElement): boolean {
  if (!parent) return child.elType === 'container' || child.elType === 'section'
  if (parent.elType === 'container') return child.elType === 'widget' || child.elType === 'container'
  if (parent.elType === 'column') return child.elType === 'widget'
  if (parent.elType === 'section') return child.elType === 'column'
  return false
}

/** Filho de widget aninhado (item de acordeão ou carrossel): não sai do lugar nem se multiplica. */
export const isLocked = (location: Location | null) => !!location && isWidget(location.parent)

// ---------------------------------------------------------------------------
// Escrita

export interface InsertTarget {
  /** null: raiz da seção. */
  parentId: string | null
  index: number
}

/**
 * Põe os elementos no alvo. Widget que iria para a raiz entra embrulhado num
 * container, porque o Elementor não aceita widget solto no topo.
 */
export function insertElements(root: SectionElement[], elements: SectionElement[], target: InsertTarget): boolean {
  const parent = target.parentId ? locate(root, target.parentId)?.element ?? null : null
  if (target.parentId && !parent) return false
  const list = parent ? childrenOf(parent) : root
  const ready = elements.map((element) => (!parent && isWidget(element) ? wrapper([element]) : element))
  if (!ready.every((element) => accepts(parent, element))) return false
  const index = Math.max(0, Math.min(target.index, list.length))
  list.splice(index, 0, ...ready)
  return true
}

export function removeElement(root: SectionElement[], id: string): SectionElement | null {
  const location = locate(root, id)
  if (!location || isLocked(location)) return null
  location.siblings.splice(location.index, 1)
  return location.element
}

/** Move o elemento para o alvo; o índice conta os irmãos de antes da mudança. */
export function moveElement(root: SectionElement[], id: string, target: InsertTarget): boolean {
  const location = locate(root, id)
  if (!location || isLocked(location)) return false
  if (target.parentId && containsId(location.element, target.parentId)) return false
  const parent = target.parentId ? locate(root, target.parentId)?.element ?? null : null
  if (target.parentId && !parent) return false
  const sameParent = (parent?.id ?? null) === (location.parent?.id ?? null)
  let index = target.index
  if (sameParent) {
    if (index === location.index || index === location.index + 1) return false
    if (index > location.index) index -= 1
  }
  if (!accepts(parent, location.element) && !(!parent && isWidget(location.element))) return false
  location.siblings.splice(location.index, 1)
  return insertElements(root, [location.element], { parentId: target.parentId, index })
}

/** Cópia logo depois do original; devolve o id da cópia e o mapa de ids. */
export function duplicateElement(root: SectionElement[], id: string): { id: string; ids: Map<string, string> } | null {
  const location = locate(root, id)
  if (!location || isLocked(location)) return null
  const { element, ids } = cloneWithFreshIds(location.element)
  location.siblings.splice(location.index + 1, 0, element)
  return { id: element.id!, ids }
}

export type SettingsPatch = Record<string, unknown | undefined>

/** Troca settings do elemento; `undefined` apaga a chave. Cor definida à mão deixa de seguir a cor global. */
export function patchSettings(root: SectionElement[], id: string, patch: SettingsPatch): boolean {
  const element = locate(root, id)?.element
  if (!element) return false
  const settings = writableSettings(element)
  let changed = false
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      if (key in settings) {
        delete settings[key]
        changed = true
      }
    } else if (JSON.stringify(settings[key]) !== JSON.stringify(value)) {
      settings[key] = value
      changed = true
    }
    const globals = settings.__globals__
    if (isRecord(globals) && key in globals) {
      delete globals[key]
      changed = true
    }
  }
  return changed
}

/** Container neutro para agrupar: largura total, sem padding, os filhos em coluna. */
function wrapper(children: SectionElement[], direction: 'column' | 'row' = 'column'): SectionElement {
  return {
    id: newElementId(),
    elType: 'container',
    isInner: true,
    settings: {
      content_width: 'full',
      flex_direction: direction,
      ...(direction === 'row' ? { flex_align_items: 'center' } : {}),
      flex_gap: gap(16),
      padding: sides(0),
    },
    elements: children,
  }
}

/** Troca o elemento por um stack com ele dentro; devolve o id do stack. */
export function wrapInStack(root: SectionElement[], id: string, direction: 'column' | 'row' = 'column'): string | null {
  const location = locate(root, id)
  if (!location || isLocked(location)) return null
  const stack = wrapper([location.element], direction)
  // Um container de topo embrulhado continua de topo; o novo vira o de fora
  if (!location.parent) delete stack.isInner
  location.siblings.splice(location.index, 1, stack)
  return stack.id!
}

/** Tira o stack e deixa os filhos no lugar dele (quando o pai aceita todos). */
export function unwrapStack(root: SectionElement[], id: string): boolean {
  const location = locate(root, id)
  if (!location || !isContainer(location.element) || isLocked(location)) return false
  const children = location.element.elements ?? []
  if (!children.every((child) => accepts(location.parent, child))) return false
  location.siblings.splice(location.index, 1, ...children)
  return true
}

// ---------------------------------------------------------------------------
// Elementos novos

export const px = (size: number | string, unit = 'px') => ({ unit, size, sizes: [] })
export const gap = (size: number) => ({ unit: 'px', size, column: String(size), row: String(size), isLinked: true })
export const sides = (all: number, unit = 'px') => {
  const v = String(all)
  return { unit, top: v, right: v, bottom: v, left: v, isLinked: true }
}

export type InsertKind =
  | 'stack'
  | 'row'
  | 'grid'
  | 'heading'
  | 'text'
  | 'button'
  | 'image'
  | 'icon'
  | 'spacer'
  | 'divider'
  | 'video'

const widget = (widgetType: string, settings: Settings): SectionElement => ({ id: newElementId(), elType: 'widget', widgetType, settings, elements: [] })

/** Elemento novo com os padrões do Elementor, pronto para o motor e para o site. */
export function createElement(kind: InsertKind): SectionElement {
  switch (kind) {
    case 'stack':
      return wrapper([], 'column')
    case 'row':
      return wrapper([], 'row')
    case 'grid':
      return {
        id: newElementId(),
        elType: 'container',
        isInner: true,
        settings: {
          container_type: 'grid',
          content_width: 'full',
          grid_columns_grid: px(2, 'fr'),
          grid_rows_grid: px(1, 'fr'),
          grid_gaps: gap(16),
          padding: sides(0),
        },
        elements: [],
      }
    case 'heading':
      return widget('heading', { title: 'Novo título', header_size: 'h2' })
    case 'text':
      return widget('text-editor', { editor: '<p>Escreva o texto aqui.</p>' })
    case 'button':
      return widget('button', { text: 'Clique aqui', link: { url: '#', is_external: '', nofollow: '', custom_attributes: '' } })
    case 'image':
      return widget('image', { image: { url: '', id: '', alt: '', source: 'library' } })
    case 'icon':
      return widget('icon', { selected_icon: { value: 'fas fa-star', library: 'fa-solid' } })
    case 'spacer':
      return widget('spacer', { space: px(40) })
    case 'divider':
      return widget('divider', {})
    case 'video':
      return widget('video', { youtube_url: 'https://www.youtube.com/watch?v=XHOmBV4js_E' })
  }
}

/** Seção vazia: um container de topo contido, com respiro para receber os elementos. */
export function createBlankSection(): SectionElement[] {
  return [
    {
      id: newElementId(),
      elType: 'container',
      settings: {
        content_width: 'boxed',
        flex_direction: 'column',
        flex_gap: gap(24),
        padding: { unit: 'px', top: '80', right: '24', bottom: '80', left: '24', isLinked: false },
      },
      elements: [],
    },
  ]
}

/**
 * Onde um elemento novo entra a partir do que está selecionado: dentro do
 * container escolhido, logo depois do widget escolhido, ou no fim do primeiro
 * container de topo da seção.
 */
export function insertionTarget(root: SectionElement[], selectedId: string | null, child: SectionElement): InsertTarget {
  const location = selectedId ? locate(root, selectedId) : null
  if (location) {
    if (accepts(location.element, child)) return { parentId: location.element.id ?? null, index: location.element.elements?.length ?? 0 }
    // Sobe até achar um pai que aceite, entrando logo depois do ramo selecionado
    const chain = [...location.ancestors, location.element]
    for (let i = chain.length - 1; i >= 0; i--) {
      const parent = i > 0 ? chain[i - 1] : null
      const siblings = parent ? parent.elements ?? [] : root
      if (accepts(parent, child) || (!parent && isWidget(child))) return { parentId: parent?.id ?? null, index: siblings.indexOf(chain[i]) + 1 }
    }
  }
  const first = root.find((element) => accepts(element, child))
  if (first) return { parentId: first.id ?? null, index: first.elements?.length ?? 0 }
  return { parentId: null, index: root.length }
}
