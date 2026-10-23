import { supabase } from '@/integrations/supabase/client'
import { currentUserId } from '@/features/projects/storage'
import type { CreativeSet, SetAsset, SetSummary } from './types'

/**
 * Os conjuntos ficam no bucket privado `space-projects`, na pasta da conta
 * (`<conta>/criativos/`), o que as regras de acesso que já existem cobrem: não
 * precisa de migração. `index.json` guarda o resumo que a lista mostra.
 */
const bucket = () => supabase.storage.from('space-projects')

const folder = async () => `${await currentUserId()}/criativos`

/** Arquivo que ainda não existe: o Storage responde 404, ou 400 com corpo vazio (StorageUnknownError). */
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
  const { error } = await bucket().upload(path, new Blob([JSON.stringify(value)], { type: 'application/json' }), {
    contentType: 'application/json',
    upsert: true,
    cacheControl: '0',
  })
  if (error) throw error
}

export const summaryOf = (set: CreativeSet): SetSummary => ({
  id: set.id,
  name: set.name,
  projectName: set.projectName,
  posts: set.posts.length,
  colors: set.brand.colors.slice(0, 5).map((c) => c.hex),
  updatedAt: set.updatedAt,
})

export async function listSets(): Promise<SetSummary[]> {
  const list = (await readJson<SetSummary[]>(`${await folder()}/index.json`)) ?? []
  return list.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadSet(id: string): Promise<CreativeSet | undefined> {
  return readJson<CreativeSet>(`${await folder()}/${id}/set.json`)
}

export async function saveSet(set: CreativeSet) {
  const base = await folder()
  await writeJson(`${base}/${set.id}/set.json`, set)
  const list = ((await readJson<SetSummary[]>(`${base}/index.json`)) ?? []).filter((s) => s.id !== set.id)
  await writeJson(`${base}/index.json`, [summaryOf(set), ...list])
}

export async function deleteSet(id: string) {
  const base = await folder()
  const { data } = await bucket().list(`${base}/${id}`, { limit: 1000 })
  const paths = (data ?? []).map((f) => `${base}/${id}/${f.name}`)
  if (paths.length) await bucket().remove(paths)
  const list = ((await readJson<SetSummary[]>(`${base}/index.json`)) ?? []).filter((s) => s.id !== id)
  await writeJson(`${base}/index.json`, list)
}

/** Envia uma imagem para o conjunto e devolve o registro dela. */
export async function uploadAsset(setId: string, file: File | Blob, name: string): Promise<SetAsset> {
  const id = Math.random().toString(36).slice(2, 10)
  const ext = (name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${await folder()}/${setId}/${id}.${ext}`
  const { error } = await bucket().upload(path, file, { contentType: file.type || 'image/png', upsert: false })
  if (error) throw error
  const bitmap = await createImageBitmap(file)
  const asset = { id, name, path, width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return asset
}

/** Endereço temporário do arquivo, para desenhar no canvas. */
export async function assetUrl(asset: SetAsset): Promise<string> {
  const { data, error } = await bucket().createSignedUrl(asset.path, 3600)
  if (error || !data) throw error ?? new Error('Sem endereço para a imagem.')
  return data.signedUrl
}
