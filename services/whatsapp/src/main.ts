import { spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import pino from 'pino'
import { dbAuthState } from './auth.ts'
import { samePhone } from './comandos.ts'
import { ALL_TOPICS, answerClient, type ClientContact, type Topic } from './clientes.ts'
import { runReports } from './relatorios.ts'
import { openSession, type NumberPatch, type OutFile, type Session, type StoredMessage } from './session.ts'

/**
 * O serviço do WhatsApp da equipe (CRM › WhatsApp). Conecta o número de cada
 * equipe como aparelho conectado (WhatsApp › Aparelhos conectados), pela
 * biblioteca Baileys, sem intermediário. Fala só com o Supabase: de 2 em 2 s
 * lê a tabela `crm_whatsapp_numbers` e conecta quem o gestor pediu (`wanted`),
 * desconecta quem ele tirou, e escreve ali o QR code e o estado. As chaves da
 * sessão ficam em `crm_whatsapp_auth`, então o serviço não guarda nada no
 * disco.
 *
 * Precisa ficar ligado o tempo todo (o número só fica conectado com ele no
 * ar) e só sai para a internet: não recebe conexões, então roda atrás de
 * qualquer rede. Uma cópia só: duas com o mesmo número se derrubam.
 *
 *   bash services/whatsapp/instalar-mac.sh   (Mac que fica ligado: instala e deixa rodando sempre)
 *   npm run whatsapp                         (na raiz, para testar; lê SUPABASE_SERVICE_ROLE_KEY do .env.local)
 *   docker build -t whatsapp services/whatsapp && docker run -e SUPABASE_URL=… -e SUPABASE_SERVICE_ROLE_KEY=… whatsapp
 *
 * `--check` só confere a chave e a tabela e sai (0 certo, 2 falta a migração, 1 outro erro).
 */

// Rodando do repositório: a chave do .env.local desta pasta (o instalador grava ali) ou da raiz, e o
// endereço do .env da raiz. O que vem primeiro vale.
for (const file of ['../.env.local', '../../../.env.local', '../../../.env']) {
  try {
    process.loadEnvFile(new URL(file, import.meta.url))
  } catch {
    // Sem o arquivo: as variáveis vêm do ambiente (Docker, servidor)
  }
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (Supabase › Project Settings › API Keys).')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
// Os avisos da biblioteca; LOG_LEVEL=debug mostra tudo
const log = pino({ level: process.env.LOG_LEVEL ?? 'warn' })

const LOOP = 2000
const BEAT = 15_000
const TABLE = 'crm_whatsapp_numbers'

const isMissingTable = (error: { code?: string }) => error.code === '42P01' || error.code === 'PGRST205'

/** `--check`: só confere a chave e a tabela. Sai sozinho (sem process.exit, que no Windows quebra com conexões abertas). */
async function check() {
  const { error } = await db.from(TABLE).select('team_id', { head: true, count: 'exact' })
  if (!error) console.log(`Supabase certo (${new URL(url!).host}): chave aceita e a tabela do WhatsApp existe.`)
  else if (isMissingTable(error)) console.log(`A chave foi aceita (${new URL(url!).host}), mas falta a migração 20261026150000_crm_whatsapp.sql.`)
  else console.error(`O Supabase recusou: ${error.message || error.code || 'sem resposta'}`)
  process.exitCode = !error ? 0 : isMissingTable(error) ? 2 : 1
}

const sessions = new Map<string, Session>()
const starting = new Set<string>()

const reporter = (teamId: string) => async (patch: NumberPatch) => {
  const at = new Date().toISOString()
  const { error } = await db.from(TABLE).update({ ...patch, seen_at: at, updated_at: at }).eq('team_id', teamId)
  if (error) console.error(`[${teamId.slice(0, 8)}] não gravou o estado: ${error.message}`)
}

/** Guarda a mensagem e atualiza a conversa (mensagem repetida não faz nada) */
async function store(teamId: string, m: StoredMessage) {
  const { error } = await db.rpc('crm_whatsapp_store', {
    p_team: teamId,
    p_jid: m.jid,
    p_name: m.name ?? null,
    p_wa_id: m.waId,
    p_from_me: m.fromMe,
    p_body: m.body,
    p_kind: m.kind,
    p_ts: m.at.toISOString(),
  })
  if (error) {
    if (!isMissingTable(error) && error.code !== 'PGRST202') throw error
    if (!warnedInbox) console.error('Falta a migração 20261026180000_crm_whatsapp_messages.sql: as mensagens não estão sendo guardadas.')
    warnedInbox = true
    return
  }
  // A mensagem já está guardada; a mídia vem depois e não atrasa nem derruba o resto
  if (m.media) await saveMedia(teamId, m).catch((mediaError) => console.error(`[${teamId.slice(0, 8)}] não guardou a mídia: ${mediaError instanceof Error ? mediaError.message : mediaError}`))
}
let warnedInbox = false

// ---------- comandos por WhatsApp (ver comandos.ts) ----------

const handled = new Set<string>()
let warnedCommanders = false
let warnedLid = false

/** Guard-rail: no máximo 600 caracteres por resposta (sem limite de respostas por hora, a pedido do usuário) */
const MAX_REPLY = 600
let warnedClients = false

/**
 * Pergunta de quem está em `crm_whatsapp_commanders`: responde na mesma conversa, pela fila de envio.
 * Só texto recebido agora, de um número da lista; qualquer outro é cliente e passa direto.
 */
async function command(teamId: string, m: StoredMessage) {
  if (m.fromMe || m.kind !== 'text' || !m.body.trim()) return
  if (Date.now() - m.at.getTime() > 2 * 60_000 || handled.has(m.waId)) return
  const [{ data, error }, { data: clients, error: clientsError }] = await Promise.all([
    db.from('crm_whatsapp_commanders').select('phone, name').eq('team_id', teamId),
    db.from('crm_whatsapp_client_contacts').select('phone, account_id, name, topics').eq('team_id', teamId).eq('enabled', true),
  ])
  if (error) {
    if (!warnedCommanders && !isMissingTable(error)) console.error(`Comandos: ${error.message}`)
    if (!warnedCommanders && isMissingTable(error)) console.error('Falta a migração 20261026230000_crm_whatsapp_commanders.sql: os comandos por WhatsApp estão desligados.')
    warnedCommanders = true
    return
  }
  if (clientsError && !isMissingTable(clientsError) && !warnedClients) {
    console.error(`Clientes: ${clientsError.message}`)
    warnedClients = true
  }
  const phone = m.jid.split('@')[0]
  if (m.jid.endsWith('@lid')) {
    // O WhatsApp só deu um id interno, sem o número: não dá para saber quem é
    if (!warnedLid && (data?.length || clients?.length)) console.error('Mensagem de um id interno (@lid) sem número: não dá para conferir se é de quem manda comandos ou de um cliente.')
    warnedLid = true
    return
  }
  const commander = data?.find((c) => samePhone(c.phone as string, phone))
  const isCommander = !!commander
  const client = isCommander ? undefined : clients?.find((c) => samePhone(c.phone as string, phone))
  if (!isCommander && !client) return
  handled.add(m.waId)
  if (handled.size > 500) handled.delete(handled.values().next().value!)
  // Mensagens seguidas da mesma pessoa viram uma resposta só: espera ela parar de escrever
  const key = `${teamId}:${phone.slice(-8)}`
  const who: Who = isCommander
    ? { isCommander: true, contact: { phone, accountId: teamId, name: (commander?.name as string) ?? '', topics: ALL_TOPICS } }
    : { isCommander: false, contact: { phone: client!.phone as string, accountId: client!.account_id as string, name: (client!.name as string) ?? '', topics: (client!.topics as Topic[]) ?? [] } }
  const batch = pending.get(key) ?? { messages: [], first: Date.now(), timer: undefined as NodeJS.Timeout | undefined }
  batch.messages.push(m)
  clearTimeout(batch.timer)
  pending.set(key, batch)
  const wait = Math.max(0, Math.min(BATCH_QUIET, batch.first + BATCH_MAX - Date.now()))
  batch.timer = setTimeout(() => {
    pending.delete(key)
    // Uma resposta por vez por pessoa: se a anterior ainda está sendo feita, esta espera e já a enxerga no histórico
    const turn = (turns.get(key) ?? Promise.resolve()).then(() => respond(teamId, who, batch.messages)).catch((e) => console.error(`[${teamId.slice(0, 8)}] resposta: ${e instanceof Error ? e.message : e}`))
    turns.set(key, turn)
    void turn.finally(() => turns.get(key) === turn && turns.delete(key))
  }, wait)
}

interface Who {
  isCommander: boolean
  contact: ClientContact
}
interface Batch {
  messages: StoredMessage[]
  first: number
  timer: NodeJS.Timeout | undefined
}
/** Espera 3 s de silêncio (no máximo 15 s desde a primeira) antes de responder */
const BATCH_QUIET = 3000
const BATCH_MAX = 15_000
const pending = new Map<string, Batch>()
const turns = new Map<string, Promise<unknown>>()

/** Gráfico como foto com a resposta de legenda: sobe o PNG e põe na fila (o envio é o mesmo dos arquivos da tela). Falhou: o texto sai sozinho. */
async function queueImage(teamId: string, jid: string, caption: string, png: Buffer): Promise<boolean> {
  const name = `grafico-${Date.now()}.png`
  const path = `${teamId}/saida/ia/${name}`
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, png, { contentType: 'image/png', cacheControl: '3600' })
  if (uploadError) return console.error(`[${teamId.slice(0, 8)}] gráfico não subiu: ${uploadError.message}`), false
  const body = `[Foto] ${caption}`
  const { error } = await db.from('crm_whatsapp_messages').insert({ team_id: teamId, chat_jid: jid, from_me: true, body, kind: 'image', status: 'queued', media_path: path, media_mime: 'image/png', media_name: name })
  if (error) return console.error(`[${teamId.slice(0, 8)}] gráfico não entrou na fila: ${error.message}`), false
  await db.from('crm_whatsapp_chats').update({ last_text: body, last_from_me: true, last_at: new Date().toISOString() }).eq('team_id', teamId).eq('jid', jid)
  return true
}

/** Responde a uma ou mais mensagens seguidas de uma só vez */
async function respond(teamId: string, who: Who, messages: StoredMessage[]) {
  const m = messages[0]
  const text = messages.map((x) => x.body.trim()).join('\n')
  // Conversa anterior a este grupo de mensagens, para a IA entender o contexto
  const { data: past } = await db.from('crm_whatsapp_messages').select('from_me, body, kind, ts').eq('team_id', teamId).eq('chat_jid', m.jid).lt('ts', m.at.toISOString()).order('ts', { ascending: false }).limit(15)
  const history = (past ?? []).reverse().filter((p) => p.kind === 'text' && p.body).map((p) => ({ fromMe: p.from_me as boolean, text: p.body as string, at: new Date(p.ts as string) }))
  let reply: string
  let image: Buffer | undefined
  if (who.isCommander) {
    const result = await answerClient(db, who.contact, text, history)
    reply = result.reply.slice(0, MAX_REPLY)
    image = result.image
  } else {
    const result = await answerClient(db, who.contact, text, history)
    reply = result.reply.slice(0, MAX_REPLY)
    image = result.image
    const { error: logError } = await db.from('crm_whatsapp_client_log').insert({ team_id: teamId, account_id: who.contact.accountId, phone: who.contact.phone, question: text.slice(0, 300), topic: result.topic ?? (result.ai ? 'ia' : null), answered: !!result.topic || !!result.ai })
    if (logError && !isMissingTable(logError)) console.error(`[${teamId.slice(0, 8)}] não registrou a pergunta: ${logError.message}`)
  }
  if (image && (await queueImage(teamId, m.jid, reply, image))) return
  const { error: sendError } = await db.rpc('crm_whatsapp_enqueue_reply', { p_team: teamId, p_jid: m.jid, p_text: reply })
  if (sendError) console.error(`[${teamId.slice(0, 8)}] não enfileirou a resposta: ${sendError.message}`)
}

const BUCKET = 'crm-whatsapp'
/** Arquivos maiores que isso ficam só no celular (o bucket aceita até 25 MB) */
const MAX_MEDIA = 20 * 1024 * 1024
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/3gpp': '3gp', 'video/quicktime': 'mov',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm',
  'application/pdf': 'pdf',
}
const safe = (text: string) => text.replace(/[^A-Za-z0-9._-]/g, '_')
let warnedMedia = false

const mediaWarning = (message: string) => {
  if (!warnedMedia) console.error(`Mídias do WhatsApp: ${message}. Falta a migração 20261026220000_crm_whatsapp_media.sql?`)
  warnedMedia = true
}

/** Baixa a mídia da mensagem, guarda no bucket e liga o arquivo à mensagem */
async function saveMedia(teamId: string, m: StoredMessage) {
  const media = m.media
  if (!media || (media.size && media.size > MAX_MEDIA)) return
  const buffer = await media.download()
  if (buffer.length > MAX_MEDIA) return
  const mime = (media.mime ?? 'application/octet-stream').split(';')[0]
  const fromName = media.name?.match(/\.([A-Za-z0-9]{1,6})$/)?.[1]
  const path = `${teamId}/${safe(m.jid)}/${safe(m.waId)}.${EXTENSIONS[mime] ?? fromName ?? 'bin'}`
  const { error } = await db.storage.from(BUCKET).upload(path, buffer, { contentType: mime, upsert: true, cacheControl: '31536000' })
  if (error) return mediaWarning(error.message)
  const { error: linkError } = await db.from('crm_whatsapp_messages').update({ media_path: path, media_mime: mime, media_name: media.name ?? null }).eq('team_id', teamId).eq('wa_id', m.waId)
  if (linkError) mediaWarning(linkError.message)
}

let warnedPhotos = false

/** Foto de perfil das conversas que ainda não têm (e a cada 7 dias): poucas por vez */
async function refreshPhotos() {
  for (const [teamId, session] of sessions) {
    if (!session.open || session.leaving) continue
    const stale = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const { data, error } = await db
      .from('crm_whatsapp_chats')
      .select('jid')
      .eq('team_id', teamId)
      .or(`photo_checked_at.is.null,photo_checked_at.lt.${stale}`)
      .limit(3)
    if (error) {
      if (!warnedPhotos) console.error(`Fotos de perfil: ${error.message}. Falta a migração 20261026220000_crm_whatsapp_media.sql?`)
      warnedPhotos = true
      continue
    }
    for (const row of data ?? []) {
      const jid = row.jid as string
      const patch: Record<string, unknown> = { photo_checked_at: new Date().toISOString() }
      try {
        const url = await session.photoUrl(jid)
        if (url) {
          const response = await fetch(url)
          if (response.ok) {
            const path = `${teamId}/avatars/${safe(jid)}.jpg`
            const { error: uploadError } = await db.storage.from(BUCKET).upload(path, Buffer.from(await response.arrayBuffer()), { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' })
            if (!uploadError) patch.photo_path = path
          }
        }
      } catch (photoError) {
        // Sem conexão agora: tenta de novo na próxima volta
        console.error(`[${teamId.slice(0, 8)}] foto de perfil: ${photoError instanceof Error ? photoError.message : photoError}`)
        continue
      }
      await db.from('crm_whatsapp_chats').update(patch).eq('team_id', teamId).eq('jid', jid)
    }
  }
}

/** Passa a mensagem para a conversa do endereço certo e tira a antiga se ficou vazia */
async function moveChat(teamId: string, from: string, to: string, messageId: string) {
  const { data: old } = await db.from('crm_whatsapp_chats').select('last_text, last_from_me, last_at').eq('team_id', teamId).eq('jid', from).maybeSingle()
  await db
    .from('crm_whatsapp_chats')
    .upsert({ team_id: teamId, jid: to, phone: to.split('@')[0], last_text: old?.last_text ?? '', last_from_me: true, last_at: old?.last_at ?? new Date().toISOString() }, { onConflict: 'team_id,jid', ignoreDuplicates: true })
  await db.from('crm_whatsapp_messages').update({ chat_jid: to }).eq('id', messageId)
  const { count } = await db.from('crm_whatsapp_messages').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('chat_jid', from)
  if (!count) await db.from('crm_whatsapp_chats').delete().eq('team_id', teamId).eq('jid', from)
}

/** Envia o que a equipe escreveu na tela (mensagens em fila) pelos números conectados */
async function flush() {
  for (const [teamId, session] of sessions) {
    if (!session.open || session.leaving) continue
    const { data, error } = await db
      .from('crm_whatsapp_messages')
      .select('id, chat_jid, body, kind, media_path, media_mime, media_name')
      .eq('team_id', teamId)
      .eq('status', 'queued')
      .order('ts')
      .limit(10)
    if (error || !data?.length) continue
    for (const row of data) {
      // Reserva antes de enviar: se o serviço cair no meio, a mensagem não sai duas vezes
      const { data: claimed } = await db.from('crm_whatsapp_messages').update({ status: 'sent' }).eq('id', row.id).eq('status', 'queued').select('id')
      if (!claimed?.length) continue
      try {
        const chatJid = row.chat_jid as string
        const target = await session.resolve(chatJid)
        if (!target) throw new Error('Esse número não tem WhatsApp.')
        // O WhatsApp conhece o número de outro jeito (o 9 do celular): a conversa passa para o endereço certo
        if (target !== chatJid) await moveChat(teamId, chatJid, target, row.id as string)
        let file: OutFile | undefined
        if (row.media_path) {
          const { data: blob, error: downloadError } = await db.storage.from(BUCKET).download(row.media_path as string)
          if (downloadError || !blob) throw new Error('Não achei o arquivo para enviar.')
          file = { buffer: Buffer.from(await blob.arrayBuffer()), mime: (row.media_mime as string) || 'application/octet-stream', name: (row.media_name as string) || undefined, kind: row.kind as OutFile['kind'] }
        }
        // Na legenda não vai o rótulo "[Vídeo]" que a tela mostra
        const caption = file ? (row.body as string).replace(/^\[(Foto|Vídeo|Áudio|Documento)\]\s?/, '') : (row.body as string)
        const waId = await session.send(target, caption, file)
        // Mensagens para várias pessoas em seguida não saem coladas: uma pausa irregular entre elas
        if (data.length > 1 && process.env.WHATSAPP_HUMANIZAR !== '0') await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 5000))
        const { error: setError } = await db.from('crm_whatsapp_messages').update({ wa_id: waId, ts: new Date().toISOString() }).eq('id', row.id)
        // A cópia do próprio envio chegou antes pelo WhatsApp: fica ela
        if (setError) await db.from('crm_whatsapp_messages').delete().eq('id', row.id)
      } catch (sendError) {
        const message = sendError instanceof Error ? sendError.message : String(sendError)
        console.error(`[${teamId.slice(0, 8)}] não enviou: ${message}`)
        await db.from('crm_whatsapp_messages').update({ status: 'failed', error: message }).eq('id', row.id)
      }
    }
  }
}

async function start(teamId: string, logoutOnly: boolean) {
  starting.add(teamId)
  try {
    const auth = await dbAuthState(db, teamId)
    const report = reporter(teamId)
    const session = openSession({
      teamId,
      auth,
      report,
      log: log.child({ team: teamId }),
      logoutOnly,
      onMessage: async (message) => {
        await store(teamId, message)
        // Um comando com defeito não pode derrubar a guarda das mensagens
        await command(teamId, message).catch((commandError) => console.error(`[${teamId.slice(0, 8)}] comando: ${commandError instanceof Error ? commandError.message : commandError}`))
      },
      onEnd: () => {
        if (sessions.get(teamId) === session) sessions.delete(teamId)
      },
    })
    sessions.set(teamId, session)
    // A tela sabe que o serviço viu o pedido
    await report({})
  } finally {
    starting.delete(teamId)
  }
}

let missingTable = false

async function reconcile() {
  const { data, error } = await db.from(TABLE).select('team_id, wanted, status')
  if (error) {
    if (!missingTable) console.error(isMissingTable(error) ? 'Falta a migração 20261026150000_crm_whatsapp.sql no Supabase.' : `Não deu para ler os números: ${error.message}`)
    missingTable = true
    return
  }
  missingTable = false
  for (const row of data ?? []) {
    const teamId = row.team_id as string
    const session = sessions.get(teamId)
    if (starting.has(teamId) || session?.leaving) continue
    if (row.wanted && !session) await start(teamId, false)
    else if (!row.wanted && session) await session.logout()
    // Desconectaram com o serviço desligado: falta tirar o aparelho do celular
    else if (!row.wanted && !session && row.status !== 'disconnected') await start(teamId, true)
  }
}

function serve() {
  // No Mac: não dormir enquanto o serviço roda (o caffeinate sai sozinho quando este processo acaba)
  if (process.platform === 'darwin') spawn('/usr/bin/caffeinate', ['-is', '-w', String(process.pid)], { stdio: 'ignore' }).on('error', () => undefined)

  let busy = false
  setInterval(() => {
    if (busy) return
    busy = true
    reconcile()
      .catch((error) => console.error('Falha ao ler os pedidos:', error))
      .finally(() => {
        busy = false
      })
  }, LOOP)

  let flushing = false
  setInterval(() => {
    if (flushing) return
    flushing = true
    flush()
      .catch((error) => console.error('Falha ao enviar a fila:', error))
      .finally(() => {
        flushing = false
      })
  }, 1500)

  let photos = false
  setInterval(() => {
    if (photos) return
    photos = true
    refreshPhotos()
      .catch((error) => console.error('Falha nas fotos de perfil:', error))
      .finally(() => {
        photos = false
      })
  }, 15_000)

  // Relatórios internos agendados (só para quem manda comandos, ver relatorios.ts)
  let reporting = false
  setInterval(() => {
    if (reporting) return
    reporting = true
    runReports(db, [...sessions.entries()].filter(([, session]) => session.open && !session.leaving).map(([teamId]) => teamId))
      .catch((error) => console.error('Falha nos relatórios:', error))
      .finally(() => {
        reporting = false
      })
  }, 60_000)

  // Sinal de vida na linha de cada número ligado: a tela avisa quando o serviço some
  setInterval(async () => {
    const ids = [...sessions.keys()]
    if (!ids.length) return
    const at = new Date().toISOString()
    const { error } = await db.from(TABLE).update({ seen_at: at }).in('team_id', ids)
    if (error) console.error('Não gravou o sinal de vida:', error.message)
  }, BEAT)

  const stop = () => {
    for (const session of sessions.values()) session.close()
    setTimeout(() => process.exit(0), 300)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  process.on('unhandledRejection', (error) => console.error('Erro sem tratamento:', error))

  console.log(`${new Date().toLocaleString('pt-BR')}  Serviço do WhatsApp ligado (${new URL(url!).host}). Esperando pedidos de conexão em CRM › WhatsApp.`)
}

if (process.argv.includes('--check')) await check()
else serve()
