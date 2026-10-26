import makeWASocket, { DisconnectReason, downloadMediaMessage, fetchLatestWaWebVersion, jidDecode, makeCacheableSignalKeyStore, type ConnectionState, type WAMessage, type WASocket, type WAVersion } from 'baileys'
import type { Logger } from 'pino'
import QRCode from 'qrcode'
import type { DbAuth } from './auth.ts'

/**
 * A conexão de um número: abre o WhatsApp como aparelho conectado, põe o QR
 * code na linha da equipe até o celular ler, e daí em diante mantém o número
 * conectado (reconecta sozinho se a rede cair). As mensagens (recebidas e as
 * enviadas pelo celular) vão para `onMessage`, e `send` envia a da equipe.
 */

/** O nome do aparelho no celular, em Aparelhos conectados */
const BROWSER: [string, string, string] = ['Avence CRM', 'Chrome', '1.0.0']

export interface NumberPatch {
  wanted?: boolean
  status?: 'disconnected' | 'connecting' | 'connected'
  qr?: string | null
  phone?: string | null
  profile_name?: string | null
  error?: string | null
  connected_at?: string
}

/** Uma mensagem de conversa individual, já no formato que o CRM guarda */
export interface StoredMessage {
  jid: string
  name?: string
  waId: string
  fromMe: boolean
  body: string
  kind: string
  at: Date
  /** Foto, vídeo, áudio, documento ou figurinha: o arquivo baixa sob demanda */
  media?: { mime?: string; name?: string; size: number; download: () => Promise<Buffer> }
}

export interface Session {
  /** Está com a conexão aberta (dá para enviar) */
  readonly open: boolean
  /** O endereço da foto de perfil (vence em poucas horas); vazio quando a pessoa não tem ou não deixa ver */
  photoUrl: (jid: string) => Promise<string | undefined>
  /** Confere se o número tem WhatsApp e devolve o endereço certo (com o 9 do Brasil, por exemplo) */
  resolve: (jid: string) => Promise<string | undefined>
  /** Envia texto e devolve o id da mensagem no WhatsApp */
  send: (jid: string, text: string) => Promise<string>
  /** Saindo: tirando o aparelho do celular */
  readonly leaving: boolean
  /** Tira o aparelho do celular e apaga a sessão */
  logout: () => Promise<void>
  /** Fecha a conexão sem desconectar o número (o serviço vai parar) */
  close: () => void
}

interface Options {
  teamId: string
  auth: DbAuth
  /** Grava o estado na linha da equipe */
  report: (patch: NumberPatch) => Promise<void>
  log: Logger
  /** Desconectaram com o serviço desligado: só tirar o aparelho do celular */
  logoutOnly?: boolean
  /** Chegou (ou o celular enviou) uma mensagem */
  onMessage: (message: StoredMessage) => Promise<void>
  onEnd: () => void
}

// A versão do WhatsApp Web da vez (com uma velha o WhatsApp recusa a conexão), relida a cada 6 h
let known: { version: WAVersion; at: number } | undefined
async function waVersion() {
  if (known && Date.now() - known.at < 6 * 3600_000) return known.version
  const latest = await fetchLatestWaWebVersion().catch(() => undefined)
  if (latest && !latest.error) known = { version: latest.version, at: Date.now() }
  return latest?.version
}

const MEDIA_FIELDS = [
  ['imageMessage', 'image', 'Foto'],
  ['videoMessage', 'video', 'Vídeo'],
  ['audioMessage', 'audio', 'Áudio'],
  ['documentMessage', 'document', 'Documento'],
  ['stickerMessage', 'sticker', 'Figurinha'],
] as const

const unwrap = (message: WAMessage) => {
  const m = message.message
  return m ? (m.ephemeralMessage?.message ?? m.viewOnceMessage?.message ?? m.documentWithCaptionMessage?.message ?? m) : undefined
}

/** A mídia da mensagem (tipo do arquivo, nome e tamanho), se tiver */
function mediaOf(message: WAMessage) {
  const m = unwrap(message)
  if (!m) return undefined
  for (const [field] of MEDIA_FIELDS) {
    const part = m[field] as { mimetype?: string | null; fileName?: string | null; fileLength?: unknown } | null | undefined
    if (part) return { mime: part.mimetype ?? undefined, name: part.fileName ?? undefined, size: Number(part.fileLength ?? 0) }
  }
  return undefined
}

/** Texto e tipo de uma mensagem; a legenda e um rótulo ficam no texto (o arquivo vai à parte) */
function describe(message: WAMessage): { body: string; kind: string } | undefined {
  const m = unwrap(message)
  if (!m) return undefined
  const text = m.conversation ?? m.extendedTextMessage?.text
  if (text) return { body: text, kind: 'text' }
  for (const [field, kind, label] of MEDIA_FIELDS) {
    const part = m[field] as { caption?: string | null; fileName?: string | null } | null | undefined
    if (part) return { body: [`[${label}]`, part.caption ?? part.fileName].filter(Boolean).join(' '), kind }
  }
  // Reações, enquetes, chamadas, protocolo… não viram mensagem
  if (m.reactionMessage || m.protocolMessage || m.senderKeyDistributionMessage) return undefined
  return { body: '[Mensagem de um tipo que o CRM ainda não mostra]', kind: 'other' }
}

/** A conversa individual da mensagem (número, não o id interno @lid quando o número é conhecido) */
function chatOf(message: WAMessage): string | undefined {
  const { remoteJid, remoteJidAlt } = message.key
  if (!remoteJid) return undefined
  const jid = remoteJid.endsWith('@lid') && remoteJidAlt ? remoteJidAlt : remoteJid
  // Só conversas individuais: grupos, status e canais ficam de fora
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid') ? jid : undefined
}

const statusOf = (error: unknown) => (error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode

export function openSession(o: Options): Session {
  let sock: WASocket | undefined
  let ended = false
  let leaving = !!o.logoutOnly
  let failures = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const say = (text: string) => console.log(`[${o.teamId.slice(0, 8)}] ${text}`)
  const paired = () => !!o.auth.state.creds.me

  const finish = () => {
    ended = true
    clearTimeout(timer)
    o.onEnd()
  }

  const schedule = (ms: number) => {
    clearTimeout(timer)
    timer = setTimeout(() => void connect().catch(retry), ms)
  }

  const retry = (error: unknown) => {
    say(`falhou ao abrir: ${error instanceof Error ? error.message : String(error)}`)
    failures++
    schedule(Math.min(60_000, 1000 * 2 ** Math.min(failures, 6)))
  }

  const connect = async () => {
    if (ended) return
    if (leaving && !paired()) {
      await o.auth.clear()
      await o.report({ status: 'disconnected', qr: null, phone: null, profile_name: null })
      finish()
      return
    }
    const socket = makeWASocket({
      version: await waVersion(),
      auth: { creds: o.auth.state.creds, keys: makeCacheableSignalKeyStore(o.auth.state.keys, o.log) },
      logger: o.log,
      browser: BROWSER,
      // Sem ficar "online": o celular continua recebendo as notificações
      markOnlineOnConnect: false,
      // Sem o histórico completo. A sincronização inicial fica no padrão da biblioteca: sem ela a sessão
      // perde a ligação entre números e ids (@lid) e cai
      syncFullHistory: false,
      getMessage: async () => undefined,
    })
    sock = socket
    socket.ev.on('creds.update', () => {
      if (!ended) void o.auth.saveCreds().catch((error) => say(`não gravou as chaves: ${error.message ?? error}`))
    })
    socket.ev.on('messages.upsert', ({ messages }) => {
      if (leaving || ended) return
      for (const message of messages) {
        const jid = chatOf(message)
        const content = describe(message)
        const waId = message.key.id
        if (!jid || !content || !waId) continue
        const at = new Date((Number(message.messageTimestamp) || Date.now() / 1000) * 1000)
        const found = mediaOf(message)
        const media = found && {
          ...found,
          download: () => downloadMediaMessage(message, 'buffer', {}, { logger: o.log, reuploadRequest: socket.updateMediaMessage }),
        }
        void o
          .onMessage({ jid, name: message.pushName ?? undefined, waId, fromMe: !!message.key.fromMe, ...content, at, media })
          .catch((error) => say(`não guardou a mensagem: ${error.message ?? error}`))
      }
    })
    socket.ev.on('connection.update', (update) => void onUpdate(socket, update).catch((error) => say(`erro na conexão: ${error.message ?? error}`)))
  }

  const onUpdate = async (socket: WASocket, update: Partial<ConnectionState>) => {
    if (ended || socket !== sock) return

    if (update.qr) {
      say('QR code novo')
      await o.report({ status: 'connecting', qr: await QRCode.toDataURL(update.qr, { margin: 1, width: 320 }), error: null })
    }

    if (update.connection) isOpen = update.connection === 'open'

    if (update.connection === 'open') {
      failures = 0
      if (leaving) {
        await logout()
        return
      }
      const id = socket.user?.id
      say(`conectado${id ? ` (${jidDecode(id)?.user})` : ''}`)
      await o.report({
        status: 'connected',
        qr: null,
        error: null,
        phone: id ? (jidDecode(id)?.user ?? null) : null,
        profile_name: socket.user?.name ?? socket.user?.verifiedName ?? null,
        connected_at: new Date().toISOString(),
      })
    }

    if (update.connection === 'close') {
      const code = statusOf(update.lastDisconnect?.error)
      // Logo depois de ler o QR o WhatsApp pede para abrir de novo
      if (code === DisconnectReason.restartRequired) {
        schedule(0)
        return
      }
      if (code === DisconnectReason.loggedOut) {
        say('o celular desconectou')
        await o.auth.clear()
        await o.report({ wanted: false, status: 'disconnected', qr: null, phone: null, profile_name: null, error: 'O celular desconectou o CRM. Para voltar, conecte de novo pelo QR code.' })
        finish()
        return
      }
      if (!paired()) {
        say('o QR code venceu')
        await o.report({ wanted: false, status: 'disconnected', qr: null, error: 'O QR code venceu antes de o celular ler. Gere outro.' })
        finish()
        return
      }
      if (code === DisconnectReason.connectionReplaced) {
        say('outra cópia do serviço abriu este número')
        // Sem `wanted`: senão as duas cópias ficam se derrubando
        await o.report({ wanted: false, status: 'disconnected', error: 'Outra cópia do serviço abriu este mesmo número. Deixe o serviço rodando num lugar só e conecte de novo.' })
        finish()
        return
      }
      // A rede caiu ou o WhatsApp fechou: tenta de novo, cada vez esperando mais (até 1 min)
      failures++
      say(`caiu (${code ?? 'sem código'}), tentando de novo`)
      await o.report({ status: 'connecting', qr: null })
      schedule(Math.min(60_000, 1000 * 2 ** Math.min(failures, 6)))
    }
  }

  let isOpen = false

  const logout = async () => {
    if (ended) return
    leaving = true
    ended = true
    clearTimeout(timer)
    const socket = sock
    if (socket && paired()) {
      // Tira o aparelho da lista do celular (só dá com a conexão aberta)
      await Promise.race([socket.logout().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 5000))])
    }
    socket?.end(undefined).catch(() => undefined)
    await o.auth.clear()
    await o.report({ status: 'disconnected', qr: null, phone: null, profile_name: null, error: null })
    say('desconectado')
    o.onEnd()
  }

  setImmediate(() => void connect().catch(retry))

  return {
    get open() {
      return isOpen && !ended
    },
    photoUrl: async (jid) => {
      if (!sock || !isOpen || ended) throw new Error('O WhatsApp não está conectado agora.')
      // Sem foto (ou escondida): o WhatsApp responde com erro, e isso não é falha nossa
      return sock.profilePictureUrl(jid, 'image', 10_000).catch(() => undefined)
    },
    resolve: async (jid) => {
      if (!sock || !isOpen || ended) throw new Error('O WhatsApp não está conectado agora.')
      if (!jid.endsWith('@s.whatsapp.net')) return jid
      const found = await sock.onWhatsApp(jid)
      return found?.find((r) => r.exists)?.jid
    },
    send: async (jid, text) => {
      if (!sock || !isOpen || ended) throw new Error('O WhatsApp não está conectado agora.')
      const sent = await sock.sendMessage(jid, { text })
      if (!sent?.key.id) throw new Error('O WhatsApp não confirmou o envio.')
      return sent.key.id
    },
    get leaving() {
      return leaving
    },
    logout,
    close: () => {
      if (ended) return
      ended = true
      clearTimeout(timer)
      sock?.end(undefined).catch(() => undefined)
    },
  }
}
