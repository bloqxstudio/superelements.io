import { useMemo } from 'react'
import { create } from 'zustand'
import { useCreativeLink } from '@/features/criativos/link'
import { useChat } from '@/features/space/chat/chatStore'
import type { ChatAgentId } from '@/features/space/chat/protocol'
import { forcedIa, modelFor, useIaModels, withIa } from './modelos'

/**
 * Qual IA desta máquina faz cada tipo de trabalho: criativos, textos (Copy) e
 * sites (páginas no Space). A escolha vale para a conta inteira e é lida por
 * quem dispara o trabalho, inclusive o que roda em segundo plano. Os seletores
 * que já existiam (chat de criativos, painel da Copy, chat do Space) leem e
 * gravam aqui, então ficam sempre de acordo.
 */

export type IaTask = 'criativos' | 'video' | 'copy' | 'sites' | 'comercial' | 'stories' | 'perfil'

export const IA_TASKS: { id: IaTask; label: string; hint: string }[] = [
  { id: 'criativos', label: 'Criativos', hint: 'Posts e carrosséis, edição no editor e posts vindos da Copy' },
  { id: 'video', label: 'Vídeos', hint: 'Criador de vídeo, animação em código, conferência das regras e roteiro do vídeo explicativo (sem escolha, segue Criativos)' },
  { id: 'copy', label: 'Copy', hint: 'Pesquisas, textos e documentos das pastas' },
  { id: 'comercial', label: 'Comercial', hint: 'Revisão do funil, pesquisa de negócios e rascunhos de abordagem' },
  { id: 'sites', label: 'Sites e páginas', hint: 'Páginas no Space, inclusive as da fila de prospecção' },
  { id: 'stories', label: 'Stories', hint: 'Pauta, revisão, sequências e fotos dos stories programados (Instagram › Stories)' },
  { id: 'perfil', label: 'Análise de perfil', hint: 'Leitura da foto, da bio, dos destaques e do grid do Instagram conectado (Instagram › Análise)' },
]

/** Sem escolha feita, a tarefa prefere esta IA quando ela está instalada (os stories nasceram para o Codex). */
// Criativos: o Codex por padrão (2026-11-05, o usuário: "para criativos o claude code não é bom")
const PREFERRED: Partial<Record<IaTask, ChatAgentId>> = { stories: 'codex', criativos: 'codex' }

const KEY = 'ia-por-tarefa'
/** Onde cada escolha ficava antes desta tela. */
const OLD_KEY: Record<IaTask, string> = { criativos: 'criativos-agente', video: 'video-agente', copy: 'copy-agente-motor', sites: 'space-chat-agent', comercial: 'comercial-agente', stories: 'stories-agente', perfil: 'perfil-agente' }

const isId = (v: unknown): v is ChatAgentId => v === 'claude' || v === 'codex'

const read = (): Partial<Record<IaTask, ChatAgentId>> => {
  const out: Partial<Record<IaTask, ChatAgentId>> = {}
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    for (const t of IA_TASKS) {
      const v = saved[t.id] ?? localStorage.getItem(OLD_KEY[t.id])
      if (isId(v)) out[t.id] = v
    }
  } catch {
    // sem armazenamento: vale só nesta visita
  }
  return out
}

interface State {
  choice: Partial<Record<IaTask, ChatAgentId>>
  set: (task: IaTask, id: ChatAgentId) => void
}

export const useIaChoice = create<State>()((set, get) => ({
  choice: read(),
  set: (task, id) => {
    const choice = { ...get().choice, [task]: id }
    try {
      localStorage.setItem(KEY, JSON.stringify(choice))
      localStorage.setItem(OLD_KEY[task], id)
    } catch {
      // vale até recarregar
    }
    set({ choice })
    // O chat do Space é o motor dos sites: segue a escolha
    if (task === 'sites') useChat.getState().setAgent(id)
  },
}))

const firstAvailable = (agents: { id: ChatAgentId; available: boolean }[]) => agents.find((a) => a.available)?.id

/** O bastão da Iara (a IA forçada durante um trabalho) fica em `modelos.ts`, junto do modelo. */
export { withIa }

/**
 * A escolha da tarefa. Vídeos (2026-11-10, o usuário: "permita criar vídeos com o claude ou codex") têm escolha
 * própria; sem ela, seguem a dos Criativos, como era antes.
 */
const chosenFor = (task: IaTask, choice: Partial<Record<IaTask, ChatAgentId>>): ChatAgentId | undefined =>
  choice[task] ?? (task === 'video' ? choice.criativos ?? PREFERRED.criativos : PREFERRED[task])

/** A IA da tarefa: a escolhida, se estiver instalada; senão, a preferida da tarefa ou a que existir. */
export const resolveIa = (task: IaTask): ChatAgentId => {
  const agents = useCreativeLink.getState().agents
  const forced = forcedIa()
  if (forced && task !== 'sites' && agents.find((a) => a.id === forced)?.available) return forced
  const chosen = task === 'sites' ? useChat.getState().agent : chosenFor(task, useIaChoice.getState().choice)
  return (chosen && agents.find((a) => a.id === chosen)?.available ? chosen : firstAvailable(agents)) ?? chosen ?? 'claude'
}

/** Agente e modelo de uma tarefa, para pôr no pedido: `{ ...iaFor('video'), system, prompt }`. */
export const iaFor = (task: IaTask): { engine: ChatAgentId; model?: string } => {
  const engine = resolveIa(task)
  const model = modelFor(task, engine)
  return model ? { engine, model } : { engine }
}

/** Para as telas: a IA da tarefa, o modelo dela e como trocar os dois. */
export const useIa = (task: IaTask) => {
  const agents = useCreativeLink((s) => s.agents)
  const choice = useIaChoice((s) => s.choice)
  const chat = useChat((s) => s.agent)
  const chatModels = useChat((s) => s.models)
  const taskModels = useIaModels((s) => s.choice[task])
  const setModel = useIaModels((s) => s.set)
  // O chat do Space é a fonte dos sites: trocar a IA lá também troca aqui
  const chosen = task === 'sites' ? chat : chosenFor(task, choice)
  const set = useIaChoice((s) => s.set)
  const ia = useMemo<ChatAgentId>(() => (chosen && agents.find((a) => a.id === chosen)?.available ? chosen : firstAvailable(agents)) ?? chosen ?? 'claude', [agents, chosen])
  /** O modelo escolhido na tarefa para a IA dela (`''` = segue o do chat) e o que vale de fato. */
  const own = task === 'sites' ? '' : (taskModels?.[ia] ?? '')
  return {
    ia,
    pick: (id: ChatAgentId) => set(task, id),
    model: own,
    chatModel: chatModels[ia] ?? '',
    pickModel: (model: string) => setModel(task, ia, model),
  }
}
