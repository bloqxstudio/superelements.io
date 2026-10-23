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
} as const

export interface CreativeCall {
  id: string
  kind: 'edit' | 'plan'
  request: unknown
}

export type CreativeResult = { id: string; ok: true; data: unknown } | { id: string; ok: false; error: string }

/** O que o Claude Code está fazendo, em passos que a tela mostra enquanto espera. */
export type CreativeStep = 'start' | 'thinking' | 'writing'

export interface CreativeProgress {
  id: string
  step: CreativeStep
}
