import { supabase } from '@/integrations/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Quadros da conta (2026-11-07, o usuário: "uma aba aonde vamos ter um canva livre exatamente como
 * miro / figjam… planejar, criar ideias rápidas e visuais"). Tudo separado por conta:
 *   - `crm_boards` (migração 20261107140000): título, cena (elementos do Excalidraw) e `rev`;
 *   - imagens e miniatura: bucket `space-projects` em `crm/<conta>/quadros/<quadro>/` (`can_use_crm_file`).
 * A cena guarda só o endereço de cada imagem; o arquivo sobe uma vez, com cache longo no navegador.
 */

const db = supabase as unknown as SupabaseClient
const bucket = () => supabase.storage.from('space-projects')
export const boardRoot = (teamId: string, boardId: string) => `crm/${teamId}/quadros/${boardId}`

export interface BoardSummary {
  id: string
  title: string
  thumbPath?: string
  updatedAt: string
  createdBy?: string
}

/** Uma imagem da cena: só o caminho no Storage. */
export interface StoredFile { path: string; mimeType: string; created: number }

export interface BoardScene {
  elements: unknown[]
  files?: Record<string, StoredFile>
  background?: string
}

export interface Board extends BoardSummary { teamId: string; scene: BoardScene; rev: number }

const missingTable = (message: string) => (/crm_boards/.test(message) ? new Error('Falta a migração dos quadros no Supabase.') : new Error(message))

export async function listBoards(teamId: string): Promise<BoardSummary[]> {
  const { data, error } = await db.from('crm_boards').select('id, title, thumb_path, updated_at, created_by').eq('team_id', teamId).order('updated_at', { ascending: false })
  if (error) throw missingTable(error.message)
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, thumbPath: r.thumb_path ?? undefined, updatedAt: r.updated_at, createdBy: r.created_by ?? undefined }))
}

export async function createBoard(teamId: string, title: string, scene?: BoardScene): Promise<string> {
  const { data, error } = await db.from('crm_boards').insert({ team_id: teamId, title: title.trim() || 'Quadro sem título', scene: scene ?? { elements: [] } }).select('id').single()
  if (error) throw missingTable(error.message)
  return data.id as string
}

export async function loadBoard(id: string): Promise<Board | null> {
  const { data, error } = await db.from('crm_boards').select('id, team_id, title, scene, rev, thumb_path, updated_at, created_by').eq('id', id).maybeSingle()
  if (error) throw missingTable(error.message)
  if (!data) return null
  return {
    id: data.id, teamId: data.team_id, title: data.title, scene: (data.scene ?? { elements: [] }) as BoardScene, rev: data.rev,
    thumbPath: data.thumb_path ?? undefined, updatedAt: data.updated_at, createdBy: data.created_by ?? undefined,
  }
}

/** Grava a cena se ninguém gravou depois da `rev` lida; `null` = outra pessoa gravou antes (junte e tente de novo). */
export async function saveScene(id: string, rev: number, scene: BoardScene): Promise<number | null> {
  const { data, error } = await db.from('crm_boards').update({ scene }).eq('id', id).eq('rev', rev).select('rev').maybeSingle()
  if (error) throw new Error(error.message)
  return data ? (data.rev as number) : null
}

export async function renameBoard(id: string, title: string) {
  const { error } = await db.from('crm_boards').update({ title: title.trim().slice(0, 120) || 'Quadro sem título' }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function duplicateBoard(teamId: string, id: string): Promise<string> {
  const board = await loadBoard(id)
  if (!board) throw new Error('Quadro não encontrado.')
  // As imagens continuam na pasta do original (mesma conta): a cópia aponta para elas
  return createBoard(teamId, `${board.title} (cópia)`.slice(0, 120), board.scene)
}

export async function deleteBoard(teamId: string, id: string) {
  const { data, error } = await db.from('crm_boards').delete().eq('id', id).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Só quem criou o quadro ou o gestor da conta pode apagar.')
  // Os arquivos podem servir a uma cópia do quadro: só apaga os que nenhum outro quadro usa
  const folder = boardRoot(teamId, id)
  const { data: files } = await bucket().list(folder, { limit: 1000 })
  if (!files?.length) return
  const { data: others } = await db.from('crm_boards').select('scene').eq('team_id', teamId)
  const used = new Set<string>()
  for (const o of others ?? []) for (const f of Object.values(((o.scene ?? {}) as BoardScene).files ?? {})) used.add(f.path)
  const gone = files.map((f) => `${folder}/${f.name}`).filter((p) => !used.has(p))
  if (gone.length) await bucket().remove(gone)
}

// ———————————————————————————————————— imagens

/** Foto maior que 1600 px vira WebP de 1600 (o mesmo limite do Cérebro). SVG e GIF passam como estão. */
async function shrink(blob: Blob): Promise<Blob> {
  if (!/^image\/(png|jpeg|webp)$/.test(blob.type)) return blob
  const bitmap = await createImageBitmap(blob).catch(() => null)
  if (!bitmap) return blob
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.86))
  return out && out.size < blob.size ? out : blob
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg' }

/** Sobe a imagem de um elemento (vinda como dataURL do Excalidraw) e devolve onde ficou. */
export async function uploadImage(teamId: string, boardId: string, fileId: string, dataURL: string): Promise<StoredFile> {
  const blob = await shrink(await (await fetch(dataURL)).blob())
  const mimeType = blob.type || 'image/png'
  const safeId = fileId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) || crypto.randomUUID()
  const path = `${boardRoot(teamId, boardId)}/${safeId}.${EXT[mimeType] ?? 'bin'}`
  const { error } = await bucket().upload(path, blob, { contentType: mimeType, upsert: true, cacheControl: '31536000' })
  if (error) throw new Error(error.message)
  return { path, mimeType, created: Date.now() }
}

// Links de 7 dias guardados neste navegador (regra de tráfego do Supabase: não assinar a cada montagem)
const URL_KEY = 'quadros-arquivos'
const TTL = 7 * 86_400_000
type UrlCache = Record<string, { url: string; until: number }>
const readUrls = (): UrlCache => { try { return JSON.parse(localStorage.getItem(URL_KEY) ?? '{}') as UrlCache } catch { return {} } }

export async function fileUrl(path: string): Promise<string> {
  const cache = readUrls()
  const hit = cache[path]
  if (hit && hit.until > Date.now() + 3_600_000) return hit.url
  const { data, error } = await bucket().createSignedUrl(path, TTL / 1000)
  if (error) throw new Error(error.message)
  cache[path] = { url: data.signedUrl, until: Date.now() + TTL }
  try {
    const now = Date.now()
    localStorage.setItem(URL_KEY, JSON.stringify(Object.fromEntries(Object.entries(cache).filter(([, v]) => v.until > now).slice(-800))))
  } catch { /* sem armazenamento: só não guarda */ }
  return data.signedUrl
}

/**
 * A imagem como dataURL para o Excalidraw (assim exportar PNG e a miniatura funcionam). O link é o
 * mesmo por 7 dias e o arquivo tem cache de um ano: abrir de novo vem do cache do navegador.
 */
export async function fileDataUrl(path: string): Promise<string> {
  const res = await fetch(await fileUrl(path))
  if (!res.ok) throw new Error(`Imagem indisponível (${res.status})`)
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Miniatura da lista: um arquivo novo a cada vez (o link guardado nunca mostra a antiga). */
export async function saveThumb(teamId: string, boardId: string, blob: Blob, previous?: string): Promise<string> {
  const path = `${boardRoot(teamId, boardId)}/capa-${Date.now()}.webp`
  const { error } = await bucket().upload(path, blob, { contentType: blob.type || 'image/webp', upsert: false, cacheControl: '31536000' })
  if (error) throw new Error(error.message)
  const { error: rowError } = await db.from('crm_boards').update({ thumb_path: path }).eq('id', boardId)
  if (rowError) throw new Error(rowError.message)
  if (previous && previous !== path) void bucket().remove([previous])
  return path
}
