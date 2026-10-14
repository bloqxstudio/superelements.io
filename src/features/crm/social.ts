import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import type { Opportunity, Stage } from '@/features/prospects/funnel'
import { displayName } from '@/features/prospects/offer'
import { crmContext } from './crmStore'
import { listOpportunities, updateOpportunity } from './opportunities'

/**
 * Social selling (tela `/crm/social`, migração 20261014120000): a fila do dia
 * nas redes para as empresas do funil. Cada empresa passa por uma sequência
 * curta de toques (seguir, comentar, a primeira mensagem, retomar) com o texto
 * pronto e um limite diário por pessoa. Quem segue e envia é sempre a pessoa,
 * no perfil dela: os termos do Instagram, do LinkedIn e do Facebook proíbem
 * fazer isso por robô, e a API deles não segue nem manda a primeira mensagem.
 * O CRM organiza, anota na linha do tempo e move a etapa.
 *
 * O estado de cada empresa sai dos toques anotados (`crm_activities` de tipo
 * `social`, com `data.network` e `data.step`): nada fica guardado à parte.
 */

export type Network = 'instagram' | 'linkedin' | 'facebook'

export const NETWORKS: { id: Network; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
]

export const NETWORK_LABEL = Object.fromEntries(NETWORKS.map((n) => [n.id, n.label])) as Record<Network, string>

export type StepId = 'seguir' | 'comentar' | 'mensagem' | 'retomar'
/** Fecham a sequência: a empresa respondeu, ou a pessoa tirou a empresa da fila. */
export type EndId = 'resposta' | 'pausa'

/** O que conta no limite do dia: seguir, comentar e mensagens (a primeira e a retomada). */
export type Bucket = 'seguir' | 'comentar' | 'mensagem'

export const bucketOf = (step: StepId): Bucket => (step === 'retomar' ? 'mensagem' : step)

/**
 * Por pessoa e por dia. Contas que seguem ou escrevem para muita gente de uma
 * vez são bloqueadas pelas redes; estes números ficam bem abaixo disso.
 */
export const DAILY_LIMIT: Record<Network, Record<Bucket, number>> = {
  instagram: { seguir: 20, comentar: 15, mensagem: 10 },
  linkedin: { seguir: 15, comentar: 10, mensagem: 15 },
  facebook: { seguir: 20, comentar: 10, mensagem: 10 },
}

/**
 * Depois de seguir, a conversa acontece numa rede só (a primeira com perfil,
 * nesta ordem): mandar a mesma mensagem em três redes é cara de robô. As
 * outras redes ficam só com o primeiro toque. `wait` são os dias desde o toque
 * anterior.
 */
const TRACK: Record<Network, { step: StepId; wait: number }[]> = {
  instagram: [
    { step: 'comentar', wait: 2 },
    { step: 'mensagem', wait: 2 },
    { step: 'retomar', wait: 4 },
  ],
  linkedin: [
    { step: 'mensagem', wait: 3 },
    { step: 'retomar', wait: 5 },
  ],
  facebook: [
    { step: 'mensagem', wait: 2 },
    { step: 'retomar', wait: 4 },
  ],
}

/** Etapas do funil em que a empresa entra na fila (depois de "Contatado", a conversa já começou). */
export const SOCIAL_STAGES: Stage[] = ['mapeado', 'selecionado', 'pagina', 'contatado']

/** A página nova já existe: a primeira mensagem pode oferecer a prévia. */
export const pageReady = (o: Opportunity) => !['mapeado', 'selecionado'].includes(o.stage)

// ---------------------------------------------------------------- perfis

export interface Profiles {
  instagram?: string
  linkedin?: string
  facebook?: string
}

const trim = (value: string | null | undefined) => value?.trim() || undefined

/** "@perfil", "instagram.com/perfil/" ou o link inteiro → "@perfil". */
export const normalizeInstagram = (value: string) => {
  const text = value.trim()
  if (!text) return ''
  const handle = /instagram\.com\/([A-Za-z0-9_.]{1,30})/i.exec(text)?.[1] ?? text.replace(/^@/, '').split(/[/?#\s]/)[0]
  return handle ? `@${handle.replace(/\.$/, '')}` : ''
}

/** Link completo do LinkedIn ou do Facebook ("linkedin.com/in/ana" → "https://www.linkedin.com/in/ana"). */
export const normalizeLink = (network: 'linkedin' | 'facebook', value: string) => {
  const text = value.trim()
  if (!text) return ''
  if (/^https?:\/\//i.test(text)) return text
  const host = network === 'linkedin' ? 'linkedin.com' : 'facebook.com'
  const path = text.replace(new RegExp(`^(www\\.)?${host.replace('.', '\\.')}/?`, 'i'), '').replace(/^\/+/, '')
  return `https://www.${host}/${path}`
}

export const profileUrl = (network: Network, value: string) => {
  if (/^https?:\/\//i.test(value)) return value
  if (network === 'instagram') return `https://www.instagram.com/${value.replace(/^@/, '')}/`
  return normalizeLink(network, value)
}

/** Como o perfil aparece na tela: "@perfil", "in/ana", "fb/clinica". */
export const profileLabel = (network: Network, value: string) => {
  if (network === 'instagram') return normalizeInstagram(value) || value
  try {
    const url = new URL(profileUrl(network, value))
    const path = url.pathname.replace(/\/+$/, '').replace(/^\//, '')
    return network === 'linkedin' ? path.replace(/^company\//, 'empresa/') : `fb/${path}`
  } catch {
    return value
  }
}

/** No LinkedIn só se conversa com pessoas (perfil `/in/`); a página da empresa só se segue. */
const canMessage = (network: Network, value: string) => network !== 'linkedin' || /linkedin\.com\/in\//i.test(profileUrl(network, value))

/** A busca no Google para achar o perfil de quem ainda não tem. */
export const searchUrl = (network: Network, o: Opportunity) => {
  const site = network === 'instagram' ? 'instagram.com' : network === 'linkedin' ? 'linkedin.com' : 'facebook.com'
  const city = o.lead.city ?? o.region.split(',')[0]
  return `https://www.google.com/search?q=${encodeURIComponent(`${displayName(o.lead.name)} ${city ?? ''} site:${site}`.replace(/\s+/g, ' '))}`
}

// ---------------------------------------------------------------- toques

export interface Touch {
  id: string
  opportunityId: string
  clientId: string
  network?: Network
  step: StepId | EndId
  by?: string
  at: number
}

export interface Task {
  opportunity: Opportunity
  network: Network
  /** O perfil, como está no cadastro ou na leitura do site. */
  profile: string
  step: StepId
  /** Início do dia em que o toque vence. */
  due: number
  /** A primeira mensagem espera a página nova ficar pronta. */
  waitingPage?: boolean
}

export type PlanState = 'sem-perfil' | 'ativo' | 'feito' | 'respondeu' | 'pausado'

export interface LeadPlan {
  opportunity: Opportunity
  profiles: Profiles
  /** A rede onde a conversa acontece. */
  primary?: Network
  touches: Touch[]
  /** Os toques pendentes, cada um com o dia em que vence. */
  tasks: Task[]
  state: PlanState
  /** Último toque anotado. */
  lastAt?: number
}

const DAY = 86_400_000

export const dayStart = (at: number) => {
  const date = new Date(at)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const addDays = (at: number, days: number) => {
  const date = new Date(dayStart(at))
  date.setDate(date.getDate() + days)
  return date.getTime()
}

/** O perfil de cada rede: o do cadastro do cliente, senão o que a leitura do site achou. */
export const profilesOf = (o: Opportunity, saved: Profiles | undefined): Profiles => ({
  instagram: trim(saved?.instagram) ?? trim(o.lead.scan?.instagram),
  linkedin: trim(saved?.linkedin) ?? trim(o.lead.scan?.linkedin),
  facebook: trim(saved?.facebook) ?? trim(o.lead.scan?.facebook),
})

export function planFor(o: Opportunity, profiles: Profiles, touches: Touch[], now = Date.now()): LeadPlan {
  const mine = touches.filter((t) => t.opportunityId === o.id).sort((a, b) => a.at - b.at)
  const lastAt = mine.at(-1)?.at
  const base = { opportunity: o, profiles, touches: mine, lastAt }
  if (mine.some((t) => t.step === 'resposta')) return { ...base, tasks: [], state: 'respondeu' }
  if (mine.some((t) => t.step === 'pausa')) return { ...base, tasks: [], state: 'pausado' }

  const networks = NETWORKS.map((n) => n.id).filter((n) => profiles[n])
  if (!networks.length) return { ...base, tasks: [], state: 'sem-perfil' }

  const doneAt = (network: Network, step: StepId) => mine.find((t) => t.network === network && t.step === step)?.at
  const today = dayStart(now)
  const tasks: Task[] = []

  for (const network of networks) {
    if (!doneAt(network, 'seguir')) tasks.push({ opportunity: o, network, profile: profiles[network]!, step: 'seguir', due: today })
  }

  // A conversa fica na rede onde a primeira mensagem foi; antes dela, na primeira que aceita mensagem
  const primary =
    mine.find((t) => t.step === 'mensagem' && t.network && profiles[t.network])?.network ?? networks.find((n) => canMessage(n, profiles[n]!))
  // Já contatada por outro canal (WhatsApp, ligação): nas redes, só o primeiro toque
  const elsewhere = o.stage === 'contatado' && !mine.some((t) => t.step === 'mensagem')

  if (primary && !elsewhere) {
    let previous = doneAt(primary, 'seguir')
    for (const { step, wait } of TRACK[primary]) {
      const at = doneAt(primary, step)
      if (at) {
        previous = at
        continue
      }
      // Antes de seguir na rede da conversa, o resto da sequência ainda não tem data
      if (previous) {
        tasks.push({
          opportunity: o,
          network: primary,
          profile: profiles[primary]!,
          step,
          due: Math.max(addDays(previous, wait), today),
          waitingPage: step === 'mensagem' && !pageReady(o),
        })
      }
      break
    }
  }

  return { ...base, primary, tasks, state: tasks.length ? 'ativo' : 'feito' }
}

/** As empresas mais quentes primeiro: quem já tem página, depois a nota da busca. */
const STAGE_ORDER: Record<string, number> = { pagina: 0, contatado: 1, selecionado: 2, mapeado: 3 }

const STEP_ORDER: Record<StepId, number> = { retomar: 0, mensagem: 1, comentar: 2, seguir: 3 }

/** Prioridade das empresas na fila de hoje (menor vem antes). */
export const leadRank = (plan: LeadPlan) => {
  const message = plan.tasks.some((t) => t.step === 'mensagem' || t.step === 'retomar') ? 0 : 1
  return [message, STAGE_ORDER[plan.opportunity.stage] ?? 9, -plan.opportunity.lead.score]
}

const compareRank = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

export interface Queue {
  /** Os toques de hoje, dentro do limite, agrupados por empresa. */
  today: Task[]
  /** Venceram, mas o limite do dia acabou: ficam para amanhã. */
  overflow: Task[]
  /** Vencem nos próximos dias. */
  upcoming: Task[]
  /** A primeira mensagem espera a página nova. */
  waitingPage: Task[]
}

export type Usage = Record<Network, Record<Bucket, number>>

export const emptyUsage = (): Usage => ({
  instagram: { seguir: 0, comentar: 0, mensagem: 0 },
  linkedin: { seguir: 0, comentar: 0, mensagem: 0 },
  facebook: { seguir: 0, comentar: 0, mensagem: 0 },
})

/** O que esta pessoa já fez hoje em cada rede. */
export function usageToday(touches: Touch[], userId: string | undefined, now = Date.now()): Usage {
  const usage = emptyUsage()
  const today = dayStart(now)
  for (const t of touches) {
    if (t.by !== userId || !t.network || t.at < today || t.step === 'resposta' || t.step === 'pausa') continue
    usage[t.network][bucketOf(t.step)] += 1
  }
  return usage
}

/** `forced`: oportunidades em que a pessoa escolheu mandar a mensagem sem esperar a página. */
export function buildQueue(plans: LeadPlan[], usage: Usage, forced: Set<string>, now = Date.now()): Queue {
  const today = dayStart(now)
  const queue: Queue = { today: [], overflow: [], upcoming: [], waitingPage: [] }
  const left = Object.fromEntries(NETWORKS.map((n) => [n.id, { ...DAILY_LIMIT[n.id] }])) as Usage
  for (const n of NETWORKS) for (const b of Object.keys(left[n.id]) as Bucket[]) left[n.id][b] = Math.max(0, DAILY_LIMIT[n.id][b] - usage[n.id][b])

  const ordered = [...plans].sort((a, b) => compareRank(leadRank(a), leadRank(b)))
  for (const plan of ordered) {
    const tasks = [...plan.tasks].sort((a, b) => STEP_ORDER[a.step] - STEP_ORDER[b.step] || NETWORKS.findIndex((n) => n.id === a.network) - NETWORKS.findIndex((n) => n.id === b.network))
    for (const task of tasks) {
      if (task.waitingPage && !forced.has(plan.opportunity.id)) queue.waitingPage.push(task)
      else if (task.due > today) queue.upcoming.push(task)
      else if (left[task.network][bucketOf(task.step)] > 0) {
        left[task.network][bucketOf(task.step)] -= 1
        queue.today.push(task)
      } else queue.overflow.push(task)
    }
  }
  queue.upcoming.sort((a, b) => a.due - b.due)
  return queue
}

// ---------------------------------------------------------------- textos

export const STEP_LABEL: Record<Network, Record<StepId, string>> = {
  instagram: { seguir: 'Seguir e curtir 2 posts', comentar: 'Comentar um post', mensagem: 'Mandar a primeira mensagem', retomar: 'Retomar a conversa' },
  linkedin: { seguir: 'Conectar', comentar: 'Comentar uma publicação', mensagem: 'Mandar a primeira mensagem', retomar: 'Retomar a conversa' },
  facebook: { seguir: 'Curtir e seguir a página', comentar: 'Comentar uma publicação', mensagem: 'Mandar a primeira mensagem', retomar: 'Retomar a conversa' },
}

/** Como o toque entra na linha do tempo do cliente. */
const DONE_LABEL: Record<StepId | EndId, string> = {
  seguir: 'Primeiro toque (seguir)',
  comentar: 'Comentou uma publicação',
  mensagem: 'Primeira mensagem',
  retomar: 'Retomou a conversa',
  resposta: 'Respondeu',
  pausa: 'Saiu da fila das redes',
}

const linkedinPerson = (profile: string) => /linkedin\.com\/in\//i.test(profileUrl('linkedin', profile))

/** O nome do toque na tela (no LinkedIn, a página da empresa só se segue). */
export const stepLabel = (task: Pick<Task, 'network' | 'step' | 'profile'>) =>
  task.network === 'linkedin' && task.step === 'seguir' && !linkedinPerson(task.profile) ? 'Seguir a página da empresa' : STEP_LABEL[task.network][task.step]

/** A primeira mensagem do roteiro de venda (entre aspas em "Como ofertar"), quando há. */
const briefMessage = (o: Opportunity) => /"([^"]{40,})"/.exec(o.brief?.how ?? '')?.[1]?.trim()

export interface Script {
  /** O que fazer, em uma ou duas frases. */
  hint: string
  /** O texto para copiar (mensagem, nota do convite), quando há. */
  text?: string
}

/**
 * O texto de cada toque. A mensagem é assinada por quem envia, sempre "da
 * Avence Studio"; nunca fala do Superelements nem de preço. Com a página nova
 * pronta, oferece a prévia (o gancho mais forte); sem ela, pergunta.
 */
export function scriptFor(task: Task, sender: string): Script {
  const o = task.opportunity
  const who = displayName(o.lead.name)
  const ready = pageReady(o)
  const sign = (text: string) => text.replace(/\[seu nome\]/gi, sender)

  if (task.step === 'seguir') {
    if (task.network === 'instagram') return { hint: 'Siga o perfil e curta 2 posts recentes. Nada de mensagem hoje: o objetivo é eles verem seu nome.' }
    if (task.network === 'facebook') return { hint: 'Curta e siga a página. Nada de mensagem hoje.' }
    if (!linkedinPerson(task.profile))
      return { hint: 'É a página da empresa: siga. Se achar o sócio ou o dono no LinkedIn, cole o perfil dele aqui para a conversa ir por lá.' }
    return {
      hint: 'Peça a conexão com nota (o LinkedIn aceita até 200 caracteres na nota).',
      text: `Olá! Aqui é ${sender}, da Avence Studio, um estúdio de sites de São Leopoldo. Vi o trabalho de ${who} e gostaria de me conectar.`,
    }
  }

  if (task.step === 'comentar')
    return {
      hint: 'Comente um post recente com algo específico dele: o assunto, a foto, uma dúvida real. Sem falar de site nem da Avence; o comentário é para eles lembrarem do seu nome.',
    }

  if (task.step === 'mensagem') {
    const where = task.network === 'instagram' ? 'pelo direct' : task.network === 'facebook' ? 'pelo Messenger da página' : 'pelo LinkedIn (depois que aceitarem a conexão)'
    const text = ready
      ? sign(briefMessage(o) ?? `Olá! Aqui é [seu nome], da Avence Studio. Vi o site de ${who} e fizemos uma versão nova dele, já pronta. Posso te mandar o link para ver no celular?`)
      : `Olá! Aqui é ${sender}, da Avence Studio. Acompanho o perfil de ${who} e tenho uma ideia para o site de vocês, pensando em quem chega pelo celular. Posso te mostrar por aqui?`
    return {
      hint: `Mande ${where}. Curta, sem link, preço nem vídeo: o link vai quando responderem.${task.network === 'instagram' ? ' Se seguiram você de volta, cai direto na caixa de entrada.' : ''}`,
      text,
    }
  }

  return {
    hint: 'Só um lembrete. Sem resposta depois dele, a sequência termina; marque como Perdido no funil, com o motivo.',
    text: ready
      ? 'Oi! Passando para saber se viram minha mensagem. Se preferirem, mando o link por aqui mesmo e vocês olham com calma.'
      : 'Oi! Passando para saber se viram minha mensagem. Se fizer sentido, mostro a ideia por aqui mesmo, sem compromisso de nada.',
  }
}

// ---------------------------------------------------------------- banco

const DAYS_BACK = 180

interface TouchRow {
  id: string
  client_id: string
  opportunity_id: string | null
  data: Json
  created_by: string | null
  created_at: string
}

const toTouch = (row: TouchRow): Touch | null => {
  const data = (row.data ?? {}) as { network?: string; step?: string }
  if (!row.opportunity_id || !data.step) return null
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    clientId: row.client_id,
    network: NETWORKS.some((n) => n.id === data.network) ? (data.network as Network) : undefined,
    step: data.step as Touch['step'],
    by: row.created_by ?? undefined,
    at: new Date(row.created_at).getTime(),
  }
}

const chunks = <T,>(list: T[], size = 80) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size))

/** Coluna que não existe: a migração 20261014120000 ainda não foi aplicada. */
const missingColumn = (error: { code?: string } | null) => error?.code === '42703' || error?.code === 'PGRST204'

export interface SocialData {
  opportunities: Opportunity[]
  /** Os perfis gravados no cadastro de cada cliente. */
  saved: Map<string, Profiles>
  touches: Touch[]
  /** Sem a migração: dá para ver a fila, não para anotar nem gravar LinkedIn e Facebook. */
  needsMigration: boolean
}

export async function loadSocial(): Promise<SocialData> {
  const { team, pipeline } = await crmContext()
  const opportunities = (await listOpportunities(pipeline.id)).filter((o) => SOCIAL_STAGES.includes(o.stage))

  const saved = new Map<string, Profiles>()
  let needsMigration = false
  const ids = [...new Set(opportunities.map((o) => o.clientId))]
  for (const part of chunks(ids)) {
    let rows: { id: string; instagram: string | null; linkedin?: string | null; facebook?: string | null }[] | null = null
    const full = await supabase.from('crm_clients').select('id, instagram, linkedin, facebook').in('id', part)
    if (missingColumn(full.error)) {
      needsMigration = true
      const basic = await supabase.from('crm_clients').select('id, instagram').in('id', part)
      if (basic.error) throw basic.error
      rows = basic.data
    } else if (full.error) throw full.error
    else rows = full.data
    for (const row of rows ?? []) saved.set(row.id, { instagram: trim(row.instagram), linkedin: trim(row.linkedin), facebook: trim(row.facebook) })
  }

  const since = new Date(Date.now() - DAYS_BACK * 86_400_000).toISOString()
  const touches: Touch[] = []
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await supabase
      .from('crm_activities')
      .select('id, client_id, opportunity_id, data, created_by, created_at')
      .eq('team_id', team.id)
      .eq('kind', 'social')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    for (const row of (data ?? []) as TouchRow[]) {
      const touch = toTouch(row)
      if (touch) touches.push(touch)
    }
    if (!data || data.length < 1000) break
  }

  return { opportunities, saved, touches, needsMigration }
}

/** Grava o perfil de uma rede no cadastro do cliente (vazio apaga). */
export async function saveProfile(clientId: string, network: Network, value: string): Promise<string | undefined> {
  const clean = network === 'instagram' ? normalizeInstagram(value) : normalizeLink(network, value)
  const { error } = await supabase
    .from('crm_clients')
    .update({ [network]: clean || null } as never)
    .eq('id', clientId)
  if (error) throw missingColumn(error) ? new Error('Falta aplicar a migração 20261014120000 no Supabase para gravar LinkedIn e Facebook.') : error
  return clean || undefined
}

const plusDays = (days: number) => new Date(addDays(Date.now(), days)).toISOString().slice(0, 10)

export interface Logged {
  touch: Touch
  /** A oportunidade depois do toque, quando a etapa ou o próximo passo mudou. */
  opportunity?: Opportunity
  /** Para desfazer: a etapa e o próximo passo de antes. */
  before?: Pick<Opportunity, 'stage' | 'nextStep' | 'nextDate'>
}

/**
 * Anota o toque na linha do tempo do cliente. A primeira mensagem leva a
 * empresa para "Contatado"; a resposta, para "Em conversa"; e cada toque deixa
 * o próximo passo da oportunidade em dia.
 */
export async function logTouch(o: Opportunity, step: StepId | EndId, network: Network | undefined, text?: string): Promise<Logged> {
  const label = DONE_LABEL[step]
  const body = [network ? `${NETWORK_LABEL[network]} · ${label}` : label, text?.trim()].filter(Boolean).join('\n\n').slice(0, 8000)
  const { data, error } = await supabase
    .from('crm_activities')
    .insert({ client_id: o.clientId, opportunity_id: o.id, kind: 'social', body, data: { network: network ?? null, step } } as never)
    .select('id, client_id, opportunity_id, data, created_by, created_at')
    .single()
  if (error) {
    if (error.code === '23514' || error.code === '42501') throw new Error('Falta aplicar a migração 20261014120000 no Supabase para anotar os toques nas redes.')
    throw error
  }
  const touch = toTouch(data as TouchRow)!

  const where = network ? NETWORK_LABEL[network] : 'nas redes'
  let patch: Parameters<typeof updateOpportunity>[1] | undefined
  if (step === 'mensagem')
    patch = {
      ...(['mapeado', 'selecionado', 'pagina'].includes(o.stage) ? { stage: 'contatado' as Stage } : {}),
      nextStep: `Retomar no ${where} se não responderem`,
      nextDate: plusDays(network === 'instagram' ? 4 : 5),
    }
  else if (step === 'retomar') patch = { nextStep: 'Sem resposta: marcar como Perdido, com o motivo', nextDate: plusDays(4) }
  else if (step === 'resposta')
    patch = { stage: 'conversa', nextStep: pageReady(o) ? `Mandar o link da página nova no ${where}` : 'Mostrar a ideia do site e marcar uma conversa', nextDate: plusDays(0) }

  if (!patch) return { touch }
  const before = { stage: o.stage, nextStep: o.nextStep, nextDate: o.nextDate }
  try {
    const opportunity = await updateOpportunity(o.id, patch)
    return { touch, opportunity, before }
  } catch (error) {
    console.error('[social] toque anotado, mas a oportunidade não mudou', error)
    return { touch }
  }
}

/** Desfaz um toque: apaga a anotação e devolve a etapa e o próximo passo de antes. */
export async function undoTouch(logged: Logged): Promise<Opportunity | undefined> {
  const { error } = await supabase.from('crm_activities').delete().eq('id', logged.touch.id)
  if (error) throw error
  if (!logged.before || !logged.opportunity) return undefined
  const { stage, nextStep, nextDate } = logged.before
  return updateOpportunity(logged.opportunity.id, {
    ...(stage !== logged.opportunity.stage ? { stage } : {}),
    nextStep: nextStep ?? '',
    nextDate: nextDate ?? '',
  })
}
