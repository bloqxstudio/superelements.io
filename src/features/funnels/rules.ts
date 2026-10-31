/**
 * Regras dos funis (CRM › Funis): validação da configuração, vínculo entre etapas e contagem.
 * Sem imports do app (o Node lê este arquivo nos testes): só tipos e funções puras.
 *
 * O que uma etapa mede decide se duas etapas podem virar conversão:
 * - campanha, página e evento do site contam cliques, visitantes e sessões: populações sem
 *   vínculo por pessoa entre si nem com os envios (a Meta não diz quem clicou, o site não diz
 *   quem virou lead). Mostramos os dois volumes, nunca a divisão.
 * - formulário → oportunidade, e oportunidade → estados do CRM, são a mesma coleção de pessoas
 *   (a oportunidade guarda de qual formulário veio, e o histórico guarda os estados por onde passou):
 *   só aí há conversão.
 */

export type StepKind = 'campaign' | 'page' | 'event' | 'form' | 'opportunity' | 'stage' | 'manual'

export const KIND_LABEL: Record<StepKind, string> = {
  campaign: 'Campanha (Meta)',
  page: 'Visita à página',
  event: 'Evento do site',
  form: 'Formulário enviado',
  opportunity: 'Oportunidade criada',
  stage: 'Estado do CRM',
  manual: 'Marco sem fonte',
}

export const KIND_HELP: Record<StepKind, string> = {
  campaign: 'Cliques no link e investimento dos anúncios, do relatório da Meta já conectado.',
  page: 'Visitantes de uma página, lidos pelo rastreador do site.',
  event: 'Visitas com um evento do site, como clique no WhatsApp ou envio de formulário.',
  form: 'Respostas recebidas por um formulário ou quiz desta conta.',
  opportunity: 'As oportunidades criadas no período: de formulários escolhidos ou todas as do CRM.',
  stage: 'Quantas dessas oportunidades chegaram a um estado do funil de vendas.',
  manual: 'Uma etapa que ainda não tem fonte conectada: aparece sem número.',
}

/** Os estados em ordem de avanço; "perdido" sai do caminho e é contado à parte. */
export const STAGE_ORDER = ['novo', 'mapeado', 'selecionado', 'pagina', 'contatado', 'conversa', 'proposta', 'fechado'] as const
const stageIndex = (stage: string) => (STAGE_ORDER as readonly string[]).indexOf(stage)

export interface CampaignRef {
  id: string
  name: string
}

export interface StepSource {
  accountId?: string
  campaigns?: CampaignRef[]
  trackerId?: string
  path?: string
  event?: string
  formIds?: string[]
  cohort?: 'forms' | 'created'
  clientSource?: string
  /** Contar só oportunidades cuja origem é uma das campanhas escolhidas na etapa de campanha */
  byCampaign?: boolean
  stage?: string
}

export interface FunnelStep {
  id?: string
  name: string
  kind: StepKind
  source: StepSource
}

export const MAX_STEPS = 12
const KINDS = Object.keys(KIND_LABEL) as StepKind[]

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v) : [])
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/** Lê uma etapa vinda do banco: o que não é reconhecido some, nunca vira dado. */
export function cleanStep(raw: { id?: string; name?: unknown; kind?: unknown; source?: unknown }): FunnelStep {
  const kind = KINDS.includes(raw.kind as StepKind) ? (raw.kind as StepKind) : 'manual'
  const s = (raw.source && typeof raw.source === 'object' ? raw.source : {}) as Record<string, unknown>
  const source: StepSource = {}
  if (kind === 'campaign') {
    source.accountId = text(s.accountId)
    source.campaigns = (Array.isArray(s.campaigns) ? s.campaigns : [])
      .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>) : {}))
      .filter((c) => typeof c.id === 'string' && typeof c.name === 'string')
      .map((c) => ({ id: c.id as string, name: c.name as string }))
  } else if (kind === 'page') {
    source.trackerId = text(s.trackerId)
    source.path = text(s.path)
  } else if (kind === 'event') {
    source.trackerId = text(s.trackerId)
    source.event = text(s.event)
  } else if (kind === 'form') {
    source.formIds = strings(s.formIds)
  } else if (kind === 'opportunity') {
    source.cohort = s.cohort === 'forms' ? 'forms' : s.cohort === 'created' ? 'created' : undefined
    source.formIds = strings(s.formIds)
    source.clientSource = text(s.clientSource)
    source.byCampaign = s.byCampaign === true
  } else if (kind === 'stage') {
    source.stage = text(s.stage)
  }
  return { id: raw.id, name: typeof raw.name === 'string' ? raw.name : '', kind, source }
}

/** A etapa tem a fonte escolhida (não quer dizer que a fonte entregue dados). */
export function isConnected(step: FunnelStep): boolean {
  const s = step.source
  switch (step.kind) {
    case 'campaign':
      return !!s.accountId
    case 'page':
      return !!s.trackerId && !!s.path
    case 'event':
      return !!s.trackerId && !!s.event
    case 'form':
      return !!s.formIds?.length
    case 'opportunity':
      return s.cohort === 'created' || (s.cohort === 'forms' && !!s.formIds?.length)
    case 'stage':
      return !!s.stage && stageIndex(s.stage) >= 0
    default:
      return false
  }
}

export interface Validation {
  errors: string[]
  /** Etapas sem fonte e outros avisos: não impedem salvar */
  warnings: string[]
}

const sameSet = (a: string[] = [], b: string[] = []) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')

export function validateFunnel(name: string, steps: FunnelStep[]): Validation {
  const errors: string[] = []
  const warnings: string[] = []
  if (!name.trim()) errors.push('Dê um nome ao funil.')
  if (name.trim().length > 120) errors.push('O nome do funil passa de 120 caracteres.')
  if (steps.length < 2) errors.push('Um funil precisa de pelo menos 2 etapas.')
  if (steps.length > MAX_STEPS) errors.push(`Use no máximo ${MAX_STEPS} etapas.`)

  steps.forEach((step, i) => {
    if (!step.name.trim()) errors.push(`A etapa ${i + 1} está sem nome.`)
    else if (step.name.trim().length > 80) errors.push(`O nome da etapa ${i + 1} passa de 80 caracteres.`)
  })

  const opportunityAt = steps.findIndex((s) => s.kind === 'opportunity')
  if (steps.filter((s) => s.kind === 'opportunity').length > 1) errors.push('Use só uma etapa de oportunidade criada: ela define quais oportunidades o funil acompanha.')
  let last = -1
  steps.forEach((step, i) => {
    if (step.kind !== 'stage') return
    const stage = step.source.stage
    if (opportunityAt < 0 || opportunityAt > i) errors.push(`“${step.name || `Etapa ${i + 1}`}” é um estado do CRM e precisa vir depois da etapa de oportunidade criada.`)
    if (!stage) return
    const index = stageIndex(stage)
    if (index < 0) errors.push(`“${step.name}” aponta para um estado que não segue no caminho de venda.`)
    else if (index <= last) errors.push(`Os estados do CRM precisam avançar: “${step.name}” repete ou volta um estado.`)
    else last = index
  })

  const opportunity = steps[opportunityAt]
  if (opportunity?.source.byCampaign && !steps.some((s) => s.kind === 'campaign' && s.source.campaigns?.length)) {
    errors.push('Para contar só leads de campanha, escolha as campanhas na etapa de campanha.')
  }
  if (opportunity?.source.cohort === 'forms') {
    const form = steps.find((s) => s.kind === 'form')
    if (form && !sameSet(form.source.formIds, opportunity.source.formIds)) {
      warnings.push('O formulário da etapa de envio e os da oportunidade são diferentes: a conversão entre eles não será calculada.')
    }
  }
  const open = steps.filter((s) => !isConnected(s))
  if (open.length) warnings.push(`Sem fonte conectada: ${open.map((s) => s.name || KIND_LABEL[s.kind]).join(', ')}. Essas etapas aparecem sem número.`)
  return { errors, warnings }
}

// ----------------------------------------------------------------------------------------------
// Oportunidades (a coleção de pessoas que o funil acompanha)

export interface OppLite {
  id: string
  stage: string
  history: { at: string; stage: string }[]
  createdAt: string
  offerPrice?: number
  formId?: string
  campaignId?: string
  campaignName?: string
  clientSource?: string
  name?: string
}

const norm = (v: string | undefined) => (v ?? '').trim().toLowerCase()

/**
 * Origem de um lead contra as campanhas escolhidas.
 * - `id`: o id da campanha bate. Quando a origem tem id, ele é o único critério: id diferente nunca casa por nome.
 * - `name`: a origem só traz o nome (link com UTM) e ele bate com uma única campanha escolhida. Nomes repetem
 *   (inclusive entre contas), então é aproximação e nunca vínculo comprovado.
 */
export function campaignMatch(origin: { campaignId?: string; campaignName?: string }, selected: CampaignRef[] | undefined): 'id' | 'name' | undefined {
  if (!selected?.length) return undefined
  if (origin.campaignId) return selected.some((c) => c.id === origin.campaignId) ? 'id' : undefined
  if (!origin.campaignName) return undefined
  const same = selected.filter((c) => norm(c.name) === norm(origin.campaignName))
  return same.length === 1 ? 'name' : undefined
}

/** Só o vínculo por id conta como comprovado. */
export const campaignMatches = (origin: { campaignId?: string; campaignName?: string }, selected: CampaignRef[] | undefined) => campaignMatch(origin, selected) === 'id'

export interface CohortRule {
  cohort: 'forms' | 'created'
  formIds: string[]
  clientSource?: string
  campaigns?: CampaignRef[]
}

/** A regra da coleção, vinda da etapa de oportunidade (e das campanhas escolhidas, se for o caso). */
export function cohortRuleOf(steps: FunnelStep[]): CohortRule | undefined {
  const step = steps.find((s) => s.kind === 'opportunity')
  if (!step || !isConnected(step)) return undefined
  const campaigns = step.source.byCampaign ? steps.find((s) => s.kind === 'campaign' && s.source.campaigns?.length)?.source.campaigns : undefined
  return { cohort: step.source.cohort as 'forms' | 'created', formIds: step.source.formIds ?? [], clientSource: step.source.clientSource, campaigns }
}

/**
 * A oportunidade entra na coleção do funil. Na coleção "forms" quem escolhe as oportunidades é o
 * vínculo `submission.opportunity_id` (feito no carregamento), então aqui só valem os filtros extras.
 * O filtro de campanha exige o id: oportunidades que só têm o nome ficam de fora (ver `approxCampaignOnly`).
 */
export function inCohort(opp: OppLite, rule: CohortRule): boolean {
  if (rule.cohort === 'created' && rule.clientSource && opp.clientSource !== rule.clientSource) return false
  if (rule.cohort === 'created' && rule.campaigns && !campaignMatches({ campaignId: opp.campaignId, campaignName: opp.campaignName }, rule.campaigns)) return false
  return true
}

/** Oportunidades que só casariam por nome de campanha: aproximação, fora da contagem comprovada. */
export const approxCampaignOnly = (opp: OppLite, rule: CohortRule) => !!rule.campaigns && campaignMatch({ campaignId: opp.campaignId, campaignName: opp.campaignName }, rule.campaigns) === 'name'

/**
 * Atingiu este estado ou um posterior. O histórico guarda as mudanças de estado, não que o cartão
 * passou por cada etapa do caminho: um salto direto para "fechado" conta como ter atingido os marcos
 * anteriores, sem provar que ele passou por eles.
 */
export function reachedStage(opp: Pick<OppLite, 'stage' | 'history'>, stage: string): boolean {
  const target = stageIndex(stage)
  if (target < 0) return false
  return [opp.stage, ...opp.history.map((h) => h.stage)].some((s) => stageIndex(s) >= target)
}

export interface StageCount {
  /** Progressão: quantas já chegaram a este estado ou além */
  reached: number
  /** Posição de hoje: quantas estão exatamente neste estado agora */
  current: number
}

export const stageCount = (opps: OppLite[], stage: string): StageCount => ({
  reached: opps.filter((o) => reachedStage(o, stage)).length,
  current: opps.filter((o) => o.stage === stage).length,
})

export interface SalesSummary {
  /** Oportunidades hoje em "fechado" */
  closed: number
  /** Soma do valor do serviço só onde a oportunidade tem valor informado */
  total: number
  withValue: number
  lost: number
}

export function salesOf(opps: OppLite[]): SalesSummary {
  const closed = opps.filter((o) => o.stage === 'fechado')
  const valued = closed.filter((o) => typeof o.offerPrice === 'number' && o.offerPrice > 0)
  return { closed: closed.length, withValue: valued.length, total: valued.reduce((sum, o) => sum + (o.offerPrice as number), 0), lost: opps.filter((o) => o.stage === 'perdido').length }
}

// ----------------------------------------------------------------------------------------------
// Relatório de anúncios: só os dias dentro do período

export interface AdDayLite {
  day: string
  metrics: { spend: number; impressions: number; linkClicks: number }
}
export interface AdCampaignDayLite extends AdDayLite {
  campaignId: string
}

export interface AdSum {
  spend: number
  linkClicks: number
  impressions: number
  /** O relatório começa depois do início do período ou termina antes do fim pedido: o total é parcial */
  partial: boolean
  /** Lido há mais de `STALE_MS`: pode faltar gasto recente */
  stale: boolean
  since?: string
  until?: string
}

export const STALE_MS = 24 * 3_600_000

export function sumAds(
  report: { since: string | null; until: string | null; days: AdDayLite[]; campaignDays: AdCampaignDayLite[]; fetchedAt?: number },
  campaignIds: string[],
  fromKey: string,
  toKey: string,
  now = Date.now()
): AdSum {
  const rows = campaignIds.length ? report.campaignDays.filter((d) => campaignIds.includes(d.campaignId)) : report.days
  const inRange = rows.filter((d) => d.day >= fromKey && d.day <= toKey)
  const partial = !report.since || !report.until || report.since > fromKey || report.until < toKey
  const stale = !report.fetchedAt || now - report.fetchedAt > STALE_MS
  return {
    stale,
    spend: inRange.reduce((n, d) => n + (d.metrics.spend || 0), 0),
    linkClicks: inRange.reduce((n, d) => n + (d.metrics.linkClicks || 0), 0),
    impressions: inRange.reduce((n, d) => n + (d.metrics.impressions || 0), 0),
    partial,
    since: report.since ?? undefined,
    until: report.until ?? undefined,
  }
}

// ----------------------------------------------------------------------------------------------
// Leituras e vínculo entre etapas

export type Reading =
  | {
      state: 'ok'
      value: number
      unit: string
      current?: number
      spend?: number
      currency?: string
      /** O gasto cobre o período inteiro e foi lido há pouco: só então o custo por oportunidade é exato */
      spendExact?: boolean
      /** Oportunidade vinda de formulário: quantas respostas têm a oportunidade ligada (`opportunity_id`) */
      linked?: number
      sales?: SalesSummary
      note?: string
    }
  | { state: 'unavailable'; reason: string }
  | { state: 'unconnected' }

export interface Transition {
  /** Porcentagem (0–100, uma casa) só quando as duas etapas são a mesma coleção de pessoas */
  rate?: number
  /** `respostas`: respostas com oportunidade ligada; `marco`: atingiram o marco seguinte (estado atual ou posterior) */
  basis?: 'respostas' | 'marco'
  /** Por que não há conversão aqui */
  reason?: string
}

export function transitionOf(from: FunnelStep, to: FunnelStep, a: Reading, b: Reading): Transition {
  if (from.kind === 'manual' || to.kind === 'manual') return { reason: 'Uma das etapas não tem fonte: sem número para comparar.' }
  if (a.state !== 'ok' || b.state !== 'ok') return { reason: 'Falta a leitura de uma das etapas.' }

  if (from.kind === 'form' && to.kind === 'opportunity' && to.source.cohort === 'forms' && sameSet(from.source.formIds, to.source.formIds)) {
    // A população é a das respostas: quantas delas têm uma oportunidade ligada (opportunity_id).
    // Respostas repetidas do mesmo lead apontam para a mesma oportunidade e continuam contando como respostas.
    if (b.linked === undefined) return { reason: 'Não há vínculo entre cada resposta e a oportunidade: sem conversão.' }
    if (a.value <= 0) return { reason: 'Sem base: nenhuma resposta no período.' }
    return { rate: Math.round((Math.min(b.linked, a.value) / a.value) * 1000) / 10, basis: 'respostas' }
  }

  // Oportunidades e estados: a mesma coleção, medida pelo marco atingido (este estado ou um posterior)
  if ((from.kind === 'opportunity' && to.kind === 'stage') || (from.kind === 'stage' && to.kind === 'stage')) {
    if (a.value <= 0) return { reason: 'Sem base: a etapa anterior está em zero.' }
    if (b.value > a.value) return { reason: 'O número seguinte é maior que o anterior: as fontes não se encaixam.' }
    return { rate: Math.round((b.value / a.value) * 1000) / 10, basis: 'marco' }
  }

  if (from.kind === 'campaign') return { reason: 'Cliques em anúncios e o que vem depois são medidos em lugares diferentes: a Meta não diz quem clicou, então não há conversão.' }
  if (from.kind === 'page' || from.kind === 'event') return { reason: 'Visitas do site e envios ou oportunidades não têm vínculo por pessoa: mostramos os dois volumes, sem dividir um pelo outro.' }
  return { reason: 'Sem vínculo comprovado entre as duas contagens.' }
}

/** Caminho sem consulta, âncora e barra final. A caixa fica: /Proposta e /proposta podem ser páginas diferentes. */
export const normalizePath = (path: string) => {
  const clean = path.trim().replace(/[?#].*$/, '').replace(/\/+$/, '')
  return clean.startsWith('/') ? clean : `/${clean}`
}

export type PageMatch<T> = { state: 'found'; page: T } | { state: 'none' } | { state: 'ambiguous'; paths: string[] }

/** Acha a página no relatório. Se mais de um caminho do relatório vira o mesmo, não escolhe um: visitantes não se somam. */
export function matchPage<T extends { path: string }>(pages: T[], wanted: string): PageMatch<T> {
  const target = normalizePath(wanted)
  const hits = pages.filter((p) => normalizePath(p.path) === target)
  if (!hits.length) return { state: 'none' }
  if (hits.length > 1) return { state: 'ambiguous', paths: hits.map((h) => h.path) }
  return { state: 'found', page: hits[0] }
}

/** Eventos do site que mostram intenção de contato, não conversa nem venda. */
export const INTENT_EVENTS = ['whatsapp', 'telefone', 'email']
export const isIntentEvent = (name: string) => INTENT_EVENTS.includes(name)

// ----------------------------------------------------------------------------------------------
// Modelos

export interface Template {
  id: 'captacao' | 'prospeccao'
  name: string
  objective: string
  text: string
  steps: FunnelStep[]
}

export const TEMPLATES: Template[] = [
  {
    id: 'captacao',
    name: 'Captação por campanha',
    objective: 'Transformar o que a campanha traz em vendas fechadas.',
    text: 'Campanha → visita → formulário → oportunidade → qualificação → proposta → venda.',
    steps: [
      { name: 'Campanha', kind: 'campaign', source: { campaigns: [] } },
      { name: 'Visita à página', kind: 'page', source: {} },
      { name: 'Formulário enviado', kind: 'form', source: { formIds: [] } },
      { name: 'Oportunidade', kind: 'opportunity', source: { cohort: 'forms', formIds: [] } },
      { name: 'Qualificação', kind: 'stage', source: { stage: 'conversa' } },
      { name: 'Proposta', kind: 'stage', source: { stage: 'proposta' } },
      { name: 'Venda', kind: 'stage', source: { stage: 'fechado' } },
    ],
  },
  {
    id: 'prospeccao',
    name: 'Prospecção ativa',
    objective: 'Levar empresas abordadas pela equipe até a venda.',
    text: 'Prospecção → abordagem → resposta → qualificação → proposta → venda.',
    steps: [
      { name: 'Prospecção', kind: 'opportunity', source: { cohort: 'created', clientSource: 'prospeccao' } },
      { name: 'Abordagem', kind: 'stage', source: { stage: 'contatado' } },
      { name: 'Resposta', kind: 'stage', source: { stage: 'conversa' } },
      { name: 'Qualificação', kind: 'manual', source: {} },
      { name: 'Proposta', kind: 'stage', source: { stage: 'proposta' } },
      { name: 'Venda', kind: 'stage', source: { stage: 'fechado' } },
    ],
  },
]
