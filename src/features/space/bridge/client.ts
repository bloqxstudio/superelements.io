import { renderElementorDocument } from '@/engine/elementor'
import { useProjectStore } from '@/features/projects/projectStore'
import { useProjectSync } from '@/features/projects/useProjectSession'
import { getActiveBrand, useBrandStore } from '@/features/space/brand/brandStore'
import { buildLandingPage, parseSectionElements, type SectionElement } from '@/features/space/landingPage'
import { findElement } from '@/features/space/navigator/elementorContentEditor'
import { DEFAULT_PAGE_NAME, nextPagePosition, pageOf, pageSections, SECTION_WIDTH } from '@/features/space/pages/pages'
import { isFromSite, renderKit } from '@/features/space/renderKit'
import { getSiteKit } from '@/features/wordpress/siteKitStore'
import { useSpaceStore } from '@/store/spaceStore'
import type { SectionNodeData, SpaceNode, SpacePage } from '@/types/space'
import { DEFAULT_AGENT, useClaudeBridge, type ClaudeStepKind, type TouchKind } from './bridgeStore'
import { focusSection } from './focus'

/**
 * Lado do navegador da ponte dos agentes, Claude ou Codex (só no `npm run dev`;
 * o servidor fica em `scripts/space/vitePlugin.ts`). A aba se apresenta,
 * responde aos pedidos do `scripts/space/space.mjs` e aplica as mudanças no
 * canvas como um passo do desfazer. Salvar na conta continua com o projeto
 * aberto, com o login de quem está aqui, como qualquer edição feita à mão.
 */

type Hot = NonNullable<ImportMeta['hot']>

const TAB_KEY = 'space-bridge-tab'
const HEARTBEAT = 10_000
/** Altura da tela de cada aparelho, a mesma do player: as medidas em vh valem sobre ela. */
const DEVICE_HEIGHT: Record<string, number> = { desktop: 900, tablet: 1024, mobile: 812 }

// A mesma aba continua com o mesmo id ao recarregar (abrir outro projeto recarrega)
const tabId = (() => {
  try {
    const saved = sessionStorage.getItem(TAB_KEY)
    if (saved) return saved
    const id = crypto.randomUUID()
    sessionStorage.setItem(TAB_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
})()

let activeAt = Date.now()
/** Quem fez o pedido em andamento (Claude, Codex…), para o painel e as marcas. */
let currentAgent = DEFAULT_AGENT

const routeProjectId = () => location.pathname.match(/^\/projetos\/([^/?#]+)/)?.[1]

/** Projeto desta aba, só depois que o conteúdo da conta entrou no canvas. */
const openProjectId = () => {
  const id = routeProjectId()
  return id && useProjectSync.getState().openId === id ? id : undefined
}

const info = () => {
  const projectId = routeProjectId()
  return {
    tabId,
    url: location.pathname,
    projectId,
    projectName: projectId ? useProjectStore.getState().projects.find((p) => p.id === projectId)?.name : undefined,
    ready: !!openProjectId(),
    visible: document.visibilityState === 'visible',
    focused: document.hasFocus(),
    activeAt,
  }
}

/** FNV-1a: muda quando o título ou o JSON da seção muda, para saber se alguém mexeu desde a leitura. */
const hashOf = (data: SectionNodeData) => {
  const text = `${data.title}\u0000${data.elementorJson}`
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16).padStart(8, '0')
}

const sectionInfo = (node: SpaceNode, index?: number) => {
  const data = node.data as SectionNodeData
  return {
    id: node.id,
    index,
    title: data.title,
    sourceId: data.sourceId,
    fromSite: !!data.origin,
    valid: !!parseSectionElements(data.elementorJson),
    size: data.elementorJson.length,
    hash: hashOf(data),
  }
}

const stripTags = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

/** Texto curto do elemento escolhido, para o Claude saber de que título ou botão a pessoa fala. */
const elementText = (element: SectionElement) => {
  const settings = (Array.isArray(element.settings) ? {} : element.settings ?? {}) as Record<string, unknown>
  const text = ['title', 'editor', 'text', 'button_text', 'heading', 'description_text', 'title_text'].map((k) => settings[k]).find((v) => typeof v === 'string' && v.trim())
  return typeof text === 'string' ? stripTags(text).slice(0, 140) : undefined
}

const requireProject = () => {
  const id = openProjectId()
  if (!id) throw new Error(routeProjectId() ? 'O projeto ainda está abrindo nesta aba; tente de novo em instantes' : 'Nenhum projeto aberto nesta aba. Use "open" ou abra um projeto no Space.')
  return id
}

const findNode = (nodes: SpaceNode[], id: string) => {
  const matches = nodes.filter((n) => n.type === 'section' && (n.id === id || n.id.startsWith(id)))
  if (matches.length !== 1) throw new Error(matches.length ? `Id de seção ambíguo: ${id}` : `Seção não encontrada no canvas: ${id}`)
  return matches[0]
}

const findPage = (pages: SpacePage[], ref: string | undefined) => {
  const { activePageId } = useSpaceStore.getState()
  if (!ref) return pages.find((p) => p.id === activePageId) ?? pages[0]
  const lower = ref.toLowerCase()
  const page = pages.find((p) => p.id === ref) ?? pages.find((p) => p.id.startsWith(ref)) ?? pages.find((p) => p.name.toLowerCase() === lower)
  if (!page) throw new Error(`Página não encontrada: ${ref}`)
  return page
}

function status() {
  const projectId = openProjectId()
  const project = routeProjectId() ? useProjectStore.getState().projects.find((p) => p.id === routeProjectId()) : undefined
  const brand = useBrandStore.getState()
  const space = useSpaceStore.getState()
  const base = {
    route: location.pathname,
    ready: !!projectId,
    project: project ? { id: project.id, name: project.name, role: project.role ?? 'owner', context: project.context } : null,
  }
  if (!projectId) return base

  const { nodes, pages, selectedIds, navigatorSelection } = space
  const placed = new Set(pages.flatMap((p) => p.sectionIds))
  const selectedNode = navigatorSelection && nodes.find((n) => n.id === navigatorSelection.sectionId)
  const element =
    selectedNode && navigatorSelection
      ? findElement(parseSectionElements((selectedNode.data as SectionNodeData).elementorJson), navigatorSelection.elementId)
      : null

  return {
    ...base,
    brand: { name: brand.brand?.name ?? null, enabled: brand.enabled, hasSource: !!brand.source.trim() },
    hasSiteKit: !!getSiteKit(),
    activePageId: space.activePageId,
    device: space.previewDevice,
    editLevel: space.editLevel,
    pages: pages.map((page) => ({
      id: page.id,
      name: page.name,
      wordpress: page.wordpress ? { siteUrl: page.wordpress.siteUrl, postId: page.wordpress.postId, link: page.wordpress.link } : undefined,
      sections: pageSections(page, nodes).map((n, i) => sectionInfo(n, i)),
    })),
    loose: nodes.filter((n) => n.type === 'section' && !placed.has(n.id)).map((n) => sectionInfo(n)),
    selection: {
      sectionIds: selectedIds,
      element:
        element && navigatorSelection
          ? {
              sectionId: navigatorSelection.sectionId,
              elementId: navigatorSelection.elementId,
              elType: element.elType,
              widgetType: element.widgetType,
              label: (selectedNode!.data as SectionNodeData).navigatorLabels?.[navigatorSelection.elementId],
              text: elementText(element),
            }
          : null,
    },
  }
}

/** Tudo o que o Claude precisa para trabalhar numa página: as seções inteiras, a marca e o briefing. */
function pull(params: { pages?: string[] }) {
  requireProject()
  const { nodes, pages } = useSpaceStore.getState()
  const chosen = params.pages?.length ? params.pages.map((ref) => findPage(pages, ref)) : pages
  return {
    ...status(),
    brandSource: useBrandStore.getState().source,
    content: chosen.map((page) => ({
      id: page.id,
      name: page.name,
      sections: pageSections(page, nodes).map((n, index) => ({ ...sectionInfo(n, index), data: n.data as SectionNodeData })),
    })),
  }
}

type Op =
  | { op: 'update'; id: string; title?: string; elementorJson?: string; data?: Partial<SectionNodeData> }
  | { op: 'insert'; ref?: string; page?: string; index?: number; after?: string; before?: string; data: SectionNodeData }
  | { op: 'remove'; id: string }
  | { op: 'move'; id: string; page?: string; index?: number; after?: string; before?: string }
  | { op: 'addPage'; ref?: string; name?: string }
  | { op: 'renamePage'; page: string; name: string }
  | { op: 'removePage'; page: string }

interface ApplyParams {
  label: string
  ops: Op[]
  /** Hash de cada seção quando o Claude leu; se mudou no canvas desde então, nada é aplicado. */
  expect?: Record<string, string>
  force?: boolean
  focus?: boolean
}

const checkJson = (json: string, what: string) => {
  if (!parseSectionElements(json)?.length) throw new Error(`${what}: o elementorJson não é um JSON do Elementor válido`)
}

/** Todas as mudanças de uma vez, num passo só do desfazer; se uma falhar, nenhuma entra. */
function apply(params: ApplyParams) {
  requireProject()
  const state = useSpaceStore.getState()
  let { nodes, pages, connections } = state

  if (!params.force) {
    // Seção conferida que não existe mais também barra: alguém a tirou do canvas depois da leitura
    const changed = Object.entries(params.expect ?? {})
      .map(([id, hash]) => ({ node: findNode(nodes, id), hash }))
      .filter(({ node, hash }) => hashOf(node.data as SectionNodeData) !== hash)
    if (changed.length) {
      const names = changed.map(({ node }) => `"${(node.data as SectionNodeData).title}"`).join(', ')
      throw new Error(`Mudou no canvas depois da leitura: ${names}. Leia de novo (pull) antes de gravar, para não apagar o que foi feito à mão.`)
    }
    // Mudar uma seção que não foi lida antes também pode apagar trabalho feito à mão
    const unread = params.ops.filter((op) => op.op === 'update' && !Object.keys(params.expect ?? {}).some((id) => findNode(nodes, id).id === findNode(nodes, op.id).id))
    if (unread.length) throw new Error('Toda seção alterada precisa da leitura dela (pull) antes; ou grave com --force')
  }

  const pageRefs = new Map<string, string>()
  const created: Record<string, string> = {}
  const touched: Record<string, TouchKind> = {}
  const pageOfRef = (ref?: string) => findPage(pages, ref && pageRefs.has(ref) ? pageRefs.get(ref) : ref)

  /** Posição na coluna: depois/antes de uma seção da página, um índice, ou o fim. */
  const slot = (page: SpacePage, op: { index?: number; after?: string; before?: string }) => {
    const ids = page.sectionIds
    const at = (ref: string) => {
      const id = created[ref] ?? findNode(nodes, ref).id
      const i = ids.indexOf(id)
      if (i < 0) throw new Error(`A seção ${ref} não está na página ${page.name}`)
      return i
    }
    if (op.after) return at(op.after) + 1
    if (op.before) return at(op.before)
    return Math.max(0, Math.min(op.index ?? ids.length, ids.length))
  }

  const putIn = (page: SpacePage, id: string, index: number) => {
    const sectionIds = page.sectionIds.filter((s) => s !== id)
    sectionIds.splice(Math.min(index, sectionIds.length), 0, id)
    pages = pages.map((p) => (p.id === page.id ? { ...p, sectionIds } : p))
  }

  for (const op of params.ops) {
    switch (op.op) {
      case 'update': {
        const node = findNode(nodes, op.id)
        if (op.elementorJson !== undefined) checkJson(op.elementorJson, `Seção "${(node.data as SectionNodeData).title}"`)
        const patch: Partial<SectionNodeData> = { ...op.data }
        if (op.title !== undefined) patch.title = op.title
        if (op.elementorJson !== undefined) patch.elementorJson = op.elementorJson
        nodes = nodes.map((n) => (n.id === node.id ? { ...n, data: { ...(n.data as SectionNodeData), ...patch } } : n))
        // Esqueleto do plano que ganhou conteúdo: para quem olha, é uma seção nova
        touched[node.id] ??= useClaudeBridge.getState().pending[node.id] ? 'created' : 'changed'
        break
      }
      case 'insert': {
        if (!op.data?.title) throw new Error('Seção nova sem título')
        checkJson(op.data.elementorJson ?? '', `Seção nova "${op.data.title}"`)
        const page = pageOfRef(op.page)
        const node: SpaceNode = { id: crypto.randomUUID(), type: 'section', x: page.x, y: page.y, width: SECTION_WIDTH, height: 200, data: op.data }
        nodes = [...nodes, node]
        putIn(page, node.id, slot(page, op))
        if (op.ref) created[op.ref] = node.id
        touched[node.id] = 'created'
        break
      }
      case 'remove': {
        const node = findNode(nodes, op.id)
        nodes = nodes.filter((n) => n.id !== node.id)
        connections = connections.filter((c) => c.sourceId !== node.id && c.targetId !== node.id)
        pages = pages.map((p) => ({ ...p, sectionIds: p.sectionIds.filter((s) => s !== node.id) }))
        delete touched[node.id]
        break
      }
      case 'move': {
        const node = findNode(nodes, op.id)
        const from = pageOf(pages, node.id)
        const target = op.page ? pageOfRef(op.page) : from
        if (!target) throw new Error(`A seção ${op.id} está solta: diga para que página ela vai`)
        if (from && from.id !== target.id) pages = pages.map((p) => (p.id === from.id ? { ...p, sectionIds: p.sectionIds.filter((s) => s !== node.id) } : p))
        const current = pages.find((p) => p.id === target.id)!
        // A posição é contada sem a própria seção, como no arrasto
        const without = { ...current, sectionIds: current.sectionIds.filter((s) => s !== node.id) }
        putIn(without, node.id, slot(without, op))
        touched[node.id] ??= 'changed'
        break
      }
      case 'addPage': {
        const position = nextPagePosition(pages, nodes)
        const page: SpacePage = { id: crypto.randomUUID(), name: op.name?.trim() || DEFAULT_PAGE_NAME, ...position, sectionIds: [] }
        pages = [...pages, page]
        if (op.ref) pageRefs.set(op.ref, page.id)
        break
      }
      case 'renamePage': {
        const page = findPage(pages, op.page)
        if (!op.name?.trim()) throw new Error('Nome de página vazio')
        pages = pages.map((p) => (p.id === page.id ? { ...p, name: op.name.trim() } : p))
        break
      }
      case 'removePage': {
        const page = findPage(pages, op.page)
        if (pages.length === 1) throw new Error('A última página do canvas não sai')
        const gone = new Set(page.sectionIds)
        nodes = nodes.filter((n) => !gone.has(n.id))
        connections = connections.filter((c) => !gone.has(c.sourceId) && !gone.has(c.targetId))
        pages = pages.filter((p) => p.id !== page.id)
        for (const id of gone) delete touched[id]
        break
      }
      default:
        throw new Error(`Operação desconhecida: ${(op as { op: string }).op}`)
    }
  }

  useSpaceStore.getState().commitCanvas({ nodes, pages, connections })
  const ids = Object.keys(touched)
  const bridge = useClaudeBridge.getState()
  bridge.touch(touched, currentAgent)
  bridge.reveal(ids)
  // Página do plano sem esqueleto sobrando: terminou de ser construída
  const { pending, working } = useClaudeBridge.getState()
  const built = pages.filter((p) => working[p.id] && !p.sectionIds.some((id) => pending[id])).map((p) => p.id)
  if (built.length) bridge.clearWorking(built)
  bridge.log('change', params.label || 'Mudança no canvas', ids, currentAgent)
  if (params.focus !== false && ids[0]) focus({ id: ids[0] })
  // Hash novo de cada seção mexida: a próxima gravação do Claude confere a partir dele
  const hashes = Object.fromEntries(nodes.filter((n) => touched[n.id]).map((n) => [n.id, hashOf(n.data as SectionNodeData)]))
  return { created, touched, hashes, pages: Object.fromEntries(pageRefs) }
}

/** Leva o canvas até a seção (ou o topo da página), sem mudar o zoom. */
function focus(params: { id?: string; page?: string }) {
  requireProject()
  const space = useSpaceStore.getState()
  if (params.page) {
    const page = findPage(space.pages, params.page)
    space.focusPage(page.id)
    return { pageId: page.id }
  }
  const node = findNode(space.nodes, params.id ?? '')
  focusSection(node.id)
  return { sectionId: node.id }
}

function say(params: { text: string; kind?: ClaudeStepKind; sections?: string[] }) {
  if (!params.text?.trim()) throw new Error('Mensagem vazia')
  const { nodes } = useSpaceStore.getState()
  const ids = (params.sections ?? []).map((id) => findNode(nodes, id).id)
  const bridge = useClaudeBridge.getState()
  bridge.log(params.kind ?? 'note', params.text.trim(), ids.length ? ids : undefined, currentAgent)
  // Terminou, ou parou para perguntar: some a varredura de onde ele estava mexendo
  if (params.kind === 'done' || params.kind === 'question') bridge.clearWorking()
  return { ok: true }
}

/** Id curto no formato do Elementor. */
const elementId = () => Math.random().toString(16).slice(2, 9).padEnd(7, '0')

/**
 * Esqueleto de uma seção planejada: o título e três linhas cinza, em
 * containers nativos. Fica borrado no canvas até o agente construir a seção
 * de verdade por cima (o mesmo id), e serve de lugar marcado se ele parar.
 */
function skeletonSection(title: string) {
  const bar = (width: number) => ({
    id: elementId(),
    elType: 'container',
    isInner: true,
    settings: {
      content_width: 'full',
      width: { unit: '%', size: width, sizes: [] },
      min_height: { unit: 'px', size: 14, sizes: [] },
      background_background: 'classic',
      background_color: '#E4E4E7',
      border_radius: { unit: 'px', top: '7', right: '7', bottom: '7', left: '7', isLinked: true },
    },
    elements: [],
  })
  return [
    {
      id: elementId(),
      elType: 'container',
      isInner: false,
      settings: {
        content_width: 'boxed',
        flex_direction: 'column',
        flex_gap: { unit: 'px', size: 16, column: '16', row: '16', isLinked: true },
        padding: { unit: 'px', top: '96', right: '24', bottom: '96', left: '24', isLinked: false },
        background_background: 'classic',
        background_color: '#FAFAFA',
      },
      elements: [
        { id: elementId(), elType: 'widget', widgetType: 'heading', settings: { title, header_size: 'h2', title_color: '#A1A1AA' }, elements: [] },
        bar(72),
        bar(56),
        bar(64),
      ],
    },
  ]
}

/** Mostra no canvas onde o agente está mexendo (seções, uma página ou o projeto todo), ou para de mostrar. */
function work(params: { text?: string; sections?: string[]; page?: string; done?: boolean }) {
  requireProject()
  const bridge = useClaudeBridge.getState()
  if (params.done) {
    bridge.clearWorking()
    return { ok: true }
  }
  const text = params.text?.trim() || 'Trabalhando'
  const { nodes, pages } = useSpaceStore.getState()
  const ids = [
    ...(params.sections ?? []).map((id) => findNode(nodes, id).id),
    ...(params.page ? [findPage(pages, params.page).id] : []),
  ]
  // O que estava marcado antes deixa de estar: ele mexe num lugar de cada vez
  bridge.clearWorking()
  bridge.setWorking(ids.length ? ids : ['*'], { agent: currentAgent, text, since: Date.now() })
  if (ids[0] && params.sections?.length) focusSection(ids[0])
  return { ok: true }
}

/**
 * O plano de uma página: as seções que vão existir, em esqueleto borrado, numa
 * página nova (`newPage`) ou numa que já existe. O agente constrói cada uma
 * gravando por cima dela, e quem olha vê a página ficar nítida seção por seção.
 */
function plan(params: { titles: string[]; page?: string; newPage?: string; after?: string; label?: string }) {
  requireProject()
  if (!params.titles?.length) throw new Error('Diga as seções do plano')
  const ops: Op[] = []
  if (params.newPage) ops.push({ op: 'addPage', ref: 'plan', name: params.newPage })
  let after = params.after
  params.titles.forEach((title, i) => {
    const ref = `plan:${i}`
    ops.push({ op: 'insert', ref, page: params.newPage ? 'plan' : params.page, after, data: { title, elementorJson: JSON.stringify(skeletonSection(title)) } })
    if (after) after = ref
  })
  const label = params.label ?? `Plano ${params.newPage ? `da página ${params.newPage}` : 'da página'}: ${params.titles.join(', ')}`
  const result = apply({ label, ops, focus: false })
  const ids = params.titles.map((_, i) => result.created[`plan:${i}`])
  const pageId = result.pages.plan ?? findPage(useSpaceStore.getState().pages, params.page).id
  const bridge = useClaudeBridge.getState()
  bridge.markPending(ids)
  bridge.touch({}, currentAgent)
  bridge.setWorking([pageId], { agent: currentAgent, text: 'Construindo a página', since: Date.now() })
  useSpaceStore.getState().focusPage(pageId)
  return { pageId, sections: ids.map((id, i) => ({ id, title: params.titles[i], hash: result.hashes[id] })) }
}

/** A página (ou só algumas seções) como o player mostra, sem animação, para a foto conferir o resultado. */
function render(params: { page?: string; sections?: string[]; device?: string }) {
  requireProject()
  const { nodes, pages, connections } = useSpaceStore.getState()
  const page = params.sections?.length ? undefined : findPage(pages, params.page)
  const sections = params.sections?.length ? params.sections.map((id) => findNode(nodes, id)) : pageSections(page!, nodes)
  const brand = getActiveBrand()
  const built = buildLandingPage(sections, nodes, connections, brand)
  if (!built.elements.length) throw new Error('Nada para mostrar: as seções escolhidas não têm JSON válido')
  const { document } = renderElementorDocument(built.elements, {
    title: page?.name ?? 'Seções',
    kit: renderKit(brand, getSiteKit(), sections.some(isFromSite)),
    motion: 'static',
  })
  const height = DEVICE_HEIGHT[params.device ?? 'desktop'] ?? DEVICE_HEIGHT.desktop
  return document.replace('<head>', `<head>\n<base href="${location.origin}/">\n<style>:root{--se-vh:${height / 100}px}</style>`)
}

function projects() {
  const { projects, status: listStatus } = useProjectStore.getState()
  return {
    status: listStatus,
    projects: projects.map((p) => ({ id: p.id, name: p.name, role: p.role ?? 'owner', updatedAt: p.updatedAt, sections: p.summary.sections, pages: p.summary.pages ?? 1 })),
  }
}

/** Abre outro projeto nesta aba (recarrega); o Claude espera ele ficar pronto pelo status. */
function open(params: { projectId: string }) {
  if (routeProjectId() === params.projectId) return { already: true }
  setTimeout(() => location.assign(`/projetos/${params.projectId}`), 50)
  return { navigating: true }
}

const METHODS: Record<string, (params: never) => unknown> = { status, pull, apply, focus, say, work, plan, render, projects, open }

export function startSpaceBridge(hot: Hot) {
  const send = () => hot.send('space-bridge:state', info())
  let lastSent = 0
  const onActivity = () => {
    activeAt = Date.now()
    // Basta avisar de vez em quando que esta é a aba em uso
    if (activeAt - lastSent > 2_000) {
      lastSent = activeAt
      send()
    }
  }

  const onCall = async ({ requestId, method, params, agent }: { requestId: string; method: string; params: unknown; agent?: string }) => {
    try {
      currentAgent = agent?.trim() || DEFAULT_AGENT
      const handler = METHODS[method]
      if (!handler) throw new Error(`Pedido desconhecido: ${method}`)
      const result = await handler(params as never)
      hot.send('space-bridge:reply', { requestId, ok: true, result })
    } catch (error) {
      hot.send('space-bridge:reply', { requestId, ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  hot.on('space-bridge:call', onCall)
  hot.on('vite:ws:connect', send)
  const heartbeat = setInterval(send, HEARTBEAT)
  const unsubscribe = useProjectSync.subscribe((s, prev) => s.openId !== prev.openId && send())
  window.addEventListener('pointerdown', onActivity, true)
  window.addEventListener('keydown', onActivity, true)
  window.addEventListener('focus', send)
  document.addEventListener('visibilitychange', send)
  const bye = () => hot.send('space-bridge:bye', { tabId })
  window.addEventListener('pagehide', bye)

  hot.send('space-bridge:hello', info())
  useClaudeBridge.setState({ connected: true })

  return () => {
    clearInterval(heartbeat)
    unsubscribe()
    hot.off('space-bridge:call', onCall)
    hot.off('vite:ws:connect', send)
    window.removeEventListener('pointerdown', onActivity, true)
    window.removeEventListener('keydown', onActivity, true)
    window.removeEventListener('focus', send)
    document.removeEventListener('visibilitychange', send)
    window.removeEventListener('pagehide', bye)
  }
}

if (import.meta.hot) {
  const stop = startSpaceBridge(import.meta.hot)
  import.meta.hot.dispose(stop)
}
