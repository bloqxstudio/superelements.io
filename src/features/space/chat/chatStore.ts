import { create } from 'zustand'
import type { ChatAgentAvailability, ChatAgentId, ChatConversation, ChatSendPayload } from './protocol'

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
  /** Para quem vai a próxima mensagem. */
  agent: ChatAgentId
  /** Conversa aberta acima da caixa de mensagem. */
  open: boolean
  setAgent: (agent: ChatAgentId) => void
  setOpen: (open: boolean) => void
  send?: (payload: ChatSendPayload) => void
  stop?: (projectId: string, agent: ChatAgentId) => void
  reset?: (projectId: string) => void
}

export const useChat = create<ChatState>()((set) => ({
  connected: false,
  agents: [],
  conversations: {},
  agent: savedAgent(),
  open: false,
  setAgent: (agent) => {
    try {
      localStorage.setItem(AGENT_KEY, agent)
    } catch {
      // Sem armazenamento: vale só nesta visita
    }
    set({ agent })
  },
  setOpen: (open) => set({ open }),
}))
