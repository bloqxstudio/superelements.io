import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import type { WordPressConnection } from '@/features/wordpress/types'
import { removeProjectShares } from '@/features/approval/shares'
import type { Project, ProjectDoc, ProjectSummary, PublishBackup } from './types'

export type { PublishBackup } from './types'

/**
 * Os projetos ficam na conta de quem cria. A lista e a conexão com o WordPress
 * ficam em tabelas que só o dono e quem ele convidou leem; o conteúdo vai para
 * o bucket privado `space-projects`, em `<dono>/<projeto>/`, porque passa fácil
 * de 1 MB (seções do Elementor e logos em data URL), grande demais para uma linha.
 */
const BUCKET = 'space-projects'

const bucket = () => supabase.storage.from(BUCKET)

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Entre na sua conta para salvar os projetos.')
  return id
}

/** Dono de cada projeto já visto: os arquivos ficam na pasta dele, mesmo quando quem salva é um convidado. */
const owners = new Map<string, string>()

async function projectFolder(id: string) {
  let owner = owners.get(id)
  if (!owner) {
    const { data, error } = await supabase.from('space_projects').select('owner_id').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Este projeto não está na sua conta.')
    owner = data.owner_id
    owners.set(id, owner)
  }
  return `${owner}/${id}`
}

const iso = (time: number) => new Date(time).toISOString()

const isNotFound = (error: unknown) => {
  const e = error as { status?: number; statusCode?: string; message?: string } | null
  return e?.statusCode === '404' || e?.status === 404 || /not.?found/i.test(e?.message ?? '')
}

/** `cacheControl` 0 para arquivo regravado no mesmo caminho: o navegador não pode guardar o antigo. */
async function uploadJson(path: string, value: unknown, { upsert = false, cacheControl = '3600' } = {}) {
  const body = new Blob([JSON.stringify(value)], { type: 'application/json' })
  const { error } = await bucket().upload(path, body, { contentType: 'application/json', upsert, cacheControl })
  if (error) throw error
}

async function downloadJson<T>(path: string): Promise<T | undefined> {
  const { data, error } = await bucket().download(path)
  if (error) {
    if (isNotFound(error)) return undefined
    throw error
  }
  return JSON.parse(await data.text()) as T
}

/** Apaga tudo o que está numa pasta do bucket, subpastas inclusive. */
async function removeFolder(folder: string) {
  const paths: string[] = []
  const walk = async (prefix: string) => {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await bucket().list(prefix, { limit: 100, offset })
      if (error) throw error
      for (const item of data) {
        // Pasta vem sem id
        if (item.id) paths.push(`${prefix}/${item.name}`)
        else await walk(`${prefix}/${item.name}`)
      }
      if (data.length < 100) break
    }
  }
  await walk(folder)
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await bucket().remove(paths.slice(i, i + 100))
    if (error) throw error
  }
}

// Lista de projetos

const LIST_COLUMNS = 'id, owner_id, name, context, summary, created_at, updated_at'

interface ProjectRow {
  id: string
  owner_id: string
  name: string
  context: string
  summary: Json
  created_at: string
  updated_at: string
}

const toProject = (row: ProjectRow, userId: string, memberOf?: Set<string>): Project => {
  owners.set(row.id, row.owner_id)
  return {
    id: row.id,
    // Nem dono nem convidado: a conta admin vendo o projeto de outra pessoa
    role: row.owner_id === userId ? 'owner' : !memberOf || memberOf.has(row.id) ? 'editor' : 'admin',
    name: row.name,
    context: row.context,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
    summary: { sections: 0, colors: [], ...(row.summary as object) } as ProjectSummary,
  }
}

/**
 * Os projetos da conta e os compartilhados com ela; para a conta admin, também
 * os das outras contas (papel 'admin'), que ficam na tela Admin.
 */
export async function listProjects(): Promise<Project[]> {
  const userId = await currentUserId()
  const [projects, memberships] = await Promise.all([
    supabase.from('space_projects').select(LIST_COLUMNS).order('updated_at', { ascending: false }),
    supabase.from('space_project_members').select('project_id').eq('user_id', userId),
  ])
  if (projects.error) throw projects.error
  // Sem a lista dos convites, todo projeto alheio conta como compartilhado (o que valia antes)
  const memberOf = memberships.error ? undefined : new Set(memberships.data.map((m) => m.project_id))
  return projects.data.map((row) => toProject(row, userId, memberOf))
}

/** Dono de cada projeto, para a tela Admin. */
export const projectOwnerId = (id: string) => owners.get(id)

export async function insertProject(project: Project) {
  owners.set(project.id, await currentUserId())
  const { error } = await supabase.from('space_projects').insert({
    id: project.id,
    name: project.name,
    context: project.context,
    summary: project.summary as unknown as Json,
    created_at: iso(project.createdAt),
    updated_at: iso(project.updatedAt),
  })
  if (error) throw error
}

export async function updateProject(id: string, fields: Pick<Project, 'name' | 'context' | 'updatedAt'>) {
  const { error } = await supabase
    .from('space_projects')
    .update({ name: fields.name, context: fields.context, updated_at: iso(fields.updatedAt) })
    .eq('id', id)
  if (error) throw error
}

/** Só o dono: apaga o projeto e, em cascata, a conexão com o WordPress e os acessos; depois os arquivos. */
export async function deleteProject(id: string) {
  const owner = await currentUserId()
  // As fotos dos links de aprovação são públicas: saem antes, enquanto a linha do link ainda dá permissão
  await removeProjectShares(id).catch((error) => console.warn('[projetos] fotos dos links de aprovação não apagadas', error))
  const { error } = await supabase.from('space_projects').delete().eq('id', id)
  if (error) throw error
  // Arquivo que sobrar não aparece para ninguém: não impede a exclusão
  await removeFolder(`${owner}/${id}`).catch((error) => console.warn('[projetos] arquivos do projeto não apagados', error))
}

// Conteúdo do projeto

/** Revisão salva na conta e o arquivo do conteúdo dela. */
export interface DocHead {
  revision: number
  path: string | null
}

export interface CloudDoc extends DocHead {
  doc?: ProjectDoc
}

/** Revisão e arquivo atuais; undefined se o projeto não está (mais) na conta. */
export async function loadDocHead(id: string): Promise<DocHead | undefined> {
  const { data, error } = await supabase.from('space_projects').select('owner_id, revision, doc_path').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return undefined
  owners.set(id, data.owner_id)
  return { revision: data.revision, path: data.doc_path }
}

/** O conteúdo salvo na conta; undefined se o projeto não está (mais) lá. */
export async function loadProjectDoc(id: string): Promise<CloudDoc | undefined> {
  for (let attempt = 0; ; attempt++) {
    const head = await loadDocHead(id)
    if (!head?.path) return head
    const doc = await downloadJson<ProjectDoc>(head.path)
    if (doc) return { ...head, doc }
    // Outro aparelho salvou (e apagou o arquivo antigo) entre as duas leituras: lê de novo
    if (attempt === 1) {
      console.warn('[projetos] arquivo do conteúdo não encontrado', head.path)
      return head
    }
  }
}

// Versões guardadas (histórico de alterações)

/** Editando, uma versão nova fica guardada a cada tanto tempo. */
const VERSION_EVERY = 15 * 60_000
/** Versões mantidas por projeto; as mais antigas o dono descarta ao salvar. */
const KEEP_VERSIONS = 60

export type VersionReason = 'auto' | 'delete' | 'restore'

export interface ProjectVersion {
  id: string
  revision: number
  path: string
  savedBy: string | null
  savedByEmail: string
  savedAt: number
  /** Vazio na versão de antes de uma exclusão ou restauração. */
  summary: Partial<ProjectSummary>
  reason: VersionReason
}

/** Quando a última versão do projeto foi guardada (lida uma vez da conta). */
const lastVersionAt = new Map<string, number>()
/** Antes do próximo salvamento, guardar o estado anterior: houve uma exclusão ou uma restauração. */
const pendingVersion = new Map<string, VersionReason>()
/** A migração do histórico ainda não foi aplicada: o salvamento segue como antes. */
let versionsOff = false

const missingTable = (error: { code?: string; message?: string } | null) => !!error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message ?? ''))

/** Pede para guardar, no próximo salvamento, a versão de antes da mudança. */
export const keepVersionBefore = (projectId: string, reason: Exclude<VersionReason, 'auto'>) => pendingVersion.set(projectId, reason)

async function latestVersionAt(id: string) {
  const known = lastVersionAt.get(id)
  if (known !== undefined) return known
  const { data, error } = await supabase.from('space_project_versions').select('saved_at').eq('project_id', id).order('saved_at', { ascending: false }).limit(1)
  if (missingTable(error)) versionsOff = true
  const at = data?.[0] ? Date.parse(data[0].saved_at) : 0
  lastVersionAt.set(id, at)
  return at
}

/** `summary` só quando ele é o desta revisão (a de antes de uma exclusão fica sem as contagens). */
async function recordVersion(id: string, revision: number, path: string, summary: ProjectSummary | null, reason: VersionReason) {
  const { error } = await supabase.from('space_project_versions').insert({ project_id: id, revision, doc_path: path, summary: (summary ?? {}) as unknown as Json, reason })
  if (error) {
    if (missingTable(error)) versionsOff = true
    else console.warn('[projetos] versão não guardada', error)
    return false
  }
  lastVersionAt.set(id, Date.now())
  void pruneVersions(id)
  return true
}

/** O dono descarta as versões além das mais novas (para os outros a conta recusa, e tudo bem). */
async function pruneVersions(id: string) {
  const { data } = await supabase.from('space_project_versions').select('id, doc_path').eq('project_id', id).order('saved_at', { ascending: false }).range(KEEP_VERSIONS, KEEP_VERSIONS + 49)
  if (!data?.length) return
  const { data: gone, error } = await supabase.from('space_project_versions').delete().in('id', data.map((v) => v.id)).select('doc_path')
  if (!error && gone?.length) void bucket().remove(gone.map((v) => v.doc_path))
}

/** Apaga o arquivo de uma revisão que ficou para trás, a não ser que ele seja uma versão guardada. */
async function removeUnlessVersion(path: string) {
  if (!versionsOff) {
    const { data, error } = await supabase.from('space_project_versions').select('id').eq('doc_path', path).limit(1)
    if (missingTable(error)) versionsOff = true
    else if (error || data?.length) return
  }
  await bucket().remove([path])
}

export async function listVersions(id: string): Promise<ProjectVersion[] | null> {
  const { data, error } = await supabase
    .from('space_project_versions')
    .select('id, revision, doc_path, saved_by, saved_by_email, saved_at, summary, reason')
    .eq('project_id', id)
    .order('saved_at', { ascending: false })
  if (missingTable(error)) return null
  if (error) throw error
  return data.map((v) => ({
    id: v.id,
    revision: v.revision,
    path: v.doc_path,
    savedBy: v.saved_by,
    savedByEmail: v.saved_by_email,
    savedAt: Date.parse(v.saved_at),
    summary: v.summary as unknown as Partial<ProjectSummary>,
    reason: v.reason as VersionReason,
  }))
}

/** O conteúdo de uma versão guardada. */
export const loadVersionDoc = (path: string) => downloadJson<ProjectDoc>(path)

export type SaveResult = { saved: DocHead } | { conflict: true }

interface SaveOptions {
  /** Revisão sobre a qual as mudanças foram feitas; se outro salvou depois dela, dá conflito. */
  base: number
  /** Arquivo da revisão anterior, apagado depois de salvar. */
  previousPath: string | null
  summary: ProjectSummary
  /** Mudou o conteúdo: o projeto sobe na lista. */
  edited: boolean
}

/**
 * Grava o conteúdo num arquivo novo e só então aponta o projeto para ele, se
 * ninguém salvou depois de `base`. Quem lê nunca pega um arquivo pela metade.
 */
export async function saveProjectDoc(id: string, doc: ProjectDoc, { base, previousPath, summary, edited }: SaveOptions): Promise<SaveResult> {
  const path = `${await projectFolder(id)}/doc-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.json`
  await uploadJson(path, doc)

  const { data, error } = await supabase
    .from('space_projects')
    .update({
      doc_path: path,
      revision: base + 1,
      summary: summary as unknown as Json,
      ...(edited ? { updated_at: new Date().toISOString() } : {}),
    })
    .eq('id', id)
    .eq('revision', base)
    .select('revision')

  if (error || !data.length) {
    void bucket().remove([path])
    if (error) throw error
    return { conflict: true }
  }
  // Histórico: antes de uma exclusão ou restauração fica o estado anterior; editando, uma versão a cada tanto
  let keptPrevious = false
  if (!versionsOff) {
    const before = pendingVersion.get(id)
    pendingVersion.delete(id)
    if (before && previousPath && previousPath !== path) keptPrevious = await recordVersion(id, base, previousPath, null, before)
    else if (edited && Date.now() - (await latestVersionAt(id)) >= VERSION_EVERY && !versionsOff) await recordVersion(id, base + 1, path, summary, 'auto')
  }
  if (previousPath && previousPath !== path && !keptPrevious) void removeUnlessVersion(previousPath).catch(() => {})
  return { saved: { revision: base + 1, path } }
}

// WordPress do cliente

export async function loadWordPressConnection(projectId: string): Promise<WordPressConnection | undefined> {
  const { data, error } = await supabase
    .from('space_wordpress_connections')
    .select('connection, password')
    .eq('project_id', projectId)
    .maybeSingle()
  if (error) throw error
  return data ? ({ ...(data.connection as object), password: data.password } as WordPressConnection) : undefined
}

export async function saveWordPressConnection(projectId: string, connection: WordPressConnection) {
  const { password, ...rest } = connection
  const { error } = await supabase
    .from('space_wordpress_connections')
    .upsert(
      { project_id: projectId, connection: rest as unknown as Json, password, updated_at: new Date().toISOString() },
      { onConflict: 'project_id' }
    )
  if (error) throw error
}

export async function deleteWordPressConnection(projectId: string) {
  const { error } = await supabase.from('space_wordpress_connections').delete().eq('project_id', projectId)
  if (error) throw error
}

// Versões anteriores das páginas publicadas, para desfazer de qualquer aparelho

const backupPath = async (id: string, postId: number) => `${await projectFolder(id)}/wordpress-backups/${postId}.json`

export async function loadPublishBackups(id: string, postId: number): Promise<PublishBackup[]> {
  return (await downloadJson<PublishBackup[]>(await backupPath(id, postId))) ?? []
}

export async function savePublishBackups(id: string, postId: number, backups: PublishBackup[]) {
  const path = await backupPath(id, postId)
  if (backups.length) {
    await uploadJson(path, backups, { upsert: true, cacheControl: '0' })
    return
  }
  const { error } = await bucket().remove([path])
  if (error) throw error
}
