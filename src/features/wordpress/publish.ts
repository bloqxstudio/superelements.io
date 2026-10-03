import { loadPublishBackups, savePublishBackups, type PublishBackup } from '@/features/projects/storage'
import { getActiveBrand } from '@/features/space/brand/brandStore'
import { buildLandingPage } from '@/features/space/landingPage'
import { applyMediaReplacements, collectImageUrls, type MediaReplacement } from '@/features/space/pageImages'
import { slugify } from '@/features/space/featured/suggest'
import { pageSections } from '@/features/space/pages/pages'
import { useSpaceStore } from '@/store/spaceStore'
import type { PageWordPressLink } from '@/types/space'
import { adminUrl, credentialsOf } from './connect'
import { isSiteMedia, uploadDataUrl, uploadImage } from './media'
import { wpRequest, WordPressError } from './rest'
import { detectSeo, writeSeo, type SeoSupport } from './seo'
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

/** Elementos da página como o canvas mostra: marca nas seções da biblioteca, seções do site como vieram. */
export function pageElements(pageId: string) {
  const { pages, nodes, connections } = useSpaceStore.getState()
  const page = pages.find((p) => p.id === pageId)
  if (!page) throw new WordPressError('Essa página não está mais no canvas.')
  const built = buildLandingPage(pageSections(page, nodes), nodes, connections, getActiveBrand())
  return { page, ...built }
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

const SAVED_FIELDS = 'id,link,status,modified_gmt,title,slug,featured_media'

export async function publishPage({ connection, projectId, pageId, status, template, overwrite, onProgress }: PublishOptions): Promise<PublishResult> {
  const creds = credentialsOf(connection)
  const { page, elements } = pageElements(pageId)
  if (!elements.length) throw new WordPressError('A página não tem seção com JSON válido para publicar.')
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

  return {
    postId: final.id,
    link: final.link,
    editUrl: elementorEditUrl(connection, final.id),
    status: final.status,
    created: !link,
    uploaded: replacements.size,
    failedImages,
    cacheCleared,
    featured,
    seo,
    seoSupport,
    seoError,
  }
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
  return { restoredFrom: last.savedAt, cacheCleared, remaining: rest.length }
}
