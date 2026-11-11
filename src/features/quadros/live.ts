import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import type { StoredFile } from './data'

/**
 * Quadro ao vivo: canal privado `crm-board:<id>` (políticas na migração 20261107140000). Presença diz
 * quem está no quadro; broadcast leva os elementos que mudaram (a outra tela junta com
 * `reconcileElements`) e o cursor de cada um. A gravação continua sendo da tabela.
 */

/** `clientId` é a aba: a mesma pessoa em duas abas (ou no computador e no celular) aparece nas duas. */
export interface Peer { userId: string; clientId?: string; name: string; color: string; avatarUrl?: string }
export interface PointerMsg { userId: string; clientId?: string; x: number; y: number; tool: 'pointer' | 'laser'; button: 'up' | 'down'; selected?: Record<string, true> }
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
  /** Nome ou foto mudaram: a presença é refeita sem sair do canal. */
  updateMe: (me: Peer) => void
  leave: () => void
}

/** Uma por aba (e por quadro aberto): a chave da presença e de quem mandou cada mensagem. */
const TAB_ID = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`

export function joinBoard(boardId: string, meIn: Peer, h: LiveHandlers): LiveBoard {
  const topic = `crm-board:${boardId}`
  const clientId = TAB_ID
  let me: Peer = { ...meIn, clientId }
  let channel: RealtimeChannel | null = null
  let ready = false
  let left = false

  const send = (event: string, payload: Record<string, unknown>) => {
    if (!channel || !ready) return
    void channel.send({ type: 'broadcast', event, payload: { ...payload, userId: me.userId, clientId } })
  }
  /** Mensagem de outra aba (outra pessoa, ou a mesma pessoa em outro lugar). */
  const fromOther = (p: { userId?: string; clientId?: string }) => !!p.userId && (p.clientId ? p.clientId !== clientId : p.userId !== me.userId)

  const open = () => {
    if (left) return
    const current = supabase.channel(topic, { config: { private: true, presence: { key: clientId }, broadcast: { self: false } } })
    channel = current
    current
      .on('presence', { event: 'sync' }, () => {
        const seen = new Map<string, Peer>()
        for (const [key, entries] of Object.entries(current.presenceState<Peer>())) {
          const e = entries[0]
          if (!e?.userId || key === clientId) continue
          seen.set(key, { userId: e.userId, clientId: e.clientId ?? key, name: e.name, color: e.color, avatarUrl: e.avatarUrl })
        }
        h.onPeers([...seen.values()])
      })
      .on('broadcast', { event: 'qd-elements' }, ({ payload }) => {
        const p = payload as { userId?: string; clientId?: string; elements?: unknown[]; files?: Record<string, StoredFile> }
        if (fromOther(p) && Array.isArray(p.elements)) h.onElements(p.elements, p.files)
      })
      .on('broadcast', { event: 'qd-pointer' }, ({ payload }) => {
        const p = payload as PointerMsg
        if (fromOther(p)) h.onPointer(p)
      })
      .on('broadcast', { event: 'qd-agent' }, ({ payload }) => {
        const p = payload as AgentMsg & { userId?: string; clientId?: string }
        if (fromOther(p) && typeof p.key === 'string') h.onAgent?.({ ...p, key: `${p.clientId ?? p.userId}:${p.key}` })
      })
      .on('broadcast', { event: 'qd-hello' }, ({ payload }) => {
        const p = payload as { userId?: string; clientId?: string }
        // Quem tem a menor chave entre os presentes responde, para não chegarem várias cópias
        if (!fromOther(p)) return
        const asker = p.clientId ?? p.userId
        const present = Object.keys(current.presenceState()).filter((k) => k !== asker).sort()
        if (present[0] === clientId) send('qd-elements', h.snapshot())
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

  // A saída de um canal termina só quando o servidor responde: se a tela anterior deste quadro ainda está saindo,
  // espera ela sair antes de entrar de novo (antes, a aba ficava sem o canal e sem os cursores dos outros).
  const stale = supabase.getChannels().filter((c) => c.topic === `realtime:${topic}`)
  if (stale.length) void Promise.all(stale.map((c) => supabase.removeChannel(c).catch(() => undefined))).then(open)
  else open()

  // Cursor: no máximo ~20 por segundo
  let pending: Omit<PointerMsg, 'userId'> | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => { timer = undefined; if (pending) send('qd-pointer', pending as unknown as Record<string, unknown>); pending = null }

  return {
    sendElements: (elements, files) => { if (elements.length || files) send('qd-elements', { elements, files }) },
    sendPointer: (msg) => { pending = msg; if (!timer) timer = setTimeout(flush, 50) },
    sendAgent: (msg) => send('qd-agent', msg as unknown as Record<string, unknown>),
    updateMe: (next) => {
      me = { ...next, clientId }
      if (channel && ready) void channel.track(me)
    },
    leave: () => {
      left = true
      if (timer) clearTimeout(timer)
      if (channel) void supabase.removeChannel(channel)
      channel = null
    },
  }
}
