import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

/**
 * Sugestões de melhoria para o time de produto (migração 20261105160000). Quem usa envia pela
 * Iara (ou pela tela); o time de produto (admin da plataforma) lê todas em /sugestoes, como uma
 * planilha, muda status, prioridade e nota, e exporta CSV.
 */

const db = supabase as unknown as SupabaseClient

export type SuggestionKind = 'melhoria' | 'problema' | 'ideia'
export type SuggestionStatus = 'nova' | 'avaliando' | 'planejada' | 'feita' | 'descartada'
export type SuggestionPriority = 'baixa' | 'media' | 'alta'

export const KIND_LABEL: Record<SuggestionKind, string> = { melhoria: 'Melhoria', problema: 'Problema', ideia: 'Ideia nova' }
export const STATUS_LABEL: Record<SuggestionStatus, string> = { nova: 'Nova', avaliando: 'Avaliando', planejada: 'Planejada', feita: 'Feita', descartada: 'Descartada' }
export const PRIORITY_LABEL: Record<SuggestionPriority, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }

export interface Suggestion {
  id: string
  createdAt: number
  userName: string
  teamName: string
  screenPath: string
  screenTitle: string
  area: string
  kind: SuggestionKind
  title: string
  description: string
  impact: string
  original: string
  via: 'iara' | 'tela'
  status: SuggestionStatus
  priority?: SuggestionPriority
  note: string
}

type Row = {
  id: string
  created_at: string
  user_name: string
  team_name: string
  screen_path: string
  screen_title: string
  area: string
  kind: SuggestionKind
  title: string
  description: string
  impact: string
  original: string
  via: 'iara' | 'tela'
  status: SuggestionStatus
  priority: SuggestionPriority | null
  product_note: string
}

const toSuggestion = (r: Row): Suggestion => ({
  id: r.id,
  createdAt: Date.parse(r.created_at),
  userName: r.user_name,
  teamName: r.team_name,
  screenPath: r.screen_path,
  screenTitle: r.screen_title,
  area: r.area,
  kind: r.kind,
  title: r.title,
  description: r.description,
  impact: r.impact,
  original: r.original,
  via: r.via,
  status: r.status,
  priority: r.priority ?? undefined,
  note: r.product_note,
})

const fail = (error: { code?: string; message: string }): never => {
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202') throw new Error('Falta aplicar a migração 20261105160000_product_suggestions.sql.')
  if (error.message.includes('limite_sugestoes')) throw new Error('Muitas sugestões hoje: tente amanhã.')
  if (error.message.includes('sem_acesso')) throw new Error('Só o time de produto muda o status.')
  throw new Error(`Não consegui (${error.message}).`)
}

export interface SuggestionDraft {
  title: string
  description: string
  area: string
  kind: SuggestionKind
  impact: string
  original: string
  teamId?: string
  screenPath: string
  screenTitle: string
  via: 'iara' | 'tela'
}

export async function createSuggestion(draft: SuggestionDraft): Promise<Suggestion> {
  const { data, error } = await db.rpc('product_suggestion_create', { p_data: draft })
  if (error) fail(error)
  return toSuggestion((Array.isArray(data) ? data[0] : data) as Row)
}

/** O time de produto vê todas; os outros, as próprias (RLS). */
export async function listSuggestions(): Promise<Suggestion[]> {
  const { data, error } = await db.from('product_suggestions').select('*').order('created_at', { ascending: false }).limit(2000)
  if (error) fail(error)
  return ((data ?? []) as Row[]).map(toSuggestion)
}

export async function updateSuggestion(id: string, patch: { status?: SuggestionStatus; priority?: SuggestionPriority | ''; note?: string }): Promise<Suggestion> {
  const { data, error } = await db.rpc('product_suggestion_update', { p_id: id, p_status: patch.status ?? null, p_priority: patch.priority ?? null, p_note: patch.note ?? null })
  if (error) fail(error)
  return toSuggestion((Array.isArray(data) ? data[0] : data) as Row)
}

const cell = (v: string) => `"${v.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`

/** CSV com separador ";" e BOM: abre certo no Excel em português e no Google Planilhas. */
export function suggestionsCsv(list: Suggestion[]): string {
  const head = ['Data', 'Tipo', 'Título', 'Descrição', 'Impacto', 'Área', 'Tela', 'Conta', 'Pessoa', 'Status', 'Prioridade', 'Nota do produto', 'O que a pessoa disse', 'Via']
  const rows = list.map((s) => [
    new Date(s.createdAt).toLocaleString('pt-BR'),
    KIND_LABEL[s.kind],
    s.title,
    s.description,
    s.impact,
    s.area,
    s.screenTitle || s.screenPath,
    s.teamName,
    s.userName,
    STATUS_LABEL[s.status],
    s.priority ? PRIORITY_LABEL[s.priority] : '',
    s.note,
    s.original,
    s.via === 'iara' ? 'Iara' : 'Tela',
  ])
  return `﻿${[head, ...rows].map((r) => r.map(cell).join(';')).join('\n')}`
}
