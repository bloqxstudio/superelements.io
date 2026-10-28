import { currentUserId } from '@/features/projects/storage'
import { personalFolder } from '@/features/crm/accountScope'
import { supabase } from '@/integrations/supabase/client'
import { wordsOf, type CopyDoc, type CopySummary } from './types'

/**
 * Os documentos ficam no bucket privado `space-projects`, como os conjuntos de
 * criativos: um documento pessoal vai para a pasta da conta (`<conta>/copy/`);
 * um documento compartilhado vai para a pasta do projeto
 * (`<dono>/<projeto>/copy/`), onde as regras do Space já dão leitura e escrita a
 * toda a equipe do projeto: sem migração. Cada pasta tem o seu `index.json`.
 */

const bucket = () => supabase.storage.from('space-projects')

const isNotFound = (error: unknown) => {
  const e = error as { status?: number; statusCode?: string; message?: string; name?: string; originalError?: { status?: number } } | null
  const status = e?.status ?? e?.originalError?.status
  return e?.statusCode === '404' || status === 404 || status === 400 || e?.name === 'StorageUnknownError' || /not.?found/i.test(e?.message ?? '')
}

async function readJson<T>(path: string): Promise<T | undefined> {
  const { data, error } = await bucket().download(path)
  if (error) {
    if (isNotFound(error)) return undefined
    throw error
  }
  return JSON.parse(await data.text()) as T
}

async function writeJson(path: string, value: unknown) {
  const { error } = await bucket().upload(path, new Blob([JSON.stringify(value)], { type: 'application/json' }), { contentType: 'application/json', upsert: true, cacheControl: '0' })
  if (error) throw error
}

const owners = new Map<string, string>()

const folderOf = async (projectId?: string) => {
  if (!projectId) return `${personalFolder(await currentUserId())}/copy`
  let owner = owners.get(projectId)
  if (!owner) {
    const { data, error } = await supabase.from('space_projects').select('owner_id').eq('id', projectId).maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Este projeto não está na sua conta.')
    owner = data.owner_id as string
    owners.set(projectId, owner)
  }
  return `${owner}/${projectId}/copy`
}

const placeOf = (d: Pick<CopyDoc, 'projectId' | 'shared'>) => (d.shared ? d.projectId : undefined)

export const summaryOf = (d: CopyDoc): CopySummary => ({ id: d.id, title: d.title, format: d.format, niche: d.niche, projectId: d.projectId, projectName: d.projectName, shared: d.shared, folderId: d.folderId, folderName: d.folderName, words: wordsOf(d), updatedAt: d.updatedAt })

/** Os documentos da conta e os dos projetos que ela abre, do mais novo ao mais antigo. */
export async function listDocs(projectIds: string[] = []): Promise<CopySummary[]> {
  const personal = (await readJson<CopySummary[]>(`${await folderOf()}/index.json`)) ?? []
  const shared = await Promise.all(
    projectIds.map(async (id) => {
      try {
        return ((await readJson<CopySummary[]>(`${await folderOf(id)}/index.json`)) ?? []).map((s) => ({ ...s, projectId: id, shared: true }))
      } catch {
        return []
      }
    })
  )
  return [...personal, ...shared.flat()].sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadDoc(id: string, projectId?: string): Promise<CopyDoc | undefined> {
  const found = await readJson<CopyDoc>(`${await folderOf(projectId)}/${id}.json`)
  return found && projectId ? { ...found, projectId, shared: true } : found
}

const writeIndex = async (projectId: string | undefined, fn: (list: CopySummary[]) => CopySummary[]) => {
  const base = await folderOf(projectId)
  const list = (await readJson<CopySummary[]>(`${base}/index.json`)) ?? []
  await writeJson(`${base}/index.json`, fn(list))
}

export async function saveDoc(doc: CopyDoc) {
  const where = placeOf(doc)
  await writeJson(`${await folderOf(where)}/${doc.id}.json`, doc)
  await writeIndex(where, (list) => [summaryOf(doc), ...list.filter((s) => s.id !== doc.id)])
}

export async function deleteDoc(s: Pick<CopySummary, 'id' | 'projectId' | 'shared'>) {
  const where = s.shared ? s.projectId : undefined
  await bucket().remove([`${await folderOf(where)}/${s.id}.json`])
  await writeIndex(where, (list) => list.filter((x) => x.id !== s.id))
}

/** Leva um documento pessoal para a pasta de um projeto: a equipe dele passa a editar junto, ao vivo. */
export async function shareDoc(doc: CopyDoc, projectId: string, projectName: string): Promise<CopyDoc> {
  const moved: CopyDoc = { ...doc, projectId, projectName, shared: true, updatedAt: Date.now() }
  await saveDoc(moved)
  if (!doc.shared) await deleteDoc({ id: doc.id, projectId: doc.projectId, shared: false })
  return moved
}
