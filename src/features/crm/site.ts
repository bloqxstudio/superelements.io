import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { isLocalAppUrl, publicAppUrl } from '@/features/approval/shares'

/**
 * As visitas do site da equipe (CRM › Site, `/crm/site`): quem entrou, de onde
 * veio, o que viu e o que fez. O script `public/visitas.js`, colado uma vez no
 * WordPress, manda páginas vistas e eventos para a função `site-visitas`, que
 * grava em `site_sessions` (uma visita) e `site_events` (páginas e eventos);
 * daqui se leem essas tabelas e o relatório do período (`site_report`).
 * Migrações `20261025180000_site_visitas.sql` e `20261025230000_site_visitas_mapa.sql`
 * (cidade, estado, detalhes do aparelho, visitas por anúncio e a Realtime).
 */

export const VISITAS_ENDPOINT = `${(import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '') || 'https://nfmfcpcwyavutntnrxqq.supabase.co'}/functions/v1/site-visitas`

/** O script sai sempre do app publicado (no app local, o endereço daqui não abre no site). */
export const visitasScriptUrl = () => `${isLocalAppUrl() ? 'https://app.avencestudio.com' : publicAppUrl()}/visitas.js`

export interface SiteTracker {
  id: string
  teamId: string
  name: string
  domain: string
  createdAt: number
  /** O último evento recebido: o código está no site e conta. */
  lastSeenAt?: number
}

export interface SiteTotals {
  sessions: number
  visitors: number
  newVisitors: number
  pageviews: number
  /** Tempo médio em uso por visita */
  activeMs: number
  /** Visitas de uma página só, sem contato e com menos de 10 s em uso */
  bounces: number
  /** Visitas que chamaram no WhatsApp, ligaram, mandaram e-mail ou enviaram formulário */
  converted: number
}

export interface SiteDay {
  day: string
  sessions: number
  visitors: number
  pageviews: number
  converted: number
}

export interface SiteReport {
  totals: SiteTotals
  previous: SiteTotals
  days: SiteDay[]
  channels: { channel: string; sessions: number; visitors: number; converted: number; activeMs: number }[]
  sources: { channel: string; source: string; sessions: number; converted: number }[]
  campaigns: { channel: string; source: string | null; medium: string | null; campaign: string; sessions: number; converted: number }[]
  pages: { path: string; title: string | null; views: number; visitors: number; activeMs: number | null; scroll: number | null }[]
  landings: { path: string; sessions: number; converted: number; bounces: number }[]
  events: { name: string; total: number; sessions: number }[]
  clicks: { name: string; label: string; section: string; total: number; sessions: number }[]
  conversionPages: { path: string; total: number; sessions: number }[]
  devices: Cut[]
  browsers: Cut[]
  os: Cut[]
  countries: Cut[]
  tzs: Cut[]
  langs: Cut[]
  /** `dow` 1 (segunda) a 7 (domingo), `hour` 0 a 23, no fuso de quem abre a tela */
  hours: { dow: number; hour: number; sessions: number }[]
  notFound: { path: string; views: number }[]
  /** Por país e estado; `meta`: as visitas que vieram de anúncio da Meta */
  regions: { country: string; region: string; name: string | null; sessions: number; visitors: number; converted: number; meta: number }[]
  cities: { country: string; region: string | null; city: string; lat: number; lon: number; sessions: number; visitors: number; converted: number }[]
  /** Por campanha, conjunto (`utm_term`) e anúncio (`utm_content`), como o link da Meta manda */
  ads: SiteAdRow[]
  /** O relatório já vem com estados, cidades e anúncios (migração do mapa aplicada) */
  mapReady: boolean
}

export interface SiteAdRow {
  channel: string
  source: string | null
  medium: string | null
  campaign: string | null
  adset: string | null
  ad: string | null
  campaignId: string | null
  adId: string | null
  sessions: number
  visitors: number
  converted: number
  activeMs: number | null
  bounces: number
  /** Visitas que enviaram um formulário */
  forms: number
  /** Visitas com `lead_qualificado` / `lead_nao_qualificado` no dataLayer (a página Proposta) */
  qualified: number
  unqualified: number
}

export interface Cut {
  key: string
  sessions: number
}

export interface SiteSession {
  id: string
  visitorId: string
  visitNumber: number
  startedAt: number
  lastAt: number
  landing?: string
  exit?: string
  referrer?: string
  referrerHost?: string
  channel: string
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
  clickId?: string
  device?: string
  browser?: string
  os?: string
  country?: string
  tz?: string
  lang?: string
  screen?: string
  /** Pelo IP, na primeira página (sem guardar o IP) */
  city?: string
  /** Sigla do estado (`RS`) */
  region?: string
  regionName?: string
  lat?: number
  lon?: number
  /** Raio de incerteza da localização, em km */
  geoRadius?: number
  /** Provedor de internet */
  network?: string
  details: SessionDetails
  pageviews: number
  events: number
  activeMs: number
  converted: boolean
  conversions: string[]
}

/** O que o navegador contou do aparelho e o que veio no link do anúncio */
export interface SessionDetails {
  /** `Samsung SM-A546E` (Chrome no Android) */
  model?: string
  /** Versão do sistema (`17.5`, `14`, `11`) */
  osv?: string
  /** Versão principal do navegador */
  bv?: string
  /** Área visível da página */
  vw?: number
  vh?: number
  dpr?: number
  /** Conexão (`4g`, `3g`…) */
  net?: string
  theme?: 'dark' | 'light'
  campaignId?: string
  adsetId?: string
  adId?: string
  /** `Instagram_Stories`, `Facebook_Mobile_Feed`… ({{placement}} da Meta) */
  placement?: string
  /** `ig`, `fb`, `msg`, `an` ({{site_source_name}} da Meta) */
  siteSource?: string
}

export interface SiteEvent {
  id: number
  at: number
  type: 'pageview' | 'event'
  pv?: string
  name?: string
  path?: string
  title?: string
  data: Record<string, string | number | boolean>
  activeMs?: number
  scroll?: number
}

export class NoSiteTablesError extends Error {}

const noTables = (error: { code?: string }) => error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202'
const fail = (error: { code?: string; message: string }): never => {
  if (noTables(error)) throw new NoSiteTablesError(error.message)
  throw new Error(error.message)
}
const time = (value: string | null | undefined) => (value ? Date.parse(value) : undefined)
const opt = <T>(value: T | null | undefined) => value ?? undefined

// ---------- sites ----------

/** `https://www.Avencestudio.com/contato` vira `avencestudio.com`. */
export function normalizeDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/[/?#:].*$/, '')
    .replace(/^www\./, '')
}

export async function loadTrackers(teamId: string): Promise<SiteTracker[]> {
  const { data, error } = await supabase.from('site_trackers').select('*').eq('team_id', teamId).order('created_at')
  if (error) fail(error)
  return (data ?? []).map((r) => ({
    id: r.id,
    teamId: r.team_id,
    name: r.name || r.domain,
    domain: r.domain,
    createdAt: Date.parse(r.created_at),
    lastSeenAt: time(r.last_seen_at),
  }))
}

export async function createTracker(teamId: string, domain: string, name: string) {
  const clean = normalizeDomain(domain)
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(clean)) throw new Error('Digite o domínio do site, como avencestudio.com.')
  const { error } = await supabase.from('site_trackers').insert({ team_id: teamId, domain: clean, name: name.trim() || clean })
  if (error) {
    if (error.code === '23505') throw new Error('Esse site já está cadastrado.')
    fail(error)
  }
}

export async function removeTracker(id: string) {
  const { error } = await supabase.from('site_trackers').delete().eq('id', id)
  if (error) fail(error)
}

/** O código que vai no WordPress (uma vez, no fim do `<body>` de todas as páginas). */
export const snippetOf = (tracker: SiteTracker) => `<script defer src="${visitasScriptUrl()}" data-site="${tracker.id}" data-endpoint="${VISITAS_ENDPOINT}"></script>`

/** A função `site-visitas` está publicada e aberta para o site? */
export async function checkEndpoint(): Promise<'ok' | 'missing' | 'jwt' | 'error'> {
  return (await endpointInfo()).status
}

export interface EndpointInfo {
  status: 'ok' | 'missing' | 'jwt' | 'error'
  /** 2 em diante: grava cidade, estado e os detalhes do aparelho */
  version?: number
  /** Os segredos da MaxMind estão na função (a cidade sai do IP) */
  geo?: boolean
}

let endpointCache: Promise<EndpointInfo> | undefined
export function endpointInfo(): Promise<EndpointInfo> {
  endpointCache ??= (async (): Promise<EndpointInfo> => {
    try {
      const response = await fetch(VISITAS_ENDPOINT, { method: 'GET', cache: 'no-store' })
      if (response.ok) {
        const body = (await response.json().catch(() => ({}))) as { version?: number; geo?: boolean }
        return { status: 'ok', version: body.version, geo: body.geo }
      }
      if (response.status === 404) return { status: 'missing' }
      if (response.status === 401) return { status: 'jwt' }
      return { status: 'error' }
    } catch {
      return { status: 'error' }
    }
  })()
  const current = endpointCache
  // Um erro não fica guardado: a próxima pergunta tenta de novo
  void current.then((info) => {
    if (info.status !== 'ok' && endpointCache === current) endpointCache = undefined
  })
  return current
}

// ---------- período e relatório ----------

export type SitePeriod = 'hoje' | 7 | 30 | 90
export const SITE_PERIODS: SitePeriod[] = ['hoje', 7, 30, 90]
export const PERIOD_LABEL: Record<string, string> = { hoje: 'Hoje', 7: '7 dias', 30: '30 dias', 90: '90 dias' }

/** Do começo do primeiro dia (no fuso de quem abre) até agora. */
export function periodRange(period: SitePeriod, now = new Date()) {
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  if (period !== 'hoje') from.setDate(from.getDate() - (period - 1))
  return { from, to: new Date(now.getTime() + 60_000) }
}

export const localTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  } catch {
    return 'America/Sao_Paulo'
  }
}

/** `2026-10-25` no fuso de quem abre */
export const dayKeyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const ZERO: SiteTotals = { sessions: 0, visitors: 0, newVisitors: 0, pageviews: 0, activeMs: 0, bounces: 0, converted: 0 }
const totalsOf = (value: unknown): SiteTotals => {
  const t = (value ?? {}) as Partial<Record<keyof SiteTotals, number | string>>
  return Object.fromEntries(Object.keys(ZERO).map((key) => [key, Number(t[key as keyof SiteTotals] ?? 0) || 0])) as unknown as SiteTotals
}
const listOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

export async function loadReport(siteId: string, period: SitePeriod): Promise<SiteReport> {
  const { from, to } = periodRange(period)
  return loadReportRange(siteId, from, to)
}

/** O relatório entre duas datas (o cruzamento com a Meta usa os dias do relatório dela). */
export async function loadReportRange(siteId: string, from: Date, to: Date): Promise<SiteReport> {
  const { data, error } = await supabase.rpc('site_report', { p_site: siteId, p_from: from.toISOString(), p_to: to.toISOString(), p_tz: localTz() })
  if (error) fail(error)
  const r = (data ?? {}) as Record<string, unknown>
  return {
    totals: totalsOf(r.totals),
    previous: totalsOf(r.previous),
    days: listOf(r.days),
    channels: listOf(r.channels),
    sources: listOf(r.sources),
    campaigns: listOf(r.campaigns),
    pages: listOf(r.pages),
    landings: listOf(r.landings),
    events: listOf(r.events),
    clicks: listOf(r.clicks),
    conversionPages: listOf(r.conversionPages),
    devices: listOf(r.devices),
    browsers: listOf(r.browsers),
    os: listOf(r.os),
    countries: listOf(r.countries),
    tzs: listOf(r.tzs),
    langs: listOf(r.langs),
    hours: listOf(r.hours),
    notFound: listOf(r.notFound),
    regions: listOf(r.regions),
    cities: listOf<SiteReport['cities'][number]>(r.cities).map((c) => ({ ...c, lat: Number(c.lat), lon: Number(c.lon) })),
    ads: listOf(r.ads),
    mapReady: Array.isArray(r.ads),
  }
}

/** Um ponto por dia do período, com zero nos dias sem visita. */
export function dailySeries(report: SiteReport, period: SitePeriod, pick: (day: SiteDay) => number) {
  const { from } = periodRange(period)
  const byDay = new Map(report.days.map((d) => [d.day, d]))
  const points: { day: string; value: number }[] = []
  const today = dayKeyOf(new Date())
  for (const date = new Date(from); ; date.setDate(date.getDate() + 1)) {
    const key = dayKeyOf(date)
    const day = byDay.get(key)
    points.push({ day: key, value: day ? pick(day) : 0 })
    if (key >= today || points.length > 400) break
  }
  return points
}

// ---------- visitas ----------

type SessionRow = {
  id: string
  visitor_id: string
  visit_number: number
  started_at: string
  last_at: string
  landing_path: string | null
  exit_path: string | null
  referrer: string | null
  referrer_host: string | null
  channel: string
  source: string | null
  medium: string | null
  campaign: string | null
  term: string | null
  content: string | null
  click_id: string | null
  device: string | null
  browser: string | null
  os: string | null
  country: string | null
  tz: string | null
  lang: string | null
  screen: string | null
  city?: string | null
  region?: string | null
  region_name?: string | null
  lat?: number | null
  lon?: number | null
  geo_radius?: number | null
  network?: string | null
  details?: unknown
  pageviews: number
  events: number
  active_ms: number
  converted: boolean
  conversions: string[] | null
}

const sessionOf = (r: SessionRow): SiteSession => ({
  id: r.id,
  visitorId: r.visitor_id,
  visitNumber: r.visit_number,
  startedAt: Date.parse(r.started_at),
  lastAt: Date.parse(r.last_at),
  landing: opt(r.landing_path),
  exit: opt(r.exit_path),
  referrer: opt(r.referrer),
  referrerHost: opt(r.referrer_host),
  channel: r.channel,
  source: opt(r.source),
  medium: opt(r.medium),
  campaign: opt(r.campaign),
  term: opt(r.term),
  content: opt(r.content),
  clickId: opt(r.click_id),
  device: opt(r.device),
  browser: opt(r.browser),
  os: opt(r.os),
  country: opt(r.country),
  tz: opt(r.tz),
  lang: opt(r.lang),
  screen: opt(r.screen),
  city: opt(r.city),
  region: opt(r.region),
  regionName: opt(r.region_name),
  lat: opt(r.lat),
  lon: opt(r.lon),
  geoRadius: opt(r.geo_radius),
  network: opt(r.network),
  details: r.details && typeof r.details === 'object' && !Array.isArray(r.details) ? (r.details as SessionDetails) : {},
  pageviews: r.pageviews,
  events: r.events,
  activeMs: r.active_ms,
  converted: r.converted,
  conversions: r.conversions ?? [],
})

export const SESSIONS_PAGE = 50
/** Quem teve atividade nestes últimos minutos está no site agora. */
export const LIVE_MS = 5 * 60_000

export interface SessionFilter {
  period?: SitePeriod
  channel?: string
  converted?: boolean
  /** Só quem está no site agora */
  live?: boolean
  visitorId?: string
  /** Visitas que passaram por esta página (entrada ou saída) */
  path?: string
  /** Sigla do estado (`RS`) */
  region?: string
  city?: string
  /** O `utm_campaign` da visita (o nome da campanha no link do anúncio) */
  campaign?: string
}

export const isLiveSession = (s: Pick<SiteSession, 'lastAt'>) => Date.now() - s.lastAt < LIVE_MS

export async function loadSessions(siteId: string, filter: SessionFilter, page = 0): Promise<{ sessions: SiteSession[]; total: number }> {
  let query = supabase.from('site_sessions').select('*', { count: 'exact' }).eq('site_id', siteId)
  if (filter.live) query = query.gte('last_at', new Date(Date.now() - LIVE_MS).toISOString())
  else if (filter.period) {
    const { from, to } = periodRange(filter.period)
    query = query.gte('started_at', from.toISOString()).lt('started_at', to.toISOString())
  }
  if (filter.channel) query = query.eq('channel', filter.channel)
  if (filter.converted) query = query.eq('converted', true)
  if (filter.visitorId) query = query.eq('visitor_id', filter.visitorId)
  if (filter.region) query = query.eq('region', filter.region)
  if (filter.city) query = query.eq('city', filter.city)
  if (filter.campaign) query = query.eq('campaign', filter.campaign)
  if (filter.path) {
    const quoted = `"${filter.path.replace(/["\\]/g, '\\$&')}"`
    query = query.or(`landing_path.eq.${quoted},exit_path.eq.${quoted}`)
  }
  const { data, error, count } = await query
    .order(filter.live ? 'last_at' : 'started_at', { ascending: false })
    .range(page * SESSIONS_PAGE, page * SESSIONS_PAGE + SESSIONS_PAGE - 1)
  if (error) fail(error)
  return { sessions: ((data ?? []) as SessionRow[]).map(sessionOf), total: count ?? 0 }
}

/**
 * As visitas ao vivo: cada página vista, clique ou tempo que chega muda a
 * linha da visita, e a Realtime do Supabase avisa na hora (só as da equipe,
 * pela regra de leitura). Sem a migração do mapa (ou sem Realtime), não chega
 * nada e a tela segue lendo de tempos em tempos.
 */
export function useSiteFeed(siteId: string | undefined, onSession: (session: SiteSession) => void) {
  const latest = useRef(onSession)
  latest.current = onSession
  useEffect(() => {
    if (!siteId) return
    const deliver = (row: unknown) => {
      const r = row as SessionRow | null
      if (r?.id && r.started_at) latest.current(sessionOf(r))
    }
    const channel = supabase
      .channel(`site-visitas-${siteId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_sessions', filter: `site_id=eq.${siteId}` }, (payload) => deliver(payload.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_sessions', filter: `site_id=eq.${siteId}` }, (payload) => deliver(payload.new))
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [siteId])
}

/** Quantas pessoas estão no site agora. */
export async function countLive(siteId: string) {
  const { count, error } = await supabase
    .from('site_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .gte('last_at', new Date(Date.now() - LIVE_MS).toISOString())
  if (error) fail(error)
  return count ?? 0
}

export async function loadSessionEvents(sessionId: string): Promise<SiteEvent[]> {
  const { data, error } = await supabase.from('site_events').select('*').eq('session_id', sessionId).order('at').order('id').limit(500)
  if (error) fail(error)
  return (data ?? []).map((r) => ({
    id: r.id,
    at: Date.parse(r.at),
    type: r.type === 'event' ? 'event' : 'pageview',
    pv: opt(r.pv),
    name: opt(r.name),
    path: opt(r.path),
    title: opt(r.title),
    data: r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? (r.data as SiteEvent['data']) : {},
    activeMs: opt(r.active_ms),
    scroll: opt(r.scroll),
  }))
}

/** Apaga uma visita (as de teste), com os eventos dela. Só o gestor. */
export async function removeSession(id: string) {
  const { error } = await supabase.from('site_sessions').delete().eq('id', id)
  if (error) fail(error)
}

// ---------- nomes e números ----------

/** Eventos que contam como contato (a visita "converteu") */
export const CONTACT_EVENTS = ['whatsapp', 'telefone', 'email', 'formulario']

const EVENT_LABEL: Record<string, string> = {
  whatsapp: 'Chamou no WhatsApp',
  telefone: 'Clicou para ligar',
  email: 'Clicou no e-mail',
  formulario: 'Enviou o formulário',
  formulario_inicio: 'Começou o formulário',
  clique: 'Clique',
  link_externo: 'Link para fora',
  pergunta: 'Abriu uma dúvida',
  lead_qualificado: 'Lead qualificado',
  lead_nao_qualificado: 'Lead não qualificado',
}
export const eventLabel = (name: string) => EVENT_LABEL[name] ?? name.replace(/[_:]+/g, ' ')

const CONTACT_SHORT: Record<string, string> = { whatsapp: 'WhatsApp', telefone: 'Ligação', email: 'E-mail', formulario: 'Formulário' }
export const contactLabel = (name: string) => CONTACT_SHORT[name] ?? eventLabel(name)

/** `42 s`, `3 min 5 s`, `1 h 2 min` */
export function duration(ms: number | null | undefined) {
  const seconds = Math.round((ms ?? 0) / 1000)
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return seconds % 60 ? `${minutes} min ${seconds % 60} s` : `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

/** O caminho legível: `/` é o início, e os acentos voltam (`/servi%C3%A7os/`). */
export function pathLabel(path: string | null | undefined) {
  if (!path || path === '/') return 'Início'
  try {
    return decodeURI(path)
  } catch {
    return path
  }
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['pt-BR'], { type: 'region' })
  } catch {
    return undefined
  }
})()
export const countryLabel = (code: string | null | undefined) => {
  if (!code) return 'Não identificado'
  try {
    return regionNames?.of(code) ?? code
  } catch {
    return code
  }
}

/** `São Leopoldo, RS`; sem cidade, o estado; sem estado, o país */
export function placeLabel(s: Pick<SiteSession, 'city' | 'region' | 'regionName' | 'country'>, withCountry = false) {
  const foreign = !!s.country && s.country !== 'BR'
  const region = s.country === 'BR' ? (s.region ?? s.regionName) : (s.regionName ?? s.region)
  const parts: (string | undefined)[] = s.city ? [s.city, region] : [region]
  if (withCountry || foreign || !parts.some(Boolean)) parts.push(s.country ? countryLabel(s.country) : undefined)
  return parts.filter(Boolean).join(', ') || 'Não identificado'
}

/** `America/Sao_Paulo` vira `Sao Paulo` */
export const tzLabel = (tz: string | null | undefined) => (tz ? tz.split('/').pop()!.replace(/_/g, ' ') : 'Não identificado')

export const shareOf = (part: number, whole: number) => (whole > 0 ? part / whole : 0)
export const percentText = (value: number) => `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: value < 0.1 ? 1 : 0 })}%`
