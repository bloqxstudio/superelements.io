import { supabase } from '@/integrations/supabase/client'
import { currentUserId } from '@/features/projects/storage'
import { personalFolder } from '@/features/crm/accountScope'
import { createOnce, isAlreadyExists } from '@/features/conteudos/exclusive'
import { writeIndexSafely } from './indexMerge'
import type { CreativeSet, Post, PostInfo, SetAsset, SetSummary, VideoInfo } from './types'

/**
 * Os conjuntos ficam no bucket privado `space-projects`. Um conjunto pessoal vai
 * para a pasta da conta (`<conta>/criativos/`); um conjunto compartilhado vai
 * para a pasta do projeto (`<dono>/<projeto>/criativos/`), onde as regras de
 * acesso do Space já dão leitura e escrita a toda a equipe do projeto: sem
 * migração. Cada pasta tem o seu `index.json`, com o resumo que a lista mostra.
 */
const bucket = () => supabase.storage.from('space-projects')

const owners = new Map<string, string>()
/** Guarda o dono de projetos já lidos noutra consulta (poupa uma ida ao banco por projeto). */
export const rememberOwners = (rows: { id: string; owner_id?: string | null }[]) => { for (const r of rows) if (r.owner_id) owners.set(r.id, r.owner_id) }

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

export type Where = Pick<CreativeSet, 'id' | 'projectId' | 'shared'>
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

/** Assinatura curta (FNV-1a) do primeiro slide e do formato: muda quando a capa muda. */
export function coverHash(post: Pick<Post, 'format' | 'slides'>): string {
  const text = JSON.stringify([post.format, post.slides[0] ?? null])
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/** Até 40 posts por conjunto vão no índice, com a capa quando ela existe. */
const MAX_POSTS_INFO = 40

const postsInfoOf = (set: CreativeSet, previous?: PostInfo[]): PostInfo[] =>
  set.posts.slice(0, MAX_POSTS_INFO).map((p) => {
    const hash = coverHash(p)
    const old = previous?.find((x) => x.id === p.id && x.hash === hash)
    return { id: p.id, name: p.name, format: p.format, slides: p.slides.length, ...(p.slides.some((sl) => sl.layers.some((l) => l.motion)) ? { motion: true } : {}), ...(p.approved ? { approved: true } : {}), hash, ...(old?.cover ? { cover: old.cover } : {}) }
  })

export const summaryOf = (set: CreativeSet, previous?: SetSummary): SetSummary => ({
  id: set.id,
  name: set.name,
  projectId: set.projectId,
  projectName: set.projectName,
  shared: set.shared,
  posts: set.posts.length,
  colors: set.brand.colors.slice(0, 5).map((c) => c.hex),
  updatedAt: set.updatedAt,
  postsInfo: postsInfoOf(set, previous?.postsInfo),
  videosInfo: videosInfoOf(set),
  mediaUsed: mediaUsedOf(set),
})

/** Os vídeos explicativos do conjunto, do mais novo ao mais antigo (até 20). */
/**
 * Os vídeos do conjunto para o índice: todos, os de roteiro e voz (vídeo explicativo) e as animações em
 * código (uma ferramenta só desde 2026-11-09), com a capa.
 */
export function videosInfoOf(set: CreativeSet): VideoInfo[] {
  return (set.scenes ?? [])
    .map((s): VideoInfo => {
      const cover = s.cover ? { cover: s.cover } : {}
      if (!s.explainer) {
        const voice = s.audio ? s.audio.name : undefined
        return { id: s.id, name: s.name, duration: Math.round(s.duration * 10) / 10, kind: 'animacao', ...(voice ? { voice } : {}), cenas: Array.isArray((s.data as { parts?: unknown[] } | undefined)?.parts) ? (s.data as { parts: unknown[] }).parts.length : 1, at: s.updatedAt, ...cover }
      }
      const d = s.explainer
      const voice = d.voiceAI ? `${d.voiceAI.provider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'} (${d.voiceAI.voiceName ?? d.voiceAI.voice})` : d.media && (d.mode ?? 'narracao') === 'narracao' ? 'fala gravada' : undefined
      return { id: s.id, name: s.name, duration: Math.round(s.duration * 10) / 10, kind: 'roteiro', look: d.look, mode: d.mode ?? 'narracao', ...(voice ? { voice } : {}), ...(d.research ? { research: d.research.title } : {}), cenas: d.beats.length, at: s.updatedAt, ...cover }
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, 20)
}

/** Os ids dos áudios e vídeos em uso no conjunto. */
export function mediaUsedOf(set: CreativeSet): string[] {
  const ids = new Set<string>()
  const add = (src?: string) => src?.startsWith('asset:') && ids.add(src.slice(6))
  for (const s of set.scenes ?? []) {
    add(s.audio?.src)
    add(s.explainer?.media?.src)
    add(s.explainer?.music?.src)
    // As fotos e os clipes das cenas (a Iara e Estilo › Fotos sobem vídeos curtos)
    for (const p of s.explainer?.photos ?? []) add(p.src)
  }
  for (const p of set.posts) {
    add(p.motion?.audio?.src)
    for (const sl of p.slides) for (const l of sl.layers) if (l.type === 'image') add(l.src)
  }
  return [...ids]
}

/** Áudios e vídeos na pasta do conjunto (só os nomes e datas, sem baixar): evidência do que subiu. */
export async function listSetMedia(set: Pick<SetSummary, 'id' | 'projectId' | 'shared'>): Promise<{ id: string; name: string; size: number; mtime: number; kind: 'audio' | 'video' }[]> {
  const dir = `${await folderOf(placeOf(set))}/${set.id}`
  const { data, error } = await bucket().list(dir, { limit: 1000, sortBy: { column: 'updated_at', order: 'desc' } })
  if (error) return []
  return (data ?? [])
    .filter((f) => f.id && /\.(wav|mp3|m4a|aac|ogg|webm|mp4|mov)$/i.test(f.name))
    .map((f) => ({ id: f.name.replace(/\.[^.]+$/, ''), name: f.name, size: (f.metadata as { size?: number } | null)?.size ?? 0, mtime: Date.parse(f.updated_at ?? '') || 0, kind: /\.(mp4|mov|webm)$/i.test(f.name) && !/^narracao/.test(f.name) ? ('video' as const) : ('audio' as const) }))
}

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

/**
 * Grava o índice da pasta mudando só as linhas deste conjunto, sobre a lista lida na hora, e confere depois: o MCP
 * pode criar outro conjunto na mesma pasta ao mesmo tempo, e a linha dele não pode sumir (revisão de 2026-11-13).
 */
const writeIndex = async (projectId: string | undefined, fn: (list: SetSummary[]) => SetSummary[]) => {
  const path = `${await folderOf(projectId)}/index.json`
  await writeIndexSafely(() => readJson<SetSummary[]>(path), (list) => writeJson(path, list), fn)
}

export async function saveSet(set: CreativeSet) {
  const where = placeOf(set)
  await writeJson(`${await folderOf(where)}/${set.id}/set.json`, set)
  await writeIndex(where, (list) => [summaryOf(set, list.find((s) => s.id === set.id)), ...list.filter((s) => s.id !== set.id)])
}

// Capas

/** Pasta das capas do conjunto. Cada capa tem o `hash` no nome: o arquivo nunca muda, o navegador guarda. */
const coversFolder = async (set: Where) => `${await folderOf(placeOf(set))}/${set.id}/capas`

/** Sobe as capas novas e grava no índice; as que ficaram velhas saem da pasta. */
export async function saveCovers(set: CreativeSet, made: { postId: string; hash: string; blob: Blob }[]): Promise<SetSummary> {
  const folder = await coversFolder(set)
  const paths = new Map<string, string>()
  for (const c of made) {
    const path = `${folder}/${c.postId}-${c.hash}.jpg`
    const { error } = await bucket().upload(path, c.blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' })
    if (error) throw error
    paths.set(`${c.postId}:${c.hash}`, path)
  }
  let keep = new Set<string>()
  let saved: SetSummary = summaryOf(set)
  await writeIndex(placeOf(set), (list) => {
    const old = list.find((s) => s.id === set.id)
    const next = summaryOf(set, old)
    next.postsInfo = next.postsInfo?.map((p) => (paths.has(`${p.id}:${p.hash}`) ? { ...p, cover: paths.get(`${p.id}:${p.hash}`) } : p))
    // As capas dos vídeos ficam na mesma pasta: não podem sair como velhas
    keep = new Set([...(next.postsInfo ?? []).flatMap((p) => (p.cover ? [p.cover] : [])), ...(set.scenes ?? []).flatMap((s) => (s.cover ? [s.cover] : []))])
    saved = { ...next, ...(placeOf(set) ? { projectId: set.projectId, shared: true } : {}) }
    return [next, ...list.filter((s) => s.id !== set.id)]
  })
  const { data } = await bucket().list(folder, { limit: 1000 })
  const stale = (data ?? []).map((f) => `${folder}/${f.name}`).filter((p) => !keep.has(p))
  if (stale.length) await bucket().remove(stale)
  return saved
}

/**
 * Sobe a capa de um vídeo (`capas/video-<id>-<marca>.jpg`, cache de um ano: o nome muda quando a capa muda)
 * e apaga a anterior. Quem grava o caminho na cena é o estúdio (o índice pega dali).
 */
export async function saveVideoCover(set: Where, sceneId: string, blob: Blob, previous?: string): Promise<string> {
  const path = `${await coversFolder(set)}/video-${sceneId}-${Date.now().toString(36)}.jpg`
  const { error } = await bucket().upload(path, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' })
  if (error) throw error
  if (previous && previous !== path) void bucket().remove([previous]).catch(() => undefined)
  return path
}

/** O resumo gravado deste conjunto (para saber que capas já existem). */
export async function readSummary(set: Where): Promise<SetSummary | undefined> {
  const list = (await readJson<SetSummary[]>(`${await folderOf(placeOf(set))}/index.json`)) ?? []
  return list.find((s) => s.id === set.id)
}

/** Todos os resumos de uma pasta (a do projeto, ou a pessoal sem projeto): uma leitura do `index.json`. */
export async function readSummaries(projectId?: string): Promise<SetSummary[]> {
  return (await readJson<SetSummary[]>(`${await folderOf(projectId)}/index.json`)) ?? []
}

const COVER_KEY = 'criativos-capas'
const COVER_TTL = 7 * 86_400_000
type CoverCache = Record<string, { url: string; until: number }>
const readCoverCache = (): CoverCache => {
  try {
    return JSON.parse(localStorage.getItem(COVER_KEY) ?? '{}') as CoverCache
  } catch {
    return {}
  }
}

/**
 * Endereços das capas, assinados por 7 dias e guardados neste navegador: o mesmo
 * endereço volta a cada abertura, então a imagem vem do cache e não do Storage.
 */
export async function coverUrls(paths: string[]): Promise<Record<string, string>> {
  const cache = readCoverCache()
  const now = Date.now()
  const out: Record<string, string> = {}
  const missing: string[] = []
  for (const p of new Set(paths)) {
    const hit = cache[p]
    if (hit && hit.until > now + 3_600_000) out[p] = hit.url
    else missing.push(p)
  }
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100)
    const { data } = await bucket().createSignedUrls(chunk, COVER_TTL / 1000)
    for (const row of data ?? []) {
      if (!row.path || !row.signedUrl) continue
      out[row.path] = row.signedUrl
      cache[row.path] = { url: row.signedUrl, until: now + COVER_TTL }
    }
  }
  try {
    // Só as recentes: o cache não cresce sem fim
    const entries = Object.entries(cache).filter(([, v]) => v.until > now).slice(-600)
    localStorage.setItem(COVER_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // sem armazenamento: só não guarda
  }
  return out
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
      index: (value) => writeIndex(where, (list) => [summaryOf(value, list.find((s) => s.id === value.id)), ...list.filter((s) => s.id !== value.id)]),
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
  const type = file.type || 'image/png'
  if (type.startsWith('audio/') || type.startsWith('video/')) {
    const meta = await mediaMeta(file, type.startsWith('video/') ? 'video' : 'audio')
    const { error } = await bucket().upload(path, file, { contentType: type, upsert: false })
    if (error) throw error
    return { id, name, path, ...meta }
  }
  const { error } = await bucket().upload(path, file, { contentType: type, upsert: false })
  if (error) throw error
  const bitmap = await createImageBitmap(file)
  const asset = { id, name, path, width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return asset
}

/** Tamanho e duração de um vídeo ou áudio, lidos pelo próprio navegador antes de enviar. */
function mediaMeta(file: File | Blob, kind: 'video' | 'audio'): Promise<Pick<SetAsset, 'width' | 'height' | 'kind' | 'duration'>> {
  if (file.size > 50 * 1024 * 1024) return Promise.reject(new Error('O arquivo passa de 50 MB.'))
  const url = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const el = document.createElement(kind)
    el.preload = 'metadata'
    el.onloadedmetadata = () => {
      const v = el as HTMLVideoElement
      resolve({ kind, width: kind === 'video' ? v.videoWidth : 0, height: kind === 'video' ? v.videoHeight : 0, duration: Number.isFinite(el.duration) ? Math.round(el.duration * 100) / 100 : undefined })
      URL.revokeObjectURL(url)
    }
    el.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(kind === 'video' ? 'Não consegui ler esse vídeo (use MP4 ou WebM).' : 'Não consegui ler esse áudio (use MP3, M4A ou WAV).'))
    }
    el.src = url
  })
}

/**
 * As imagens guardadas na pasta de um conjunto (as fotos, recortes e peças que os posts usam), lidas pela
 * listagem do Storage, sem baixar o set.json. Para o Cérebro mostrar as imagens dos posts, não só as capas.
 */
export async function listSetImages(set: Pick<SetSummary, 'id' | 'projectId' | 'shared'>): Promise<{ path: string; name: string; size: number; mtime: number }[]> {
  const dir = `${await folderOf(placeOf(set))}/${set.id}`
  const { data, error } = await bucket().list(dir, { limit: 1000, sortBy: { column: 'updated_at', order: 'desc' } })
  if (error) return []
  return (data ?? [])
    .filter((f) => f.id && /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name))
    .map((f) => ({ path: `${dir}/${f.name}`, name: f.name, size: (f.metadata as { size?: number } | null)?.size ?? 0, mtime: Date.parse(f.updated_at ?? '') || 0 }))
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
