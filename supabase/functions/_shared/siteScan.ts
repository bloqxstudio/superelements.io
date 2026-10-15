/**
 * Leitura de um site: abre a primeira página, descobre a plataforma
 * (WordPress, Elementor e versões, outro construtor ou nada), o tema, o
 * contato, quem fez o site e os rastros de anúncio. O diagnóstico
 * (`diagnoseSite`) soma o que a página mostra ao Google e ao celular, os
 * plugins e o que o próprio WordPress conta pela API pública.
 *
 * Roda em três lugares, por isso só usa o que existe no Node e no Deno
 * (fetch, URL, TextDecoder) e não importa nada: o motor da prospecção
 * (`scripts/prospects/engine.ts`, Node), o servidor de dev
 * (`scripts/prospects/vitePlugin.ts`) e a função `site-diagnostico` do
 * Supabase, que atende o app publicado. Os tipos daqui são os da tela
 * (`src/features/prospects/types.ts` os repassa).
 */

/** O que o site da empresa é, do melhor encaixe para o Superelements ao pior. */
export type Platform =
  | 'wp-elementor'
  | 'wordpress'
  | 'construtor'
  | 'outro'
  | 'sem-site'
  | 'fora-do-ar'
  | 'indefinido'

/** O que a primeira página do site mostrou. */
export interface SiteScan {
  /** Endereço final, depois dos redirecionamentos. */
  url: string
  status: number | null
  error?: string
  https: boolean
  ms: number
  platform: Platform
  /** Elementor, WPBakery, Divi, Wix, Instagram, Doctoralia… */
  builder?: string
  wpVersion?: string
  elementorVersion?: string
  elementorPro?: boolean
  theme?: string
  title?: string
  emails: string[]
  phones: string[]
  whatsapp?: string
  instagram?: string
  facebook?: string
  linkedin?: string
  /** Crédito do rodapé ("Desenvolvido por …"): a agência que fez o site. */
  agency?: { name: string; url?: string }
  copyrightYear?: number
  viewport: boolean
  /** Rastros de anúncio pago na página: tag de conversão do Google Ads, pixel da Meta… (sinal de que investe em trazer gente). */
  ads?: string[]
  /** Ferramentas de venda no site: agenda online, checkout de programa ou curso, loja. */
  sales?: string[]
}

/** O que a página inicial mostra além da plataforma: o básico que o Google e o celular olham. */
export interface SiteChecks {
  /** Versão do PHP, quando o servidor conta no cabeçalho `x-powered-by`. */
  php?: string
  /** Descrição para o Google (`meta description`), quando há. */
  description?: string
  /** Títulos principais (`h1`) da página. */
  h1: number
  /** Imagem que aparece quando o link é compartilhado (`og:image`). */
  shareImage: boolean
  favicon: boolean
  /** Imagens da página e quantas estão sem texto alternativo. */
  images: number
  imagesWithoutAlt: number
  /** Tamanho do HTML da página inicial, em KB. */
  htmlKb: number
}

/** O que o próprio WordPress conta pela API pública (`/wp-json`). */
export interface WordPressInfo {
  /** A API pública respondeu (alguns sites a fecham por segurança). */
  api: boolean
  name?: string
  tagline?: string
  /** Páginas e posts publicados (cabeçalho `X-WP-Total`); vazio quando a API não conta. */
  pages?: number
  posts?: number
}

export interface SiteDiagnosis {
  scan: SiteScan
  /** Só quando a página abriu. */
  checks?: SiteChecks
  /** Plugins que aparecem na página ou na API: o nome conhecido, ou a pasta do plugin. */
  plugins: string[]
  /** Só em WordPress. */
  wordpress?: WordPressInfo
  /** ISO */
  checkedAt: string
}

/** Checagem extra de cada endereço antes de abrir: a função do Supabase confere para onde o DNS aponta. */
export type HostGuard = (host: string) => Promise<boolean>

/** Os sites recebem um navegador comum: muitos recusam robôs sem nome. */
export const BROWSER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const SITE_TIMEOUT = 12_000
const API_TIMEOUT = 8_000
const MAX_HTML = 1_500_000
const MAX_JSON = 2_000_000

// ---------------------------------------------------------------- site

/** Endereços que não são site próprio: perfil em rede social, diretório ou link na bio. */
const PROFILES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(facebook|fb)\.com$/, 'Facebook'],
  [/(^|\.)linktr\.ee$/, 'Linktree'],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, 'WhatsApp'],
  [/(^|\.)linkedin\.com$/, 'LinkedIn'],
  [/(^|\.)youtube\.com$/, 'YouTube'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)doctoralia\.com\.br$/, 'Doctoralia'],
  [/(^|\.)boaconsulta\.com$/, 'BoaConsulta'],
  [/(^|\.)jusbrasil\.com\.br$/, 'Jusbrasil'],
  [/(^|\.)(bio\.site|beacons\.ai|taplink\.cc|linkme\.bio|campsite\.bio)$/, 'link na bio'],
  [/(^|\.)(business\.site|g\.page)$/, 'perfil do Google'],
  [/(^|\.)ifood\.com\.br$/, 'iFood'],
]

export const profileOf = (host: string) => PROFILES.find(([test]) => test.test(host))?.[1]

/** Construtores fora do WordPress, pelo rastro que deixam na página. */
const BUILDERS: [RegExp, string][] = [
  [/static\.wixstatic\.com|wix\.com website builder|x-wix-/i, 'Wix'],
  [/static1\.squarespace\.com|squarespace-cdn|<!-- this is squarespace/i, 'Squarespace'],
  [/data-wf-site|website-files\.com|webflow\.js/i, 'Webflow'],
  [/cdn\.shopify\.com|shopify\.theme/i, 'Shopify'],
  [/zyrosite|zyro\.com|hostinger (ai |website )?builder/i, 'Hostinger Builder'],
  [/img1\.wsimg\.com|godaddy website builder|starfield technologies/i, 'GoDaddy'],
  [/cdn-website\.com|dudaone|duda\.co/i, 'Duda'],
  [/framerusercontent\.com|generator" content="framer/i, 'Framer'],
  [/editmysite\.com|weebly/i, 'Weebly'],
  [/webnode/i, 'Webnode'],
  [/site123|cdn-cms\.com/i, 'SITE123'],
  [/jimdo/i, 'Jimdo'],
  [/nuvemshop|lojavirtualnuvem|tiendanube/i, 'Nuvemshop'],
  [/tray\.com\.br|traycdn/i, 'Tray'],
  [/lojaintegrada/i, 'Loja Integrada'],
  [/sites\.google\.com|gstatic\.com\/atari/i, 'Google Sites'],
]

/** Tecnologias de site próprio fora de construtores. */
const STACKS: [RegExp, string][] = [
  [/generator" content="joomla/i, 'Joomla'],
  [/generator" content="drupal|\/sites\/default\/files\//i, 'Drupal'],
  [/__NEXT_DATA__|\/_next\/static\//, 'Next.js'],
  [/__NUXT__|\/_nuxt\//, 'Nuxt'],
  [/data-reactroot|id="root"><\/div>/, 'React'],
]

/** Construtores dentro do WordPress (além do Elementor). */
const WP_BUILDERS: [RegExp, string][] = [
  [/js_composer|wpbakery|class="[^"]*\bvc_row/i, 'WPBakery'],
  [/et_pb_|\/themes\/divi\//i, 'Divi'],
  [/fusion-builder|\/themes\/avada\//i, 'Avada'],
  [/fl-builder/i, 'Beaver Builder'],
  [/brxe-|\/themes\/bricks\//i, 'Bricks'],
  [/ct-section|oxygen-/i, 'Oxygen'],
  [/\/plugins\/kadence-blocks\/|\/plugins\/spectra|uagb-/i, 'blocos (Gutenberg)'],
]

/** Créditos de rodapé que não são agência: o próprio WordPress, temas e hospedagens. */
const VENDORS = /wordpress\.(org|com)|elementor\.com|wix\.com|hostinger|godaddy|wpastra|themeisle|generatepress|oceanwp|kadence|envato|themeforest|uxthemes|elegantthemes|google\.|facebook\.|instagram\.|wa\.me|whatsapp|locaweb|hostgator|umbler/i

const stripTags = (html: string) =>
  html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/<[^>]*$/, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

/** Não deixa um endereço apontar para a rede deste computador (ou do servidor). */
export const isPublicHost = (host: string) => {
  const bare = host.replace(/^\[|\]$/g, '')
  if (!bare || bare === 'localhost' || bare.endsWith('.local') || bare.endsWith('.internal')) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bare)) return !/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(bare)
  if (bare.includes(':')) return !/^(::1?$|::ffff:|f[cd]|fe80)/i.test(bare)
  return true
}

export const formatPhone = (raw: string) => {
  let digits = raw.replace(/\D/g, '')
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2)
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return raw.trim()
}

interface Page {
  url: string
  status: number
  html: string
  headers: Headers
  ms: number
}

const readBody = async (response: Response, accept = /html|xml|text/i, max = MAX_HTML) => {
  const type = response.headers.get('content-type') ?? ''
  if (type && !accept.test(type)) {
    await response.body?.cancel()
    return ''
  }
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < max) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.length
  }
  await reader.cancel().catch(() => {})
  const charset = /charset=([\w-]+)/i.exec(type)?.[1]?.toLowerCase()
  const decoder = new TextDecoder(charset && /8859|1252|latin/.test(charset) ? 'windows-1252' : 'utf-8')
  const all = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    all.set(chunk, at)
    at += chunk.length
  }
  return decoder.decode(all)
}

/** Abre o endereço seguindo os redirecionamentos um a um (cada destino passa pela checagem de rede). */
const open = async (start: string, accept: string, signal: AbortSignal, guard?: HostGuard) => {
  let url = start
  for (let hop = 0; hop < 6; hop++) {
    const host = new URL(url).hostname
    if (!isPublicHost(host) || (guard && !(await guard(host)))) throw Object.assign(new Error('endereço interno'), { code: 'PRIVATE' })
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': BROWSER_AGENT, accept, 'accept-language': 'pt-BR,pt;q=0.9' },
      signal,
    })
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel()
      url = new URL(location, url).toString()
      continue
    }
    return { url, response }
  }
  throw Object.assign(new Error('redirecionamentos demais'), { code: 'REDIRECTS' })
}

const fetchPage = async (start: string, signal?: AbortSignal, guard?: HostGuard): Promise<Page> => {
  const began = Date.now()
  const timeout = AbortSignal.timeout(SITE_TIMEOUT)
  const { url, response } = await open(start, 'text/html,application/xhtml+xml', signal ? AbortSignal.any([signal, timeout]) : timeout, guard)
  const html = await readBody(response)
  return { url, status: response.status, html, headers: response.headers, ms: Date.now() - began }
}

const errorText = (error: unknown): string => {
  const err = error as { cause?: { code?: string }; code?: string; name?: string; message?: string } | undefined
  const code = err?.cause?.code ?? err?.code ?? err?.name
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'o domínio não existe mais'
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'UND_ERR_SOCKET') return 'o servidor recusou a conexão'
  if (code === 'TimeoutError' || code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'UND_ERR_HEADERS_TIMEOUT') return 'não respondeu em 12 s'
  if (/CERT|SSL|TLS/i.test(String(code))) return 'certificado de segurança inválido'
  return err?.message ?? 'erro desconhecido'
}

const firstMatch = (html: string, regex: RegExp) => regex.exec(html)?.[1]

const decodeCfEmail = (hex: string) => {
  const key = parseInt(hex.slice(0, 2), 16)
  let email = ''
  for (let i = 2; i < hex.length; i += 2) email += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key)
  return email
}

const BAD_EMAIL = /\.(png|jpe?g|gif|webp|svg|css|js)$|sentry|wixpress|example|exemplo|domain\.|dominio\.|seuemail|seu-?email|yourdomain|@email\.com|@empresa\.com|seudominio|fulano|^nome@|u00|wordpress\.|elementor\./i

/** E-mails, telefones e redes da página; os do domínio do site vêm primeiro. */
const contactsOf = (html: string, siteHost: string) => {
  const emails = new Set<string>()
  // E-mail escondido pelo Cloudflare
  for (const m of html.matchAll(/data-cfemail="([0-9a-f]+)"|email-protection#([0-9a-f]+)/gi)) emails.add(decodeCfEmail(m[1] ?? m[2]))
  for (const [email] of html.matchAll(/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi)) {
    // Link quebrado ("http://mailtofulano@…") ou escapado: fica só o endereço
    emails.add(email.toLowerCase().replace(/^(?:mailto|%3a|u003a|:)+/, ''))
  }
  const domain = siteHost.split('.').slice(-3).join('.')
  const list = [...emails]
    .filter((e) => !BAD_EMAIL.test(e) && e.length < 80)
    .sort((a, b) => Number(b.endsWith(domain)) - Number(a.endsWith(domain)))
    .slice(0, 5)

  const phones = new Set<string>()
  for (const [, tel] of html.matchAll(/href=["']tel:([^"']+)["']/gi)) {
    const digits = decodeURIComponent(tel).replace(/\D/g, '')
    if (digits.length >= 10) phones.add(formatPhone(digits))
  }
  const wa = firstMatch(html, /(?:wa\.me\/|whatsapp\.com\/send\/?\?(?:[^"']*?&(?:amp;)?)?phone=)\+?(\d{10,13})/i)
  const instagram = [...html.matchAll(/instagram\.com\/([A-Za-z0-9_.]{2,30})/g)]
    .map((m) => m[1])
    .find((handle) => !/^(p|reel|reels|explore|accounts|stories|tv|sharer|share|direct|developer|about)$/i.test(handle))
  const facebook = [...html.matchAll(/facebook\.com\/([A-Za-z0-9_.-]{2,60})/g)]
    .map((m) => m[1])
    .find((page) => !/^(sharer|sharer\.php|tr|plugins|dialog|share|profile\.php|v\d|groups|events|watch)$/i.test(page))
  const linkedin = firstMatch(html, /linkedin\.com\/((?:company|in)\/[A-Za-z0-9_%-]+)/)
  return {
    emails: list,
    phones: [...phones].slice(0, 3),
    whatsapp: wa ? formatPhone(wa) : undefined,
    instagram: instagram ? `@${instagram.replace(/\.$/, '')}` : undefined,
    facebook: facebook ? `https://www.facebook.com/${facebook}` : undefined,
    linkedin: linkedin ? `https://www.linkedin.com/${linkedin}` : undefined,
  }
}

/** "Desenvolvido por …" no rodapé: o link logo depois da frase (ou o link que a contém). */
const agencyOf = (html: string, siteHost: string): SiteScan['agency'] => {
  const phrase = /(?:desenvolvido|criado|feito|produzido|programado|developed|designed|made|site|design)\s+(?:com\s+\S+\s+)?(?:por|by)\s*:?|(?:desenvolvimento|criação|design)\s*:/gi
  for (const match of html.matchAll(phrase)) {
    const at = match.index ?? 0
    const before = html.slice(Math.max(0, at - 300), at)
    if (/<[^>]*$/.test(before)) continue // dentro de um atributo
    const after = html.slice(at + match[0].length, at + match[0].length + 600)

    let href: string | undefined
    let name: string | undefined
    const openAnchor = /<a\b[^>]*href=["']([^"']+)["'][^>]*>(?:(?!<\/a>)[\s\S])*$/i.exec(before)
    if (openAnchor) {
      href = openAnchor[1]
      name = stripTags(after.split(/<\/a>/i)[0])
    } else {
      const next = /^(?:\s|&nbsp;|&#160;|<(?!a\b)[^>]+>){0,12}<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]{0,400}?)<\/a>/i.exec(after)
      if (next) {
        href = next[2]
        const inner = next[4]
        name = stripTags(inner) || firstMatch(inner, /alt=["']([^"']+)["']/i) || firstMatch(next[1] + next[3], /title=["']([^"']+)["']/i)
      } else if (/^(desenvolvido|criado|desenvolvimento|criação)/i.test(match[0])) {
        name = stripTags(after).split(/[.|©·•\-–—]|\s{2,}/)[0]
      }
    }
    if (href && !/^https?:/i.test(href)) href = undefined
    const host = href ? hostOf(href) : ''
    if (host && (host === siteHost || siteHost.endsWith(`.${host}`) || VENDORS.test(host))) continue
    name = name?.replace(/\s+/g, ' ').trim()
    if (!name && host) name = host
    if (!name || name.length < 2 || name.length > 48 || VENDORS.test(name) || /^(wordpress|elementor|nós|nos|você)$/i.test(name)) continue
    return { name, url: href }
  }
  return undefined
}

const copyrightOf = (text: string, now: Date) => {
  let year: number | undefined
  for (const match of text.matchAll(/(?:©|\(c\)|copyright)\s*(?:[^\d]{0,40}?)?(?:(?:19|20)\d{2}\s*[-–—]\s*)?((?:19|20)\d{2})/gi)) {
    const value = Number(match[1])
    if (value <= now.getFullYear() && (!year || value > year)) year = value
  }
  return year
}

/** Lê o que a página diz sobre a plataforma, a versão, o tema e o contato. */
export const detect = (page: Page, now = new Date()): Omit<SiteScan, 'ms' | 'status' | 'url' | 'https'> => {
  const { html, headers } = page
  const host = hostOf(page.url)
  const generators = [...html.matchAll(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*name=["']generator["']/gi)].map(
    (m) => m[1] ?? m[2]
  )
  const generator = generators.join(' ; ')
  const linkHeader = headers.get('link') ?? ''
  const isWp = /\/wp-content\/|\/wp-includes\/|\/wp-json\//i.test(html) || /WordPress/i.test(generator) || /api\.w\.org/.test(linkHeader)
  const hasElementor =
    isWp && (/\/plugins\/elementor\/|elementor-kit-\d+|data-elementor-type|class="[^"]*\belementor-(section|element|widget)\b/i.test(html) || /Elementor/.test(generator))

  // Só versões com ponto: alguns sites trocam o ?ver= por um hash
  const wpVersion =
    firstMatch(generator, /WordPress\s+(\d+\.\d+(?:\.\d+)?)/i) ??
    firstMatch(html, /wp-includes\/css\/dist\/block-library\/style(?:\.min)?\.css\?ver=(\d+\.\d+(?:\.\d+)?)(?![\w.])/i) ??
    firstMatch(html, /wp-emoji-release\.min\.js\?ver=(\d+\.\d+(?:\.\d+)?)(?![\w.])/i)
  const elementorVersion = hasElementor
    ? // Só css/js do próprio Elementor: as bibliotecas em assets/lib têm a versão delas
      firstMatch(generator, /Elementor\s+(\d+\.\d+(?:\.\d+)?)/i) ?? firstMatch(html, /\/plugins\/elementor\/assets\/(?:css|js)\/[^"'?]+\?ver=(\d+\.\d+(?:\.\d+)?)(?![\w.])/i)
    : undefined
  const elementorPro = hasElementor && /\/plugins\/elementor-pro\//i.test(html)
  const theme = isWp ? firstMatch(html, /\/wp-content\/themes\/([a-z0-9_-]+)\//i) : undefined

  let platform: SiteScan['platform']
  let builder: string | undefined
  if (hasElementor) {
    platform = 'wp-elementor'
    builder = elementorPro ? 'Elementor Pro' : 'Elementor'
  } else if (isWp) {
    platform = 'wordpress'
    builder = WP_BUILDERS.find(([test]) => test.test(html) || test.test(generator))?.[1]
  } else {
    const found = BUILDERS.find(([test]) => test.test(html) || test.test(generator) || [...headers.keys()].some((k) => test.test(k)))?.[1]
    if (found) {
      platform = 'construtor'
      builder = found
    } else {
      platform = 'outro'
      builder = STACKS.find(([test]) => test.test(html) || test.test(generator))?.[1]
    }
  }

  const text = stripTags(html)
  return {
    platform,
    builder,
    wpVersion: isWp ? wpVersion : undefined,
    elementorVersion,
    elementorPro: elementorPro || undefined,
    theme,
    title: stripTags(firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? '').slice(0, 140) || undefined,
    ...contactsOf(html, host),
    agency: agencyOf(html, host),
    copyrightYear: copyrightOf(text.slice(-4000), now),
    viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    ads: adsOf(html),
    sales: salesOf(html),
  }
}

/**
 * Rastros de anúncio pago. Quem anuncia já paga para trazer gente ao site:
 * é quem mais tende a comprar um site melhor. A tag só diz que está
 * instalada; se o anúncio está no ar, confere-se na biblioteca de anúncios.
 */
const AD_TRACES: [RegExp, string][] = [
  [/\bAW-\d{6,}|googleadservices\.com\/pagead\/conversion|google_conversion_id/, 'Google Ads'],
  [/connect\.facebook\.net\/[\w_]+\/fbevents\.js|fbq\(\s*['"]init['"]/, 'Pixel da Meta'],
  [/analytics\.tiktok\.com\/i18n\/pixel|ttq\.load\(/, 'Pixel do TikTok'],
  [/snap\.licdn\.com\/li\.lms-analytics|_linkedin_partner_id/, 'LinkedIn Ads'],
]

/** O Tag Manager pode carregar tags de anúncio que não aparecem na página: sinal fraco. */
const TAG_MANAGER = /googletagmanager\.com\/gtm\.js|\bGTM-[A-Z0-9]{4,}\b/

/** Ferramentas de venda: agenda online (inclusive as de nutrição), checkout de curso ou programa, loja. */
const SALES_TOOLS: [RegExp, string][] = [
  [/dietbox\.me|dietbox\.com\.br/i, 'Agenda online (Dietbox)'],
  [/webdiet\.com\.br/i, 'Agenda online (WebDiet)'],
  [/nutrium\.(com|io)/i, 'Agenda online (Nutrium)'],
  [/calendly\.com\//i, 'Agenda online (Calendly)'],
  [/doctoralia\.com\.br\/[^"']*(widget|agendar)|widgets\.doctoralia/i, 'Agenda online (Doctoralia)'],
  [/simplybook\.(me|it)|\/plugins\/ameliabooking\/|\/plugins\/bookly/i, 'Agenda online'],
  [/(pay|go)\.hotmart\.com|hotmart\.com\/product/i, 'Curso ou programa (Hotmart)'],
  [/pay\.kiwify\.com|kiwify\.app/i, 'Curso ou programa (Kiwify)'],
  [/sun\.eduzz\.com|eduzz\.com\//i, 'Curso ou programa (Eduzz)'],
  [/monetizze\.com\.br|payment\.ticto|greenn\.com\.br|braip\.com/i, 'Curso ou programa'],
  [/\/plugins\/woocommerce\//i, 'Loja (WooCommerce)'],
]

const adsOf = (html: string) => {
  const found = AD_TRACES.filter(([test]) => test.test(html)).map(([, label]) => label)
  return found.length || !TAG_MANAGER.test(html) ? found : ['Tag Manager']
}
const salesOf = (html: string) => [...new Set(SALES_TOOLS.filter(([test]) => test.test(html)).map(([, label]) => label))]

const PARKED = /for sale|à venda|a venda|suspended|suspens|em constru|coming soon|index of \/|default page|página padrão|parked|site em manuten|under construction/i

/** A leitura e a página que a deu (sem página quando o site não abriu ou não é site próprio). */
const readSite = async (website: string, signal?: AbortSignal, guard?: HostGuard): Promise<{ scan: SiteScan; page?: Page }> => {
  const start = /^https?:\/\//i.test(website) ? website.trim() : `https://${website.trim()}`
  const base = { url: start, emails: [], phones: [], viewport: false, https: start.startsWith('https:'), ms: 0 }
  const profile = profileOf(hostOf(start))
  if (profile) {
    const handle = profile === 'Instagram' ? /instagram\.com\/([A-Za-z0-9_.]+)/.exec(start)?.[1] : undefined
    return { scan: { ...base, status: null, platform: 'sem-site', builder: profile, instagram: handle ? `@${handle}` : undefined } }
  }

  let page: Page
  let certError: string | undefined
  try {
    page = await fetchPage(start, signal, guard)
  } catch (error) {
    if (signal?.aborted) throw error
    const message = errorText(error)
    // Certificado vencido: tenta sem o cadeado para ainda descobrir a plataforma
    if (message.startsWith('certificado') && start.startsWith('https:')) {
      try {
        page = await fetchPage(start.replace(/^https:/i, 'http:'), signal, guard)
        certError = 'certificado de segurança inválido'
      } catch {
        return { scan: { ...base, status: null, platform: 'fora-do-ar', error: message } }
      }
    } else {
      return { scan: { ...base, status: null, platform: 'fora-do-ar', error: message } }
    }
  }

  const finalProfile = profileOf(hostOf(page.url))
  if (finalProfile) return { scan: { ...base, url: page.url, status: page.status, ms: page.ms, platform: 'sem-site', builder: finalProfile } }

  const found = detect(page)
  let scan: SiteScan = { ...found, url: page.url, status: page.status, ms: page.ms, https: page.url.startsWith('https:') && !certError, error: certError }

  if (page.status >= 400 && found.platform === 'outro' && !found.builder) {
    const blocked = page.status === 401 || page.status === 403 || page.status === 429 || /cf-chl|just a moment|captcha/i.test(page.html)
    scan = { ...scan, platform: blocked ? 'indefinido' : 'fora-do-ar', error: blocked ? `bloqueou a leitura (${page.status})` : `erro ${page.status}` }
  } else if (found.title && PARKED.test(found.title) && found.platform !== 'wp-elementor') {
    scan = { ...scan, platform: 'fora-do-ar', error: 'página parada (em construção, suspensa ou à venda)' }
  }

  // Sem e-mail na primeira página: a página de contato costuma ter
  if (!scan.emails.length && scan.status && scan.status < 400) {
    const href = firstMatch(page.html, /href=["']([^"'#]*(?:contato|contact|fale-conosco|fale_conosco)[^"'#]*)["']/i)
    if (href) {
      try {
        const contactUrl = new URL(href, page.url)
        if (hostOf(contactUrl.toString()) === hostOf(page.url)) {
          const contact = await fetchPage(contactUrl.toString(), signal, guard)
          const more = contactsOf(contact.html, hostOf(page.url))
          scan = {
            ...scan,
            emails: more.emails,
            phones: scan.phones.length ? scan.phones : more.phones,
            whatsapp: scan.whatsapp ?? more.whatsapp,
            instagram: scan.instagram ?? more.instagram,
          }
        }
      } catch {
        // Sem a página de contato, fica o que a primeira página deu
      }
    }
  }
  return { scan, page }
}

/** Abre o site da empresa e lê o que ele usa. Nunca lança: o erro vira parte da leitura. */
export const scanSite = async (website: string, signal?: AbortSignal, guard?: HostGuard): Promise<SiteScan> => (await readSite(website, signal, guard)).scan

// ---------------------------------------------------------------- diagnóstico

/** Pasta do plugin (`/wp-content/plugins/<pasta>/`) → nome que o dono reconhece. */
const PLUGIN_NAMES: Record<string, string> = {
  elementor: 'Elementor',
  'elementor-pro': 'Elementor Pro',
  'pro-elements': 'PRO Elements',
  'jet-engine': 'JetEngine',
  'jet-elements': 'JetElements',
  'essential-addons-for-elementor-lite': 'Essential Addons',
  'header-footer-elementor': 'Header & Footer Builder',
  'happy-elementor-addons': 'Happy Addons',
  'elementskit-lite': 'ElementsKit',
  'premium-addons-for-elementor': 'Premium Addons',
  'ultimate-elementor': 'Ultimate Addons',
  'royal-elementor-addons': 'Royal Addons',
  'unlimited-elements-for-elementor': 'Unlimited Elements',
  js_composer: 'WPBakery',
  revslider: 'Slider Revolution',
  'contact-form-7': 'Contact Form 7',
  'wpforms-lite': 'WPForms',
  wpforms: 'WPForms',
  fluentform: 'Fluent Forms',
  gravityforms: 'Gravity Forms',
  'ninja-forms': 'Ninja Forms',
  'wordpress-seo': 'Yoast SEO',
  'seo-by-rank-math': 'Rank Math',
  'all-in-one-seo-pack': 'All in One SEO',
  'wp-seopress': 'SEOPress',
  woocommerce: 'WooCommerce',
  'creame-whatsapp-me': 'Joinchat',
  'click-to-chat-for-whatsapp': 'Click to Chat',
  'wp-rocket': 'WP Rocket',
  'litespeed-cache': 'LiteSpeed Cache',
  'w3-total-cache': 'W3 Total Cache',
  'wp-super-cache': 'WP Super Cache',
  'wp-fastest-cache': 'WP Fastest Cache',
  autoptimize: 'Autoptimize',
  jetpack: 'Jetpack',
  'google-site-kit': 'Site Kit do Google',
  'duracelltomi-google-tag-manager': 'GTM4WP',
  pixelyoursite: 'PixelYourSite',
  'complianz-gdpr': 'Complianz',
  'cookie-law-info': 'CookieYes',
  'cookie-notice': 'Cookie Notice',
  'really-simple-ssl': 'Really Simple SSL',
  wordfence: 'Wordfence',
  'wp-smushit': 'Smush',
  'ewww-image-optimizer': 'EWWW Image Optimizer',
  'wp-reviews-plugin-for-google': 'Trustindex',
  'instagram-feed': 'Instagram Feed',
  'sitepress-multilingual-cms': 'WPML',
  polylang: 'Polylang',
  'translatepress-multilingual': 'TranslatePress',
  'mailchimp-for-wp': 'Mailchimp',
  'popup-maker': 'Popup Maker',
  ameliabooking: 'Amelia',
  'bookly-responsive-appointment-booking-tool': 'Bookly',
  'sfwd-lms': 'LearnDash',
  tutor: 'Tutor LMS',
  learnpress: 'LearnPress',
  'ultimate-addons-for-gutenberg': 'Spectra',
  'kadence-blocks': 'Kadence Blocks',
}

/** Rotas da API (`namespaces` do `/wp-json`) de plugins que nem sempre deixam rastro na página. */
const NAMESPACE_PLUGINS: [RegExp, string][] = [
  [/^elementor-pro\//, 'Elementor Pro'],
  [/^yoast\//, 'Yoast SEO'],
  [/^rankmath\//, 'Rank Math'],
  [/^aioseo\//, 'All in One SEO'],
  [/^seopress\//, 'SEOPress'],
  [/^wc\//, 'WooCommerce'],
  [/^contact-form-7\//, 'Contact Form 7'],
  [/^jet-engine\//, 'JetEngine'],
  [/^jetpack\//, 'Jetpack'],
  [/^wordfence\//, 'Wordfence'],
  [/^litespeed\//, 'LiteSpeed Cache'],
  [/^google-site-kit\//, 'Site Kit do Google'],
  [/^complianz\//, 'Complianz'],
  [/^fluentform\//, 'Fluent Forms'],
  [/^gf\//, 'Gravity Forms'],
  [/^redirection\//, 'Redirection'],
  [/^akismet\//, 'Akismet'],
  [/^mc4wp\//, 'Mailchimp'],
  [/^ldlms\//, 'LearnDash'],
  [/^tutor\//, 'Tutor LMS'],
]

const decodeEntities = (text: string) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')

const checksOf = (page: Page): SiteChecks => {
  const { html } = page
  const description =
    firstMatch(html, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) ?? firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i)
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0])
  return {
    php: firstMatch(page.headers.get('x-powered-by') ?? '', /PHP\/(\d+\.\d+(?:\.\d+)?)/i),
    description: description ? decodeEntities(description).trim() || undefined : undefined,
    h1: (html.match(/<h1\b/gi) ?? []).length,
    shareImage: /<meta[^>]+property=["']og:image["']/i.test(html),
    favicon: /<link[^>]+rel=["'][^"']*\bicon\b/i.test(html),
    images: images.length,
    imagesWithoutAlt: images.filter((tag) => !/\balt=["'][^"']*\S[^"']*["']/i.test(tag)).length,
    htmlKb: Math.round(html.length / 1024),
  }
}

/** A raiz da API que a própria página anuncia (com links permanentes ou pelo `?rest_route=`). */
const restRoot = (page: Page) => {
  const href =
    firstMatch(page.html, /<link[^>]+rel=["']https:\/\/api\.w\.org\/["'][^>]*href=["']([^"']+)["']/i) ??
    firstMatch(page.html, /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']https:\/\/api\.w\.org\/["']/i) ??
    firstMatch(page.headers.get('link') ?? '', /<([^>]+)>;\s*rel="https:\/\/api\.w\.org\/"/)
  try {
    return new URL(decodeEntities(href ?? '/wp-json/'), page.url)
  } catch {
    return new URL('/wp-json/', page.url)
  }
}

const restUrl = (root: URL, route: string, params: Record<string, string>) => {
  const url = new URL(root)
  if (url.searchParams.has('rest_route')) url.searchParams.set('rest_route', `/${route}`)
  else url.pathname = `${url.pathname.replace(/\/*$/, '/')}${route}`
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}

/** Uma rota da API do site; `null` quando não responde (fechada, lenta ou fora do ar). */
const fetchJson = async (url: string, signal?: AbortSignal, guard?: HostGuard) => {
  const timeout = AbortSignal.timeout(API_TIMEOUT)
  try {
    const { response } = await open(url, 'application/json', signal ? AbortSignal.any([signal, timeout]) : timeout, guard)
    const text = await readBody(response, /json/i, MAX_JSON)
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    return { status: response.status, total: Number(response.headers.get('x-wp-total') ?? NaN), data }
  } catch {
    return null
  }
}

const wordpressOf = async (page: Page, signal?: AbortSignal, guard?: HostGuard) => {
  const root = restRoot(page)
  const count = { per_page: '1', _fields: 'id' }
  const [index, pages, posts] = await Promise.all([
    fetchJson(restUrl(root, '', { _fields: 'name,description,namespaces' }), signal, guard),
    fetchJson(restUrl(root, 'wp/v2/pages', count), signal, guard),
    fetchJson(restUrl(root, 'wp/v2/posts', count), signal, guard),
  ])
  const data = (index?.status === 200 && index.data && typeof index.data === 'object' ? index.data : {}) as { name?: unknown; description?: unknown; namespaces?: unknown }
  const namespaces = Array.isArray(data.namespaces) ? data.namespaces.filter((n): n is string => typeof n === 'string') : []
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? decodeEntities(value).trim().slice(0, 140) : undefined)
  const total = (result: typeof pages) => (result?.status === 200 && Number.isFinite(result.total) ? result.total : undefined)
  const info: WordPressInfo = {
    api: namespaces.length > 0,
    name: text(data.name),
    tagline: text(data.description),
    pages: total(pages),
    posts: total(posts),
  }
  return { info, namespaces }
}

const pluginsOf = (html: string, namespaces: string[]) => {
  const names: string[] = []
  for (const [, folder] of html.matchAll(/\/wp-content\/plugins\/([a-z0-9_.-]+)\//gi)) names.push(PLUGIN_NAMES[folder.toLowerCase()] ?? folder.toLowerCase())
  for (const space of namespaces) {
    const known = NAMESPACE_PLUGINS.find(([test]) => test.test(space))?.[1]
    if (known) names.push(known)
  }
  // O PRO Elements responde pela rota do Elementor Pro
  return [...new Set(names)].filter((name, _, all) => name !== 'Elementor Pro' || !all.includes('PRO Elements'))
}

/**
 * O diagnóstico do site para a oferta de atualização: a leitura de sempre e,
 * quando a página abre, o básico que o Google e o celular olham, os plugins e,
 * em WordPress, o nome, as páginas e os posts pela API pública. Nunca lança.
 */
export const diagnoseSite = async (website: string, options: { signal?: AbortSignal; guard?: HostGuard } = {}): Promise<SiteDiagnosis> => {
  const { signal, guard } = options
  const { scan, page } = await readSite(website, signal, guard)
  const checkedAt = new Date().toISOString()
  if (!page || !scan.status || scan.status >= 400) return { scan, plugins: [], checkedAt }
  const onWordPress = scan.platform === 'wp-elementor' || scan.platform === 'wordpress'
  const wp = onWordPress ? await wordpressOf(page, signal, guard) : undefined
  return { scan, checks: checksOf(page), plugins: onWordPress ? pluginsOf(page.html, wp?.namespaces ?? []) : [], wordpress: wp?.info, checkedAt }
}
