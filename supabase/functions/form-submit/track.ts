import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { bareHost, browserOf, countryOf, deviceOf, hostOf, isBot, originOf, osOf, type Campaign } from '../_shared/visitas.ts'

/**
 * Batidas da visita ao formulário (`action: 'track'`), para "Ao vivo" e o funil do editor: o
 * `forms.js` manda a abertura, o começo, cada etapa, a agenda vista, um sinal a cada 20 s e a saída.
 * Na primeira batida a função lê a origem (mesma regra do Site: `originOf`), o aparelho pelo
 * User-Agent e o lugar pelo IP (MaxMind, como a `site-visitas`, ou cabeçalhos do Cloudflare);
 * o IP nunca é guardado. Quem grava é `crm_form_track` (service_role), que só aceita formulários
 * publicados de contas ativas.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KINDS = new Set(['view', 'start', 'step', 'screen', 'ping', 'leave'])
const SCREENS = new Set(['welcome', 'steps', 'booking', 'booked', 'result'])
const CLICKS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid', 'li_fat_id']

const MAXMIND_ACCOUNT = Deno.env.get('MAXMIND_ACCOUNT_ID') ?? ''
const MAXMIND_KEY = Deno.env.get('MAXMIND_LICENSE_KEY') ?? ''
const PRIVATE_IP = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|f[cd][0-9a-f]{2}:|fe80:)/i

type Raw = Record<string, unknown>
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
const int = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(Math.round(v), 0), max) : undefined)

interface Place {
  country?: string
  region?: string
  region_name?: string
  city?: string
}

function clientIp(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || ''
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : undefined
}

const header = (req: Request, name: string) => {
  const value = req.headers.get(name)?.trim()
  if (!value) return undefined
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

type Named = { names?: Record<string, string>; iso_code?: string }
const nameOf = (n: Named | undefined) => n?.names?.['pt-BR'] ?? n?.names?.en

async function placeOf(req: Request): Promise<Place | undefined> {
  const city = header(req, 'cf-ipcity')
  if (city) return { city, region: header(req, 'cf-region-code'), region_name: header(req, 'cf-region') }
  const ip = clientIp(req)
  if (!MAXMIND_ACCOUNT || !MAXMIND_KEY || !ip || PRIVATE_IP.test(ip)) return undefined
  try {
    const response = await fetch(`https://geolite.info/geoip/v2.1/city/${encodeURIComponent(ip)}`, {
      headers: { Authorization: `Basic ${btoa(`${MAXMIND_ACCOUNT}:${MAXMIND_KEY}`)}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(1500),
    })
    if (!response.ok) return undefined
    const r = (await response.json()) as { city?: Named; subdivisions?: Named[]; country?: Named }
    const sub = r.subdivisions?.[0]
    return { country: r.country?.iso_code, city: nameOf(r.city), region: sub?.iso_code, region_name: nameOf(sub) }
  } catch {
    return undefined
  }
}

/** A origem que o `forms.js` guardou na sessão (UTM, clique, referrer) como o Site lê */
function originFields(meta: Raw, page: string | undefined, ua: string) {
  const click = CLICKS.find((k) => text(meta[k], 300))
  const campaign: Campaign = {
    utm_source: text(meta.utm_source, 200),
    utm_medium: text(meta.utm_medium, 200),
    utm_campaign: text(meta.utm_campaign, 200),
    utm_term: text(meta.utm_term, 200),
    utm_content: text(meta.utm_content, 200),
    click,
  }
  const referrer = text(meta.referrer, 500)
  const site = bareHost(hostOf(page) ?? '')
  const o = originOf({ referrer, campaign, site, ua })
  return { channel: o.channel, source: o.source, medium: o.medium, campaign: o.campaign, content: o.content, term: o.term, click_id: o.clickId, referrer_host: hostOf(referrer) }
}

export async function track(admin: SupabaseClient, id: string, body: Raw, req: Request, json: (b: unknown, s?: number) => Response) {
  const visit = String(body.visit ?? '')
  const kind = String(body.kind ?? '')
  if (!UUID.test(visit) || !KINDS.has(kind)) return json({ error: 'Batida inválida.' }, 400)
  const ua = req.headers.get('user-agent') ?? ''
  if (isBot(ua)) return json({ ok: true })

  const screen = typeof body.screen === 'string' && SCREENS.has(body.screen) ? body.screen : undefined
  const hit = { kind, screen, step: text(body.step, 60), index: int(body.index, 500), total: int(body.total, 500), ms: int(body.ms, 86_400_000) }

  let first: Raw = {}
  const f = body.first && typeof body.first === 'object' ? (body.first as Raw) : undefined
  if (f) {
    const meta = f.origin && typeof f.origin === 'object' ? (f.origin as Raw) : {}
    const page = text(meta.page, 500) ?? text(f.page, 500)
    const touch = int(f.touch, 20) ?? 0
    const place = await placeOf(req)
    first = {
      visitor: text(f.visitor, 40),
      page,
      embed: f.embed === 'app' ? 'app' : 'site',
      ...originFields(meta, page, ua),
      device: deviceOf(ua, touch),
      browser: browserOf(ua),
      os: osOf(ua, touch),
      ...place,
      country: place?.country ?? countryOf(req.headers.get('cf-ipcountry'), text(f.tz, 60)),
    }
  }

  const { error } = await admin.rpc('crm_form_track', { p_form: id, p_visit: visit, p_hit: hit, p_first: first })
  if (error) console.error('crm_form_track:', error.message)
  return json({ ok: true })
}

/** O envio e a reunião vêm do que a própria função gravou (a página não consegue marcar sozinha) */
export async function markVisit(admin: SupabaseClient, formId: string, visit: unknown, patch: Raw) {
  if (typeof visit !== 'string' || !UUID.test(visit)) return
  const { error } = await admin.from('crm_form_visits').update({ ...patch, last_at: new Date().toISOString() }).eq('id', visit).eq('form_id', formId)
  if (error) console.error('crm_form_visits:', error.message)
}
