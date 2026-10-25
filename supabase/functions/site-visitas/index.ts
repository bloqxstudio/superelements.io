import { createClient } from 'jsr:@supabase/supabase-js@2'
import { bareHost, browserOf, countryOf, deviceOf, hostOf, isBot, originOf, osOf, type Campaign } from '../_shared/visitas.ts'

/**
 * As visitas do site (painel Site do CRM, `/crm/site`): recebe o que o script
 * `visitas.js` manda do WordPress (páginas vistas, eventos, tempo e rolagem) e
 * grava pela `site_collect`. É pública, porque o visitante não tem conta: vai
 * publicada sem verificação de JWT (`verify_jwt = false` em
 * `supabase/config.toml`, ou `--no-verify-jwt`) e só aceita eventos do domínio
 * cadastrado no site. Aqui se classifica a origem (Google Ads, busca,
 * Instagram…), se lê o aparelho e o navegador do User-Agent e se descartam
 * robôs. Não guarda IP nem o conteúdo de formulários.
 *
 * O corpo vem como texto (o `sendBeacon` do navegador, sem pré-verificação de
 * CORS): { s: site, v: visitante, sid: visita, n: número da visita, h: host,
 * c: { tz, lang, sw, sh, tp }, e: [hits] }.
 */

const VERSION = 1

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
}

const done = (status = 204) => new Response(null, { status, headers: cors })

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
})

const ID = /^[A-Za-z0-9-]{8,40}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Prim = string | number | boolean
type Raw = Record<string, unknown>

const text = (value: unknown, max: number) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined)
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined)

/** Só valores simples, poucos e curtos (texto do botão, seção, destino). */
function cleanData(value: unknown): Record<string, Prim> {
  const out: Record<string, Prim> = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out
  let count = 0
  for (const [key, v] of Object.entries(value as Raw)) {
    if (count >= 12 || !/^[\w.-]{1,40}$/.test(key)) continue
    if (typeof v === 'string') out[key] = v.slice(0, 200)
    else if (typeof v === 'number' && Number.isFinite(v)) out[key] = v
    else if (typeof v === 'boolean') out[key] = v
    else continue
    count++
  }
  return out
}

/** `/contato/` sem a busca nem o `#` */
const cleanPath = (value: unknown) => {
  const path = text(value, 500)
  if (!path || !path.startsWith('/')) return '/'
  return path.split(/[?#]/)[0] || '/'
}

/** Nome de evento como chave: `Lead Qualificado` vira `lead_qualificado`. */
const eventName = (value: unknown) =>
  text(value, 80)
    ?.normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || undefined

function cleanHits(value: unknown) {
  if (!Array.isArray(value)) return []
  const hits: Raw[] = []
  for (const raw of value.slice(0, 40)) {
    if (!raw || typeof raw !== 'object') continue
    const hit = raw as Raw
    const pv = text(hit.pv, 40)
    if (hit.t === 'p' && pv) hits.push({ t: 'p', pv, path: cleanPath(hit.path), title: text(hit.title, 200), data: cleanData(hit.data) })
    else if (hit.t === 'e') {
      const name = eventName(hit.name)
      if (name) hits.push({ t: 'e', pv, name, path: cleanPath(hit.path), data: cleanData(hit.data) })
    } else if (hit.t === 'g' && pv) hits.push({ t: 'g', pv, ms: Math.max(0, num(hit.ms) ?? 0), scroll: Math.max(0, Math.min(100, num(hit.scroll) ?? 0)) })
  }
  return hits
}

function cleanCampaign(value: unknown): Campaign | undefined {
  if (!value || typeof value !== 'object') return undefined
  const q = value as Raw
  const campaign: Campaign = {
    utm_source: text(q.utm_source, 200),
    utm_medium: text(q.utm_medium, 200),
    utm_campaign: text(q.utm_campaign, 200),
    utm_term: text(q.utm_term, 200),
    utm_content: text(q.utm_content, 200),
    click: text(q.click, 20),
  }
  return Object.values(campaign).some(Boolean) ? campaign : undefined
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return done()
  if (req.method === 'GET') return new Response(JSON.stringify({ ok: true, version: VERSION }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return done(405)

  const ua = req.headers.get('user-agent') ?? ''
  if (isBot(ua)) return done()

  let body: Raw
  try {
    const raw = await req.text()
    if (raw.length > 64_000) return done(413)
    body = JSON.parse(raw)
  } catch {
    return done(400)
  }
  if (!body || typeof body !== 'object') return done(400)

  const site = text(body.s, 40)
  const visitor = text(body.v, 40)
  const sessionId = text(body.sid, 40)
  if (!site || !UUID.test(site) || !visitor || !ID.test(visitor) || !sessionId || !ID.test(sessionId)) return done(400)

  const hits = cleanHits(body.e)
  if (!hits.length) return done()

  // O domínio vem do navegador (Origin); sem ele, do que o script diz
  const host = hostOf(req.headers.get('origin')) ?? bareHost(text(body.h, 200))
  if (!host) return done(400)

  const ctx = (body.c && typeof body.c === 'object' ? body.c : {}) as Raw
  const touch = num(ctx.tp) ?? 0
  const tz = text(ctx.tz, 60)
  const start = hits.find((h) => h.t === 'p') as Raw | undefined
  const rawStart = Array.isArray(body.e) ? (body.e as Raw[]).find((h) => h && h.t === 'p' && h.start) : undefined
  const referrer = text(rawStart?.r, 500)
  const origin = originOf({ referrer, campaign: cleanCampaign(rawStart?.q), site: host, ua })
  const width = num(ctx.sw)
  const height = num(ctx.sh)

  const session = {
    id: sessionId,
    visitor,
    visit: Math.max(1, Math.min(100_000, num(body.n) ?? 1)),
    landing: start?.path,
    referrer,
    referrerHost: hostOf(referrer),
    ...origin,
    device: deviceOf(ua, touch),
    browser: browserOf(ua),
    os: osOf(ua, touch),
    country: countryOf(req.headers.get('cf-ipcountry') ?? req.headers.get('x-country'), tz),
    tz,
    lang: text(ctx.lang, 20),
    screen: width && height ? `${width}x${height}` : undefined,
  }

  const { error } = await admin.rpc('site_collect', { p_site: site, p_host: host, p_session: session, p_hits: hits })
  if (error) {
    console.error('site_collect', error.code, error.message)
    return done(error.code === 'P0002' ? 404 : error.code === '42501' ? 403 : 400)
  }
  return done()
})
