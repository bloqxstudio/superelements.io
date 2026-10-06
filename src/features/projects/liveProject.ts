import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

/**
 * Canal ao vivo do projeto aberto (`space-project:<id>`, privado: só quem tem
 * acesso entra). Mostra quem mais está com o projeto aberto e avisa quando
 * alguém salvou, para os outros puxarem a versão nova sem esperar o conflito.
 * Sem o canal (Realtime fora do ar), o projeto funciona igual.
 */

export interface LivePerson {
  userId: string
  email: string
}

interface LiveState {
  projectId?: string
  /** Quem mais está com o projeto aberto agora (sem a própria conta). */
  people: LivePerson[]
  /** A própria conta, para o avatar "você" ao lado dos outros. */
  me?: LivePerson
}

export const useLiveProject = create<LiveState>()(() => ({ people: [] }))

/** O mouse de uma pessoa no canvas, em coordenadas do mundo (as mesmas para todo zoom). */
export interface LiveCursor {
  userId: string
  email: string
  x: number
  y: number
  /** Página debaixo do mouse, para o rótulo dela mostrar quem está ali. */
  pageId?: string
  at: number
}

/** Cursores de quem mais está no projeto; some quando a pessoa sai do canvas ou do projeto. */
export const useLiveCursors = create<{ cursors: Record<string, LiveCursor> }>()(() => ({ cursors: {} }))

const dropCursor = (userId: string) =>
  useLiveCursors.setState((s) => {
    if (!s.cursors[userId]) return s
    const next = { ...s.cursors }
    delete next[userId]
    return { cursors: next }
  })

interface LiveHandlers {
  onSaved: (revision: number, by: LivePerson) => void
  /** O dono tirou alguém do projeto. */
  onRemoved: (userId: string) => void
}

export interface LiveProject {
  /** Avisa os outros que a conta tem uma revisão nova. */
  saved: (revision: number) => void
  /** O canal está no ar; fora dele, quem abriu confere a conta de tempos em tempos. */
  isLive: () => boolean
  leave: () => void
}

let active: { projectId: string; channel: RealtimeChannel } | null = null
// O cliente do Supabase devolve o mesmo canal para o mesmo tópico: entrar de novo espera a saída anterior
let leaving: Promise<unknown> = Promise.resolve()

const topicOf = (projectId: string) => `space-project:${projectId}`

export function joinLiveProject(projectId: string, me: LivePerson, handlers: LiveHandlers): LiveProject {
  let channel: RealtimeChannel | null = null
  let left = false
  let live = false

  const sync = (current: RealtimeChannel) => {
    const seen = new Map<string, LivePerson>()
    for (const entries of Object.values(current.presenceState<LivePerson>())) {
      const person = entries[0]
      if (person?.userId && person.userId !== me.userId) seen.set(person.userId, { userId: person.userId, email: person.email ?? '' })
    }
    if (active?.channel !== current) return
    useLiveProject.setState({ projectId, people: [...seen.values()], me })
    // Quem saiu do projeto leva o cursor junto
    for (const userId of Object.keys(useLiveCursors.getState().cursors)) if (!seen.has(userId)) dropCursor(userId)
  }

  const start = async () => {
    await leaving.catch(() => {})
    if (left) return
    const topic = topicOf(projectId)
    if (supabase.getChannels().some((c) => c.topic === `realtime:${topic}`)) {
      console.warn('[projetos] canal ao vivo ainda aberto por outra sessão; fica sem ele desta vez')
      return
    }
    const current = supabase.channel(topic, {
      config: { private: true, presence: { key: me.userId }, broadcast: { self: false } },
    })
    channel = current
    active = { projectId, channel: current }
    useLiveProject.setState({ projectId, people: [], me })
    useLiveCursors.setState({ cursors: {} })

    current
      .on('presence', { event: 'sync' }, () => sync(current))
      .on('broadcast', { event: 'saved' }, ({ payload }) => {
        const { revision, by } = (payload ?? {}) as { revision?: number; by?: LivePerson }
        if (typeof revision === 'number' && by?.userId) handlers.onSaved(revision, by)
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const cursor = (payload ?? {}) as Partial<LiveCursor> & { hidden?: boolean }
        if (!cursor.userId || cursor.userId === me.userId) return
        if (cursor.hidden || typeof cursor.x !== 'number' || typeof cursor.y !== 'number') return dropCursor(cursor.userId)
        const next: LiveCursor = { userId: cursor.userId, email: cursor.email ?? '', x: cursor.x, y: cursor.y, pageId: cursor.pageId, at: Date.now() }
        useLiveCursors.setState((s) => ({ cursors: { ...s.cursors, [next.userId]: next } }))
      })
      .on('broadcast', { event: 'removed' }, ({ payload }) => {
        const userId = (payload as { userId?: string } | undefined)?.userId
        if (userId) handlers.onRemoved(userId)
      })
      .subscribe((status, error) => {
        live = status === 'SUBSCRIBED'
        if (live) void current.track(me)
        else if (status === 'CHANNEL_ERROR') console.warn('[projetos] canal ao vivo indisponível', error?.message ?? '')
      })
  }
  void start()

  return {
    saved: (revision) => {
      channel
        ?.send({ type: 'broadcast', event: 'saved', payload: { revision, by: me } })
        .catch((error) => console.warn('[projetos] aviso ao vivo não enviado', error))
    },
    isLive: () => live,
    leave: () => {
      if (left) return
      left = true
      live = false
      if (!channel) return
      if (active?.channel === channel) {
        active = null
        useLiveProject.setState({ projectId: undefined, people: [], me: undefined })
        useLiveCursors.setState({ cursors: {} })
      }
      leaving = supabase.removeChannel(channel)
    },
  }
}

/**
 * Manda o meu mouse para quem mais está no projeto; `null` esconde (saiu do
 * canvas). Sem ninguém mais no projeto, nada sai daqui.
 */
export function sendCursor(point: { x: number; y: number; pageId?: string } | null) {
  const me = useLiveProject.getState().me
  if (!active || !me || !useLiveProject.getState().people.length) return
  const payload = point ? { userId: me.userId, email: me.email, x: Math.round(point.x), y: Math.round(point.y), pageId: point.pageId } : { userId: me.userId, hidden: true }
  active.channel.send({ type: 'broadcast', event: 'cursor', payload }).catch(() => {})
}

/** Avisa quem foi tirado do projeto, se estiver com ele aberto agora. */
export function announceRemoved(projectId: string, userId: string) {
  if (active?.projectId !== projectId) return
  active.channel.send({ type: 'broadcast', event: 'removed', payload: { userId } }).catch(() => {})
}
