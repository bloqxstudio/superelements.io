import { compact, percent } from './instagram'
import { contactsOf, money, resultLabel, type AdCampaign, type AdCreative, type AdMetrics, type AdReport } from './ads'

/**
 * As métricas da aba Anúncios com os nomes do Gerenciador de Anúncios da Meta
 * (Valor usado, Resultados, CTR (taxa de cliques no link)…), para escolher o
 * que cada destaque e o gráfico mostram, e as contas do filtro de campanhas:
 * a tela soma só as campanhas escolhidas a partir dos números de cada uma que
 * o relatório guarda, sem ler a Meta de novo.
 */

/** Os números de um conjunto (conta, campanhas escolhidas ou um dia), com os resultados somados. */
export interface Bag extends AdMetrics {
  results: number
  /** Tipo do resultado; `mixed` quando as campanhas têm resultados diferentes */
  resultType?: string
}

const zero = (): AdMetrics => ({ spend: 0, impressions: 0, clicks: 0, linkClicks: 0, leads: 0, conversations: 0, actions: {} })

/** Soma números; o alcance soma também (entre campanhas é uma aproximação: a mesma pessoa conta duas vezes). */
export function sumMetrics(list: AdMetrics[]): AdMetrics {
  const out = zero()
  let reach: number | undefined
  for (const m of list) {
    out.spend += m.spend
    out.impressions += m.impressions
    out.clicks += m.clicks
    out.linkClicks += m.linkClicks
    out.leads += m.leads
    out.conversations += m.conversations
    if (m.reach !== undefined) reach = (reach ?? 0) + m.reach
    for (const [type, value] of Object.entries(m.actions ?? {})) out.actions![type] = (out.actions![type] ?? 0) + value
  }
  if (reach !== undefined) {
    out.reach = reach
    out.frequency = reach ? out.impressions / reach : undefined
  }
  return out
}

const action = (b: AdMetrics, type: string) => b.actions?.[type] ?? 0
const per = (a: number | undefined, b: number | undefined) => (a !== undefined && b ? a / b : undefined)

export type MetricKind = 'money' | 'count' | 'percent' | 'decimal'

export interface MetricDef {
  key: string
  /** Nome do Gerenciador de Anúncios */
  label: string
  /** Nome curto para o destaque */
  short?: string
  group: string
  kind: MetricKind
  get: (b: Bag) => number | undefined
  /** Contexto embaixo do número no destaque */
  sub?: (b: Bag, ctx: SubContext) => string | undefined
}

export interface SubContext {
  currency: string
  days: number
  /** Alcance somado de mais de uma campanha */
  approximateReach: boolean
}

const LPV = 'landing_page_view'
const ENGAGEMENT = 'post_engagement'
const VIDEO = 'video_view'

export const METRICS: MetricDef[] = [
  {
    key: 'spend',
    label: 'Valor usado',
    group: 'Desempenho',
    kind: 'money',
    get: (b) => b.spend,
    sub: (b, c) => `${money(b.spend / Math.max(1, c.days), c.currency)} por dia em média`,
  },
  {
    key: 'results',
    label: 'Resultados',
    group: 'Desempenho',
    kind: 'count',
    get: (b) => b.results,
    sub: (b) => (b.resultType === 'mixed' ? 'tipos diferentes somados' : b.resultType ? resultLabel(b.resultType, b.results) : 'sem resultado no período'),
  },
  {
    key: 'cost_per_result',
    label: 'Custo por resultado',
    group: 'Desempenho',
    kind: 'money',
    get: (b) => (b.resultType === 'mixed' ? undefined : per(b.spend, b.results)),
    sub: (b) => (b.resultType === 'mixed' ? 'resultados de tipos diferentes' : b.resultType ? `por ${resultLabel(b.resultType, 1)}` : undefined),
  },
  {
    key: 'reach',
    label: 'Alcance',
    group: 'Desempenho',
    kind: 'count',
    get: (b) => b.reach,
    sub: (b, c) => (c.approximateReach ? 'soma das campanhas escolhidas' : b.frequency ? `${b.frequency.toFixed(2).replace('.', ',')} vezes por pessoa` : 'pessoas diferentes'),
  },
  { key: 'impressions', label: 'Impressões', group: 'Desempenho', kind: 'count', get: (b) => b.impressions, sub: (b, c) => `CPM ${money(per(b.spend * 1000, b.impressions), c.currency)}` },
  { key: 'frequency', label: 'Frequência', group: 'Desempenho', kind: 'decimal', get: (b) => b.frequency, sub: () => 'impressões por pessoa alcançada' },
  { key: 'cpm', label: 'CPM (custo por 1.000 impressões)', short: 'CPM', group: 'Desempenho', kind: 'money', get: (b) => per(b.spend * 1000, b.impressions), sub: (b) => `${compact(b.impressions)} impressões` },

  {
    key: 'contacts',
    label: 'Contatos (leads + conversas)',
    short: 'Contatos',
    group: 'Contatos',
    kind: 'count',
    get: (b) => contactsOf(b),
    sub: (b) => `${b.leads} ${b.leads === 1 ? 'lead' : 'leads'}, ${b.conversations} ${b.conversations === 1 ? 'conversa' : 'conversas'}`,
  },
  { key: 'cost_per_contact', label: 'Custo por contato', group: 'Contatos', kind: 'money', get: (b) => per(b.spend, contactsOf(b)), sub: (b) => `${compact(contactsOf(b))} contatos` },
  { key: 'leads', label: 'Leads', group: 'Contatos', kind: 'count', get: (b) => b.leads, sub: (b, c) => (b.leads ? `${money(b.spend / b.leads, c.currency)} por lead` : 'formulário da Meta e site') },
  { key: 'cost_per_lead', label: 'Custo por lead', group: 'Contatos', kind: 'money', get: (b) => per(b.spend, b.leads), sub: (b) => `${compact(b.leads)} leads` },
  {
    key: 'conversations',
    label: 'Conversas por mensagem iniciadas',
    short: 'Conversas iniciadas',
    group: 'Contatos',
    kind: 'count',
    get: (b) => b.conversations,
    sub: (b, c) => (b.conversations ? `${money(b.spend / b.conversations, c.currency)} por conversa` : 'WhatsApp, Direct e Messenger'),
  },
  {
    key: 'cost_per_conversation',
    label: 'Custo por conversa por mensagem iniciada',
    short: 'Custo por conversa',
    group: 'Contatos',
    kind: 'money',
    get: (b) => per(b.spend, b.conversations),
    sub: (b) => `${compact(b.conversations)} conversas`,
  },

  {
    key: 'link_clicks',
    label: 'Cliques no link',
    group: 'Cliques',
    kind: 'count',
    get: (b) => b.linkClicks,
    sub: (b, c) => `CTR ${percent(per(b.linkClicks, b.impressions))} · ${money(per(b.spend, b.linkClicks), c.currency)} por clique`,
  },
  { key: 'ctr', label: 'CTR (taxa de cliques no link)', short: 'CTR (link)', group: 'Cliques', kind: 'percent', get: (b) => per(b.linkClicks, b.impressions), sub: (b) => `${compact(b.linkClicks)} cliques em ${compact(b.impressions)} impressões` },
  { key: 'cpc', label: 'CPC (custo por clique no link)', short: 'CPC (link)', group: 'Cliques', kind: 'money', get: (b) => per(b.spend, b.linkClicks), sub: (b) => `${compact(b.linkClicks)} cliques no link` },
  { key: 'clicks', label: 'Cliques (todos)', group: 'Cliques', kind: 'count', get: (b) => b.clicks, sub: (b) => `CTR (todos) ${percent(per(b.clicks, b.impressions))}` },
  { key: 'ctr_all', label: 'CTR (todos)', group: 'Cliques', kind: 'percent', get: (b) => per(b.clicks, b.impressions), sub: (b) => `${compact(b.clicks)} cliques` },
  { key: 'cpc_all', label: 'CPC (todos)', group: 'Cliques', kind: 'money', get: (b) => per(b.spend, b.clicks), sub: (b) => `${compact(b.clicks)} cliques` },
  {
    key: 'landing_page_views',
    label: 'Visualizações da página de destino',
    short: 'Visualizações da página',
    group: 'Cliques',
    kind: 'count',
    get: (b) => action(b, LPV),
    sub: (b, c) => (action(b, LPV) ? `${money(b.spend / action(b, LPV), c.currency)} por visualização` : 'página carregada depois do clique'),
  },
  {
    key: 'cost_per_landing_page_view',
    label: 'Custo por visualização da página de destino',
    short: 'Custo por visualização da página',
    group: 'Cliques',
    kind: 'money',
    get: (b) => per(b.spend, action(b, LPV)),
    sub: (b) => `${compact(action(b, LPV))} visualizações`,
  },

  {
    key: 'post_engagement',
    label: 'Engajamento com a publicação',
    short: 'Engajamento',
    group: 'Engajamento',
    kind: 'count',
    get: (b) => action(b, ENGAGEMENT),
    sub: (b, c) => (action(b, ENGAGEMENT) ? `${money(b.spend / action(b, ENGAGEMENT), c.currency)} por engajamento` : undefined),
  },
  {
    key: 'video_views',
    label: 'Reproduções de vídeo de 3 segundos',
    short: 'Reproduções de 3 s',
    group: 'Engajamento',
    kind: 'count',
    get: (b) => action(b, VIDEO),
    sub: (b, c) => (action(b, VIDEO) ? `${money(b.spend / action(b, VIDEO), c.currency)} por reprodução` : undefined),
  },
]

export const METRIC = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<string, MetricDef>
export const METRIC_GROUPS = [...new Set(METRICS.map((m) => m.group))]

export const DEFAULT_TILES = ['spend', 'results', 'cost_per_result', 'reach', 'link_clicks', 'ctr']
export const DEFAULT_CHART = 'spend'

export function formatMetric(def: MetricDef, value: number | undefined, currency: string, short = false) {
  if (value === undefined || !Number.isFinite(value)) return '—'
  if (def.kind === 'money') return money(value, currency, short)
  if (def.kind === 'percent') return percent(value, 2)
  if (def.kind === 'decimal') return value.toFixed(2).replace('.', ',')
  return compact(value)
}

// ---------- filtro de campanhas ----------

export interface Slice {
  key: string
  metrics: AdMetrics
}

export interface AdView {
  totals: Bag
  days: { day: string; bag: Bag }[]
  campaigns: AdCampaign[]
  platforms: Slice[]
  ages: Slice[]
  genders: Slice[]
  regions: Slice[]
  ads: AdCreative[]
  /** Alcance somado de mais de uma campanha (aproximado) */
  approximateReach: boolean
}

const group = <T>(rows: T[], key: (r: T) => string, metrics: (r: T) => AdMetrics): Slice[] => {
  const map = new Map<string, AdMetrics[]>()
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), metrics(r)])
  return [...map.entries()].map(([k, list]) => ({ key: k, metrics: sumMetrics(list) })).sort((a, b) => b.metrics.spend - a.metrics.spend)
}

/** Os dias de `since` a `until` (`2026-10-18`), para o gráfico não pular os dias sem anúncio. */
function dayRange(since: string | null, until: string | null, present: string[]) {
  if (!since || !until) return [...new Set(present)].sort()
  const out: string[] = []
  const end = new Date(`${until}T12:00:00Z`)
  for (let d = new Date(`${since}T12:00:00Z`); d <= end && out.length < 400; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10))
  return out
}

/** O relatório visto só pelas campanhas escolhidas (`null`: todas, com o alcance exato da conta). */
export function viewOf(report: AdReport, selected: string[] | null): AdView {
  const chosen = selected ? new Set(selected) : null
  const pick = (id: string | undefined) => !chosen || (!!id && chosen.has(id))
  const campaigns = report.campaigns.filter((c) => pick(c.id))

  const withResult = campaigns.filter((c) => c.result)
  const types = new Set(withResult.map((c) => c.result!.type))
  const resultType = types.size === 1 ? [...types][0] : types.size ? 'mixed' : undefined
  const results = withResult.reduce((sum, c) => sum + c.result!.value, 0)
  const base = chosen ? sumMetrics(campaigns.map((c) => c.metrics)) : report.totals
  const totals: Bag = { ...base, actions: base.actions ?? {}, results, resultType }

  const campaignDays = report.campaignDays.filter((r) => pick(r.campaignId))
  const accountDays = new Map(report.days.map((d) => [d.day, d.metrics]))
  const byDay = new Map<string, { list: AdMetrics[]; results: number }>()
  for (const r of campaignDays) {
    const entry = byDay.get(r.day) ?? { list: [], results: 0 }
    entry.list.push(r.metrics)
    entry.results += r.result ?? 0
    byDay.set(r.day, entry)
  }
  // Sem os dias por campanha (a Meta não devolveu), o total da conta por dia
  const useAccount = !chosen && !report.campaignDays.length
  const days = dayRange(report.since, report.until, [...accountDays.keys(), ...byDay.keys()]).map((day) => {
    const entry = byDay.get(day)
    const metrics = useAccount ? (accountDays.get(day) ?? zero()) : sumMetrics(entry?.list ?? [])
    if (!chosen) {
      const exact = accountDays.get(day)
      metrics.reach = exact?.reach ?? metrics.reach
      metrics.frequency = exact?.frequency ?? metrics.frequency
    }
    return { day, bag: { ...metrics, actions: metrics.actions ?? {}, results: entry?.results ?? 0, resultType } }
  })

  const live = campaigns.filter((c) => c.metrics.impressions > 0)
  return {
    totals,
    days,
    campaigns,
    platforms: group(report.platforms.filter((r) => pick(r.campaignId)), (r) => r.key, (r) => r.metrics),
    ages: group(report.audience.filter((r) => pick(r.campaignId)), (r) => r.age, (r) => r.metrics).sort((a, b) => a.key.localeCompare(b.key)),
    genders: group(report.audience.filter((r) => pick(r.campaignId)), (r) => r.gender, (r) => r.metrics),
    regions: group(report.regions.filter((r) => pick(r.campaignId)), (r) => r.key, (r) => r.metrics),
    ads: report.ads.filter((a) => pick(a.campaignId)),
    approximateReach: !!chosen && live.length > 1,
  }
}

// ---------- escolhas guardadas neste navegador ----------

const TILES_KEY = 'se:anuncios:destaques'
const CHART_KEY = 'se:anuncios:grafico'

export function savedTiles(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(TILES_KEY) ?? 'null') as unknown
    if (Array.isArray(list) && list.length === DEFAULT_TILES.length && list.every((k) => typeof k === 'string' && METRIC[k])) return list as string[]
  } catch {
    // sem armazenamento: o padrão
  }
  return DEFAULT_TILES
}

export function saveTiles(list: string[]) {
  try {
    localStorage.setItem(TILES_KEY, JSON.stringify(list))
  } catch {
    // sem armazenamento: vale só nesta visita
  }
}

export function savedChart(): string {
  try {
    const key = localStorage.getItem(CHART_KEY)
    if (key && METRIC[key]) return key
  } catch {
    // sem armazenamento: o padrão
  }
  return DEFAULT_CHART
}

export function saveChart(key: string) {
  try {
    localStorage.setItem(CHART_KEY, key)
  } catch {
    // sem armazenamento: vale só nesta visita
  }
}
