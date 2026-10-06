import type { KitTypography } from '@/engine/elementor/types'
import type { PageDetails, PageWordPressLink, SectionNodeData } from '@/types/space'
import { credentialsOf } from './connect'
import { wpRequest, WordPressError } from './rest'
import { readSeo, type SeoSupport } from './seo'
import type { SiteKit } from './siteKitStore'
import type { WordPressConnection } from './types'

/**
 * Leitura do site do cliente: páginas, Kit do Elementor e logo. O conteúdo
 * das páginas vem de `meta._elementor_data`, que o Elementor expõe na API
 * desde a 3.28 (a 3.27 registrou os campos no tipo errado).
 */

export const ELEMENTOR_REST_VERSION = '3.28'

export interface SitePage {
  id: number
  title: string
  link: string
  status: string
  modifiedGmt: string
  /** Feita no Elementor; página do editor de blocos não tem seções para importar. */
  elementor: boolean
}

interface WpPage {
  id: number
  title?: { raw?: string; rendered?: string }
  slug?: string
  featured_media?: number
  link: string
  status: string
  modified_gmt: string
  meta?: { _elementor_edit_mode?: string; _elementor_data?: string }
}

const STATUSES = 'publish,future,draft,pending,private'
const LIST_FIELDS = 'id,title,link,status,modified_gmt,meta._elementor_edit_mode'

const decode = (html: string) => new DOMParser().parseFromString(html, 'text/html').documentElement.textContent ?? html

const titleOf = (page: WpPage) => (page.title?.raw ?? decode(page.title?.rendered ?? '')).trim() || `Página ${page.id}`

export interface SitePageList {
  pages: SitePage[]
  /** O Elementor do site não mostra o conteúdo das páginas na API (versão anterior à 3.28). */
  noElementorData: boolean
}

export async function listSitePages(connection: WordPressConnection): Promise<SitePageList> {
  const creds = credentialsOf(connection)
  const pages: WpPage[] = []
  for (let n = 1; n <= 20; n++) {
    let batch: WpPage[]
    try {
      batch = await wpRequest<WpPage[]>(creds, 'wp/v2/pages', {
        params: { context: 'edit', per_page: '100', page: String(n), status: STATUSES, orderby: 'modified', order: 'desc', _fields: LIST_FIELDS },
      })
    } catch (error) {
      // Passou da última página da listagem
      if (error instanceof WordPressError && error.code === 'rest_post_invalid_page_number') break
      throw error
    }
    pages.push(...batch)
    if (batch.length < 100) break
  }

  const noElementorData = pages.length > 0 && pages.every((p) => !p.meta || !('_elementor_edit_mode' in p.meta))
  return {
    noElementorData,
    pages: pages.map((p) => ({
      id: p.id,
      title: titleOf(p),
      link: p.link,
      status: p.status,
      modifiedGmt: p.modified_gmt,
      elementor: p.meta?._elementor_edit_mode === 'builder',
    })),
  }
}

type Element = Record<string, unknown> & { elements?: Element[]; settings?: Record<string, unknown> | unknown[] }

const isElement = (value: unknown): value is Element => !!value && typeof value === 'object' && !Array.isArray(value)

/** Primeiro título da seção, para o nome dela no canvas. */
function firstHeading(element: Element): string | null {
  if (element.widgetType === 'heading' && isElement(element.settings) && typeof element.settings.title === 'string') {
    const text = decode(element.settings.title).replace(/\s+/g, ' ').trim()
    if (text) return text.length > 60 ? `${text.slice(0, 57)}…` : text
  }
  for (const child of element.elements ?? []) {
    const found = isElement(child) ? firstHeading(child) : null
    if (found) return found
  }
  return null
}

export function parseElementorData(raw: string | undefined): Element[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data.filter(isElement) : []
  } catch {
    throw new WordPressError('O conteúdo do Elementor desta página não é um JSON válido.')
  }
}

/**
 * Seções do canvas a partir do JSON do Elementor de uma página ou modelo do
 * site: uma por bloco de topo, com os ids intactos (o CSS do Elementor usa
 * eles e a atualização devolve ao site).
 */
export function sectionsFromElementor(raw: string | undefined, siteUrl: string, postId: number): SectionNodeData[] {
  return parseElementorData(raw).map((element, index) => ({
    title: firstHeading(element) ?? `Seção ${index + 1}`,
    elementorJson: JSON.stringify([element]),
    origin: { kind: 'wordpress', siteUrl, postId },
  }))
}

/** O modelo salvo que a seção mostra, quando ela é só o widget Modelo do Elementor Pro (num container, ou numa seção com coluna). */
export function templateIdOf(section: SectionNodeData): number | null {
  let elements: Element[]
  try {
    elements = parseElementorData(section.elementorJson)
  } catch {
    return null
  }
  const widgets: Element[] = []
  const walk = (list: Element[]) => {
    for (const element of list) {
      if (element.elType === 'widget') widgets.push(element)
      else walk((element.elements ?? []).filter(isElement))
    }
  }
  walk(elements)
  if (widgets.length !== 1 || widgets[0].widgetType !== 'template' || !isElement(widgets[0].settings)) return null
  const id = Number(widgets[0].settings.template_id)
  return Number.isInteger(id) && id > 0 ? id : null
}

export interface ImportedPage {
  name: string
  sections: SectionNodeData[]
  link: PageWordPressLink
  details: PageDetails
}

/**
 * Uma página do site pronta para o canvas: uma seção por bloco de topo, com os
 * ids do Elementor intactos, e o título, o endereço, a imagem destacada e o SEO.
 */
export async function fetchSitePage(connection: WordPressConnection, id: number, seo?: SeoSupport): Promise<ImportedPage> {
  const creds = credentialsOf(connection)
  const page = await wpRequest<WpPage>(creds, `wp/v2/pages/${id}`, {
    params: { context: 'edit', _fields: 'id,title,slug,featured_media,link,status,modified_gmt,meta._elementor_data' },
  })
  const [featured, seoFields] = await Promise.all([
    page.featured_media
      ? wpRequest<{ id: number; source_url?: string }>(creds, `wp/v2/media/${page.featured_media}`, { params: { _fields: 'id,source_url' } }).catch(() => null)
      : null,
    // SEO que não abre não impede a página de vir
    seo ? readSeo(connection, seo, page.id).catch(() => ({})) : {},
  ])
  const { siteUrl } = connection.site
  const title = titleOf(page)
  return {
    name: title,
    sections: sectionsFromElementor(page.meta?._elementor_data, siteUrl, page.id),
    link: { siteUrl, postId: page.id, title, link: page.link, status: page.status, modifiedGmt: page.modified_gmt, syncedAt: Date.now() },
    details: {
      title,
      slug: page.slug || undefined,
      ...seoFields,
      featured: featured?.source_url ? { kind: 'media', id: featured.id, url: featured.source_url } : undefined,
    },
  }
}

interface WpGlobals {
  colors?: Record<string, { id: string; title?: string; value?: string }>
  typography?: Record<string, { id: string; title?: string; value?: Record<string, unknown> }>
}

const fontOf = (value: Record<string, unknown> = {}): KitTypography => ({
  family: typeof value.typography_font_family === 'string' ? value.typography_font_family : undefined,
  weight: typeof value.typography_font_weight === 'string' || typeof value.typography_font_weight === 'number' ? value.typography_font_weight : undefined,
})

/** Cores e fontes globais do Elementor do site. */
export async function fetchSiteKit(connection: WordPressConnection): Promise<SiteKit> {
  const globals = await wpRequest<WpGlobals>(credentialsOf(connection), 'elementor/v1/globals')
  const titles: Record<string, string> = {}
  const colors: Record<string, string> = {}
  for (const color of Object.values(globals.colors ?? {})) {
    if (!color.value) continue
    colors[color.id] = color.value
    titles[color.id] = color.title || color.id
  }
  const typography: Record<string, KitTypography> = {}
  for (const font of Object.values(globals.typography ?? {})) {
    typography[font.id] = fontOf(font.value)
    titles[`font:${font.id}`] = font.title || font.id
  }
  return { siteUrl: connection.site.siteUrl, colors, typography, titles, importedAt: Date.now() }
}

export interface SiteLogo {
  url: string
  alt?: string
}

/** Logo do site (Identidade do site no WordPress), se houver e o usuário puder ler. */
export async function fetchSiteLogo(connection: WordPressConnection): Promise<SiteLogo | null> {
  const creds = credentialsOf(connection)
  const settings = await wpRequest<{ site_logo?: number }>(creds, 'wp/v2/settings', { params: { _fields: 'site_logo' } }).catch(() => null)
  const index = settings?.site_logo ? null : await wpRequest<{ site_logo?: number }>(creds, '', { params: { _fields: 'site_logo' } }).catch(() => null)
  const id = settings?.site_logo || index?.site_logo
  if (!id) return null
  const media = await wpRequest<{ source_url?: string; alt_text?: string }>(creds, `wp/v2/media/${id}`, { params: { _fields: 'source_url,alt_text' } }).catch(
    () => null
  )
  return media?.source_url ? { url: media.source_url, alt: media.alt_text || undefined } : null
}

export interface SiteImage {
  id: number
  url: string
  thumb: string
  alt?: string
}

interface WpMedia {
  id: number
  source_url: string
  alt_text?: string
  media_details?: { sizes?: Record<string, { source_url?: string }> }
}

/** Imagens mais recentes da biblioteca de mídia do site. */
export async function listSiteImages(connection: WordPressConnection, count = 30): Promise<SiteImage[]> {
  const media = await wpRequest<WpMedia[]>(credentialsOf(connection), 'wp/v2/media', {
    params: { media_type: 'image', per_page: String(count), orderby: 'date', order: 'desc', _fields: 'id,source_url,alt_text,media_details.sizes' },
  })
  return media.map((m) => ({
    id: m.id,
    url: m.source_url,
    thumb: m.media_details?.sizes?.medium?.source_url ?? m.media_details?.sizes?.thumbnail?.source_url ?? m.source_url,
    alt: m.alt_text || undefined,
  }))
}
