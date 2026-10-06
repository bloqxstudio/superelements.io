import { create } from 'zustand'
import { useChat } from '@/features/space/chat/chatStore'
import { connectorChannel, type ChannelStatus } from './channel'

/**
 * O conector na máquina de quem usa o app publicado. O código de pareamento
 * nasce aqui (`ensureCode`) e vai dentro do arquivo que o botão baixa; a aba
 * procura o conector (`probe`) até ele abrir com esse código, e liga sozinha.
 * O código fica guardado neste navegador: da próxima vez, basta abrir o
 * conector. Colar um código do terminal (`connect`) continua valendo.
 */

export const CONNECTOR_PORT = 47823
/** O conector tenta portas seguintes se a primeira estiver ocupada. */
const PORT_TRIES = 5
/** Onde o app serve o conector para baixar. */
export const CONNECTOR_FILE = '/conector/conector.mjs'

const STORE_KEY = 'space-conector'
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

type Status = 'off' | 'checking' | ChannelStatus

interface Pairing {
  code: string
  port: number
}

interface ConnectorState {
  status: Status
  error?: string
  pairing?: Pairing
  /** O código desta aba, criado na primeira vez que alguém baixa o conector. */
  ensureCode: () => string
  /** Procura o conector com o código guardado, sem mostrar erro enquanto ele não abre. */
  probe: () => Promise<boolean>
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

const save = (pairing: Pairing | undefined) => {
  try {
    if (pairing) localStorage.setItem(STORE_KEY, JSON.stringify(pairing))
    else localStorage.removeItem(STORE_KEY)
  } catch {
    // Sem armazenamento: vale até fechar a aba
  }
}

const newCode = () => {
  const random = crypto.getRandomValues(new Uint32Array(6))
  return Array.from(random, (n) => ALPHABET[n % ALPHABET.length]).join('')
}

/**
 * Onde o conector com este código está ouvindo. Nada na porta: não há
 * conector aberto. Outro código numa porta: outro conector, e o deste código
 * pode estar na seguinte.
 */
async function find(code: string, from: number): Promise<{ port: number } | { error: 'closed' | 'other' | 'locked' | 'blocked' }> {
  let other = false
  for (let port = from; port < from + PORT_TRIES; port++) {
    let response: Response
    try {
      response = await fetch(`http://127.0.0.1:${port}/ping?code=${code}`)
    } catch {
      // Site publicado falando com o próprio computador: o Chrome e o Edge pedem licença ("loopback")
      if (await loopbackDenied()) return { error: 'blocked' }
      break
    }
    if (response.ok) return { port }
    if (response.status === 429) return { error: 'locked' }
    other = true
  }
  return { error: other ? 'other' : 'closed' }
}

/** A pessoa negou a licença do navegador para o site falar com este computador. */
async function loopbackDenied() {
  for (const name of ['loopback-network', 'local-network-access']) {
    try {
      const state = await navigator.permissions.query({ name } as unknown as PermissionDescriptor)
      if (state.state === 'denied') return true
    } catch {
      // Navegador sem essa licença: nada a perguntar
    }
  }
  return false
}

const MESSAGES = {
  blocked: 'O navegador está bloqueando o acesso a este computador. Clique no cadeado ao lado do endereço e permita "Apps e serviços neste dispositivo".',
  closed: 'Não achei o conector neste computador. Ele está aberto?',
  other: 'Tem um conector aberto com outro código. Feche aquela janela e abra o arquivo que você baixou aqui.',
  locked: 'Muitas tentativas com código errado. Espere uns minutos.',
}

let stops: Array<() => void> = []
const stopAll = () => {
  for (const stop of stops) stop()
  stops = []
}

export const useConnector = create<ConnectorState>()((set, get) => {
  let opening = false

  /** `quiet`: procura de fundo; sem conector aberto ainda, não é erro. */
  const open = async (pairing: Pairing, quiet: boolean) => {
    if (opening || get().status === 'connected') return get().status === 'connected'
    opening = true
    if (!quiet) set({ status: 'checking', error: undefined })
    try {
      const found = await find(pairing.code, pairing.port)
      if ('error' in found) {
        set({ status: 'failed', error: quiet && found.error === 'closed' ? undefined : MESSAGES[found.error] })
        return false
      }
      const live = { code: pairing.code, port: found.port }
      save(live)
      stopAll()
      const base = `http://127.0.0.1:${live.port}`
      const channel = connectorChannel(base, live.code, (status) => {
        set({ status, error: status === 'failed' ? 'O conector recusou a ligação. Baixe e abra de novo.' : undefined })
        // Sem conector, o chat volta para a tela de ligar
        if (status !== 'connected') useChat.setState({ connected: false })
      })
      const [{ startSpaceBridge }, { startSpaceChat }] = await Promise.all([import('@/features/space/bridge/client'), import('@/features/space/chat/connection')])
      stops = [startSpaceBridge(channel), startSpaceChat(channel), () => channel.close()]
      set({ pairing: live, error: undefined })
      return true
    } finally {
      opening = false
    }
  }

  return {
    status: 'off',
    pairing: saved(),
    ensureCode: () => {
      const current = get().pairing
      if (current) return current.code
      const pairing = { code: newCode(), port: CONNECTOR_PORT }
      save(pairing)
      set({ pairing, error: undefined })
      return pairing.code
    },
    probe: async () => {
      const pairing = get().pairing
      return pairing ? open(pairing, true) : false
    },
    connect: async (input) => {
      const pairing = parse(input)
      if (!pairing) {
        set({ status: 'failed', error: 'O código tem 6 letras e números, como CGP-YZ9.' })
        return false
      }
      set({ pairing })
      save(pairing)
      return open(pairing, false)
    },
    resume: () => {
      const pairing = get().pairing
      if (pairing && get().status === 'off') void open(pairing, true)
    },
    disconnect: () => {
      stopAll()
      save(undefined)
      useChat.setState({ connected: false })
      set({ status: 'off', error: undefined, pairing: undefined })
    },
  }
})
