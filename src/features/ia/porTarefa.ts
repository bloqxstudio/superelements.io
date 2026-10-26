import { useMemo } from 'react'
import { create } from 'zustand'
import { useCreativeLink } from '@/features/criativos/link'
import { useChat } from '@/features/space/chat/chatStore'
import type { ChatAgentId } from '@/features/space/chat/protocol'

/**
 * Qual IA desta máquina faz cada tipo de trabalho: criativos, textos (Copy) e
 * sites (páginas no Space). A escolha vale para a conta inteira e é lida por
 * quem dispara o trabalho, inclusive o que roda em segundo plano. Os seletores
 * que já existiam (chat de criativos, painel da Copy, chat do Space) leem e
 * gravam aqui, então ficam sempre de acordo.
 */

export type IaTask = 'criativos' | 'copy' | 'sites' | 'comercial' | 'stories'

export const IA_TASKS: { id: IaTask; label: string; hint: string }[] = [
  { id: 'criativos', label: 'Criativos', hint: 'Posts e carrosséis, edição no editor e posts vindos da Copy' },
  { id: 'copy', label: 'Copy', hint: 'Pesquisas, textos e documentos das pastas' },
  { id: 'comercial', label: 'Comercial', hint: 'Revisão do funil, pesquisa de negócios e rascunhos de abordagem' },
  { id: 'sites', label: 'Sites e páginas', hint: 'Páginas no Space, inclusive as da fila de prospecção' },
  { id: 'stories', label: 'Stories', hint: 'Pauta, revisão, sequências e fotos dos stories programados (Instagram › Stories)' },
]

/** Sem escolha feita, a tarefa prefere esta IA quando ela está instalada (os stories nasceram para o Codex). */
const PREFERRED: Partial<Record<IaTask, ChatAgentId>> = { stories: 'codex' }

const KEY = 'ia-por-tarefa'
/** Onde cada escolha ficava antes desta tela. */
const OLD_KEY: Record<IaTask, string> = { criativos: 'criativos-agente', copy: 'copy-agente-motor', sites: 'space-chat-agent', comercial: 'comercial-agente', stories: 'stories-agente' }

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

/** A IA da tarefa: a escolhida, se estiver instalada; senão, a preferida da tarefa ou a que existir. */
export const resolveIa = (task: IaTask): ChatAgentId => {
  const agents = useCreativeLink.getState().agents
  const chosen = task === 'sites' ? useChat.getState().agent : useIaChoice.getState().choice[task] ?? PREFERRED[task]
  return (chosen && agents.find((a) => a.id === chosen)?.available ? chosen : firstAvailable(agents)) ?? chosen ?? 'claude'
}

/** Para as telas: a IA da tarefa e como trocá-la. */
export const useIa = (task: IaTask) => {
  const agents = useCreativeLink((s) => s.agents)
  const mine = useIaChoice((s) => s.choice[task])
  const chat = useChat((s) => s.agent)
  // O chat do Space é a fonte dos sites: trocar a IA lá também troca aqui
  const chosen = task === 'sites' ? chat : mine ?? PREFERRED[task]
  const set = useIaChoice((s) => s.set)
  const ia = useMemo<ChatAgentId>(() => (chosen && agents.find((a) => a.id === chosen)?.available ? chosen : firstAvailable(agents)) ?? chosen ?? 'claude', [agents, chosen])
  return { ia, pick: (id: ChatAgentId) => set(task, id) }
}
