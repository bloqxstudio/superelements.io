/**
 * Eventos da IA dos criativos entre a aba e quem roda o Claude Code (servidor
 * de dev ou conector). Só tipos e constantes, sem imports: o Node lê este arquivo.
 */

export const CREATIVE_EVENTS = {
  hello: 'criativos:oi',
  status: 'criativos:estado',
  call: 'criativos:chamar',
  result: 'criativos:resposta',
  stop: 'criativos:parar',
  progress: 'criativos:progresso',
  key: 'criativos:chave',
} as const

export interface CreativeCall {
  id: string
  kind: 'edit' | 'plan' | 'image' | 'download' | 'capture'
  request: unknown
}

export type CreativeResult = { id: string; ok: true; data: unknown } | { id: string; ok: false; error: string }

/** O que o Claude Code está fazendo, em passos que a tela mostra enquanto espera. */
export type CreativeStep = 'start' | 'thinking' | 'reading' | 'writing'

export interface CreativeProgress {
  id: string
  step: CreativeStep
}

/** Quais agentes a máquina tem (o que o conector ou o servidor de dev achou). */
export type CreativeAgentId = 'claude' | 'codex'

export interface CreativeAgentInfo {
  id: CreativeAgentId
  name: string
  available: boolean
  version?: string
}

/** Serviço de geração de imagens com chave neste computador. */
export type CreativeImageProvider = 'codex' | 'openai' | 'gemini'

export interface CreativeImageRequest {
  prompt: string
  /** Qual serviço usar (o escolhido na tela); sem ele, o primeiro pronto. */
  provider?: CreativeImageProvider
  ratio: 'square' | 'portrait' | 'landscape'
}
