import { parseSectionElements, type SectionElement } from '@/features/space/landingPage'
import { newElementId } from '@/features/space/editor/tree'
import type { ComponentRole, SectionNodeData, SpaceComponent, SpaceNode } from '@/types/space'

/**
 * Componentes do projeto: qualquer parte da página (uma seção inteira, um
 * container, um botão, um título) que se repete. Não há folha separada: cada
 * uso fica na página, como uma cópia ligada e editável ali mesmo. Quando um
 * uso muda, o Space replica a mudança em todos os outros, guardando os ids e
 * os ajustes à mão de cada uso. O conteúdo de agora fica no registro do
 * projeto (`SpaceComponent.elementorJson`), que é de onde sai um uso novo e o
 * modelo publicado no Elementor.
 *
 * - Seção inteira: a seção do canvas tem `data.component` com o id.
 * - Camada dentro de uma seção: o elemento tem a setting `_se_component` com o id.
 */

/** Setting do Elementor que marca a camada como uso de um componente; o Elementor ignora settings que não conhece. */
export const COMPONENT_KEY = '_se_component'

/** Cor dos componentes no Space (ciano), diferente do violeta da seleção comum e do laranja do agente. */
export const COMPONENT_COLOR = '#0891b2'
export const COMPONENT_COLOR_STRONG = '#0e7490'

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** O componente de que a camada é um uso, se for. */
export const elementComponent = (element: SectionElement | null | undefined) => {
  const value = isRecord(element?.settings) ? element!.settings[COMPONENT_KEY] : undefined
  return typeof value === 'string' && value ? value : undefined
}

/** O componente de que a seção inteira é um uso, se for. */
export const sectionComponent = (node: SpaceNode | undefined) => (node?.type === 'section' ? (node.data as SectionNodeData).component : undefined)

/** A camada marcada como uso do componente. */
export function tagElement(element: SectionElement, componentId: string): SectionElement {
  return { ...element, settings: { ...(isRecord(element.settings) ? element.settings : {}), [COMPONENT_KEY]: componentId } }
}

/** A camada sem a marca (separada do componente, ou publicada dentro da página). */
export function untagElement(element: SectionElement): SectionElement {
  if (!isRecord(element.settings) || !(COMPONENT_KEY in element.settings)) return element
  const { [COMPONENT_KEY]: _removed, ...settings } = element.settings
  return { ...element, settings }
}

/** Visita cada elemento da árvore, com o caminho de índices até ele. */
export function walk(elements: SectionElement[], visit: (element: SectionElement, path: number[]) => void, path: number[] = []) {
  elements.forEach((element, index) => {
    const here = [...path, index]
    visit(element, here)
    walk(element.elements ?? [], visit, here)
  })
}

/** O conteúdo sem os ids (que mudam a cada uso), para comparar dois usos. */
export const contentKey = (value: unknown) => JSON.stringify(value, (key, v) => (key === 'id' ? undefined : v))

/**
 * Cópia da origem com os ids do destino onde a estrutura é a mesma (cada uso
 * guarda os seus ids: o CSS do Elementor e os ajustes à mão dependem deles) e
 * ids novos onde a origem tem coisa que o destino não tinha. Devolve o mapa
 * id da origem → id do destino.
 */
export function remapIds(source: SectionElement[], target: SectionElement[] | undefined): { elements: SectionElement[]; ids: Map<string, string> } {
  const ids = new Map<string, string>()
  const used = new Set<string>()
  const copy = (from: SectionElement[], to: SectionElement[] | undefined): SectionElement[] =>
    from.map((element, index) => {
      const match = to?.[index]
      let id = match?.id && match.elType === element.elType && !used.has(match.id) ? match.id : newElementId()
      while (used.has(id)) id = newElementId()
      used.add(id)
      if (element.id) ids.set(element.id, id)
      return { ...structuredClone(element), id, elements: copy(element.elements ?? [], match?.elements) }
    })
  return { elements: copy(source, target), ids }
}

/** Uma cópia com ids todos novos, para um uso novo. */
export const freshCopy = (source: SectionElement[]) => remapIds(source, undefined)

/** Os ajustes à mão (pinned) da origem, com os ids do destino. */
function mapPins(pinned: Record<string, string[]> | undefined, ids: Map<string, string>) {
  const next: Record<string, string[]> = {}
  for (const [from, to] of ids) if (pinned?.[from]?.length) next[to] = [...pinned[from]]
  return next
}

/** Os elementos de uma seção (um array), ou de uma camada (um elemento), guardados no registro. */
export function componentElements(component: Pick<SpaceComponent, 'elementorJson'>): SectionElement[] {
  return parseSectionElements(component.elementorJson) ?? []
}

/** Um uso do componente no canvas: a seção inteira, ou a camada dentro dela. */
export interface ComponentUse {
  componentId: string
  sectionId: string
  /** Sem id: a seção inteira. */
  elementId?: string
}

/** Todos os usos de componentes nas seções do canvas. */
export function componentUses(nodes: SpaceNode[]): ComponentUse[] {
  const uses: ComponentUse[] = []
  for (const node of nodes) {
    if (node.type !== 'section') continue
    const data = node.data as SectionNodeData
    if (data.component) uses.push({ componentId: data.component, sectionId: node.id })
    const elements = parseSectionElements(data.elementorJson) ?? []
    walk(elements, (element) => {
      const id = elementComponent(element)
      if (id && element.id) uses.push({ componentId: id, sectionId: node.id, elementId: element.id })
    })
  }
  return uses
}

/**
 * De onde sai um uso novo: um uso que já está no canvas (com os ajustes à mão
 * dele) ou, sem nenhum, o registro.
 */
function componentSource(component: SpaceComponent, nodes: SpaceNode[]): { elements: SectionElement[]; pinned: Record<string, string[]> } {
  const use = componentUses(nodes).find((u) => u.componentId === component.id)
  const node = use && nodes.find((n) => n.id === use.sectionId)
  if (use && node) {
    const data = node.data as SectionNodeData
    const root = parseSectionElements(data.elementorJson) ?? []
    if (!use.elementId) return { elements: root, pinned: data.pinned ?? {} }
    let found: SectionElement | undefined
    walk(root, (element) => {
      if (!found && element.id === use.elementId) found = element
    })
    if (found) {
      const pinned: Record<string, string[]> = {}
      walk([found], (inner) => {
        if (inner.id && data.pinned?.[inner.id]?.length) pinned[inner.id] = data.pinned[inner.id]
      })
      return { elements: [found], pinned }
    }
  }
  return { elements: componentElements(component), pinned: {} }
}

/** Um uso novo do componente: cópia com ids novos, com os ajustes à mão levados para eles. */
export function newUse(component: SpaceComponent, nodes: SpaceNode[]) {
  const source = componentSource(component, nodes)
  const { elements, ids } = freshCopy(source.elements)
  return { elements, pinned: mapPins(source.pinned, ids) }
}

/**
 * O conteúdo que vem do site não tem as marcas do Space: as camadas que eram
 * usos de componente no mesmo lugar (mesmo caminho, mesmo tipo) continuam
 * sendo, para a ligação não se perder ao trazer de novo.
 */
function keepTags(next: SectionElement[], prev: SectionElement[]): SectionElement[] {
  return next.map((element, index) => {
    const before = prev[index]
    const match = before && before.elType === element.elType ? before : undefined
    const tag = match ? elementComponent(match) : undefined
    const own = tag && !elementComponent(element) ? tagElement(element, tag) : element
    return own.elements?.length ? { ...own, elements: keepTags(own.elements, match?.elements ?? []) } : own
  })
}

/**
 * Todos os usos do componente com o conteúdo do registro (cada um com os seus
 * ids): quando o registro muda de fora, como ao trazer de novo o modelo do site.
 */
export function refreshUses(nodes: SpaceNode[], component: SpaceComponent): SpaceNode[] {
  const source = componentElements(component)
  if (!source.length) return nodes
  return nodes.map((node) => {
    if (node.type !== 'section') return node
    const data = node.data as SectionNodeData
    const root = parseSectionElements(data.elementorJson)
    if (!root) return node
    if (data.component === component.id) {
      const next = keepTags(remapIds(source, root).elements, root)
      if (contentKey(next) === contentKey(root)) return node
      return { ...node, data: { ...data, elementorJson: JSON.stringify(next) } }
    }
    let changed = false
    const replace = (list: SectionElement[]): SectionElement[] =>
      list.map((element) => {
        if (elementComponent(element) === component.id) {
          const next = keepTags(remapIds(source, [element]).elements, [element])[0]
          if (contentKey([next]) === contentKey([element])) return element
          changed = true
          return next
        }
        return element.elements?.length ? { ...element, elements: replace(element.elements) } : element
      })
    const next = replace(root)
    return changed ? { ...node, data: { ...data, elementorJson: JSON.stringify(next) } } : node
  })
}

/** Seções comuns com o mesmo conteúdo da seção (cópias dela em outras páginas), para ligar ao componente. */
export function identicalSections(nodes: SpaceNode[], sectionId: string): string[] {
  const source = nodes.find((n) => n.id === sectionId && n.type === 'section')
  if (!source) return []
  const key = contentKey(parseSectionElements((source.data as SectionNodeData).elementorJson) ?? [])
  return nodes
    .filter((n) => n.type === 'section' && n.id !== sectionId && !(n.data as SectionNodeData).component)
    .filter((n) => contentKey(parseSectionElements((n.data as SectionNodeData).elementorJson) ?? []) === key)
    .map((n) => n.id)
}

/** Uma seção nova que é uso do componente (de seção inteira). */
export function componentSectionData(component: SpaceComponent, nodes: SpaceNode[]): SectionNodeData {
  const { elements, pinned } = newUse(component, nodes)
  return { title: component.name, elementorJson: JSON.stringify(elements), component: component.id, ...(Object.keys(pinned).length ? { pinned } : {}) }
}

/** O cabeçalho e o rodapé do site (os componentes com esse papel), para uma página nova já vir com eles. */
export function siteFrameSections(components: SpaceComponent[], nodes: SpaceNode[]): Partial<Record<ComponentRole, SectionNodeData>> {
  const out: Partial<Record<ComponentRole, SectionNodeData>> = {}
  for (const role of ['header', 'footer'] as const) {
    const component = components.find((c) => c.role === role && c.level === 'section')
    if (component) out[role] = componentSectionData(component, nodes)
  }
  return out
}

/** Onde a mudança veio: o uso que ficou diferente do registro. */
interface Change {
  componentId: string
  /** O novo conteúdo: os elementos da seção, ou a camada (num array de um). */
  elements: SectionElement[]
  pinned: Record<string, string[]>
  sectionId: string
  elementId?: string
}

/**
 * Depois de uma mudança nas seções: o uso de componente que ficou diferente
 * do registro passa o conteúdo dele para o registro e para todos os outros
 * usos. Devolve null quando nada precisa mudar.
 */
export function syncComponents(prev: SpaceNode[], next: SpaceNode[], components: SpaceComponent[]): { nodes: SpaceNode[]; components: SpaceComponent[] } | null {
  if (!components.length) return null
  const before = new Map(prev.map((n) => [n.id, n]))
  const byId = new Map(components.map((c) => [c.id, c]))
  const changes = new Map<string, Change>()

  for (const node of next) {
    if (node.type !== 'section' || before.get(node.id)?.data === node.data) continue
    const data = node.data as SectionNodeData
    const elements = parseSectionElements(data.elementorJson)
    if (!elements) continue
    const section = data.component ? byId.get(data.component) : undefined
    if (section && !changes.has(section.id) && contentKey(elements) !== contentKey(componentElements(section))) {
      changes.set(section.id, { componentId: section.id, elements, pinned: data.pinned ?? {}, sectionId: node.id })
    }
    walk(elements, (element) => {
      const id = elementComponent(element)
      const component = id ? byId.get(id) : undefined
      if (!component || changes.has(component.id) || !element.id) return
      if (contentKey([element]) === contentKey(componentElements(component))) return
      const pinned: Record<string, string[]> = {}
      walk([element], (inner) => {
        if (inner.id && data.pinned?.[inner.id]?.length) pinned[inner.id] = data.pinned[inner.id]
      })
      changes.set(component.id, { componentId: component.id, elements: [element], pinned, sectionId: node.id, elementId: element.id })
    })
  }
  if (!changes.size) return null

  const nextComponents = components.map((c) => {
    const change = changes.get(c.id)
    return change ? { ...c, elementorJson: JSON.stringify(change.elements) } : c
  })

  let touched = false
  const nodes = next.map((node) => {
    if (node.type !== 'section') return node
    const data = node.data as SectionNodeData
    let elements = parseSectionElements(data.elementorJson)
    if (!elements) return node
    let pinned = data.pinned
    let changed = false

    // A seção inteira é um uso que não foi a origem: recebe o conteúdo, com os ids dela
    const whole = data.component ? changes.get(data.component) : undefined
    if (whole && !(whole.sectionId === node.id && !whole.elementId)) {
      const mapped = remapIds(whole.elements, elements)
      elements = mapped.elements
      pinned = mapPins(whole.pinned, mapped.ids)
      changed = true
    }

    // Camadas que são usos de um componente que mudou em outro lugar
    const replace = (list: SectionElement[]): SectionElement[] =>
      list.map((element) => {
        const id = elementComponent(element)
        const change = id ? changes.get(id) : undefined
        if (change && !(change.sectionId === node.id && change.elementId === element.id)) {
          const mapped = remapIds(change.elements, [element])
          // Os ajustes à mão dentro da camada passam a ser os da origem
          const own = new Set<string>()
          walk([element], (inner) => inner.id && own.add(inner.id))
          pinned = { ...Object.fromEntries(Object.entries(pinned ?? {}).filter(([key]) => !own.has(key))), ...mapPins(change.pinned, mapped.ids) }
          changed = true
          return mapped.elements[0]
        }
        return element.elements?.length ? { ...element, elements: replace(element.elements) } : element
      })
    const replaced = replace(elements)
    if (!changed) return node
    touched = true
    const nextData: SectionNodeData = { ...data, elementorJson: JSON.stringify(replaced) }
    if (pinned && Object.keys(pinned).length) nextData.pinned = pinned
    else delete nextData.pinned
    return { ...node, data: nextData }
  })

  return { nodes: touched ? nodes : next, components: nextComponents }
}

/** Nome para o componente novo: o nome da camada ou da seção. */
export function suggestName(element: SectionElement | null, fallback: string) {
  const settings = isRecord(element?.settings) ? element!.settings : {}
  const text = [settings.title, settings.text, settings.editor].find((v) => typeof v === 'string' && v.trim()) as string | undefined
  const clean = text?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return clean ? (clean.length > 40 ? `${clean.slice(0, 37)}…` : clean) : fallback
}
