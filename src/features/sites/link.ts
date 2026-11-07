import { create } from 'zustand'
import type { AgentChannel } from '@/features/space/connector/channel'
import { SITE_EVENTS, type SiteCall, type SiteCallKind, type SiteResult, type SitesState } from './protocol'

/**
 * Lado da aba dos sites em código: o mesmo canal do chat (websocket do Vite no dev,
 * conector no app publicado). O servidor manda a lista e as prévias sozinho
 * (`sites:estado`) e o terminal de cada prévia (`sites:log`).
 */

interface SitesLink {
  channel?: AgentChannel
  connected: boolean
  /** O canal respondeu ao "oi" (servidor de dev ou conector que conhece os sites). */
  ready: boolean
  /** O conector não respondeu: versão antiga, sem os sites em código. */
  stale: boolean
  state: SitesState | null
  logs: Record<string, string[]>
}

export const useSitesLink = create<SitesLink>()(() => ({ connected: false, ready: false, stale: false, state: null, logs: {} }))

const pending = new Map<string, { resolve: (data: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>()
const MAX_LOG = 400
const TIMEOUT = 12 * 60_000

export function startSitesLink(channel: AgentChannel) {
  let helloTimer: ReturnType<typeof setTimeout> | undefined
  const onState = (state: SitesState) => {
    clearTimeout(helloTimer)
    useSitesLink.setState({ state, ready: true, stale: false })
  }
  const onResult = (result: SiteResult) => {
    const call = pending.get(result?.id)
    if (!call) return
    pending.delete(result.id)
    clearTimeout(call.timer)
    if (result.ok === true) call.resolve(result.data)
    else call.reject(new Error((result as { error: string }).error))
  }
  const onLog = (entry: { siteId: string; line: string }) => {
    if (!entry) return
    const key = entry.siteId || '_'
    useSitesLink.setState((s) => ({ logs: { ...s.logs, [key]: [...(s.logs[key] ?? []), entry.line].slice(-MAX_LOG) } }))
  }
  const hello = () => {
    useSitesLink.setState({ connected: true })
    channel.send(SITE_EVENTS.hello)
    clearTimeout(helloTimer)
    helloTimer = setTimeout(() => {
      if (!useSitesLink.getState().ready) useSitesLink.setState({ stale: true })
    }, 5000)
  }
  channel.on(SITE_EVENTS.state, onState)
  channel.on(SITE_EVENTS.result, onResult)
  channel.on(SITE_EVENTS.log, onLog)
  channel.on('vite:ws:connect', hello)
  useSitesLink.setState({ channel, connected: false, ready: false, stale: false })
  hello()
  return () => {
    channel.off(SITE_EVENTS.state, onState)
    channel.off(SITE_EVENTS.result, onResult)
    channel.off(SITE_EVENTS.log, onLog)
    channel.off('vite:ws:connect', hello)
    clearTimeout(helloTimer)
    for (const [id, call] of pending) {
      clearTimeout(call.timer)
      call.reject(new Error('A conexão com esta máquina caiu.'))
      pending.delete(id)
    }
    useSitesLink.setState({ channel: undefined, connected: false, ready: false })
  }
}

/** Pede algo à máquina que roda os sites. */
export function callSites<T>(kind: SiteCallKind, request?: unknown): Promise<T> {
  const channel = useSitesLink.getState().channel
  if (!channel) return Promise.reject(new Error('Abra o conector (ou o npm run dev) para editar sites em código.'))
  const id = `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('Esta máquina não respondeu a tempo.'))
    }, TIMEOUT)
    pending.set(id, { resolve: resolve as (data: unknown) => void, reject, timer })
    channel.send(SITE_EVENTS.call, { id, kind, request } satisfies SiteCall)
  })
}

export const clearLog = (siteId: string) => useSitesLink.setState((s) => ({ logs: { ...s.logs, [siteId]: [] } }))
