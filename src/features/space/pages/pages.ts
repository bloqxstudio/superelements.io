import type { SpaceNode, SpacePage } from '@/types/space'

/**
 * Geometria das páginas no canvas. Acima de cada página fica a faixa do
 * rótulo (nome, tela e tamanho) e, abaixo dela, a folha: as seções coladas
 * umas nas outras, como a página no site. As posições das seções são sempre
 * derivadas da página (ver `layoutPage` no store).
 */

export const SECTION_WIDTH = 480
/** Faixa acima da folha onde fica o rótulo da página. */
export const PAGE_HEADER = 48
/** A folha não tem respiro: a seção ocupa a largura toda, como no site. */
export const PAGE_PAD = 0
export const PAGE_WIDTH = SECTION_WIDTH + PAGE_PAD * 2
/** Espaço entre seções soltas empilhadas; dentro de uma página elas se encostam. */
export const SECTION_GAP = 24
/** Entre as seções de uma página: nenhum, a página se lê de cima a baixo sem emendas. */
export const PAGE_SECTION_GAP = 0
/** Altura da área vazia de uma página sem seções. */
export const EMPTY_PAGE_BODY = 168
/** Entre duas páginas cabe o texto ou a paleta ligados à esquerda de uma seção. */
export const PAGE_GAP = 320

export const DEFAULT_PAGE_NAME = 'Home'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const pageOf = (pages: SpacePage[], nodeId: string) => pages.find((p) => p.sectionIds.includes(nodeId))

/** Seções da página, na ordem dela. */
export function pageSections(page: SpacePage, nodes: SpaceNode[]): SpaceNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return page.sectionIds.map((id) => byId.get(id)).filter((n): n is SpaceNode => !!n)
}

/**
 * A página como vai para o site. Os componentes já estão dentro dela (cada
 * uso é uma cópia ligada): é o que o player, o vídeo, o link de aprovação,
 * copiar e publicar montam.
 */
export const pageContent = (page: SpacePage, nodes: SpaceNode[]) => pageSections(page, nodes)

/** Altura das seções de uma folha, coladas como na página. */
export function sectionsHeight(page: SpacePage, nodes: SpaceNode[]) {
  const sections = pageSections(page, nodes)
  return sections.length ? sections.reduce((sum, s) => sum + s.height, 0) + PAGE_SECTION_GAP * (sections.length - 1) : 0
}

/** Posição de cada seção na coluna da página. */
export function pageSlots(page: SpacePage, nodes: SpaceNode[]) {
  const x = page.x + PAGE_PAD
  let y = page.y + PAGE_HEADER + PAGE_PAD
  const slots = new Map<string, { x: number; y: number }>()
  for (const section of pageSections(page, nodes)) {
    slots.set(section.id, { x, y })
    y += section.height + PAGE_SECTION_GAP
  }
  return slots
}

/** Quadro da página: vem da altura das seções, não da posição delas, e fica parado durante um arrasto. */
export function pageFrame(page: SpacePage, nodes: SpaceNode[]): Rect {
  const body = sectionsHeight(page, nodes) || EMPTY_PAGE_BODY
  return { x: page.x, y: page.y, width: PAGE_WIDTH, height: PAGE_HEADER + PAGE_PAD + body + PAGE_PAD }
}

/** Página sob um ponto do mundo (a folha ou a faixa do rótulo dela). */
export function pageAt(pages: SpacePage[], nodes: SpaceNode[], x: number, y: number): SpacePage | null {
  for (let i = pages.length - 1; i >= 0; i--) if (contains(pageFrame(pages[i], nodes), x, y)) return pages[i]
  return null
}

const contains = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height

/** Página sob um ponto do mundo e a posição na coluna onde uma seção entraria ali. */
export function dropTargetAt(pages: SpacePage[], nodes: SpaceNode[], x: number, y: number, draggedId?: string) {
  // A última desenhada fica por cima
  for (let i = pages.length - 1; i >= 0; i--) {
    const page = pages[i]
    if (!contains(pageFrame(page, nodes), x, y)) continue
    const sections = pageSections(page, nodes).filter((s) => s.id !== draggedId)
    const index = sections.findIndex((s) => y < s.y + s.height / 2)
    return { pageId: page.id, index: index < 0 ? sections.length : index, sectionId: draggedId }
  }
  return null
}

/** Área ocupada por páginas e nós, para enquadrar o canvas. */
export function canvasBounds(pages: SpacePage[], nodes: SpaceNode[]): Rect | null {
  const rects: Rect[] = [...pages.map((p) => pageFrame(p, nodes)), ...nodes]
  if (!rects.length) return null
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.width))
  const maxY = Math.max(...rects.map((r) => r.y + r.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** Onde entra uma página nova: à direita de tudo o que já está no canvas, alinhada no topo das páginas. */
export function nextPagePosition(pages: SpacePage[], nodes: SpaceNode[]) {
  const bounds = canvasBounds(pages, nodes)
  if (!bounds) return { x: 380, y: 80 }
  const top = pages.length ? Math.min(...pages.map((p) => p.y)) : bounds.y
  return { x: bounds.x + bounds.width + PAGE_GAP, y: top }
}

/** "Página 2", "Página 3"... o primeiro número livre. */
export function nextPageName(pages: SpacePage[]) {
  if (!pages.length) return DEFAULT_PAGE_NAME
  const names = new Set(pages.map((p) => p.name.trim().toLowerCase()))
  let n = pages.length + 1
  while (names.has(`página ${n}`)) n++
  return `Página ${n}`
}

/** Seções do canvas na ordem de leitura: página por página, e as soltas por último, de cima para baixo. */
export function canvasSections(pages: SpacePage[], nodes: SpaceNode[]): SpaceNode[] {
  const inPages = pages.flatMap((p) => pageSections(p, nodes))
  const placed = new Set(inPages.map((s) => s.id))
  const loose = nodes.filter((n) => n.type === 'section' && !placed.has(n.id)).sort((a, b) => a.y - b.y)
  return [...inPages, ...loose]
}

/** "Home · 2" para uma seção de página, "Solta" para as demais. */
export function sectionPlace(pages: SpacePage[], sectionId: string) {
  const page = pageOf(pages, sectionId)
  return page ? `${page.name} · ${page.sectionIds.indexOf(sectionId) + 1}` : 'Solta'
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Nome do arquivo baixado: "Sobre nós" vira "sobre-nos". */
export const pageSlug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'pagina'
