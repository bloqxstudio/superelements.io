/**
 * Por onde a aba fala com quem roda os agentes. No `npm run dev` é o
 * websocket do Vite (`import.meta.hot`); no app publicado, o conector na
 * máquina de quem usa (`connectorChannel`). A ponte (`bridge/client.ts`) e o
 * chat (`chat/connection.ts`) só usam isto. Ao (re)conectar, o canal emite
 * `vite:ws:connect`, como o Vite.
 */
export interface AgentChannel {
  send: (event: string, data?: unknown) => void
  on: (event: string, listener: (data: never) => void) => void
  off: (event: string, listener: (data: never) => void) => void
}

export type ChannelStatus = 'connected' | 'reconnecting' | 'failed'

/** Mensagens guardadas antes da primeira conexão (o "oi" da ponte e do chat). */
const MAX_QUEUE = 100

/**
 * O conector (`scripts/connector/conector.ts`): os eventos chegam por SSE, e
 * as mensagens saem por POST em texto puro (sem a pergunta prévia de CORS).
 * O código de pareamento vai em cada pedido.
 */
export function connectorChannel(base: string, code: string, onStatus: (status: ChannelStatus) => void) {
  const listeners = new Map<string, Set<(data: never) => void>>()
  let client: string | null = null
  let ever = false
  let queue: Array<[string, unknown]> = []
  const query = `code=${encodeURIComponent(code)}`

  const emit = (event: string, data?: unknown) => listeners.get(event)?.forEach((listener) => listener(data as never))

  const post = (event: string, data: unknown) =>
    fetch(`${base}/link/send?${query}&client=${client}`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ event, data }) }).catch(() => {
      // Conector fechou no meio: a conexão de eventos avisa e reconecta
    })

  const source = new EventSource(`${base}/link?${query}`)
  source.onmessage = (message) => {
    let parsed: { type?: string; client?: string; event?: string; data?: unknown }
    try {
      parsed = JSON.parse(message.data)
    } catch {
      return
    }
    if (parsed.type === 'connected' && parsed.client) {
      client = parsed.client
      ever = true
      onStatus('connected')
      const pending = queue
      queue = []
      for (const [event, data] of pending) void post(event, data)
      emit('vite:ws:connect')
      return
    }
    if (parsed.event) emit(parsed.event, parsed.data)
  }
  // O navegador tenta de novo sozinho; fechado de vez é código recusado
  source.onerror = () => {
    client = null
    onStatus(source.readyState === EventSource.CLOSED ? 'failed' : 'reconnecting')
  }

  const channel: AgentChannel & { close: () => void } = {
    send: (event, data) => {
      if (client) void post(event, data)
      else if (!ever && queue.length < MAX_QUEUE) queue.push([event, data])
    },
    on: (event, listener) => {
      const set = listeners.get(event) ?? new Set()
      set.add(listener)
      listeners.set(event, set)
    },
    off: (event, listener) => listeners.get(event)?.delete(listener),
    close: () => source.close(),
  }
  return channel
}
