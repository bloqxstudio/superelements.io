import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { mediaUrl, setMediaTeam, uploadFiles } from '@/features/cerebro/data'
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
}

type Row = { id: string; team_id: string; url: string; platform: RefPlatform; kind: RefKind; title: string; notes: string; tags: string[]; starred: boolean; media_path: string | null; created_at: string }

const toRef = (r: Row): Reference => ({
  id: r.id, teamId: r.team_id, url: r.url, platform: r.platform, kind: r.kind, title: r.title, notes: r.notes, tags: r.tags ?? [],
  starred: r.starred, mediaPath: r.media_path ?? undefined, createdAt: Date.parse(r.created_at),
})

const fail = (error: { message: string; code?: string }): never => {
  if (error.code === '23505') throw new Error('Esta referência já está salva nesta conta.')
  if (error.code === '42P01' || error.code === 'PGRST205') throw new Error('Falta aplicar a migração das referências.')
  throw new Error(error.message)
}

export async function listReferences(teamId: string): Promise<Reference[]> {
  const { data, error } = await db.from('crm_references').select('*').eq('team_id', teamId).order('starred', { ascending: false }).order('created_at', { ascending: false }).limit(500)
  if (error) fail(error)
  return ((data ?? []) as Row[]).map(toRef)
}

export interface ReferenceDraft { url: string; platform: RefPlatform; kind: RefKind; title: string; notes: string; tags: string[]; starred: boolean; mediaPath?: string | null }

const columns = (d: Partial<ReferenceDraft>) => ({
  ...(d.url !== undefined && { url: d.url }), ...(d.platform !== undefined && { platform: d.platform }), ...(d.kind !== undefined && { kind: d.kind }),
  ...(d.title !== undefined && { title: d.title.trim().slice(0, 160) }), ...(d.notes !== undefined && { notes: d.notes.trim().slice(0, 2000) }),
  ...(d.tags !== undefined && { tags: d.tags }), ...(d.starred !== undefined && { starred: d.starred }), ...(d.mediaPath !== undefined && { media_path: d.mediaPath }),
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
  setMediaTeam(teamId)
  return mediaUrl(path)
}

/** As melhores (com estrela) para o contexto da IA: só o que precisa, sem a captura. */
export async function starredReferences(teamId: string) {
  const { data } = await db.from('crm_references').select('title, kind, url, notes, tags').eq('team_id', teamId).eq('starred', true).order('updated_at', { ascending: false }).limit(8)
  return (data ?? []) as { title: string; kind: RefKind; url: string; notes: string; tags: string[] }[]
}
