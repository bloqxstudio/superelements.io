import { STAGES, OPEN_STAGES, valueOf } from '../prospects/funnel.ts'
import type { FunnelSettings, Opportunity, Stage } from '../prospects/funnel.ts'

/**
 * As contas da Home interna, sem tela e sem banco: período e comparação, resumo do
 * funil, o caminho campanha → visitas → contatos → oportunidades, os pontos de
 * atenção e a linha de eventos. Só lê o que já está nas telas do produto e nunca
 * completa o que falta: sem gasto, sem vínculo ou sem base equivalente o resultado
 * é `undefined`, não zero. Roda também no Node (`scripts/tests/home-derive.test.mjs`):
 * imports relativos com `.ts` e sintaxe apagável.
 */

// ---------- período ----------

export interface Window {
  days: number
  from: number
  to: number
  /** O período anterior, do mesmo tamanho: a única base equivalente para comparar */
  prevFrom: number
  prevTo: number
}

/** Do começo do primeiro dia (no fuso de quem abre) até agora, como o `site_report` conta. */
export function windowOf(days: number, now = Date.now()): Window {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))
  const from = start.getTime()
  return { days, from, to: now, prevFrom: days === 1 ? from - 86_400_000 : from - (now - from), prevTo: from }
}

const within = (t: number | undefined, from: number, to: number) => t !== undefined && Number.isFinite(t) && t >= from && t < to

/** Variação contra o período anterior; sem base (zero antes) não há percentual a mostrar. */
export function delta(now: number, before: number | undefined): { diff: number; pct?: number } | undefined {
  if (before === undefined) return undefined
  return { diff: now - before, pct: before > 0 ? (now - before) / before : undefined }
}

// ---------- oportunidades ----------

const num = (iso: string | undefined) => (iso ? Date.parse(iso) : NaN)

/** Quando foi ganha: só conta quem está fechada agora (voltou de etapa, deixou de ser ganha). */
export function wonAt(o: Pick<Opportunity, 'stage' | 'history' | 'updatedAt'>): number | undefined {
  if (o.stage !== 'fechado') return undefined
  const entry = [...o.history].reverse().find((h) => h.stage === 'fechado')
  const at = num(entry?.at ?? o.updatedAt)
  return Number.isFinite(at) ? at : undefined
}

/** `Meta Ads`, `Google Ads`…; o cartão sem origem veio da Prospecção ou foi cadastrado à mão. */
export const NO_ORIGIN = 'Prospecção ou cadastro da equipe'
export const originChannel = (o: Pick<Opportunity, 'origin'>) => o.origin?.channel || NO_ORIGIN

export interface OpportunitySummary {
  created: number
  createdBefore: number
  /** Dos criados no período, os que entraram por formulário/webhook e os da prospecção */
  inbound: number
  prospected: number
  won: number
  wonBefore: number
  /** Valor da oferta das ganhas: previsão do funil, não receita recebida */
  wonOfferValue: number
  open: number
  openOfferValue: number
  byStage: { id: Stage; label: string; count: number }[]
  byOrigin: { label: string; count: number }[]
}

export function summarizeOpportunities(list: Opportunity[], w: Window, settings: FunnelSettings): OpportunitySummary {
  const created = list.filter((o) => within(num(o.createdAt), w.from, w.to))
  const won = list.filter((o) => within(wonAt(o), w.from, w.to))
  const origins = new Map<string, number>()
  for (const o of created) origins.set(originChannel(o), (origins.get(originChannel(o)) ?? 0) + 1)
  const open = list.filter((o) => OPEN_STAGES.includes(o.stage))
  return {
    created: created.length,
    createdBefore: list.filter((o) => within(num(o.createdAt), w.prevFrom, w.prevTo)).length,
    inbound: created.filter((o) => !!o.origin).length,
    prospected: created.filter((o) => !o.origin).length,
    won: won.length,
    wonBefore: list.filter((o) => within(wonAt(o), w.prevFrom, w.prevTo)).length,
    wonOfferValue: won.reduce((sum, o) => sum + valueOf(o, settings).total, 0),
    open: open.length,
    openOfferValue: open.reduce((sum, o) => sum + valueOf(o, settings).total, 0),
    byStage: STAGES.map((s) => ({ id: s.id, label: s.label, count: list.filter((o) => o.stage === s.id).length })),
    byOrigin: [...origins].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
  }
}

// ---------- pontos de atenção ----------

export interface Attention {
  id: string
  /** `lead`: sem responsável; `parado`: novo e sem movimento; `passo`: sem próximo passo; `atrasado`: o passo passou do dia */
  kind: 'lead' | 'parado' | 'passo' | 'atrasado'
  oppId: string
  name: string
  reason: string
}

const HOUR = 3_600_000
/** Etapas de conversa: a prospecção em massa (Mapeado, Fila da página) não precisa de próximo passo por cartão. */
const NEEDS_NEXT: Stage[] = ['pagina', 'contatado', 'conversa', 'proposta']

/** Critérios fixos e explicados no próprio aviso; nada de recomendação sem regra. */
export function attentionOf(list: Opportunity[], now = Date.now()): Attention[] {
  const out: Attention[] = []
  const today = new Date(now)
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  for (const o of list) {
    const name = o.lead.name
    if (o.stage === 'novo') {
      if (!o.ownerId) out.push({ id: `lead:${o.id}`, kind: 'lead', oppId: o.id, name, reason: 'Entrou como novo lead e ainda não tem responsável.' })
      const age = now - num(o.updatedAt)
      if (age > 24 * HOUR) out.push({ id: `parado:${o.id}`, kind: 'parado', oppId: o.id, name, reason: `Continua como novo lead, sem mudança há ${Math.floor(age / (24 * HOUR))} dia(s).` })
    }
    if (NEEDS_NEXT.includes(o.stage)) {
      if (!o.nextStep) out.push({ id: `passo:${o.id}`, kind: 'passo', oppId: o.id, name, reason: 'Está em andamento e não tem próximo passo anotado.' })
      else if (o.nextDate && o.nextDate < todayKey) out.push({ id: `atrasado:${o.id}`, kind: 'atrasado', oppId: o.id, name, reason: `O próximo passo era para ${o.nextDate.split('-').reverse().join('/')}: ${o.nextStep}` })
    }
  }
  const rank = { lead: 0, atrasado: 1, parado: 2, passo: 3 }
  return out.sort((a, b) => rank[a.kind] - rank[b.kind])
}

// ---------- campanhas → visitas → contatos → oportunidades ----------

export interface MetaCampaignInput {
  id: string
  name: string
  currency: string
  status?: string
  spend: number
  impressions: number
  linkClicks: number
  /** O resultado que a própria Meta conta (formulário, conversa…), com o nome dele */
  result?: { label: string; value: number }
}

export interface SiteRowInput {
  channel: string
  campaign: string | null
  campaignId: string | null
  sessions: number
  converted: number
  forms: number
  qualified: number
}

export interface CampaignRow {
  key: string
  name: string
  /** Onde a campanha aparece: a Meta (com gasto), o site (visitas com UTM) ou o funil (leads com origem) */
  from: { meta: boolean; site: boolean; funnel: boolean }
  channel: string
  currency?: string
  /** Gasto da Meta no período; `undefined` quando a plataforma não dá gasto (Google Ads) */
  spend?: number
  linkClicks?: number
  metaResult?: { label: string; value: number }
  status?: string
  sessions: number
  contacts: number
  forms: number
  leads: Opportunity[]
  won: number
  /** O vínculo foi feito pelo id da campanha ou só pelo nome no link (UTM) */
  matchedBy: 'id' | 'nome'
}

export const norm = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const utmCampaign = (o: Opportunity) => o.origin?.campaign?.name ?? o.origin?.utm?.utm_campaign ?? o.origin?.utm?.campaign
const campaignIdOf = (o: Opportunity) => o.origin?.campaign?.id ?? o.origin?.ids?.campaign_id ?? o.origin?.ids?.utm_id

export const NO_NAME = 'Sem nome de campanha no link'

export function campaignChain(meta: MetaCampaignInput[], rows: SiteRowInput[], opps: Opportunity[], w: Window): CampaignRow[] {
  const map = new Map<string, CampaignRow>()
  const byId = new Map<string, CampaignRow>()
  const blank = (key: string, name: string, channel: string): CampaignRow => ({
    key, name, channel, from: { meta: false, site: false, funnel: false }, sessions: 0, contacts: 0, forms: 0, leads: [], won: 0, matchedBy: 'nome',
  })

  for (const c of meta) {
    if (c.spend <= 0 && c.linkClicks <= 0) continue
    const row = blank(`m:${c.id}`, c.name, 'Meta Ads')
    row.from.meta = true
    row.currency = c.currency
    row.spend = c.spend
    row.linkClicks = c.linkClicks
    row.metaResult = c.result
    row.status = c.status
    map.set(row.key, row)
    byId.set(c.id, row)
  }
  const find = (id: string | null | undefined, name: string | null | undefined) => {
    const n = norm(name)
    const hit = (id && byId.get(id)) || (n ? [...map.values()].find((r) => norm(r.name) === n) : undefined)
    return hit ? { row: hit, by: id && byId.get(id) === hit ? ('id' as const) : ('nome' as const) } : undefined
  }
  const make = (name: string | null | undefined, channel: string) => {
    const label = name?.trim() || NO_NAME
    const key = `u:${channel}:${norm(label)}`
    let row = map.get(key)
    if (!row) map.set(key, (row = blank(key, label, channel)))
    return row
  }

  for (const s of rows) {
    // Visita de ninguém (sem canal pago e sem campanha) não é campanha
    if (!s.campaign && !/ads/i.test(s.channel)) continue
    const hit = find(s.campaignId, s.campaign)
    const row = hit?.row ?? make(s.campaign, s.channel)
    if (hit?.by === 'id') row.matchedBy = 'id'
    row.from.site = true
    row.sessions += s.sessions
    row.contacts += s.converted
    row.forms += s.forms
  }

  for (const o of opps) {
    if (!o.origin || !within(num(o.createdAt), w.from, w.to)) continue
    const name = utmCampaign(o)
    if (!name && !o.origin.paid) continue
    const hit = find(campaignIdOf(o), name)
    const row = hit?.row ?? make(name, o.origin.channel)
    if (hit?.by === 'id') row.matchedBy = 'id'
    row.from.funnel = true
    row.leads.push(o)
    if (o.stage === 'fechado') row.won += 1
  }

  return [...map.values()].sort((a, b) => (b.spend ?? -1) - (a.spend ?? -1) || b.sessions - a.sessions || b.leads.length - a.leads.length)
}

/** Gasto por moeda: moedas diferentes nunca se somam. */
export function spendByCurrency(reports: { currency: string; spend: number }[]): { currency: string; spend: number }[] {
  const by = new Map<string, number>()
  for (const r of reports) by.set(r.currency, (by.get(r.currency) ?? 0) + r.spend)
  return [...by].map(([currency, spend]) => ({ currency, spend }))
}

// ---------- frescor do dado ----------

export type Freshness = 'atualizado' | 'atrasado'

/** Dado que só muda quando alguém sincroniza: até `freshMs` de idade está atualizado, depois atrasado. */
export const freshnessOf = (at: number | undefined, freshMs: number, now = Date.now()): Freshness | undefined =>
  at === undefined ? undefined : now - at <= freshMs ? 'atualizado' : 'atrasado'

// ---------- linha de eventos ----------

export interface FeedEvent {
  id: string
  at: number
  kind: 'contato' | 'lead' | 'etapa' | 'publicado' | 'aprovacao'
  title: string
  detail?: string
  /** Onde abrir o registro de origem */
  href?: string
}

export interface ActivityInput {
  id: string
  oppId: string
  kind: 'created' | 'stage'
  at: number
  from?: Stage
  to?: Stage
}

const order = STAGES.map((s) => s.id)
const stageLabel = (id: Stage | undefined) => STAGES.find((s) => s.id === id)?.label ?? id ?? ''

export function activityEvents(acts: ActivityInput[], opps: Opportunity[]): FeedEvent[] {
  const byId = new Map(opps.map((o) => [o.id, o]))
  const out: FeedEvent[] = []
  for (const a of acts) {
    const o = byId.get(a.oppId)
    if (!o) continue
    const href = `/crm?oportunidade=${o.id}`
    if (a.kind === 'created') {
      const where = o.origin ? [originChannel(o), o.origin.campaign?.name ?? o.origin.utm?.utm_campaign, o.origin.form].filter(Boolean).join(' · ') : NO_ORIGIN
      out.push({ id: a.id, at: a.at, kind: 'lead', title: `Nova oportunidade: ${o.lead.name}`, detail: where, href })
    } else if (a.to) {
      const forward = a.from ? order.indexOf(a.to) > order.indexOf(a.from) : true
      const title = a.to === 'fechado' ? `${o.lead.name} foi ganha` : a.to === 'perdido' ? `${o.lead.name} foi marcada como perdida` : forward ? `${o.lead.name} avançou para ${stageLabel(a.to)}` : `${o.lead.name} voltou para ${stageLabel(a.to)}`
      out.push({ id: a.id, at: a.at, kind: 'etapa', title, detail: a.from ? `De ${stageLabel(a.from)}` : undefined, href })
    }
  }
  return out
}

export const byRecent = (a: { at: number }, b: { at: number }) => b.at - a.at

/** Dois dias antes, no formato curto, para o texto do período. */
export const shortDay = (ms: number) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
