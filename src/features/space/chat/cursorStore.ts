import { create } from 'zustand'
import { agentInfoByName, type CursorMode } from './protocol'

/**
 * O cursor de cada agente no canvas, como o de uma pessoa num editor
 * multiplayer: vai até a seção (ou a camada) em que ele está, lê, edita e
 * "clica" quando grava. Uma sessão de agente, um cursor. A posição vem das
 * ações dele: os pedidos que chegam pela ponte (`work`, `apply`, `pull`…, em
 * `bridge/client.ts`) e os passos que o servidor do chat vê ele dar.
 */

export interface CursorTarget {
  sectionId?: string
  pageId?: string
  /** Camada dentro da seção: o cursor aponta para ela quando ela está selecionada no canvas. */
  elementId?: string
}

export interface AgentCursor {
  key: string
  agent: string
  color: string
  ink: string
  target: CursorTarget
  mode: CursorMode
  text?: string
  updatedAt: number
  /** Sobe quando o agente grava: o cursor "clica". */
  clickAt?: number
  /** De onde ele entra na primeira vez (px dentro do Space), por exemplo a caixa do chat. */
  origin?: { x: number; y: number }
}

export interface CursorUpdate {
  agent: string
  target?: CursorTarget
  mode: CursorMode
  text?: string
  click?: boolean
  origin?: { x: number; y: number }
}

/** Pronto: o cursor fica um pouco no lugar e some. */
const DONE_FOR = 3200
const FADE_FOR = 700
/** Sem notícia do agente por esse tempo, o cursor sai. */
const STALE_FOR = 5 * 60_000

const OTHER = { color: '#7C3AED', ink: '#FFFFFF' }

interface CursorState {
  cursors: Record<string, AgentCursor>
  point: (key: string, update: CursorUpdate) => void
  remove: (key: string) => void
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useAgentCursors = create<CursorState>()((set, get) => ({
  cursors: {},
  point: (key, update) => {
    const before = get().cursors[key]
    const info = agentInfoByName(update.agent)
    const now = Date.now()
    const cursor: AgentCursor = {
      key,
      agent: update.agent,
      color: info?.color ?? OTHER.color,
      ink: info?.ink ?? OTHER.ink,
      // Sem alvo novo, continua onde estava
      target: update.target && (update.target.sectionId || update.target.pageId) ? update.target : before?.target ?? {},
      mode: update.mode,
      text: update.text ?? (update.mode === before?.mode ? before?.text : undefined),
      updatedAt: now,
      clickAt: update.click ? now : before?.clickAt,
      origin: before ? before.origin : update.origin,
    }
    set((s) => ({ cursors: { ...s.cursors, [key]: cursor } }))

    clearTimeout(timers.get(key))
    const later = (ms: number, fn: () => void) => timers.set(key, setTimeout(fn, ms))
    if (update.mode === 'done') {
      later(DONE_FOR, () => {
        const current = get().cursors[key]
        if (current?.updatedAt === now) get().point(key, { agent: current.agent, mode: 'gone' })
      })
    } else if (update.mode === 'gone') {
      later(FADE_FOR, () => get().cursors[key]?.updatedAt === now && get().remove(key))
    } else {
      later(STALE_FOR, () => get().cursors[key]?.updatedAt === now && get().point(key, { agent: update.agent, mode: 'gone' }))
    }
  },
  remove: (key) => {
    clearTimeout(timers.get(key))
    timers.delete(key)
    set((s) => {
      const next = { ...s.cursors }
      delete next[key]
      return { cursors: next }
    })
  },
}))
