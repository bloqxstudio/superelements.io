import { create } from 'zustand'
import type { AgentChannel } from '@/features/space/connector/channel'
import { CREATIVE_EVENTS, type CreativeAgentInfo, type CreativeCall, type CreativeProgress, type CreativeResult, type CreativeStep } from './protocol'

/**
 * Lado da aba da IA dos criativos: usa o mesmo canal que o chat do Space
 * (websocket do Vite no dev, conector no app publicado). Os nomes dos eventos
 * e os tipos das chamadas ficam em `protocol.ts`, que o servidor também lê.
 */

export { CREATIVE_EVENTS, type CreativeAgentInfo, type CreativeCall, type CreativeResult, type CreativeStep }

interface LinkState {
  channel?: AgentChannel
  /** O canal está de pé (dev ou conector pareado). */
  connected: boolean
  /** O Claude Code foi achado na máquina; null enquanto não respondeu. */
  ia: boolean | null
  /** O canal respondeu, mas quem está do outro lado não conhece a IA dos criativos: conector antigo. */
  stale: boolean
  /** As IAs desta máquina (Claude Code, Codex) e se cada uma está instalada. */
  agents: CreativeAgentInfo[]
}

export const useCreativeLink = create<LinkState>()(() => ({ connected: false, ia: null, stale: false, agents: [] }))

/** Verdadeiro, falso ou "ainda não sei" (null), para a tela decidir o que mostrar. */
export const useAiAvailable = (): boolean | null => useCreativeLink((s) => (!s.connected ? false : s.ia))

export const STALE_MESSAGE = 'A IA não respondeu. O conector pode estar desatualizado: baixe o conector.mjs de novo e abra-o.'

const pending = new Map<string, { resolve: (data: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; onStep?: (step: CreativeStep) => void }>()
const TIMEOUT = 5 * 60_000
/** Quanto esperar a resposta ao "oi" antes de achar o conector desatualizado. */
const HELLO_WAIT = 4000
/** Sem nenhum sinal de vida do Claude Code por este tempo, o pedido falha em vez de esperar os 5 minutos. */
const SILENCE = 45_000

const failAll = (message: string) => {
  for (const [id, call] of pending) {
    clearTimeout(call.timer)
    call.reject(new Error(message))
    pending.delete(id)
  }
}

/** Liga a IA dos criativos a um canal; devolve a função que desliga. */
export function startCreativeLink(channel: AgentChannel) {
  let helloTimer: ReturnType<typeof setTimeout> | undefined
  const onStatus = (data: { ia?: boolean; agents?: CreativeAgentInfo[] }) => {
    clearTimeout(helloTimer)
    useCreativeLink.setState({ connected: true, ia: !!data?.ia, stale: false, agents: data?.agents ?? [] })
  }
  const onResult = (result: CreativeResult) => {
    const call = pending.get(result?.id)
    if (!call) return
    pending.delete(result.id)
    clearTimeout(call.timer)
    if (result.ok === true) call.resolve(result.data)
    else call.reject(new Error((result as { error: string }).error))
  }
  const onProgress = (progress: CreativeProgress) => pending.get(progress?.id)?.onStep?.(progress.step)
  const hello = () => {
    useCreativeLink.setState({ connected: true })
    channel.send(CREATIVE_EVENTS.hello)
    // Um conector que não conhece a IA dos criativos nunca responde ao "oi"
    clearTimeout(helloTimer)
    helloTimer = setTimeout(() => useCreativeLink.setState({ ia: false, stale: true }), HELLO_WAIT)
  }
  channel.on(CREATIVE_EVENTS.status, onStatus)
  channel.on(CREATIVE_EVENTS.result, onResult)
  channel.on(CREATIVE_EVENTS.progress, onProgress)
  channel.on('vite:ws:connect', hello)
  useCreativeLink.setState({ channel, connected: false, ia: null, stale: false, agents: [] })
  hello()
  return () => {
    channel.off(CREATIVE_EVENTS.status, onStatus)
    channel.off(CREATIVE_EVENTS.result, onResult)
    channel.off(CREATIVE_EVENTS.progress, onProgress)
    channel.off('vite:ws:connect', hello)
    clearTimeout(helloTimer)
    failAll('A conexão com a IA caiu.')
    useCreativeLink.setState({ channel: undefined, connected: false, ia: null, stale: false, agents: [] })
  }
}

/** Pede uma resposta à IA desta máquina. `signal` cancela (e para o Claude Code). */
export function callAi<T>(kind: CreativeCall['kind'], request: unknown, signal?: AbortSignal, onStep?: (step: CreativeStep) => void): Promise<T> {
  const { channel, connected, stale } = useCreativeLink.getState()
  if (!channel || !connected) return Promise.reject(new Error('A IA não está conectada. Abra o app local ou o conector.'))
  if (stale) return Promise.reject(new Error(STALE_MESSAGE))
  const id = crypto.randomUUID()
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      if (!pending.delete(id)) return
      channel.send(CREATIVE_EVENTS.stop, { id })
      reject(new DOMException('Parou', 'AbortError'))
    }
    const timer = setTimeout(() => {
      pending.delete(id)
      channel.send(CREATIVE_EVENTS.stop, { id })
      reject(new Error('A IA passou de 5 minutos sem responder.'))
    }, TIMEOUT)
    // Sem nenhum passo vindo do outro lado, o conector provavelmente não conhece este pedido
    let silence = setTimeout(() => fail(STALE_MESSAGE), SILENCE)
    const fail = (message: string) => {
      if (!pending.delete(id)) return
      clearTimeout(timer)
      channel.send(CREATIVE_EVENTS.stop, { id })
      reject(new Error(message))
    }
    const alive = (step: CreativeStep) => {
      clearTimeout(silence)
      silence = setTimeout(() => fail('O Claude Code parou de responder. Tente de novo.'), SILENCE * 2)
      onStep?.(step)
    }
    pending.set(id, {
      resolve: (data) => {
        clearTimeout(silence)
        resolve(data as T)
      },
      reject: (error) => {
        clearTimeout(silence)
        reject(error)
      },
      timer,
      onStep: alive,
    })
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) return abort()
    channel.send(CREATIVE_EVENTS.call, { id, kind, request } satisfies CreativeCall)
  })
}
