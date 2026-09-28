import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import type { WordPressConnection } from '@/features/wordpress/types'
import { removeProjectShares } from '@/features/approval/shares'
import type { Project, ProjectDoc, ProjectSummary, PublishBackup } from './types'

export type { PublishBackup } from './types'

/**
 * Os projetos ficam na conta de quem cria. A lista e a conexão com o WordPress
 * ficam em tabelas que só o dono lê; o conteúdo vai para o bucket privado
 * `space-projects`, em `<dono>/<projeto>/`, porque passa fácil de 1 MB
 * (seções do Elementor e logos em data URL), grande demais para uma linha.
 */
const BUCKET = 'space-projects'

const bucket = () => supabase.storage.from(BUCKET)

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Entre na sua conta para salvar os projetos.')
  return id
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

const LIST_COLUMNS = 'id, name, context, summary, created_at, updated_at'

interface ProjectRow {
  id: string
  name: string
  context: string
  summary: Json
  created_at: string
  updated_at: string
}

const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  context: row.context,
  createdAt: Date.parse(row.created_at),
  updatedAt: Date.parse(row.updated_at),
  summary: { sections: 0, colors: [], ...(row.summary as object) } as ProjectSummary,
})

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('space_projects').select(LIST_COLUMNS).order('updated_at', { ascending: false })
  if (error) throw error
  return data.map(toProject)
}

export async function insertProject(project: Project) {
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

/** Apaga o projeto e, em cascata, a conexão com o WordPress; depois os arquivos. */
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
  const { data, error } = await supabase.from('space_projects').select('revision, doc_path').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? { revision: data.revision, path: data.doc_path } : undefined
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
  const owner = await currentUserId()
  const path = `${owner}/${id}/doc-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.json`
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
  if (previousPath && previousPath !== path) void bucket().remove([previousPath])
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

const backupPath = (owner: string, id: string, postId: number) => `${owner}/${id}/wordpress-backups/${postId}.json`

export async function loadPublishBackups(id: string, postId: number): Promise<PublishBackup[]> {
  const owner = await currentUserId()
  return (await downloadJson<PublishBackup[]>(backupPath(owner, id, postId))) ?? []
}

export async function savePublishBackups(id: string, postId: number, backups: PublishBackup[]) {
  const owner = await currentUserId()
  const path = backupPath(owner, id, postId)
  if (backups.length) {
    await uploadJson(path, backups, { upsert: true, cacheControl: '0' })
    return
  }
  const { error } = await bucket().remove([path])
  if (error) throw error
}
