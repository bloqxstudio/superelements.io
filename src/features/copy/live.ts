import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { displayName, personColor } from '@/features/space/presence/presence'
import { useCopyAgent } from './agentStore'
import { diffDocs, type CopyPatch } from './patch'
import { useCopy } from './store'
import type { CopyDoc } from './types'

/**
 * O documento ao vivo, como no Google Docs: quem mais está nele (avatar), em que
 * bloco cada pessoa está escrevendo, o agente que cada uma está usando e cada
 * mudança chegando enquanto acontece. Vai pelo canal ao vivo do projeto
 * (`space-project:<id>`, privado: só a equipe do projeto entra). Só documentos
 * guardados na pasta do projeto (`shared`) usam isto.
 */

export interface Peer {
  userId: string
  email: string
  name: string
  color: string
}

export interface PeerFocus {
  userId: string
  blockId?: string
  at: number
}

export interface PeerAgent {
  key: string
  userId: string
  owner: string
  agent: string
  blockId?: string
  text?: string
  at: number
}

interface LiveState {
  live: boolean
  people: Peer[]
  focus: Record<string, PeerFocus>
  agents: Record<string, PeerAgent>
}

export const useCopyLive = create<LiveState>()(() => ({ live: false, people: [], focus: {}, agents: {} }))

let active: { docId: string; channel: RealtimeChannel; userId: string; email: string } | null = null
let leaving: Promise<unknown> = Promise.resolve()
let applying = false
const AGENT_TTL = 9000

const peerOf = (userId: string, email: string): Peer => ({ userId, email, name: displayName(email), color: personColor(userId) })

const send = (event: string, payload: Record<string, unknown>) => {
  if (!active) return
  active.channel.send({ type: 'broadcast', event, payload: { ...payload, docId: active.docId, userId: active.userId, email: active.email } }).catch(() => {})
}

/** Quem sou eu aqui (para assinar comentários e o trabalho do meu agente). */
export const me = () => (active ? peerOf(active.userId, active.email) : undefined)

export function joinDocLive(doc: CopyDoc): () => void {
  if (!doc.shared || !doc.projectId) return () => undefined
  let left = false
  let channel: RealtimeChannel | null = null
  const stops: Array<() => void> = []
  const docId = doc.id
  const topic = `space-project:${doc.projectId}`
  let sweep: ReturnType<typeof setInterval> | undefined

  const start = async () => {
    await leaving.catch(() => {})
    if (left) return
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user || left) return
    if (supabase.getChannels().some((c) => c.topic === `realtime:${topic}`)) {
      console.warn('[copy] canal ao vivo ainda aberto por outra sessão; fica sem ele desta vez')
      return
    }
    const mine = { userId: user.id, email: user.email ?? '' }
    const current = supabase.channel(topic, { config: { private: true, presence: { key: `${mine.userId}:${docId}` }, broadcast: { self: false } } })
    channel = current
    active = { docId, channel: current, ...mine }
    useCopyLive.setState({ live: false, people: [], focus: {}, agents: {} })

    const other = (payload: unknown) => {
      const p = (payload ?? {}) as { docId?: string; userId?: string; email?: string }
      return p.docId === docId && p.userId && p.userId !== mine.userId ? p : undefined
    }

    current
      .on('presence', { event: 'sync' }, () => {
        const seen = new Map<string, Peer>()
        for (const entries of Object.values(current.presenceState<{ userId?: string; email?: string; docId?: string }>())) {
          const e = entries[0]
          if (e?.userId && e.userId !== mine.userId && e.docId === docId) seen.set(e.userId, peerOf(e.userId, e.email ?? ''))
        }
        useCopyLive.setState((s) => ({
          people: [...seen.values()],
          focus: Object.fromEntries(Object.entries(s.focus).filter(([id]) => seen.has(id))),
          agents: Object.fromEntries(Object.entries(s.agents).filter(([, a]) => seen.has(a.userId))),
        }))
      })
      .on('broadcast', { event: 'cp-focus' }, ({ payload }) => {
        const p = other(payload) as ({ userId: string; blockId?: string } & Record<string, unknown>) | undefined
        if (!p) return
        useCopyLive.setState((s) => ({ focus: { ...s.focus, [p.userId]: { userId: p.userId, blockId: p.blockId, at: Date.now() } } }))
      })
      .on('broadcast', { event: 'cp-agent' }, ({ payload }) => {
        const p = other(payload) as ({ userId: string; email?: string; agent?: string; blockId?: string; text?: string; gone?: boolean } & Record<string, unknown>) | undefined
        if (!p?.agent) return
        const key = `${p.userId}:${p.agent}`
        useCopyLive.setState((s) => {
          const agents = { ...s.agents }
          if (p.gone) delete agents[key]
          else agents[key] = { key, userId: p.userId, owner: displayName(p.email ?? ''), agent: p.agent!, blockId: p.blockId, text: p.text, at: Date.now() }
          return { agents }
        })
      })
      .on('broadcast', { event: 'cp-sync' }, ({ payload }) => {
        const p = other(payload) as ({ patch?: CopyPatch } & Record<string, unknown>) | undefined
        if (!p?.patch) return
        applying = true
        try {
          useCopy.getState().applyRemote(p.patch)
        } finally {
          applying = false
        }
        last = useCopy.getState().doc ?? last
      })
      .subscribe((status) => {
        const live = status === 'SUBSCRIBED'
        useCopyLive.setState({ live })
        if (live) void current.track({ ...mine, docId })
      })

    // Mudanças locais viram recados curtos (uns 8 por segundo)
    let last: CopyDoc = useCopy.getState().doc ?? doc
    let timer: ReturnType<typeof setTimeout> | undefined
    let queued: CopyDoc | undefined
    const flush = () => {
      timer = undefined
      if (!queued) return
      const patch = diffDocs(last, queued)
      last = queued
      queued = undefined
      if (patch && useCopyLive.getState().people.length) send('cp-sync', { patch })
    }
    stops.push(
      useCopy.subscribe((s) => {
        if (!s.doc || s.doc.id !== docId || applying) return
        if (s.doc === last && !queued) return
        queued = s.doc
        if (!timer) timer = setTimeout(flush, 120)
      })
    )
    // Em que bloco estou escrevendo
    stops.push(
      useCopy.subscribe((s, prev) => {
        if (s.focusId !== prev.focusId) send('cp-focus', { blockId: s.focusId })
      })
    )
    // Quem entra depois recebe o documento de quem já estava
    stops.push(
      useCopyLive.subscribe((s, prev) => {
        if (s.people.length > prev.people.length) {
          const d = useCopy.getState().doc
          if (d && d.id === docId) send('cp-sync', { patch: { blocks: d.blocks, order: d.blocks.map((b) => b.id), comments: d.comments, title: d.title, brief: d.brief, niche: d.niche, sources: d.sources ?? [] } satisfies CopyPatch })
        }
      })
    )
    // O meu agente, para os outros verem
    stops.push(
      useCopyAgent.subscribe((s, prev) => {
        if ((s.cursor === prev.cursor && s.working === prev.working) || !useCopyLive.getState().people.length) return
        if (s.cursor) send('cp-agent', { agent: s.cursor.agent, blockId: s.cursor.blockId, text: s.working?.label ?? s.cursor.text })
        else if (prev.cursor) send('cp-agent', { agent: prev.cursor.agent, gone: true })
      })
    )
    sweep = setInterval(() => {
      const now = Date.now()
      useCopyLive.setState((s) => {
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
    for (const stop of stops) stop()
    if (channel) {
      if (active?.channel === channel) {
        send('cp-focus', {})
        active = null
      }
      leaving = supabase.removeChannel(channel)
    }
    useCopyLive.setState({ live: false, people: [], focus: {}, agents: {} })
  }
}
