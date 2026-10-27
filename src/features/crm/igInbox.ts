import { useEffect, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { call, NoTablesError } from './instagram'

/**
 * A caixa de entrada do Instagram da equipe (CRM › Instagram › Caixa): os
 * comentários dos posts recentes e as conversas do direct. A função
 * `instagram` lê da Meta (`inbox_sync`) e grava em `crm_instagram_comments`,
 * `_threads` e `_dms`; a tela lê as tabelas (ao vivo pela Realtime) e
 * responde pela função. Marcar como resolvido/lido passa por
 * `crm_instagram_inbox_mark`.
 */

// As tabelas ainda não estão nos tipos gerados do Supabase
const db = supabase as unknown as SupabaseClient

export interface InboxComment {
  id: string
  mediaId: string
  parentId?: string
  username?: string
  fromId?: string
  text: string
  at: number
  likes: number
  hidden: boolean
  own: boolean
  replied: boolean
  handled: boolean
  handledBy?: string
}

export interface InboxThread {
  participantId: string
  username?: string
  name?: string
  lastText: string
  lastFromMe: boolean
  lastAt: number
  unread: number
}

export interface InboxDm {
  mid: string
  participantId: string
  fromMe: boolean
  text: string
  attachment?: string
  at: number
}

interface CommentRow {
  comment_id: string
  media_id: string
  parent_id: string | null
  username: string | null
  from_id: string | null
  body: string
  ts: string
  like_count: number
  hidden: boolean
  own: boolean
  replied: boolean
  handled: boolean
  handled_by: string | null
}

interface ThreadRow {
  participant_id: string
  username: string | null
  name: string | null
  last_text: string | null
  last_from_me: boolean
  last_at: string
  unread: number
}

interface DmRow {
  mid: string
  participant_id: string
  from_me: boolean
  body: string
  attachment: string | null
  ts: string
}

const toComment = (r: CommentRow): InboxComment => ({
  id: r.comment_id,
  mediaId: r.media_id,
  parentId: r.parent_id ?? undefined,
  username: r.username ?? undefined,
  fromId: r.from_id ?? undefined,
  text: r.body,
  at: Date.parse(r.ts),
  likes: r.like_count,
  hidden: r.hidden,
  own: r.own,
  replied: r.replied,
  handled: r.handled,
  handledBy: r.handled_by ?? undefined,
})

const toThread = (r: ThreadRow): InboxThread => ({
  participantId: r.participant_id,
  username: r.username ?? undefined,
  name: r.name ?? undefined,
  lastText: r.last_text ?? '',
  lastFromMe: r.last_from_me,
  lastAt: Date.parse(r.last_at),
  unread: r.unread,
})

const toDm = (r: DmRow): InboxDm => ({ mid: r.mid, participantId: r.participant_id, fromMe: r.from_me, text: r.body, attachment: r.attachment ?? undefined, at: Date.parse(r.ts) })

const missing = (error: { code?: string }) => error.code === '42P01' || error.code === 'PGRST205'

export async function loadComments(accountId: string, limit = 400): Promise<InboxComment[]> {
  const { data, error } = await db.from('crm_instagram_comments').select('*').eq('account_id', accountId).order('ts', { ascending: false }).limit(limit)
  if (error) throw missing(error) ? new NoTablesError('sem tabelas') : error
  return ((data ?? []) as CommentRow[]).map(toComment)
}

export async function loadThreads(accountId: string): Promise<InboxThread[]> {
  const { data, error } = await db.from('crm_instagram_threads').select('*').eq('account_id', accountId).order('last_at', { ascending: false }).limit(200)
  if (error) throw missing(error) ? new NoTablesError('sem tabelas') : error
  return ((data ?? []) as ThreadRow[]).map(toThread)
}

export async function loadDms(accountId: string, participantId: string): Promise<InboxDm[]> {
  const { data, error } = await db.from('crm_instagram_dms').select('*').eq('account_id', accountId).eq('participant_id', participantId).order('ts', { ascending: true }).limit(300)
  if (error) throw error
  return ((data ?? []) as DmRow[]).map(toDm)
}

/** Lê a Meta e grava na caixa; `missing` diz o que ela recusou (ex.: mensagens sem a permissão nova). */
export const syncInbox = (accountId: string) => call<{ comments: number; messages: number; missing: string[] }>('inbox_sync', { accountId })

export const sendDm = (accountId: string, participantId: string, text: string) => call<{ message_id?: string }>('dm_send', { accountId, participantId, text })

/** Responde por DM a quem comentou (uma só, até 7 dias depois do comentário). */
export const privateReply = (accountId: string, commentId: string, text: string) => call<{ message_id?: string }>('comment_dm', { accountId, commentId, text })

export async function markInbox(teamId: string, kind: 'comment' | 'thread', accountId: string, id: string, done = true) {
  const { error } = await db.rpc('crm_instagram_inbox_mark', { p_team: teamId, p_kind: kind, p_account: accountId, p_id: id, p_done: done })
  if (error) throw new Error(error.message)
}

/** Comentários em aberto: de outras pessoas, sem resposta nossa e sem resolver. */
export const isOpenComment = (c: InboxComment) => !c.own && !c.handled && !c.replied && !c.parentId

/** Avisa quando chega comentário, conversa ou mensagem da conta. */
export function useInboxFeed(accountId: string | undefined, onChange: () => void) {
  const latest = useRef(onChange)
  latest.current = onChange
  useEffect(() => {
    if (!accountId) return
    const channel = db.channel(`crm-ig-inbox-${accountId}`)
    for (const table of ['crm_instagram_comments', 'crm_instagram_threads', 'crm_instagram_dms']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `account_id=eq.${accountId}` }, () => latest.current())
    }
    channel.subscribe()
    return () => {
      void db.removeChannel(channel)
    }
  }, [accountId])
}
