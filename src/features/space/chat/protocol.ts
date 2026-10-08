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

/**
 * A skill de um pedido. A padrão vai só pelo id; a cadastrada na conta leva as
 * instruções, porque quem roda o agente (o servidor de dev ou o conector) não
 * lê a conta. A mensagem guarda o id, o nome e a versão, sem as instruções.
 */
export interface ChatSkillRef {
  id: string
  name: string
  instructions?: string
  /** Quando a skill cadastrada mudou: outra versão volta a mandar as instruções inteiras. */
  version?: string
}

/** Imagens por mensagem, e o maior lado delas (o navegador reduz antes de mandar). */
export const CHAT_IMAGE_LIMIT = 4
export const CHAT_IMAGE_MAX_SIDE = 1600

/** Imagem que a pessoa anexou: o navegador manda reduzida, com uma miniatura para a conversa. */
export interface ChatImageUpload {
  name: string
  /** data URL da imagem (PNG se tiver transparência, senão JPEG). */
  data: string
  /** data URL pequena (JPEG), para mostrar na conversa. */
  preview: string
  width: number
  height: number
}

/** Imagem guardada na mensagem: a miniatura e onde o arquivo ficou para o agente. */
export interface ChatImage {
  name: string
  preview: string
  width: number
  height: number
  /** Caminho do arquivo a partir da pasta do agente (`.space/anexos/…`). */
  file?: string
}

export interface ChatMessage {
  id: string
  at: number
  role: 'user' | 'agent'
  agent: ChatAgentId
  /** Mensagem da pessoa. */
  text?: string
  context?: ChatContext
  /** Imagens que a pessoa anexou. */
  images?: ChatImage[]
  /** Skill escolhida para o pedido (Web designer, SEO, uma cadastrada…). Mensagens antigas guardam só o id da padrão. */
  skill?: ChatSkillRef | string
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
  /** Tokens que a resposta gastou, como o agente informa no fim. */
  tokens?: ChatTokens
}

/** Tokens de uma resposta: entrada nova, saída e o que veio do cache (lido ou gravado). */
export interface ChatTokens {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
}

/** Tudo o que a resposta processou: entrada, cache e saída. */
export const totalTokens = (t: ChatTokens | undefined) => (t ? t.input + t.output + (t.cacheRead ?? 0) + (t.cacheWrite ?? 0) : 0)

/** Uma conversa guardada do projeto, para a lista do histórico. */
export interface ChatHistoryItem {
  epoch: number
  /** O primeiro pedido, encurtado. */
  title: string
  startedAt: number
  updatedAt: number
  /** Pedidos da pessoa na conversa. */
  requests: number
  tokens: number
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
  /** As conversas anteriores do projeto, a mais recente primeiro (sem as mensagens). */
  history?: ChatHistoryItem[]
}

/** O que o servidor manda às abas: a conversa inteira, ou só a mensagem que mudou. */
export interface ChatStateEvent {
  projectId?: string
  agents?: ChatAgentAvailability[]
  conversation?: ChatConversation | null
  message?: ChatMessage
  running?: ChatAgentId[]
  epoch?: number
  /** Quanto do plano a conta do agente nesta máquina já gastou (o que o /usage mostra). */
  usage?: Partial<Record<ChatAgentId, ChatPlanUsage>>
}

/** Uma janela de limite do plano: quanto já foi usado (0 a 1) e quando renova (ms). */
export interface ChatUsageWindow {
  used: number
  resetsAt?: number
}

/**
 * O uso do plano da conta do agente, como o Claude Code informa a cada pedido
 * (`rate_limit_event`): a sessão de 5 horas e a semana. É da conta da
 * máquina que roda o agente, não do projeto.
 */
export interface ChatPlanUsage {
  session?: ChatUsageWindow
  week?: ChatUsageWindow
  /** 'allowed', ou o aviso de que está perto ou no limite. */
  status?: string
  /** Quando o agente informou (ms). */
  at: number
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
  /** Volta para uma conversa do histórico (a atual vai para o histórico). */
  open: 'space-chat:open',
  /** Apaga uma conversa do histórico. */
  forget: 'space-chat:forget',
  state: 'space-chat:state',
  cursor: 'space-chat:cursor',
} as const

export interface ChatSendPayload {
  projectId: string
  projectName?: string
  agent: ChatAgentId
  text: string
  context: ChatContext
  images?: ChatImageUpload[]
  skill?: ChatSkillRef
}

/** Sessão da ponte (SPACE_SESSION) de um agente no chat de um projeto. */
export const chatSession = (projectId: string, agent: ChatAgentId, epoch: number) => `chat-${agent}-${projectId.slice(0, 8)}-${epoch.toString(36)}`

export const agentInfoByName = (name: string | undefined): ChatAgentInfo | undefined =>
  Object.values(CHAT_AGENTS).find((a) => a.name === name) ??
  (name && /codex/i.test(name) ? CHAT_AGENTS.codex : name && /claude/i.test(name) ? CHAT_AGENTS.claude : undefined)
