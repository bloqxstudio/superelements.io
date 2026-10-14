import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import type { ActivityKind } from './types'

/**
 * Comentários do cartão do funil: anotações da linha do tempo do cliente
 * presas à oportunidade (`crm_activities.opportunity_id`), então também
 * aparecem na ficha do cliente. As regras são as da linha do tempo: a equipe
 * lê e comenta, cada um edita o seu, e apaga o seu (quem gerencia, qualquer um).
 */

/** Os registros escritos por alguém (etapa e entrada no funil o banco grava sozinho). */
const WRITTEN: ActivityKind[] = ['note', 'call', 'whatsapp', 'email', 'meeting']

export interface OpportunityComment {
  id: string
  opportunityId: string
  clientId: string
  kind: ActivityKind
  body: string
  createdBy?: string
  createdAt: number
  /** Quando o autor editou pela última vez. */
  editedAt?: number
}

interface Row {
  id: string
  client_id: string
  opportunity_id: string | null
  kind: string
  body: string
  data: Json | null
  created_by: string | null
  created_at: string
}

const COLUMNS = 'id, client_id, opportunity_id, kind, body, data, created_by, created_at'
const PAGE = 1000

const toComment = (row: Row): OpportunityComment | null => {
  if (!row.opportunity_id || !WRITTEN.includes(row.kind as ActivityKind)) return null
  const edited = (row.data as { edited?: string } | null)?.edited
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    clientId: row.client_id,
    kind: row.kind as ActivityKind,
    body: row.body,
    createdBy: row.created_by ?? undefined,
    createdAt: Date.parse(row.created_at),
    editedAt: edited ? Date.parse(edited) : undefined,
  }
}

/** Os comentários de todos os cartões da equipe, do mais antigo ao mais novo. */
async function listTeamComments(teamId: string): Promise<OpportunityComment[]> {
  const all: OpportunityComment[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('crm_activities')
      .select(COLUMNS)
      .eq('team_id', teamId)
      .not('opportunity_id', 'is', null)
      .in('kind', WRITTEN)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    for (const row of (data ?? []) as Row[]) {
      const comment = toComment(row)
      if (comment) all.push(comment)
    }
    if ((data?.length ?? 0) < PAGE) return all
  }
}

export async function addComment(opportunity: { id: string; clientId: string }, body: string): Promise<OpportunityComment> {
  const { data, error } = await supabase
    .from('crm_activities')
    .insert({ client_id: opportunity.clientId, opportunity_id: opportunity.id, kind: 'note', body: body.trim() } as never)
    .select(COLUMNS)
    .single()
  if (error) throw error
  return toComment(data as Row)!
}

export async function editComment(id: string, body: string): Promise<OpportunityComment> {
  const { data, error } = await supabase
    .from('crm_activities')
    .update({ body: body.trim(), data: { edited: new Date().toISOString() } })
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Só quem escreveu edita o comentário.')
  return toComment(data as Row)!
}

export async function deleteComment(id: string) {
  const { data, error } = await supabase.from('crm_activities').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Só quem escreveu (ou um gestor) apaga o comentário.')
}

const byTime = (a: OpportunityComment, b: OpportunityComment) => a.createdAt - b.createdAt

/**
 * Os comentários da equipe, ao vivo: o que alguém escreve, edita ou apaga
 * num cartão chega pela Realtime. `put` e `drop` aplicam na hora o que esta
 * tela mesma gravou (a Realtime traz de novo e não duplica).
 */
export function useComments(teamId: string | undefined) {
  const [comments, setComments] = useState<OpportunityComment[] | null>(null)

  const put = useCallback((comment: OpportunityComment) => {
    setComments((prev) => [...(prev ?? []).filter((c) => c.id !== comment.id), comment].sort(byTime))
  }, [])

  const drop = useCallback((id: string) => {
    setComments((prev) => (prev?.some((c) => c.id === id) ? prev.filter((c) => c.id !== id) : prev))
  }, [])

  useEffect(() => {
    if (!teamId) return
    let alive = true
    setComments(null)
    const read = () =>
      listTeamComments(teamId)
        .then((list) => alive && setComments(list))
        .catch((error) => {
          console.error('[crm] falha ao ler os comentários', error)
          if (alive) setComments((prev) => prev ?? [])
        })
    void read()

    // Mudou: entra, troca ou sai (a oportunidade apagada solta o comentário, que some do quadro)
    const change = (row: Row) => {
      const comment = toComment(row)
      if (comment) put(comment)
      else drop(row.id)
    }
    let subscribed = false
    const channel = supabase
      .channel(`crm-comentarios-${teamId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_activities', filter: `team_id=eq.${teamId}` }, (payload) => change(payload.new as Row))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_activities', filter: `team_id=eq.${teamId}` }, (payload) => change(payload.new as Row))
      // Exclusão não tem filtro na Realtime: chega só o id
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'crm_activities' }, (payload) => {
        const id = String((payload.old as { id?: string }).id ?? '')
        if (id) drop(id)
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        // Voltou de uma queda: o que chegou enquanto isso
        if (subscribed) void read()
        subscribed = true
      })

    return () => {
      alive = false
      void supabase.removeChannel(channel)
    }
  }, [teamId, put, drop])

  return { comments, put, drop }
}
