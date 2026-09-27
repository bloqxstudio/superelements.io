import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { orderedSections } from '@/features/space/landingPage'
import {
  DEFAULT_PAGE_NAME,
  PAGE_HEADER,
  PAGE_PAD,
  PAGE_GAP,
  PAGE_WIDTH,
  SECTION_GAP,
  SECTION_WIDTH,
  canvasSections,
  nextPageName,
  nextPagePosition,
  pageFrame,
  pageOf,
  pageSlots,
} from '@/features/space/pages/pages'
import { instantiateSnapshot, snapshotSections, type SectionSnapshot } from '@/features/space/pages/clipboard'
import type {
  SpaceNode,
  SpaceConnection,
  SpacePage,
  PageWordPressLink,
  PageDetails,
  PageDropTarget,
  CanvasTransform,
  PendingConnection,
  NodeType,
  SectionNodeData,
  TextNodeData,
  ColorPaletteNodeData,
  EditLevel,
  SectionLevels,
  SectionMotion,
} from '@/types/space'

interface SpaceState {
  nodes: SpaceNode[]
  connections: SpaceConnection[]
  /** Páginas do canvas; cada uma agrupa as suas seções numa coluna. */
  pages: SpacePage[]
  canvasTransform: CanvasTransform
  pendingConnection: PendingConnection | null
  /** Página que recebe as seções da biblioteca e dos modelos, e que Visualizar e Copiar usam. */
  activePageId: string | null
  /** Página com o nome em edição no canvas. */
  renamingPageId: string | null
  /** Página aberta no player. */
  playingPageId: string | null
  /** Onde a seção arrastada (do canvas ou da biblioteca) entraria se fosse solta agora. */
  dropTarget: PageDropTarget | null
  /** Seções copiadas (Ctrl+C); continua ao trocar de projeto, para colar em outro. */
  clipboard: SectionSnapshot | null
  /** Card da biblioteca arrastado fora das páginas: onde a seção solta vai cair. */
  libraryGhost: { x: number; y: number; title: string } | null
  /** Card da biblioteca sendo arrastado: posição do ponteiro na janela, para o cartão que segue o cursor. */
  libraryPointer: { x: number; y: number; title: string } | null
  /** Seções selecionadas, na ordem em que foram clicadas. */
  selectedIds: string[]
  /** Camada em edição; muda o que o canvas mostra e abre o painel do nível. */
  editLevel: EditLevel
  /** Movimento ainda não aplicado: o canvas mostra nas seções selecionadas como elas ficariam. */
  motionDraft: SectionMotion | null
  /** Sobe a cada pedido para rever as animações das miniaturas. */
  motionReplay: number
  /** Tamanho da área do canvas na tela, para centralizar nós novos. */
  viewport: { width: number; height: number }
}

/**
 * O que o projeto guarda do canvas; o resto (seleção, nível, rascunho) é da sessão.
 * Canvas salvos antes das páginas não têm `pages`: ao abrir, as seções viram a página Home.
 */
export type SpaceCanvas = Pick<SpaceState, 'nodes' | 'connections' | 'canvasTransform'> & { pages?: SpacePage[] }

interface FocusOptions {
  /** Largura coberta à esquerda (painel da biblioteca), para centralizar na área livre. */
  leftInset?: number
}

interface InsertOptions extends FocusOptions {
  pageId?: string
  /** Posição na coluna; sem ela, no fim. */
  index?: number
  /** false: o canvas fica onde está (a seção foi solta onde o usuário está olhando). */
  focus?: boolean
}

interface SpaceActions {
  /** Troca o canvas pelo de um projeto (ou por um vazio) e zera o estado da sessão. */
  loadCanvas: (canvas?: SpaceCanvas) => void
  addNode: (type: NodeType, x: number, y: number) => void
  /** Adiciona uma seção no fim da página ativa (ou da indicada) e leva o canvas até ela. */
  addSection: (data: SectionNodeData, options?: InsertOptions) => string
  /** Várias seções de uma vez na página (no fim, ou na posição dada); devolve o id da página. */
  addSections: (sections: SectionNodeData[], options?: InsertOptions) => string
  /** Seção solta com o canto de cima à esquerda no ponto dado do mundo; devolve o id. */
  addLooseSection: (data: SectionNodeData, x: number, y: number) => string
  /** Guarda cópias das seções (e do que está ligado a elas); devolve quantas. */
  copySections: (ids: string[]) => number
  /**
   * Cola o que foi copiado na página ativa (ou na indicada): depois da última
   * seção selecionada dela, senão no fim. As coladas ficam selecionadas.
   */
  pasteSections: (options?: { pageId?: string; index?: number }) => { pageId: string; count: number } | null
  /** Cópias das seções direto numa página, sem passar pela área de transferência; devolve quantas. */
  copySectionsTo: (ids: string[], pageId: string, index?: number) => number
  /** Cópias logo abaixo das originais (as soltas, ao lado); as cópias ficam selecionadas. */
  duplicateSections: (ids: string[]) => number
  /** Troca a seção de lugar com a vizinha de cima (-1) ou de baixo (1) dentro da página. */
  moveSection: (id: string, direction: -1 | 1) => void
  /**
   * Põe a seção numa página, na posição dada (ou no fim). Sem página, ela fica
   * solta: no ponto `at` do canvas, ou logo abaixo da página de onde saiu.
   */
  moveSectionToPage: (sectionId: string, pageId: string | null, index?: number, at?: { x: number; y: number }) => void
  /** Cópia solta da seção (com o que está ligado a ela) com o canto no ponto dado; devolve o id. */
  copySectionToCanvas: (sectionId: string, x: number, y: number) => string | null
  /** Cria uma página à direita das outras, ativa e com o nome em edição; devolve o id. */
  addPage: (name?: string, options?: FocusOptions) => string
  renamePage: (id: string, name: string) => void
  setRenamingPage: (id: string | null) => void
  /** Exclui a página com as seções dela e os textos/paletas ligados só a elas. A última página não sai. */
  removePage: (id: string) => void
  /** Cópia da página, com as seções e os textos/paletas ligados a elas, à direita das outras. */
  duplicatePage: (id: string) => void
  /**
   * Página vinda do WordPress: uma nova, ou `replacePageId` com as seções
   * trocadas pela versão do site. Devolve o id da página.
   */
  loadSitePage: (name: string, sections: SectionNodeData[], link: PageWordPressLink, replacePageId?: string) => string
  /** Liga a página do canvas a uma página do WordPress (ou desliga, sem link). */
  setPageWordPress: (pageId: string, link: PageWordPressLink | undefined) => void
  /** Título, endereço, SEO e imagem destacada da página. */
  setPageDetails: (pageId: string, details: PageDetails | undefined) => void
  /** Move o quadro da página; as seções e o que está ligado a elas vão junto. */
  movePage: (id: string, x: number, y: number) => void
  setActivePage: (id: string) => void
  /** Ativa a página e leva o canvas até o topo dela. */
  focusPage: (id: string, options?: FocusOptions) => void
  /** Alinha as páginas lado a lado, na ordem da esquerda para a direita. */
  arrangePages: () => void
  setDropTarget: (target: PageDropTarget | null) => void
  setLibraryGhost: (ghost: SpaceState['libraryGhost']) => void
  setLibraryPointer: (pointer: SpaceState['libraryPointer']) => void
  openPlayer: (pageId: string) => void
  closePlayer: () => void
  setViewport: (width: number, height: number) => void
  removeNode: (id: string) => void
  updateNodePosition: (id: string, x: number, y: number) => void
  updateNodeData: (id: string, data: Partial<SectionNodeData | TextNodeData | ColorPaletteNodeData>) => void
  updateNodeSize: (id: string, width: number, height: number) => void
  startConnection: (sourceId: string, sourceX: number, sourceY: number) => void
  updatePendingConnection: (currentX: number, currentY: number) => void
  completeConnection: (targetId: string) => void
  cancelConnection: () => void
  removeConnection: (id: string) => void
  setCanvasTransform: (transform: Partial<CanvasTransform>) => void
  panCanvas: (dx: number, dy: number) => void
  /** Seleciona a seção; com `additive` (Shift) põe ou tira da seleção atual. */
  selectSection: (id: string, additive?: boolean) => void
  setSelection: (ids: string[]) => void
  clearSelection: () => void
  setEditLevel: (level: EditLevel) => void
  setMotionDraft: (draft: SectionMotion | null) => void
  replayMotion: () => void
  /** Troca os ajustes de nível de várias seções de uma vez (aplicar e desfazer). */
  setSectionLevels: (updates: Record<string, SectionLevels | undefined>) => void
  /** Remove tudo e deixa só uma página Home vazia. */
  clearCanvas: () => void
}

const NODE_DIMENSIONS: Record<NodeType, { width: number; height: number }> = {
  // Largura suficiente para a miniatura desktop (1440px) da seção ficar legível
  section: { width: SECTION_WIDTH, height: 200 },
  text: { width: 240, height: 160 },
  'color-palette': { width: 240, height: 140 },
}

const DEFAULT_NODE_DATA: Record<NodeType, SectionNodeData | TextNodeData | ColorPaletteNodeData> = {
  section: { title: 'Nova Seção', elementorJson: '' },
  text: { content: '' },
  'color-palette': { name: 'Minha Paleta', colors: ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'] },
}

/** Topo da página ou seção em foco, abaixo da barra do Space. */
const FOCUS_TOP = 80
/** Distância entre a página e uma seção que saiu dela. */
const DETACH_GAP = 48

const newPage = (name: string, position: { x: number; y: number }): SpacePage => ({
  id: crypto.randomUUID(),
  name,
  ...position,
  sectionIds: [],
})

/**
 * Move as seções para as posições dadas e leva junto os textos/paletas
 * conectados a cada uma, para as conexões não ficarem esticadas.
 */
function moveSections(nodes: SpaceNode[], connections: SpaceConnection[], positions: Map<string, { x: number; y: number }>) {
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
const layoutPage = (page: SpacePage, nodes: SpaceNode[], connections: SpaceConnection[]) =>
  moveSections(nodes, connections, pageSlots(page, nodes))

const layoutPages = (pages: SpacePage[], nodes: SpaceNode[], connections: SpaceConnection[]) =>
  pages.reduce((acc, page) => layoutPage(page, acc, connections), nodes)

/** As seções e os textos e paletas que só alimentavam elas, que saem junto. */
function withFeeders(sectionIds: string[], nodes: SpaceNode[], connections: SpaceConnection[]) {
  const removed = new Set(sectionIds)
  const feeders = new Set(connections.filter((c) => removed.has(c.targetId)).map((c) => c.sourceId))
  for (const c of connections) if (!removed.has(c.targetId)) feeders.delete(c.sourceId)
  for (const n of nodes) if (feeders.has(n.id) && n.type !== 'section') removed.add(n.id)
  return removed
}

type CanvasParts = Pick<SpaceState, 'nodes' | 'connections' | 'pages'>

/**
 * Peças novas do que foi copiado, com as seções na página e posição dadas. Os
 * textos e paletas ligados entram na mesma posição relativa à seção deles.
 */
function insertSnapshot(canvas: CanvasParts, snapshot: SectionSnapshot, pageId: string, index?: number) {
  const fresh = instantiateSnapshot(snapshot)
  const ids = fresh.sections.map((s) => s.id)
  const pages = canvas.pages.map((p) => {
    if (p.id !== pageId) return p
    const sectionIds = [...p.sectionIds]
    sectionIds.splice(index ?? sectionIds.length, 0, ...ids)
    return { ...p, sectionIds }
  })
  const connections = [...canvas.connections, ...fresh.connections]
  const page = pages.find((p) => p.id === pageId)
  const nodes = [...canvas.nodes, ...fresh.sections, ...fresh.feeders]
  return { pages, connections, nodes: page ? layoutPage(page, nodes, connections) : nodes, ids }
}

/** Ids na ordem de leitura do canvas (página por página), para copiar e colar na mesma ordem. */
const inCanvasOrder = (ids: string[], pages: SpacePage[], nodes: SpaceNode[]) => {
  const wanted = new Set(ids)
  return canvasSections(pages, nodes)
    .filter((s) => wanted.has(s.id))
    .map((s) => s.id)
}

/** Distância de uma cópia de seção solta até a original. */
const LOOSE_COPY_OFFSET = 40

/**
 * Canvas pronto para abrir: cada seção em no máximo uma página, sem ids que
 * não existem mais. Um canvas sem páginas (salvo antes delas) vira uma página
 * Home com as seções na ordem vertical, que era a ordem da página.
 */
function openCanvas(canvas?: SpaceCanvas) {
  const nodes = canvas?.nodes ?? []
  const connections = canvas?.connections ?? []
  const sectionIds = new Set(nodes.filter((n) => n.type === 'section').map((n) => n.id))
  const claimed = new Set<string>()
  let pages = (canvas?.pages ?? []).map((page) => {
    const ids: string[] = []
    for (const id of page.sectionIds) {
      if (!sectionIds.has(id) || claimed.has(id)) continue
      claimed.add(id)
      ids.push(id)
    }
    return { ...page, sectionIds: ids }
  })
  if (!pages.length) {
    const sections = orderedSections(nodes)
    const first = sections[0]
    const home = newPage(DEFAULT_PAGE_NAME, first ? { x: first.x - PAGE_PAD, y: first.y - PAGE_HEADER - PAGE_PAD } : nextPagePosition([], nodes))
    pages = [{ ...home, sectionIds: sections.map((s) => s.id) }]
  }
  return { nodes: layoutPages(pages, nodes, connections), connections, pages }
}

export const useSpaceStore = create<SpaceState & SpaceActions>()(
  devtools(
    (set, get) => {
      /** Transform que leva o ponto do mundo (x no centro da área livre, y no topo). */
      const focusOn = (worldCenterX: number, worldTop: number, leftInset = 0): CanvasTransform => {
        const { viewport, canvasTransform } = get()
        const { zoom } = canvasTransform
        return {
          zoom,
          x: leftInset + (viewport.width - leftInset) / 2 - worldCenterX * zoom,
          y: FOCUS_TOP - worldTop * zoom,
        }
      }

      return {
      nodes: [],
      connections: [],
      pages: [],
      canvasTransform: { x: 0, y: 0, zoom: 1 },
      pendingConnection: null,
      activePageId: null,
      renamingPageId: null,
      playingPageId: null,
      dropTarget: null,
      clipboard: null,
      libraryGhost: null,
      libraryPointer: null,
      selectedIds: [],
      editLevel: 'structure',
      motionDraft: null,
      motionReplay: 0,
      viewport: { width: 1024, height: 768 },

      loadCanvas: (canvas) => {
        const opened = openCanvas(canvas)
        set(
          {
            ...opened,
            canvasTransform: canvas?.canvasTransform ?? { x: 0, y: 0, zoom: 1 },
            pendingConnection: null,
            activePageId: opened.pages[0].id,
            renamingPageId: null,
            playingPageId: null,
            dropTarget: null,
            selectedIds: [],
            editLevel: 'structure',
            motionDraft: null,
          },
          false,
          'loadCanvas'
        )
      },

      addSection: (data, options) => get().addSections([data], options),

      addSections: (sections, options = {}) => {
        const { nodes, connections, activePageId } = get()
        let { pages } = get()
        let page = pages.find((p) => p.id === (options.pageId ?? activePageId)) ?? pages[0]
        if (!page) {
          page = newPage(DEFAULT_PAGE_NAME, nextPagePosition(pages, nodes))
          pages = [...pages, page]
        }

        const { width, height } = NODE_DIMENSIONS.section
        const created: SpaceNode[] = sections.map((data) => ({ id: crypto.randomUUID(), type: 'section', x: page.x, y: page.y, width, height, data }))
        const sectionIds = [...page.sectionIds]
        sectionIds.splice(options.index ?? sectionIds.length, 0, ...created.map((n) => n.id))
        const target = { ...page, sectionIds }
        const nextPages = pages.map((p) => (p.id === target.id ? target : p))
        const nextNodes = layoutPage(target, [...nodes, ...created], connections)
        const first = created[0] && nextNodes.find((n) => n.id === created[0].id)

        set(
          {
            nodes: nextNodes,
            pages: nextPages,
            activePageId: target.id,
            // Leva a primeira seção nova para o topo da área livre do canvas (fora do painel)
            ...(first && options.focus !== false ? { canvasTransform: focusOn(first.x + width / 2, first.y, options.leftInset) } : {}),
          },
          false,
          'addSections'
        )
        return target.id
      },

      addLooseSection: (data, x, y) => {
        const node: SpaceNode = { id: crypto.randomUUID(), type: 'section', x, y, ...NODE_DIMENSIONS.section, data }
        set((state) => ({ nodes: [...state.nodes, node] }), false, 'addLooseSection')
        return node.id
      },

      copySections: (ids) => {
        const { nodes, connections, pages } = get()
        const snapshot = snapshotSections(inCanvasOrder(ids, pages, nodes), nodes, connections)
        if (!snapshot.sections.length) return 0
        set({ clipboard: snapshot }, false, 'copySections')
        return snapshot.sections.length
      },

      pasteSections: (options = {}) => {
        const { clipboard, pages, activePageId, selectedIds } = get()
        const page = pages.find((p) => p.id === (options.pageId ?? activePageId)) ?? pages[0]
        if (!clipboard?.sections.length || !page) return null
        let index = options.index
        if (index === undefined) {
          const selected = page.sectionIds.map((id, i) => (selectedIds.includes(id) ? i : -1)).filter((i) => i >= 0)
          index = selected.length ? Math.max(...selected) + 1 : page.sectionIds.length
        }
        const result = insertSnapshot(get(), clipboard, page.id, index)
        set(
          { pages: result.pages, nodes: result.nodes, connections: result.connections, selectedIds: result.ids, activePageId: page.id },
          false,
          'pasteSections'
        )
        return { pageId: page.id, count: result.ids.length }
      },

      copySectionsTo: (ids, pageId, index) => {
        const { nodes, connections, pages } = get()
        if (!pages.some((p) => p.id === pageId)) return 0
        const snapshot = snapshotSections(inCanvasOrder(ids, pages, nodes), nodes, connections)
        if (!snapshot.sections.length) return 0
        const result = insertSnapshot(get(), snapshot, pageId, index)
        set(
          { pages: result.pages, nodes: result.nodes, connections: result.connections, selectedIds: result.ids, activePageId: pageId },
          false,
          'copySectionsTo'
        )
        return result.ids.length
      },

      duplicateSections: (ids) => {
        const ordered = inCanvasOrder(ids, get().pages, get().nodes)
        let canvas: CanvasParts = get()
        const created: string[] = []

        // Página por página: as cópias entram logo abaixo da última seção escolhida dela
        for (const page of get().pages) {
          const mine = ordered.filter((id) => page.sectionIds.includes(id))
          if (!mine.length) continue
          const after = Math.max(...mine.map((id) => page.sectionIds.indexOf(id))) + 1
          const result = insertSnapshot(canvas, snapshotSections(mine, canvas.nodes, canvas.connections), page.id, after)
          canvas = result
          created.push(...result.ids)
        }

        // Soltas: a cópia fica ao lado da original, com o que está ligado a ela
        const loose = ordered.filter((id) => !pageOf(canvas.pages, id))
        if (loose.length) {
          const fresh = instantiateSnapshot(snapshotSections(loose, canvas.nodes, canvas.connections))
          const shift = (n: SpaceNode) => ({ ...n, x: n.x + LOOSE_COPY_OFFSET, y: n.y + LOOSE_COPY_OFFSET })
          canvas = {
            ...canvas,
            nodes: [...canvas.nodes, ...fresh.sections.map(shift), ...fresh.feeders.map(shift)],
            connections: [...canvas.connections, ...fresh.connections],
          }
          created.push(...fresh.sections.map((s) => s.id))
        }

        if (!created.length) return 0
        set({ pages: canvas.pages, nodes: canvas.nodes, connections: canvas.connections, selectedIds: created }, false, 'duplicateSections')
        return created.length
      },

      moveSection: (id, direction) => {
        const { nodes, connections, pages } = get()
        const page = pageOf(pages, id)
        if (!page) return
        const order = [...page.sectionIds]
        const i = order.indexOf(id)
        const j = i + direction
        if (j < 0 || j >= order.length) return
        ;[order[i], order[j]] = [order[j], order[i]]
        const next = { ...page, sectionIds: order }
        set(
          { pages: pages.map((p) => (p.id === page.id ? next : p)), nodes: layoutPage(next, nodes, connections) },
          false,
          'moveSection'
        )
      },

      moveSectionToPage: (sectionId, pageId, index, at) => {
        const { nodes, connections, pages, activePageId } = get()
        const section = nodes.find((n) => n.id === sectionId && n.type === 'section')
        if (!section) return
        const from = pageOf(pages, sectionId)

        let nextPages = pages.map((p) => (p.id === from?.id ? { ...p, sectionIds: p.sectionIds.filter((s) => s !== sectionId) } : p))
        if (pageId) {
          nextPages = nextPages.map((p) => {
            if (p.id !== pageId) return p
            const ids = [...p.sectionIds]
            ids.splice(index ?? ids.length, 0, sectionId)
            return { ...p, sectionIds: ids }
          })
        }

        let nextNodes = nodes
        const source = nextPages.find((p) => p.id === from?.id)
        const target = nextPages.find((p) => p.id === pageId)
        if (source) nextNodes = layoutPage(source, nextNodes, connections)
        if (target) nextNodes = layoutPage(target, nextNodes, connections)
        else if (at) {
          // Solta onde o arrasto a deixou; textos e paletas ligados vão junto
          nextNodes = moveSections(nextNodes, connections, new Map([[sectionId, at]]))
        } else if (source) {
          // Solta pelo menu: logo abaixo da página de onde saiu, alinhada com a coluna
          const frame = pageFrame(source, nextNodes)
          const spot = { x: source.x + PAGE_PAD, y: frame.y + frame.height + DETACH_GAP }
          nextNodes = moveSections(nextNodes, connections, new Map([[sectionId, spot]]))
        }

        set({ pages: nextPages, nodes: nextNodes, activePageId: target?.id ?? activePageId }, false, 'moveSectionToPage')
      },

      copySectionToCanvas: (sectionId, x, y) => {
        const { nodes, connections } = get()
        const original = nodes.find((n) => n.id === sectionId && n.type === 'section')
        if (!original) return null
        const fresh = instantiateSnapshot(snapshotSections([sectionId], nodes, connections))
        const shift = (n: SpaceNode) => ({ ...n, x: n.x + x - original.x, y: n.y + y - original.y })
        set(
          {
            nodes: [...nodes, ...fresh.sections.map(shift), ...fresh.feeders.map(shift)],
            connections: [...connections, ...fresh.connections],
            selectedIds: fresh.sections.map((s) => s.id),
          },
          false,
          'copySectionToCanvas'
        )
        return fresh.sections[0]?.id ?? null
      },

      addPage: (name, options = {}) => {
        const { pages, nodes } = get()
        const page = newPage(name?.trim() || nextPageName(pages), nextPagePosition(pages, nodes))
        set(
          {
            pages: [...pages, page],
            activePageId: page.id,
            renamingPageId: name ? null : page.id,
            canvasTransform: focusOn(page.x + PAGE_WIDTH / 2, page.y, options.leftInset),
          },
          false,
          'addPage'
        )
        return page.id
      },

      renamePage: (id, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        set((state) => ({ pages: state.pages.map((p) => (p.id === id && p.name !== trimmed ? { ...p, name: trimmed } : p)) }), false, 'renamePage')
      },

      setRenamingPage: (id) => {
        set({ renamingPageId: id }, false, 'setRenamingPage')
      },

      removePage: (id) => {
        const { pages, nodes, connections, activePageId, selectedIds, playingPageId } = get()
        const page = pages.find((p) => p.id === id)
        if (!page || pages.length <= 1) return

        const removed = withFeeders(page.sectionIds, nodes, connections)
        const rest = pages.filter((p) => p.id !== id)
        set(
          {
            pages: rest,
            nodes: nodes.filter((n) => !removed.has(n.id)),
            connections: connections.filter((c) => !removed.has(c.sourceId) && !removed.has(c.targetId)),
            selectedIds: selectedIds.filter((s) => !removed.has(s)),
            activePageId: activePageId === id ? rest[0].id : activePageId,
            playingPageId: playingPageId === id ? null : playingPageId,
          },
          false,
          'removePage'
        )
      },

      duplicatePage: (id) => {
        const { pages, nodes, connections } = get()
        const page = pages.find((p) => p.id === id)
        if (!page) return

        // Seções com os textos e paletas ligados a elas, numa página nova à direita
        const copy = newPage(`${page.name} (cópia)`, nextPagePosition(pages, nodes))
        const result = insertSnapshot({ nodes, connections, pages: [...pages, copy] }, snapshotSections(page.sectionIds, nodes, connections), copy.id)
        set(
          {
            pages: result.pages,
            nodes: result.nodes,
            connections: result.connections,
            activePageId: copy.id,
            canvasTransform: focusOn(copy.x + PAGE_WIDTH / 2, copy.y),
          },
          false,
          'duplicatePage'
        )
      },

      loadSitePage: (name, sections, link, replacePageId) => {
        const { pages, nodes, connections, selectedIds } = get()
        const existing = replacePageId ? pages.find((p) => p.id === replacePageId) : undefined
        // Na página que já estava ligada, a versão do site entra no lugar das seções dela
        const removed = existing ? withFeeders(existing.sectionIds, nodes, connections) : new Set<string>()
        const base = existing ?? newPage(name, nextPagePosition(pages, nodes))

        const { width, height } = NODE_DIMENSIONS.section
        const created: SpaceNode[] = sections.map((data) => ({ id: crypto.randomUUID(), type: 'section', x: base.x, y: base.y, width, height, data }))
        const page: SpacePage = { ...base, sectionIds: created.map((n) => n.id), wordpress: link }
        const nextConnections = connections.filter((c) => !removed.has(c.sourceId) && !removed.has(c.targetId))
        const kept = nodes.filter((n) => !removed.has(n.id))

        set(
          {
            pages: existing ? pages.map((p) => (p.id === page.id ? page : p)) : [...pages, page],
            nodes: layoutPage(page, [...kept, ...created], nextConnections),
            connections: nextConnections,
            selectedIds: selectedIds.filter((id) => !removed.has(id)),
            activePageId: page.id,
            canvasTransform: focusOn(page.x + PAGE_WIDTH / 2, page.y),
          },
          false,
          'loadSitePage'
        )
        return page.id
      },

      setPageWordPress: (pageId, link) => {
        set(
          (state) => ({ pages: state.pages.map((p) => (p.id === pageId ? { ...p, wordpress: link } : p)) }),
          false,
          'setPageWordPress'
        )
      },

      setPageDetails: (pageId, details) => {
        set((state) => ({ pages: state.pages.map((p) => (p.id === pageId ? { ...p, details } : p)) }), false, 'setPageDetails')
      },

      movePage: (id, x, y) => {
        const { pages, nodes, connections } = get()
        const page = pages.find((p) => p.id === id)
        if (!page || (page.x === x && page.y === y)) return
        const moved = { ...page, x, y }
        set({ pages: pages.map((p) => (p.id === id ? moved : p)), nodes: layoutPage(moved, nodes, connections) }, false, 'movePage')
      },

      setActivePage: (id) => {
        if (get().activePageId !== id) set({ activePageId: id }, false, 'setActivePage')
      },

      focusPage: (id, options = {}) => {
        const page = get().pages.find((p) => p.id === id)
        if (!page) return
        set({ activePageId: id, canvasTransform: focusOn(page.x + PAGE_WIDTH / 2, page.y, options.leftInset) }, false, 'focusPage')
      },

      arrangePages: () => {
        const { pages, nodes, connections } = get()
        if (!pages.length) return
        const order = [...pages].sort((a, b) => a.x - b.x)
        let x = order[0].x
        const y = Math.min(...pages.map((p) => p.y))
        const placed = new Map<string, SpacePage>()
        for (const page of order) {
          placed.set(page.id, { ...page, x, y })
          x += PAGE_WIDTH + PAGE_GAP
        }
        const nextPages = pages.map((p) => placed.get(p.id) ?? p)
        set({ pages: nextPages, nodes: layoutPages(nextPages, nodes, connections) }, false, 'arrangePages')
      },

      setDropTarget: (target) => {
        const current = get().dropTarget
        if (current?.pageId === target?.pageId && current?.index === target?.index) return
        set({ dropTarget: target }, false, 'setDropTarget')
      },

      setLibraryGhost: (ghost) => {
        const current = get().libraryGhost
        if (current === ghost || (current && ghost && current.x === ghost.x && current.y === ghost.y && current.title === ghost.title)) return
        set({ libraryGhost: ghost }, false, 'setLibraryGhost')
      },

      setLibraryPointer: (pointer) => {
        if (!pointer && !get().libraryPointer) return
        set({ libraryPointer: pointer }, false, 'setLibraryPointer')
      },

      openPlayer: (pageId) => {
        set({ playingPageId: pageId, activePageId: pageId }, false, 'openPlayer')
      },

      closePlayer: () => {
        set({ playingPageId: null }, false, 'closePlayer')
      },

      setViewport: (width, height) => {
        set({ viewport: { width, height } }, false, 'setViewport')
      },

      addNode: (type, x, y) => {
        const dims = NODE_DIMENSIONS[type]
        const data = { ...DEFAULT_NODE_DATA[type] }
        const newId = crypto.randomUUID()

        const { nodes, connections, pages, selectedIds, activePageId } = get()

        // Texto e paleta já entram ligados a uma seção, à esquerda dela: a selecionada,
        // senão a última da página ativa, senão a última adicionada
        let autoConnectSectionId: string | null = null
        let finalX = x - dims.width / 2
        let finalY = y - dims.height / 2

        if (type === 'text' || type === 'color-palette') {
          const sections = nodes.filter((n) => n.type === 'section')
          const activeIds = pages.find((p) => p.id === activePageId)?.sectionIds ?? []
          const targetId = selectedIds[selectedIds.length - 1] ?? activeIds[activeIds.length - 1] ?? sections[sections.length - 1]?.id
          const targetSection = sections.find((s) => s.id === targetId)
          if (targetSection) {
            autoConnectSectionId = targetSection.id

            const GAP = 40
            finalX = targetSection.x - dims.width - GAP
            // Stack multiple transformers vertically if section already has connections
            const existingInputs = connections.filter((c) => c.targetId === targetSection.id)
            finalY = targetSection.y + existingInputs.length * (dims.height + 20)
          }
        }

        const connType: 'apply-copy' | 'apply-colors' =
          type === 'color-palette' ? 'apply-colors' : 'apply-copy'

        set(
          (state) => ({
            nodes: [
              ...state.nodes,
              {
                id: newId,
                type,
                x: finalX,
                y: finalY,
                ...dims,
                data,
              },
            ],
            connections:
              autoConnectSectionId
                ? [
                    ...state.connections,
                    {
                      id: crypto.randomUUID(),
                      sourceId: newId,
                      targetId: autoConnectSectionId,
                      type: connType,
                    },
                  ]
                : state.connections,
          }),
          false,
          'addNode'
        )
      },

      removeNode: (id) => {
        const { pages, nodes, connections, selectedIds } = get()
        const page = pageOf(pages, id)
        const nextPages = page ? pages.map((p) => (p.id === page.id ? { ...p, sectionIds: p.sectionIds.filter((s) => s !== id) } : p)) : pages
        const nextConnections = connections.filter((c) => c.sourceId !== id && c.targetId !== id)
        let nextNodes = nodes.filter((n) => n.id !== id)
        // A página fecha o buraco que a seção deixou
        const shrunk = page && nextPages.find((p) => p.id === page.id)
        if (shrunk) nextNodes = layoutPage(shrunk, nextNodes, nextConnections)
        set(
          { pages: nextPages, nodes: nextNodes, connections: nextConnections, selectedIds: selectedIds.filter((s) => s !== id) },
          false,
          'removeNode'
        )
      },

      updateNodePosition: (id, x, y) => {
        // Seção de página fica no lugar da coluna; só a página se move
        if (pageOf(get().pages, id)) return
        set(
          (state) => ({
            nodes: state.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
          }),
          false,
          'updateNodePosition'
        )
      },

      updateNodeData: (id, data) => {
        set(
          (state) => ({
            nodes: state.nodes.map((n) =>
              n.id === id ? { ...n, data: { ...n.data, ...data } as typeof n.data } : n
            ),
          }),
          false,
          'updateNodeData'
        )
      },

      updateNodeSize: (id, width, height) => {
        const { nodes, connections, pages } = get()
        const node = nodes.find((n) => n.id === id)
        if (!node || (node.width === width && node.height === height)) return
        let next = nodes.map((n) => (n.id === id ? { ...n, width, height } : n))

        // Seção que cresce ou encolhe (o preview terminou de carregar, o JSON abriu)
        // empurra as seções logo abaixo dela, como numa página
        const page = node.type === 'section' ? pageOf(pages, id) : undefined
        const dh = height - node.height
        if (page) next = layoutPage(page, next, connections)
        else if (node.type === 'section' && dh !== 0) {
          // Soltas: só as soltas da mesma coluna; as de página seguem a página delas
          const bottom = node.y + node.height
          const positions = new Map<string, { x: number; y: number }>()
          for (const s of orderedSections(nodes)) {
            const sameColumn = s.x < node.x + node.width && s.x + s.width > node.x
            if (s.id !== id && sameColumn && s.y >= bottom - 1 && !pageOf(pages, s.id)) positions.set(s.id, { x: s.x, y: s.y + dh })
          }
          if (positions.size) next = moveSections(next, connections, positions)
        }

        set({ nodes: next }, false, 'updateNodeSize')
      },

      startConnection: (sourceId, sourceX, sourceY) => {
        set(
          { pendingConnection: { sourceId, sourceX, sourceY, currentX: sourceX, currentY: sourceY } },
          false,
          'startConnection'
        )
      },

      updatePendingConnection: (currentX, currentY) => {
        set(
          (state) =>
            state.pendingConnection
              ? { pendingConnection: { ...state.pendingConnection, currentX, currentY } }
              : {},
          false,
          'updatePendingConnection'
        )
      },

      completeConnection: (targetId) => {
        const { pendingConnection, nodes, connections } = get()
        if (!pendingConnection) return

        const { sourceId } = pendingConnection

        // Prevent self-connection and duplicates
        if (sourceId === targetId) {
          set({ pendingConnection: null }, false, 'cancelConnection')
          return
        }

        const isDuplicate = connections.some(
          (c) => c.sourceId === sourceId && c.targetId === targetId
        )
        if (isDuplicate) {
          set({ pendingConnection: null }, false, 'cancelConnection')
          return
        }

        const sourceNode = nodes.find((n) => n.id === sourceId)
        const targetNode = nodes.find((n) => n.id === targetId)
        if (!sourceNode || !targetNode) {
          set({ pendingConnection: null }, false, 'cancelConnection')
          return
        }

        // Infer connection type: text → section = apply-copy, palette → section = apply-colors
        let connType: 'apply-copy' | 'apply-colors' = 'apply-copy'
        if (sourceNode.type === 'color-palette') {
          connType = 'apply-colors'
        } else if (sourceNode.type === 'text') {
          connType = 'apply-copy'
        }

        set(
          (state) => ({
            connections: [
              ...state.connections,
              { id: crypto.randomUUID(), sourceId, targetId, type: connType },
            ],
            pendingConnection: null,
          }),
          false,
          'completeConnection'
        )
      },

      cancelConnection: () => {
        set({ pendingConnection: null }, false, 'cancelConnection')
      },

      removeConnection: (id) => {
        set(
          (state) => ({ connections: state.connections.filter((c) => c.id !== id) }),
          false,
          'removeConnection'
        )
      },

      setCanvasTransform: (transform) => {
        set(
          (state) => ({ canvasTransform: { ...state.canvasTransform, ...transform } }),
          false,
          'setCanvasTransform'
        )
      },

      panCanvas: (dx, dy) => {
        set(
          (state) => ({
            canvasTransform: {
              ...state.canvasTransform,
              x: state.canvasTransform.x + dx,
              y: state.canvasTransform.y + dy,
            },
          }),
          false,
          'panCanvas'
        )
      },

      selectSection: (id, additive = false) => {
        set(
          (state) => {
            // Clicar numa seção de página torna a página ativa
            const activePageId = pageOf(state.pages, id)?.id ?? state.activePageId
            const selected = state.selectedIds.includes(id)
            if (!additive) return { activePageId, selectedIds: selected && state.selectedIds.length === 1 ? [] : [id] }
            return { activePageId, selectedIds: selected ? state.selectedIds.filter((s) => s !== id) : [...state.selectedIds, id] }
          },
          false,
          'selectSection'
        )
      },

      setSelection: (ids) => {
        set({ selectedIds: ids }, false, 'setSelection')
      },

      clearSelection: () => {
        if (get().selectedIds.length) set({ selectedIds: [] }, false, 'clearSelection')
      },

      setEditLevel: (level) => {
        // Rascunho é de um nível só: trocar de nível descarta o que não foi aplicado
        set({ editLevel: level, motionDraft: null }, false, 'setEditLevel')
      },

      setMotionDraft: (draft) => {
        set({ motionDraft: draft }, false, 'setMotionDraft')
      },

      replayMotion: () => {
        set((state) => ({ motionReplay: state.motionReplay + 1 }), false, 'replayMotion')
      },

      setSectionLevels: (updates) => {
        set(
          (state) => ({
            nodes: state.nodes.map((n) => {
              if (!(n.id in updates) || n.type !== 'section') return n
              const levels = updates[n.id]
              const data = { ...(n.data as SectionNodeData) }
              if (levels && Object.values(levels).some((v) => v !== undefined)) data.levels = levels
              else delete data.levels
              return { ...n, data }
            }),
          }),
          false,
          'setSectionLevels'
        )
      },

      clearCanvas: () => {
        const first = get().pages[0]
        const home = newPage(DEFAULT_PAGE_NAME, first ? { x: first.x, y: first.y } : nextPagePosition([], []))
        set(
          {
            nodes: [],
            connections: [],
            pages: [home],
            activePageId: home.id,
            renamingPageId: null,
            playingPageId: null,
            dropTarget: null,
            pendingConnection: null,
            selectedIds: [],
            motionDraft: null,
          },
          false,
          'clearCanvas'
        )
      },
      }
    },
    { name: 'space-store' }
  )
)
