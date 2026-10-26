import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import type { Stage } from '@/features/prospects/funnel'
import { addActivity } from './clients'
import { phoneDigits } from './call'
import { updateOpportunity } from './opportunities'
import { startChat, type WaChat } from './whatsappChats'
import type { Client } from './types'

/**
 * Fluxos de atendimento e prospecção (CRM › Fluxos, migração 20261026210000).
 * Um fluxo é uma sequência de mensagens de WhatsApp com a espera, em dias,
 * entre elas. A equipe põe clientes do funil num fluxo e a rotina do dia lista
 * quem está na vez, com o texto pronto: a pessoa confere e envia com um
 * clique. Nada sai sozinho, porque o WhatsApp restringe o número que dispara
 * mensagens sem ninguém olhando; o limite diário por pessoa também fica bem
 * abaixo do que costuma bloquear.
 */

// As tabelas ainda não estão nos tipos gerados do Supabase
const db = supabase as unknown as SupabaseClient

export type FlowKind = 'prospeccao' | 'atendimento'

export const KIND_LABEL: Record<FlowKind, string> = { prospeccao: 'Prospecção', atendimento: 'Atendimento' }

export interface FlowStep {
  id: string
  /** Dias desde o passo anterior; no primeiro, 0 = já na vez */
  wait: number
  text: string
}

export interface Flow {
  id: string
  name: string
  kind: FlowKind
  steps: FlowStep[]
  active: boolean
}

export type RunStatus = 'running' | 'replied' | 'done' | 'paused'

export interface FlowRun {
  id: string
  flowId: string
  clientId: string
  opportunityId?: string
  /** O próximo passo a enviar */
  step: number
  status: RunStatus
  startedAt: number
  lastSentAt?: number
  nextAt: number
}

/** Mensagens que uma pessoa envia por dia pelo CRM (fluxos e conversas): bem abaixo do que bloqueia um número. */
export const DAILY_LIMIT = 30

/** Etapas do funil de onde faz sentido começar cada tipo de fluxo. */
export const KIND_STAGES: Record<FlowKind, Stage[]> = {
  prospeccao: ['mapeado', 'selecionado', 'pagina', 'contatado'],
  atendimento: ['conversa', 'proposta'],
}

export const VARIABLES: { name: string; hint: string }[] = [
  { name: '{nome}', hint: 'primeiro nome do contato (ou o nome da empresa)' },
  { name: '{empresa}', hint: 'nome da empresa' },
  { name: '{cidade}', hint: 'cidade' },
  { name: '{vendedor}', hint: 'seu primeiro nome' },
]

export const newStepId = () => Math.random().toString(36).slice(2, 9)

/** Modelos para começar; a equipe ajusta o texto e os prazos. */
export const PRESETS: { name: string; kind: FlowKind; steps: Omit<FlowStep, 'id'>[] }[] = [
  {
    name: 'Prospecção: primeira mensagem e retomadas',
    kind: 'prospeccao',
    steps: [
      { wait: 0, text: 'Olá, {nome}! Aqui é {vendedor}, da Avence Studio. Fiz uma versão nova da página da {empresa} pensada para levar quem chega direto ao seu WhatsApp. Posso te mandar a prévia?' },
      { wait: 2, text: '{nome}, passando para saber se você viu minha mensagem. A prévia da página da {empresa} está pronta e leva menos de um minuto para olhar. Mando o link?' },
      { wait: 4, text: 'Por aqui eu encerro, {nome}. Se esse não for o melhor momento, tudo bem: deixo a prévia guardada e é só me chamar quando quiser ver.' },
    ],
  },
  {
    name: 'Atendimento: acompanhar a proposta',
    kind: 'atendimento',
    steps: [
      { wait: 0, text: 'Olá, {nome}! Aqui é {vendedor}, da Avence Studio. Passando para confirmar se você recebeu o que combinamos e se ficou alguma dúvida.' },
      { wait: 3, text: '{nome}, tudo bem? Quer que eu ajuste algo para a {empresa}? Posso te ligar em um horário que seja bom para você.' },
      { wait: 7, text: 'Oi, {nome}. Vou deixar a conversa da {empresa} em espera por aqui. Quando quiser retomar, é só responder esta mensagem.' },
    ],
  },
]

// ---------------------------------------------------------------- linhas

interface FlowRow {
  id: string
  name: string
  kind: FlowKind
  steps: FlowStep[] | null
  active: boolean
}

interface RunRow {
  id: string
  flow_id: string
  client_id: string
  opportunity_id: string | null
  step: number
  status: RunStatus
  started_at: string
  last_sent_at: string | null
  next_at: string
}

const toFlow = (r: FlowRow): Flow => ({ id: r.id, name: r.name, kind: r.kind, steps: r.steps ?? [], active: r.active })

const toRun = (r: RunRow): FlowRun => ({
  id: r.id,
  flowId: r.flow_id,
  clientId: r.client_id,
  opportunityId: r.opportunity_id ?? undefined,
  step: r.step,
  status: r.status,
  startedAt: Date.parse(r.started_at),
  lastSentAt: r.last_sent_at ? Date.parse(r.last_sent_at) : undefined,
  nextAt: Date.parse(r.next_at),
})

/** `no_tables` quando falta a migração dos fluxos */
export class FlowError extends Error {
  constructor(
    message: string,
    readonly code = 'error'
  ) {
    super(message)
  }
}

const fail = (error: { code?: string; message: string }) =>
  error.code === '42P01' || error.code === 'PGRST205'
    ? new FlowError('Aplique a migração 20261026210000_crm_flows.sql no Supabase.', 'no_tables')
    : new FlowError(error.message)

export async function listFlows(teamId: string): Promise<Flow[]> {
  const { data, error } = await db.from('crm_flows').select('id, name, kind, steps, active').eq('team_id', teamId).order('created_at')
  if (error) throw fail(error)
  return (data as FlowRow[]).map(toFlow)
}

export async function saveFlow(teamId: string, flow: Omit<Flow, 'id'>, id?: string): Promise<Flow> {
  const row = { name: flow.name.trim() || 'Fluxo sem nome', kind: flow.kind, steps: flow.steps, active: flow.active, updated_at: new Date().toISOString() }
  const query = id ? db.from('crm_flows').update(row).eq('id', id) : db.from('crm_flows').insert({ ...row, team_id: teamId })
  const { data, error } = await query.select('id, name, kind, steps, active').single()
  if (error) throw fail(error)
  return toFlow(data as FlowRow)
}

export async function deleteFlow(id: string) {
  const { error } = await db.from('crm_flows').delete().eq('id', id)
  if (error) throw fail(error)
}

/** Quem está em fluxo: rodando, que respondeu ou pausado (os concluídos ficam de fora). */
export async function listRuns(teamId: string): Promise<FlowRun[]> {
  const { data, error } = await db.from('crm_flow_runs').select('*').eq('team_id', teamId).in('status', ['running', 'replied', 'paused']).order('next_at').limit(2000)
  if (error) throw fail(error)
  return (data as RunRow[]).map(toRun)
}

/** Põe clientes num fluxo, já na vez do primeiro passo. Quem já está rodando nele é pulado. */
export async function startRuns(teamId: string, flow: Flow, targets: { clientId: string; opportunityId?: string }[], userId: string | undefined) {
  const { data: running, error: readError } = await db.from('crm_flow_runs').select('client_id').eq('flow_id', flow.id).eq('status', 'running')
  if (readError) throw fail(readError)
  const already = new Set((running as { client_id: string }[]).map((r) => r.client_id))
  const rows = targets
    .filter((t) => !already.has(t.clientId))
    .map((t) => ({ team_id: teamId, flow_id: flow.id, client_id: t.clientId, opportunity_id: t.opportunityId ?? null, started_by: userId ?? null }))
  if (rows.length) {
    const { error } = await db.from('crm_flow_runs').insert(rows)
    if (error) throw fail(error)
  }
  return { started: rows.length, skipped: targets.length - rows.length }
}

async function patchRun(id: string, patch: Record<string, unknown>) {
  const { error } = await db.from('crm_flow_runs').update(patch).eq('id', id)
  if (error) throw fail(error)
}

export const setRunStatus = (id: string, status: RunStatus) => patchRun(id, { status })

export async function removeRun(id: string) {
  const { error } = await db.from('crm_flow_runs').delete().eq('id', id)
  if (error) throw fail(error)
}

/** Quantas mensagens esta pessoa já enviou hoje pelo CRM. */
export async function sentToday(teamId: string, userId: string): Promise<number> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const { count, error } = await db
    .from('crm_whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('sent_by', userId)
    .gte('ts', start.toISOString())
  if (error) return 0
  return count ?? 0
}

// ---------------------------------------------------------------- texto e andamento

export interface Vars {
  contact?: string
  company: string
  city?: string
  seller?: string
}

const firstWord = (text: string | undefined) => text?.trim().split(/\s+/)[0] ?? ''

/** Troca {nome}, {empresa}, {cidade} e {vendedor} pelo que se sabe do cliente. */
export const renderText = (template: string, v: Vars) =>
  template
    .replace(/\{nome\}/g, firstWord(v.contact) || v.company)
    .replace(/\{empresa\}/g, v.company)
    .replace(/\{cidade\}/g, v.city ?? '')
    .replace(/\{vendedor\}/g, firstWord(v.seller) || 'a equipe')

/** O número do cliente para o WhatsApp (o do WhatsApp primeiro, depois o telefone). */
export const clientPhone = (client: Client) => phoneDigits(client.whatsapp) ?? phoneDigits(client.phone)

/** Na vez: rodando e com a data chegada. */
export const isDue = (run: FlowRun, now = Date.now()) => run.status === 'running' && run.nextAt <= now

/** O cliente respondeu depois do último envio (a conversa ainda tem o número para comparar). */
export function repliedSince(run: FlowRun, phone: string | undefined, chats: WaChat[]) {
  if (!run.lastSentAt || !phone) return false
  const chat = chats.find((c) => c.phone === phone)
  return !!chat && !chat.lastFromMe && chat.lastAt > run.lastSentAt
}

const DAY = 86_400_000

/** O passo foi dado (enviado ou pulado): vai para o seguinte, ou conclui. */
export async function advanceRun(run: FlowRun, flow: Flow, sent: boolean) {
  const next = run.step + 1
  const now = Date.now()
  const patch: Record<string, unknown> = sent ? { last_sent_at: new Date(now).toISOString() } : {}
  if (next >= flow.steps.length) await patchRun(run.id, { ...patch, step: next, status: 'done' })
  else await patchRun(run.id, { ...patch, step: next, next_at: new Date(now + flow.steps[next].wait * DAY).toISOString() })
}

/**
 * Envia o passo pelo número da equipe (a mensagem entra na fila e o serviço
 * envia), anota no cliente e avança. O primeiro passo de uma prospecção move o
 * cartão para "Contatado".
 */
export async function sendStep(teamId: string, run: FlowRun, flow: Flow, client: Client, text: string, stage?: Stage) {
  const phone = clientPhone(client)
  if (!phone) throw new FlowError('Este cliente não tem WhatsApp nem telefone cadastrado.')
  await startChat(teamId, phone, text)
  await addActivity(client.id, 'whatsapp', `Fluxo ${flow.name}, passo ${run.step + 1} de ${flow.steps.length}: ${text}`, run.opportunityId).catch((error) => console.error('[fluxos] nota não gravada', error))
  if (run.opportunityId && flow.kind === 'prospeccao' && run.step === 0 && stage && KIND_STAGES.prospeccao.slice(0, 3).includes(stage)) {
    await updateOpportunity(run.opportunityId, { stage: 'contatado' }).catch((error) => console.error('[fluxos] etapa não movida', error))
  }
  await advanceRun(run, flow, true)
}
