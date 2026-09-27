import type { PageDetails } from '@/types/space'
import { credentialsOf } from './connect'
import { INDEX_FIELDS, wpRequest, WordPressError } from './rest'
import type { WordPressConnection } from './types'

/**
 * SEO da página pelo plugin que o site usa. O WordPress sozinho não tem
 * título nem descrição de SEO:
 * - SEOPress: campos `_seopress_titles_*` expostos na API de páginas.
 * - All in One SEO: rota própria `aioseo/v1/post`.
 * - Yoast: só expõe os campos na API para posts; em páginas, o plugin
 *   Superelements Connector (`public/wordpress/superelements-connector.zip`)
 *   libera os mesmos campos.
 */

export type SeoPlugin = 'yoast' | 'aioseo' | 'seopress'

export const SEO_PLUGIN_NAMES: Record<SeoPlugin, string> = {
  yoast: 'Yoast SEO',
  aioseo: 'All in One SEO',
  seopress: 'SEOPress',
}

export const CONNECTOR_ZIP = '/wordpress/superelements-connector.zip'

export interface SeoSupport {
  plugin: SeoPlugin | null
  /** Dá para gravar título e descrição daqui. */
  writable: boolean
  /** Grava a palavra-chave também. */
  keyword: boolean
  /** O que falta, quando não dá para gravar. */
  missing?: 'plugin' | 'connector'
}

/** Qual plugin de SEO o site usa, pelo que a API dele anuncia. */
export async function detectSeo(connection: WordPressConnection): Promise<SeoSupport> {
  const index = await wpRequest<{ namespaces?: string[] }>(credentialsOf(connection), '', { params: { _fields: INDEX_FIELDS } })
  const namespaces = new Set(index.namespaces ?? [])
  if (namespaces.has('yoast/v1')) {
    const connector = namespaces.has('superelements/v1')
    return { plugin: 'yoast', writable: connector, keyword: connector, missing: connector ? undefined : 'connector' }
  }
  if (namespaces.has('aioseo/v1')) return { plugin: 'aioseo', writable: true, keyword: true }
  if (namespaces.has('seopress/v1')) return { plugin: 'seopress', writable: true, keyword: false }
  return { plugin: null, writable: false, keyword: false, missing: 'plugin' }
}

type SeoFields = Pick<PageDetails, 'seoTitle' | 'description' | 'focusKeyword'>

const YOAST = { seoTitle: '_yoast_wpseo_title', description: '_yoast_wpseo_metadesc', focusKeyword: '_yoast_wpseo_focuskw' } as const
const SEOPRESS = { seoTitle: '_seopress_titles_title', description: '_seopress_titles_desc' } as const

interface AioseoPost {
  title?: string | null
  description?: string | null
  keyphrases?: { focus?: { keyphrase?: string } } & Record<string, unknown>
  [key: string]: unknown
}

async function aioseoPost(connection: WordPressConnection, postId: number) {
  const result = await wpRequest<{ data?: { currentPost?: AioseoPost } }>(credentialsOf(connection), 'aioseo/v1/post', {
    params: { postId: String(postId) },
  })
  return result.data?.currentPost ?? {}
}

/** Título, descrição e palavra-chave que a página tem hoje no plugin de SEO. */
export async function readSeo(connection: WordPressConnection, support: SeoSupport, postId: number): Promise<SeoFields> {
  if (!support.writable || !support.plugin) return {}
  if (support.plugin === 'aioseo') {
    const post = await aioseoPost(connection, postId)
    return { seoTitle: post.title || undefined, description: post.description || undefined, focusKeyword: post.keyphrases?.focus?.keyphrase || undefined }
  }
  const keys = support.plugin === 'yoast' ? YOAST : SEOPRESS
  const fields = Object.values(keys).map((k) => `meta.${k}`).join(',')
  const page = await wpRequest<{ meta?: Record<string, string> }>(credentialsOf(connection), `wp/v2/pages/${postId}`, {
    params: { context: 'edit', _fields: fields },
  })
  const meta = page.meta ?? {}
  const value = (key?: string) => (key && meta[key]) || undefined
  return { seoTitle: value(keys.seoTitle), description: value(keys.description), focusKeyword: value((keys as Partial<typeof YOAST>).focusKeyword) }
}

/** Grava o SEO da página no plugin. Campo vazio volta ao padrão do plugin. */
export async function writeSeo(connection: WordPressConnection, support: SeoSupport, postId: number, fields: SeoFields) {
  if (!support.writable || !support.plugin) throw new WordPressError('O site não tem plugin de SEO que aceite gravar daqui.')
  const creds = credentialsOf(connection)
  const seoTitle = fields.seoTitle?.trim() ?? ''
  const description = fields.description?.trim() ?? ''
  const focusKeyword = fields.focusKeyword?.trim() ?? ''

  if (support.plugin === 'aioseo') {
    // A rota regrava tudo o que recebe: vai o que a página já tem, com os três campos trocados
    const current = await aioseoPost(connection, postId)
    const keyphrases = { ...current.keyphrases, focus: { ...current.keyphrases?.focus, keyphrase: focusKeyword } }
    await wpRequest(creds, 'aioseo/v1/post', {
      method: 'POST',
      body: { ...current, id: postId, title: seoTitle, description, keyphrases },
    })
    return
  }

  const meta: Record<string, string> =
    support.plugin === 'yoast'
      ? { [YOAST.seoTitle]: seoTitle, [YOAST.description]: description, [YOAST.focusKeyword]: focusKeyword }
      : { [SEOPRESS.seoTitle]: seoTitle, [SEOPRESS.description]: description }
  await wpRequest(creds, `wp/v2/pages/${postId}`, { method: 'POST', params: { _fields: 'id' }, body: { meta } })
}
