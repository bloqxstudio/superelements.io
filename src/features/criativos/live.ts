import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { displayName, personColor } from '@/features/space/presence/presence'
import { PHASE_LABEL, useAgent } from './agentStore'
import { useEditor } from './store'
import { diffSets, type SyncPatch } from './syncPatch'
import type { CreativeSet } from './types'
import type { ChatAgentId } from '@/features/space/chat/protocol'

/**
 * O conjunto ao vivo, como no Canva: quem mais está nele (avatar), o mouse e a
 * seleção de cada pessoa, o cursor dos agentes que elas estão usando e cada
 * mudança chegando enquanto acontece. Vai pelo canal ao vivo do projeto
 * (`space-project:<id>`, privado: só a equipe do projeto entra), o mesmo do
 * Space; só conjuntos guardados na pasta do projeto (`shared`) usam isto.
 * Sem o canal, o conjunto funciona igual, só que sozinho.
 */

export interface Peer {
  userId: string
  email: string
  name: string
  color: string
}

export interface PeerCursor {
  userId: string
  x: number
  y: number
  /** O que a pessoa tem selecionado. */
  slideId?: string
  layerId?: string
  at: number
}

export interface PeerAgent {
  key: string
  userId: string
  /** Quem está usando o agente. */
  owner: string
  agent: ChatAgentId
  slideId?: string
  layerId?: string
  text?: string
  at: number
}

interface LiveState {
  live: boolean
  people: Peer[]
  cursors: Record<string, PeerCursor>
  agents: Record<string, PeerAgent>
}

export const useLive = create<LiveState>()(() => ({ live: false, people: [], cursors: {}, agents: {} }))

let active: { setId: string; channel: RealtimeChannel; userId: string; email: string } | null = null
let leaving: Promise<unknown> = Promise.resolve()
/** Marca a mudança que veio de fora: ela não volta para o canal. */
let applying = false
const AGENT_TTL = 9000

const peerOf = (userId: string, email: string): Peer => ({ userId, email, name: displayName(email), color: personColor(userId) })

const send = (event: string, payload: Record<string, unknown>) => {
  if (!active) return
  active.channel.send({ type: 'broadcast', event, payload: { ...payload, setId: active.setId, userId: active.userId, email: active.email } }).catch(() => {})
}

/** O meu mouse e a minha seleção, para os outros; `null` esconde. Só vai se há mais alguém no conjunto. */
let pointerAt = 0
export function sendPointer(point: { x: number; y: number } | null) {
  if (!active || !useLive.getState().people.length) return
  const now = Date.now()
  if (point && now - pointerAt < 50) return
  pointerAt = now
  const { slideId, layerId } = useEditor.getState()
  send('cr-cursor', point ? { x: Math.round(point.x), y: Math.round(point.y), slideId, layerId } : { hidden: true })
}

export function joinSetLive(set: CreativeSet): () => void {
  if (!set.shared || !set.projectId) return () => undefined
  let left = false
  let channel: RealtimeChannel | null = null
  const unsubscribers: Array<() => void> = []
  const setId = set.id
  const topic = `space-project:${set.projectId}`
  let sweep: ReturnType<typeof setInterval> | undefined

  const start = async () => {
    await leaving.catch(() => {})
    if (left) return
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user || left) return
    if (supabase.getChannels().some((c) => c.topic === `realtime:${topic}`)) {
      console.warn('[criativos] canal ao vivo ainda aberto por outra sessão; fica sem ele desta vez')
      return
    }
    const me = { userId: user.id, email: user.email ?? '' }
    const current = supabase.channel(topic, { config: { private: true, presence: { key: `${me.userId}:${setId}` }, broadcast: { self: false } } })
    channel = current
    active = { setId, channel: current, ...me }
    useLive.setState({ live: false, people: [], cursors: {}, agents: {} })

    const fromOther = (payload: unknown) => {
      const p = (payload ?? {}) as { setId?: string; userId?: string; email?: string }
      return p.setId === setId && p.userId && p.userId !== me.userId ? (p as Required<Pick<typeof p, 'userId'>> & typeof p) : undefined
    }

    current
      .on('presence', { event: 'sync' }, () => {
        const seen = new Map<string, Peer>()
        for (const entries of Object.values(current.presenceState<{ userId?: string; email?: string; setId?: string }>())) {
          const e = entries[0]
          if (e?.userId && e.userId !== me.userId && e.setId === setId) seen.set(e.userId, peerOf(e.userId, e.email ?? ''))
        }
        useLive.setState((s) => {
          const cursors = { ...s.cursors }
          for (const id of Object.keys(cursors)) if (!seen.has(id)) delete cursors[id]
          const agents = Object.fromEntries(Object.entries(s.agents).filter(([, a]) => seen.has(a.userId)))
          return { people: [...seen.values()], cursors, agents }
        })
      })
      .on('broadcast', { event: 'cr-cursor' }, ({ payload }) => {
        const p = fromOther(payload) as (typeof payload & { x?: number; y?: number; hidden?: boolean; slideId?: string; layerId?: string }) | undefined
        if (!p) return
        if (p.hidden || typeof p.x !== 'number' || typeof p.y !== 'number') {
          useLive.setState((s) => {
            const cursors = { ...s.cursors }
            delete cursors[p.userId]
            return { cursors }
          })
          return
        }
        useLive.setState((s) => ({ cursors: { ...s.cursors, [p.userId]: { userId: p.userId, x: p.x!, y: p.y!, slideId: p.slideId, layerId: p.layerId, at: Date.now() } } }))
      })
      .on('broadcast', { event: 'cr-agent' }, ({ payload }) => {
        const p = fromOther(payload) as (typeof payload & { agent?: ChatAgentId; slideId?: string; layerId?: string; text?: string; gone?: boolean }) | undefined
        if (!p || (p.agent !== 'claude' && p.agent !== 'codex')) return
        const key = `${p.userId}:${p.agent}`
        useLive.setState((s) => {
          const agents = { ...s.agents }
          if (p.gone) delete agents[key]
          else agents[key] = { key, userId: p.userId, owner: displayName(p.email ?? ''), agent: p.agent!, slideId: p.slideId, layerId: p.layerId, text: p.text, at: Date.now() }
          return { agents }
        })
      })
      .on('broadcast', { event: 'cr-sync' }, ({ payload }) => {
        const p = fromOther(payload) as (typeof payload & { patch?: SyncPatch }) | undefined
        if (!p?.patch) return
        applying = true
        try {
          useEditor.getState().applyRemote(p.patch)
        } finally {
          applying = false
        }
        last = useEditor.getState().set ?? last
      })
      .subscribe((status) => {
        const live = status === 'SUBSCRIBED'
        useLive.setState({ live })
        if (live) void current.track({ ...me, setId })
      })

    // Mudanças locais viram recados curtos, no máximo uns 12 por segundo
    let last: CreativeSet = useEditor.getState().set ?? set
    let timer: ReturnType<typeof setTimeout> | undefined
    let queued: CreativeSet | undefined
    const flush = () => {
      timer = undefined
      if (!queued) return
      const patch = diffSets(last, queued)
      last = queued
      queued = undefined
      if (patch && useLive.getState().people.length) send('cr-sync', { patch })
    }
    unsubscribers.push(
      useEditor.subscribe((s) => {
        if (!s.set || s.set.id !== setId || applying) return
        if (s.set === last && !queued) return
        queued = s.set
        if (!timer) timer = setTimeout(flush, 80)
      })
    )
    // Quem entrou depois recebe o estado atual de quem já estava (antes de salvar)
    unsubscribers.push(
      useLive.subscribe((s, prev) => {
        if (s.people.length > prev.people.length) {
          const state = useEditor.getState().set
          if (state && state.id === setId) send('cr-sync', { patch: { posts: state.posts.map((p) => ({ id: p.id, name: p.name, format: p.format, caption: p.caption, slideIds: p.slides.map((x) => x.id) })), slides: state.posts.flatMap((p) => p.slides.map((slide) => ({ postId: p.id, slide }))), assets: state.assets, name: state.name } satisfies SyncPatch })
        }
      })
    )
    // O cursor do meu agente, para os outros verem
    unsubscribers.push(
      useAgent.subscribe((s, prev) => {
        if ((s.cursor === prev.cursor && s.working === prev.working) || !useLive.getState().people.length) return
        if (s.cursor) send('cr-agent', { agent: s.cursor.agent, slideId: s.cursor.slideId, layerId: s.cursor.layerId, text: s.working ? PHASE_LABEL[s.working.phase] : s.cursor.text })
        else if (prev.cursor) send('cr-agent', { agent: prev.cursor.agent, gone: true })
      })
    )
    // A seleção também avisa, mesmo sem mover o mouse
    unsubscribers.push(
      useEditor.subscribe((s, prev) => {
        if (s.slideId !== prev.slideId || s.layerId !== prev.layerId) {
          send('cr-cursor', { x: lastX, y: lastY, slideId: s.slideId, layerId: s.layerId })
        }
      })
    )
    // Agente de alguém que parou de avisar some sozinho
    sweep = setInterval(() => {
      const now = Date.now()
      useLive.setState((s) => {
        const stale = Object.keys(s.agents).filter((k) => now - s.agents[k].at > AGENT_TTL)
        if (!stale.length) return s
        const agents = { ...s.agents }
        for (const k of stale) delete agents[k]
        return { agents }
      })
    }, 2000)
  }
  void start()

  return () => {
    if (left) return
    left = true
    clearInterval(sweep)
    for (const stop of unsubscribers) stop()
    if (channel) {
      if (active?.channel === channel) {
        send('cr-cursor', { hidden: true })
        active = null
      }
      leaving = supabase.removeChannel(channel)
    }
    useLive.setState({ live: false, people: [], cursors: {}, agents: {} })
  }
}

let lastX = 0
let lastY = 0
/** O último ponto do mouse, para a seleção poder avisar sem mexer. */
export const rememberPointer = (x: number, y: number) => {
  lastX = Math.round(x)
  lastY = Math.round(y)
}
