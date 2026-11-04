import type { FormDefinition, FormSettings } from '../../../supabase/functions/_shared/forms.ts'

/**
 * As contas do acompanhamento de um formulário (CRM › Formulários › Ao vivo): quem está agora e o
 * funil por etapa, a partir das visitas (`crm_form_visits`). Sem imports `@/`: os testes em Node
 * (`scripts/tests/form-visitas.test.mjs`) leem este arquivo.
 */

export interface FormVisit {
  id: string
  formId: string
  visitor?: string
  startedAt: number
  lastAt: number
  leftAt?: number
  activeMs: number
  screen: 'welcome' | 'steps' | 'booking' | 'booked' | 'result'
  stepId?: string
  stepIndex?: number
  stepsTotal?: number
  stepsSeen: string[]
  started: boolean
  submitted: boolean
  qualified?: boolean
  scheduleView: boolean
  scheduled: boolean
  submissionId?: string
  page?: string
  embed?: 'app' | 'site'
  channel?: string
  source?: string
  medium?: string
  campaign?: string
  content?: string
  referrerHost?: string
  device?: string
  browser?: string
  os?: string
  country?: string
  region?: string
  regionName?: string
  city?: string
}

/** Sem sinal há mais que isso (o formulário manda um a cada 20 s com a aba à vista), a pessoa saiu */
export const LIVE_MS = 60_000

export const isLive = (v: Pick<FormVisit, 'lastAt' | 'leftAt'>, now = Date.now()) => !v.leftAt && now - v.lastAt < LIVE_MS

export interface FunnelRow {
  id: string
  label: string
  /** O nome curto da etapa no funil ("Pergunta 2") e o que ela pergunta */
  hint?: string
  value: number
  kind: 'open' | 'start' | 'step' | 'submit' | 'qualified' | 'schedule_view' | 'scheduled'
}

/** O texto de uma etapa: o título dela, senão a primeira pergunta */
export function stepLabel(definition: FormDefinition, stepId: string | undefined) {
  if (!stepId) return undefined
  const step = definition.steps.find((s) => s.id === stepId)
  if (!step) return undefined
  return (step.title || step.fields.find((f) => f.label)?.label || '').trim() || undefined
}

/** Onde a pessoa está, em palavras ("Etapa 2 de 4 · Qual o faturamento?", "Na agenda"…) */
export function placeLabel(definition: FormDefinition, v: FormVisit) {
  if (v.scheduled || v.screen === 'booked') return 'Agendou a reunião'
  if (v.screen === 'booking') return 'Escolhendo um horário'
  if (v.submitted || v.screen === 'result') return 'Enviou'
  if (v.screen === 'welcome') return 'Na capa'
  const index = definition.steps.findIndex((s) => s.id === v.stepId)
  const n = index >= 0 ? index + 1 : v.stepIndex
  const total = definition.steps.length || v.stepsTotal
  const label = stepLabel(definition, v.stepId)
  return [n && total ? `Etapa ${n} de ${total}` : 'Nas perguntas', label].filter(Boolean).join(' · ')
}

/**
 * O funil: abriu → começou (se tem capa) → cada etapa da definição de hoje → enviou → qualificado
 * (quiz, ou agenda com filtro por resposta) → viu a agenda → agendou. Cada linha conta visitas
 * únicas que chegaram nela; uma etapa escondida pela lógica só conta quem a viu.
 */
export function funnelOf(definition: FormDefinition, settings: FormSettings, visits: FormVisit[]): FunnelRow[] {
  const rows: FunnelRow[] = [{ id: 'open', label: 'Abriu', value: visits.length, kind: 'open' }]
  if (definition.welcome?.enabled) rows.push({ id: 'start', label: 'Começou', hint: 'Clicou em começar ou respondeu', value: visits.filter((v) => v.started || v.submitted).length, kind: 'start' })
  definition.steps.forEach((step, i) => {
    const hint = stepLabel(definition, step.id)
    rows.push({ id: `step:${step.id}`, label: `Etapa ${i + 1}`, hint, value: visits.filter((v) => v.stepsSeen.includes(step.id)).length, kind: 'step' })
  })
  rows.push({ id: 'submit', label: 'Enviou', value: visits.filter((v) => v.submitted).length, kind: 'submit' })
  const booking = settings.booking?.enabled ? settings.booking : undefined
  if (definition.kind === 'quiz' || booking?.gate.mode === 'answer') {
    rows.push({ id: 'qualified', label: 'Qualificado', value: visits.filter((v) => v.qualified).length, kind: 'qualified' })
  }
  if (booking) {
    rows.push({ id: 'schedule_view', label: 'Viu a agenda', value: visits.filter((v) => v.scheduleView).length, kind: 'schedule_view' })
    rows.push({ id: 'scheduled', label: 'Agendou', value: visits.filter((v) => v.scheduled).length, kind: 'scheduled' })
  }
  return rows
}

/** A maior queda entre uma etapa e a seguinte (onde o lead mais some) */
export function worstDrop(rows: FunnelRow[]) {
  let worst: { from: FunnelRow; to: FunnelRow; lost: number; rate: number } | undefined
  for (let i = 1; i < rows.length; i++) {
    const from = rows[i - 1]
    const to = rows[i]
    if (from.value < 5 || to.kind === 'qualified') continue
    const lost = from.value - to.value
    const rate = lost / from.value
    if (lost > 0 && (!worst || rate > worst.rate)) worst = { from, to, lost, rate }
  }
  return worst
}

export interface OriginRow {
  label: string
  visits: number
  started: number
  submitted: number
  scheduled: number
}

/** Por origem (canal ou campanha): quantos abriram, começaram, enviaram e agendaram */
export function byOrigin(visits: FormVisit[], key: 'channel' | 'campaign' = 'channel'): OriginRow[] {
  const map = new Map<string, OriginRow>()
  for (const v of visits) {
    const label = (key === 'channel' ? v.channel : v.campaign) || (key === 'channel' ? 'Direto' : '')
    if (!label) continue
    const row = map.get(label) ?? { label, visits: 0, started: 0, submitted: 0, scheduled: 0 }
    row.visits++
    if (v.started || v.submitted) row.started++
    if (v.submitted) row.submitted++
    if (v.scheduled) row.scheduled++
    map.set(label, row)
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits || b.submitted - a.submitted)
}

type Row = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
const time = (v: unknown) => (typeof v === 'string' ? Date.parse(v) : NaN)

/** Uma linha do banco (ou da Realtime) para a visita */
export function toVisit(r: Row): FormVisit {
  const left = time(r.left_at)
  return {
    id: String(r.id),
    formId: String(r.form_id),
    visitor: str(r.visitor),
    startedAt: time(r.started_at),
    lastAt: time(r.last_at),
    leftAt: Number.isFinite(left) ? left : undefined,
    activeMs: Number(r.active_ms) || 0,
    screen: (str(r.screen) as FormVisit['screen']) ?? 'welcome',
    stepId: str(r.step_id),
    stepIndex: typeof r.step_index === 'number' ? r.step_index : undefined,
    stepsTotal: typeof r.steps_total === 'number' ? r.steps_total : undefined,
    stepsSeen: Array.isArray(r.steps_seen) ? (r.steps_seen as string[]) : [],
    started: r.started === true,
    submitted: r.submitted === true,
    qualified: typeof r.qualified === 'boolean' ? r.qualified : undefined,
    scheduleView: r.schedule_view === true,
    scheduled: r.scheduled === true,
    submissionId: str(r.submission_id),
    page: str(r.page),
    embed: r.embed === 'app' || r.embed === 'site' ? r.embed : undefined,
    channel: str(r.channel),
    source: str(r.source),
    medium: str(r.medium),
    campaign: str(r.campaign),
    content: str(r.content),
    referrerHost: str(r.referrer_host),
    device: str(r.device),
    browser: str(r.browser),
    os: str(r.os),
    country: str(r.country),
    region: str(r.region),
    regionName: str(r.region_name),
    city: str(r.city),
  }
}
