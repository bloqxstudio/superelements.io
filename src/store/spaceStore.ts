import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  DEFAULT_PAGE_NAME,
  PAGE_HEADER,
  PAGE_PAD,
  PAGE_GAP,
  PAGE_WIDTH,
  SECTION_GAP,
  SECTION_WIDTH,
  canvasSections,
  sectionsHeight,
  nextPageName,
  nextPagePosition,
  pageFrame,
  pageOf,
  pageSlots,
} from '@/features/space/pages/pages'
import { instantiateSnapshot, snapshotSections, type SectionSnapshot } from '@/features/space/pages/clipboard'
import { componentElements, componentSectionData, contentKey, elementComponent, elementsOfUse, freshCopy, keepOwnContent, modeLookup, refreshUses, remapIds, syncKey, textsOf, siteFrameSections, suggestName, syncComponents, tagElement, untagElement, walk } from '@/features/space/components/components'
import { editSection, locate } from '@/features/space/editor/tree'
import { findElement } from '@/features/space/navigator/elementorContentEditor'
import { orderedSections, parseSectionElements, type SectionElement } from '@/features/space/landingPage'
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
  ComponentRole,
  ComponentTexts,
  SpaceComponent,
  SectionNodeData,
  TextNodeData,
  ColorPaletteNodeData,
  EditLevel,
  NavigatorSelection,
  SectionLevels,
  SectionMotion,
  EditorDevice,
} from '@/types/space'

interface SpaceState {
  nodes: SpaceNode[]
  /** Componentes do projeto: o conteúdo de agora de cada um; os usos ficam nas páginas. */
  components: SpaceComponent[]
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
  /** Camada Elementor escolhida no Navigator; não é persistida com o canvas. */
  navigatorSelection: NavigatorSelection | null
  /** Camada em edição; muda o que o canvas mostra e abre o painel do nível. */
  editLevel: EditLevel
  /** Movimento ainda não aplicado: o canvas mostra nas seções selecionadas como elas ficariam. */
  motionDraft: SectionMotion | null
  /** Sobe a cada pedido para rever as animações das miniaturas. */
  motionReplay: number
  /** Tamanho da área do canvas na tela, para centralizar nós novos. */
  viewport: { width: number; height: number }
  /** Estados anteriores do canvas para o Ctrl+Z, do mais antigo ao mais recente. */
  past: CanvasSnapshot[]
  /** O que o Ctrl+Z desfez, para o Ctrl+Shift+Z refazer. */
  future: CanvasSnapshot[]
  /** Tela em que as seções aparecem no canvas; o painel de propriedades grava os ajustes nela. */
  previewDevice: EditorDevice
  /** Elementos copiados de dentro de uma seção (Ctrl+C numa camada), com as settings fixadas deles. */
  elementClipboard: { elements: SectionElement[]; pinned: Record<string, string[]> } | null
  /** Camada sob o mouse na árvore do Navigator, destacada no canvas. */
  hoveredElement: NavigatorSelection | null
}

/** O que o desfazer guarda: só o que o usuário edita. */
export type CanvasSnapshot = Pick<SpaceState, 'nodes' | 'pages' | 'connections' | 'components'>

/**
 * O que o projeto guarda do canvas; o resto (seleção, nível, rascunho) é da sessão.
 * Canvas salvos antes das páginas não têm `pages`: ao abrir, as seções viram a página Home.
 */
export type SpaceCanvas = Pick<SpaceState, 'nodes' | 'connections' | 'canvasTransform'> & { pages?: SpacePage[]; components?: SpaceComponent[] }

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
  /**
   * Troca o conteúdo pelo que outra pessoa (ou aba) salvou, mantendo a sessão
   * daqui: zoom, página ativa, player e seleção que ainda existirem. O desfazer
   * recomeça, para não desfazer o trabalho do outro.
   */
  syncCanvas: (canvas: SpaceCanvas) => void
  /**
   * Troca nós, páginas e conexões de uma vez, como um passo só do desfazer.
   * Para mudanças montadas fora do canvas (a ponte do Claude); as seções das
   * páginas voltam para os lugares da coluna.
   */
  commitCanvas: (next: Partial<CanvasSnapshot>) => void
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
  /**
   * Transforma a seção inteira (sem `elementId`) ou uma camada dela num
   * componente, que passa a poder ser usado em outros lugares; devolve o id.
   * O que já é um uso devolve o componente dele.
   */
  createComponent: (sectionId: string, elementId?: string, name?: string) => string | null
  /** Separa este uso do componente: vira seção (ou camada) comum, que muda sozinha. */
  detachComponent: (sectionId: string, elementId?: string) => void
  /** Liga as seções iguais a um componente de seção: viram usos dele. Devolve quantas. */
  linkCopies: (componentId: string, sectionIds: string[]) => number
  /**
   * Um uso do componente de seção no topo (cabeçalho) ou no fim (rodapé) de
   * cada página indicada. A página que já tem um uso fica com ele, com o
   * conteúdo do registro. Devolve quantas páginas ganharam o componente.
   */
  placeComponent: (componentId: string, pageIds: string[], where: 'top' | 'bottom') => number
  /** Um uso do componente de seção, na página (na posição, ou no fim); devolve o id da seção. */
  insertComponentSection: (componentId: string, pageId: string, index?: number) => string | null
  renameComponent: (id: string, name: string) => void
  /**
   * Textos, links e imagens iguais em todos os usos (`shared`) ou de cada uso
   * (`own`). Ao passar a iguais, os do uso dado (a seleção) vão para os outros.
   */
  setComponentTexts: (id: string, texts: ComponentTexts, from?: { sectionId: string; elementId?: string }) => void
  /** Cabeçalho ou rodapé do site (vai para o Theme Builder ao publicar), ou nenhum. */
  setComponentRole: (id: string, role: ComponentRole | undefined) => void
  /** Tira o componente do projeto: os usos viram seções e camadas comuns. */
  deleteComponent: (id: string) => void
  /** Componente trazido de um modelo do Elementor do site; o que já está ligado ao mesmo modelo é atualizado. Devolve o id. */
  loadSiteComponent: (component: Omit<SpaceComponent, 'id'>) => string
  /** Liga o componente a um modelo do Elementor do site (ou desliga, sem link). */
  setComponentWordPress: (id: string, link: PageWordPressLink | undefined) => void
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
  /**
   * Troca dados do nó. Mudanças seguidas no mesmo nó e campos viram um passo só
   * do desfazer (digitar); `merge: false` sempre cria um passo, e uma string
   * junta os passos com a mesma chave (arrastar uma alça).
   */
  updateNodeData: (id: string, data: Partial<SectionNodeData | TextNodeData | ColorPaletteNodeData>, options?: { merge?: string | false }) => void
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
  selectNavigatorElement: (selection: NavigatorSelection | null) => void
  setEditLevel: (level: EditLevel) => void
  setMotionDraft: (draft: SectionMotion | null) => void
  replayMotion: () => void
  /** Troca os ajustes de nível de várias seções de uma vez (aplicar e desfazer). */
  setSectionLevels: (updates: Record<string, SectionLevels | undefined>) => void
  /** Remove tudo e deixa só uma página Home vazia. */
  clearCanvas: () => void
  /** Volta o canvas ao estado antes da última mudança; devolve se havia o que desfazer. */
  undo: () => boolean
  redo: () => boolean
  setPreviewDevice: (device: EditorDevice) => void
  setElementClipboard: (clipboard: SpaceState['elementClipboard']) => void
  hoverNavigatorElement: (element: NavigatorSelection | null) => void
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

/** Passos guardados pelo desfazer. */
const HISTORY_LIMIT = 100
/** Mudanças com a mesma chave dentro deste intervalo viram um passo só (digitar, arrastar). */
const MERGE_WINDOW = 800

/**
 * Os nós com o tamanho que têm agora na tela: a altura medida vem do preview,
 * que não mede de novo se nada mudou nele.
 */
function withCurrentSizes(nodes: SpaceNode[], current: SpaceNode[]) {
  const sizes = new Map(current.map((n) => [n.id, n]))
  return nodes.map((n) => {
    const now = sizes.get(n.id)
    return now && (now.width !== n.width || now.height !== n.height) ? { ...n, width: now.width, height: now.height } : n
  })
}

/** Canvas de um passo do desfazer, com o tamanho atual das seções. */
function restoreSnapshot(snapshot: CanvasSnapshot, current: SpaceNode[]) {
  const nodes = withCurrentSizes(snapshot.nodes, current)
  return { nodes: layoutPages(snapshot.pages, nodes, snapshot.connections), pages: snapshot.pages, connections: snapshot.connections, components: snapshot.components }
}

/**
 * Algo saiu do canvas por uma ação de quem usa (excluir a página, a seção,
 * limpar o canvas), com a cópia do que saiu: o registro de atividades guarda
 * para a lixeira. Desfazer e sincronizar com outra pessoa não avisam.
 */
export type CanvasRemoval =
  | { kind: 'page'; page: SpacePage; nodes: SpaceNode[] }
  | { kind: 'section'; node: SpaceNode; pageId?: string; pageName?: string; index: number }
  | { kind: 'canvas'; pages: SpacePage[]; nodes: SpaceNode[] }

const removalListeners = new Set<(removal: CanvasRemoval) => void>()
export const onCanvasRemoval = (listener: (removal: CanvasRemoval) => void) => {
  removalListeners.add(listener)
  return () => void removalListeners.delete(listener)
}
const emitRemoval = (removal: CanvasRemoval) => removalListeners.forEach((listener) => listener(removal))

/**
 * A mudança em curso é só a altura de um nó medida na tela (o preview
 * carregou, a fonte trocou): o projeto salva, mas não conta como edição.
 */
let measuring = false
export const isMeasuring = () => measuring

const sameCanvas = (a: CanvasSnapshot, b: CanvasSnapshot) => a.nodes === b.nodes && a.pages === b.pages && a.connections === b.connections && a.components === b.components

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
  const migrated = migrateSheets(pages, nodes, connections, canvas?.components ?? [])
  pages = migrated.pages
  if (!pages.length) {
    const sections = orderedSections(nodes)
    const first = sections[0]
    const home = newPage(DEFAULT_PAGE_NAME, first ? { x: first.x - PAGE_PAD, y: first.y - PAGE_HEADER - PAGE_PAD } : nextPagePosition([], nodes))
    pages = [{ ...home, sectionIds: sections.map((s) => s.id) }]
  }
  return { nodes: layoutPages(pages, migrated.nodes, migrated.connections), connections: migrated.connections, pages, components: migrated.components }
}

/**
 * Projetos do modelo anterior (2026-10-06, folhas de cabeçalho, rodapé e
 * componente à esquerda das páginas): cada folha vira um componente de seção,
 * com um uso em cada página que a mostrava, e as folhas saem do canvas.
 */
function migrateSheets(pages: SpacePage[], nodes: SpaceNode[], connections: SpaceConnection[], components: SpaceComponent[]) {
  const sheets = pages.filter((p) => p.part)
  const orphans = nodes.some((n) => n.type === 'section' && (n.data as SectionNodeData).instanceOf)
  if (!sheets.length && !orphans) return { pages, nodes, connections, components }
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const site = pages.filter((p) => !p.part).map((p) => ({ ...p, sectionIds: [...p.sectionIds] }))
  const added: SpaceNode[] = []
  const nextComponents = [...components]
  const converted = new Map<string, SpaceNode>()
  for (const sheet of sheets) {
    const sections = sheet.sectionIds.map((id) => byId.get(id)).filter((n): n is SpaceNode => n?.type === 'section')
    const elements = sections.flatMap((n) => parseSectionElements((n.data as SectionNodeData).elementorJson) ?? [])
    const kind = sheet.part!.kind
    const role = kind === 'header' || kind === 'footer' ? kind : undefined
    nextComponents.push({ id: sheet.id, name: sheet.name, level: 'section', elementorJson: JSON.stringify(elements), ...(role ? { role } : {}), ...(sheet.wordpress ? { wordpress: sheet.wordpress } : {}) })
    const height = sections.reduce((sum, n) => sum + n.height, 0) || NODE_DIMENSIONS.section.height
    const makeUse = (page: SpacePage): SpaceNode => ({
      id: crypto.randomUUID(),
      type: 'section',
      x: page.x,
      y: page.y,
      width: SECTION_WIDTH,
      height,
      data: { title: sheet.name, elementorJson: JSON.stringify(freshCopy(elements).elements), component: sheet.id },
    })
    if (role) {
      for (const page of site) {
        if (sheet.part!.exclude?.includes(page.id)) continue
        const node = makeUse(page)
        added.push(node)
        if (role === 'header') page.sectionIds.unshift(node.id)
        else page.sectionIds.push(node.id)
      }
    }
    for (const node of nodes) {
      if (node.type !== 'section' || (node.data as SectionNodeData).instanceOf !== sheet.id) continue
      const { instanceOf: _old, ...data } = node.data as SectionNodeData
      converted.set(node.id, { ...node, data: { ...data, elementorJson: JSON.stringify(freshCopy(elements).elements), component: sheet.id } })
    }
  }
  // Seções das folhas e instâncias sem componente saem
  const gone = new Set(sheets.flatMap((sheet) => sheet.sectionIds))
  for (const node of nodes) if (node.type === 'section' && (node.data as SectionNodeData).instanceOf && !converted.has(node.id)) gone.add(node.id)
  const nextNodes = [...nodes.filter((n) => !gone.has(n.id)).map((n) => converted.get(n.id) ?? n), ...added]
  return {
    pages: site.map((p) => ({ ...p, sectionIds: p.sectionIds.filter((id) => !gone.has(id)) })),
    nodes: nextNodes,
    connections: connections.filter((c) => !gone.has(c.sourceId) && !gone.has(c.targetId)),
    components: nextComponents,
  }
}

export const useSpaceStore = create<SpaceState & SpaceActions>()(
  devtools(
    (set, get) => {
      let lastTrack = { key: '', at: 0 }
      /**
       * Guarda o canvas antes de uma mudança do usuário, para o desfazer. Chamar
       * logo antes do set, depois das validações. Com `merge`, mudanças seguidas
       * com a mesma chave (digitar, arrastar) viram um passo só.
       */
      const track = (merge?: string) => {
        const now = Date.now()
        const merged = !!merge && merge === lastTrack.key && now - lastTrack.at < MERGE_WINDOW
        lastTrack = { key: merge ?? '', at: now }
        if (merged) return
        const { nodes, pages, connections, components, past } = get()
        set({ past: [...past.slice(-(HISTORY_LIMIT - 1)), { nodes, pages, connections, components }], future: [] }, false, 'history')
      }

      /** Seleção que ainda existe no canvas depois de desfazer ou refazer. */
      const validSelection = (nodes: SpaceNode[]) => {
        const { selectedIds, navigatorSelection } = get()
        const ids = new Set(nodes.map((n) => n.id))
        const section = navigatorSelection && nodes.find((n) => n.id === navigatorSelection.sectionId)
        const keepsElement =
          section?.type === 'section' && !!findElement(parseSectionElements((section.data as SectionNodeData).elementorJson), navigatorSelection!.elementId)
        return { selectedIds: selectedIds.filter((id) => ids.has(id)), navigatorSelection: keepsElement ? navigatorSelection : null }
      }

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
      components: [],
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
      navigatorSelection: null,
      editLevel: 'structure',
      motionDraft: null,
      motionReplay: 0,
      viewport: { width: 1024, height: 768 },
      past: [],
      future: [],
      previewDevice: 'desktop',
      elementClipboard: null,
      hoveredElement: null,

      loadCanvas: (canvas) => {
        const opened = openCanvas(canvas)
        lastTrack = { key: '', at: 0 }
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
            navigatorSelection: null,
            editLevel: 'structure',
            motionDraft: null,
            // Outro projeto: o desfazer não volta para o canvas anterior
            past: [],
            future: [],
            hoveredElement: null,
          },
          false,
          'loadCanvas'
        )
      },

      syncCanvas: (canvas) => {
        // As alturas medidas aqui valem mais que as de quem salvou: a seção que mudar mede de novo
        const opened = openCanvas({ ...canvas, nodes: withCurrentSizes(canvas.nodes ?? [], get().nodes) })
        const { activePageId, renamingPageId, playingPageId } = get()
        const pageIds = new Set(opened.pages.map((p) => p.id))
        const keep = (id: string | null) => (id && pageIds.has(id) ? id : null)
        lastTrack = { key: '', at: 0 }
        set(
          {
            ...opened,
            ...validSelection(opened.nodes),
            activePageId: keep(activePageId) ?? opened.pages[0].id,
            renamingPageId: keep(renamingPageId),
            playingPageId: keep(playingPageId),
            pendingConnection: null,
            past: [],
            future: [],
          },
          false,
          'syncCanvas'
        )
      },

      commitCanvas: (next) => {
        const { nodes, pages, connections, components } = { ...get(), ...next }
        track()
        set(
          (state) => ({
            pages,
            connections,
            components,
            nodes: layoutPages(pages, nodes, connections),
            ...validSelection(nodes),
            activePageId: pages.some((p) => p.id === state.activePageId) ? state.activePageId : pages[0]?.id ?? null,
          }),
          false,
          'commitCanvas'
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

        track()
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
        track()
        set((state) => ({ nodes: [...state.nodes, node] }), false, 'addLooseSection')
        return node.id
      },

      copySections: (ids) => {
        const { nodes, connections, pages } = get()
        const snapshot = snapshotSections(inCanvasOrder(ids, pages, nodes), nodes, connections)
        if (!snapshot.sections.length) return 0
        // Colar pega o que foi copiado por último: seções agora, não a camada de antes
        set({ clipboard: snapshot, elementClipboard: null }, false, 'copySections')
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
        track()
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
        track()
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
        track()
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
        const nextPages = pages.map((p) => (p.id === page.id ? next : p))
        track()
        set(
          { pages: nextPages, nodes: layoutPage(next, nodes, connections) },
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

        track()
        set({ pages: nextPages, nodes: nextNodes, activePageId: target?.id ?? activePageId }, false, 'moveSectionToPage')
      },

      copySectionToCanvas: (sectionId, x, y) => {
        const { nodes, connections } = get()
        const original = nodes.find((n) => n.id === sectionId && n.type === 'section')
        if (!original) return null
        const fresh = instantiateSnapshot(snapshotSections([sectionId], nodes, connections))
        const shift = (n: SpaceNode) => ({ ...n, x: n.x + x - original.x, y: n.y + y - original.y })
        track()
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
        const { pages, nodes, connections, components } = get()
        const page = newPage(name?.trim() || nextPageName(pages), nextPagePosition(pages, nodes))
        // Como no site: a página nova já vem com o cabeçalho e o rodapé do site
        const frame = siteFrameSections(components, nodes)
        const created = [frame.header, frame.footer]
          .filter((data): data is SectionNodeData => !!data)
          .map((data): SpaceNode => ({ id: crypto.randomUUID(), type: 'section', x: page.x, y: page.y, ...NODE_DIMENSIONS.section, data }))
        const withFrame = created.length ? { ...page, sectionIds: created.map((n) => n.id) } : page
        const nextPages = [...pages, withFrame]
        track()
        set(
          {
            pages: nextPages,
            ...(created.length ? { nodes: layoutPages(nextPages, [...nodes, ...created], connections) } : {}),
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
        if (!trimmed || get().pages.find((p) => p.id === id)?.name === trimmed) return
        track(`renamePage:${id}`)
        set((state) => ({ pages: state.pages.map((p) => (p.id === id && p.name !== trimmed ? { ...p, name: trimmed } : p)) }), false, 'renamePage')
      },

      setRenamingPage: (id) => {
        set({ renamingPageId: id }, false, 'setRenamingPage')
      },

      removePage: (id) => {
        const { pages, nodes, connections, activePageId, selectedIds, playingPageId, navigatorSelection } = get()
        const page = pages.find((p) => p.id === id)
        if (!page || pages.length <= 1) return

        const removed = withFeeders(page.sectionIds, nodes, connections)
        const rest = pages.filter((p) => p.id !== id)
        emitRemoval({ kind: 'page', page, nodes: page.sectionIds.map((s) => nodes.find((n) => n.id === s)).filter((n): n is SpaceNode => !!n) })
        track()
        set(
          {
            pages: rest,
            nodes: nodes.filter((n) => !removed.has(n.id)),
            connections: connections.filter((c) => !removed.has(c.sourceId) && !removed.has(c.targetId)),
            selectedIds: selectedIds.filter((s) => !removed.has(s)),
            navigatorSelection: navigatorSelection && removed.has(navigatorSelection.sectionId) ? null : navigatorSelection,
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
        // O site tem um cabeçalho e um rodapé só
        if (!page || page.part) return

        // Seções com os textos e paletas ligados a elas, numa página nova à direita
        const copy = newPage(`${page.name} (cópia)`, nextPagePosition(pages, nodes))
        const result = insertSnapshot({ nodes, connections, pages: [...pages, copy] }, snapshotSections(page.sectionIds, nodes, connections), copy.id)
        track()
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
        const { pages, nodes, connections, selectedIds, navigatorSelection } = get()
        const existing = replacePageId ? pages.find((p) => p.id === replacePageId) : undefined
        // Na página que já estava ligada, a versão do site entra no lugar das seções dela
        const removed = existing ? withFeeders(existing.sectionIds, nodes, connections) : new Set<string>()
        const base = existing ?? newPage(name, nextPagePosition(pages, nodes))

        const { width, height } = NODE_DIMENSIONS.section
        const created: SpaceNode[] = sections.map((data) => ({ id: crypto.randomUUID(), type: 'section', x: base.x, y: base.y, width, height, data }))
        const page: SpacePage = { ...base, sectionIds: created.map((n) => n.id), wordpress: link }
        const nextConnections = connections.filter((c) => !removed.has(c.sourceId) && !removed.has(c.targetId))
        const kept = nodes.filter((n) => !removed.has(n.id))
        const nextPages = existing ? pages.map((p) => (p.id === page.id ? page : p)) : [...pages, page]

        track()
        set(
          {
            pages: nextPages,
            nodes: layoutPage(page, [...kept, ...created], nextConnections),
            connections: nextConnections,
            selectedIds: selectedIds.filter((id) => !removed.has(id)),
            navigatorSelection: navigatorSelection && removed.has(navigatorSelection.sectionId) ? null : navigatorSelection,
            activePageId: page.id,
            canvasTransform: focusOn(page.x + PAGE_WIDTH / 2, page.y),
          },
          false,
          'loadSitePage'
        )
        return page.id
      },

      createComponent: (sectionId, elementId, name) => {
        const { nodes, components } = get()
        const node = nodes.find((n) => n.id === sectionId && n.type === 'section')
        if (!node) return null
        const data = node.data as SectionNodeData
        const root = parseSectionElements(data.elementorJson)
        if (!root?.length) return null
        const id = crypto.randomUUID()

        if (!elementId) {
          // A seção inteira
          if (data.component) return data.component
          const component: SpaceComponent = { id, name: name?.trim() || data.title || 'Componente', level: 'section', elementorJson: data.elementorJson }
          track()
          set(
            { components: [...components, component], nodes: nodes.map((n) => (n.id === sectionId ? { ...n, data: { ...data, component: id } } : n)) },
            false,
            'createComponent'
          )
          return id
        }

        // Uma camada: ganha a marca de uso, e o registro guarda ela com a marca
        const location = locate(root, elementId)
        if (!location) return null
        const existing = elementComponent(location.element)
        if (existing) return existing
        const edited = editSection(data.elementorJson, (tree) => {
          const here = locate(tree, elementId)
          if (!here) return null
          here.siblings[here.index] = tagElement(here.element, id)
          return here.siblings[here.index]
        })
        if (!edited) return null
        const label = data.navigatorLabels?.[elementId]
        const component: SpaceComponent = {
          id,
          name: name?.trim() || label || suggestName(location.element, 'Componente'),
          level: 'element',
          elementorJson: JSON.stringify([edited.result]),
        }
        track()
        set(
          {
            components: [...components, component],
            nodes: nodes.map((n) => (n.id === sectionId ? { ...n, data: { ...data, elementorJson: edited.json } } : n)),
          },
          false,
          'createComponent'
        )
        return id
      },

      detachComponent: (sectionId, elementId) => {
        const { nodes } = get()
        const node = nodes.find((n) => n.id === sectionId && n.type === 'section')
        if (!node) return
        const data = node.data as SectionNodeData
        let next: SectionNodeData | null = null
        if (!elementId) {
          if (!data.component) return
          const { component: _gone, ...rest } = data
          next = rest
        } else {
          const edited = editSection(data.elementorJson, (tree) => {
            const here = locate(tree, elementId)
            if (!here || !elementComponent(here.element)) return null
            here.siblings[here.index] = untagElement(here.element)
            return true
          })
          if (edited) next = { ...data, elementorJson: edited.json }
        }
        if (!next) return
        track()
        set({ nodes: nodes.map((n) => (n.id === sectionId ? { ...n, data: next! } : n)) }, false, 'detachComponent')
      },

      linkCopies: (componentId, sectionIds) => {
        const { nodes, components } = get()
        const component = components.find((c) => c.id === componentId && c.level === 'section')
        if (!component) return 0
        // O mesmo desenho; com textos de cada uso, os textos podem ser outros
        const modeOf = modeLookup(components)
        const key = syncKey(componentElements(component), textsOf(component), modeOf)
        const ids = new Set(
          sectionIds.filter((id) => {
            const node = nodes.find((n) => n.id === id && n.type === 'section')
            const data = node?.data as SectionNodeData | undefined
            return !!data && !data.component && syncKey(parseSectionElements(data.elementorJson) ?? [], textsOf(component), modeOf) === key
          })
        )
        if (!ids.size) return 0
        track()
        set({ nodes: nodes.map((n) => (ids.has(n.id) ? { ...n, data: { ...(n.data as SectionNodeData), component: componentId } } : n)) }, false, 'linkCopies')
        return ids.size
      },

      placeComponent: (componentId, pageIds, where) => {
        const { nodes, pages, connections, components } = get()
        const component = components.find((c) => c.id === componentId && c.level === 'section')
        if (!component) return 0
        const source = componentElements(component)
        const wanted = new Set(pageIds)
        let added = 0
        const created: SpaceNode[] = []
        const refreshed = new Map<string, SpaceNode>()
        const nextPages = pages.map((page) => {
          if (!wanted.has(page.id)) return page
          const own = page.sectionIds.map((id) => nodes.find((n) => n.id === id)).find((n) => n && (n.data as SectionNodeData).component === componentId)
          if (own) {
            // Já tem: fica com o desenho de agora do componente, com os ids e (se forem dele) os textos dela
            const data = own.data as SectionNodeData
            const current = parseSectionElements(data.elementorJson) ?? []
            const mapped = keepOwnContent(remapIds(source, current).elements, current, textsOf(component), modeLookup(components))
            refreshed.set(own.id, { ...own, data: { ...data, elementorJson: JSON.stringify(mapped) } })
            return page
          }
          const node: SpaceNode = { id: crypto.randomUUID(), type: 'section', x: page.x, y: page.y, ...NODE_DIMENSIONS.section, data: componentSectionData(component, nodes) }
          created.push(node)
          added++
          return { ...page, sectionIds: where === 'top' ? [node.id, ...page.sectionIds] : [...page.sectionIds, node.id] }
        })
        if (!created.length && !refreshed.size) return 0
        track()
        set({ pages: nextPages, nodes: layoutPages(nextPages, [...nodes.map((n) => refreshed.get(n.id) ?? n), ...created], connections) }, false, 'placeComponent')
        return added
      },

      insertComponentSection: (componentId, pageId, index) => {
        const component = get().components.find((c) => c.id === componentId && c.level === 'section')
        if (!component) return null
        const targetPage = get().addSections([componentSectionData(component, get().nodes)], { pageId, index, focus: false })
        const page = get().pages.find((p) => p.id === targetPage)
        return page ? page.sectionIds[index ?? page.sectionIds.length - 1] ?? null : null
      },

      renameComponent: (id, name) => {
        const trimmed = name.trim()
        if (!trimmed || get().components.find((c) => c.id === id)?.name === trimmed) return
        track(`renameComponent:${id}`)
        set((state) => ({ components: state.components.map((c) => (c.id === id ? { ...c, name: trimmed } : c)) }), false, 'renameComponent')
      },

      setComponentTexts: (id, texts, from) => {
        const { components, nodes } = get()
        const component = components.find((c) => c.id === id)
        if (!component || textsOf(component) === texts) return
        const updated: SpaceComponent = { ...component, texts }
        // Textos iguais a partir do uso escolhido: o registro fica com ele, e os outros usos recebem
        const source = texts === 'shared' && from ? elementsOfUse(nodes, from.sectionId, from.elementId) : null
        if (source) updated.elementorJson = JSON.stringify(source)
        const nextComponents = components.map((c) => (c.id === id ? updated : c))
        track()
        set(
          { components: nextComponents, ...(texts === 'shared' ? { nodes: refreshUses(nodes, updated, modeLookup(nextComponents)) } : {}) },
          false,
          'setComponentTexts'
        )
      },

      setComponentRole: (id, role) => {
        const { components } = get()
        const component = components.find((c) => c.id === id)
        if (!component || component.level !== 'section' || component.role === role) return
        track()
        set(
          {
            // Um cabeçalho (e um rodapé) por site: o anterior perde o papel
            components: components.map((c) => {
              if (c.id === id) return role ? { ...c, role } : (({ role: _r, ...rest }) => rest)(c)
              return role && c.role === role ? (({ role: _r, ...rest }) => rest)(c) : c
            }),
          },
          false,
          'setComponentRole'
        )
      },

      deleteComponent: (id) => {
        const { nodes, components } = get()
        if (!components.some((c) => c.id === id)) return
        // Os usos viram seções e camadas comuns
        const nextNodes = nodes.map((node) => {
          if (node.type !== 'section') return node
          const data = node.data as SectionNodeData
          let next = data
          if (data.component === id) {
            const { component: _gone, ...rest } = data
            next = rest
          }
          const root = parseSectionElements(next.elementorJson)
          let tagged = false
          if (root) walk(root, (element) => (tagged ||= elementComponent(element) === id))
          if (tagged) {
            const edited = editSection(next.elementorJson, (tree) => {
              const strip = (list: SectionElement[]): SectionElement[] =>
                list.map((element) => {
                  const own = elementComponent(element) === id ? untagElement(element) : element
                  return own.elements?.length ? { ...own, elements: strip(own.elements) } : own
                })
              tree.splice(0, tree.length, ...strip(tree))
              return true
            })
            if (edited) next = { ...next, elementorJson: edited.json }
          }
          return next === data ? node : { ...node, data: next }
        })
        track()
        set({ nodes: nextNodes, components: components.filter((c) => c.id !== id) }, false, 'deleteComponent')
      },

      loadSiteComponent: (incoming) => {
        const { components, nodes } = get()
        const link = incoming.wordpress
        const existing = link && components.find((c) => c.wordpress?.siteUrl === link.siteUrl && c.wordpress.postId === link.postId)
        const id = existing ? existing.id : crypto.randomUUID()
        // Componente de camada: o registro guarda a camada com a marca de uso, como os usos
        const elementorJson =
          incoming.level === 'element' ? JSON.stringify((parseSectionElements(incoming.elementorJson) ?? []).map((e) => tagElement(e, id))) : incoming.elementorJson
        if (existing) {
          // A versão do site entra no registro e em todos os usos que já estão no canvas
          const updated = { ...existing, ...incoming, elementorJson, id }
          const nextComponents = components.map((c) => (c.id === id ? updated : c))
          set({ components: nextComponents, nodes: refreshUses(nodes, updated, modeLookup(nextComponents)) }, false, 'loadSiteComponent')
          return id
        }
        set({ components: [...components, { ...incoming, elementorJson, id }] }, false, 'loadSiteComponent')
        return id
      },

      setComponentWordPress: (id, link) => {
        set((state) => ({ components: state.components.map((c) => (c.id === id ? { ...c, wordpress: link } : c)) }), false, 'setComponentWordPress')
      },

      setPageWordPress: (pageId, link) => {
        set(
          (state) => ({ pages: state.pages.map((p) => (p.id === pageId ? { ...p, wordpress: link } : p)) }),
          false,
          'setPageWordPress'
        )
      },

      setPageDetails: (pageId, details) => {
        track(`details:${pageId}`)
        set((state) => ({ pages: state.pages.map((p) => (p.id === pageId ? { ...p, details } : p)) }), false, 'setPageDetails')
      },

      movePage: (id, x, y) => {
        const { pages, nodes, connections } = get()
        const page = pages.find((p) => p.id === id)
        if (!page || (page.x === x && page.y === y)) return
        const moved = { ...page, x, y }
        const nextPages = pages.map((p) => (p.id === id ? moved : p))
        track(`movePage:${id}`)
        set({ pages: nextPages, nodes: layoutPage(moved, nodes, connections) }, false, 'movePage')
      },

      setActivePage: (id) => {
        if (get().activePageId !== id) set({ activePageId: id, navigatorSelection: null }, false, 'setActivePage')
      },

      focusPage: (id, options = {}) => {
        const page = get().pages.find((p) => p.id === id)
        if (!page) return
        set({ activePageId: id, navigatorSelection: null, canvasTransform: focusOn(page.x + PAGE_WIDTH / 2, page.y, options.leftInset) }, false, 'focusPage')
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
        track()
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
        set({ playingPageId: pageId, activePageId: pageId, navigatorSelection: null }, false, 'openPlayer')
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

        track()
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
        const removedNode = nodes.find((n) => n.id === id)
        if (removedNode?.type === 'section') emitRemoval({ kind: 'section', node: removedNode, pageId: page?.id, pageName: page?.name, index: page ? page.sectionIds.indexOf(id) : -1 })
        track()
        set(
          {
            pages: nextPages,
            nodes: nextNodes,
            connections: nextConnections,
            selectedIds: selectedIds.filter((s) => s !== id),
            navigatorSelection: get().navigatorSelection?.sectionId === id ? null : get().navigatorSelection,
          },
          false,
          'removeNode'
        )
      },

      updateNodePosition: (id, x, y) => {
        // Seção de página fica no lugar da coluna; só a página se move
        if (pageOf(get().pages, id)) return
        track(`position:${id}`)
        set(
          (state) => ({
            nodes: state.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
          }),
          false,
          'updateNodePosition'
        )
      },

      updateNodeData: (id, data, options = {}) => {
        const merge = options.merge === undefined ? `data:${id}:${Object.keys(data).sort().join(',')}` : options.merge || undefined
        track(merge)
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
        // Fração de pixel do layout não move a coluna
        if (!node || (node.width === width && Math.abs(node.height - height) < 0.5)) return
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

        measuring = true
        try {
          set({ nodes: next }, false, 'updateNodeSize')
        } finally {
          measuring = false
        }
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

        track()
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
        track()
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
            if (!additive) return { activePageId, navigatorSelection: null, selectedIds: selected && state.selectedIds.length === 1 ? [] : [id] }
            return { activePageId, navigatorSelection: null, selectedIds: selected ? state.selectedIds.filter((s) => s !== id) : [...state.selectedIds, id] }
          },
          false,
          'selectSection'
        )
      },

      setSelection: (ids) => {
        set(
          (state) => ({
            selectedIds: ids,
            navigatorSelection: ids.length === 1 && state.navigatorSelection?.sectionId === ids[0] ? state.navigatorSelection : null,
          }),
          false,
          'setSelection'
        )
      },

      clearSelection: () => {
        if (get().selectedIds.length || get().navigatorSelection) set({ selectedIds: [], navigatorSelection: null }, false, 'clearSelection')
      },

      selectNavigatorElement: (selection) => {
        set(
          (state) => ({
            navigatorSelection: selection,
            selectedIds: selection ? [selection.sectionId] : state.selectedIds,
            activePageId: selection ? pageOf(state.pages, selection.sectionId)?.id ?? state.activePageId : state.activePageId,
          }),
          false,
          'selectNavigatorElement'
        )
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
        track()
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
        const { pages, nodes } = get()
        if (nodes.some((n) => n.type === 'section')) emitRemoval({ kind: 'canvas', pages, nodes: nodes.filter((n) => n.type === 'section') })
        track()
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
            navigatorSelection: null,
            motionDraft: null,
          },
          false,
          'clearCanvas'
        )
      },

      undo: () => {
        const { past, future, nodes, pages, connections, components } = get()
        const current = { nodes, pages, connections, components }
        // Passos que não mudaram nada (um campo que recebeu o mesmo valor) são pulados
        let i = past.length - 1
        while (i >= 0 && sameCanvas(past[i], current)) i--
        if (i < 0) {
          if (past.length) set({ past: [] }, false, 'undo')
          return false
        }
        lastTrack = { key: '', at: 0 }
        const restored = restoreSnapshot(past[i], nodes)
        set({ ...restored, ...validSelection(restored.nodes), past: past.slice(0, i), future: [...future, current] }, false, 'undo')
        return true
      },

      redo: () => {
        const { past, future, nodes, pages, connections, components } = get()
        const next = future[future.length - 1]
        if (!next) return false
        lastTrack = { key: '', at: 0 }
        const restored = restoreSnapshot(next, nodes)
        set({ ...restored, ...validSelection(restored.nodes), past: [...past, { nodes, pages, connections, components }], future: future.slice(0, -1) }, false, 'redo')
        return true
      },

      setPreviewDevice: (device) => {
        if (get().previewDevice !== device) set({ previewDevice: device }, false, 'setPreviewDevice')
      },

      setElementClipboard: (clipboard) => {
        set({ elementClipboard: clipboard }, false, 'setElementClipboard')
      },

      hoverNavigatorElement: (element) => {
        const current = get().hoveredElement
        if (current?.sectionId === element?.sectionId && current?.elementId === element?.elementId) return
        set({ hoveredElement: element }, false, 'hoverNavigatorElement')
      },
      }
    },
    { name: 'space-store' }
  )
)

/**
 * Componentes: quando um uso muda (texto digitado, estilo, camada nova), o
 * registro e todos os outros usos recebem a mudança na hora. Roda logo depois
 * da mudança e não grava passo próprio: o Ctrl+Z desfaz os usos juntos.
 */
let syncingComponents = false
useSpaceStore.subscribe((state, prev) => {
  if (syncingComponents || state.nodes === prev.nodes || !state.components.length) return
  const result = syncComponents(prev.nodes, state.nodes, state.components)
  if (!result) return
  syncingComponents = true
  try {
    useSpaceStore.setState({ nodes: result.nodes, components: result.components }, false)
  } finally {
    syncingComponents = false
  }
})
