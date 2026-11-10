import { create } from 'zustand'
import { DEFAULT_CHAT_MODEL, claudeModelId, type ChatAgentAvailability, type ChatAgentId, type ChatConversation, type ChatPlanUsage, type ChatSendPayload } from './protocol'

/** Onde fica o modelo de cada agente (o do Claude Code já ficava em `space-chat-model`). */
const MODEL_KEY: Record<ChatAgentId, string> = { claude: 'space-chat-model', codex: 'space-chat-model-codex' }

const savedModels = (): Record<ChatAgentId, string> => {
  try {
    const claude = localStorage.getItem(MODEL_KEY.claude)
    const codex = localStorage.getItem(MODEL_KEY.codex) ?? ''
    return { claude: claudeModelId(claude) ?? DEFAULT_CHAT_MODEL, codex: /^[\w.-]{0,60}$/.test(codex) ? codex : '' }
  } catch {
    return { claude: DEFAULT_CHAT_MODEL, codex: '' }
  }
}

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
  /**
   * Modelo de cada agente para a próxima mensagem (guardado neste navegador). No Codex, `''` é o do `config.toml`.
   * Também é o padrão das tarefas sem modelo próprio (`ia/modelos.ts`).
   */
  models: Record<ChatAgentId, string>
  setModel: (agent: ChatAgentId, model: string) => void
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
  /** Traz a conversa de um projeto que não está aberto (o funil acompanha as páginas em criação). */
  watch?: (projectId: string) => void
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
  models: savedModels(),
  setModel: (agent, model) => {
    const next = agent === 'claude' ? (claudeModelId(model) ?? DEFAULT_CHAT_MODEL) : model
    try {
      localStorage.setItem(MODEL_KEY[agent], next)
    } catch {
      // Sem armazenamento: vale só nesta visita
    }
    set((s) => ({ models: { ...s.models, [agent]: next } }))
  },
  setOpen: (open) => set({ open }),
  setSkill: (skill) => set({ skill }),
}))
