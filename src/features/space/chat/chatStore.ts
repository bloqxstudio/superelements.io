import { create } from 'zustand'
import type { ChatAgentAvailability, ChatAgentId, ChatConversation, ChatPlanUsage, ChatSendPayload } from './protocol'


/**
 * O chat de cada projeto, como o servidor de dev manda (ver `connection.ts`).
 * A conversa vive no servidor, em `.space/chat.json`; aqui fica a cópia que a
 * tela mostra, o agente escolhido e se o painel está aberto. Fora do
 * `npm run dev` fica desconectado e o chat não aparece.
 */

const AGENT_KEY = 'space-chat-agent'

const savedAgent = (): ChatAgentId => {
  try {
    return localStorage.getItem(AGENT_KEY) === 'codex' ? 'codex' : 'claude'
  } catch {
    return 'claude'
  }
}

interface ChatState {
  connected: boolean
  agents: ChatAgentAvailability[]
  conversations: Record<string, ChatConversation>
  /** Quanto do plano a conta de cada agente já gastou, como o agente informou por último. */
  planUsage: Partial<Record<ChatAgentId, ChatPlanUsage>>
  /** Para quem vai a próxima mensagem. */
  agent: ChatAgentId
  /** Conversa aberta acima da caixa de mensagem. */
  open: boolean
  /** Skill escolhida na caixa (o id): vai com cada pedido até a pessoa tirar. */
  skill: string | null
  setAgent: (agent: ChatAgentId) => void
  setSkill: (skill: string | null) => void
  setOpen: (open: boolean) => void
  send?: (payload: ChatSendPayload) => void
  stop?: (projectId: string, agent: ChatAgentId) => void
  reset?: (projectId: string) => void
  /** Volta para uma conversa do histórico; a atual vai para o histórico. */
  openConversation?: (projectId: string, epoch: number) => void
  /** Apaga uma conversa do histórico. */
  forgetConversation?: (projectId: string, epoch: number) => void
}

export const useChat = create<ChatState>()((set) => ({
  connected: false,
  agents: [],
  conversations: {},
  planUsage: {},
  agent: savedAgent(),
  open: false,
  skill: null,
  setAgent: (agent) => {
    try {
      localStorage.setItem(AGENT_KEY, agent)
    } catch {
      // Sem armazenamento: vale só nesta visita
    }
    set({ agent })
  },
  setOpen: (open) => set({ open }),
  setSkill: (skill) => set({ skill }),
}))
