import { create } from 'zustand'
import type { CreativeStep } from './protocol'

/**
 * O agente à vista: enquanto a IA trabalha, o canvas marca o alvo do pedido e
 * o chat mostra o passo em que ela está; ao terminar, o canvas destaca o que
 * mudou por um instante. Mesma cor do Claude Code no chat do Space.
 */

export const AGENT = { name: 'Claude Code', color: '#D97757' }

export type AgentPhase = 'sending' | CreativeStep | 'applying'

export const PHASE_LABEL: Record<AgentPhase, string> = {
  sending: 'Lendo o pedido',
  start: 'Olhando o conjunto',
  thinking: 'Pensando',
  writing: 'Escrevendo as mudanças',
  applying: 'Aplicando',
}

interface Target {
  scope: 'layer' | 'slide' | 'post' | 'set'
  postId?: string
  slideId?: string
  layerId?: string
}

interface AgentState {
  working?: { target: Target; phase: AgentPhase; since: number; label: string }
  /** Slides que a última resposta mudou, por alguns segundos. */
  flash: string[]
  begin: (target: Target, label: string) => void
  phase: (phase: AgentPhase) => void
  end: () => void
  highlight: (slideIds: string[]) => void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useAgent = create<AgentState>()((set, get) => ({
  flash: [],
  begin: (target, label) => set({ working: { target, phase: 'sending', since: Date.now(), label } }),
  phase: (phase) => {
    const w = get().working
    if (w) set({ working: { ...w, phase } })
  },
  end: () => set({ working: undefined }),
  highlight: (slideIds) => {
    clearTimeout(timer)
    set({ flash: slideIds })
    timer = setTimeout(() => set({ flash: [] }), 3200)
  },
}))
