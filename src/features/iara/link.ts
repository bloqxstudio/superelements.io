import { create } from 'zustand'
import type { AgentChannel } from '@/features/space/connector/channel'

/**
 * O canal da Iara com o servidor de dev ou o conector (`scripts/iara/iaraPlugin.ts`). A aba manda
 * o pedido; o servidor roda o Claude Code e devolve os eventos (passos, texto, fim). Um conector
 * antigo não responde ao "oi": aí a Iara usa o modo de resposta única.
 */

export const IARA_EVENTS = {
  hello: 'iara:hello',
  status: 'iara:status',
  send: 'iara:send',
  stop: 'iara:stop',
  event: 'iara:event',
} as const

export interface IaraSendPayload {
  id: string
  text: string
  system: string
  resume?: string
}

export type IaraEvent =
  | { id: string; type: 'step'; text: string }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'session'; session: string }
  | { id: string; type: 'done'; text: string; session?: string }
  | { id: string; type: 'error'; text: string }

interface LinkState {
  channel?: AgentChannel
  /** O servidor conhece a Iara agente (conector novo ou servidor de dev). */
  agent: boolean
  version?: string
}

export const useIaraLink = create<LinkState>()(() => ({ agent: false }))

const listeners = new Set<(e: IaraEvent) => void>()
export const onIaraEvent = (fn: (e: IaraEvent) => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function startIaraLink(channel: AgentChannel) {
  const onStatus = (data: { ok?: boolean; version?: string }) => useIaraLink.setState({ agent: !!data?.ok, version: data?.version })
  const onEvent = (e: IaraEvent) => listeners.forEach((fn) => fn(e))
  const hello = () => channel.send(IARA_EVENTS.hello)
  channel.on(IARA_EVENTS.status, onStatus)
  channel.on(IARA_EVENTS.event, onEvent)
  channel.on('vite:ws:connect', hello)
  useIaraLink.setState({ channel, agent: false })
  hello()
  return () => {
    channel.off(IARA_EVENTS.status, onStatus)
    channel.off(IARA_EVENTS.event, onEvent)
    channel.off('vite:ws:connect', hello)
    useIaraLink.setState({ channel: undefined, agent: false })
  }
}

export const sendToAgent = (payload: IaraSendPayload) => useIaraLink.getState().channel?.send(IARA_EVENTS.send, payload)
export const stopAgent = (id: string) => useIaraLink.getState().channel?.send(IARA_EVENTS.stop, { id })
