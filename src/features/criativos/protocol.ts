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
} as const

export interface CreativeCall {
  id: string
  kind: 'edit' | 'plan'
  request: unknown
}

export type CreativeResult = { id: string; ok: true; data: unknown } | { id: string; ok: false; error: string }
