import { create } from 'zustand'
import { useChat } from '@/features/space/chat/chatStore'
import { connectorChannel, type ChannelStatus } from './channel'

/**
 * O conector na máquina de quem usa o app publicado: o código de pareamento
 * (guardado neste navegador, para reconectar sozinho), o estado da ligação e
 * os comandos de ligar e desligar. Ligado, a ponte e o chat dos agentes
 * passam a falar com ele.
 */

export const CONNECTOR_PORT = 47823
/** Onde o app serve o conector para baixar. */
export const CONNECTOR_FILE = '/conector/conector.mjs'

const STORE_KEY = 'space-conector'

type Status = 'off' | 'checking' | ChannelStatus

interface Pairing {
  code: string
  port: number
}

interface ConnectorState {
  status: Status
  error?: string
  pairing?: Pairing
  /** Liga com o código que o conector mostrou no terminal ("CGP-YZ9", ou "CGP-YZ9:47824" em outra porta). */
  connect: (input: string) => Promise<boolean>
  /** Abertura do app: liga de novo com o código guardado, se houver. */
  resume: () => void
  /** Esquece o código e desliga. */
  disconnect: () => void
}

const parse = (input: string): Pairing | null => {
  const [raw, port] = input.trim().toUpperCase().split(':')
  const code = raw.replace(/[^A-Z0-9]/g, '')
  return code.length === 6 ? { code, port: Number(port) || CONNECTOR_PORT } : null
}

const saved = (): Pairing | undefined => {
  try {
    const value = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null')
    return value?.code ? value : undefined
  } catch {
    return undefined
  }
}

let stops: Array<() => void> = []
const stopAll = () => {
  for (const stop of stops) stop()
  stops = []
}

export const useConnector = create<ConnectorState>()((set, get) => {
  const open = async (pairing: Pairing, quiet: boolean) => {
    set({ status: 'checking', error: undefined })
    const base = `http://127.0.0.1:${pairing.port}`
    let response: Response
    try {
      response = await fetch(`${base}/ping?code=${pairing.code}`)
    } catch {
      set({ status: 'failed', pairing, error: quiet ? undefined : 'Não achei o conector neste computador. Ele está aberto no terminal?' })
      return false
    }
    if (!response.ok) {
      const error = response.status === 429 ? 'Muitas tentativas com código errado. Espere uns minutos.' : 'Código errado. Confira o que aparece no terminal do conector.'
      set({ status: 'failed', error })
      return false
    }
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(pairing))
    } catch {
      // Sem armazenamento: vale até fechar a aba
    }
    stopAll()
    const channel = connectorChannel(base, pairing.code, (status) => {
      set({ status, error: status === 'failed' ? 'O conector recusou a ligação. Cole o código de novo.' : undefined })
      // Sem conector, o chat volta para a tela de ligar
      if (status !== 'connected') useChat.setState({ connected: false })
    })
    const [{ startSpaceBridge }, { startSpaceChat }] = await Promise.all([import('@/features/space/bridge/client'), import('@/features/space/chat/connection')])
    stops = [startSpaceBridge(channel), startSpaceChat(channel), () => channel.close()]
    set({ pairing })
    return true
  }

  return {
    status: 'off',
    connect: async (input) => {
      const pairing = parse(input)
      if (!pairing) {
        set({ status: 'failed', error: 'O código tem 6 letras e números, como CGP-YZ9.' })
        return false
      }
      return open(pairing, false)
    },
    resume: () => {
      const pairing = saved()
      if (pairing && get().status === 'off') void open(pairing, true)
    },
    disconnect: () => {
      stopAll()
      try {
        localStorage.removeItem(STORE_KEY)
      } catch {
        // Nada guardado
      }
      useChat.setState({ connected: false })
      set({ status: 'off', error: undefined, pairing: undefined })
    },
  }
})
