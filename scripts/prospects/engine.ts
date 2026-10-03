import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { isIP } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { nicheFor, type Niche } from '../../src/features/prospects/niches.ts'
import { scoreLead, statsOf } from '../../src/features/prospects/score.ts'
import type {
  Business,
  Lead,
  SearchEvent,
  SearchInput,
  SearchRecord,
  SearchSummary,
  SiteScan,
} from '../../src/features/prospects/types.ts'

/**
 * Motor da prospecção. Acha empresas de um nicho numa região (OpenStreetMap,
 * grátis, ou Google Maps, com chave), abre a primeira página do site de cada
 * uma, descobre se é WordPress, se usa Elementor e em que versão, quem fez o
 * site, como falar com a empresa, e dá a nota de oportunidade
 * (`src/features/prospects/score.ts`). Roda no Node: pela tela `/prospeccao`
 * (servidor de dev, `vitePlugin.ts`) ou pelo terminal (`prospectar.ts`).
 */

/** Os serviços do OpenStreetMap pedem um nome que identifique quem consulta. */
const MAP_AGENT = 'superelements-prospeccao/1.0 (+https://superelements.io)'
/** Os sites recebem um navegador comum: muitos recusam robôs sem nome. */
const BROWSER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const SITE_TIMEOUT = 12_000
const MAX_HTML = 1_500_000
const CONCURRENCY = 8
/** Sites lidos por busca; empresas sem site não custam leitura e têm um teto maior. */
const MAX_SITES = 400
const MAX_BUSINESSES = 1500

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------- região

interface Area {
  name: string
  label: string
  /** Área do Overpass (relação + 3600000000), quando o mapa tem o contorno. */
  osmArea?: number
  /** Sem contorno: um raio em volta do ponto. */
  center: { lat: number; lon: number }
  /** sul, norte, oeste, leste */
  bbox: [number, number, number, number]
}

interface NominatimHit {
  osm_type: 'node' | 'way' | 'relation'
  osm_id: number
  lat: string
  lon: string
  display_name: string
  boundingbox: [string, string, string, string]
}

interface OsmElement {
  type: 'node' | 'way' | 'relation'
  id: number
  tags?: Record<string, string>
}

interface GooglePlace {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  addressComponents?: { longText: string; types?: string[] }[]
  nationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  googleMapsUri?: string
  primaryTypeDisplayName?: { text: string }
  businessStatus?: string
}

interface GoogleResponse {
  places?: GooglePlace[]
  nextPageToken?: string
  error?: { message?: string }
}

let lastNominatim = 0

/** Acha a cidade ou o bairro no mapa (Nominatim pede no máximo uma consulta por segundo). */
const geocode = async (query: string, signal?: AbortSignal): Promise<Area | null> => {
  const gap = Date.now() - lastNominatim
  if (gap < 1100) await wait(1100 - gap)
  lastNominatim = Date.now()
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1', countrycodes: 'br', featureType: 'settlement', 'accept-language': 'pt-BR' }).toString()
  const response = await fetch(url, { headers: { 'user-agent': MAP_AGENT }, signal })
  if (!response.ok) throw new Error(`O mapa não respondeu ao procurar "${query}" (${response.status})`)
  const [hit] = (await response.json()) as NominatimHit[]
  if (!hit) return null
  const [south, north, west, east] = hit.boundingbox.map(Number)
  return {
    name: query,
    label: hit.display_name,
    osmArea: hit.osm_type === 'relation' ? 3_600_000_000 + Number(hit.osm_id) : hit.osm_type === 'way' ? 2_400_000_000 + Number(hit.osm_id) : undefined,
    center: { lat: Number(hit.lat), lon: Number(hit.lon) },
    bbox: [south, north, west, east],
  }
}

// ---------------------------------------------------------------- fontes

/** Nicho escrito à mão vira busca no nome: só letras, números e espaços, para não quebrar a consulta. */
const plainText = (text: string) => text.replace(/[^\p{L}\p{N} ]/gu, '').trim()

const matchesNiche = (tags: Record<string, string>, niche: Niche) =>
  niche.osm.length
    ? niche.osm.some((filter) => {
        const [key, value] = filter.split('=')
        return tags[key] === value
      })
    : (tags.name ?? '').toLowerCase().includes(niche.query.toLowerCase())

/** OpenStreetMap pelo Overpass: grátis e sem chave, mas só tem o que a comunidade mapeou. */
const fromOsm = async (areas: Area[], niches: Niche[], signal?: AbortSignal): Promise<Business[]> => {
  const scopes = areas.map((area) => (area.osmArea ? `area(${area.osmArea})` : null)).filter(Boolean)
  const arounds = areas.filter((area) => !area.osmArea)
  const where = [...(scopes.length ? ['(area.a)'] : []), ...arounds.map((a) => `(around:2500,${a.center.lat},${a.center.lon})`)]
  const lines: string[] = []
  for (const niche of niches) {
    for (const scope of where) {
      if (niche.osm.length) {
        for (const filter of niche.osm) {
          const [key, value] = filter.split('=')
          lines.push(`nwr${scope}["${key}"="${value}"];`)
        }
      } else {
        lines.push(`nwr${scope}["name"~"${plainText(niche.query)}",i][~"^(office|healthcare|amenity|shop|craft|leisure)$"~"."];`)
      }
    }
  }
  const query = `[out:json][timeout:150];${scopes.length ? `(${scopes.join(';')};)->.a;` : ''}(${lines.join('')});out tags center;`

  let data: { elements: OsmElement[] } | null = null
  let lastError: unknown = null
  for (const endpoint of OVERPASS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'user-agent': MAP_AGENT, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(180_000)]) : AbortSignal.timeout(180_000),
      })
      if (!response.ok) throw new Error(`Overpass respondeu ${response.status}`)
      data = (await response.json()) as { elements: OsmElement[] }
      break
    } catch (error) {
      if (signal?.aborted) throw error
      lastError = error
    }
  }
  if (!data) throw new Error(`O mapa aberto não respondeu: ${lastError instanceof Error ? lastError.message : lastError}`)

  const businesses: Business[] = []
  for (const element of data.elements) {
    const tags: Record<string, string> = element.tags ?? {}
    if (!tags.name) continue
    const niche = niches.find((n) => matchesNiche(tags, n))
    if (!niche) continue
    const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', ')
    const neighborhood = tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:district']
    const city = tags['addr:city']
    const instagram = tags['contact:instagram'] || tags.instagram
    businesses.push({
      id: `osm:${element.type}/${element.id}`,
      source: 'osm',
      name: tags.name,
      niche: niche.label,
      category: tags['healthcare:speciality'] || undefined,
      address: [street, neighborhood, city].filter(Boolean).join(' · ') || undefined,
      neighborhood,
      city,
      phone: tags.phone || tags['contact:phone'] || tags['contact:mobile'] || undefined,
      email: tags.email || tags['contact:email'] || undefined,
      website:
        tags.website || tags['contact:website'] || tags.url ||
        (instagram ? (instagram.startsWith('http') ? instagram : `https://www.instagram.com/${instagram.replace(/^@/, '')}`) : undefined),
      mapsUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    })
  }
  return businesses
}

const GOOGLE_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
  'nextPageToken',
].join(',')

/** Google Maps (Places API, busca por texto): bem mais completo; cada página de 20 resultados é uma consulta paga. */
const fromGoogle = async (
  areas: Area[],
  niches: Niche[],
  key: string,
  onPage: (text: string) => void,
  signal?: AbortSignal
): Promise<Business[]> => {
  const businesses: Business[] = []
  for (const area of areas) {
    for (const niche of niches) {
      let pageToken: string | undefined
      for (let page = 0; page < 3; page++) {
        const [south, north, west, east] = area.bbox
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': GOOGLE_FIELDS },
          body: JSON.stringify({
            textQuery: niche.query,
            languageCode: 'pt-BR',
            regionCode: 'BR',
            pageSize: 20,
            pageToken,
            locationRestriction: { rectangle: { low: { latitude: south, longitude: west }, high: { latitude: north, longitude: east } } },
          }),
          signal,
        })
        const data = (await response.json()) as GoogleResponse
        if (!response.ok) throw new Error(`Google Maps: ${data?.error?.message ?? response.status}`)
        for (const place of data.places ?? []) {
          if (place.businessStatus === 'CLOSED_PERMANENTLY') continue
          const part = (type: string) => place.addressComponents?.find((c) => c.types?.includes(type))?.longText
          businesses.push({
            id: `google:${place.id}`,
            source: 'google',
            name: place.displayName?.text ?? 'Sem nome',
            niche: niche.label,
            category: place.primaryTypeDisplayName?.text,
            address: place.formattedAddress,
            neighborhood: part('sublocality_level_1') || part('sublocality'),
            city: part('administrative_area_level_2'),
            phone: place.nationalPhoneNumber,
            website: place.websiteUri,
            rating: place.rating,
            reviews: place.userRatingCount,
            mapsUrl: place.googleMapsUri,
          })
        }
        onPage(`Google Maps: ${niche.label} em ${area.name}, página ${page + 1} (${businesses.length} empresas até agora)`)
        pageToken = data.nextPageToken
        if (!pageToken) break
        await wait(300)
      }
    }
  }
  return businesses
}

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

const profileOf = (host: string) => PROFILES.find(([test]) => test.test(host))?.[1]

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

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

/** Não deixa um endereço da fonte apontar para a rede deste computador. */
const isPublicHost = (host: string) => {
  const bare = host.replace(/^\[|\]$/g, '')
  if (!bare || bare === 'localhost' || bare.endsWith('.local') || bare.endsWith('.internal')) return false
  if (isIP(bare) === 4) return !/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(bare)
  if (isIP(bare) === 6) return !/^(::1?$|f[cd]|fe80)/i.test(bare)
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

const readBody = async (response: Response) => {
  const type = response.headers.get('content-type') ?? ''
  if (type && !/html|xml|text/i.test(type)) {
    await response.body?.cancel()
    return ''
  }
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < MAX_HTML) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.length
  }
  await reader.cancel().catch(() => {})
  const charset = /charset=([\w-]+)/i.exec(type)?.[1]?.toLowerCase()
  const decoder = new TextDecoder(charset && /8859|1252|latin/.test(charset) ? 'windows-1252' : 'utf-8')
  return decoder.decode(Buffer.concat(chunks))
}

/** Abre a página seguindo os redirecionamentos um a um (cada destino passa pela checagem de rede). */
const fetchPage = async (start: string, signal?: AbortSignal): Promise<Page> => {
  const began = Date.now()
  let url = start
  const timeout = AbortSignal.timeout(SITE_TIMEOUT)
  for (let hop = 0; hop < 6; hop++) {
    const host = new URL(url).hostname
    if (!isPublicHost(host)) throw Object.assign(new Error('endereço interno'), { code: 'PRIVATE' })
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': BROWSER_AGENT, accept: 'text/html,application/xhtml+xml', 'accept-language': 'pt-BR,pt;q=0.9' },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel()
      url = new URL(location, url).toString()
      continue
    }
    const html = await readBody(response)
    return { url, status: response.status, html, headers: response.headers, ms: Date.now() - began }
  }
  throw Object.assign(new Error('redirecionamentos demais'), { code: 'REDIRECTS' })
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
    ? firstMatch(generator, /Elementor\s+(\d+\.\d+(?:\.\d+)?)/i) ?? firstMatch(html, /\/plugins\/elementor\/assets\/[^"'?]+\?ver=(\d+\.\d+(?:\.\d+)?)(?![\w.])/i)
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
  }
}

const PARKED = /for sale|à venda|a venda|suspended|suspens|em constru|coming soon|index of \/|default page|página padrão|parked|site em manuten|under construction/i

/** Abre o site da empresa e lê o que ele usa. Nunca lança: o erro vira parte da leitura. */
export const scanSite = async (website: string, signal?: AbortSignal): Promise<SiteScan> => {
  const start = /^https?:\/\//i.test(website) ? website.trim() : `https://${website.trim()}`
  const base = { url: start, emails: [], phones: [], viewport: false, https: start.startsWith('https:'), ms: 0 }
  const profile = profileOf(hostOf(start))
  if (profile) {
    const handle = profile === 'Instagram' ? /instagram\.com\/([A-Za-z0-9_.]+)/.exec(start)?.[1] : undefined
    return { ...base, status: null, platform: 'sem-site', builder: profile, instagram: handle ? `@${handle}` : undefined }
  }

  let page: Page
  let certError: string | undefined
  try {
    page = await fetchPage(start, signal)
  } catch (error) {
    if (signal?.aborted) throw error
    const message = errorText(error)
    // Certificado vencido: tenta sem o cadeado para ainda descobrir a plataforma
    if (message.startsWith('certificado') && start.startsWith('https:')) {
      try {
        page = await fetchPage(start.replace(/^https:/i, 'http:'), signal)
        certError = 'certificado de segurança inválido'
      } catch {
        return { ...base, status: null, platform: 'fora-do-ar', error: message }
      }
    } else {
      return { ...base, status: null, platform: 'fora-do-ar', error: message }
    }
  }

  const finalProfile = profileOf(hostOf(page.url))
  if (finalProfile) return { ...base, url: page.url, status: page.status, ms: page.ms, platform: 'sem-site', builder: finalProfile }

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
          const contact = await fetchPage(contactUrl.toString(), signal)
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
  return scan
}

// ---------------------------------------------------------------- busca

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

const toLead = (business: Business, scan?: SiteScan, units?: number): Lead => {
  const base = { ...business, domain: scan ? hostOf(scan.url) || undefined : undefined, scan, units }
  return { ...base, ...scoreLead(base) }
}

const pool = async <T>(items: T[], size: number, run: (item: T) => Promise<void>, signal?: AbortSignal) => {
  let next = 0
  const worker = async () => {
    while (next < items.length && !signal?.aborted) await run(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
}

export interface SearchOptions {
  googleKey?: string
  signal?: AbortSignal
  onEvent?: (event: SearchEvent) => void
}

/** Busca completa: região, empresas, leitura dos sites e notas. */
export const runSearch = async (input: SearchInput, options: SearchOptions = {}): Promise<SearchRecord> => {
  const { signal, googleKey } = options
  const emit = (event: SearchEvent) => options.onEvent?.(event)
  const region = input.region?.trim()
  if (!region) throw new Error('Diga a cidade (por exemplo, "São Paulo, SP").')
  const niches = [...new Set(input.niches.map((n) => n.trim()).filter(Boolean))].slice(0, 8).map(nicheFor)
  if (!niches.length) throw new Error('Escolha pelo menos um nicho.')
  if (input.source === 'google' && !googleKey) throw new Error('Falta a chave do Google Maps (GOOGLE_PLACES_API_KEY no .env).')
  const notes: string[] = []

  emit({ type: 'stage', text: `Procurando ${region} no mapa` })
  const city = await geocode(region, signal)
  if (!city) throw new Error(`Não achei "${region}" no mapa. Tente "Cidade, UF".`)
  const areas: Area[] = []
  for (const name of (input.areas ?? []).map((a) => a.trim()).filter(Boolean).slice(0, 20)) {
    emit({ type: 'stage', text: `Procurando o bairro ${name}` })
    const area = await geocode(`${name}, ${region}`, signal)
    if (area) areas.push({ ...area, name })
    else notes.push(`Bairro não encontrado no mapa: ${name}`)
  }
  if (!areas.length) areas.push(city)

  let businesses: Business[]
  if (input.source === 'google') {
    emit({ type: 'stage', text: 'Consultando o Google Maps' })
    businesses = await fromGoogle(areas, niches, googleKey!, (text) => emit({ type: 'stage', text }), signal)
  } else {
    emit({ type: 'stage', text: 'Consultando o mapa aberto (pode levar até um minuto numa cidade grande)' })
    businesses = await fromOsm(areas, niches, signal)
  }

  // A mesma empresa em dois nichos ou dois bairros conta uma vez
  const unique = [...new Map(businesses.map((b) => [b.id, b])).values()].filter((b) => !/\.gov\.br/i.test(b.website ?? ''))

  // Redes com o mesmo site (várias unidades) leem o site uma vez só
  const byDomain = new Map<string, Business[]>()
  const withoutSite: Business[] = []
  for (const business of unique) {
    const host = business.website ? hostOf(/^https?:/i.test(business.website) ? business.website : `https://${business.website}`) : ''
    if (!host || profileOf(host)) withoutSite.push(business)
    else if (byDomain.has(host) || byDomain.size < MAX_SITES) byDomain.set(host, [...(byDomain.get(host) ?? []), business])
  }
  if (unique.length - withoutSite.length > [...byDomain.values()].flat().length) notes.push(`Ficaram os ${MAX_SITES} primeiros sites da busca.`)
  if (withoutSite.length > MAX_BUSINESSES) {
    notes.push(`Das ${withoutSite.length} empresas sem site, ficaram as ${MAX_BUSINESSES} primeiras.`)
    withoutSite.length = MAX_BUSINESSES
  }
  emit({ type: 'businesses', count: withoutSite.length + [...byDomain.values()].flat().length })

  const leads: Lead[] = []
  const total = withoutSite.length + byDomain.size
  const add = (lead: Lead) => {
    leads.push(lead)
    emit({ type: 'lead', lead, done: leads.length, total })
  }
  for (const business of withoutSite) {
    add(toLead(business, business.website ? await scanSite(business.website, signal) : undefined))
  }

  emit({ type: 'stage', text: `Lendo ${byDomain.size} sites` })
  await pool(
    [...byDomain.values()],
    CONCURRENCY,
    async (group) => {
      const [first] = group
      const scan = await scanSite(first.website!, signal)
      add(toLead({ ...first, phone: first.phone ?? group.find((b) => b.phone)?.phone }, scan, group.length > 1 ? group.length : undefined))
    },
    signal
  )
  if (signal?.aborted) throw new Error('Busca cancelada')

  leads.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'pt-BR'))
  const now = new Date()
  const record: SearchRecord = {
    id: `${now.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')}-${slug(region)}`,
    createdAt: now.toISOString(),
    input: { ...input, region, niches: niches.map((n) => n.id) },
    regionLabel: city.label,
    leads,
    stats: statsOf(leads),
    notes,
  }
  emit({ type: 'done', record })
  return record
}

// ---------------------------------------------------------------- buscas salvas

/** As buscas ficam neste computador (`data/prospeccao`, fora do git): têm contato de pessoas. */
export const DEFAULT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/prospeccao')

const safeId = (id: string) => (/^[\w-]+$/.test(id) ? id : null)

export const saveSearch = async (record: SearchRecord, dir = DEFAULT_DIR) => {
  await mkdir(dir, { recursive: true })
  const file = path.join(dir, `${record.id}.json`)
  await writeFile(file, JSON.stringify(record, null, 1))
  return file
}

export const readSearch = async (id: string, dir = DEFAULT_DIR): Promise<SearchRecord | null> => {
  const clean = safeId(id)
  if (!clean) return null
  try {
    return JSON.parse(await readFile(path.join(dir, `${clean}.json`), 'utf8'))
  } catch {
    return null
  }
}

export const deleteSearch = async (id: string, dir = DEFAULT_DIR) => {
  const clean = safeId(id)
  if (clean) await rm(path.join(dir, `${clean}.json`), { force: true })
}

export const listSearches = async (dir = DEFAULT_DIR): Promise<SearchSummary[]> => {
  let files: string[] = []
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
  const summaries: SearchSummary[] = []
  for (const file of files) {
    try {
      const { id, createdAt, input, regionLabel, stats } = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as SearchRecord
      summaries.push({ id, createdAt, input, regionLabel, stats })
    } catch {
      // Arquivo quebrado não derruba a lista
    }
  }
  return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
