import { supabase } from '@/integrations/supabase/client'
import { isLocalAppUrl, publicAppUrl } from '@/features/approval/shares'

/**
 * As visitas do site da equipe (CRM › Site, `/crm/site`): quem entrou, de onde
 * veio, o que viu e o que fez. O script `public/visitas.js`, colado uma vez no
 * WordPress, manda páginas vistas e eventos para a função `site-visitas`, que
 * grava em `site_sessions` (uma visita) e `site_events` (páginas e eventos);
 * daqui se leem essas tabelas e o relatório do período (`site_report`).
 * Migração `20261025180000_site_visitas.sql`.
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
  pageviews: number
  events: number
  activeMs: number
  converted: boolean
  conversions: string[]
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
  try {
    const response = await fetch(VISITAS_ENDPOINT, { method: 'GET', cache: 'no-store' })
    if (response.ok) return 'ok'
    if (response.status === 404) return 'missing'
    if (response.status === 401) return 'jwt'
    return 'error'
  } catch {
    return 'error'
  }
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
}

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

/** `America/Sao_Paulo` vira `Sao Paulo` */
export const tzLabel = (tz: string | null | undefined) => (tz ? tz.split('/').pop()!.replace(/_/g, ' ') : 'Não identificado')

export const shareOf = (part: number, whole: number) => (whole > 0 ? part / whole : 0)
export const percentText = (value: number) => `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: value < 0.1 ? 1 : 0 })}%`
