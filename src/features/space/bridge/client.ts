import { renderElementorDocument } from '@/engine/elementor'
import { loadApprovals, shareState, useApprovalStore } from '@/features/approval/approvalStore'
import { htmlHash, isLocalAppUrl, shareUrl, type PageShare } from '@/features/approval/shares'
import { cancelInvite, createInvite, inviteUrl, listInvites, listPeople } from '@/features/projects/access'
import { useProjectStore } from '@/features/projects/projectStore'
import { useProjectSync } from '@/features/projects/useProjectSession'
import { getActiveBrand, useBrandStore } from '@/features/space/brand/brandStore'
import { parseDesignMd } from '@/features/space/brand/designMd'
import { buildLandingPage, parseSectionElements, type SectionElement } from '@/features/space/landingPage'
import { findElement } from '@/features/space/navigator/elementorContentEditor'
import { DEFAULT_PAGE_NAME, nextPagePosition, pageOf, pageSections, SECTION_WIDTH } from '@/features/space/pages/pages'
import { isFromSite, renderKit } from '@/features/space/renderKit'
import { authorizationUrl, completeConnection, profileUrl } from '@/features/wordpress/connect'
import { PageConflictError, publishPage, restoreLastBackup, type PageStatus, type PageTemplate } from '@/features/wordpress/publish'
import { discoverSite, unsupportedReason } from '@/features/wordpress/rest'
import { detectSeo } from '@/features/wordpress/seo'
import { fetchSiteKit, fetchSitePage, listSitePages } from '@/features/wordpress/site'
import { getSiteKit, useSiteKitStore } from '@/features/wordpress/siteKitStore'
import type { WordPressConnection } from '@/features/wordpress/types'
import { getActiveWordPress, useWordPressSession } from '@/features/wordpress/useWordPressConnection'
import { setBackgroundRelease } from '@/features/projects/background'
import { cursorFromCall } from '@/features/space/chat/cursorFromBridge'
import type { AgentChannel } from '@/features/space/connector/channel'
import { useSpaceStore } from '@/store/spaceStore'
import type { PageDetails, SectionNodeData, SpaceNode, SpacePage } from '@/types/space'
import { useAgents, type AgentView, type ViewRequest } from './agentsStore'
import { DEFAULT_AGENT, useClaudeBridge, type ClaudeStep, type ClaudeStepKind, type TouchKind } from './bridgeStore'
import { focusSection } from './focus'
import { WORKER_NAME_PREFIX, WORKER_REFRESH_EVENT, workerPath } from './worker'

/**
 * Lado do navegador da ponte dos agentes, Claude ou Codex (só no `npm run dev`;
 * o servidor fica em `scripts/space/vitePlugin.ts`). A aba se apresenta,
 * responde aos pedidos do `scripts/space/space.mjs` e aplica as mudanças no
 * canvas como um passo do desfazer. Salvar na conta continua com o projeto
 * aberto, com o login de quem está aqui, como qualquer edição feita à mão.
 *
 * Vários agentes, cada um no seu projeto: a tela de uma pessoa também hospeda
 * os projetos que os agentes abrem em segundo plano (iframes escondidos em
 * `/agente/:id`, ver `worker.ts`). Cada um desses iframes roda esta mesma ponte
 * com o papel `worker`, e o servidor manda para ele os pedidos do projeto dele.
 */

/** O websocket do Vite no dev, ou o conector no app publicado (ver `connector/agentLink.ts`). */
type Hot = AgentChannel

const TAB_KEY = 'space-bridge-tab'
const HEARTBEAT = 10_000
/** Altura da tela de cada aparelho, a mesma do player: as medidas em vh valem sobre ela. */
const DEVICE_HEIGHT: Record<string, number> = { desktop: 900, tablet: 1024, mobile: 812 }
/** Quanto a aba espera o segundo plano salvar antes de fechá-lo mesmo assim. */
const RELEASE_TIMEOUT = 20_000

/** Projeto que esta página abre em segundo plano para um agente (vem do nome do iframe). */
const workerProject = window.name.startsWith(WORKER_NAME_PREFIX) ? window.name.slice(WORKER_NAME_PREFIX.length) : undefined
const role = workerProject ? 'worker' : 'tab'

// A mesma aba continua com o mesmo id ao recarregar. O sessionStorage é o
// mesmo para a aba e os iframes dela: o segundo plano usa uma chave própria.
const storedId = (key: string, create: boolean) => {
  try {
    const saved = sessionStorage.getItem(key)
    if (saved || !create) return saved ?? undefined
    const id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
    return id
  } catch {
    return create ? crypto.randomUUID() : undefined
  }
}
const tabId = storedId(workerProject ? `${TAB_KEY}:${workerProject}` : TAB_KEY, true)!
/** Aba que hospeda este segundo plano. */
const hostId = workerProject ? storedId(TAB_KEY, false) : undefined

let activeAt = Date.now()

/** Quem fez o pedido (Claude, Codex…) e o que ele escreveu no diário durante o pedido. */
interface CallContext {
  agent: string
  /** Sessão do agente na ponte: um cursor por sessão no canvas. */
  session?: string
  steps: ClaudeStep[]
}

/** Escreve no diário do canvas e guarda o passo para o servidor somar ao diário do agente. */
const note = (ctx: CallContext, kind: ClaudeStepKind, text: string, sectionIds?: string[]) => {
  const bridge = useClaudeBridge.getState()
  bridge.log(kind, text, sectionIds, ctx.agent)
  const step = useClaudeBridge.getState().steps.at(-1)
  if (step) ctx.steps.push(step)
}

/** O pedido nem começou: o servidor pode mandá-lo de novo (para quem abrir o projeto). */
class NotOpenError extends Error {
  readonly retry = true
}

const routeProjectId = () => location.pathname.match(/^\/(?:projetos|agente)\/([^/?#]+)/)?.[1]

/** Projeto desta aba, só depois que o conteúdo da conta entrou no canvas. */
const openProjectId = () => {
  const id = routeProjectId()
  return id && useProjectSync.getState().openId === id ? id : undefined
}

/** Segundo plano que não abre: o servidor para de esperar e conta ao agente o porquê. */
const workerFailure = () => {
  if (!workerProject) return undefined
  if (routeProjectId() !== workerProject) return 'O projeto em segundo plano caiu fora do app (sem login nesta aba?). Abra o app e entre na conta.'
  return window.__spaceWorker?.failed
}

const info = () => {
  const projectId = workerProject ?? routeProjectId()
  const ready = !!openProjectId() && (!workerProject || openProjectId() === workerProject)
  return {
    tabId,
    url: location.pathname,
    role,
    host: hostId,
    projectId,
    projectName: projectId ? useProjectStore.getState().projects.find((p) => p.id === projectId)?.name : undefined,
    ready,
    failed: workerFailure(),
    sync: ready ? useProjectSync.getState().status : undefined,
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
  if (!id) {
    if (workerProject) throw new NotOpenError('O projeto em segundo plano está abrindo ou fechando; tente de novo em instantes')
    throw routeProjectId() ? new NotOpenError('O projeto ainda está abrindo nesta aba; tente de novo em instantes') : new Error('Nenhum projeto aberto nesta aba. Use "open" ou abra um projeto no Space.')
  }
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
    /** `canvas`: na tela de uma pessoa, que vê o agente trabalhar; `background`: em segundo plano. */
    where: workerProject ? 'background' : 'canvas',
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
      wordpress: page.wordpress ? { siteUrl: page.wordpress.siteUrl, postId: page.wordpress.postId, link: page.wordpress.link, status: page.wordpress.status } : undefined,
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
function apply(params: ApplyParams, ctx: CallContext) {
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
  bridge.touch(touched, ctx.agent)
  bridge.reveal(ids)
  // Página do plano sem esqueleto sobrando: terminou de ser construída
  const { pending, working } = useClaudeBridge.getState()
  const built = pages.filter((p) => working[p.id] && !p.sectionIds.some((id) => pending[id])).map((p) => p.id)
  if (built.length) bridge.clearWorking(built)
  note(ctx, 'change', params.label || 'Mudança no canvas', ids)
  if (params.focus !== false && ids[0]) focus({ id: ids[0] })
  // Hash novo de cada seção mexida: a próxima gravação do Claude confere a partir dele
  const hashes = Object.fromEntries(nodes.filter((n) => touched[n.id]).map((n) => [n.id, hashOf(n.data as SectionNodeData)]))
  // Páginas mexidas, para a prévia da tela Agentes mostrar a certa
  const pageIds = [...new Set(ids.map((id) => pageOf(pages, id)?.id).filter((id): id is string => !!id))]
  return { created, touched, hashes, pages: Object.fromEntries(pageRefs), pageIds }
}

/** Leva o canvas até a seção (ou o topo da página), sem mudar o zoom. Em segundo plano não há canvas. */
function focus(params: { id?: string; page?: string }) {
  requireProject()
  if (workerProject) return { skipped: 'O projeto está em segundo plano: não há canvas para levar até a seção' }
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

function say(params: { text: string; kind?: ClaudeStepKind; sections?: string[] }, ctx: CallContext) {
  if (!params.text?.trim()) throw new Error('Mensagem vazia')
  const { nodes } = useSpaceStore.getState()
  const ids = (params.sections ?? []).map((id) => findNode(nodes, id).id)
  note(ctx, params.kind ?? 'note', params.text.trim(), ids.length ? ids : undefined)
  // Terminou, ou parou para perguntar: some a varredura de onde ele estava mexendo
  if (params.kind === 'done' || params.kind === 'question') useClaudeBridge.getState().clearWorking()
  return { ok: true, sectionIds: ids }
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

/**
 * Mostra no canvas onde o agente está mexendo (seções, uma página ou o projeto todo), ou para de mostrar.
 * `element`: a camada dentro da seção, para o cursor dele apontar (ver `chat/cursorFromBridge.ts`).
 */
function work(params: { text?: string; sections?: string[]; page?: string; element?: string; done?: boolean }, ctx: CallContext) {
  requireProject()
  const bridge = useClaudeBridge.getState()
  if (params.done) {
    bridge.clearWorking()
    return { ok: true }
  }
  const text = params.text?.trim() || 'Trabalhando'
  const { nodes, pages } = useSpaceStore.getState()
  const sectionIds = (params.sections ?? []).map((id) => findNode(nodes, id).id)
  const pageId = params.page ? findPage(pages, params.page).id : sectionIds[0] ? pageOf(pages, sectionIds[0])?.id : undefined
  const ids = [...sectionIds, ...(params.page && pageId ? [pageId] : [])]
  // O que estava marcado antes deixa de estar: ele mexe num lugar de cada vez
  bridge.clearWorking()
  bridge.setWorking(ids.length ? ids : ['*'], { agent: ctx.agent, text, since: Date.now() })
  if (sectionIds[0] && !workerProject) focusSection(sectionIds[0])
  return { ok: true, pageId, sectionIds }
}

/**
 * O plano de uma página: as seções que vão existir, em esqueleto borrado, numa
 * página nova (`newPage`) ou numa que já existe. O agente constrói cada uma
 * gravando por cima dela, e quem olha vê a página ficar nítida seção por seção.
 */
function plan(params: { titles: string[]; page?: string; newPage?: string; after?: string; label?: string }, ctx: CallContext) {
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
  const result = apply({ label, ops, focus: false }, ctx)
  const ids = params.titles.map((_, i) => result.created[`plan:${i}`])
  const pageId = result.pages.plan ?? findPage(useSpaceStore.getState().pages, params.page).id
  const bridge = useClaudeBridge.getState()
  bridge.markPending(ids)
  bridge.touch({}, ctx.agent)
  bridge.setWorking([pageId], { agent: ctx.agent, text: 'Construindo a página', since: Date.now() })
  if (!workerProject) useSpaceStore.getState().focusPage(pageId)
  return { pageId, sections: ids.map((id, i) => ({ id, title: params.titles[i], hash: result.hashes[id] })) }
}

/**
 * A página (ou só algumas seções) como o player mostra: sem animação para a
 * foto conferir o resultado, ou com elas (`motion: 'play'`) para o vídeo.
 */
function render(params: { page?: string; sections?: string[]; device?: string; motion?: 'static' | 'play' }) {
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
    motion: params.motion ?? 'static',
  })
  const height = DEVICE_HEIGHT[params.device ?? 'desktop'] ?? DEVICE_HEIGHT.desktop
  const html = document.replace('<head>', `<head>\n<base href="${location.origin}/">\n<style>:root{--se-vh:${height / 100}px}</style>`)
  // No vídeo, a imagem preguiçosa entraria em branco no meio da rolagem
  return params.motion === 'play' ? html.replaceAll(' loading="lazy"', '') : html
}

/** Primeiro elemento da seção: é por ele (`data-id`) que a prévia acha a seção na página. */
const anchorOf = (node: SpaceNode | undefined) => (node ? parseSectionElements((node.data as SectionNodeData).elementorJson)?.[0]?.id : undefined)

/**
 * A página para a prévia da tela Agentes: a da seção em que o agente mexe (ou
 * a pedida), sem animação, com onde ele está e o que ainda é esqueleto.
 */
function view(params: { page?: string; section?: string }): AgentView {
  requireProject()
  const { nodes, pages } = useSpaceStore.getState()
  const section = params.section ? nodes.find((n) => n.id === params.section) : undefined
  const page = (section && pageOf(pages, section.id)) ?? pages.find((p) => p.id === params.page) ?? findPage(pages, undefined)
  let html = ''
  try {
    html = render({ page: page.id, device: 'desktop' })
  } catch {
    // Página sem seção válida ainda: a prévia mostra a página vazia
  }
  const { pending, working } = useClaudeBridge.getState()
  const inPage = pageSections(page, nodes)
  const workingNode = inPage.find((n) => working[n.id])
  return {
    html,
    pageId: page.id,
    pageName: page.name,
    anchor: anchorOf(section && page.sectionIds.includes(section.id) ? section : undefined),
    working: anchorOf(workingNode),
    pending: inPage.filter((n) => pending[n.id]).map(anchorOf).filter((id): id is string => !!id),
  }
}

function projects() {
  const { projects, status: listStatus } = useProjectStore.getState()
  return {
    status: listStatus,
    projects: projects.map((p) => ({ id: p.id, name: p.name, role: p.role ?? 'owner', updatedAt: p.updatedAt, sections: p.summary.sections, pages: p.summary.pages ?? 1 })),
  }
}

/** Troca de tela sem recarregar o app, para os projetos em segundo plano desta aba continuarem abertos. */
const navigate = (path: string) => {
  history.pushState(null, '', path)
  dispatchEvent(new PopStateEvent('popstate'))
}

/** Mostra outro projeto na tela desta aba; o agente espera ele ficar pronto pelo status. */
function open(params: { projectId: string }) {
  if (workerProject) throw new Error('O segundo plano não troca de projeto')
  if (routeProjectId() === params.projectId) return { already: true }
  setTimeout(() => navigate(`/projetos/${params.projectId}`), 50)
  return { navigating: true }
}

/** Cria um projeto na conta, como o botão Novo projeto; `open: false` não troca a tela de quem está aqui. */
async function create(params: { name: string; context?: string; open?: boolean }) {
  if (!params.name?.trim()) throw new Error('Diga o nome do projeto')
  const project = await useProjectStore.getState().create({ name: params.name, context: params.context ?? '' })
  if (params.open !== false) setTimeout(() => navigate(`/projetos/${project.id}`), 50)
  return { project: { id: project.id, name: project.name } }
}

/**
 * A marca do projeto aberto (o DESIGN.md). Gravar troca o texto inteiro, como
 * a tela da marca, e salva com o projeto: quem abrir o projeto vê a mesma marca.
 */
function brand(params: { source?: string; enabled?: boolean }) {
  requireProject()
  const store = useBrandStore.getState()
  if (params.source !== undefined) {
    const parsed = parseDesignMd(params.source)
    if (!parsed.brand) throw new Error(`O DESIGN.md não foi aceito: ${parsed.errors.join(' ')}`)
    store.setSource(params.source)
  }
  if (params.enabled !== undefined) store.setEnabled(params.enabled)
  const { source, enabled, brand: current } = useBrandStore.getState()
  const parsed = source.trim() ? parseDesignMd(source) : null
  return { name: current?.name ?? null, enabled, source, format: parsed?.format ?? null, warnings: parsed?.warnings ?? [], notes: parsed?.notes ?? [] }
}

/** O briefing do projeto (o campo Contexto): ler, ou trocar o texto inteiro. */
async function brief(params: { context?: string }) {
  const id = requireProject()
  if (params.context !== undefined) await useProjectStore.getState().update(id, { context: params.context })
  const project = useProjectStore.getState().projects.find((p) => p.id === id)
  return { name: project?.name, context: project?.context ?? '' }
}

// ---------- ciclo com o cliente: aprovação, convite, WordPress ----------

/** A página como o player mostra, com as animações: é o que o cliente vê no link. */
function playerHtml(page: SpacePage) {
  const { nodes, connections } = useSpaceStore.getState()
  const brand = getActiveBrand()
  const sections = pageSections(page, nodes)
  const built = buildLandingPage(sections, nodes, connections, brand)
  if (!built.elements.length) throw new Error(`A página ${page.name} não tem seção com JSON válido`)
  return renderElementorDocument(built.elements, { title: page.name, kit: renderKit(brand, getSiteKit(), sections.some(isFromSite)), motion: 'play' }).document
}

const shareInfo = async (page: SpacePage, share: PageShare | undefined) => {
  if (!share) return { pageId: page.id, page: page.name, link: null }
  const current = await htmlHash(playerHtml(page)).catch(() => null)
  return {
    pageId: page.id,
    page: page.name,
    link: shareUrl(share.id),
    version: share.version,
    sharedAt: share.sharedAt,
    // A página mudou depois da foto: o cliente ainda vê a versão anterior
    outdated: !!current && current !== share.htmlHash,
    state: shareState(share).kind,
    responses: share.responses,
  }
}

/**
 * Links de aprovação: ler as respostas do cliente, mandar a página de agora
 * (cria o link ou troca a foto do mesmo link) ou desativar o link.
 */
async function approval(params: { action?: 'list' | 'send' | 'revoke'; page?: string; note?: string }, ctx: CallContext) {
  const id = requireProject()
  await loadApprovals(id)
  const { pages } = useSpaceStore.getState()
  const store = useApprovalStore.getState()
  const local = isLocalAppUrl()
  if (params.action === 'send') {
    const page = findPage(pages, params.page)
    const project = useProjectStore.getState().projects.find((p) => p.id === id)
    const share = await store.publish(page.id, { projectName: project?.name ?? 'Projeto', pageName: page.name, html: playerHtml(page) })
    note(ctx, 'done', params.note?.trim() || `Mandei ${page.name} para o cliente aprovar (versão ${share.version})`)
    return { local, pages: [await shareInfo(page, share)] }
  }
  if (params.action === 'revoke') {
    const page = findPage(pages, params.page)
    await store.revoke(page.id)
    note(ctx, 'note', params.note?.trim() || `Desativei o link de aprovação de ${page.name}`)
    return { local, pages: [await shareInfo(page, undefined)] }
  }
  const chosen = params.page ? [findPage(pages, params.page)] : pages
  return { local, pages: await Promise.all(chosen.map((p) => shareInfo(p, useApprovalStore.getState().shares[p.id]))) }
}

/** Acesso compartilhado: quem já está no projeto, os convites abertos, e um convite novo (7 dias, uma pessoa). */
async function invite(params: { action?: 'list' | 'create' | 'cancel'; label?: string; id?: string }) {
  const id = requireProject()
  let created: { id: string; url: string; expiresAt: number } | undefined
  if (params.action === 'create') {
    const next = await createInvite(id, params.label?.trim() || 'Cliente')
    created = { id: next.id, url: inviteUrl(next.id), expiresAt: next.expiresAt }
  }
  if (params.action === 'cancel') {
    if (!params.id) throw new Error('Diga o id do convite')
    await cancelInvite(params.id)
  }
  const [people, invites] = await Promise.all([listPeople(id), listInvites(id)])
  return { local: isLocalAppUrl(), created, people, invites: invites.map((i) => ({ ...i, url: inviteUrl(i.id) })) }
}

/** A conexão do projeto aberto, lida da conta se o botão do WordPress ainda não abriu a sessão. */
async function wpConnection(required = true) {
  const id = requireProject()
  const session = useWordPressSession.getState()
  if (session.projectId !== id || !session.connection) await session.open(id)
  const connection = getActiveWordPress()
  if (!connection && required) throw new Error('O projeto não tem WordPress conectado. Use: wp connect <endereço do site>')
  return connection
}

const pageLinks = () => useSpaceStore.getState().pages.map((p) => ({ pageId: p.id, page: p.name, wordpress: p.wordpress ?? null, details: p.details ?? null }))

/**
 * WordPress do cliente. `status` mostra a conexão e as páginas ligadas;
 * `connect` sem senha devolve o link de aprovação no WordPress, e com o
 * usuário e a senha de aplicação grava a conexão; `pages` lista o site;
 * `import` traz páginas do site para o canvas, como o diálogo Importar.
 */
async function wordpress(params: { action?: 'status' | 'connect' | 'pages' | 'import'; site?: string; user?: string; password?: string; ids?: number[] }, ctx: CallContext) {
  const id = requireProject()
  const connectionInfo = (c: WordPressConnection | null) =>
    c && { site: c.site.name, siteUrl: c.site.siteUrl, user: c.user.name, roles: c.user.roles, can: c.can, connectedAt: c.connectedAt, checkedAt: c.checkedAt }

  if (params.action === 'connect') {
    if (!params.site?.trim()) throw new Error('Diga o endereço do site')
    const site = await discoverSite(params.site)
    const reason = unsupportedReason(site)
    if (reason) throw new Error(reason)
    if (!params.user || !params.password) {
      const project = useProjectStore.getState().projects.find((p) => p.id === id)
      // Sem retorno: o WordPress mostra a senha na tela, para quem aprovou passar ao agente
      return { site: site.name, siteUrl: site.siteUrl, authorize: authorizationUrl({ projectId: id, projectName: project?.name ?? 'Projeto', site, mode: 'redirect', returnHere: false }), profile: profileUrl(site) }
    }
    await completeConnection(id, site, params.user, params.password)
    await useWordPressSession.getState().open(id)
    return { connection: connectionInfo(getActiveWordPress()) }
  }

  if (params.action === 'pages') {
    const connection = (await wpConnection())!
    const { pages, noElementorData } = await listSitePages(connection)
    const linked = new Map(useSpaceStore.getState().pages.filter((p) => p.wordpress?.siteUrl === connection.site.siteUrl).map((p) => [p.wordpress!.postId, p.name]))
    return { noElementorData, pages: pages.map((p) => ({ ...p, canvasPage: linked.get(p.id) ?? null })) }
  }

  if (params.action === 'import') {
    const connection = (await wpConnection())!
    if (!params.ids?.length) throw new Error('Diga os ids das páginas do site (veja: wp pages)')
    // As seções do site apontam para as cores globais dele: o Kit entra junto
    const kit = await fetchSiteKit(connection).catch(() => null)
    if (kit) useSiteKitStore.getState().setKit(kit)
    const seo = await detectSeo(connection).catch(() => undefined)
    const imported: Array<{ postId: number; pageId: string; page: string; sections: number }> = []
    const failed: Array<{ postId: number; error: string }> = []
    for (const postId of params.ids) {
      try {
        const page = await fetchSitePage(connection, postId, seo)
        const { pages, loadSitePage, setPageDetails } = useSpaceStore.getState()
        const existing = pages.find((p) => p.wordpress?.postId === postId && p.wordpress.siteUrl === connection.site.siteUrl)
        const pageId = loadSitePage(page.name, page.sections, page.link, existing?.id)
        setPageDetails(pageId, page.details)
        imported.push({ postId, pageId, page: page.name, sections: page.sections.length })
      } catch (error) {
        failed.push({ postId, error: error instanceof Error ? error.message : String(error) })
      }
    }
    if (imported.length) note(ctx, 'note', `Importei do WordPress: ${imported.map((p) => p.page).join(', ')}`)
    return { imported, failed, kit: !!kit }
  }

  return { connection: connectionInfo(await wpConnection(false)), pages: pageLinks() }
}

const DETAIL_FIELDS = ['title', 'slug', 'seoTitle', 'description', 'focusKeyword'] as const

/** Título, endereço e SEO que vão junto ao publicar. Campo com texto vazio volta ao padrão do WordPress. */
function details(params: { page?: string; fields?: Partial<Record<(typeof DETAIL_FIELDS)[number], string>> }) {
  requireProject()
  const page = findPage(useSpaceStore.getState().pages, params.page)
  if (params.fields && Object.keys(params.fields).length) {
    const next: PageDetails = { ...page.details }
    for (const key of DETAIL_FIELDS) {
      const value = params.fields[key]
      if (value === undefined) continue
      if (value.trim()) next[key] = value.trim()
      else delete next[key]
    }
    useSpaceStore.getState().setPageDetails(page.id, next)
  }
  const current = findPage(useSpaceStore.getState().pages, page.id)
  const { featured, ...text } = current.details ?? {}
  return { pageId: current.id, page: current.name, details: text, featured: featured?.kind ?? null, wordpress: current.wordpress ?? null }
}

/**
 * Publica a página no WordPress do cliente, como o diálogo Publicar: página
 * ligada atualiza no mesmo endereço (com backup e conferência de conflito),
 * página nova vira rascunho, a não ser que `status` diga publicar.
 */
async function publish(params: { page?: string; status?: PageStatus; template?: PageTemplate; overwrite?: boolean }, ctx: CallContext) {
  const projectId = requireProject()
  const connection = (await wpConnection())!
  if (!connection.can.editPages) throw new Error(`O usuário ${connection.user.name} não pode editar páginas em ${connection.site.name}`)
  if (params.status === 'publish' && !connection.can.publishPages) throw new Error(`O usuário ${connection.user.name} não pode publicar páginas: mande como rascunho`)
  const page = findPage(useSpaceStore.getState().pages, params.page)
  const steps: string[] = []
  const bridge = useClaudeBridge.getState()
  bridge.setWorking([page.id], { agent: ctx.agent, text: `Publicando no ${connection.site.name}`, since: Date.now() })
  try {
    const result = await publishPage({ connection, projectId, pageId: page.id, status: params.status, template: params.template, overwrite: params.overwrite, onProgress: (step) => steps.push(step) })
    note(ctx, 'done', `${result.created ? 'Criei' : 'Atualizei'} ${page.name} em ${connection.site.name} (${result.status === 'publish' ? 'publicada' : 'rascunho'}): ${result.link}`)
    return { page: page.name, site: connection.site.name, steps, ...result }
  } catch (error) {
    if (error instanceof PageConflictError) throw new Error(`A página foi editada no WordPress em ${error.modifiedGmt} (GMT), depois da última sincronização. Importe de novo (wp import) para trazer a mudança, ou publique com --overwrite para passar por cima (fica um backup).`)
    throw error
  } finally {
    bridge.clearWorking([page.id])
  }
}

/** Devolve ao site o conteúdo que a página ligada tinha antes da última publicação feita daqui. */
async function restore(params: { page?: string }, ctx: CallContext) {
  const projectId = requireProject()
  const connection = (await wpConnection())!
  const page = findPage(useSpaceStore.getState().pages, params.page)
  const result = await restoreLastBackup(connection, projectId, page.id)
  note(ctx, 'note', `Voltei ${page.name} no ${connection.site.name} para a versão anterior`)
  return { page: page.name, site: connection.site.name, ...result }
}

const METHODS: Record<string, (params: never, ctx: CallContext) => unknown> = {
  status, pull, apply, focus, say, work, plan, render, view, projects, open, create, brand,
  brief, approval, invite, wordpress, details, publish, restore,
}

// ---------- projetos em segundo plano (só na tela de uma pessoa) ----------

const workers = new Map<string, HTMLIFrameElement>()
const releases = new Map<string, Promise<void>>()

/** Lugar dos iframes do segundo plano: fora do React, sobrevive à troca de tela. */
const workerBox = () => {
  let box = document.getElementById('se-agent-workers')
  if (!box) {
    box = document.createElement('div')
    box.id = 'se-agent-workers'
    box.setAttribute('aria-hidden', 'true')
    box.style.display = 'none'
    document.body.appendChild(box)
  }
  return box
}

/** Abre o projeto em segundo plano para um agente (o servidor pede quando ninguém o tem aberto). */
function spawnWorker(projectId: string) {
  if (workers.has(projectId) || releases.has(projectId)) return
  // A pessoa está com ele aberto nesta aba: o servidor manda os pedidos para cá
  if (routeProjectId() === projectId) return
  const frame = document.createElement('iframe')
  frame.name = `${WORKER_NAME_PREFIX}${projectId}`
  frame.title = 'Projeto aberto em segundo plano para um agente'
  frame.tabIndex = -1
  frame.src = workerPath(projectId)
  workerBox().appendChild(frame)
  workers.set(projectId, frame)
}

/** Fecha o segundo plano do projeto depois de ele salvar o que faltava. */
function releaseWorker(projectId: string) {
  const running = releases.get(projectId)
  if (running) return running
  const frame = workers.get(projectId)
  if (!frame) return Promise.resolve()
  workers.delete(projectId)
  const done = (async () => {
    try {
      const handle = frame.contentWindow?.__spaceWorker
      if (handle) await Promise.race([handle.release(), new Promise((r) => setTimeout(r, RELEASE_TIMEOUT))])
    } catch (error) {
      console.warn('[ponte] o segundo plano não fechou direito', error)
    } finally {
      frame.remove()
      releases.delete(projectId)
    }
  })()
  releases.set(projectId, done)
  return done
}

// ---------- pedidos da tela Agentes ----------

const views = new Map<string, { resolve: (view: AgentView) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>()
/** Abrir o projeto em segundo plano e montar a página pode levar um tempo. */
const VIEW_TIMEOUT = 75_000

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

  const onCall = async ({ requestId, method, params, agent, session }: { requestId: string; method: string; params: unknown; agent?: string; session?: string }) => {
    const ctx: CallContext = { agent: agent?.trim() || DEFAULT_AGENT, session: session?.trim() || undefined, steps: [] }
    try {
      const handler = METHODS[method]
      if (!handler) throw new Error(`Pedido desconhecido: ${method}`)
      const result = await handler(params as never, ctx)
      // O cursor do agente vai até onde ele mexeu (só na tela de uma pessoa: o segundo plano não tem canvas)
      if (!workerProject && agent && openProjectId()) cursorFromCall(ctx, method, params, result)
      hot.send('space-bridge:reply', { requestId, ok: true, result, steps: ctx.steps })
    } catch (error) {
      hot.send('space-bridge:reply', {
        requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        retry: error instanceof NotOpenError,
        steps: ctx.steps,
      })
    }
  }

  const onSpawn = ({ projectId }: { projectId?: string }) => projectId && spawnWorker(projectId)
  const onRelease = ({ projectId }: { projectId?: string }) => projectId && void releaseWorker(projectId)
  const onAgents = (data: { at: number; agents: ReturnType<typeof useAgents.getState>['agents'] }) =>
    useAgents.setState({ connected: true, agents: data.agents ?? [], skew: (data.at ?? Date.now()) - Date.now() })
  const onViewReply = ({ requestId, ok, result, error }: { requestId: string; ok: boolean; result?: AgentView; error?: string }) => {
    const request = views.get(requestId)
    if (!request) return
    views.delete(requestId)
    clearTimeout(request.timer)
    if (ok && result) request.resolve(result)
    else request.reject(new Error(error || 'A prévia não veio'))
  }

  hot.on('space-bridge:call', onCall)
  hot.on('vite:ws:connect', send)
  if (!workerProject) {
    hot.on('space-bridge:spawn', onSpawn)
    hot.on('space-bridge:release', onRelease)
    hot.on('space-bridge:agents', onAgents)
    hot.on('space-bridge:view-reply', onViewReply)
    setBackgroundRelease(releaseWorker)
    useAgents.setState({
      requestView: (request: ViewRequest) =>
        new Promise<AgentView>((resolve, reject) => {
          const requestId = crypto.randomUUID()
          const timer = setTimeout(() => {
            views.delete(requestId)
            reject(new Error('A prévia demorou demais'))
          }, VIEW_TIMEOUT)
          views.set(requestId, { resolve, reject, timer })
          hot.send('space-bridge:view', { requestId, ...request })
        }),
      dismiss: (target) => hot.send('space-bridge:dismiss', target),
    })
  }
  const heartbeat = setInterval(send, HEARTBEAT)
  const unsubscribe = useProjectSync.subscribe((s, prev) => (s.openId !== prev.openId || s.status !== prev.status) && send())
  window.addEventListener('pointerdown', onActivity, true)
  window.addEventListener('keydown', onActivity, true)
  window.addEventListener('focus', send)
  window.addEventListener(WORKER_REFRESH_EVENT, send)
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
    hot.off('space-bridge:spawn', onSpawn)
    hot.off('space-bridge:release', onRelease)
    hot.off('space-bridge:agents', onAgents)
    hot.off('space-bridge:view-reply', onViewReply)
    if (!workerProject) setBackgroundRelease(null)
    window.removeEventListener('pointerdown', onActivity, true)
    window.removeEventListener('keydown', onActivity, true)
    window.removeEventListener('focus', send)
    window.removeEventListener(WORKER_REFRESH_EVENT, send)
    document.removeEventListener('visibilitychange', send)
    window.removeEventListener('pagehide', bye)
  }
}

