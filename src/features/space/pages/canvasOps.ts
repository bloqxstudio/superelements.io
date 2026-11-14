import type { SectionNodeData, SpaceConnection, SpaceNode, SpacePage } from '@/types/space'
import { DEFAULT_PAGE_NAME, SECTION_WIDTH, nextPagePosition, pageOf, pageSlots } from './pages.ts'

/**
 * Operações do canvas sobre `{nodes, pages, connections}`, sem store: as mesmas
 * para o canvas (spaceStore) e para a ponte dos agentes (bridge/client.ts).
 * Antes cada lado tinha a sua cópia e elas divergiam: a ponte criava seções com
 * altura fixa, não levava junto os textos e paletas de uma página excluída e
 * não avisava a lixeira (revisão de 2026-11-13). Sem imports de valor com `@/`,
 * para os testes de `scripts/tests/` abrirem este arquivo direto no Node.
 */

export interface CanvasParts {
  nodes: SpaceNode[]
  pages: SpacePage[]
  connections: SpaceConnection[]
}

/** Altura de uma seção antes de o preview medir a de verdade. */
export const SECTION_HEIGHT = 200

/** Seção nova no topo da página (o layout põe no lugar da coluna). */
export const sectionNode = (data: SectionNodeData, at: { x: number; y: number }): SpaceNode => ({
  id: crypto.randomUUID(),
  type: 'section',
  x: at.x,
  y: at.y,
  width: SECTION_WIDTH,
  height: SECTION_HEIGHT,
  data,
})

/**
 * Move as seções para as posições dadas e leva junto os textos/paletas
 * conectados a cada uma, para as conexões não ficarem esticadas.
 */
export function moveSections(nodes: SpaceNode[], connections: SpaceConnection[], positions: Map<string, { x: number; y: number }>) {
  const offsets = new Map<string, { dx: number; dy: number }>()
  for (const node of nodes) {
    const pos = positions.get(node.id)
    if (pos && (pos.x !== node.x || pos.y !== node.y)) offsets.set(node.id, { dx: pos.x - node.x, dy: pos.y - node.y })
  }
  if (!offsets.size) return nodes
  for (const conn of connections) {
    const offset = offsets.get(conn.targetId)
    if (offset && !positions.has(conn.sourceId) && !offsets.has(conn.sourceId)) offsets.set(conn.sourceId, offset)
  }
  return nodes.map((n) => {
    const offset = offsets.get(n.id)
    return offset ? { ...n, x: n.x + offset.dx, y: n.y + offset.dy } : n
  })
}

/** Põe as seções da página nos lugares da coluna dela. */
export const layoutPage = (page: SpacePage, nodes: SpaceNode[], connections: SpaceConnection[]) =>
  moveSections(nodes, connections, pageSlots(page, nodes))

export const layoutPages = (pages: SpacePage[], nodes: SpaceNode[], connections: SpaceConnection[]) =>
  pages.reduce((acc, page) => layoutPage(page, acc, connections), nodes)

/** As seções e os textos e paletas que só alimentavam elas, que saem junto. */
export function withFeeders(sectionIds: string[], nodes: SpaceNode[], connections: SpaceConnection[]) {
  const removed = new Set(sectionIds)
  const feeders = new Set(connections.filter((c) => removed.has(c.targetId)).map((c) => c.sourceId))
  for (const c of connections) if (!removed.has(c.targetId)) feeders.delete(c.sourceId)
  for (const n of nodes) if (feeders.has(n.id) && n.type !== 'section') removed.add(n.id)
  return removed
}

/** Seções novas na página, na posição dada (ou no fim), já no lugar da coluna. */
export function insertSections(canvas: CanvasParts, pageId: string, sections: SectionNodeData[], index?: number) {
  const page = canvas.pages.find((p) => p.id === pageId)
  if (!page) throw new Error(`Página não encontrada: ${pageId}`)
  const created = sections.map((data) => sectionNode(data, page))
  const sectionIds = [...page.sectionIds]
  sectionIds.splice(Math.max(0, Math.min(index ?? sectionIds.length, sectionIds.length)), 0, ...created.map((n) => n.id))
  const target = { ...page, sectionIds }
  const pages = canvas.pages.map((p) => (p.id === pageId ? target : p))
  const nodes = layoutPage(target, [...canvas.nodes, ...created], canvas.connections)
  return { canvas: { nodes, pages, connections: canvas.connections }, ids: created.map((n) => n.id) }
}

/** O que saiu do canvas, para a lixeira (`CanvasRemoval` do store). */
export interface RemovedSection {
  node: SpaceNode
  pageId?: string
  pageName?: string
  index: number
}

/**
 * Tira as seções do canvas e das páginas (as páginas fecham o buraco). Com
 * `feeders`, os textos e paletas ligados só a elas saem junto, como ao excluir
 * uma página; sem, ficam soltos, como ao excluir uma seção no canvas.
 */
export function removeSections(canvas: CanvasParts, ids: string[], options: { feeders?: boolean } = {}) {
  const sectionIds = ids.filter((id) => canvas.nodes.some((n) => n.id === id && n.type === 'section'))
  const removed = options.feeders ? withFeeders(sectionIds, canvas.nodes, canvas.connections) : new Set(sectionIds)
  const sections: RemovedSection[] = sectionIds.map((id) => {
    const page = pageOf(canvas.pages, id)
    return { node: canvas.nodes.find((n) => n.id === id)!, pageId: page?.id, pageName: page?.name, index: page ? page.sectionIds.indexOf(id) : -1 }
  })
  const touchedPages = new Set(sections.map((s) => s.pageId).filter(Boolean))
  const pages = canvas.pages.map((p) => (touchedPages.has(p.id) ? { ...p, sectionIds: p.sectionIds.filter((s) => !removed.has(s)) } : p))
  const connections = canvas.connections.filter((c) => !removed.has(c.sourceId) && !removed.has(c.targetId))
  let nodes = canvas.nodes.filter((n) => !removed.has(n.id))
  for (const page of pages) if (touchedPages.has(page.id)) nodes = layoutPage(page, nodes, connections)
  return { canvas: { nodes, pages, connections }, removed, sections }
}

/** Exclui a página com as seções dela e os textos/paletas ligados só a elas. A última página não sai. */
export function removePage(canvas: CanvasParts, pageId: string) {
  const page = canvas.pages.find((p) => p.id === pageId)
  if (!page) throw new Error(`Página não encontrada: ${pageId}`)
  if (canvas.pages.length <= 1) throw new Error('A última página do canvas não sai')
  const removed = withFeeders(page.sectionIds, canvas.nodes, canvas.connections)
  const sections = page.sectionIds.map((id) => canvas.nodes.find((n) => n.id === id)).filter((n): n is SpaceNode => !!n)
  return {
    canvas: {
      pages: canvas.pages.filter((p) => p.id !== pageId),
      nodes: canvas.nodes.filter((n) => !removed.has(n.id)),
      connections: canvas.connections.filter((c) => !removed.has(c.sourceId) && !removed.has(c.targetId)),
    },
    page,
    sections,
    removed,
  }
}

/**
 * Põe a seção na página, na posição dada (ou no fim). A posição é contada sem a
 * própria seção, como no arrasto; a página de onde ela saiu fecha o buraco.
 */
export function movePageSection(canvas: CanvasParts, sectionId: string, pageId: string, index?: number) {
  if (!canvas.nodes.some((n) => n.id === sectionId && n.type === 'section')) throw new Error(`Seção não encontrada no canvas: ${sectionId}`)
  if (!canvas.pages.some((p) => p.id === pageId)) throw new Error(`Página não encontrada: ${pageId}`)
  const from = pageOf(canvas.pages, sectionId)
  const pages = canvas.pages.map((p) => {
    if (p.id !== pageId && p.id !== from?.id) return p
    const sectionIds = p.sectionIds.filter((s) => s !== sectionId)
    if (p.id === pageId) sectionIds.splice(Math.max(0, Math.min(index ?? sectionIds.length, sectionIds.length)), 0, sectionId)
    return { ...p, sectionIds }
  })
  let nodes = canvas.nodes
  for (const page of pages) if (page.id === pageId || page.id === from?.id) nodes = layoutPage(page, nodes, canvas.connections)
  return { nodes, pages, connections: canvas.connections }
}

/**
 * Página nova à direita das outras. `frame` são o cabeçalho e o rodapé do site
 * (`siteFrameSections`), que a página já traz, como no site.
 */
export function createPage(canvas: CanvasParts, options: { name?: string; frame?: Array<SectionNodeData | undefined> } = {}) {
  const position = nextPagePosition(canvas.pages, canvas.nodes)
  const created = (options.frame ?? []).filter((data): data is SectionNodeData => !!data).map((data) => sectionNode(data, position))
  const page: SpacePage = { id: crypto.randomUUID(), name: options.name?.trim() || DEFAULT_PAGE_NAME, ...position, sectionIds: created.map((n) => n.id) }
  const nodes = created.length ? layoutPage(page, [...canvas.nodes, ...created], canvas.connections) : canvas.nodes
  return { canvas: { nodes, pages: [...canvas.pages, page], connections: canvas.connections }, page }
}
