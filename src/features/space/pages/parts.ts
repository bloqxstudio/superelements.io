import { create } from 'zustand'
import type { PagePartKind, SectionNodeData, SpaceNode, SpacePage } from '@/types/space'
import { useSpaceStore } from '@/store/spaceStore'
import { PART_LABEL, PART_NOUN, instanceOf, pageOf, pageSections, partShownIn, sitePages } from './pages'

/**
 * Componentes do site no Space: o cabeçalho e o rodapé que aparecem em todas
 * as páginas, como os modelos do Theme Builder do Elementor. Têm uma cor só
 * deles (ciano), diferente do violeta da seção comum e do laranja do agente,
 * no canvas, nas camadas e na lista de páginas.
 */
export const PART_COLOR = '#0891b2'
/** Contorno da seleção e textos sobre fundo claro. */
export const PART_COLOR_STRONG = '#0e7490'

export { PART_LABEL, PART_NOUN }

/** A folha da parte do site em que a seção está, se ela for um componente. */
export const partOfSection = (pages: SpacePage[], sectionId: string) => {
  const page = pageOf(pages, sectionId)
  return page?.part ? page : undefined
}

/** Em quantas páginas do site a parte aparece. */
export const partUsage = (part: SpacePage, pages: SpacePage[], nodes: SpaceNode[] = []) => partShownIn(part, pages, nodes).length

/**
 * Antes de excluir seções: as que são do cabeçalho ou do rodapé do site somem
 * de todas as páginas, então pergunta. Devolve se pode seguir.
 */
export function confirmPartSectionRemoval(ids: string[]) {
  const { pages, nodes } = useSpaceStore.getState()
  const owned = ids.map((id) => ({ id, part: partOfSection(pages, id) })).filter((x) => x.part)
  if (!owned.length) return true
  const part = owned[0].part!
  const count = partUsage(part, pages, nodes)
  const title = (nodes.find((n) => n.id === owned[0].id)?.data as SectionNodeData | undefined)?.title || 'A seção'
  const noun = part.part!.kind === 'section' ? `componente "${part.name}"` : `${PART_NOUN[part.part!.kind]} do site`
  const from = count === 1 ? 'de 1 página' : count ? `de ${count} páginas` : 'do componente'
  return confirm(owned.length > 1 ? `${owned.length} seções do ${noun} saem ${from}. Excluir?` : `"${title}" é do ${noun} e sai ${from}. Excluir?`)
}

const TITLE_HINT: Partial<Record<PagePartKind, RegExp>> = {
  header: /cabe[cç]alho|header|navbar|menu|topo/i,
  footer: /rodap[eé]|footer/i,
}

/** O JSON da seção sem os ids dos elementos, que mudam a cada cópia. */
function contentKey(json: string) {
  try {
    return JSON.stringify(JSON.parse(json), (key, value) => (key === 'id' ? undefined : value))
  } catch {
    return json
  }
}

/** O que acontece com uma página ao transformar a seção em componente. */
export interface PartCopy {
  page: SpacePage
  /** A seção da página que parece ser a mesma (a primeira, no cabeçalho; a última, no rodapé). */
  copy?: SpaceNode
  /** A cópia tem o mesmo conteúdo da seção escolhida; senão, só o nome ou o jeito de cabeçalho batem. */
  same: boolean
}

/**
 * Nas outras páginas do site, a cópia da seção que vai virar componente: a
 * primeira seção (cabeçalho) ou a última (rodapé), quando tem o mesmo
 * conteúdo, o mesmo nome, a mesma origem na biblioteca ou um nome de
 * cabeçalho (rodapé).
 */
export function findPartCopies(sectionId: string, kind: PagePartKind, pages: SpacePage[], nodes: SpaceNode[]): PartCopy[] {
  const section = nodes.find((n) => n.id === sectionId)
  if (!section) return []
  const data = section.data as SectionNodeData
  const key = contentKey(data.elementorJson)
  const title = data.title.trim().toLowerCase()
  const home = pageOf(pages, sectionId)

  return sitePages(pages)
    .filter((p) => p.id !== home?.id)
    .map((page) => {
      const sections = pageSections(page, nodes)
      const candidate = kind === 'header' ? sections[0] : sections[sections.length - 1]
      if (!candidate) return { page, same: false }
      const other = candidate.data as SectionNodeData
      const same = contentKey(other.elementorJson) === key
      const looksLike =
        same ||
        other.title.trim().toLowerCase() === title ||
        (!!data.sourceId && other.sourceId === data.sourceId) ||
        !!TITLE_HINT[kind]?.test(other.title)
      return looksLike ? { page, copy: candidate, same } : { page, same: false }
    })
}

/** Seções iguais à escolhida (mesmo conteúdo) nas outras folhas, que podem virar instâncias do componente novo. */
export function findComponentCopies(sectionId: string, pages: SpacePage[], nodes: SpaceNode[]) {
  const section = nodes.find((n) => n.id === sectionId)
  if (!section) return []
  const key = contentKey((section.data as SectionNodeData).elementorJson)
  return pages
    .filter((page) => page.part?.kind !== 'header' && page.part?.kind !== 'footer')
    .map((page) => ({
      page,
      copies: pageSections(page, nodes).filter((n) => n.id !== sectionId && !instanceOf(n) && contentKey((n.data as SectionNodeData).elementorJson) === key),
    }))
    .filter((row) => row.copies.length)
}

/** Pedido aberto de transformar uma seção em componente (a janela que confirma o que acontece em cada página). */
export const useMakePartDialog = create<{
  request: { sectionId: string; kind: PagePartKind } | null
  open: (sectionId: string, kind: PagePartKind) => void
  close: () => void
}>()((set) => ({
  request: null,
  open: (sectionId, kind) => set({ request: { sectionId, kind } }),
  close: () => set({ request: null }),
}))
