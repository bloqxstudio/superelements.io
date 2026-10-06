import { loadPublishBackups, savePublishBackups, type PublishBackup } from '@/features/projects/storage'
import { getActiveBrand } from '@/features/space/brand/brandStore'
import { applyMediaReplacements, collectImageUrls, type MediaReplacement } from '@/features/space/pageImages'
import { slugify } from '@/features/space/featured/suggest'
import { pageSections } from '@/features/space/pages/pages'
import { componentElements, componentUses, sectionComponent, untagElement, walk } from '@/features/space/components/components'
import { buildLandingPage, parseSectionElements, type SectionElement } from '@/features/space/landingPage'
import { useSpaceStore } from '@/store/spaceStore'
import { logEvent } from '@/features/space/history/activity'
import type { PageWordPressLink, SectionNodeData, SpaceComponent, SpaceNode } from '@/types/space'
import { adminUrl, credentialsOf } from './connect'
import { isSiteMedia, uploadDataUrl, uploadImage } from './media'
import { wpRequest, WordPressError } from './rest'
import { detectSeo, writeSeo, type SeoSupport } from './seo'
import { canSaveWidgets, componentConditions, contentHash, fetchSitePart, inlineReason, mergeConditions, partsSupport, saveSitePart, syncComponentConditions, type ComponentKind, type PartsSupport, type SitePart, WIDGET_REASON } from './siteParts'
import type { WordPressConnection } from './types'

/**
 * Publica uma página do canvas no WordPress do cliente, gravando o JSON do
 * Elementor em `meta._elementor_data`, com o título, o endereço, a imagem
 * destacada e o SEO dos detalhes da página. Página ligada é atualizada no
 * mesmo endereço, depois de conferir se ninguém a editou no site desde a
 * última sincronização e de guardar aqui o conteúdo que ela tinha.
 */

/** Quantas versões anteriores de cada página ficam guardadas para desfazer. */
const MAX_BACKUPS = 5

export type PageStatus = 'draft' | 'publish'
/** Tela cheia do Elementor, ou o cabeçalho e o rodapé do tema em volta da página. */
export type PageTemplate = 'elementor_canvas' | 'elementor_header_footer'

/** A página foi editada no site depois da última importação ou publicação. */
export class PageConflictError extends WordPressError {
  constructor(readonly modifiedGmt: string) {
    super('A página foi editada no WordPress depois da última sincronização.', 'conflict')
  }
}

export interface PublishOptions {
  connection: WordPressConnection
  projectId: string
  pageId: string
  /** Na página ligada, sem valor fica a situação que ela tem no site. */
  status?: PageStatus
  /** Layout da página no WordPress. Na página ligada, sem valor fica o que ela tem no site. */
  template?: PageTemplate
  /** Atualiza mesmo que a página tenha mudado no site. */
  overwrite?: boolean
  onProgress?: (step: string) => void
}

export interface PublishResult {
  postId: number
  link: string
  editUrl: string
  status: string
  created: boolean
  uploaded: number
  /** Imagens que não subiram e seguem pelo endereço de origem. */
  failedImages: string[]
  /** O Elementor não limpou o cache de CSS: a página pode aparecer com o estilo antigo. */
  cacheCleared: boolean
  /** `unsupported`: o tema do site não usa imagem destacada em páginas. */
  featured: 'saved' | 'unchanged' | 'unsupported' | 'failed'
  seo: 'saved' | 'skipped' | 'failed'
  seoSupport: SeoSupport | null
  seoError?: string
  /**
   * O layout pedido e o que a página ficou no site ('' é o modelo padrão do tema,
   * com o título e o cabeçalho dele). `error`: o site recusou o pedido.
   */
  layout: { wanted?: PageTemplate; applied?: string; error?: string }
  /**
   * Cabeçalho e rodapé do site que a página mostra: `theme`, vêm do Theme
   * Builder (a página sobe sem eles); `inline`, vão dentro da página.
   * `unpublished`: ainda não estão no Theme Builder do site.
   */
  parts: { mode: PartsSupport['mode']; reason?: string; shown: string[]; unpublished: string[]; synced: string[] }
  /**
   * Componentes livres da página: com o Theme Builder, vão como widget Modelo
   * apontando para o modelo salvo de cada um. `created`: criados agora;
   * `outdated`: mudaram no canvas depois de publicados (o site mostra a versão de antes).
   */
  components: { used: string[]; created: string[]; outdated: string[] }
}

interface WpPage {
  id: number
  link: string
  status: string
  modified_gmt: string
  slug?: string
  featured_media?: number
  title?: { raw?: string }
  /** Modelo de página do tema ('' é o padrão do tema). */
  template?: string
  meta?: { _elementor_data?: string }
}

export const elementorEditUrl = (connection: WordPressConnection, postId: number) =>
  `${adminUrl(connection.site)}post.php?post=${postId}&action=elementor`

/**
 * Elementos da página como o canvas mostra: marca nas seções da biblioteca,
 * seções do site como vieram. Os componentes vão dentro da página como
 * cópias (`inline`). Com o Elementor Pro (`theme`), o cabeçalho e o rodapé
 * do site ficam no Theme Builder (a página sobe sem eles) e os componentes que
 * viram modelo (`templates`: id do componente → id do modelo no site) entram
 * como referência: a seção pelo widget Modelo, o widget como Global Widget.
 */
export function pageElements(pageId: string, mode: PartsSupport['mode'] = 'inline', templates?: Map<string, number>) {
  const { pages, nodes, connections, components } = useSpaceStore.getState()
  const page = pages.find((p) => p.id === pageId)
  if (!page) throw new WordPressError('Essa página não está mais no canvas.')
  const roles = new Set(components.filter((c) => c.role).map((c) => c.id))
  const sections = pageSections(page, nodes)
    .filter((section) => mode !== 'theme' || !roles.has(sectionComponent(section) ?? ''))
    .map((section) => (mode === 'theme' && templates?.size ? withTemplates(section, templates) : section))
  const built = buildLandingPage(sections, nodes, connections, getActiveBrand())
  return { page, ...built }
}

const elementId = () => Math.random().toString(16).slice(2, 9).padEnd(7, '0')
const ZERO = { unit: 'px', top: '0', right: '0', bottom: '0', left: '0', isLinked: true }

/** Container sem respiro que só segura um widget (no topo da seção o Elementor pede um container). */
const holder = (child: SectionElement): SectionElement => ({
  id: elementId(),
  elType: 'container',
  isInner: false,
  settings: { content_width: 'full', padding: ZERO, padding_tablet: ZERO, padding_mobile: ZERO },
  elements: [child],
})

/** O uso como referência ao modelo: a seção inteira pelo widget Modelo; um widget como Global Widget. */
function withTemplates(section: SpaceNode, templates: Map<string, number>): SpaceNode {
  const data = section.data as SectionNodeData
  const whole = data.component ? templates.get(data.component) : undefined
  // Vai como veio: a marca não mexe no que só aponta para o modelo
  const asIs = (json: string): SpaceNode => ({ ...section, data: { title: data.title, elementorJson: json, origin: { kind: 'wordpress', siteUrl: '', postId: 0 } } })
  if (whole) return asIs(JSON.stringify([holder({ id: elementId(), elType: 'widget', widgetType: 'template', settings: { template_id: String(whole) }, elements: [] })]))
  const root = parseSectionElements(data.elementorJson)
  if (!root) return section
  let changed = false
  const swap = (list: SectionElement[]): SectionElement[] =>
    list.map((element) => {
      const id = elementComponentId(element)
      const postId = id ? templates.get(id) : undefined
      if (postId && element.elType === 'widget') {
        changed = true
        return { id: element.id, elType: 'widget', widgetType: 'global', templateID: postId, settings: {}, elements: [] }
      }
      return element.elements?.length ? { ...element, elements: swap(element.elements) } : element
    })
  const next = swap(root).map((element) => (element.elType === 'widget' ? holder(element) : element))
  return changed ? { ...section, data: { ...data, elementorJson: JSON.stringify(next) } } : section
}

const elementComponentId = (element: SectionElement) => {
  const settings = element.settings
  const value = settings && !Array.isArray(settings) ? (settings as Record<string, unknown>)._se_component : undefined
  return typeof value === 'string' ? value : undefined
}

/** Tira as marcas de uso (no Elementor o conteúdo vai como está). */
function stripTags(elements: SectionElement[]): SectionElement[] {
  return elements.map((element) => {
    const own = untagElement(element)
    return own.elements?.length ? { ...own, elements: stripTags(own.elements) } : own
  })
}

/**
 * Que modelo o componente vira no Elementor Pro: cabeçalho e rodapé (Theme
 * Builder), seção (container salvo) ou widget (Global Widget). Um container
 * dentro da seção não tem modelo nativo que guarde o lugar dele: vai dentro
 * das páginas (null).
 */
export function componentKind(component: SpaceComponent): ComponentKind | null {
  if (component.role) return component.role
  if (component.level === 'section') return 'section'
  return componentElements(component)[0]?.elType === 'widget' ? 'widget' : null
}

/** O componente como vai para o Elementor: montado de um uso dele (com a marca e os ajustes), sem as marcas de uso. */
export function componentPublishElements(componentId: string) {
  const { nodes, connections, components } = useSpaceStore.getState()
  const component = components.find((c) => c.id === componentId)
  if (!component) throw new WordPressError('Esse componente não está mais no projeto.')
  const use = componentUses(nodes).find((u) => u.componentId === componentId)
  const node = use && nodes.find((n) => n.id === use.sectionId)
  let elements: SectionElement[] = componentElements(component)
  if (use && node) {
    const built = buildLandingPage([node], nodes, connections, getActiveBrand()).elements
    if (!use.elementId) elements = built
    else {
      let found: SectionElement | null = null
      walk(built, (element) => {
        if (!found && element.id === use.elementId) found = element
      })
      if (found) elements = [found]
    }
  }
  return { component, elements: stripTags(elements) }
}

/** O conteúdo do componente como seria publicado agora, resumido: muda quando ele muda no canvas. */
export const componentContentHash = (componentId: string) => contentHash(JSON.stringify(componentPublishElements(componentId).elements))

/** Componentes usados direto na página, sem repetir. */
function pageComponentIds(pageId: string) {
  const { pages, nodes } = useSpaceStore.getState()
  const page = pages.find((p) => p.id === pageId)
  if (!page) return []
  const sections = new Set(page.sectionIds)
  return [...new Set(componentUses(nodes).filter((u) => sections.has(u.sectionId)).map((u) => u.componentId))]
}

/** Sobe para a mídia do site as imagens que ainda não estão lá e troca os endereços nos elementos. */
async function uploadImages(elements: unknown[], connection: WordPressConnection, onProgress?: (step: string) => void) {
  const pending = imagesToUpload(elements, connection)
  const replacements = new Map<string, MediaReplacement>()
  const failedImages: string[] = []
  for (const [index, url] of pending.entries()) {
    onProgress?.(`Enviando imagens para o site (${index + 1} de ${pending.length})…`)
    try {
      replacements.set(url, await uploadImage(connection, url))
    } catch (error) {
      console.warn('[wordpress] imagem não enviada', url, error)
      failedImages.push(url)
    }
  }
  applyMediaReplacements(elements, replacements, (url) => isSiteMedia(url, connection.site.siteUrl))
  return { uploaded: replacements.size, failedImages }
}

/** Imagens que precisam subir para a biblioteca de mídia do site. */
export const imagesToUpload = (elements: unknown[], connection: WordPressConnection) =>
  collectImageUrls(elements).filter((url) => !isSiteMedia(url, connection.site.siteUrl))

async function clearElementorCache(connection: WordPressConnection) {
  try {
    await wpRequest(credentialsOf(connection), 'elementor/v1/cache', { method: 'DELETE' })
    return true
  } catch {
    return false
  }
}

const linkFrom = (connection: WordPressConnection, page: WpPage, title: string): PageWordPressLink => ({
  siteUrl: connection.site.siteUrl,
  postId: page.id,
  title: page.title?.raw || title,
  link: page.link,
  status: page.status,
  modifiedGmt: page.modified_gmt,
  syncedAt: Date.now(),
})

const SAVED_FIELDS = 'id,link,status,modified_gmt,title,slug,featured_media,template'

export async function publishPage({ connection, projectId, pageId, status, template, overwrite, onProgress }: PublishOptions): Promise<PublishResult> {
  const creds = credentialsOf(connection)
  // Com o Theme Builder, o cabeçalho e o rodapé do site ficam nos modelos dele e a página sobe sem eles
  onProgress?.('Conferindo o site…')
  const support = await partsSupport(connection)
  const theme = support.mode === 'theme'

  // Componentes que viram modelo: cada um precisa estar salvo no Elementor do site; o que ainda não está é
  // criado agora (criar não muda nenhuma outra página). Atualizar um que mudou é a publicação do próprio componente.
  const templates = new Map<string, number>()
  const components: PublishResult['components'] = { used: [], created: [], outdated: [] }
  const roleUses: SpaceComponent[] = []
  if (theme) {
    for (const componentId of pageComponentIds(pageId)) {
      const component = useSpaceStore.getState().components.find((c) => c.id === componentId)
      const kind = component && componentKind(component)
      if (!component || !kind) continue
      if (component.role) {
        roleUses.push(component)
        continue
      }
      let linked = component.wordpress?.siteUrl === connection.site.siteUrl ? component.wordpress : undefined
      if (linked) {
        // Modelo apagado no site: o componente é criado de novo
        const gone = await fetchSitePart(connection, linked.postId).then(() => false, (error) => (error instanceof WordPressError && error.code === 'gone' ? true : Promise.reject(error)))
        if (gone) {
          useSpaceStore.getState().setComponentWordPress(component.id, undefined)
          linked = undefined
        }
      }
      // Global Widget novo sem o plugin: vai dentro da página
      if (!linked && kind === 'widget' && !canSaveWidgets(support)) continue
      if (!linked) {
        onProgress?.(`Salvando o componente ${component.name} no Elementor…`)
        await publishComponent({ connection, projectId, componentId: component.id, onProgress })
        linked = useSpaceStore.getState().components.find((c) => c.id === component.id)?.wordpress
        components.created.push(component.name)
      } else if (linked.contentHash && linked.contentHash !== componentContentHash(component.id)) components.outdated.push(component.name)
      if (linked) templates.set(component.id, linked.postId)
      components.used.push(component.name)
    }
  }

  const { page, elements } = pageElements(pageId, support.mode, templates)
  if (!elements.length) throw new WordPressError(roleUses.length && theme ? 'A página não tem seção própria para publicar: o cabeçalho e o rodapé vão pelo Theme Builder.' : 'A página não tem seção com JSON válido para publicar.')
  // Página com cabeçalho do Theme Builder vai em Elementor Largura Total: a Tela do Elementor não mostra o cabeçalho do tema nem o do Theme Builder
  if (theme && roleUses.length) template = 'elementor_header_footer'
  const link = page.wordpress?.siteUrl === connection.site.siteUrl ? page.wordpress : undefined
  const details = page.details ?? {}
  // Página ligada sem título escolhido fica com o título que tem no site
  const title = details.title?.trim() || (link ? '' : page.name)

  let current: WpPage | null = null
  if (link) {
    onProgress?.('Conferindo a página no site…')
    try {
      current = await wpRequest<WpPage>(creds, `wp/v2/pages/${link.postId}`, {
        params: { context: 'edit', _fields: 'id,link,status,modified_gmt,title,slug,template,meta._elementor_data' },
      })
    } catch (error) {
      if (error instanceof WordPressError && error.status === 404) {
        throw new WordPressError('A página não existe mais no site (foi apagada ou está na lixeira). Desligue a página para publicar como nova.', 'gone', 404)
      }
      throw error
    }
    if (!overwrite && current.modified_gmt !== link.modifiedGmt) throw new PageConflictError(current.modified_gmt)
  }

  const { uploaded, failedImages } = await uploadImages(elements, connection, onProgress)
  const elementorData = JSON.stringify(elements)

  // Imagem destacada: a do modelo ou a enviada daqui sobe para a mídia; a da biblioteca vai pelo id
  let featuredMedia: number | undefined
  let featured: PublishResult['featured'] = 'unchanged'
  const wanted = details.featured
  if (wanted?.kind === 'none') featuredMedia = 0
  else if (wanted?.kind === 'media') featuredMedia = wanted.id
  else if (wanted) {
    onProgress?.('Enviando a imagem destacada…')
    try {
      featuredMedia = (await uploadDataUrl(connection, wanted.image, `destaque-${slugify(title || page.name) || 'pagina'}`)).id
    } catch (error) {
      console.warn('[wordpress] imagem destacada não enviada', error)
      featured = 'failed'
    }
  }
  const pageFields: Record<string, unknown> = featuredMedia === undefined ? {} : { featured_media: featuredMedia }
  const slug = details.slug?.trim()

  let saved: WpPage
  if (link && current) {
    // Guarda o que o site tinha, para desfazer daqui
    const backups = await loadPublishBackups(projectId, link.postId)
    const previous: PublishBackup = {
      elementorData: current.meta?._elementor_data ?? '',
      modifiedGmt: current.modified_gmt,
      savedAt: Date.now(),
      template: current.template,
    }
    await savePublishBackups(projectId, link.postId, [previous, ...backups].slice(0, MAX_BACKUPS))

    onProgress?.('Gravando a página no WordPress…')
    const body: Record<string, unknown> = { ...pageFields, meta: { _elementor_data: elementorData } }
    if (title && title !== current.title?.raw) body.title = title
    if (slug && slug !== current.slug) body.slug = slug
    if (status && status !== current.status) body.status = status
    if (template && template !== current.template) body.template = template
    saved = await wpRequest<WpPage>(creds, `wp/v2/pages/${link.postId}`, { method: 'POST', params: { _fields: SAVED_FIELDS }, body })
  } else {
    onProgress?.('Criando a página no WordPress…')
    saved = await wpRequest<WpPage>(creds, 'wp/v2/pages', {
      method: 'POST',
      params: { _fields: SAVED_FIELDS },
      body: {
        ...pageFields,
        title,
        ...(slug ? { slug } : {}),
        status: status ?? 'draft',
        template: template ?? 'elementor_canvas',
        meta: { _elementor_edit_mode: 'builder', _elementor_template_type: 'wp-page', _elementor_data: elementorData },
      },
    })
  }

  // O WordPress descarta o modelo sem avisar quando não o reconhece na hora de criar a página (ele
  // valida antes de o Elementor ligar a página): confere o que ficou e pede de novo, agora numa
  // atualização, que aceita ou devolve o motivo
  const wantedTemplate = template ?? (link ? undefined : 'elementor_canvas')
  let layoutError: string | undefined
  if (wantedTemplate && saved.template !== undefined && saved.template !== wantedTemplate) {
    onProgress?.(wantedTemplate === 'elementor_canvas' ? 'Aplicando a Tela do Elementor…' : 'Aplicando o layout com o tema…')
    try {
      saved = await wpRequest<WpPage>(creds, `wp/v2/pages/${saved.id}`, { method: 'POST', params: { _fields: SAVED_FIELDS }, body: { template: wantedTemplate } })
    } catch (error) {
      layoutError = error instanceof Error ? error.message : String(error)
    }
  }

  // Sem o campo na resposta, o tema do site não usa imagem destacada em páginas
  if (featuredMedia !== undefined) featured = saved.featured_media === featuredMedia ? 'saved' : 'unsupported'

  let seo: PublishResult['seo'] = 'skipped'
  let seoSupport: SeoSupport | null = null
  let seoError: string | undefined
  if (details.seoTitle !== undefined || details.description !== undefined || details.focusKeyword !== undefined) {
    seoSupport = await detectSeo(connection).catch(() => null)
    if (seoSupport?.writable) {
      onProgress?.('Gravando o SEO da página…')
      try {
        await writeSeo(connection, seoSupport, saved.id, details)
        seo = 'saved'
      } catch (error) {
        seo = 'failed'
        seoError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  onProgress?.('Limpando o cache de CSS do Elementor…')
  const cacheCleared = await clearElementorCache(connection)
  // O SEO grava depois da página e muda a data dela: a guardada é a do fim, para não acusar conflito depois
  const final = await wpRequest<WpPage>(creds, `wp/v2/pages/${saved.id}`, { params: { context: 'edit', _fields: SAVED_FIELDS } }).catch(() => saved)
  useSpaceStore.getState().setPageWordPress(pageId, linkFrom(connection, final, title || page.name))

  // Ligada ao site, a página entra na condição do cabeçalho e do rodapé que já estão no Theme Builder: fica de fora (ou volta), como no canvas
  let synced: string[] = []
  if (theme) {
    onProgress?.('Conferindo o cabeçalho e o rodapé do site…')
    synced = await syncComponentConditions(connection).catch((error) => {
      console.warn('[wordpress] condição do cabeçalho não atualizada', error)
      return []
    })
  }
  void logEvent(projectId, 'publish.page', page.name, { link: final.link, status: final.status, created: !link, site: connection.site.siteUrl })

  return {
    postId: final.id,
    link: final.link,
    editUrl: elementorEditUrl(connection, final.id),
    status: final.status,
    created: !link,
    uploaded,
    failedImages,
    cacheCleared,
    featured,
    seo,
    seoSupport,
    seoError,
    layout: { wanted: wantedTemplate, applied: final.template, error: layoutError },
    parts: {
      mode: support.mode,
      reason: theme ? undefined : inlineReason(support),
      shown: roleUses.map((c) => c.name),
      unpublished: roleUses.filter((c) => c.wordpress?.siteUrl !== connection.site.siteUrl).map((c) => c.name),
      synced,
    },
    components,
  }
}

export interface ComponentPublishOptions {
  connection: WordPressConnection
  projectId: string
  componentId: string
  /** Atualiza mesmo que o modelo tenha mudado no site. */
  overwrite?: boolean
  /** Modelo que o site já tem e passa a ser este componente (em vez de criar outro). */
  target?: number
  /** Outros modelos do mesmo lugar que saem do site (ficam salvos no WordPress, sem condição). */
  release?: number[]
  onProgress?: (step: string) => void
}

export interface ComponentPublishResult {
  postId: number
  title: string
  editUrl: string
  created: boolean
  kind: ComponentKind
  uploaded: number
  failedImages: string[]
  cacheCleared: boolean
  /** Páginas do site que ficam sem o cabeçalho (ou rodapé). */
  excluded: string[]
  /** Páginas sem ele que ainda não estão no site: entram na condição quando forem publicadas. */
  pending: string[]
  released: number
}

/**
 * Publica o componente como modelo do Elementor Pro: o cabeçalho e o rodapé
 * no Theme Builder (no site inteiro, menos as páginas sem ele), a seção como
 * container salvo e o widget como Global Widget. O modelo ligado é
 * atualizado no lugar, depois de conferir se ninguém o mudou pelo Elementor e
 * de guardar aqui o conteúdo que ele tinha. Mudar o modelo muda todas as
 * páginas do site que o usam.
 */
export async function publishComponent({ connection, projectId, componentId, overwrite, target, release, onProgress }: ComponentPublishOptions): Promise<ComponentPublishResult> {
  onProgress?.('Conferindo o site…')
  const support = await partsSupport(connection, true)
  if (support.mode !== 'theme') throw new WordPressError(`Não dá para publicar o componente como modelo: ${inlineReason(support)}. Até lá, ele vai dentro de cada página.`)
  const { component, elements } = componentPublishElements(componentId)
  const kind = componentKind(component)
  if (!kind) throw new WordPressError(`"${component.name}" é um grupo dentro da seção: o Elementor não tem modelo que guarde o lugar dele, então vai dentro de cada página.`)
  if (kind === 'widget' && !canSaveWidgets(support)) throw new WordPressError(`Não dá para publicar "${component.name}" como Global Widget: ${WIDGET_REASON}. Até lá, ele vai dentro de cada página.`, 'needs-connector')
  if (!elements.length) throw new WordPressError(`"${component.name}" não tem conteúdo válido para publicar.`)
  // Antes de subir as imagens (que trocam os endereços): é o mesmo resumo que `componentContentHash` calcula depois
  const hash = contentHash(JSON.stringify(elements))
  const siteUrl = connection.site.siteUrl
  const link = component.wordpress?.siteUrl === siteUrl ? component.wordpress : undefined
  const postId = link?.postId ?? target

  let current: SitePart | null = null
  if (postId) {
    onProgress?.('Conferindo o modelo no site…')
    current = await fetchSitePart(connection, postId)
    if (link && !overwrite && current.modified_gmt !== link.modifiedGmt) throw new PageConflictError(current.modified_gmt)
  }

  const { uploaded, failedImages } = await uploadImages(elements, connection, onProgress)

  if (current) {
    // Guarda o que o site tinha, para desfazer daqui
    const backups = await loadPublishBackups(projectId, current.id)
    const previous: PublishBackup = { elementorData: current.elementor_data ?? '', modifiedGmt: current.modified_gmt, savedAt: Date.now() }
    await savePublishBackups(projectId, current.id, [previous, ...backups].slice(0, MAX_BACKUPS))
  }

  const { pages, nodes } = useSpaceStore.getState()
  const theme = kind === 'header' || kind === 'footer'
  const ours = theme ? componentConditions(component, pages, nodes, siteUrl) : { conditions: undefined, excluded: [], pending: [] }
  // O que o modelo já tinha e o canvas não mostra continua valendo
  const conditions = ours.conditions && current ? mergeConditions(ours.conditions, current.conditions, pages, siteUrl) : ours.conditions
  const where = theme ? 'no Theme Builder' : 'na Biblioteca do Elementor'
  onProgress?.(postId ? `Atualizando o modelo ${where}…` : `Criando o modelo ${where}…`)
  const saved = await saveSitePart(connection, { id: postId, kind, title: component.name, elements: JSON.stringify(elements), conditions, release: release?.filter((id) => id !== postId) })

  onProgress?.('Limpando o cache de CSS do Elementor…')
  const cacheCleared = await clearElementorCache(connection)
  useSpaceStore.getState().setComponentWordPress(componentId, {
    siteUrl,
    postId: saved.id,
    title: saved.title,
    link: saved.edit_url,
    status: saved.status,
    modifiedGmt: saved.modified_gmt,
    syncedAt: Date.now(),
    contentHash: hash,
  })
  void logEvent(projectId, 'publish.component', component.name, { postId: saved.id, created: !postId, site: siteUrl, kind, conditions })

  return {
    postId: saved.id,
    title: saved.title,
    editUrl: saved.edit_url,
    created: !postId,
    kind,
    uploaded,
    failedImages,
    cacheCleared,
    excluded: ours.excluded,
    pending: ours.pending,
    released: release?.length ?? 0,
  }
}

/** Devolve ao site o conteúdo que o modelo do componente tinha antes da última publicação daqui. */
export async function restoreComponentBackup(connection: WordPressConnection, projectId: string, componentId: string) {
  const component = useSpaceStore.getState().components.find((c) => c.id === componentId)
  const link = component?.wordpress
  const kind = component && componentKind(component)
  if (!component || !link || !kind) throw new WordPressError('Esse componente não está ligado a um modelo do site.')
  const [last, ...rest] = await loadPublishBackups(projectId, link.postId)
  if (!last) throw new WordPressError('Não há versão anterior guardada para esse componente.')
  const restored = await saveSitePart(connection, { id: link.postId, kind, elements: last.elementorData })
  await savePublishBackups(projectId, link.postId, rest)
  const cacheCleared = await clearElementorCache(connection)
  useSpaceStore.getState().setComponentWordPress(componentId, { ...link, modifiedGmt: restored.modified_gmt, syncedAt: Date.now() })
  void logEvent(projectId, 'publish.restored', component.name, { postId: link.postId, restoredFrom: last.savedAt })
  return { restoredFrom: last.savedAt, cacheCleared, remaining: rest.length }
}

/** Versões anteriores guardadas da página ligada, a mais nova primeiro. */
export const pageBackups = (projectId: string, postId: number) => loadPublishBackups(projectId, postId)

/** Devolve ao site o conteúdo que a página tinha antes da última atualização feita daqui. */
export async function restoreLastBackup(connection: WordPressConnection, projectId: string, pageId: string) {
  const page = useSpaceStore.getState().pages.find((p) => p.id === pageId)
  const link = page?.wordpress
  if (!link) throw new WordPressError('Essa página não está ligada ao WordPress.')
  const [last, ...rest] = await loadPublishBackups(projectId, link.postId)
  if (!last) throw new WordPressError('Não há versão anterior guardada para essa página.')

  const saved = await wpRequest<WpPage>(credentialsOf(connection), `wp/v2/pages/${link.postId}`, {
    method: 'POST',
    params: { _fields: 'id,link,status,modified_gmt,title' },
    body: { meta: { _elementor_data: last.elementorData }, ...(last.template !== undefined ? { template: last.template } : {}) },
  })
  await savePublishBackups(projectId, link.postId, rest)
  const cacheCleared = await clearElementorCache(connection)
  useSpaceStore.getState().setPageWordPress(pageId, linkFrom(connection, saved, link.title))
  void logEvent(projectId, 'publish.restored', page?.name ?? link.title, { link: link.link, restoredFrom: last.savedAt })
  return { restoredFrom: last.savedAt, cacheCleared, remaining: rest.length }
}
