/**
 * API REST de um WordPress, chamada direto do navegador. O WordPress responde
 * com CORS para qualquer origem, mas firewall e plugin de segurança podem
 * barrar: todo erro de rede vira uma mensagem que diz isso.
 */

export class WordPressError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number
  ) {
    super(message)
  }
}

/** O que o índice da API conta sobre o site. */
export interface WordPressSite {
  /** Endereço do site (home), sem barra no fim. */
  siteUrl: string
  /** Raiz da API: `…/wp-json/` ou, sem links permanentes, `…/?rest_route=/`. */
  restRoot: string
  name: string
  iconUrl?: string
  /** Tela de aprovação de senhas de aplicação; sem ela o site não aceita a conexão. */
  authorizeUrl?: string
  /** A API não responde a visitantes: a tela de aprovação é a do endereço padrão. */
  restricted?: boolean
  elementor: boolean
  elementorPro: boolean
}

export interface Credentials {
  restRoot: string
  userLogin: string
  password: string
}

// Hospedagem compartilhada lenta leva segundos por chamada, e cada chamada com senha tem antes a consulta de CORS
const TIMEOUT = 30_000

export const INDEX_FIELDS = 'name,home,namespaces,authentication,site_icon_url'

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/i
/** Caminhos do WordPress que costumam vir junto quando alguém cola o endereço. */
const WP_PATH = /\/(wp-admin|wp-login\.php|wp-json|index\.php)(\/.*)?$/i

/** Endereços onde procurar o WordPress: o caminho digitado (instalação em pasta) e a raiz. */
export function siteCandidates(input: string): string[] {
  let text = input.trim()
  if (!text) return []
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    const host = text.split(/[/?#]/)[0].replace(/:\d+$/, '')
    text = `${LOCAL_HOST.test(host) ? 'http' : 'https'}://${text}`
  }

  let url: URL
  try {
    url = new URL(text)
  } catch {
    return []
  }
  if (!/^https?:$/.test(url.protocol)) return []
  if (!url.hostname.includes('.') && !LOCAL_HOST.test(url.hostname)) return []

  const path = url.pathname.replace(WP_PATH, '').replace(/\/+$/, '')
  return [...new Set([url.origin + path, url.origin])]
}

export function restUrl(root: string, route: string, params: Record<string, string> = {}): string {
  const url = new URL(root)
  const path = route.replace(/^\/+/, '')
  if (url.searchParams.has('rest_route')) url.searchParams.set('rest_route', `/${path}`)
  else url.pathname = `${url.pathname.replace(/\/*$/, '/')}${path}`
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}

async function fetchJson(url: string, init: RequestInit = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    // Sem cookies: o login do WordPress aberto no navegador não se mistura com a senha de aplicação
    const response = await fetch(url, { ...init, credentials: 'omit', signal: controller.signal })
    const data = await response.json().catch(() => null)
    return { response, data }
  } finally {
    clearTimeout(timer)
  }
}

const networkError = (error: unknown, host: string) =>
  error instanceof DOMException && error.name === 'AbortError'
    ? new WordPressError(`${host} demorou demais para responder.`, 'timeout')
    : new WordPressError(
        `Não foi possível falar com ${host} pelo navegador. O site pode estar fora do ar ou bloqueando chamadas de outros endereços (firewall ou plugin de segurança).`,
        'network'
      )

const MESSAGES: Record<string, string> = {
  incorrect_password: 'O WordPress recusou a senha de aplicação. Confira se ela foi copiada inteira.',
  invalid_username: 'Esse usuário não existe no WordPress.',
  invalid_email: 'Esse e-mail não é de nenhum usuário do WordPress.',
  application_passwords_disabled: 'As senhas de aplicação estão desligadas neste site.',
  application_passwords_disabled_for_user: 'As senhas de aplicação estão desligadas para esse usuário.',
  // Veio sem login mesmo com o cabeçalho enviado. Com alguns plugins, senha errada também cai
  // aqui em vez de `incorrect_password`; ou o servidor não repassou o Authorization ao PHP
  rest_not_logged_in:
    'O WordPress não aceitou o login. Confira o usuário e a senha de aplicação. Se estiverem certos, o servidor pode não estar repassando o login ao WordPress (em hospedagem com Apache, isso pede uma regra no .htaccess).',
  rest_forbidden: 'Esse usuário não tem permissão para isso no WordPress.',
}

const stripTags = (text: string) => text.replace(/<[^>]+>/g, '').trim()

const responseError = (status: number, data: unknown) => {
  const body = (data ?? {}) as { code?: string; message?: string }
  const message = (body.code && MESSAGES[body.code]) || (body.message && stripTags(String(body.message))) || `O WordPress respondeu com erro ${status}.`
  return new WordPressError(message, body.code, status)
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

const basicAuth = (login: string, password: string) => {
  // btoa só aceita Latin-1; usuário com acento vai em UTF-8, como o PHP espera
  let binary = ''
  new TextEncoder().encode(`${login}:${password}`).forEach((byte) => (binary += String.fromCharCode(byte)))
  return `Basic ${btoa(binary)}`
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  params?: Record<string, string>
  body?: unknown
}

/** Chamada autenticada com a senha de aplicação. */
export async function wpRequest<T>(creds: Credentials, route: string, { method = 'GET', params = {}, body }: RequestOptions = {}): Promise<T> {
  // Método de verdade, sem `_method`: o WordPress aplica o `_method` também à consulta
  // prévia de CORS, que vai sem login, e a recusa bloqueia a chamada
  const url = restUrl(creds.restRoot, route, params)
  const headers: Record<string, string> = { Accept: 'application/json', Authorization: basicAuth(creds.userLogin, creds.password) }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let result: Awaited<ReturnType<typeof fetchJson>>
  try {
    result = await fetchJson(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch (error) {
    throw networkError(error, hostOf(creds.restRoot))
  }
  if (!result.response.ok) throw responseError(result.response.status, result.data)
  return result.data as T
}

/** Envia um arquivo para a biblioteca de mídia e devolve o anexo criado. */
export async function wpUpload(creds: Credentials, blob: Blob, fileName: string): Promise<{ id: number; source_url: string }> {
  let result: Awaited<ReturnType<typeof fetchJson>>
  try {
    result = await fetchJson(restUrl(creds.restRoot, 'wp/v2/media'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: basicAuth(creds.userLogin, creds.password),
        'Content-Type': blob.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
      body: blob,
    })
  } catch (error) {
    throw networkError(error, hostOf(creds.restRoot))
  }
  if (!result.response.ok) throw responseError(result.response.status, result.data)
  return result.data as { id: number; source_url: string }
}

export interface WpIndex {
  name?: string
  home?: string
  namespaces?: string[]
  authentication?: { 'application-passwords'?: { endpoints?: { authorization?: string } } }
  site_icon_url?: string
}

const decodeEntities = (text: string) => new DOMParser().parseFromString(text, 'text/html').documentElement.textContent ?? text

/** Junta o índice da API com o endereço de onde ele veio. */
export function siteFromIndex(index: WpIndex, restRoot: string, fallbackUrl: string): WordPressSite {
  const namespaces = index.namespaces ?? []
  const siteUrl = (index.home || fallbackUrl).replace(/\/+$/, '')
  return {
    siteUrl,
    restRoot,
    name: index.name ? decodeEntities(index.name) : hostOf(siteUrl),
    iconUrl: index.site_icon_url || undefined,
    authorizeUrl: index.authentication?.['application-passwords']?.endpoints?.authorization,
    elementor: namespaces.includes('elementor/v1'),
    elementorPro: namespaces.includes('elementor-pro/v1'),
  }
}

/** Raiz da API a partir do endereço final da resposta, já depois de redirecionamentos (http → https, www). */
const rootFrom = (finalUrl: string, byQuery: boolean) => {
  const url = new URL(finalUrl)
  url.search = ''
  url.hash = ''
  if (byQuery) url.searchParams.set('rest_route', '/')
  return url.toString()
}

const isIndex = (data: unknown): data is WpIndex =>
  !!data && typeof data === 'object' && Array.isArray((data as WpIndex).namespaces) && (data as WpIndex).namespaces!.includes('wp/v2')

/** Resposta de erro da própria API REST: é WordPress, mas fechado para visitantes. */
const isRestError = (data: unknown) => !!data && typeof data === 'object' && typeof (data as { code?: unknown }).code === 'string'

/** Procura a API do WordPress no endereço digitado. */
export async function discoverSite(input: string): Promise<WordPressSite> {
  const bases = siteCandidates(input)
  if (!bases.length) throw new WordPressError('Digite o endereço do site, como cliente.com.br.', 'invalid_url')

  for (const base of bases) {
    for (const byQuery of [false, true]) {
      const root = byQuery ? `${base}/?rest_route=/` : `${base}/wp-json/`
      const result = await fetchJson(restUrl(root, '', { _fields: INDEX_FIELDS })).catch(() => null)
      if (!result) continue
      const restRoot = rootFrom(result.response.url || root, byQuery)
      if (result.response.ok && isIndex(result.data)) return siteFromIndex(result.data, restRoot, base)
      if (!byQuery && isRestError(result.data)) {
        const home = restRoot.replace(/\/wp-json\/?$/, '')
        return {
          ...siteFromIndex({}, restRoot, home),
          authorizeUrl: `${home}/wp-admin/authorize-application.php`,
          restricted: true,
        }
      }
    }
  }

  const host = hostOf(bases[0])
  throw new WordPressError(
    `Não encontramos a API do WordPress em ${host}. Confira o endereço; se estiver certo, o site pode estar bloqueando a API REST ou chamadas de outros sites.`,
    'not_found'
  )
}

/** Por que o site não aceita a conexão, quando não aceita. */
export function unsupportedReason(site: WordPressSite): string | null {
  if (site.authorizeUrl) return null
  return site.siteUrl.startsWith('http:')
    ? 'O site não usa HTTPS, e o WordPress só libera senhas de aplicação com HTTPS.'
    : 'As senhas de aplicação estão desligadas neste site. Algum plugin de segurança costuma fazer isso.'
}
