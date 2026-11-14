import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { mediaUrl, uploadFiles } from '@/features/cerebro/data'
import type { RefKind, RefPlatform } from './rules'

/**
 * Referências da conta (`crm_references`, migração 20261109160000). A captura que a pessoa sobe vai
 * para o Cérebro da conta, pasta `referencias/` (aparece também na tela do Cérebro), com link de 7 dias
 * guardado neste navegador (regra de egress).
 */

const db = supabase as unknown as SupabaseClient

export interface Reference {
  id: string
  teamId: string
  url: string
  platform: RefPlatform
  kind: RefKind
  title: string
  notes: string
  tags: string[]
  starred: boolean
  mediaPath?: string
  createdAt: number
  /** Lido pelo Mac num grupo do Instagram (`services/referencias`). */
  auto: boolean
  /** A equipe já olhou (as que chegam do grupo começam como "Nova"). */
  reviewed: boolean
  author?: string
  caption?: string
  frames: string[]
  sourceId?: string
  /** O engajamento que a página do post mostrava quando o Mac leu (metricsAt). */
  likes?: number
  comments?: number
  views?: number
  metricsAt?: number
  /** A posição no grupo: maior = mandado mais recentemente. */
  groupOrder?: number
}

type Row = { id: string; team_id: string; url: string; platform: RefPlatform; kind: RefKind; title: string; notes: string; tags: string[]; starred: boolean; media_path: string | null; created_at: string; auto?: boolean; reviewed?: boolean; author?: string | null; caption?: string | null; frames?: string[] | null; source_id?: string | null; likes?: number | null; comments?: number | null; views?: number | null; metrics_at?: string | null; group_order?: number | null }

const toRef = (r: Row): Reference => ({
  id: r.id, teamId: r.team_id, url: r.url, platform: r.platform, kind: r.kind, title: r.title, notes: r.notes, tags: r.tags ?? [],
  starred: r.starred, mediaPath: r.media_path ?? undefined, createdAt: Date.parse(r.created_at),
  auto: !!r.auto, reviewed: r.reviewed !== false, author: r.author ?? undefined, caption: r.caption ?? undefined, frames: r.frames ?? [], sourceId: r.source_id ?? undefined,
  likes: r.likes ?? undefined, comments: r.comments ?? undefined, views: r.views ?? undefined, metricsAt: r.metrics_at ? Date.parse(r.metrics_at) : undefined,
  groupOrder: r.group_order != null ? Number(r.group_order) : undefined,
})

/**
 * A ordem da tela: a do grupo (o mais recente em cima) e, para as salvas à mão, a data em que foram salvas.
 * As duas escalas são milissegundos, então se misturam bem.
 */
export const byRecent = (a: Reference, b: Reference) => (b.groupOrder ?? b.createdAt) - (a.groupOrder ?? a.createdAt)

const fail = (error: { message: string; code?: string }): never => {
  if (error.code === '23505') throw new Error('Esta referência já está salva nesta conta.')
  if (error.code === '42P01' || error.code === 'PGRST205') throw new Error('Falta aplicar a migração das referências.')
  throw new Error(error.message)
}

export async function listReferences(teamId: string): Promise<Reference[]> {
  const { data, error } = await db.from('crm_references').select('*').eq('team_id', teamId).order('created_at', { ascending: false }).limit(500)
  if (error) fail(error)
  return ((data ?? []) as Row[]).map(toRef).sort(byRecent)
}

export interface ReferenceDraft { url: string; platform: RefPlatform; kind: RefKind; title: string; notes: string; tags: string[]; starred: boolean; mediaPath?: string | null; reviewed?: boolean }

const columns = (d: Partial<ReferenceDraft>) => ({
  ...(d.url !== undefined && { url: d.url }), ...(d.platform !== undefined && { platform: d.platform }), ...(d.kind !== undefined && { kind: d.kind }),
  ...(d.title !== undefined && { title: d.title.trim().slice(0, 160) }), ...(d.notes !== undefined && { notes: d.notes.trim().slice(0, 2000) }),
  ...(d.tags !== undefined && { tags: d.tags }), ...(d.starred !== undefined && { starred: d.starred }), ...(d.mediaPath !== undefined && { media_path: d.mediaPath }),
  ...(d.reviewed !== undefined && { reviewed: d.reviewed }),
})

export async function createReference(teamId: string, draft: ReferenceDraft): Promise<Reference> {
  const { data, error } = await db.from('crm_references').insert({ team_id: teamId, ...columns(draft) }).select('*').single()
  if (error) fail(error)
  return toRef(data as Row)
}

export async function updateReference(id: string, patch: Partial<ReferenceDraft>): Promise<Reference> {
  const { data, error } = await db.from('crm_references').update(columns(patch)).eq('id', id).select('*').single()
  if (error) fail(error)
  return toRef(data as Row)
}

export async function deleteReference(id: string): Promise<void> {
  const { error } = await db.from('crm_references').delete().eq('id', id)
  if (error) fail(error)
}

/** Sobe a captura para o Cérebro da conta (`referencias/`). Devolve o caminho. */
export async function uploadReferenceShot(teamId: string, file: File): Promise<string> {
  const [path] = await uploadFiles(teamId, 'referencias', [file])
  return path
}

/** O endereço da captura (link de 7 dias guardado neste navegador). */
export function referenceShotUrl(teamId: string, path: string): Promise<string> {
  return mediaUrl(teamId, path)
}

/** As melhores (com estrela) para o contexto da IA: só o que precisa, sem a captura. */
export async function starredReferences(teamId: string) {
  const { data } = await db.from('crm_references').select('title, kind, url, notes, tags, likes, comments, author').eq('team_id', teamId).eq('starred', true).order('updated_at', { ascending: false }).limit(8)
  return (data ?? []) as { title: string; kind: RefKind; url: string; notes: string; tags: string[]; likes: number | null; comments: number | null; author: string | null }[]
}

// ---------- grupos do Instagram (lidos pelo Mac, services/referencias) ----------

export interface ReferenceSource {
  id: string
  name: string
  threadUrl: string
  enabled: boolean
  everyMinutes: number
  runRequestedAt?: number
  lastRunAt?: number
  lastFound?: number
  lastError?: string
  /** O andamento do "Importar do grupo" (migração 20261109200000), escrito pelo Mac. */
  runLimit?: number
  runStage?: 'lendo' | 'importando' | 'pronto' | 'erro'
  runStartedAt?: number
  runTotal?: number
  runDone?: number
  runNote?: string
}

type SourceRow = { id: string; name: string; thread_url: string; enabled: boolean; every_minutes: number; run_requested_at: string | null; last_run_at: string | null; last_found: number | null; last_error: string | null; run_limit?: number | null; run_stage?: ReferenceSource['runStage'] | null; run_started_at?: string | null; run_total?: number | null; run_done?: number | null; run_note?: string | null }
const toSource = (r: SourceRow): ReferenceSource => ({
  id: r.id, name: r.name, threadUrl: r.thread_url, enabled: r.enabled, everyMinutes: r.every_minutes,
  runRequestedAt: r.run_requested_at ? Date.parse(r.run_requested_at) : undefined, lastRunAt: r.last_run_at ? Date.parse(r.last_run_at) : undefined,
  lastFound: r.last_found ?? undefined, lastError: r.last_error ?? undefined,
  runLimit: r.run_limit ?? undefined, runStage: r.run_stage ?? undefined, runStartedAt: r.run_started_at ? Date.parse(r.run_started_at) : undefined,
  runTotal: r.run_total ?? undefined, runDone: r.run_done ?? undefined, runNote: r.run_note ?? undefined,
})

/** Um grupo só (o andamento da importação, conferido de poucos em poucos segundos com a janela aberta). */
export async function getSource(id: string): Promise<ReferenceSource | undefined> {
  const { data } = await db.from('crm_reference_sources').select('*').eq('id', id).maybeSingle()
  return data ? toSource(data as SourceRow) : undefined
}

/** As referências que um grupo trouxe desde um momento (o resumo do fim da importação). */
export async function referencesSince(teamId: string, sourceId: string, since: number): Promise<Reference[]> {
  const { data } = await db.from('crm_references').select('*').eq('team_id', teamId).eq('source_id', sourceId).gte('created_at', new Date(since).toISOString()).order('created_at', { ascending: false }).limit(60)
  return ((data ?? []) as Row[]).map(toRef).sort(byRecent)
}

export async function listSources(teamId: string): Promise<ReferenceSource[]> {
  const { data, error } = await db.from('crm_reference_sources').select('*').eq('team_id', teamId).order('created_at')
  if (error) fail(error)
  return ((data ?? []) as SourceRow[]).map(toSource)
}

export async function createSource(teamId: string, name: string, threadUrl: string): Promise<ReferenceSource> {
  const { data, error } = await db.from('crm_reference_sources').insert({ team_id: teamId, name: name.trim().slice(0, 80), thread_url: threadUrl, run_requested_at: new Date().toISOString() }).select('*').single()
  if (error) {
    if (error.code === '23505') throw new Error('Este grupo já está cadastrado nesta conta.')
    fail(error)
  }
  return toSource(data as SourceRow)
}

export async function updateSource(id: string, patch: { enabled?: boolean; everyMinutes?: number; requestRun?: boolean; runLimit?: number | null; name?: string }): Promise<ReferenceSource> {
  const { data, error } = await db.from('crm_reference_sources').update({
    ...(patch.enabled !== undefined && { enabled: patch.enabled }),
    ...(patch.everyMinutes !== undefined && { every_minutes: patch.everyMinutes }),
    ...(patch.name !== undefined && { name: patch.name.trim().slice(0, 80) }),
    ...(patch.requestRun && { run_requested_at: new Date().toISOString(), run_limit: patch.runLimit ?? null, run_stage: null, run_total: null, run_done: null, run_note: null }),
  }).eq('id', id).select('*').single()
  if (error) fail(error)
  return toSource(data as SourceRow)
}

export async function deleteSource(id: string): Promise<void> {
  const { error } = await db.from('crm_reference_sources').delete().eq('id', id)
  if (error) fail(error)
}
