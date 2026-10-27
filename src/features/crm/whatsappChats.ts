import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

/**
 * A caixa de entrada do WhatsApp da equipe (CRM › WhatsApp): conversas e
 * mensagens que o serviço `services/whatsapp` guarda em
 * `crm_whatsapp_chats` e `crm_whatsapp_messages`. A tela lê as tabelas (ao
 * vivo pela Realtime) e escreve só pelas funções do banco: `crm_whatsapp_send`
 * põe a mensagem na fila e o serviço envia em até 2 s.
 */

// As tabelas ainda não estão nos tipos gerados do Supabase
const db = supabase as unknown as SupabaseClient

export interface WaChat {
  jid: string
  phone?: string
  name?: string
  lastText: string
  lastFromMe: boolean
  lastAt: number
  unread: number
  /** A foto de perfil guardada pelo serviço (caminho no bucket) */
  photoPath?: string
}

export interface WaMessage {
  id: string
  chatJid: string
  fromMe: boolean
  body: string
  kind: string
  status: 'queued' | 'sent' | 'failed'
  error?: string
  at: number
  /** O arquivo da mensagem (foto, vídeo, áudio, documento) guardado pelo serviço */
  mediaPath?: string
  mediaMime?: string
  mediaName?: string
}

interface ChatRow {
  jid: string
  phone: string | null
  name: string | null
  last_text: string | null
  last_from_me: boolean
  last_at: string
  unread: number
  photo_path?: string | null
}

interface MessageRow {
  id: string
  chat_jid: string
  from_me: boolean
  body: string
  kind: string
  status: 'queued' | 'sent' | 'failed'
  error: string | null
  ts: string
  media_path?: string | null
  media_mime?: string | null
  media_name?: string | null
}

const toChat = (r: ChatRow): WaChat => ({
  jid: r.jid,
  phone: r.phone ?? undefined,
  name: r.name ?? undefined,
  lastText: r.last_text ?? '',
  lastFromMe: r.last_from_me,
  lastAt: Date.parse(r.last_at),
  unread: r.unread,
  photoPath: r.photo_path ?? undefined,
})

const toMessage = (r: MessageRow): WaMessage => ({
  id: r.id,
  chatJid: r.chat_jid,
  fromMe: r.from_me,
  body: r.body,
  kind: r.kind,
  status: r.status,
  error: r.error ?? undefined,
  at: Date.parse(r.ts),
  mediaPath: r.media_path ?? undefined,
  mediaMime: r.media_mime ?? undefined,
  mediaName: r.media_name ?? undefined,
})

/** `no_tables` quando falta a migração das mensagens */
export class InboxError extends Error {
  constructor(
    message: string,
    readonly code = 'error'
  ) {
    super(message)
  }
}

const noTables = (error: { code?: string }) => error.code === '42P01' || error.code === 'PGRST205' || error.code === '42883' || error.code === 'PGRST202'
const fail = (error: { code?: string; message: string }) =>
  noTables(error) ? new InboxError('Aplique a migração 20261026180000_crm_whatsapp_messages.sql no Supabase.', 'no_tables') : new InboxError(error.message)

export async function loadChats(teamId: string): Promise<WaChat[]> {
  const { data, error } = await db.from('crm_whatsapp_chats').select('*').eq('team_id', teamId).order('last_at', { ascending: false }).limit(300)
  if (error) throw fail(error)
  return (data as ChatRow[]).map(toChat)
}

export async function loadMessages(teamId: string, jid: string): Promise<WaMessage[]> {
  const { data, error } = await db.from('crm_whatsapp_messages').select('*').eq('team_id', teamId).eq('chat_jid', jid).order('ts', { ascending: false }).limit(200)
  if (error) throw fail(error)
  return (data as MessageRow[]).map(toMessage).reverse()
}

export async function sendMessage(teamId: string, jid: string, text: string) {
  const { error } = await db.rpc('crm_whatsapp_send', { p_team: teamId, p_jid: jid, p_text: text })
  if (error) throw fail(error)
}

/** Maior arquivo que o envio aceita (o limite do bucket) */
export const MAX_SEND_BYTES = 25 * 1024 * 1024

const kindOf = (mime: string): 'image' | 'video' | 'audio' | 'document' =>
  mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : 'document'

/** Sobe o arquivo e põe na fila: o serviço envia como vídeo, foto, áudio ou documento, com a legenda. */
export async function sendFile(teamId: string, jid: string, file: File, caption: string) {
  if (file.size > MAX_SEND_BYTES) throw new InboxError('O arquivo passa de 25 MB. Comprima o vídeo ou mande um link.')
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'bin'
  const path = `${teamId}/saida/${crypto.randomUUID()}.${ext}`
  const mime = file.type || 'application/octet-stream'
  const { error: upError } = await db.storage.from('crm-whatsapp').upload(path, file, { contentType: mime, cacheControl: '31536000' })
  if (upError) throw new InboxError(/policy|row-level|not found/i.test(upError.message) ? 'Aplique a migração 20261027120000_crm_whatsapp_send_media.sql no Supabase.' : upError.message)
  const { error } = await db.rpc('crm_whatsapp_send_media', { p_team: teamId, p_jid: jid, p_caption: caption, p_path: path, p_mime: mime, p_name: file.name, p_kind: kindOf(mime) })
  if (error) throw fail(error)
}

/** Começa uma conversa com um número novo (DDD + número) e devolve o endereço da conversa. */
export async function startChat(teamId: string, phone: string, text: string): Promise<string> {
  const { data, error } = await db.rpc('crm_whatsapp_new_chat', { p_team: teamId, p_phone: phone, p_text: text })
  if (error) throw error.code === '22023' ? new InboxError(error.message) : fail(error)
  return data as string
}

export async function markRead(teamId: string, jid: string) {
  const { error } = await db.rpc('crm_whatsapp_read', { p_team: teamId, p_jid: jid })
  if (error) throw fail(error)
}

/** Quem é a conversa: o nome do perfil ou o número. */
export function chatTitle(chat: Pick<WaChat, 'name' | 'phone' | 'jid'>) {
  return chat.name || (chat.jid.endsWith('@lid') ? 'Contato' : chat.phone ? `+${chat.phone}` : chat.jid)
}

/** Mudou algo nas conversas ou nas mensagens da equipe: relê. */
export function useInboxFeed(teamId: string | undefined, onChange: () => void) {
  const latest = useRef(onChange)
  latest.current = onChange

  useEffect(() => {
    if (!teamId) return
    const channel = db
      .channel(`crm-whatsapp-inbox-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_whatsapp_chats', filter: `team_id=eq.${teamId}` }, () => latest.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_whatsapp_messages', filter: `team_id=eq.${teamId}` }, () => latest.current())
      .subscribe()
    return () => {
      void db.removeChannel(channel)
    }
  }, [teamId])
}

const MEDIA_BUCKET = 'crm-whatsapp'
const SIGNED_FOR = 3600
const signed = new Map<string, { url: string; until: number }>()
const signing = new Map<string, Promise<string | undefined>>()

/** Link temporário (1 h) de um arquivo do bucket do WhatsApp; guardado por 50 min para não pedir de novo. */
async function signedUrl(path: string): Promise<string | undefined> {
  const hit = signed.get(path)
  if (hit && hit.until > Date.now()) return hit.url
  const pending = signing.get(path)
  if (pending) return pending
  const request = supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_FOR)
    .then(({ data }) => {
      if (data?.signedUrl) signed.set(path, { url: data.signedUrl, until: Date.now() + (SIGNED_FOR - 600) * 1000 })
      return data?.signedUrl
    })
    .finally(() => signing.delete(path))
  signing.set(path, request)
  return request
}

/** O link de um arquivo guardado (foto de perfil ou mídia); vazio enquanto carrega ou se não existir. */
export function useMediaUrl(path: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => (path ? signed.get(path)?.url : undefined))
  useEffect(() => {
    if (!path) {
      setUrl(undefined)
      return
    }
    let alive = true
    void signedUrl(path).then((value) => alive && setUrl(value))
    return () => {
      alive = false
    }
  }, [path])
  return url
}
