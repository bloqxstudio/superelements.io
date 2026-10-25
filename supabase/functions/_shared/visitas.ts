/**
 * Leitura de uma visita do site (função `site-visitas`): de onde a pessoa veio
 * (Google Ads, busca, Instagram, campanha, outro site, direto), o aparelho, o
 * navegador e o sistema pelo User-Agent, o país pelo fuso quando o servidor
 * não diz, e se é robô. Sem imports e só com APIs da web, para rodar no
 * Supabase (Deno) e nos testes em Node.
 */

export interface Campaign {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  /** Que identificador de clique veio no endereço (`gclid`, `fbclid`…) */
  click?: string
}

export interface Origin {
  channel: string
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
  clickId?: string
}

const BOT =
  /(?<!cu)bot(\b|\/)|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|prerender|phantom|selenium|puppeteer|playwright|facebookexternalhit|meta-externalagent|whatsapp\/|python|curl\/|wget|axios|node-fetch|undici|go-http|java\/|okhttp|preview/i

/** Robôs, verificadores de site e capturas de tela (o Space usa Edge sem janela) */
export const isBot = (ua: string) => !ua || ua.length < 20 || BOT.test(ua)

const PAID = /^(cpc|ppc|paid|paid[ _-]?social|paidsocial|ads?|cpm|cpv|display|banner|pago|anuncio|anúncio)$/i
const META_SOURCE = /^(ig|instagram|fb|facebook|meta|an|msg|messenger)$/i
const GOOGLE_HOST = /(^|\.)google\.[a-z.]+$/
const AI_HOST = /(^|\.)(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|bard\.google\.com|copilot\.microsoft\.com|deepseek\.com|meta\.ai)$/
const SEARCH_HOST = /(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|yandex\.[a-z]+|baidu\.com|search\.brave\.com|startpage\.com)$/

const hostIs = (host: string, re: RegExp) => re.test(host)
const sameSite = (host: string, site: string) => host === site || host.endsWith(`.${site}`) || site.endsWith(`.${host}`)

/** O domínio sem `www.` e em minúsculas */
export const bareHost = (host: string | undefined | null) => (host ?? '').trim().toLowerCase().replace(/^www\./, '')

export function hostOf(url: string | undefined | null) {
  if (!url) return undefined
  try {
    return bareHost(new URL(url).hostname) || undefined
  } catch {
    return undefined
  }
}

/** Para onde vai a visita no painel: a origem como o dono do site fala dela. */
export function originOf(input: { referrer?: string; campaign?: Campaign; site: string; ua?: string }): Origin {
  const q = input.campaign ?? {}
  const src = q.utm_source?.trim().toLowerCase() || undefined
  const medium = q.utm_medium?.trim().toLowerCase() || undefined
  const base = { source: src, medium, campaign: q.utm_campaign?.trim() || undefined, term: q.utm_term?.trim() || undefined, content: q.utm_content?.trim() || undefined, clickId: q.click }
  const paid = !!medium && PAID.test(medium)
  const ref = hostOf(input.referrer)
  const outside = ref && !sameSite(ref, bareHost(input.site)) ? ref : undefined
  const ua = input.ua ?? ''

  if (q.click === 'gclid' || q.click === 'gbraid' || q.click === 'wbraid') return { ...base, channel: 'Google Ads', source: src ?? 'google' }
  if (q.click === 'msclkid') return { ...base, channel: 'Microsoft Ads', source: src ?? 'bing' }
  if (q.click === 'ttclid') return { ...base, channel: 'TikTok Ads', source: src ?? 'tiktok' }
  if (q.click === 'li_fat_id') return { ...base, channel: 'LinkedIn Ads', source: src ?? 'linkedin' }
  if (paid) {
    if (!src || /google|adwords/.test(src)) return { ...base, channel: 'Google Ads', source: src ?? 'google' }
    if (META_SOURCE.test(src)) return { ...base, channel: 'Meta Ads' }
    if (/tiktok/.test(src)) return { ...base, channel: 'TikTok Ads' }
    if (/linkedin/.test(src)) return { ...base, channel: 'LinkedIn Ads' }
    return { ...base, channel: 'Anúncios (outros)' }
  }
  if (src) {
    if (/^(ig|instagram)$/.test(src)) return { ...base, channel: 'Instagram' }
    if (/^(fb|facebook)$/.test(src)) return { ...base, channel: 'Facebook' }
    if (/google/.test(src)) return { ...base, channel: 'Google (busca)' }
    if (/linkedin/.test(src)) return { ...base, channel: 'LinkedIn' }
    if (/whats|^wa$/.test(src)) return { ...base, channel: 'WhatsApp' }
    if (/mail|newsletter/.test(src) || medium === 'email') return { ...base, channel: 'E-mail' }
    return { ...base, channel: 'Campanhas' }
  }
  if (outside) {
    const at = { ...base, source: outside }
    if (hostIs(outside, AI_HOST)) return { ...at, channel: 'IAs (ChatGPT e outras)' }
    if (hostIs(outside, GOOGLE_HOST)) return { ...at, channel: 'Google (busca)' }
    if (hostIs(outside, SEARCH_HOST)) return { ...at, channel: 'Outras buscas' }
    if (/(^|\.)instagram\.com$/.test(outside)) return { ...at, channel: 'Instagram' }
    if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(outside)) return { ...at, channel: 'Facebook' }
    if (/(^|\.)(linkedin\.com|lnkd\.in)$/.test(outside)) return { ...at, channel: 'LinkedIn' }
    if (/(^|\.)(t\.co|x\.com|twitter\.com)$/.test(outside)) return { ...at, channel: 'X (Twitter)' }
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(outside)) return { ...at, channel: 'YouTube' }
    if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(outside)) return { ...at, channel: 'WhatsApp' }
    if (/(^|\.)tiktok\.com$/.test(outside)) return { ...at, channel: 'TikTok' }
    return { ...at, channel: 'Sites' }
  }
  // Sem referência: o navegador de dentro do app ainda diz de onde veio
  if (/Instagram/i.test(ua)) return { ...base, channel: 'Instagram', source: 'instagram' }
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return { ...base, channel: 'Facebook', source: 'facebook' }
  if (q.click === 'fbclid') return { ...base, channel: 'Instagram ou Facebook' }
  return { ...base, channel: 'Direto' }
}

export function deviceOf(ua: string, touch = 0) {
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'Tablet'
  if (/Macintosh/i.test(ua) && touch > 1) return 'Tablet'
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return 'Celular'
  return 'Computador'
}

export function browserOf(ua: string) {
  if (/Instagram/i.test(ua)) return 'Instagram (app)'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook (app)'
  if (/LinkedInApp/i.test(ua)) return 'LinkedIn (app)'
  if (/BytedanceWebview|musical_ly|TikTok/i.test(ua)) return 'TikTok (app)'
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'Edge'
  if (/OPR\/|Opera/.test(ua)) return 'Opera'
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet'
  if (/CriOS|Chrome\//.test(ua)) return 'Chrome'
  if (/FxiOS|Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua)) return 'Safari'
  return 'Outro'
}

export function osOf(ua: string, touch = 0) {
  if (/iPhone|iPod/.test(ua)) return 'iOS'
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return 'iPadOS'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/CrOS/.test(ua)) return 'ChromeOS'
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Outro'
}

const TZ_COUNTRY: Record<string, string> = {
  'Europe/Lisbon': 'PT', 'Atlantic/Azores': 'PT', 'Atlantic/Madeira': 'PT', 'America/Montevideo': 'UY', 'America/Asuncion': 'PY',
  'America/Santiago': 'CL', 'America/Bogota': 'CO', 'America/Lima': 'PE', 'America/Caracas': 'VE', 'America/La_Paz': 'BO',
  'America/Mexico_City': 'MX', 'Europe/Madrid': 'ES', 'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Zurich': 'CH', 'America/Toronto': 'CA',
  'America/Vancouver': 'CA', 'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Phoenix': 'US',
  'America/Los_Angeles': 'US', 'Asia/Tokyo': 'JP', 'Australia/Sydney': 'AU',
}

/** O país do cabeçalho do servidor, ou o do fuso do navegador (`America/Sao_Paulo` é Brasil). */
export function countryOf(header: string | null | undefined, tz: string | undefined) {
  const code = header?.trim().toUpperCase()
  if (code && /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1') return code
  if (!tz) return undefined
  if (/^America\/(Sao_Paulo|Araguaina|Bahia|Belem|Boa_Vista|Campo_Grande|Cuiaba|Eirunepe|Fortaleza|Maceio|Manaus|Noronha|Porto_Velho|Recife|Rio_Branco|Santarem)$/.test(tz)) return 'BR'
  if (/^America\/Argentina\//.test(tz) || tz === 'America/Buenos_Aires') return 'AR'
  return TZ_COUNTRY[tz]
}
