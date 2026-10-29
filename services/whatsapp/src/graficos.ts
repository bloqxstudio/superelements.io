import type { SupabaseClient } from '@supabase/supabase-js'
import { Resvg } from '@resvg/resvg-js'
import type { Period } from './comandos.ts'

/**
 * Gráficos para mandar como foto no WhatsApp: SVG desenhado aqui e convertido em PNG (sem navegador).
 * Só leitura (recebe o cliente do banco já protegido). O visual segue a Avence: papel, tinta e um azul só no destaque.
 */

type Db = SupabaseClient

export type ChartKind = 'site_dia' | 'site_hora' | 'origens' | 'anuncios_dia' | 'estados'
export const CHART_KINDS: ChartKind[] = ['site_dia', 'site_hora', 'origens', 'anuncios_dia', 'estados']

const PAPER = '#F3F1EC'
const INK = '#111111'
const MUTED = '#66625A'
const LINE = '#DCD8CF'
const BLUE = '#2B3CF0'
const FONT = 'Helvetica, Arial, sans-serif'

const esc = (t: string) => t.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)
const int = (n: number) => Math.round(n).toLocaleString('pt-BR')

interface Bar {
  label: string
  value: number
  /** Parte destacada em azul (ex.: os contatos dentro das visitas) */
  accent?: number
}

interface ChartSpec {
  title: string
  subtitle: string
  bars: Bar[]
  /** Texto à direita do título (ex.: o total) */
  total?: string
  legend?: string
  horizontal?: boolean
  format?: (n: number) => string
}

function svgOf(spec: ChartSpec): string {
  const W = 1000
  const bars = spec.bars
  const fmt = spec.format ?? int
  const header = `
    <text x="48" y="78" font-family="${FONT}" font-size="38" font-weight="700" fill="${INK}">${esc(spec.title)}</text>
    <text x="48" y="112" font-family="${FONT}" font-size="22" fill="${MUTED}">${esc(spec.subtitle)}</text>
    ${spec.total ? `<text x="${W - 48}" y="78" text-anchor="end" font-family="${FONT}" font-size="38" font-weight="700" fill="${BLUE}">${esc(spec.total)}</text>` : ''}
    ${spec.legend ? `<text x="${W - 48}" y="112" text-anchor="end" font-family="${FONT}" font-size="20" fill="${MUTED}">${esc(spec.legend)}</text>` : ''}`
  const max = Math.max(1, ...bars.map((b) => b.value))
  if (spec.horizontal) {
    const H = W
    const rowH = Math.min(92, (H - 160 - 90) / Math.max(1, bars.length))
    const left = 270
    const right = W - 140
    const rows = bars
      .map((b, i) => {
        const y = 160 + i * rowH
        const w = Math.max(b.value > 0 ? 4 : 0, ((right - left) * b.value) / max)
        return `<text x="48" y="${y + rowH / 2 + 8}" font-family="${FONT}" font-size="26" fill="${INK}">${esc(b.label.slice(0, 20))}</text>
        <rect x="${left}" y="${y + rowH * 0.15}" width="${w}" height="${rowH * 0.6}" fill="${INK}"/>
        ${b.accent ? `<rect x="${left}" y="${y + rowH * 0.15}" width="${Math.max(4, ((right - left) * b.accent) / max)}" height="${rowH * 0.6}" fill="${BLUE}"/>` : ''}
        <text x="${left + w + 12}" y="${y + rowH / 2 + 8}" font-family="${FONT}" font-size="26" font-weight="700" fill="${INK}">${fmt(b.value)}</text>`
      })
      .join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${PAPER}"/>${header}${rows}${footer(W, H)}</svg>`
  }
  const H = W
  const top = 170
  const base = H - 100
  const left = 48
  const right = W - 48
  const slot = (right - left) / Math.max(1, bars.length)
  const barW = Math.min(64, slot * 0.7)
  // Rótulos: com muitas barras, só alguns
  const every = Math.ceil(bars.length / 12)
  const peak = bars.reduce((best, b, i) => (b.value > bars[best].value ? i : best), 0)
  const body = bars
    .map((b, i) => {
      const h = ((base - top - 30) * b.value) / max
      const x = left + i * slot + (slot - barW) / 2
      const showValue = bars.length <= 12 || i === peak
      return `<rect x="${x}" y="${base - h}" width="${barW}" height="${h}" fill="${INK}"/>
      ${b.accent ? `<rect x="${x}" y="${base - ((base - top - 30) * b.accent) / max}" width="${barW}" height="${((base - top - 30) * b.accent) / max}" fill="${BLUE}"/>` : ''}
      ${showValue && b.value > 0 ? `<text x="${x + barW / 2}" y="${base - h - 10}" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="700" fill="${INK}">${fmt(b.value)}</text>` : ''}
      ${i % every === 0 ? `<text x="${x + barW / 2}" y="${base + 30}" text-anchor="middle" font-family="${FONT}" font-size="22" fill="${MUTED}">${esc(b.label)}</text>` : ''}`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${PAPER}"/>${header}<line x1="${left}" y1="${base}" x2="${right}" y2="${base}" stroke="${LINE}" stroke-width="2"/>${body}${footer(W, H)}</svg>`
}

const footer = (W: number, H: number) =>
  `<text x="48" y="${H - 22}" font-family="${FONT}" font-size="22" font-weight="700" fill="${INK}">avence</text><rect x="${48 + 82}" y="${H - 29}" width="8" height="8" fill="${BLUE}"/>`

function png(spec: ChartSpec): Buffer {
  const resvg = new Resvg(svgOf(spec), { fitTo: { mode: 'width', value: 1000 }, font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica' } })
  return resvg.render().asPng()
}

const fmtDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const when = (period: Period) => period.label

interface SiteReport {
  totals?: { sessions?: number; converted?: number }
  days?: { day: string; sessions: number; converted: number }[]
  hours?: { dow: number; hour: number; sessions: number }[]
  channels?: { channel: string; sessions: number; converted: number }[]
  regions?: { name: string; region: string; sessions: number; converted: number }[]
}

async function siteReport(db: Db, teamId: string, period: Period): Promise<SiteReport | undefined> {
  const { data: trackers } = await db.from('site_trackers').select('id').eq('team_id', teamId).limit(1)
  const id = trackers?.[0]?.id as string | undefined
  if (!id) return undefined
  const { data, error } = await db.rpc('site_report', { p_site: id, p_from: period.from.toISOString(), p_to: period.to.toISOString() })
  return error ? undefined : (data as SiteReport)
}

/** O gráfico pedido, com os dados da conta no período; `undefined` quando não há o que desenhar */
export async function makeChart(db: Db, teamId: string, kind: ChartKind, period: Period): Promise<Buffer | undefined> {
  if (kind === 'anuncios_dia') {
    const { data: accounts } = await db.from('crm_ad_accounts').select('id, currency').eq('team_id', teamId).limit(1)
    const account = accounts?.[0]
    if (!account) return undefined
    const { data: report } = await db.from('crm_ad_reports').select('data').eq('account_id', account.id).eq('preset', period.preset).maybeSingle()
    const days = ((report?.data as { days?: { day: string; metrics?: { spend?: number } }[] } | undefined)?.days ?? []).filter((d) => d.day >= period.from.toISOString().slice(0, 10) || period.preset !== 'last_7d')
    if (!days.length) return undefined
    const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: (account.currency as string) || 'BRL', maximumFractionDigits: n >= 100 ? 0 : 2 })
    const bars = days.map((d) => ({ label: fmtDay(d.day), value: d.metrics?.spend ?? 0 }))
    const total = bars.reduce((s, b) => s + b.value, 0)
    return png({ title: 'Gasto com anúncios por dia', subtitle: period.preset === 'this_month' ? 'Este mês' : `Últimos ${period.preset === 'last_7d' ? 7 : period.preset === 'last_30d' ? 30 : 90} dias`, bars, total: money(total), format: money })
  }
  const report = await siteReport(db, teamId, period)
  if (!report) return undefined
  const visits = report.totals?.sessions ?? 0
  const contacts = report.totals?.converted ?? 0
  if (kind === 'site_dia') {
    const days = report.days ?? []
    if (!days.length) return undefined
    return png({ title: 'Visitas por dia', subtitle: `${when(period)} · em azul, quem chamou no WhatsApp, telefone ou formulário`, bars: days.map((d) => ({ label: fmtDay(d.day), value: d.sessions, accent: d.converted })), total: `${int(visits)} visitas`, legend: `${int(contacts)} contatos` })
  }
  if (kind === 'site_hora') {
    const byHour = new Array(24).fill(0) as number[]
    for (const h of report.hours ?? []) byHour[h.hour] += h.sessions
    if (!byHour.some(Boolean)) return undefined
    return png({ title: 'Visitas por hora', subtitle: when(period), bars: byHour.map((v, i) => ({ label: `${i}h`, value: v })), total: `${int(visits)} visitas` })
  }
  if (kind === 'estados') {
    const regions = (report.regions ?? []).filter((r) => r.name || r.region).slice(0, 8)
    if (!regions.length) return undefined
    return png({ title: 'Visitas por estado', subtitle: `${when(period)} · em azul, quem chamou`, bars: regions.map((r) => ({ label: r.name || r.region, value: r.sessions, accent: r.converted })), total: `${int(visits)} visitas`, horizontal: true })
  }
  const channels = (report.channels ?? []).slice(0, 6)
  if (!channels.length) return undefined
  return png({ title: 'De onde vieram as visitas', subtitle: `${when(period)} · em azul, quem chamou`, bars: channels.map((c) => ({ label: c.channel, value: c.sessions, accent: c.converted })), total: `${int(visits)} visitas`, horizontal: true })
}
