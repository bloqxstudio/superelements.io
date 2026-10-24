import { create } from 'zustand'
import { CHAT_AGENTS, type ChatAgentId } from '@/features/space/chat/protocol'
import type { CopyAgentId } from './agents'

/**
 * O agente à vista: enquanto trabalha, o documento marca o bloco em que ele
 * está (com o nome e o passo) e o painel mostra o andamento. A cor é a do motor
 * (Claude Code ou Codex), a mesma do chat do Space.
 */

export const engineInfo = (id: ChatAgentId) => ({ name: CHAT_AGENTS[id].name, color: id === 'codex' ? '#10A37F' : CHAT_AGENTS[id].color })

export type CopyPhase = 'sending' | 'start' | 'thinking' | 'reading' | 'writing' | 'applying'

export const PHASE_LABEL: Record<CopyPhase, string> = {
  sending: 'Lendo o pedido',
  start: 'Lendo o documento',
  thinking: 'Pensando',
  reading: 'Pesquisando na web',
  writing: 'Escrevendo',
  applying: 'Aplicando no texto',
}

interface State {
  working?: { docId?: string; engine: ChatAgentId; role: CopyAgentId; phase: CopyPhase; since: number; label: string }
  /** O bloco em que o agente está agora. */
  cursor?: { docId?: string; blockId?: string; engine: ChatAgentId; role: CopyAgentId; agent: string; text?: string }
  /** Blocos que o agente mudou, por alguns segundos. */
  flash: string[]
  begin: (engine: ChatAgentId, role: CopyAgentId, docId?: string) => void
  phase: (phase: CopyPhase) => void
  point: (cursor: { blockId?: string; text?: string } | undefined) => void
  end: () => void
  highlight: (ids: string[]) => void
}

let flashTimer: ReturnType<typeof setTimeout> | undefined
let endTimer: ReturnType<typeof setTimeout> | undefined

export const useCopyAgent = create<State>()((set, get) => ({
  flash: [],
  begin: (engine, role, docId) => {
    clearTimeout(endTimer)
    set({ working: { docId, engine, role, phase: 'sending', since: Date.now(), label: PHASE_LABEL.sending }, cursor: { docId, engine, role, agent: `${engineInfo(engine).name} · ${role}` } })
  },
  phase: (phase) => {
    const w = get().working
    if (w) set({ working: { ...w, phase, label: PHASE_LABEL[phase] } })
  },
  point: (c) => {
    const w = get().working
    const cur = get().cursor
    if (!cur) return
    set({ cursor: c ? { ...cur, blockId: c.blockId, text: c.text } : { ...cur, blockId: undefined, text: undefined } })
    void w
  },
  end: () => {
    set({ working: undefined })
    clearTimeout(endTimer)
    endTimer = setTimeout(() => set({ cursor: undefined }), 1800)
  },
  highlight: (ids) => {
    clearTimeout(flashTimer)
    set({ flash: ids })
    flashTimer = setTimeout(() => set({ flash: [] }), 3200)
  },
}))
