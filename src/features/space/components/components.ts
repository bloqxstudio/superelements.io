import { parseSectionElements, type SectionElement } from '@/features/space/landingPage'
import { newElementId } from '@/features/space/editor/tree'
import { isContentSetting } from '@/features/space/editor/contentFields'
import type { ComponentRole, ComponentTexts, SectionNodeData, SpaceComponent, SpaceNode } from '@/types/space'

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

// ---------------------------------------------------------------------------
// Textos de cada uso
//
// Por padrão (`own`) o componente liga o estilo e a estrutura: textos, links,
// imagens e listas são de cada uso. Com `shared`, tudo é igual em todos. Um
// componente dentro de outro segue a escolha dele mesmo (um botão com texto
// próprio dentro de um hero com texto igual).

export const textsOf = (component: Pick<SpaceComponent, 'texts'> | undefined) => component?.texts ?? 'own'

export type ModeOf = (componentId: string) => ComponentTexts

export const modeLookup = (components: SpaceComponent[]): ModeOf => {
  const modes = new Map(components.map((c) => [c.id, textsOf(c)]))
  return (id) => modes.get(id) ?? 'own'
}

const contentKeysOf = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((key) => isContentSetting(key, a[key]) || isContentSetting(key, b[key]))

const settingsOfElement = (element: SectionElement | undefined) => (isRecord(element?.settings) ? (element!.settings as Record<string, unknown>) : {})

/** Os elementos sem o conteúdo onde ele é de cada uso: o que precisa ser igual em todos os usos. */
function scrubContent(elements: SectionElement[], mode: ComponentTexts, modeOf: ModeOf): SectionElement[] {
  return elements.map((element) => {
    const tag = elementComponent(element)
    const here = tag ? modeOf(tag) : mode
    const settings = settingsOfElement(element)
    const kept = here === 'own' ? Object.fromEntries(Object.entries(settings).filter(([key, value]) => !isContentSetting(key, value))) : settings
    return { ...element, settings: kept, elements: scrubContent(element.elements ?? [], here, modeOf) }
  })
}

/** O que liga os usos, para comparar: sem ids e sem o conteúdo de cada uso. */
export const syncKey = (elements: SectionElement[], mode: ComponentTexts, modeOf: ModeOf) => contentKey(scrubContent(elements, mode, modeOf))

/**
 * O conteúdo novo (`next`, da origem) com os textos, links e imagens que o uso
 * já tinha (`prev`) onde eles são de cada uso. O par é o elemento no mesmo
 * lugar e do mesmo tipo; o que a origem tem de novo entra com o conteúdo dela.
 */
export function keepOwnContent(next: SectionElement[], prev: SectionElement[], mode: ComponentTexts, modeOf: ModeOf): SectionElement[] {
  return next.map((element, index) => {
    const before = prev[index]
    const match = before && before.elType === element.elType && before.widgetType === element.widgetType ? before : undefined
    const tag = elementComponent(element)
    const here = tag ? modeOf(tag) : mode
    let own = element
    if (match && here === 'own') {
      const mine = settingsOfElement(match)
      const settings = { ...settingsOfElement(element) }
      for (const key of contentKeysOf(settings, mine)) if (key in mine) settings[key] = mine[key]
      own = { ...element, settings }
    }
    return own.elements?.length ? { ...own, elements: keepOwnContent(own.elements, match?.elements ?? [], here, modeOf) } : own
  })
}

/** Os elementos de um uso: a seção inteira, ou a camada num array de um. */
function usageElements(use: ComponentUse, nodes: SpaceNode[]): SectionElement[] | null {
  const node = nodes.find((n) => n.id === use.sectionId)
  const root = node?.type === 'section' ? parseSectionElements((node.data as SectionNodeData).elementorJson) : null
  if (!root) return null
  if (!use.elementId) return root
  let found: SectionElement | null = null
  walk(root, (element) => {
    if (!found && element.id === use.elementId) found = element
  })
  return found ? [found] : null
}

export const usageKey = (use: Pick<ComponentUse, 'sectionId' | 'elementId'>) => `${use.sectionId}:${use.elementId ?? ''}`

/**
 * O que vai para o modelo do Elementor, que tem um conteúdo só: a versão mais
 * usada do componente (no empate, a primeira). Os usos com textos próprios
 * vão dentro das páginas deles.
 */
export function templateUses(componentId: string, nodes: SpaceNode[]) {
  const uses = componentUses(nodes).filter((u) => u.componentId === componentId)
  const keyed = uses.map((use) => ({ use, key: contentKey(usageElements(use, nodes) ?? []) }))
  const count = new Map<string, number>()
  for (const { key } of keyed) count.set(key, (count.get(key) ?? 0) + 1)
  let best: (typeof keyed)[number] | undefined
  for (const entry of keyed) if (!best || (count.get(entry.key) ?? 0) > (count.get(best.key) ?? 0)) best = entry
  const matching = keyed.filter((entry) => entry.key === best?.key).map((entry) => entry.use)
  return { canonical: best?.use, matching, own: keyed.filter((entry) => entry.key !== best?.key).map((entry) => entry.use) }
}

/** Os usos que podem ser o modelo do site (iguais à versão publicada), por componente. */
export function templateMatches(nodes: SpaceNode[], componentIds: Iterable<string>) {
  const keys = new Set<string>()
  for (const id of componentIds) for (const use of templateUses(id, nodes).matching) keys.add(usageKey(use))
  return keys
}

/**
 * A página pode usar o cabeçalho e o rodapé do Theme Builder: tem cada um
 * igual ao modelo. Com texto próprio num deles, a página leva os dois dentro
 * dela (o tema mostraria o próprio cabeçalho no lugar do que falta).
 */
export function themePage(sectionIds: string[], nodes: SpaceNode[], components: SpaceComponent[]) {
  const roles = components.filter((c) => c.role && c.level === 'section')
  const inPage = new Set(sectionIds)
  const uses = componentUses(nodes).filter((u) => inPage.has(u.sectionId) && !u.elementId && roles.some((c) => c.id === u.componentId))
  if (!uses.length) return { roles: [] as SpaceComponent[], eligible: true }
  const matches = templateMatches(nodes, new Set(uses.map((u) => u.componentId)))
  return {
    roles: roles.filter((c) => uses.some((u) => u.componentId === c.id)),
    eligible: uses.every((u) => matches.has(usageKey(u))),
  }
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
 * ids): quando o registro muda de fora, como ao trazer de novo o modelo do site
 * ou ao passar a ter os textos iguais. Com textos de cada uso, só o estilo vai.
 */
export function refreshUses(nodes: SpaceNode[], component: SpaceComponent, modeOf: ModeOf = () => 'own'): SpaceNode[] {
  const source = componentElements(component)
  if (!source.length) return nodes
  const mode = textsOf(component)
  return nodes.map((node) => {
    if (node.type !== 'section') return node
    const data = node.data as SectionNodeData
    const root = parseSectionElements(data.elementorJson)
    if (!root) return node
    if (data.component === component.id) {
      const next = keepOwnContent(keepTags(remapIds(source, root).elements, root), root, mode, modeOf)
      if (contentKey(next) === contentKey(root)) return node
      return { ...node, data: { ...data, elementorJson: JSON.stringify(next) } }
    }
    let changed = false
    const replace = (list: SectionElement[]): SectionElement[] =>
      list.map((element) => {
        if (elementComponent(element) === component.id) {
          const next = keepOwnContent(keepTags(remapIds(source, [element]).elements, [element]), [element], mode, modeOf)[0]
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

/**
 * Seções comuns com o mesmo desenho da seção (cópias dela em outras páginas),
 * para ligar ao componente. Com textos de cada uso, os textos podem ser outros.
 */
export function identicalSections(nodes: SpaceNode[], sectionId: string, mode: ComponentTexts = 'own', modeOf: ModeOf = () => 'own'): string[] {
  const source = nodes.find((n) => n.id === sectionId && n.type === 'section')
  if (!source) return []
  const key = syncKey(parseSectionElements((source.data as SectionNodeData).elementorJson) ?? [], mode, modeOf)
  return nodes
    .filter((n) => n.type === 'section' && n.id !== sectionId && !(n.data as SectionNodeData).component)
    .filter((n) => syncKey(parseSectionElements((n.data as SectionNodeData).elementorJson) ?? [], mode, modeOf) === key)
    .map((n) => n.id)
}

/** O registro passa a ter o conteúdo do uso escolhido (para textos iguais a partir dele). */
export function elementsOfUse(nodes: SpaceNode[], sectionId: string, elementId?: string) {
  return usageElements({ componentId: '', sectionId, elementId }, nodes)
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
 * do registro (no estilo; nos textos também, quando eles são iguais em todos)
 * passa a mudança para o registro e para todos os outros usos, e cada uso
 * guarda os textos que são dele. Devolve null quando nada precisa mudar.
 */
export function syncComponents(prev: SpaceNode[], next: SpaceNode[], components: SpaceComponent[]): { nodes: SpaceNode[]; components: SpaceComponent[] } | null {
  if (!components.length) return null
  const before = new Map(prev.map((n) => [n.id, n]))
  const byId = new Map(components.map((c) => [c.id, c]))
  const modeOf = modeLookup(components)
  const changes = new Map<string, Change>()
  const differs = (elements: SectionElement[], component: SpaceComponent) =>
    syncKey(elements, textsOf(component), modeOf) !== syncKey(componentElements(component), textsOf(component), modeOf)

  for (const node of next) {
    if (node.type !== 'section' || before.get(node.id)?.data === node.data) continue
    const data = node.data as SectionNodeData
    const elements = parseSectionElements(data.elementorJson)
    if (!elements) continue
    const section = data.component ? byId.get(data.component) : undefined
    if (section && !changes.has(section.id) && differs(elements, section)) {
      changes.set(section.id, { componentId: section.id, elements, pinned: data.pinned ?? {}, sectionId: node.id })
    }
    walk(elements, (element) => {
      const id = elementComponent(element)
      const component = id ? byId.get(id) : undefined
      if (!component || changes.has(component.id) || !element.id) return
      if (!differs([element], component)) return
      const pinned: Record<string, string[]> = {}
      walk([element], (inner) => {
        if (inner.id && data.pinned?.[inner.id]?.length) pinned[inner.id] = data.pinned[inner.id]
      })
      changes.set(component.id, { componentId: component.id, elements: [element], pinned, sectionId: node.id, elementId: element.id })
    })
  }
  if (!changes.size) return null

  // O registro fica com a mudança e com os textos dele, onde os textos são de cada uso
  const nextComponents = components.map((c) => {
    const change = changes.get(c.id)
    return change ? { ...c, elementorJson: JSON.stringify(keepOwnContent(change.elements, componentElements(c), textsOf(c), modeOf)) } : c
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
      elements = keepOwnContent(mapped.elements, elements, modeOf(whole.componentId), modeOf)
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
          return keepOwnContent(mapped.elements, [element], modeOf(change.componentId), modeOf)[0]
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
