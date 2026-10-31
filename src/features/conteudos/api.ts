import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { ERROR_TEXT, classifyError, unwrapRow, type AccountContext, type Content, type ContentFormat, type ContentLink, type ContentStatus, type ServerError } from './rules'

/**
 * Plano e Conteúdos no Supabase (migração 20261031041728). A leitura passa pelas políticas da
 * tabela (membros da conta, módulo Copy ligado); toda gravação passa pelas funções do servidor,
 * que conferem conta, módulo, papel e versão. Nada fica só no navegador.
 */

const db = supabase as unknown as SupabaseClient

export class ContentError extends Error {
  kind: ServerError
  constructor(kind: ServerError, raw?: string) {
    super(kind === 'desconhecido' && raw ? `${ERROR_TEXT[kind]} (${raw})` : ERROR_TEXT[kind])
    this.kind = kind
  }
}

export class ContentTablesError extends Error {
  constructor() {
    super('Falta aplicar a migração 20261031041728_superelements_v2_plano_conteudos.sql no Supabase.')
  }
}

const fail = (error: { code?: string; message: string }): never => {
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202') throw new ContentTablesError()
  throw new ContentError(classifyError(error.message), error.message)
}

type ContextRow = { team_id: string; offer: string; audience: string; tone: string; goal: string; restrictions: string; pillars: unknown; version: number; updated_by: string | null; updated_at: string }

const toContext = (r: ContextRow): AccountContext => ({
  teamId: r.team_id,
  offer: r.offer,
  audience: r.audience,
  tone: r.tone,
  goal: r.goal,
  restrictions: r.restrictions,
  pillars: Array.isArray(r.pillars) ? r.pillars.filter((p): p is string => typeof p === 'string') : [],
  version: r.version,
  updatedBy: r.updated_by ?? undefined,
  updatedAt: Date.parse(r.updated_at),
})

type ContentRow = {
  id: string
  team_id: string
  title: string
  idea: string
  goal: string
  format: ContentFormat
  script: string
  editorial_date: string | null
  status: ContentStatus
  version: number
  content_hash: string
  approved_version: number | null
  approved_hash: string | null
  approved_by: string | null
  approved_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

const toContent = (r: ContentRow): Content => ({
  id: r.id,
  teamId: r.team_id,
  title: r.title,
  idea: r.idea,
  goal: r.goal,
  format: r.format,
  script: r.script,
  editorialDate: r.editorial_date ?? undefined,
  status: r.status,
  version: r.version,
  contentHash: r.content_hash,
  approvedVersion: r.approved_version ?? undefined,
  approvedHash: r.approved_hash ?? undefined,
  approvedBy: r.approved_by ?? undefined,
  approvedAt: r.approved_at ? Date.parse(r.approved_at) : undefined,
  createdBy: r.created_by ?? undefined,
  createdAt: Date.parse(r.created_at),
  updatedAt: Date.parse(r.updated_at),
})

type LinkRow = { id: string; content_id: string; kind: 'copy' | 'criativos'; artifact_id: string; project_id: string | null; linked_hash: string; created_by: string | null }

const toLink = (r: LinkRow): ContentLink => ({ id: r.id, contentId: r.content_id, kind: r.kind, artifactId: r.artifact_id, projectId: r.project_id ?? undefined, linkedHash: r.linked_hash, createdBy: r.created_by ?? undefined })

/** `.rpc()` devolve a linha da função; só `error` precisa de tratamento. */
async function call<T>(fn: string, args: Record<string, unknown>, required?: string[]): Promise<T> {
  const { data, error } = await db.rpc(fn, args)
  if (error) fail(error)
  // Funções que devolvem uma linha: aceita objeto ou lista de uma linha e confere os campos
  return (required ? unwrapRow(data, required) : data) as T
}

const CONTEXT_KEYS = ['team_id', 'version', 'offer', 'audience', 'updated_at']
const CONTENT_KEYS = ['id', 'team_id', 'version', 'status', 'title', 'content_hash', 'created_at', 'updated_at']
const LINK_KEYS = ['id', 'content_id', 'kind', 'artifact_id']

export async function loadContext(teamId: string): Promise<AccountContext | null> {
  const { data, error } = await db.from('crm_account_context').select('*').eq('team_id', teamId).maybeSingle()
  if (error) fail(error)
  return data ? toContext(data as ContextRow) : null
}

export interface ContextDraft {
  offer: string
  audience: string
  tone: string
  goal: string
  restrictions: string
  pillars: string[]
}

/** `expected` é a versão que a pessoa viu (0 quando o plano ainda não existe). */
export async function saveContext(teamId: string, expected: number, draft: ContextDraft): Promise<AccountContext> {
  return toContext(await call<ContextRow>('crm_context_save', { p_team: teamId, p_expected: expected, p_data: draft }, CONTEXT_KEYS))
}

export async function listContents(teamId: string): Promise<Content[]> {
  const { data, error } = await db.from('crm_contents').select('*').eq('team_id', teamId).order('updated_at', { ascending: false })
  if (error) fail(error)
  return ((data ?? []) as ContentRow[]).map(toContent)
}

export async function loadContent(id: string): Promise<Content | null> {
  const { data, error } = await db.from('crm_contents').select('*').eq('id', id).maybeSingle()
  if (error) fail(error)
  return data ? toContent(data as ContentRow) : null
}

export interface ContentDraft {
  title: string
  idea: string
  goal: string
  format: ContentFormat
  script: string
  editorialDate: string | null
}

export const createContent = async (teamId: string, draft: ContentDraft): Promise<Content> => toContent(await call<ContentRow>('crm_content_create', { p_team: teamId, p_data: draft }, CONTENT_KEYS))

export const saveContent = async (id: string, expected: number, draft: Partial<ContentDraft>): Promise<Content> => toContent(await call<ContentRow>('crm_content_save', { p_id: id, p_expected: expected, p_data: draft }, CONTENT_KEYS))

export const transitionContent = async (id: string, expected: number, to: ContentStatus): Promise<Content> => toContent(await call<ContentRow>('crm_content_transition', { p_id: id, p_expected: expected, p_to: to }, CONTENT_KEYS))

export async function deleteContent(id: string): Promise<void> {
  await call<null>('crm_content_delete', { p_id: id })
}

export async function listLinks(contentId: string): Promise<ContentLink[]> {
  const { data, error } = await db.from('crm_content_links').select('*').eq('content_id', contentId)
  if (error) fail(error)
  return ((data ?? []) as LinkRow[]).map(toLink)
}

export const linkContent = async (contentId: string, kind: 'copy' | 'criativos', artifactId: string, projectId: string | undefined, hash: string): Promise<ContentLink> =>
  toLink(await call<LinkRow>('crm_content_link', { p_content: contentId, p_kind: kind, p_artifact: artifactId, p_project: projectId ?? null, p_hash: hash }, LINK_KEYS))

export async function unlinkContent(contentId: string, kind: 'copy' | 'criativos'): Promise<void> {
  await call<null>('crm_content_unlink', { p_content: contentId, p_kind: kind })
}

export interface ApprovalSnapshot {
  id: string
  kind: 'submissao' | 'aprovacao'
  contentVersion: number
  contextVersion?: number
  createdAt: number
  createdBy?: string
  payload: { title: string; format: string; goal: string; idea: string; script: string }
}

export async function listSnapshots(contentId: string): Promise<ApprovalSnapshot[]> {
  const { data, error } = await db.from('crm_content_snapshots').select('id, kind, content_version, context_version, created_at, created_by, payload').eq('content_id', contentId).order('created_at', { ascending: false }).limit(20)
  if (error) fail(error)
  return ((data ?? []) as { id: string; kind: 'submissao' | 'aprovacao'; content_version: number; context_version: number | null; created_at: string; created_by: string | null; payload: ApprovalSnapshot['payload'] }[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    contentVersion: r.content_version,
    contextVersion: r.context_version ?? undefined,
    createdAt: Date.parse(r.created_at),
    createdBy: r.created_by ?? undefined,
    payload: r.payload,
  }))
}
