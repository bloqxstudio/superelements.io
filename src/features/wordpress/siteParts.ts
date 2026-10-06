import { componentUses } from '@/features/space/components/components'
import { useSpaceStore } from '@/store/spaceStore'
import type { SpaceComponent, SpaceNode, SpacePage } from '@/types/space'
import { supabase } from '@/integrations/supabase/client'
import { adminUrl, credentialsOf } from './connect'
import { wpRequest, WordPressError } from './rest'
import type { WordPressConnection } from './types'
import { useWordPressSession } from './useWordPressConnection'

/**
 * Componentes do site no WordPress. O cabeçalho e o rodapé viram modelos do
 * Theme Builder do Elementor Pro, com a condição de exibição (site inteiro,
 * menos as páginas que ficam sem); o componente livre vira um container
 * salvo, usado pelas páginas pelo widget Modelo.
 *
 * A lista do Theme Builder vem pela API do próprio Elementor Pro (o Site
 * Editor). O conteúdo dos modelos não dá para ler do navegador: o Elementor
 * bloqueia, por segurança, qualquer chamada à `elementor_library` sem um
 * administrador logado, e a consulta prévia do navegador (CORS) nunca leva
 * login. Por isso ler e gravar o modelo vai pelo servidor (a função
 * `space-wordpress-library`, com a conexão do projeto: o modelo vem puro, sem
 * plugin) ou, sem ela, pelo plugin Superelements Connector (0.2 ou mais novo).
 * Sem nenhum dos dois, o cabeçalho, o rodapé e os componentes vão dentro de
 * cada página, como antes.
 */

/**
 * Que modelo do Elementor o componente vira: cabeçalho e rodapé do Theme
 * Builder, container salvo (seção, usado pelo widget Modelo) ou Global Widget
 * (um widget).
 */
export type ComponentKind = 'header' | 'footer' | 'section' | 'widget'

/** Modelo da Biblioteca do Elementor do site. */
export interface SitePart {
  id: number
  title: string
  /** Tipo do documento: header, footer, container. */
  type: string
  status: string
  modified_gmt: string
  /** "include/general", "exclude/singular/page/12"… Sem nenhuma, o modelo não aparece no site. */
  conditions: string[]
  edit_url: string
  /** Só ao ler um modelo pelo id: o JSON do Elementor, para guardar antes de trocar. */
  elementor_data?: string
}

export interface PartsSupport {
  /** `theme`: viram modelos do Elementor (Theme Builder e widget Modelo); `inline`: vão dentro de cada página. */
  mode: 'theme' | 'inline'
  /** Por que vão dentro da página. */
  reason?: 'no-pro' | 'no-permission' | 'no-connector' | 'old-connector'
  /** O site tem o Theme Builder: a lista do cabeçalho e do rodapé vem mesmo sem o plugin. */
  themeBuilder: boolean
  /** Versão do Superelements Connector no site, se tiver. */
  connector: string | null
  /** A função do servidor responde: lê e grava os modelos sem plugin. */
  server: boolean
}

/** Resposta da função do servidor quando o site recusa: a mensagem dele, com o código. */
interface ServerFailure {
  error: string
  code?: string
  status?: number
}

/**
 * Pela função `space-wordpress-library`, com a conexão do projeto aberto.
 * null quando ela não responde (não publicada, sem conta logada): aí vale o plugin.
 */
async function viaServer<T>(body: Record<string, unknown>): Promise<T | null> {
  const projectId = useWordPressSession.getState().projectId
  if (!projectId) return null
  let result: Awaited<ReturnType<typeof supabase.functions.invoke>>
  try {
    result = await supabase.functions.invoke('space-wordpress-library', { body: { projectId, ...body } })
  } catch {
    return null
  }
  const { data, error } = result as { data: unknown; error: unknown }
  if (error || !data || typeof data !== 'object') return null
  const failure = data as Partial<ServerFailure>
  if (typeof failure.error === 'string') throw new WordPressError(failure.error, failure.code, failure.status)
  return data as T
}

/** Primeira versão do Connector que lê e grava modelos. */
const MIN_CONNECTOR = [0, 2, 0]

const atLeast = (version: string, min: number[]) => {
  const parts = version.split('.').map((n) => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < min.length; i++) {
    if ((parts[i] ?? 0) !== min[i]) return (parts[i] ?? 0) > min[i]
  }
  return true
}

/** O que a lista do Site Editor traz de cada modelo do Theme Builder. */
interface SiteEditorTemplate {
  id: number
  type: string
  title: string
  status: string
  editURL?: string
  conditions?: { type: string; name: string; sub_name?: string; sub_id?: string | number }[]
}

/** `{ type: 'exclude', name: 'singular', sub_name: 'page', sub_id: 12 }` vira "exclude/singular/page/12", como o Elementor grava. */
const conditionText = (c: NonNullable<SiteEditorTemplate['conditions']>[number]) => [c.type, c.name, c.sub_name ?? '', String(c.sub_id ?? '')].join('/').replace(/\/+$/, '')

const editUrl = (connection: WordPressConnection, id: number) => `${adminUrl(connection.site)}post.php?post=${id}&action=elementor`

/** A consulta vale por um minuto: o diálogo e o resumo dele perguntam juntos. */
const SUPPORT_TTL = 60_000
const supportCache = new Map<string, { at: number; value: Promise<PartsSupport> }>()

/** Se o cabeçalho, o rodapé e os componentes podem virar modelos do Elementor neste site. */
export function partsSupport(connection: WordPressConnection, fresh = false): Promise<PartsSupport> {
  const key = connection.site.siteUrl
  const cached = supportCache.get(key)
  if (!fresh && cached && Date.now() - cached.at < SUPPORT_TTL) return cached.value
  const creds = credentialsOf(connection)
  const value = (async (): Promise<PartsSupport> => {
    const [editor, status, server] = await Promise.all([
      wpRequest<unknown>(creds, 'elementor/v1/site-editor/templates').then(
        () => 'ok' as const,
        (error) => (error instanceof WordPressError && (error.status === 401 || error.status === 403) ? ('forbidden' as const) : ('missing' as const))
      ),
      // Sem o plugin (rota inexistente) ou sem resposta: fica sem a versão
      wpRequest<{ version: string }>(creds, 'superelements/v1/status').catch(() => null),
      viaServer<{ ok: boolean }>({ action: 'status' }).then((r) => !!r?.ok, () => false),
    ])
    const connector = status?.version ?? null
    const base = { connector, server }
    if (editor === 'missing') return { mode: 'inline', reason: 'no-pro', themeBuilder: false, ...base }
    if (editor === 'forbidden') return { mode: 'inline', reason: 'no-permission', themeBuilder: false, ...base }
    // Pelo servidor não precisa de plugin
    if (server) return { mode: 'theme', themeBuilder: true, ...base }
    if (!connector) return { mode: 'inline', reason: 'no-connector', themeBuilder: true, ...base }
    if (!atLeast(connector, MIN_CONNECTOR)) return { mode: 'inline', reason: 'old-connector', themeBuilder: true, ...base }
    return { mode: 'theme', themeBuilder: true, ...base }
  })()
  supportCache.set(key, { at: Date.now(), value })
  return value
}

/** Primeira versão do Connector que grava Global Widgets. */
const MIN_WIDGET_CONNECTOR = [0, 3, 0]

/**
 * O Global Widget guarda o tipo do widget num campo que a API do WordPress não
 * grava (o editor do Elementor lê dele): criar e atualizar um só pelo plugin.
 */
export const canSaveWidgets = (support: PartsSupport) => support.mode === 'theme' && !!support.connector && atLeast(support.connector, MIN_WIDGET_CONNECTOR)

export const WIDGET_REASON =
  'o Global Widget guarda o tipo do widget num campo que a API do WordPress não grava, então pede o plugin Superelements Connector (0.3 ou mais novo) no site'

/** Falta (ou está velho) o plugin: dá para resolver baixando o Connector. */
export const needsConnector = (support: PartsSupport) => support.reason === 'no-connector' || support.reason === 'old-connector'

/** Por que o cabeçalho, o rodapé e os componentes vão dentro de cada página, numa frase. */
export function inlineReason(support: PartsSupport) {
  if (support.reason === 'no-permission') return 'o usuário do WordPress conectado não pode mexer no Theme Builder (conecte com um administrador)'
  if (support.reason === 'no-connector')
    return 'o Elementor bloqueia, por segurança, a leitura dos modelos de fora do WordPress, e a função do servidor do Space (space-wordpress-library) ainda não está publicada; até lá, só com o plugin Superelements Connector no site'
  if (support.reason === 'old-connector') return `o plugin Superelements Connector do site é o ${support.connector}, e os modelos pedem o 0.2 ou mais novo`
  return 'o site não tem o Elementor Pro (nem o PRO Elements), que tem o Theme Builder e o widget Modelo'
}

/** Cabeçalhos ou rodapés do Theme Builder que o site tem, com as condições de cada um (pela API do Elementor Pro, sem plugin). */
export async function listSiteParts(connection: WordPressConnection, kind: ComponentKind): Promise<SitePart[]> {
  if (kind !== 'header' && kind !== 'footer') return []
  const templates = await wpRequest<SiteEditorTemplate[]>(credentialsOf(connection), 'elementor/v1/site-editor/templates')
  return templates
    .filter((t) => t.type === kind)
    .map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      status: t.status,
      modified_gmt: '',
      conditions: (t.conditions ?? []).map(conditionText),
      edit_url: t.editURL ?? editUrl(connection, t.id),
    }))
}

/** Um modelo pelo id, com o JSON do Elementor e as condições (pelo servidor; sem ele, pelo Connector). */
export async function fetchSitePart(connection: WordPressConnection, id: number): Promise<SitePart> {
  const fromServer = await viaServer<SitePart>({ action: 'get', id })
  if (fromServer) return fromServer
  try {
    return await wpRequest<SitePart>(credentialsOf(connection), `superelements/v1/parts/${id}`)
  } catch (error) {
    if (error instanceof WordPressError && error.status === 404 && error.code !== 'rest_no_route') {
      throw new WordPressError('O modelo não existe mais no site (foi apagado ou está na lixeira). Desligue o componente do WordPress para criar outro.', 'gone', 404)
    }
    if (error instanceof WordPressError && error.code === 'rest_no_route') {
      throw new WordPressError(`Falta o plugin Superelements Connector no site para ler o modelo: ${inlineReason({ mode: 'inline', reason: 'no-connector', themeBuilder: true, connector: null, server: false })}.`, 'no-connector', 404)
    }
    throw error
  }
}

export interface SavePartBody {
  /** Sem id, cria o modelo (publicado). */
  id?: number
  kind: ComponentKind
  title?: string
  /** JSON do Elementor; sem ele, o conteúdo do modelo fica como está. */
  elements?: string
  /** Condições do Theme Builder; sem elas, ficam as que o modelo tem. */
  conditions?: string[]
  /** Outros modelos do mesmo lugar que saem do site (ficam salvos, sem condição). */
  release?: number[]
}

/**
 * Cria (sem id) ou atualiza o modelo de um componente: pelo servidor (API do
 * WordPress e Site Editor do Elementor); sem ele, pelo Connector.
 */
export async function saveSitePart(connection: WordPressConnection, body: SavePartBody): Promise<SitePart> {
  // Global Widget: só o plugin grava o tipo do widget
  const fromServer = body.kind === 'widget' ? null : await viaServer<SitePart>({ action: 'save', ...body })
  if (fromServer) return fromServer
  return wpRequest<SitePart>(credentialsOf(connection), body.id ? `superelements/v1/parts/${body.id}` : 'superelements/v1/parts', { method: 'POST', body })
}

/** Páginas que têm um uso do componente (a seção inteira ou uma camada dela). */
export function pagesUsing(componentId: string, pages: SpacePage[], nodes: SpaceNode[]) {
  const sections = new Set(componentUses(nodes).filter((u) => u.componentId === componentId).map((u) => u.sectionId))
  return pages.filter((page) => page.sectionIds.some((id) => sections.has(id)))
}

/**
 * Condições do Theme Builder para o cabeçalho (ou rodapé): o site inteiro,
 * menos as páginas que já estão no site e não têm o componente. As que ainda
 * não foram publicadas entram na condição quando forem (`pending`).
 */
export function componentConditions(component: SpaceComponent, pages: SpacePage[], nodes: SpaceNode[], siteUrl: string) {
  const using = new Set(pagesUsing(component.id, pages, nodes).map((p) => p.id))
  const without = pages.filter((p) => !using.has(p.id))
  const linked = without.filter((p) => p.wordpress?.siteUrl === siteUrl)
  return {
    conditions: ['include/general', ...linked.map((p) => `exclude/singular/page/${p.wordpress!.postId}`)],
    excluded: linked.map((p) => p.name),
    pending: without.filter((p) => p.wordpress?.siteUrl !== siteUrl).map((p) => p.name),
  }
}

/** Resumo curto de um texto (o JSON publicado), para saber se a folha do componente mudou depois. */
export function contentHash(text: string) {
  let hash = 5381
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  return `${text.length.toString(36)}-${(hash >>> 0).toString(36)}`
}

/**
 * As condições que vão para o site: as do canvas (site inteiro, menos as
 * páginas tiradas) mais as que o modelo já tinha e o canvas não mostra
 * (arquivos, posts, páginas que não estão no canvas). Assim publicar daqui
 * não apaga uma regra feita no Elementor.
 */
export function mergeConditions(ours: string[], current: string[], pages: SpacePage[], siteUrl: string) {
  const linked = new Set(pages.filter((p) => p.wordpress?.siteUrl === siteUrl).map((p) => p.wordpress!.postId))
  const kept = current.filter((condition) => {
    if (condition === 'include/general') return false
    const page = /^(?:include|exclude)\/singular\/page\/(\d+)$/.exec(condition)
    return !(page && linked.has(Number(page[1])))
  })
  return [...new Set([...ours, ...kept])]
}

const sameConditions = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n')

/**
 * Depois de publicar uma página: o cabeçalho e o rodapé que já estão no
 * Theme Builder passam a deixá-la de fora (ou a mostrar), conforme ela tem o
 * componente no canvas. Só mexe na condição; o conteúdo do modelo fica como
 * está. Devolve os nomes dos que mudaram.
 */
export async function syncComponentConditions(connection: WordPressConnection): Promise<string[]> {
  const siteUrl = connection.site.siteUrl
  const changed: string[] = []
  for (const component of useSpaceStore.getState().components) {
    const link = component.wordpress
    if (!component.role || link?.siteUrl !== siteUrl) continue
    const { pages, nodes } = useSpaceStore.getState()
    const current = await fetchSitePart(connection, link.postId)
    const conditions = mergeConditions(componentConditions(component, pages, nodes, siteUrl).conditions, current.conditions, pages, siteUrl)
    if (sameConditions(current.conditions, conditions)) continue
    const saved = await saveSitePart(connection, { id: link.postId, kind: component.role, conditions })
    // Se alguém mexeu no modelo pelo Elementor, a data guardada continua a antiga: a próxima publicação do componente avisa
    if (current.modified_gmt === link.modifiedGmt) {
      useSpaceStore.getState().setComponentWordPress(component.id, { ...link, modifiedGmt: saved.modified_gmt, syncedAt: Date.now() })
    }
    changed.push(component.name)
  }
  return changed
}
