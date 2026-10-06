import { sitePages } from '@/features/space/pages/pages'
import { useSpaceStore } from '@/store/spaceStore'
import type { PagePartKind, SpacePage } from '@/types/space'
import { adminUrl, credentialsOf } from './connect'
import { wpRequest, WordPressError } from './rest'
import type { WordPressConnection } from './types'

/**
 * Componentes do site no WordPress, com as APIs que o próprio WordPress e o
 * Elementor Pro já têm (sem plugin): o modelo é um post da Biblioteca do
 * Elementor (`wp/v2/elementor_library`, com `_elementor_data` e o tipo), e
 * a condição de exibição do cabeçalho e do rodapé passa pelo Site Editor do
 * Elementor Pro (`elementor/v1/site-editor`), que grava pelo próprio Theme
 * Builder e refaz o cache dele. Sem o Elementor Pro, o cabeçalho, o rodapé e
 * os componentes vão dentro de cada página, como antes.
 */

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
  reason?: 'no-pro' | 'no-permission'
}

/** Tipo de documento do Elementor de cada componente do Space. */
const PART_TYPE: Record<PagePartKind, string> = { header: 'header', footer: 'footer', section: 'container' }
const isTheme = (kind: PagePartKind) => kind === 'header' || kind === 'footer'

/** O que a lista do Site Editor traz de cada modelo do Theme Builder. */
interface SiteEditorTemplate {
  id: number
  type: string
  title: string
  status: string
  editURL?: string
  isActive?: boolean
  conditions?: SiteEditorCondition[]
}
interface SiteEditorCondition {
  type: string
  name: string
  sub_name?: string
  sub_id?: string | number
}

/** `{ type: 'exclude', name: 'singular', sub_name: 'page', sub_id: 12 }` vira "exclude/singular/page/12", como o Elementor grava. */
const conditionText = (c: SiteEditorCondition) => [c.type, c.name, c.sub_name ?? '', String(c.sub_id ?? '')].join('/').replace(/\/+$/, '')

/** As condições como o Site Editor recebe: um formulário com type, name, sub_name e sub_id de cada uma. */
function conditionsForm(conditions: string[]) {
  const form = new URLSearchParams()
  conditions.forEach((condition, i) => {
    const [type = '', name = '', subName = '', subId = ''] = condition.split('/')
    form.set(`conditions[${i}][type]`, type)
    form.set(`conditions[${i}][name]`, name)
    form.set(`conditions[${i}][sub_name]`, subName)
    form.set(`conditions[${i}][sub_id]`, subId)
  })
  return form
}

const editUrl = (connection: WordPressConnection, id: number) => `${adminUrl(connection.site)}post.php?post=${id}&action=elementor`

/** A consulta vale por um minuto: o diálogo e o resumo dele perguntam juntos. */
const SUPPORT_TTL = 60_000
const supportCache = new Map<string, { at: number; value: Promise<PartsSupport> }>()

/** Se o cabeçalho, o rodapé e os componentes podem virar modelos do Elementor neste site (pede o Elementor Pro). */
export function partsSupport(connection: WordPressConnection, fresh = false): Promise<PartsSupport> {
  const key = connection.site.siteUrl
  const cached = supportCache.get(key)
  if (!fresh && cached && Date.now() - cached.at < SUPPORT_TTL) return cached.value
  const value = (async (): Promise<PartsSupport> => {
    try {
      await wpRequest<unknown>(credentialsOf(connection), 'elementor/v1/site-editor/templates')
      return { mode: 'theme' }
    } catch (error) {
      // A rota existe, mas o usuário conectado não pode mexer no Theme Builder
      if (error instanceof WordPressError && (error.status === 401 || error.status === 403)) return { mode: 'inline', reason: 'no-permission' }
      return { mode: 'inline', reason: 'no-pro' }
    }
  })()
  supportCache.set(key, { at: Date.now(), value })
  return value
}

/** Por que o cabeçalho, o rodapé e os componentes vão dentro de cada página, numa frase. */
export function inlineReason(support: PartsSupport) {
  if (support.reason === 'no-permission') return 'o usuário do WordPress conectado não pode mexer no Theme Builder (conecte com um administrador)'
  return 'o site não tem o Elementor Pro (nem o PRO Elements), que tem o Theme Builder e o widget Modelo'
}

/** Cabeçalhos ou rodapés do Theme Builder que o site tem, com as condições de cada um. */
export async function listSiteParts(connection: WordPressConnection, kind: PagePartKind): Promise<SitePart[]> {
  if (!isTheme(kind)) return []
  const creds = credentialsOf(connection)
  const templates = (await wpRequest<SiteEditorTemplate[]>(creds, 'elementor/v1/site-editor/templates')).filter((t) => t.type === PART_TYPE[kind])
  if (!templates.length) return []
  // A data de mudança vem do WordPress (a lista do Site Editor só traz a de criação)
  const dates = await wpRequest<{ id: number; modified_gmt: string }[]>(creds, 'wp/v2/elementor_library', {
    params: { include: templates.map((t) => t.id).join(','), per_page: '100', context: 'edit', _fields: 'id,modified_gmt', status: 'publish,draft,private' },
  }).catch((): { id: number; modified_gmt: string }[] => [])
  const modified = new Map(dates.map((d) => [d.id, d.modified_gmt] as const))
  return templates.map((t) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    status: t.status,
    modified_gmt: modified.get(t.id) ?? '',
    conditions: (t.conditions ?? []).map(conditionText),
    edit_url: t.editURL ?? editUrl(connection, t.id),
  }))
}

interface WpLibraryPost {
  id: number
  title?: { raw?: string; rendered?: string }
  status: string
  modified_gmt: string
  meta?: { _elementor_template_type?: string; _elementor_data?: string }
}

/** Um modelo pelo id, com o JSON do Elementor e, no Theme Builder, as condições. */
export async function fetchSitePart(connection: WordPressConnection, id: number): Promise<SitePart> {
  const creds = credentialsOf(connection)
  let post: WpLibraryPost
  try {
    post = await wpRequest<WpLibraryPost>(creds, `wp/v2/elementor_library/${id}`, { params: { context: 'edit', _fields: 'id,title,status,modified_gmt,meta' } })
  } catch (error) {
    if (error instanceof WordPressError && error.status === 404) {
      throw new WordPressError('O modelo não existe mais no site (foi apagado ou está na lixeira). Desligue o componente do WordPress para criar outro.', 'gone', 404)
    }
    throw error
  }
  if (post.status === 'trash') throw new WordPressError('O modelo está na lixeira do site. Desligue o componente do WordPress para criar outro.', 'gone', 404)
  const type = post.meta?._elementor_template_type ?? ''
  const conditions =
    type === 'header' || type === 'footer'
      ? await wpRequest<SiteEditorCondition[]>(creds, `elementor/v1/site-editor/templates-conditions/${id}`).then((list) => (Array.isArray(list) ? list.map(conditionText) : []), () => [])
      : []
  return {
    id: post.id,
    title: post.title?.raw ?? post.title?.rendered ?? '',
    type,
    status: post.status,
    modified_gmt: post.modified_gmt,
    conditions,
    edit_url: editUrl(connection, post.id),
    elementor_data: post.meta?._elementor_data ?? '',
  }
}

export interface SavePartBody {
  /** Sem id, cria o modelo (publicado). */
  id?: number
  kind: PagePartKind
  title?: string
  /** JSON do Elementor; sem ele, o conteúdo do modelo fica como está. */
  elements?: string
  /** Condições do Theme Builder; sem elas, ficam as que o modelo tem. */
  conditions?: string[]
  /** Outros modelos do mesmo lugar que saem do site (ficam salvos, sem condição). */
  release?: number[]
}

/** Grava a condição pelo Site Editor; um modelo aberto no Elementor por outra pessoa recusa. */
async function saveConditions(connection: WordPressConnection, id: number, conditions: string[]) {
  const result = await wpRequest<unknown>(credentialsOf(connection), `elementor/v1/site-editor/templates-conditions/${id}`, { method: 'POST', body: conditionsForm(conditions) })
  if (result !== true) throw new WordPressError('O Elementor não gravou a condição do modelo (alguém pode estar com ele aberto no editor).')
}

/** Cria (sem id) ou atualiza o modelo de um componente: o conteúdo, o nome e, no Theme Builder, a condição. */
export async function saveSitePart(connection: WordPressConnection, body: SavePartBody): Promise<SitePart> {
  const creds = credentialsOf(connection)
  const type = PART_TYPE[body.kind]
  let id = body.id
  if (id) {
    const current = await fetchSitePart(connection, id)
    if (current.type !== type) throw new WordPressError(`Esse modelo do site não é um ${type} do Elementor.`, 'wrong_type', 409)
    const fields: Record<string, unknown> = {}
    if (body.title && body.title !== current.title) fields.title = body.title
    if (body.elements !== undefined) fields.meta = { _elementor_data: body.elements }
    if (Object.keys(fields).length) await wpRequest(creds, `wp/v2/elementor_library/${id}`, { method: 'POST', params: { _fields: 'id' }, body: fields })
  } else {
    if (body.elements === undefined) throw new WordPressError('Falta o conteúdo do modelo.')
    const created = await wpRequest<{ id: number }>(creds, 'wp/v2/elementor_library', {
      method: 'POST',
      params: { _fields: 'id' },
      body: { title: body.title || 'Superelements', status: 'publish', meta: { _elementor_edit_mode: 'builder', _elementor_template_type: type, _elementor_data: body.elements } },
    })
    id = created.id
  }
  if (isTheme(body.kind)) {
    // Outros modelos do mesmo lugar saem do site (continuam salvos, sem condição)
    for (const other of body.release ?? []) if (other !== id) await saveConditions(connection, other, [])
    if (body.conditions) await saveConditions(connection, id, body.conditions)
  }
  const saved = await fetchSitePart(connection, id)
  // A resposta não precisa carregar o JSON de volta
  delete saved.elementor_data
  return saved
}

/**
 * Condições do Theme Builder para a parte: o site inteiro, menos as páginas
 * que ficam sem ela e já estão no site. As que ainda não foram publicadas
 * entram na condição quando forem (`pending`).
 */
export function partConditions(part: SpacePage, pages: SpacePage[], siteUrl: string) {
  const excluded = sitePages(pages).filter((p) => part.part?.exclude?.includes(p.id))
  const linked = excluded.filter((p) => p.wordpress?.siteUrl === siteUrl)
  return {
    conditions: ['include/general', ...linked.map((p) => `exclude/singular/page/${p.wordpress!.postId}`)],
    excluded: linked.map((p) => p.name),
    pending: excluded.filter((p) => p.wordpress?.siteUrl !== siteUrl).map((p) => p.name),
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
  const linked = new Set(sitePages(pages).filter((p) => p.wordpress?.siteUrl === siteUrl).map((p) => p.wordpress!.postId))
  const kept = current.filter((condition) => {
    if (condition === 'include/general') return false
    const page = /^(?:include|exclude)\/singular\/page\/(\d+)$/.exec(condition)
    return !(page && linked.has(Number(page[1])))
  })
  return [...new Set([...ours, ...kept])]
}

const sameConditions = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n')

/**
 * Depois de publicar uma página: o cabeçalho e o rodapé que já estão no site
 * passam a deixá-la de fora (ou a mostrar de novo), como no canvas. Só mexe
 * na condição; o conteúdo do modelo fica como está. Devolve os nomes das
 * partes que mudaram.
 */
export async function syncPartConditions(connection: WordPressConnection): Promise<string[]> {
  const siteUrl = connection.site.siteUrl
  const changed: string[] = []
  for (const part of useSpaceStore.getState().pages) {
    const link = part.wordpress
    if (!part.part || part.part.kind === 'section' || link?.siteUrl !== siteUrl) continue
    const pages = useSpaceStore.getState().pages
    const current = await fetchSitePart(connection, link.postId)
    const conditions = mergeConditions(partConditions(part, pages, siteUrl).conditions, current.conditions, pages, siteUrl)
    if (sameConditions(current.conditions, conditions)) continue
    const saved = await saveSitePart(connection, { id: link.postId, kind: part.part.kind, conditions })
    // Se alguém mexeu no modelo pelo Elementor, a data guardada continua a antiga: a próxima publicação do componente avisa
    if (current.modified_gmt === link.modifiedGmt) {
      useSpaceStore.getState().setPageWordPress(part.id, { ...link, modifiedGmt: saved.modified_gmt, syncedAt: Date.now() })
    }
    changed.push(part.name)
  }
  return changed
}
