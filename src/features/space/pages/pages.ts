import type { PagePartKind, SectionNodeData, SpaceNode, SpacePage } from '@/types/space'

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

/** Nome de cada parte do site (e da folha dela, ao criar). */
export const PART_LABEL: Record<PagePartKind, string> = { header: 'Cabeçalho do site', footer: 'Rodapé do site', section: 'Componente' }
/** Para as frases: "o cabeçalho", "o rodapé". */
export const PART_NOUN: Record<PagePartKind, string> = { header: 'cabeçalho', footer: 'rodapé', section: 'componente' }

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

/** As páginas do site, sem as folhas de cabeçalho e rodapé. */
export const sitePages = (pages: SpacePage[]) => pages.filter((p) => !p.part)

/** A folha do cabeçalho (ou do rodapé) do site, se o projeto tiver. */
export const partPage = (pages: SpacePage[], kind: PagePartKind) => pages.find((p) => p.part?.kind === kind)

/** O cabeçalho e o rodapé que aparecem na página. Uma parte não mostra outra. */
export function pageParts(page: SpacePage, pages: SpacePage[]): { header?: SpacePage; footer?: SpacePage } {
  if (page.part) return {}
  const shown = (kind: PagePartKind) => pages.find((p) => p.part?.kind === kind && !p.part.exclude?.includes(page.id))
  return { header: shown('header'), footer: shown('footer') }
}

/** O componente (folha de seção) de que a seção é instância, se for uma. */
export const instanceOf = (node: SpaceNode | undefined) => (node?.type === 'section' ? (node.data as SectionNodeData).instanceOf : undefined)

/** A folha do componente livre pelo id, se ainda existe. */
export const componentPage = (pages: SpacePage[], id: string | undefined) => (id ? pages.find((p) => p.id === id && p.part?.kind === 'section') : undefined)

/**
 * Páginas em que a parte aparece: o cabeçalho e o rodapé, nas páginas do site
 * que os mostram; o componente livre, nas folhas que têm uma instância dele.
 */
export function partShownIn(part: SpacePage, pages: SpacePage[], nodes: SpaceNode[] = []) {
  if (part.part?.kind === 'section') {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    return pages.filter((p) => p.id !== part.id && p.sectionIds.some((id) => instanceOf(byId.get(id)) === part.id))
  }
  return sitePages(pages).filter((p) => {
    const { header, footer } = pageParts(p, pages)
    return header?.id === part.id || footer?.id === part.id
  })
}

/**
 * Troca cada instância pelas seções do componente dela (que podem ter outras
 * instâncias). Componente que não existe mais, ou que contém a si mesmo, some.
 */
export function expandInstances(sections: SpaceNode[], pages: SpacePage[], nodes: SpaceNode[], seen: ReadonlySet<string> = new Set()): SpaceNode[] {
  return sections.flatMap((section) => {
    const id = instanceOf(section)
    if (!id) return [section]
    const component = componentPage(pages, id)
    if (!component || seen.has(id)) return []
    return expandInstances(pageSections(component, nodes), pages, nodes, new Set([...seen, id]))
  })
}

/**
 * A página como vai para o site: o cabeçalho, as seções dela (com os
 * componentes no lugar das instâncias) e o rodapé. É o que o player, o vídeo,
 * o link de aprovação, copiar e publicar montam.
 */
export function pageContent(page: SpacePage, pages: SpacePage[], nodes: SpaceNode[]): SpaceNode[] {
  const { header, footer } = pageParts(page, pages)
  const own = [...(header ? pageSections(header, nodes) : []), ...pageSections(page, nodes), ...(footer ? pageSections(footer, nodes) : [])]
  return expandInstances(own, pages, nodes, new Set(page.part?.kind === 'section' ? [page.id] : []))
}

/** Altura das seções de uma folha, coladas como na página. */
export function sectionsHeight(page: SpacePage, nodes: SpaceNode[]) {
  const sections = pageSections(page, nodes)
  return sections.length ? sections.reduce((sum, s) => sum + s.height, 0) + PAGE_SECTION_GAP * (sections.length - 1) : 0
}

/**
 * A folha de cima a baixo: o cabeçalho do site logo abaixo da barra, as
 * seções da página e o rodapé no fim. Os `y` são do mundo do canvas.
 */
export function sheetLayout(page: SpacePage, nodes: SpaceNode[], pages: SpacePage[]) {
  const { header, footer } = pageParts(page, pages)
  const top = page.y + PAGE_HEADER + PAGE_PAD
  const headerHeight = header ? sectionsHeight(header, nodes) : 0
  // Sem seções, a página guarda a área vazia (onde se solta uma seção) entre o cabeçalho e o rodapé
  const body = sectionsHeight(page, nodes) || EMPTY_PAGE_BODY
  return {
    header: header ? { page: header, y: top, height: headerHeight } : undefined,
    footer: footer ? { page: footer, y: top + headerHeight + body, height: sectionsHeight(footer, nodes) } : undefined,
    /** Onde começam as seções da própria página. */
    bodyTop: top + headerHeight,
    body,
  }
}

/** Posição de cada seção na coluna da página, abaixo do cabeçalho do site. */
export function pageSlots(page: SpacePage, nodes: SpaceNode[], pages: SpacePage[]) {
  const x = page.x + PAGE_PAD
  let y = sheetLayout(page, nodes, pages).bodyTop
  const slots = new Map<string, { x: number; y: number }>()
  for (const section of pageSections(page, nodes)) {
    slots.set(section.id, { x, y })
    y += section.height + PAGE_SECTION_GAP
  }
  return slots
}

/** Quadro da página: vem da altura das seções (e do cabeçalho e rodapé do site), não da posição delas, e fica parado durante um arrasto. */
export function pageFrame(page: SpacePage, nodes: SpaceNode[], pages: SpacePage[]): Rect {
  const { header, footer, body } = sheetLayout(page, nodes, pages)
  const sheet = (header?.height ?? 0) + body + (footer?.height ?? 0)
  return { x: page.x, y: page.y, width: PAGE_WIDTH, height: PAGE_HEADER + PAGE_PAD + sheet + PAGE_PAD }
}

/** Entre uma folha de parte do site e a de baixo, na coluna das partes. */
export const PART_GAP = 120

/** Onde entra a folha de uma parte do site: numa coluna à esquerda das páginas, uma embaixo da outra. */
export function nextPartPosition(pages: SpacePage[], nodes: SpaceNode[]) {
  const parts = pages.filter((p) => p.part)
  if (parts.length) {
    const frames = parts.map((p) => pageFrame(p, nodes, pages))
    const bottom = Math.max(...frames.map((f) => f.y + f.height))
    return { x: parts[0].x, y: bottom + PART_GAP }
  }
  const bounds = canvasBounds(pages, nodes)
  if (!bounds) return { x: 380, y: 80 }
  const top = pages.length ? Math.min(...pages.map((p) => p.y)) : bounds.y
  return { x: bounds.x - PAGE_GAP - PAGE_WIDTH, y: top }
}

/** Página sob um ponto do mundo (a folha ou a faixa do rótulo dela). */
export function pageAt(pages: SpacePage[], nodes: SpaceNode[], x: number, y: number): SpacePage | null {
  for (let i = pages.length - 1; i >= 0; i--) if (contains(pageFrame(pages[i], nodes, pages), x, y)) return pages[i]
  return null
}

const contains = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height

/** Página sob um ponto do mundo e a posição na coluna onde uma seção entraria ali. */
export function dropTargetAt(pages: SpacePage[], nodes: SpaceNode[], x: number, y: number, draggedId?: string) {
  // A última desenhada fica por cima
  for (let i = pages.length - 1; i >= 0; i--) {
    const page = pages[i]
    if (!contains(pageFrame(page, nodes, pages), x, y)) continue
    const sections = pageSections(page, nodes).filter((s) => s.id !== draggedId)
    const index = sections.findIndex((s) => y < s.y + s.height / 2)
    return { pageId: page.id, index: index < 0 ? sections.length : index, sectionId: draggedId }
  }
  return null
}

/** Área ocupada por páginas e nós, para enquadrar o canvas. */
export function canvasBounds(pages: SpacePage[], nodes: SpaceNode[]): Rect | null {
  const rects: Rect[] = [...pages.map((p) => pageFrame(p, nodes, pages)), ...nodes]
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
