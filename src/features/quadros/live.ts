import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import type { StoredFile } from './data'

/**
 * Quadro ao vivo: canal privado `crm-board:<id>` (políticas na migração 20261107140000). Presença diz
 * quem está no quadro; broadcast leva os elementos que mudaram (a outra tela junta com
 * `reconcileElements`) e o cursor de cada um. A gravação continua sendo da tabela.
 */

export interface Peer { userId: string; name: string; color: string; avatarUrl?: string }
export interface PointerMsg { userId: string; x: number; y: number; tool: 'pointer' | 'laser'; button: 'up' | 'down'; selected?: Record<string, true> }
/** O cursor de um agente (Claude Code, Codex) mexendo no quadro pela Iara de alguém; `gone` tira. */
export interface AgentMsg { key: string; name: string; color: string; x?: number; y?: number; gone?: boolean; selected?: string[] }

const COLORS = ['#7c3aed', '#0ea5e9', '#f97316', '#10b981', '#e11d48', '#eab308', '#6366f1', '#14b8a6']
export const colorOf = (id: string) => COLORS[[...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length]

export interface LiveHandlers {
  onPeers: (peers: Peer[]) => void
  onElements: (elements: unknown[], files?: Record<string, StoredFile>) => void
  onPointer: (msg: PointerMsg) => void
  onAgent?: (msg: AgentMsg) => void
  /** Alguém entrou e pediu a cena: devolva os elementos atuais. */
  snapshot: () => { elements: unknown[]; files: Record<string, StoredFile> }
  onStatus?: (live: boolean) => void
}

export interface LiveBoard {
  /** Os elementos que mudaram e, quando uma imagem acabou de subir, onde ela ficou. */
  sendElements: (elements: unknown[], files?: Record<string, StoredFile>) => void
  sendPointer: (msg: Omit<PointerMsg, 'userId'>) => void
  sendAgent: (msg: AgentMsg) => void
  leave: () => void
}

export function joinBoard(boardId: string, me: Peer, h: LiveHandlers): LiveBoard {
  const topic = `crm-board:${boardId}`
  let channel: RealtimeChannel | null = null
  let ready = false
  let left = false

  const send = (event: string, payload: Record<string, unknown>) => {
    if (!channel || !ready) return
    void channel.send({ type: 'broadcast', event, payload: { ...payload, userId: me.userId } })
  }

  if (supabase.getChannels().some((c) => c.topic === `realtime:${topic}`)) {
    console.warn('[quadros] canal ao vivo já aberto nesta aba; segue sem ele')
  } else {
    const current = supabase.channel(topic, { config: { private: true, presence: { key: me.userId }, broadcast: { self: false } } })
    channel = current
    current
      .on('presence', { event: 'sync' }, () => {
        const seen = new Map<string, Peer>()
        for (const entries of Object.values(current.presenceState<Peer>())) {
          const e = entries[0]
          if (e?.userId && e.userId !== me.userId) seen.set(e.userId, { userId: e.userId, name: e.name, color: e.color, avatarUrl: e.avatarUrl })
        }
        h.onPeers([...seen.values()])
      })
      .on('broadcast', { event: 'qd-elements' }, ({ payload }) => {
        const p = payload as { userId?: string; elements?: unknown[]; files?: Record<string, StoredFile> }
        if (p.userId !== me.userId && Array.isArray(p.elements)) h.onElements(p.elements, p.files)
      })
      .on('broadcast', { event: 'qd-pointer' }, ({ payload }) => {
        const p = payload as PointerMsg
        if (p.userId && p.userId !== me.userId) h.onPointer(p)
      })
      .on('broadcast', { event: 'qd-agent' }, ({ payload }) => {
        const p = payload as AgentMsg & { userId?: string }
        if (p.userId !== me.userId && typeof p.key === 'string') h.onAgent?.({ ...p, key: `${p.userId}:${p.key}` })
      })
      .on('broadcast', { event: 'qd-hello' }, ({ payload }) => {
        const p = payload as { userId?: string }
        // Quem tem o id menor entre os presentes responde, para não chegarem várias cópias
        if (!p.userId || p.userId === me.userId) return
        const present = Object.values(current.presenceState<Peer>()).map((e) => e[0]?.userId).filter((id): id is string => !!id && id !== p.userId).sort()
        if (present[0] === me.userId) send('qd-elements', h.snapshot())
      })
      .subscribe((status) => {
        ready = status === 'SUBSCRIBED'
        h.onStatus?.(ready)
        if (ready && !left) {
          void current.track(me)
          send('qd-hello', {})
        }
      })
  }

  // Cursor: no máximo ~20 por segundo
  let pending: Omit<PointerMsg, 'userId'> | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => { timer = undefined; if (pending) send('qd-pointer', pending as unknown as Record<string, unknown>); pending = null }

  return {
    sendElements: (elements, files) => { if (elements.length || files) send('qd-elements', { elements, files }) },
    sendPointer: (msg) => { pending = msg; if (!timer) timer = setTimeout(flush, 50) },
    sendAgent: (msg) => send('qd-agent', msg as unknown as Record<string, unknown>),
    leave: () => {
      left = true
      if (timer) clearTimeout(timer)
      if (channel) void supabase.removeChannel(channel)
      channel = null
    },
  }
}
