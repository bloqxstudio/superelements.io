import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as typed } from '@/integrations/supabase/client'
import { loadAdAccounts, loadAdReport, NoAdTablesError, type AdAccount, type AdPreset, type AdReport } from '@/features/crm/ads'
import { listForms, FormsTablesError, type CrmForm } from '@/features/crm/forms'
import { dayKeyOf, loadReportRange, loadTrackers, NoSiteTablesError, periodRange, type SiteReport, type SiteTracker } from '@/features/crm/site'
import {
  approxCampaignOnly,
  campaignMatch,
  campaignMatches,
  cleanStep,
  cohortRuleOf,
  inCohort,
  isConnected,
  isIntentEvent,
  matchPage,
  salesOf,
  stageCount,
  sumAds,
  validateFunnel,
  type FunnelStep,
  type OppLite,
  type Reading,
} from './rules.ts'

/**
 * Funis (CRM › Funis): a configuração fica em `crm_funnels` e `crm_funnel_steps` (migração
 * 20261030120000); os números são lidos na hora das fontes reais, com as regras de `rules.ts`.
 * Nada é guardado como resultado: abrir o funil lê de novo.
 */

// As tabelas novas ainda não estão nos tipos gerados do Supabase
const supabase = typed as unknown as SupabaseClient

export type FunnelPeriod = 7 | 30 | 90
export const FUNNEL_PERIODS: FunnelPeriod[] = [7, 30, 90]
export const FUNNEL_PERIOD_LABEL: Record<FunnelPeriod, string> = { 7: '7 dias', 30: '30 dias', 90: '90 dias' }
const AD_PRESET: Record<FunnelPeriod, AdPreset> = { 7: 'last_7d', 30: 'last_30d', 90: 'last_90d' }

export interface Funnel {
  id: string
  teamId: string
  name: string
  objective: string
  template: 'captacao' | 'prospeccao' | 'custom'
  steps: FunnelStep[]
  /** Posição de cada cartão no mapa (por índice da etapa), compartilhada com a equipe */
  layout: Record<string, { x: number; y: number }>
  /** O funil de oportunidades do CRM: vem pronto, não se edita nem se apaga */
  builtin?: boolean
  createdAt: number
  updatedAt: number
}

export const PIPELINE_ID = 'pipeline'

/** O caminho das oportunidades no CRM, lido dos estados reais. Não é gravado: existe para toda conta. */
export const pipelineFunnel = (teamId: string): Funnel => ({
  id: PIPELINE_ID,
  teamId,
  name: 'Pipeline de oportunidades',
  objective: 'Do cadastro da oportunidade ao fechamento, pelos estados do CRM.',
  template: 'custom',
  builtin: true,
  layout: {},
  createdAt: 0,
  updatedAt: 0,
  steps: [
    { id: 'p0', name: 'Oportunidades', kind: 'opportunity', source: { cohort: 'created' } },
    { id: 'p1', name: 'Fila da página', kind: 'stage', source: { stage: 'selecionado' } },
    { id: 'p2', name: 'Página pronta', kind: 'stage', source: { stage: 'pagina' } },
    { id: 'p3', name: 'Contatado', kind: 'stage', source: { stage: 'contatado' } },
    { id: 'p4', name: 'Em conversa', kind: 'stage', source: { stage: 'conversa' } },
    { id: 'p5', name: 'Proposta', kind: 'stage', source: { stage: 'proposta' } },
    { id: 'p6', name: 'Fechado', kind: 'stage', source: { stage: 'fechado' } },
  ],
})

const cleanLayout = (raw: unknown): Funnel['layout'] => {
  const out: Funnel['layout'] = {}
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const p = v as { x?: unknown; y?: unknown }
      if (/^\d{1,2}$/.test(k) && Number.isFinite(p?.x) && Number.isFinite(p?.y)) out[k] = { x: p.x as number, y: p.y as number }
    }
  }
  return out
}

/** Grava só a organização do mapa (gestor). Falha com clareza se a migração do mapa não foi aplicada. */
export async function saveFunnelLayout(id: string, layout: Funnel['layout']) {
  const { error } = await supabase.from('crm_funnels').update({ layout }).eq('id', id)
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') throw new Error('Falta aplicar a migração 20261031120000_crm_funnels_layout.sql.')
    fail(error)
  }
}

export class FunnelTablesError extends Error {
  constructor() {
    super('Falta aplicar a migração 20261030120000_crm_funnels.sql no Supabase.')
  }
}

const fail = (error: { code?: string; message: string }): never => {
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202') throw new FunnelTablesError()
  if (error.code === '42501') throw new Error('Só gestor da conta cria, edita ou apaga funis.')
  throw new Error(error.message)
}

type StepRow = { id: string; position: number; name: string; kind: string; source: unknown }
type FunnelRow = { layout?: unknown; id: string; team_id: string; name: string; objective: string; template: string; created_at: string; updated_at: string; steps?: StepRow[] }

const toFunnel = (row: FunnelRow): Funnel => ({
  id: row.id,
  teamId: row.team_id,
  name: row.name,
  objective: row.objective ?? '',
  template: row.template === 'captacao' || row.template === 'prospeccao' ? row.template : 'custom',
  steps: [...(row.steps ?? [])].sort((a, b) => a.position - b.position).map((s) => cleanStep(s)),
  layout: cleanLayout(row.layout),
  createdAt: Date.parse(row.created_at),
  updatedAt: Date.parse(row.updated_at),
})

const SELECT = '*, steps:crm_funnel_steps(id, position, name, kind, source)'

export async function listFunnels(teamId: string): Promise<Funnel[]> {
  const { data, error } = await supabase.from('crm_funnels').select(SELECT).eq('team_id', teamId).order('created_at', { ascending: false })
  if (error) fail(error)
  return ((data ?? []) as unknown as FunnelRow[]).map(toFunnel)
}

/** Só devolve o funil se for da conta aberta: um link de outra conta não abre nada. */
export async function loadFunnel(teamId: string, id: string): Promise<Funnel | null> {
  if (id === PIPELINE_ID) return pipelineFunnel(teamId)
  const { data, error } = await supabase.from('crm_funnels').select(SELECT).eq('id', id).eq('team_id', teamId).maybeSingle()
  if (error) fail(error)
  return data ? toFunnel(data as unknown as FunnelRow) : null
}

export async function saveFunnel(input: { id?: string; teamId: string; name: string; objective: string; template: Funnel['template']; steps: FunnelStep[] }): Promise<string> {
  const { errors } = validateFunnel(input.name, input.steps)
  if (errors.length) throw new Error(errors[0])
  const { data, error } = await supabase.rpc('crm_save_funnel', {
    p_id: input.id ?? null,
    p_team: input.teamId,
    p_name: input.name.trim(),
    p_objective: input.objective.trim(),
    p_template: input.template,
    p_steps: input.steps.map((s) => ({ name: s.name.trim(), kind: s.kind, source: s.source })),
  })
  if (error) fail(error)
  return data as string
}

export async function deleteFunnel(id: string) {
  const { error } = await supabase.from('crm_funnels').delete().eq('id', id)
  if (error) fail(error)
}

// ---------- as fontes que a conta tem ----------

export type Loaded<T> = { state: 'ok'; items: T[] } | { state: 'missing'; reason: string } | { state: 'error'; reason: string }

export interface AdSource {
  account: AdAccount
  campaigns: { id: string; name: string; status?: string }[]
}

export interface Sources {
  trackers: Loaded<SiteTracker>
  forms: Loaded<CrmForm>
  ads: Loaded<AdSource>
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

async function safe<T>(read: () => Promise<T[]>, missing: unknown[], missingReason: string): Promise<Loaded<T>> {
  try {
    return { state: 'ok', items: await read() }
  } catch (e) {
    if (missing.some((M) => typeof M === 'function' && e instanceof (M as new () => Error))) return { state: 'missing', reason: missingReason }
    return { state: 'error', reason: messageOf(e) }
  }
}

/** O que a conta tem conectado para ligar às etapas; cada fonte falha sozinha. */
export async function loadSources(teamId: string): Promise<Sources> {
  const [trackers, forms, ads] = await Promise.all([
    safe(() => loadTrackers(teamId), [NoSiteTablesError], 'O módulo de visitas do site ainda não está instalado nesta conta.'),
    safe(() => listForms(teamId), [FormsTablesError], 'A migração dos formulários ainda não foi aplicada.'),
    safe<AdSource>(
      async () => {
        const accounts = await loadAdAccounts(teamId)
        return Promise.all(
          accounts.map(async (account) => {
            // Os relatórios guardados trazem a lista de campanhas; o maior período primeiro
            for (const preset of ['last_90d', 'last_30d', 'last_7d', 'this_month'] as AdPreset[]) {
              const report = await loadAdReport(account.id, preset).catch(() => null)
              if (report) return { account, campaigns: report.campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status })) }
            }
            return { account, campaigns: [] }
          })
        )
      },
      [NoAdTablesError],
      'As campanhas da Meta ainda não estão instaladas nesta conta.'
    ),
  ])
  return { trackers, forms, ads }
}

// ---------- leitura ----------

export interface FunnelReading {
  period: FunnelPeriod
  from: Date
  to: Date
  readings: Reading[]
  /** As oportunidades que o funil acompanha (para abrir cada uma) */
  cohort: OppLite[]
  cohortTruncated: boolean
  readAt: number
}

const PAGE = 1000
const CAP = 5000

interface OppRow {
  id: string
  stage: string
  history: unknown
  created_at: string
  offer: { price?: number } | null
  origin: { formId?: string; campaign?: { id?: string; name?: string } } | null
  client: { name: string; source: string } | { name: string; source: string }[] | null
}

const OPP_SELECT = 'id, stage, history, created_at, offer, origin, client:crm_clients(name, source)'

const toOppLite = (r: OppRow): OppLite => {
  const client = Array.isArray(r.client) ? r.client[0] : r.client
  return {
    id: r.id,
    stage: r.stage,
    history: (Array.isArray(r.history) ? r.history : []) as OppLite['history'],
    createdAt: r.created_at,
    offerPrice: typeof r.offer?.price === 'number' ? r.offer.price : undefined,
    formId: r.origin?.formId,
    campaignId: r.origin?.campaign?.id,
    campaignName: r.origin?.campaign?.name,
    clientSource: client?.source,
    name: client?.name,
  }
}

/** Oportunidades criadas no período (coleção "todas as criadas"). */
async function loadCreatedRows(teamId: string, from: Date, to: Date): Promise<{ rows: OppLite[]; truncated: boolean }> {
  const rows: OppLite[] = []
  for (let start = 0; start < CAP; start += PAGE) {
    const { data, error } = await supabase
      .from('crm_opportunities')
      .select(OPP_SELECT)
      .eq('team_id', teamId)
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .order('created_at', { ascending: false })
      .range(start, start + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as unknown as OppRow[]
    rows.push(...batch.map(toOppLite))
    if (batch.length < PAGE) return { rows, truncated: false }
  }
  return { rows, truncated: true }
}

/** Oportunidades por id, só da conta aberta. */
async function loadRowsByIds(teamId: string, ids: string[]): Promise<OppLite[]> {
  const rows: OppLite[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from('crm_opportunities').select(OPP_SELECT).eq('team_id', teamId).in('id', ids.slice(i, i + 200))
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as unknown as OppRow[]).map(toOppLite))
  }
  return rows
}

export interface SubmissionLite {
  id: string
  opportunityId?: string
  campaignId?: string
  campaignName?: string
}

/** As respostas dos formulários no período, com a oportunidade que cada uma gerou (`opportunity_id`). */
async function loadSubmissions(teamId: string, formIds: string[], from: Date, to: Date): Promise<SubmissionLite[]> {
  const out: SubmissionLite[] = []
  for (let start = 0; start < CAP; start += PAGE) {
    const { data, error } = await supabase
      .from('crm_form_submissions')
      .select('id, opportunity_id, origin')
      .eq('team_id', teamId)
      .in('form_id', formIds)
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .order('created_at', { ascending: false })
      .range(start, start + PAGE - 1)
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') throw new FormsTablesError()
      throw new Error(error.message)
    }
    const batch = (data ?? []) as { id: string; opportunity_id: string | null; origin: { campaign?: { id?: string; name?: string } } | null }[]
    out.push(...batch.map((r) => ({ id: r.id, opportunityId: r.opportunity_id ?? undefined, campaignId: r.origin?.campaign?.id, campaignName: r.origin?.campaign?.name })))
    if (batch.length < PAGE) return out
  }
  throw new Error('Mais de 5.000 respostas no período: reduza o período para contar com exatidão.')
}

const ago = (at: number) => new Date(at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const dayShort = (key: string | undefined) => (key ? key.split('-').reverse().slice(0, 2).join('/') : '?')

/** Lê cada etapa na sua fonte, no mesmo período; a que falha vira "indisponível" sem derrubar as outras. */
export async function readFunnel(teamId: string, steps: FunnelStep[], period: FunnelPeriod): Promise<FunnelReading> {
  const { from, to } = periodRange(period)
  const fromKey = dayKeyOf(from)
  const toKey = dayKeyOf(new Date())
  const rule = cohortRuleOf(steps)

  const needs = (kind: FunnelStep['kind']) => steps.some((s) => s.kind === kind && isConnected(s))
  const [trackers, ads] = await Promise.all([
    needs('page') || needs('event') ? loadTrackers(teamId).catch((e: unknown) => e as Error) : Promise.resolve([] as SiteTracker[]),
    needs('campaign') ? loadAdAccounts(teamId).catch((e: unknown) => e as Error) : Promise.resolve([] as AdAccount[]),
  ])

  const siteReports = new Map<string, Promise<SiteReport>>()
  const siteReport = (id: string) => {
    if (!siteReports.has(id)) siteReports.set(id, loadReportRange(id, from, to))
    return siteReports.get(id) as Promise<SiteReport>
  }
  const adReports = new Map<string, Promise<AdReport | null>>()
  const adReport = (id: string) => {
    if (!adReports.has(id)) adReports.set(id, loadAdReport(id, AD_PRESET[period]))
    return adReports.get(id) as Promise<AdReport | null>
  }

  // As respostas por conjunto de formulários (a etapa de envio e a coleção de oportunidades podem pedir o mesmo)
  const submissionCache = new Map<string, Promise<SubmissionLite[]>>()
  const submissionsFor = (formIds: string[]) => {
    const key = [...formIds].sort().join('|')
    if (!submissionCache.has(key)) submissionCache.set(key, loadSubmissions(teamId, formIds, from, to))
    return submissionCache.get(key) as Promise<SubmissionLite[]>
  }
  const campaignFilter = rule?.campaigns
  const strictSubs = (subs: SubmissionLite[]) => (campaignFilter ? subs.filter((x) => campaignMatches(x, campaignFilter)) : subs)
  const nameOnlySubs = (subs: SubmissionLite[]) => (campaignFilter ? subs.filter((x) => campaignMatch(x, campaignFilter) === 'name').length : 0)

  interface Cohort {
    rows: OppLite[]
    truncated: boolean
    /** Respostas com oportunidade ligada (coleção de formulários) */
    linked?: number
    /** Só o nome da campanha bate: aproximação, fora da contagem */
    approx: number
  }
  const loadCohort = async (): Promise<Cohort | undefined> => {
    if (!rule) return undefined
    if (rule.cohort === 'forms') {
      const subs = await submissionsFor(rule.formIds)
      const kept = strictSubs(subs)
      const ids = [...new Set(kept.flatMap((x) => (x.opportunityId ? [x.opportunityId] : [])))]
      const rows = await loadRowsByIds(teamId, ids)
      const found = new Set(rows.map((r) => r.id))
      return { rows, truncated: false, linked: kept.filter((x) => x.opportunityId && found.has(x.opportunityId)).length, approx: nameOnlySubs(subs) }
    }
    const created = await loadCreatedRows(teamId, from, to)
    return { rows: created.rows, truncated: created.truncated, approx: created.rows.filter((o) => approxCampaignOnly(o, rule)).length }
  }
  let cohortState: Cohort | Error | undefined
  const cohortPromise = rule ? loadCohort().then((r) => (cohortState = r), (e: unknown) => (cohortState = e as Error)) : Promise.resolve(undefined)

  const campaignStep = steps.find((s) => s.kind === 'campaign' && isConnected(s))

  const readStep = async (step: FunnelStep): Promise<Reading> => {
    if (!isConnected(step)) return { state: 'unconnected' }
    const s = step.source
    try {
      switch (step.kind) {
        case 'campaign': {
          if (ads instanceof Error) return { state: 'unavailable', reason: ads instanceof NoAdTablesError ? 'As campanhas da Meta não estão instaladas nesta conta.' : ads.message }
          const account = ads.find((a) => a.id === s.accountId)
          if (!account) return { state: 'unavailable', reason: 'A conta de anúncios escolhida não está mais conectada a esta conta.' }
          const report = await adReport(account.id)
          if (!report) return { state: 'unavailable', reason: `Nenhum relatório da Meta de ${FUNNEL_PERIOD_LABEL[period]} guardado. Abra Anúncios e leia a Meta uma vez.` }
          const sum = sumAds(report, (s.campaigns ?? []).map((c) => c.id), fromKey, toKey)
          const parts = [`Relatório da Meta de ${dayShort(sum.since)} a ${dayShort(sum.until)}, lido em ${ago(report.fetchedAt)}.`]
          if (sum.partial) parts.push(`Não cobre o período pedido (${dayShort(fromKey)} a ${dayShort(toKey)}): cliques e gasto são parciais.`)
          if (sum.stale) parts.push('Leitura com mais de 24 h: pode faltar gasto recente.')
          if (account.syncError) parts.push('A última leitura da Meta falhou; os números podem estar defasados.')
          return { state: 'ok', value: sum.linkClicks, unit: 'cliques no link', spend: sum.spend, currency: report.currency, spendExact: !sum.partial && !sum.stale, note: parts.join(' ') }
        }
        case 'page': {
          if (trackers instanceof Error) return { state: 'unavailable', reason: trackers instanceof NoSiteTablesError ? 'O módulo de visitas do site não está instalado nesta conta.' : trackers.message }
          const tracker = trackers.find((t) => t.id === s.trackerId)
          if (!tracker) return { state: 'unavailable', reason: 'O site escolhido não está mais cadastrado nesta conta.' }
          if (!tracker.lastSeenAt) return { state: 'unavailable', reason: 'O código do site ainda não recebeu nenhuma visita: confira a instalação em Site › Instalação.' }
          const report = await siteReport(tracker.id)
          const match = matchPage(report.pages, s.path as string)
          if (match.state === 'ambiguous') return { state: 'unavailable', reason: `O relatório traz mais de um caminho equivalente (${match.paths.join(', ')}); visitantes não se somam entre eles, então não escolho um.` }
          if (match.state === 'found') return { state: 'ok', value: Number(match.page.visitors) || 0, unit: 'visitantes', note: `${Number(match.page.views) || 0} visualizações no período.` }
          if (report.pages.length >= 50) return { state: 'unavailable', reason: 'Esta página não está entre as 50 mais vistas do período; o relatório do site não detalha as demais.' }
          return { state: 'ok', value: 0, unit: 'visitantes', note: 'Nenhuma visita registrada nesta página no período.' }
        }
        case 'event': {
          if (trackers instanceof Error) return { state: 'unavailable', reason: trackers instanceof NoSiteTablesError ? 'O módulo de visitas do site não está instalado nesta conta.' : trackers.message }
          const tracker = trackers.find((t) => t.id === s.trackerId)
          if (!tracker) return { state: 'unavailable', reason: 'O site escolhido não está mais cadastrado nesta conta.' }
          if (!tracker.lastSeenAt) return { state: 'unavailable', reason: 'O código do site ainda não recebeu nenhuma visita: confira a instalação em Site › Instalação.' }
          const report = await siteReport(tracker.id)
          const hit = report.events.find((e) => e.name === s.event)
          const note = isIntentEvent(s.event as string) ? 'Mostra intenção de contato: não comprova que a conversa aconteceu nem uma venda.' : undefined
          if (hit) return { state: 'ok', value: Number(hit.sessions) || 0, unit: 'visitas com o evento', note }
          if (report.events.length >= 40) return { state: 'unavailable', reason: 'Este evento não está entre os 40 mais frequentes do período; o relatório do site não detalha os demais.' }
          return { state: 'ok', value: 0, unit: 'visitas com o evento', note }
        }
        case 'form': {
          const subs = await submissionsFor(s.formIds as string[])
          const kept = strictSubs(subs)
          const approx = nameOnlySubs(subs)
          const note = campaignFilter ? `Só respostas das campanhas escolhidas, pelo id da campanha.${approx ? ` ${approx} trazem só o nome da campanha (aproximação) e ficaram de fora.` : ''}` : undefined
          return { state: 'ok', value: kept.length, unit: 'respostas', note }
        }
        case 'opportunity':
        case 'stage': {
          await cohortPromise
          if (!rule) return { state: 'unavailable', reason: 'Defina as oportunidades que o funil acompanha na etapa “Oportunidade criada”.' }
          if (cohortState instanceof Error) return { state: 'unavailable', reason: `Não consegui ler as oportunidades: ${cohortState.message}` }
          const opps = (cohortState?.rows ?? []).filter((o) => inCohort(o, rule))
          if (step.kind === 'opportunity') {
            const notes = [
              rule.cohort === 'forms' ? 'Oportunidades ligadas às respostas do período (opportunity_id), mesmo as criadas antes.' : undefined,
              cohortState?.truncated ? 'Mostrando só as 5.000 oportunidades mais recentes do período.' : undefined,
              cohortState?.approx ? `${cohortState.approx} só trazem o nome da campanha (aproximação) e ficaram de fora da contagem.` : undefined,
            ].filter(Boolean)
            return { state: 'ok', value: opps.length, unit: 'oportunidades', linked: cohortState?.linked, sales: salesOf(opps), note: notes.join(' ') || undefined }
          }
          const count = stageCount(opps, s.stage as string)
          return { state: 'ok', value: count.reached, current: count.current, unit: 'oportunidades', sales: s.stage === 'fechado' ? salesOf(opps) : undefined }
        }
        default:
          return { state: 'unconnected' }
      }
    } catch (e) {
      return { state: 'unavailable', reason: messageOf(e) }
    }
  }

  const readings = await Promise.all(steps.map(readStep))
  await cohortPromise

  // O investimento só se liga às oportunidades quando elas foram contadas pela campanha escolhida
  if (rule?.campaigns && campaignStep) {
    const spend = readings[steps.indexOf(campaignStep)]
    const at = steps.findIndex((s) => s.kind === 'opportunity')
    const reading = readings[at]
    if (spend?.state === 'ok' && reading?.state === 'ok' && spend.spend !== undefined) readings[at] = { ...reading, spend: spend.spend, currency: spend.currency, spendExact: spend.spendExact }
  }

  const cohort = cohortState && !(cohortState instanceof Error) && rule ? cohortState.rows.filter((o) => inCohort(o, rule)) : []
  return { period, from, to, readings, cohort, cohortTruncated: !!cohortState && !(cohortState instanceof Error) && cohortState.truncated, readAt: Date.now() }
}
