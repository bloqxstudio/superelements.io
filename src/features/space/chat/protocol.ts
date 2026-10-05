/**
 * Chat do projeto com os agentes (Claude Code, Codex), dentro do canvas do
 * Space. O servidor de dev (`scripts/space/chatPlugin.ts`) roda o agente
 * escolhido nesta máquina e transmite o que ele faz; a aba mostra a conversa
 * e o cursor dele no canvas. Este arquivo é lido pelos dois lados: só tipos e
 * constantes, com import relativo.
 */

export type ChatAgentId = 'claude' | 'codex'

export interface ChatAgentInfo {
  id: ChatAgentId
  /** Nome no chat, no cursor e no diário da ponte (SPACE_AGENT). */
  name: string
  color: string
  /** Cor do texto sobre `color`. */
  ink: string
}

export const CHAT_AGENTS: Record<ChatAgentId, ChatAgentInfo> = {
  claude: { id: 'claude', name: 'Claude Code', color: '#D97757', ink: '#FFFFFF' },
  codex: { id: 'codex', name: 'Codex', color: '#0A0A0A', ink: '#FFFFFF' },
}

export const CHAT_AGENT_IDS = Object.keys(CHAT_AGENTS) as ChatAgentId[]

/** O que estava selecionado no canvas quando a mensagem foi enviada. */
export interface ChatContext {
  pageId?: string
  pageName?: string
  sections: Array<{ id: string; title: string; index?: number }>
  element?: {
    sectionId: string
    elementId: string
    /** Título, Botão, Container… */
    kind: string
    text?: string
  }
}

export type ChatStepKind = 'canvas' | 'read' | 'edit' | 'run' | 'search' | 'note'

/** Uma ação do agente, resumida para quem acompanha. */
export interface ChatStep {
  id: string
  at: number
  kind: ChatStepKind
  text: string
  /** Comando ou arquivo, para quem quiser ver o que rodou. */
  detail?: string
  state: 'running' | 'ok' | 'error'
  sectionId?: string
}

export type ChatPart = { type: 'text'; text: string } | { type: 'step'; step: ChatStep }

export interface ChatMessage {
  id: string
  at: number
  role: 'user' | 'agent'
  agent: ChatAgentId
  /** Mensagem da pessoa. */
  text?: string
  context?: ChatContext
  /** Resposta do agente: texto e ações, na ordem em que aconteceram. */
  parts?: ChatPart[]
  /** Ainda chegando. */
  streaming?: boolean
  /** Pensando (sem texto novo nem ação). */
  thinking?: boolean
  error?: string
  /** Parado por quem pediu. */
  stopped?: boolean
  durationMs?: number
  costUsd?: number
}

export interface ChatConversation {
  projectId: string
  projectName?: string
  messages: ChatMessage[]
  /** Agentes rodando agora neste projeto. */
  running: ChatAgentId[]
  updatedAt: number
  /** Conversa atual: compõe a sessão da ponte de cada agente (`chatSession`). */
  epoch: number
}

/** O que o servidor manda às abas: a conversa inteira, ou só a mensagem que mudou. */
export interface ChatStateEvent {
  projectId?: string
  agents?: ChatAgentAvailability[]
  conversation?: ChatConversation | null
  message?: ChatMessage
  running?: ChatAgentId[]
  epoch?: number
}

/** O agente está instalado nesta máquina? */
export interface ChatAgentAvailability {
  id: ChatAgentId
  available: boolean
  version?: string
  reason?: string
}

/** Onde o cursor de um agente deve estar: vem das ações dele. */
export interface ChatCursorHint {
  projectId: string
  /** SPACE_SESSION do agente: um cursor por sessão. */
  session: string
  agent: string
  sectionId?: string
  pageId?: string
  elementId?: string
  mode: CursorMode
  text?: string
}

export type CursorMode = 'arrive' | 'think' | 'read' | 'edit' | 'write' | 'done' | 'gone'

/** Eventos do websocket do Vite. */
export const CHAT_EVENTS = {
  hello: 'space-chat:hello',
  send: 'space-chat:send',
  stop: 'space-chat:stop',
  reset: 'space-chat:reset',
  state: 'space-chat:state',
  cursor: 'space-chat:cursor',
} as const

export interface ChatSendPayload {
  projectId: string
  projectName?: string
  agent: ChatAgentId
  text: string
  context: ChatContext
}

/** Sessão da ponte (SPACE_SESSION) de um agente no chat de um projeto. */
export const chatSession = (projectId: string, agent: ChatAgentId, epoch: number) => `chat-${agent}-${projectId.slice(0, 8)}-${epoch.toString(36)}`

export const agentInfoByName = (name: string | undefined): ChatAgentInfo | undefined =>
  Object.values(CHAT_AGENTS).find((a) => a.name === name) ??
  (name && /codex/i.test(name) ? CHAT_AGENTS.codex : name && /claude/i.test(name) ? CHAT_AGENTS.claude : undefined)
