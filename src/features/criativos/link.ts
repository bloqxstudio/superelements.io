import { create } from 'zustand'
import type { AgentChannel } from '@/features/space/connector/channel'
import { finishJob, noteJob, patchJob, startJob } from '@/features/operations/jobs'
import { CREATIVE_EVENTS, type CreativeAgentInfo, type CreativeImageProvider, type CreativeCall, type CreativeProgress, type CreativeResult, type CreativeStep } from './protocol'

/**
 * Lado da aba da IA dos criativos: usa o mesmo canal que o chat do Space
 * (websocket do Vite no dev, conector no app publicado). Os nomes dos eventos
 * e os tipos das chamadas ficam em `protocol.ts`, que o servidor também lê.
 */

export { CREATIVE_EVENTS, type CreativeAgentInfo, type CreativeImageProvider, type CreativeCall, type CreativeResult, type CreativeStep }

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
  /** O conector não manda a lista de IAs: versão antiga, que só sabe do Claude Code. */
  legacy: boolean
  /** Serviço de imagens com chave neste computador (o que gera); null: nenhum. */
  images: CreativeImageProvider | null
  /** Todos os serviços de imagem prontos neste computador, do preferido ao último. */
  providers: CreativeImageProvider[]
  keys: { openai: boolean; gemini: boolean }
}

export const useCreativeLink = create<LinkState>()(() => ({ connected: false, ia: null, stale: false, agents: [], legacy: false, images: null, providers: [], keys: { openai: false, gemini: false } }))

/** Verdadeiro, falso ou "ainda não sei" (null), para a tela decidir o que mostrar. */
export const useAiAvailable = (): boolean | null => useCreativeLink((s) => (!s.connected ? false : s.ia))

export const STALE_MESSAGE = 'A IA não respondeu. O conector pode estar desatualizado: baixe o conector.mjs de novo e abra-o.'

const pending = new Map<string, { resolve: (data: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; onStep?: (step: CreativeStep, detail?: string) => void }>()
const TIMEOUT = 9 * 60_000
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
  const onStatus = (data: { ia?: boolean; agents?: CreativeAgentInfo[]; images?: CreativeImageProvider | null; providers?: CreativeImageProvider[]; keys?: { openai: boolean; gemini: boolean } }) => {
    clearTimeout(helloTimer)
    const images = { images: data?.images ?? null, providers: data?.providers ?? [], keys: data?.keys ?? { openai: false, gemini: false } }
    // Aviso só das chaves de imagem (depois de salvar uma): o resto continua como está
    if (data && data.ia === undefined && !data.agents) return void useCreativeLink.setState(images)
    // Conector anterior à escolha de IA: só diz se há uma (o Claude Code), sem a lista
    const agents = data?.agents ?? (data?.ia ? [{ id: 'claude' as const, name: 'Claude Code', available: true }] : [])
    useCreativeLink.setState({ connected: true, ia: !!data?.ia, stale: false, agents, legacy: !data?.agents, ...images })
  }
  const onResult = (result: CreativeResult) => {
    const call = pending.get(result?.id)
    if (!call) return
    pending.delete(result.id)
    clearTimeout(call.timer)
    if (result.ok === true) call.resolve(result.data)
    else call.reject(new Error((result as { error: string }).error))
  }
  const onProgress = (progress: CreativeProgress) => pending.get(progress?.id)?.onStep?.(progress.step, progress.detail)
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
  useCreativeLink.setState({ channel, connected: false, ia: null, stale: false, agents: [], legacy: false, images: null, providers: [], keys: { openai: false, gemini: false } })
  hello()
  return () => {
    channel.off(CREATIVE_EVENTS.status, onStatus)
    channel.off(CREATIVE_EVENTS.result, onResult)
    channel.off(CREATIVE_EVENTS.progress, onProgress)
    channel.off('vite:ws:connect', hello)
    clearTimeout(helloTimer)
    failAll('A conexão com a IA caiu.')
    useCreativeLink.setState({ channel: undefined, connected: false, ia: null, stale: false, agents: [], legacy: false, images: null, providers: [], keys: { openai: false, gemini: false } })
  }
}

const TRACKED: Partial<Record<CreativeCall['kind'], { kind: string; label: (r: Record<string, unknown>) => unknown }>> = {
  edit: { kind: 'Edição', label: (r) => r.message },
  plan: { kind: 'Plano de posts', label: (r) => r.brief },
  image: { kind: 'Imagem', label: (r) => r.prompt },
  'copy-slides': { kind: 'Post da copy', label: (r) => r.name },
}
const STEP_TEXT: Record<CreativeStep, string> = { start: 'Lendo o pedido', thinking: 'Pensando', reading: 'Pesquisando na web', writing: 'Escrevendo' }

/** Pede uma resposta à IA desta máquina. Os pedidos de criativos aparecem na tela Agentes enquanto rodam. */
export function callAi<T>(kind: CreativeCall['kind'], request: unknown, signal?: AbortSignal, onStep?: (step: CreativeStep, detail?: string) => void): Promise<T> {
  const track = TRACKED[kind]
  if (!track) return callAiRaw<T>(kind, request, signal, onStep)
  const label = String(track.label((request ?? {}) as Record<string, unknown>) ?? '').replace(/\s+/g, ' ').trim().slice(0, 90) || track.kind
  const jobId = startJob({ area: 'criativos', kind: track.kind, label, agent: 'Claude Code · Criativos', color: '#D97757', step: 'Enviando o pedido', href: '/criativos' })
  return callAiRaw<T>(kind, request, signal, (step, detail) => {
    patchJob(jobId, { step: detail ?? STEP_TEXT[step] })
    noteJob(jobId, detail ?? STEP_TEXT[step])
    onStep?.(step, detail)
  }).then(
    (data) => {
      finishJob(jobId)
      return data
    },
    (error) => {
      finishJob(jobId, error)
      throw error
    }
  )
}

function callAiRaw<T>(kind: CreativeCall['kind'], request: unknown, signal?: AbortSignal, onStep?: (step: CreativeStep, detail?: string) => void): Promise<T> {
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
      reject(new Error('A IA passou de 9 minutos sem responder.'))
    }, TIMEOUT)
    // Sem nenhum passo vindo do outro lado, o conector provavelmente não conhece este pedido
    // Imagem não manda passos (leva até 1 minuto): só vale o limite total
    // Imagem, download e captura não mandam passos; a pesquisa lê a web por minutos entre um sinal e outro
    const watch = kind !== 'image' && kind !== 'download' && kind !== 'capture'
    let silence = watch ? setTimeout(() => fail(STALE_MESSAGE), SILENCE) : undefined
    const fail = (message: string) => {
      if (!pending.delete(id)) return
      clearTimeout(timer)
      channel.send(CREATIVE_EVENTS.stop, { id })
      reject(new Error(message))
    }
    const alive = (step: CreativeStep, detail?: string) => {
      clearTimeout(silence)
      if (watch) silence = setTimeout(() => fail('O Claude Code parou de responder. Tente de novo.'), SILENCE * 2)
      onStep?.(step, detail)
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

const CHOICE_KEY = 'criativos-imagens'

/** O serviço de imagens que a pessoa escolheu, se ainda está pronto; senão, o primeiro pronto. */
export function imageProviderChoice(): CreativeImageProvider | undefined {
  const { providers } = useCreativeLink.getState()
  let saved: string | null = null
  try {
    saved = localStorage.getItem(CHOICE_KEY)
  } catch {
    // sem armazenamento
  }
  return (providers.find((p) => p === saved) ?? providers[0]) || undefined
}

export function chooseImageProvider(provider: CreativeImageProvider) {
  try {
    localStorage.setItem(CHOICE_KEY, provider)
  } catch {
    // vale até recarregar
  }
  useCreativeLink.setState((s) => ({ images: s.providers.includes(provider) ? provider : s.images }))
}

/** Pede uma imagem ao serviço escolhido neste computador; vem como data URL. */
export const requestImage = (prompt: string, ratio: 'square' | 'portrait' | 'landscape', signal?: AbortSignal) =>
  callAi<{ data: string; provider: CreativeImageProvider; model: string }>('image', { prompt, ratio, provider: imageProviderChoice() }, signal)

/** Guarda a chave de um serviço de imagens no computador de quem usa (vazia, apaga). */
export function saveImageKey(provider: 'openai' | 'gemini', key: string) {
  useCreativeLink.getState().channel?.send(CREATIVE_EVENTS.key, { provider, key })
}

/** Baixa uma imagem da web pelo conector deste computador (sem as travas de CORS do navegador); vem como data URL. */
export const downloadImageViaLink = (url: string, signal?: AbortSignal) => callAi<{ data: string; type: string }>('download', { url }, signal)

/** Fotografa uma página (HTML completo) com o navegador deste computador: a página inteira, em PNG (data URL). */
export const capturePageViaLink = (html: string, width: number, signal?: AbortSignal) => callAi<{ data: string; width: number; height: number }>('capture', { html, width }, signal)
