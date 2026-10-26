import { escapeHtml } from '@/features/copy/html'
import { docLink } from '@/features/copy/folder'
import { formatById, FORMATS, isResearch, NICHES, researchObjective } from '@/features/copy/knowledge'
import { runCopyAgent } from '@/features/copy/runner'
import { postsFromRequest } from '@/features/copy/send'
import { saveDoc } from '@/features/copy/storage'
import { block, EMPTY_BRIEF, uid, type CopyDoc, type FormatId } from '@/features/copy/types'
import { addActivity } from '@/features/crm/clients'
import { listOpportunities } from '@/features/crm/opportunities'
import { callAi } from '@/features/criativos/link'
import { listSets } from '@/features/criativos/storage'
import { crmContext } from '@/features/crm/crmStore'
import { runWeek } from '@/features/crm/storyPipeline'
import { addWeeks, weekLabel, weekStart } from '@/features/crm/stories'
import { finishJob, noteJob, patchJob, recordDelivery, startJob } from '@/features/operations/jobs'
import { displayName } from '@/features/prospects/offer'
import { STAGE_LABEL, STAGES, type Opportunity, type Stage } from '@/features/prospects/funnel'
import { CHAT_AGENTS } from '@/features/space/chat/protocol'
import { personaFor, profileNow } from './perfis'
import { resolveIa } from './porTarefa'

/**
 * As tarefas que uma rotina sabe fazer. Cada uma usa um agente de verdade (o
 * perfil dele vai junto) e deixa rastro: um job na tela Agentes, notas na linha
 * do tempo do cartão ou um documento novo. Nenhuma envia mensagem a ninguém nem
 * move cartão de etapa.
 */

export type TaskId = 'funil' | 'prospectar' | 'abordagem' | 'pesquisa' | 'tendencias' | 'oportunidades' | 'redigir' | 'posts' | 'stories'

export interface ParamDef {
  key: string
  label: string
  kind: 'text' | 'long' | 'number' | 'stage' | 'niche' | 'format' | 'set'
  placeholder?: string
  default?: string
  optional?: boolean
}

export interface TaskDef {
  id: TaskId
  label: string
  hint: string
  /** O agente que faz (id do perfil). */
  agent: string
  params: ParamDef[]
}

export const TASKS: TaskDef[] = [
  { id: 'funil', label: 'Rever o funil', hint: 'Aponta cartões parados e próximos passos vencidos, e anota a ação em cada um.', agent: 'ana', params: [] },
  { id: 'prospectar', label: 'Pesquisar negócios do funil', hint: 'Lê o site de cada negócio de uma etapa e anota o que mostra e como abordar.', agent: 'leo', params: [{ key: 'stage', label: 'Etapa', kind: 'stage', default: 'mapeado' }, { key: 'limit', label: 'Quantos por vez', kind: 'number', default: '3' }] },
  { id: 'abordagem', label: 'Rascunhar abordagens', hint: 'Escreve o rascunho da primeira mensagem de cada cartão de uma etapa. Não envia.', agent: 'duda', params: [{ key: 'stage', label: 'Etapa', kind: 'stage', default: 'pagina' }, { key: 'limit', label: 'Quantos por vez', kind: 'number', default: '3' }] },
  { id: 'pesquisa', label: 'Fazer uma pesquisa', hint: 'Cria uma pasta na Copy e o pesquisador mapeia o tema.', agent: 'caio', params: [{ key: 'topic', label: 'Tema', kind: 'long', placeholder: 'Ex.: como donos de clínica odontológica escolhem quem faz o site' }, { key: 'niche', label: 'Nicho', kind: 'niche' }] },
  { id: 'tendencias', label: 'Tendências, virais e campanhas', hint: 'Pesquisa o que está em alta para um público, o que viraliza e os modelos de campanha que funcionam, e sugere o que adaptar.', agent: 'caio', params: [{ key: 'topic', label: 'Público ou tema', kind: 'long', placeholder: 'Ex.: donos de clínicas odontológicas no Instagram e no WhatsApp' }, { key: 'niche', label: 'Nicho', kind: 'niche' }] },
  { id: 'oportunidades', label: 'Oportunidades de negócio e nichos', hint: 'Avalia nichos que o estúdio pode atender, com sinais de demanda, concorrência, encaixe e como validar.', agent: 'caio', params: [{ key: 'topic', label: 'Região ou foco (opcional)', kind: 'long', optional: true, placeholder: 'Ex.: serviços de saúde e jurídicos no Rio Grande do Sul que anunciam no Google' }] },
  { id: 'redigir', label: 'Escrever um documento', hint: 'Cria um documento novo na Copy e o redator escreve.', agent: 'bia', params: [{ key: 'format', label: 'Formato', kind: 'format', default: 'post-instagram' }, { key: 'request', label: 'O que escrever', kind: 'long', placeholder: 'Ex.: um post sobre site rápido para arquitetos' }, { key: 'niche', label: 'Nicho', kind: 'niche' }] },
  { id: 'posts', label: 'Criar postagens', hint: 'A designer cria carrosséis num conjunto de criativos.', agent: 'dani', params: [{ key: 'request', label: 'Sobre o quê', kind: 'long', placeholder: 'Ex.: 3 carrosséis sobre por que o Instagram não substitui um site' }, { key: 'setId', label: 'Conjunto de criativos', kind: 'set' }, { key: 'count', label: 'Quantos posts', kind: 'number', default: '3' }] },
  { id: 'stories', label: 'Programar stories da semana', hint: 'Estrategista, Editor, Designer e Ilustradora montam os stories dos horários livres desta semana e da próxima, com os ajustes de Instagram › Stories. Ficam para a equipe aprovar: nada vai ao ar sem aprovação.', agent: 'nina', params: [] },
]

export const taskById = (id: TaskId) => TASKS.find((t) => t.id === id)!
export const STAGE_CHOICES = STAGES.map((s) => ({ id: s.id, label: s.label }))
export const FORMAT_CHOICES = FORMATS.map((f) => ({ id: f.id, label: f.label }))
export const NICHE_CHOICES = NICHES.map((n) => ({ id: n.id, label: n.label }))

export interface TaskRun {
  params: Record<string, string>
  /** Cartões que a rotina já trabalhou (não repete). */
  done: string[]
  signal: AbortSignal
}
export interface TaskResult {
  message: string
  done?: string[]
}

const num = (v: string | undefined, fallback: number, max = 10) => Math.min(max, Math.max(1, Number(v) || fallback))
const plainDays = (iso: string | undefined) => (iso ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)) : 0)

/** Um job de comercial na tela Agentes, com o agente trabalhando na mesa. */
function commercialJob(agentId: string, label: string, signal: AbortSignal) {
  const p = profileNow(agentId)
  const engine = resolveIa('comercial')
  const controller = new AbortController()
  signal.addEventListener('abort', () => controller.abort(), { once: true })
  const id = startJob({ area: 'comercial', kind: 'Rotina', label, agent: `${p.base} · ${CHAT_AGENTS[engine].name}`, color: CHAT_AGENTS[engine].color, step: 'Lendo o funil', href: '/crm', silent: true }, controller)
  return { id, engine, controller }
}

async function ask(agentId: string, prompt: string, job: ReturnType<typeof commercialJob>, web = false) {
  const p = profileNow(agentId)
  return callAi<{ reply: string; items: { ref: string; text: string }[] }>(
    'agent',
    { engine: job.engine, system: personaFor(agentId), prompt, web: web && p.web },
    job.controller.signal,
    (_s, detail) => detail && noteJob(job.id, detail)
  )
}

const cardRow = (o: Opportunity) => ({
  ref: o.id,
  empresa: displayName(o.lead.name),
  etapa: STAGE_LABEL[o.stage],
  diasNaEtapa: plainDays(o.history.at(-1)?.at ?? o.updatedAt),
  proximoPasso: o.nextStep ?? null,
  proximaData: o.nextDate ?? null,
  servico: o.offer?.service ?? null,
  preco: o.offer?.price ?? null,
})

async function saveNotes(opps: Opportunity[], items: { ref: string; text: string }[], title: string, cap: number) {
  const byId = new Map(opps.map((o) => [o.id, o]))
  let n = 0
  for (const it of items.slice(0, cap)) {
    const o = byId.get(it.ref)
    if (!o || !it.text.trim()) continue
    await addActivity(o.clientId, 'note', `${title}: ${it.text.trim()}`, o.id)
    n++
  }
  return n
}

async function runFunil(run: TaskRun): Promise<TaskResult> {
  const job = commercialJob('ana', 'Revisão do funil', run.signal)
  try {
    const opps = (await listOpportunities()).filter((o) => o.stage !== 'fechado' && o.stage !== 'perdido')
    if (!opps.length) {
      finishJob(job.id)
      return { message: 'O funil está vazio.' }
    }
    noteJob(job.id, `Lendo ${opps.length} cartões abertos`)
    patchJob(job.id, { step: 'Analisando os cartões' })
    const today = new Date().toISOString().slice(0, 10)
    const out = await ask('ana', `Hoje é ${today}.\n\n## Cartões abertos do funil (JSON)\n${JSON.stringify(opps.slice(0, 120).map(cardRow))}\n\n## Tarefa\nRevise o funil. No \`reply\`, escreva até 8 linhas com o que precisa de ação hoje, por ordem de importância. Em \`items\`, uma nota para cada cartão que precisa de ação (ref = o campo ref do cartão, text = a ação em uma ou duas frases). Não inclua cartões que estão bem.`, job)
    patchJob(job.id, { step: 'Anotando nos cartões' })
    const n = await saveNotes(opps, out.items ?? [], 'Analista de funil', 20)
    finishJob(job.id)
    recordDelivery({ area: 'comercial', kind: 'Revisão do funil', label: `${n} cartões com ação`, agent: `${profileNow('ana').base}`, href: '/crm' })
    return { message: `${out.reply}${n ? `\n\n${n} notas gravadas nos cartões.` : ''}` }
  } catch (e) {
    finishJob(job.id, e)
    throw e
  }
}

async function candidates(run: TaskRun, agentLabel: string, needSite: boolean) {
  const stage = (run.params.stage || 'mapeado') as Stage
  const limit = num(run.params.limit, 3, 8)
  const all = await listOpportunities()
  const list = all.filter((o) => o.stage === stage && !run.done.includes(o.id) && (!needSite || o.lead.website)).slice(0, limit)
  return { list, stage, label: `${agentLabel} · ${STAGE_LABEL[stage]}` }
}

async function runProspectar(run: TaskRun): Promise<TaskResult> {
  const { list, label } = await candidates(run, 'Negócios', true)
  if (!list.length) return { message: 'Nenhum negócio novo com site nessa etapa.' }
  const job = commercialJob('leo', label, run.signal)
  const done: string[] = []
  try {
    let n = 0
    for (const o of list) {
      patchJob(job.id, { step: `Lendo o site de ${displayName(o.lead.name)}` })
      noteJob(job.id, o.lead.website ?? '')
      const out = await ask('leo', `## Negócio\nref: ${o.id}\nNome: ${displayName(o.lead.name)}\nSegmento: ${o.lead.category ?? o.lead.niche}\nCidade: ${o.region}\nSite: ${o.lead.website}\n\n## Tarefa\nAbra o site e escreva em \`items\` UMA nota para este negócio (ref = ${o.id}): o que o site mostra, como leva ao contato e a abordagem sugerida, em até 6 linhas. \`reply\` é uma frase de resumo.`, job, true)
      n += await saveNotes([o], out.items?.length ? out.items.map((i) => ({ ...i, ref: o.id })) : [], 'Prospector', 1)
      done.push(o.id)
    }
    finishJob(job.id)
    recordDelivery({ area: 'comercial', kind: 'Pesquisa de negócios', label: `${n} notas nos cartões`, agent: profileNow('leo').base, href: '/crm' })
    return { message: `${n} negócios pesquisados; as notas estão na linha do tempo de cada cliente.`, done }
  } catch (e) {
    finishJob(job.id, e)
    if (done.length) return { message: `Parou depois de ${done.length}: ${e instanceof Error ? e.message : 'erro'}`, done }
    throw e
  }
}

async function runAbordagem(run: TaskRun): Promise<TaskResult> {
  const { list, label } = await candidates(run, 'Abordagens', false)
  if (!list.length) return { message: 'Nenhum cartão novo nessa etapa.' }
  const job = commercialJob('duda', label, run.signal)
  try {
    patchJob(job.id, { step: 'Escrevendo os rascunhos' })
    const material = list.map((o) => ({ ref: o.id, empresa: displayName(o.lead.name), segmento: o.lead.category ?? o.lead.niche, cidade: o.region, site: o.lead.website ?? null, roteiro: o.brief?.how ?? null, pontos: o.brief?.points ?? null }))
    const out = await ask('duda', `## Cartões (JSON)\n${JSON.stringify(material)}\n\n## Tarefa\nEscreva o rascunho da primeira mensagem de WhatsApp para cada cartão. Em \`items\`: ref = o ref do cartão, text = a mensagem pronta para copiar. Use só o que está no material. \`reply\` é uma frase de resumo.`, job)
    const n = await saveNotes(list, out.items ?? [], 'Rascunho de abordagem (não enviado)', 8)
    finishJob(job.id)
    recordDelivery({ area: 'comercial', kind: 'Rascunhos de abordagem', label: `${n} rascunhos nos cartões`, agent: profileNow('duda').base, href: '/crm' })
    return { message: `${n} rascunhos gravados nos cartões. Nada foi enviado.`, done: list.map((o) => o.id) }
  } catch (e) {
    finishJob(job.id, e)
    throw e
  }
}

/** Documento novo na Copy, num formato, para o agente escrever. */
async function newDoc(format: FormatId, title: string, notes: string, niche: string | undefined, folder?: string): Promise<CopyDoc> {
  const spec = formatById(format)
  const now = Date.now()
  const doc: CopyDoc = {
    id: uid(),
    title,
    format,
    niche: niche || undefined,
    folderId: folder ? uid() : undefined,
    folderName: folder || undefined,
    brief: { ...EMPTY_BRIEF, notes: isResearch(format) ? notes : '', objective: researchObjective(format) },
    blocks: spec.skeleton.map((b) => block(b.type, escapeHtml(b.text ?? ''), b.label)),
    comments: [],
    createdAt: now,
    updatedAt: now,
  }
  await saveDoc(doc)
  return doc
}

async function runCopyTask(run: TaskRun, role: 'pesquisador' | 'redator', researchFormat: FormatId = 'pesquisa'): Promise<TaskResult> {
  const research = role === 'pesquisador'
  let request = (research ? run.params.topic : run.params.request)?.trim() ?? ''
  // Oportunidades pode rodar sem foco: o estúdio e o público vêm da identidade
  if (researchFormat === 'oportunidades' && !request) request = 'Avalie os nichos e públicos que o estúdio pode atender hoje, a partir do que ele vende e do cliente ideal.'
  if (!request) throw new Error('A rotina está sem o texto do pedido.')
  const format: FormatId = research ? researchFormat : ((run.params.format || 'post-instagram') as FormatId)
  const doc = await newDoc(format, `${formatById(format).label} · ${request.slice(0, 50)}`, request, run.params.niche, research ? (researchFormat === 'pesquisa' ? request : `${formatById(format).label}: ${request}`).slice(0, 60) : undefined)
  const r = await runCopyAgent({ message: research ? request : request, role, engine: resolveIa('copy'), web: research ? true : undefined }, run.signal, doc)
  recordDelivery({ area: 'copy', kind: research ? (researchFormat === 'tendencias' ? 'Tendências da rotina' : researchFormat === 'oportunidades' ? 'Oportunidades da rotina' : 'Pesquisa da rotina') : 'Documento da rotina', label: doc.title.slice(0, 100), agent: profileNow(research ? 'caio' : 'bia').base, href: docLink(doc), docId: doc.id })
  return { message: `${doc.title}: ${r.reply || 'pronto'}` }
}

async function runPosts(run: TaskRun): Promise<TaskResult> {
  const request = run.params.request?.trim()
  if (!request) throw new Error('A rotina está sem o texto do pedido.')
  const sets = await listSets()
  const target = sets.find((s) => s.id === run.params.setId) ?? sets[0]
  if (!target) throw new Error('Não há conjunto de criativos para receber os posts.')
  const r = await postsFromRequest(request, target, num(run.params.count, 3, 6), run.signal)
  return { message: `${r.postNames.length} posts criados em ${target.name}.` }
}

/** A semana atual (só os horários que ainda vêm) e a próxima. */
async function runStories(): Promise<TaskResult> {
  const { team } = await crmContext()
  const now = weekStart()
  const out: string[] = []
  for (const week of [now, addWeeks(now, 1)]) {
    const result = await runWeek(team.id, week, true)
    if (result) out.push(`Semana de ${weekLabel(week)}: ${result.message}`)
  }
  return { message: out.join('\n') || 'A esteira dos stories já estava rodando.' }
}

export async function executeTask(task: TaskId, run: TaskRun): Promise<TaskResult> {
  switch (task) {
    case 'funil':
      return runFunil(run)
    case 'prospectar':
      return runProspectar(run)
    case 'abordagem':
      return runAbordagem(run)
    case 'pesquisa':
      return runCopyTask(run, 'pesquisador')
    case 'tendencias':
      return runCopyTask(run, 'pesquisador', 'tendencias')
    case 'oportunidades':
      return runCopyTask(run, 'pesquisador', 'oportunidades')
    case 'redigir':
      return runCopyTask(run, 'redator')
    case 'posts':
      return runPosts(run)
    case 'stories':
      return runStories()
  }
}
