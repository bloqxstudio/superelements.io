import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useProjectStore } from '@/features/projects/projectStore'
import { useChat } from '@/features/space/chat/chatStore'
import { CHAT_AGENT_IDS, CHAT_AGENTS, type ChatAgentId, type ChatConversation, type ChatMessage } from '@/features/space/chat/protocol'
import { updateOpportunity } from './api'
import type { Opportunity } from './funnel'
import { displayName } from './offer'
import { PAGE_SKILL, projectBriefing, requestText, resumeText } from './pageTask'

/**
 * O botão ▶ da coluna "Fila da página": cria o projeto do prospecto no Space e
 * pede a página à IA conectada (Claude Code ou Codex, a mesma do chat do
 * canvas: no `npm run dev` pelo servidor do Vite, no app publicado pelo
 * conector). O agente trabalha em segundo plano, pela ponte, e no fim devolve
 * o cartão com `space prospect <id> --stage pagina`.
 */

const isAgent = (id: string | undefined): id is ChatAgentId => !!id && CHAT_AGENT_IDS.includes(id as ChatAgentId)

/** A IA que cria as páginas: a escolhida no chat, se estiver instalada; senão, a outra. */
export const usePageAgent = () => {
  const { connected, agents, agent, setAgent } = useChat(useShallow((s) => ({ connected: s.connected, agents: s.agents, agent: s.agent, setAgent: s.setAgent })))
  const available = useMemo(() => CHAT_AGENT_IDS.filter((id) => agents.find((a) => a.id === id)?.available), [agents])
  const chosen = available.includes(agent) ? agent : available[0]
  return { connected, available, agent: connected ? chosen : undefined, setAgent }
}

/** Nome livre na conta: "Fulano Advogados", senão "Fulano Advogados (2)"… */
const freeName = (base: string) => {
  const taken = new Set(useProjectStore.getState().projects.map((p) => p.name.trim().toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  for (let n = 2; ; n++) if (!taken.has(`${base} (${n})`.toLowerCase())) return `${base} (${n})`
}

/** Projeto que esta oportunidade já criou pelo botão (e ainda existe na conta). */
const builtProject = (o: Opportunity) => (o.build ? useProjectStore.getState().projects.find((p) => p.id === o.build!.projectId) : undefined)

/**
 * Começa (ou retoma) a página. Projeto novo, com o briefing da busca no
 * Contexto; o cartão guarda o projeto e o agente antes de o pedido sair, para
 * o andamento aparecer mesmo depois de recarregar a tela.
 */
export async function startPageBuild(o: Opportunity, agent: ChatAgentId): Promise<Opportunity> {
  const { send } = useChat.getState()
  if (!send) throw new Error('A IA não está conectada')
  // Sem a lista, o projeto que o cartão já criou parece não existir e sairia outro
  if (useProjectStore.getState().status !== 'ready') throw new Error('Os projetos da conta ainda estão carregando. Tente de novo em instantes.')
  const existing = builtProject(o)
  const project = existing ?? (await useProjectStore.getState().create({ name: freeName(displayName(o.lead.name)), context: projectBriefing(o) }))
  const updated = await updateOpportunity(o.id, { projectName: project.name, projectId: project.id, build: { projectId: project.id, agent, startedAt: new Date().toISOString() } })
  send({
    projectId: project.id,
    projectName: project.name,
    agent,
    text: existing ? resumeText(o) : requestText(o),
    context: { sections: [] },
    skill: PAGE_SKILL,
    task: { kind: 'prospect', opportunityId: o.id },
  })
  return { ...updated, lead: o.lead }
}

export function stopPageBuild(o: Opportunity) {
  const agent = o.build?.agent
  if (o.build && isAgent(agent)) useChat.getState().stop?.(o.build.projectId, agent)
}

export type BuildState =
  /** Sem criação pelo botão. */
  | { kind: 'idle' }
  /** Começou, mas a conversa não chegou (IA desconectada ou ainda carregando). */
  | { kind: 'unknown' }
  | { kind: 'running'; agent: string; text: string }
  /** Parou com erro ou alguém parou: dá para retomar. */
  | { kind: 'failed'; agent: string; text: string }
  /** A IA respondeu sem devolver o cartão (faltou algo, ou ela tem uma pergunta). */
  | { kind: 'answered'; agent: string; text: string }

const lastAnswer = (conversation: ChatConversation, agent: ChatAgentId): ChatMessage | undefined =>
  [...conversation.messages].reverse().find((m) => m.role === 'agent' && m.agent === agent)

const shortText = (text: string, max = 140) => {
  const clean = text.replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

/** O que a última resposta do agente está fazendo agora: o passo em andamento, ou o último. */
const currentStep = (message: ChatMessage | undefined) => {
  const steps = (message?.parts ?? []).flatMap((p) => (p.type === 'step' ? [p.step] : []))
  return ([...steps].reverse().find((s) => s.state === 'running') ?? steps[steps.length - 1])?.text
}

const answerText = (message: ChatMessage | undefined) => {
  const texts = (message?.parts ?? []).flatMap((p) => (p.type === 'text' ? [p.text] : []))
  return texts.length ? shortText(texts[texts.length - 1]) : ''
}

/** O andamento da página do cartão, lido da conversa do agente no projeto. */
export const useBuildState = (o: Opportunity): BuildState => {
  const build = o.build
  // Sem conexão, a última notícia da conversa pode estar velha: não dá para dizer se ainda roda
  const conversation = useChat((s) => (build && s.connected ? s.conversations[build.projectId] : undefined))
  return useMemo((): BuildState => {
    if (!build) return { kind: 'idle' }
    const agent = isAgent(build.agent) ? build.agent : undefined
    if (!agent || !conversation) return { kind: 'unknown' }
    const name = CHAT_AGENTS[agent].name
    const answer = lastAnswer(conversation, agent)
    if (conversation.running.includes(agent)) return { kind: 'running', agent: name, text: currentStep(answer) ?? (answer?.thinking ? 'Pensando' : 'Começando') }
    if (!answer) return { kind: 'unknown' }
    if (answer.error || answer.stopped) return { kind: 'failed', agent: name, text: shortText(answer.error ?? 'Parado antes de terminar') }
    return { kind: 'answered', agent: name, text: answerText(answer) || 'Respondeu sem terminar a página' }
  }, [build, conversation])
}
