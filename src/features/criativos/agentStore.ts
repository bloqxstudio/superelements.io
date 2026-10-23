import { create } from 'zustand'
import type { CreativeStep } from './protocol'

/**
 * O agente à vista: enquanto a IA trabalha, o canvas marca o alvo do pedido e
 * o chat mostra o passo em que ela está; ao terminar, o canvas destaca o que
 * mudou por um instante. Mesma cor do Claude Code no chat do Space.
 */

import { CHAT_AGENTS, type ChatAgentId } from '@/features/space/chat/protocol'

/** Cores e nomes dos agentes: os mesmos do chat do Space. */
export const agentInfo = (id: ChatAgentId) => ({ name: CHAT_AGENTS[id].name, color: id === 'codex' ? '#10A37F' : CHAT_AGENTS[id].color })

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
  working?: { target: Target; phase: AgentPhase; since: number; label: string; agent: ChatAgentId }
  /** Onde o cursor do agente está: um slide e, se for o caso, uma camada (o canvas calcula a posição). */
  cursor?: { slideId: string; layerId?: string; agent: ChatAgentId; text?: string }
  /** Slides que a última resposta mudou, por alguns segundos. */
  flash: string[]
  begin: (target: Target, label: string, agent: ChatAgentId) => void
  point: (cursor: AgentState['cursor']) => void
  phase: (phase: AgentPhase) => void
  end: () => void
  highlight: (slideIds: string[]) => void
}

let timer: ReturnType<typeof setTimeout> | undefined
let cursorTimer: ReturnType<typeof setTimeout> | undefined

export const useAgent = create<AgentState>()((set, get) => ({
  flash: [],
  begin: (target, label, agent) => set({ working: { target, phase: 'sending', since: Date.now(), label, agent }, cursor: target.slideId ? { slideId: target.slideId, layerId: target.layerId, agent } : undefined }),
  point: (cursor) => set({ cursor }),
  phase: (phase) => {
    const w = get().working
    if (w) set({ working: { ...w, phase } })
  },
  end: () => {
    set({ working: undefined })
    // O cursor fica um instante onde terminou e some
    clearTimeout(cursorTimer)
    cursorTimer = setTimeout(() => set({ cursor: undefined }), 1800)
  },
  highlight: (slideIds) => {
    clearTimeout(timer)
    set({ flash: slideIds })
    timer = setTimeout(() => set({ flash: [] }), 3200)
  },
}))
