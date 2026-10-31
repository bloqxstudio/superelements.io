import { supabase } from '@/integrations/supabase/client'
import { currentUserId } from '@/features/projects/storage'
import { personalFolder } from '@/features/crm/accountScope'
import { createOnce, isAlreadyExists } from '@/features/conteudos/exclusive'
import type { CreativeSet, SetAsset, SetSummary } from './types'

/**
 * Os conjuntos ficam no bucket privado `space-projects`. Um conjunto pessoal vai
 * para a pasta da conta (`<conta>/criativos/`); um conjunto compartilhado vai
 * para a pasta do projeto (`<dono>/<projeto>/criativos/`), onde as regras de
 * acesso do Space já dão leitura e escrita a toda a equipe do projeto: sem
 * migração. Cada pasta tem o seu `index.json`, com o resumo que a lista mostra.
 */
const bucket = () => supabase.storage.from('space-projects')

const owners = new Map<string, string>()

/** Pasta dos conjuntos: a do projeto (compartilhada com a equipe) ou a da conta. */
const folderOf = async (projectId?: string) => {
  if (!projectId) return `${personalFolder(await currentUserId())}/criativos`
  let owner = owners.get(projectId)
  if (!owner) {
    const { data, error } = await supabase.from('space_projects').select('owner_id').eq('id', projectId).maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Este projeto não está na sua conta.')
    owner = data.owner_id as string
    owners.set(projectId, owner)
  }
  return `${owner}/${projectId}/criativos`
}

type Where = Pick<CreativeSet, 'id' | 'projectId' | 'shared'>
const placeOf = (set: Pick<CreativeSet, 'projectId' | 'shared'>) => (set.shared ? set.projectId : undefined)

/** Arquivo que ainda não existe: o Storage responde 404, ou 400 com corpo vazio (StorageUnknownError). */
const isNotFound = (error: unknown) => {
  const e = error as { status?: number; statusCode?: string; message?: string; name?: string; originalError?: { status?: number } } | null
  const status = e?.status ?? e?.originalError?.status
  return e?.statusCode === '404' || status === 404 || status === 400 || e?.name === 'StorageUnknownError' || /not.?found/i.test(e?.message ?? '')
}

/**
 * Lê o que está gravado agora. O `set.json` e o `index.json` são regravados no
 * mesmo caminho, e o download simples vinha de um cache (do navegador ou do
 * Storage) com a versão de antes: a esteira dos stories lia o conjunto vazio,
 * não achava o post para pôr a foto e, ao gravar, podia apagar o que outra
 * etapa acabara de salvar. Um endereço assinado novo, sem cache, lê a versão atual.
 */
async function readJson<T>(path: string): Promise<T | undefined> {
  const { data, error } = await bucket().createSignedUrl(path, 60)
  if (error || !data?.signedUrl) {
    if (!error || isNotFound(error)) return undefined
    throw error
  }
  const response = await fetch(`${data.signedUrl}&v=${Date.now()}`, { cache: 'no-store' })
  if (response.status === 400 || response.status === 404) return undefined
  if (!response.ok) throw new Error(`Não consegui ler ${path.split('/').slice(-2).join('/')} (${response.status}).`)
  return (await response.json()) as T
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
  projectId: set.projectId,
  projectName: set.projectName,
  shared: set.shared,
  posts: set.posts.length,
  colors: set.brand.colors.slice(0, 5).map((c) => c.hex),
  updatedAt: set.updatedAt,
})

/** Os conjuntos da conta e os dos projetos que ela abre (`projectIds`), do mais novo ao mais antigo. */
export async function listSets(projectIds: string[] = []): Promise<SetSummary[]> {
  const personal = (await readJson<SetSummary[]>(`${await folderOf()}/index.json`)) ?? []
  const shared = await Promise.all(
    projectIds.map(async (id) => {
      try {
        return ((await readJson<SetSummary[]>(`${await folderOf(id)}/index.json`)) ?? []).map((s) => ({ ...s, projectId: id, shared: true }))
      } catch {
        // Projeto sem acesso ou sem conjuntos: não derruba a lista
        return []
      }
    })
  )
  return [...personal, ...shared.flat()].sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadSet(id: string, projectId?: string): Promise<CreativeSet | undefined> {
  const found = await readJson<CreativeSet>(`${await folderOf(projectId)}/${id}/set.json`)
  return found && projectId ? { ...found, projectId, shared: true } : found
}

const writeIndex = async (projectId: string | undefined, fn: (list: SetSummary[]) => SetSummary[]) => {
  const base = await folderOf(projectId)
  const list = (await readJson<SetSummary[]>(`${base}/index.json`)) ?? []
  await writeJson(`${base}/index.json`, fn(list))
}

export async function saveSet(set: CreativeSet) {
  const where = placeOf(set)
  await writeJson(`${await folderOf(where)}/${set.id}/set.json`, set)
  await writeIndex(where, (list) => [summaryOf(set), ...list.filter((s) => s.id !== set.id)])
}

/**
 * Cria o conjunto só se ainda não existe (`upsert: false`); se já existe, devolve o que está
 * gravado, sem escrever por cima. Falha de leitura ou permissão sobe como erro. As gravações
 * normais (`saveSet`) não mudam.
 */
export async function createSetOnce(set: CreativeSet): Promise<{ set: CreativeSet; created: boolean }> {
  const where = placeOf(set)
  const base = await folderOf(where)
  const result = await createOnce<CreativeSet>(
    {
      load: () => loadSet(set.id, where),
      create: async (value) => {
        const { error } = await bucket().upload(`${base}/${value.id}/set.json`, new Blob([JSON.stringify(value)], { type: 'application/json' }), { contentType: 'application/json', upsert: false, cacheControl: '0' })
        if (!error) return 'created'
        if (isAlreadyExists(error)) return 'exists'
        throw error
      },
      index: (value) => writeIndex(where, (list) => [summaryOf(value), ...list.filter((s) => s.id !== value.id)]),
    },
    set
  )
  return { set: result.value, created: result.created }
}

export async function deleteSet(set: Pick<SetSummary, 'id' | 'projectId' | 'shared'>) {
  const where = set.shared ? set.projectId : undefined
  const base = await folderOf(where)
  const { data } = await bucket().list(`${base}/${set.id}`, { limit: 1000 })
  const paths = (data ?? []).map((f) => `${base}/${set.id}/${f.name}`)
  if (paths.length) await bucket().remove(paths)
  await writeIndex(where, (list) => list.filter((s) => s.id !== set.id))
}

/** Envia uma imagem para o conjunto e devolve o registro dela. */
export async function uploadAsset(set: Where, file: File | Blob, name: string): Promise<SetAsset> {
  const id = Math.random().toString(36).slice(2, 10)
  const ext = (name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${await folderOf(placeOf(set))}/${set.id}/${id}.${ext}`
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

/**
 * Leva um conjunto pessoal para a pasta de um projeto: a equipe dele passa a
 * abrir, editar e ver o conjunto ao vivo. As imagens vão junto; o que ficou
 * na pasta da conta é apagado no fim, e só se tudo foi copiado.
 */
export async function shareSet(set: CreativeSet, projectId: string, projectName: string): Promise<CreativeSet> {
  const target = await folderOf(projectId)
  const assets: SetAsset[] = []
  for (const asset of set.assets) {
    const { data, error } = await bucket().download(asset.path)
    if (error) throw error
    const path = `${target}/${set.id}/${asset.path.split('/').pop()}`
    const { error: upError } = await bucket().upload(path, data, { contentType: data.type || 'image/png', upsert: true })
    if (upError) throw upError
    assets.push({ ...asset, path })
  }
  const moved: CreativeSet = { ...set, projectId, projectName, shared: true, assets, updatedAt: Date.now() }
  await saveSet(moved)
  if (!set.shared) await deleteSet({ id: set.id, projectId: set.projectId, shared: false })
  return moved
}
