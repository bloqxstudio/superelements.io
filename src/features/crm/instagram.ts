import { supabase } from '@/integrations/supabase/client'
import { publicAppUrl } from '@/features/approval/shares'
import { EMPHASIS_FONT, loadFont, loadImage, slideToBlob, type ImageMap } from '@/features/criativos/render'
import { assetUrl } from '@/features/criativos/storage'
import { sizeOf, type CreativeSet, type Post, type Slide } from '@/features/criativos/types'

/**
 * O Instagram da equipe (`/crm/instagram`): a conta conectada pela API oficial
 * da Meta, os números de cada dia e de cada post, publicar e responder
 * comentários. Quem fala com a Meta é a função `instagram` do Supabase (o
 * token fica só lá); daqui se leem as tabelas que ela grava
 * (`crm_instagram_accounts`, `_daily`, `_media`) e se pede cada ação.
 */

export const CALLBACK_PATH = '/instagram/retorno'

export interface IgTotals {
  reach?: number
  views?: number
  accounts_engaged?: number
  total_interactions?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  replies?: number
  profile_links_taps?: number
  follows?: number
  unfollows?: number
  reach_followers?: number
  reach_non_followers?: number
}

export type AudienceKey = 'age' | 'gender' | 'city' | 'country'
export type IgAudience = Partial<Record<AudienceKey, Record<string, number>>>

export interface IgAccount {
  id: string
  teamId: string
  username: string
  name?: string
  accountType?: string
  picture?: string
  biography?: string
  website?: string
  followers?: number
  follows?: number
  mediaCount?: number
  totals: Partial<Record<'7' | '30', IgTotals>>
  audience: IgAudience
  quota?: { used: number; total: number }
  missing: string[]
  connectedBy?: string
  connectedAt: number
  tokenExpiresAt?: number
  syncedAt?: number
  /** `token`: a conexão caiu e precisa ser refeita. */
  syncError?: string
}

export interface IgDay {
  day: string
  reach?: number
  followers?: number
}

export interface IgInsights {
  reach?: number
  views?: number
  likes?: number
  comments?: number
  shares?: number
  saved?: number
  total_interactions?: number
  replies?: number
  follows?: number
  profile_visits?: number
  /** ms */
  ig_reels_avg_watch_time?: number
}

export interface IgMedia {
  id: string
  /** IMAGE, VIDEO, CAROUSEL_ALBUM */
  type: string
  /** FEED, REELS, STORY */
  product?: string
  caption?: string
  permalink?: string
  thumbnail?: string
  mediaUrl?: string
  postedAt: number
  likes?: number
  comments?: number
  insights: IgInsights
  publishedBy?: string
}

export type IgFormat = 'reels' | 'carrossel' | 'foto' | 'story'

export const FORMAT_LABEL: Record<IgFormat, string> = { reels: 'Reels', carrossel: 'Carrossel', foto: 'Foto', story: 'Story' }

export const formatOf = (m: Pick<IgMedia, 'type' | 'product'>): IgFormat =>
  m.product === 'STORY' ? 'story' : m.product === 'REELS' || m.type === 'VIDEO' ? 'reels' : m.type === 'CAROUSEL_ALBUM' ? 'carrossel' : 'foto'

/** Interações do post: o total da Meta, ou a soma do que veio. */
export const interactionsOf = (m: IgMedia) =>
  m.insights.total_interactions ?? (m.insights.likes ?? m.likes ?? 0) + (m.insights.comments ?? m.comments ?? 0) + (m.insights.shares ?? 0) + (m.insights.saved ?? 0)

/** Interações sobre alcance (0 a 1); sem alcance, nada. */
export const engagementOf = (m: IgMedia) => {
  const reach = m.insights.reach
  return reach ? interactionsOf(m) / reach : undefined
}

// ---------- leitura das tabelas ----------

interface AccountRow {
  id: string
  team_id: string
  username: string
  name: string | null
  account_type: string | null
  profile_picture_url: string | null
  biography: string | null
  website: string | null
  followers_count: number | null
  follows_count: number | null
  media_count: number | null
  totals: unknown
  audience: unknown
  publish_quota: unknown
  missing: string[] | null
  connected_by: string | null
  connected_at: string
  token_expires_at: string | null
  synced_at: string | null
  sync_error: string | null
}

const time = (at: string | null | undefined) => (at ? Date.parse(at) : undefined)
const num = (n: number | null | undefined) => (typeof n === 'number' ? n : undefined)

const toAccount = (r: AccountRow): IgAccount => ({
  id: r.id,
  teamId: r.team_id,
  username: r.username,
  name: r.name ?? undefined,
  accountType: r.account_type ?? undefined,
  picture: r.profile_picture_url ?? undefined,
  biography: r.biography ?? undefined,
  website: r.website ?? undefined,
  followers: num(r.followers_count),
  follows: num(r.follows_count),
  mediaCount: num(r.media_count),
  totals: (r.totals ?? {}) as IgAccount['totals'],
  audience: (r.audience ?? {}) as IgAudience,
  quota: (r.publish_quota ?? undefined) as IgAccount['quota'],
  missing: r.missing ?? [],
  connectedBy: r.connected_by ?? undefined,
  connectedAt: Date.parse(r.connected_at),
  tokenExpiresAt: time(r.token_expires_at),
  syncedAt: time(r.synced_at),
  syncError: r.sync_error ?? undefined,
})

/** Sem as tabelas (migração 20261024120000 não aplicada). */
export class NoTablesError extends Error {}

const noTables = (error: { code?: string }) => error.code === '42P01' || error.code === 'PGRST205'

export async function loadAccounts(teamId: string): Promise<IgAccount[]> {
  const { data, error } = await supabase.from('crm_instagram_accounts').select('*').eq('team_id', teamId).order('connected_at', { ascending: true })
  if (error) throw noTables(error) ? new NoTablesError('sem tabelas') : error
  return ((data ?? []) as unknown as AccountRow[]).map(toAccount)
}

/** Os dias guardados desde `since` (`2026-07-01`). */
export async function loadDays(accountId: string, since: string): Promise<IgDay[]> {
  const { data, error } = await supabase.from('crm_instagram_daily').select('day, reach, followers').eq('account_id', accountId).gte('day', since).order('day', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as { day: string; reach: number | null; followers: number | null }[]).map((d) => ({ day: d.day, reach: num(d.reach), followers: num(d.followers) }))
}

interface MediaRow {
  media_id: string
  media_type: string
  product_type: string | null
  caption: string | null
  permalink: string | null
  thumbnail_url: string | null
  media_url: string | null
  posted_at: string
  like_count: number | null
  comments_count: number | null
  insights: unknown
  published_by: string | null
}

export async function loadMedia(accountId: string, limit = 300): Promise<IgMedia[]> {
  const { data, error } = await supabase.from('crm_instagram_media')
    .select('media_id, media_type, product_type, caption, permalink, thumbnail_url, media_url, posted_at, like_count, comments_count, insights, published_by')
    .eq('account_id', accountId)
    .order('posted_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as unknown as MediaRow[]).map((m) => ({
    id: m.media_id,
    type: m.media_type,
    product: m.product_type ?? undefined,
    caption: m.caption ?? undefined,
    permalink: m.permalink ?? undefined,
    thumbnail: m.thumbnail_url ?? undefined,
    mediaUrl: m.media_url ?? undefined,
    postedAt: Date.parse(m.posted_at),
    likes: num(m.like_count),
    comments: num(m.comments_count),
    insights: (m.insights ?? {}) as IgInsights,
    publishedBy: m.published_by ?? undefined,
  }))
}

// ---------- a função do servidor ----------

/** Erro da função, com o código (`token`: conectar de novo; `not_configured`: falta o app da Meta). */
export class InstagramError extends Error {
  constructor(
    message: string,
    readonly code = 'error'
  ) {
    super(message)
  }
}

export async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  let result: { data: unknown; error: unknown }
  try {
    result = await supabase.functions.invoke('instagram', { body: { action, ...body } })
  } catch {
    throw new InstagramError('A função instagram não respondeu.', 'unavailable')
  }
  const { data, error } = result
  if (!error && data && typeof data === 'object' && !('error' in data)) return data as T
  const context = (error as { context?: unknown } | null)?.context
  const response = context instanceof Response ? context : undefined
  const failure = response
    ? await response.json().then((b: { error?: unknown; code?: unknown }) => b, () => undefined)
    : (data as { error?: unknown; code?: unknown } | null)
  if (response?.status === 404 && !failure?.error) throw new InstagramError('A função instagram não está publicada no Supabase.', 'unavailable')
  if (typeof failure?.error === 'string') throw new InstagramError(failure.error, typeof failure.code === 'string' ? failure.code : 'error')
  throw new InstagramError(response ? `A função instagram respondeu com erro ${response.status}.` : 'A função instagram não respondeu.', 'unavailable')
}

export const instagramStatus = () => call<{ configured: boolean; version: string; scopes: string[] }>('status')

/** Abre o login do Instagram nesta aba; a volta cai em `/instagram/retorno`. */
/**
 * O endereço de volta cadastrado no app da Meta: o do app publicado (a Meta
 * pede https), mesmo quando o login começa no servidor de dev.
 */
export const redirectUri = () => `${publicAppUrl()}${CALLBACK_PATH}`

export async function startConnect(teamId: string) {
  const { url } = await call<{ url: string }>('auth_url', { teamId, redirectUri: redirectUri() })
  window.location.assign(url)
}

export interface Connected {
  accountId: string
  username: string
  sync: { posts: number; missing: string[] } | { error: string }
}

/** Na tela de volta: o endereço dela é o que foi pedido à Meta. */
export const finishConnect = (code: string, state: string) => call<Connected>('connect', { code, state, redirectUri: `${window.location.origin}${CALLBACK_PATH}` })

export const connectWithToken = (teamId: string, token: string) => call<Connected>('connect_token', { teamId, token })

export const syncAccount = (accountId: string) => call<{ posts: number; missing: string[] }>('sync', { accountId })

/** Só os seguidores (uma chamada à Meta): o aviso do menu. */
export const refreshProfile = (accountId: string) => call<{ followers: number | null }>('profile', { accountId })

export const disconnectAccount = (accountId: string) => call<{ ok: true }>('disconnect', { accountId })

export interface IgComment {
  id: string
  text: string
  username?: string
  timestamp: string
  like_count?: number
  hidden?: boolean
  replies?: { data: IgComment[] }
}

export const listComments = (accountId: string, mediaId: string) => call<{ data: IgComment[] }>('comments', { accountId, mediaId }).then((r) => r.data ?? [])

export const replyComment = (accountId: string, commentId: string, message: string) => call<{ id: string }>('reply', { accountId, commentId, message })

export const hideComment = (accountId: string, commentId: string, hide: boolean) => call<{ success: boolean }>('hide', { accountId, commentId, hide })

export const deleteComment = (accountId: string, commentId: string) => call<{ success: boolean }>('delete_comment', { accountId, commentId })

// ---------- publicar ----------

export type PublishKind = 'feed' | 'story' | 'reel'

/** Um arquivo pronto para subir: foto já em JPEG no tamanho final, ou o vídeo como veio. */
export interface Prepared {
  id: string
  type: 'image' | 'video'
  blob: Blob
  /** Para a prévia. */
  url: string
  width: number
  height: number
  /** Segundos (vídeo). */
  duration?: number
  name: string
  /** O que mudou para caber no Instagram ("cortada para 4:5"). */
  note?: string
}

export const FEED_RATIO = { min: 4 / 5, max: 1.91 }
const MAX_SIDE = 1440
const MAX_VIDEO_MB = 300

const ratioLabel = (r: number) => (Math.abs(r - 0.8) < 0.01 ? '4:5' : Math.abs(r - 1.91) < 0.01 ? '1,91:1' : Math.abs(r - 1) < 0.01 ? '1:1' : r.toFixed(2).replace('.', ','))

const id = () => Math.random().toString(36).slice(2, 10)

const toJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não consegui gerar a imagem.'))), 'image/jpeg', 0.92))

/**
 * A foto em JPEG (o único formato que a API aceita), com no máximo 1440 px de
 * largura. `ratio` corta ao centro para essa proporção: no feed a foto precisa
 * ficar entre 4:5 e 1,91:1, e o carrossel inteiro segue a proporção da primeira.
 */
export async function prepareImage(source: Blob, name: string, ratio?: number): Promise<Prepared> {
  const bitmap = await createImageBitmap(source)
  let sx = 0
  let sy = 0
  let sw = bitmap.width
  let sh = bitmap.height
  let note: string | undefined
  if (ratio && Math.abs(sw / sh - ratio) > 0.005) {
    if (sw / sh > ratio) {
      sw = Math.round(sh * ratio)
      sx = Math.round((bitmap.width - sw) / 2)
    } else {
      sh = Math.round(sw / ratio)
      sy = Math.round((bitmap.height - sh) / 2)
    }
    note = `Cortada ao centro para ${ratioLabel(ratio)}`
  }
  const scale = Math.min(1, MAX_SIDE / sw)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sw * scale)
  canvas.height = Math.round(sh * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await toJpeg(canvas)
  return { id: id(), type: 'image', blob, url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height, name, note }
}

/** A proporção que o feed aceita mais perto da foto. */
export const feedRatio = (width: number, height: number) => Math.min(FEED_RATIO.max, Math.max(FEED_RATIO.min, width / height))

export async function prepareVideo(file: File): Promise<Prepared> {
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error(`O vídeo passa de ${MAX_VIDEO_MB} MB.`)
  const url = URL.createObjectURL(file)
  const meta = await new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration })
    video.onerror = () => reject(new Error('Não consegui ler esse vídeo (use MP4 ou MOV).'))
    video.src = url
  })
  const note = meta.duration < 3 ? 'O Instagram pede pelo menos 3 segundos.' : meta.duration > 900 ? 'O Instagram aceita reels de até 15 minutos.' : undefined
  return { id: id(), type: 'video', blob: file, url, ...meta, name: file.name, note }
}

/** Sobe para a pasta do Instagram da equipe (`crm/<equipe>/instagram/`), de onde a Meta baixa. */
async function upload(teamId: string, file: Prepared): Promise<string> {
  const ext = file.type === 'image' ? 'jpg' : /\.mov$/i.test(file.name) ? 'mov' : 'mp4'
  const path = `crm/${teamId}/instagram/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('space-projects')
    .upload(path, file.blob, { contentType: file.type === 'image' ? 'image/jpeg' : file.blob.type || 'video/mp4', upsert: false })
  if (error) throw new Error(`Não consegui enviar ${file.name}: ${error.message}`)
  return path
}

export type PublishStep = 'enviando' | 'preparando' | 'processando' | 'publicado'

export interface Published {
  mediaId: string
  permalink?: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Sobe os arquivos e publica. Foto sai na hora; vídeo o Instagram processa e
 * a tela pergunta a cada 10 segundos, por até 5 minutos.
 */
export async function publishPost(input: { teamId: string; accountId: string; kind: PublishKind; caption: string; files: Prepared[]; shareToFeed?: boolean; onStep?: (step: PublishStep) => void }): Promise<Published> {
  input.onStep?.('enviando')
  const paths = await Promise.all(input.files.map((f) => upload(input.teamId, f)))
  input.onStep?.('preparando')
  type Result = { status: 'published'; mediaId: string; permalink?: string } | { status: 'processing'; containerId: string }
  let result = await call<Result>('publish', {
    accountId: input.accountId,
    kind: input.kind,
    caption: input.caption,
    shareToFeed: input.shareToFeed,
    files: input.files.map((f, i) => ({ path: paths[i], type: f.type })),
  })
  const until = Date.now() + 5 * 60_000
  while (result.status === 'processing') {
    input.onStep?.('processando')
    if (Date.now() > until) throw new InstagramError('O Instagram ainda está processando o vídeo. Ele pode sair sozinho em alguns minutos; confira no perfil antes de tentar de novo.', 'processing')
    await sleep(10_000)
    result = await call<Result>('publish_check', { accountId: input.accountId, containerId: result.containerId, paths })
  }
  input.onStep?.('publicado')
  return { mediaId: result.mediaId, permalink: result.permalink }
}

// ---------- a partir do Criativos ----------

/** As fontes carregadas e as imagens dos slides prontas para o canvas (a exportação e as miniaturas dos stories). */
export async function creativeImages(set: CreativeSet, slides: Slide[]): Promise<ImageMap> {
  const fonts = new Set<string>([set.brand.headingFont, set.brand.bodyFont, EMPHASIS_FONT])
  const sources = new Set<string>()
  for (const slide of slides)
    for (const layer of slide.layers) {
      if (layer.type === 'text') fonts.add(layer.font)
      if (layer.type === 'image' && layer.src) sources.add(layer.src)
    }
  await Promise.all([...fonts].map((f) => loadFont(f).catch(() => undefined)))
  const images: ImageMap = new Map()
  await Promise.all(
    [...sources].map(async (src) => {
      try {
        let url = src
        if (src.startsWith('asset:')) {
          const asset = set.assets.find((a) => a.id === src.slice(6))
          if (!asset) return
          url = await assetUrl(asset)
        }
        images.set(src, await loadImage(url))
      } catch (error) {
        console.warn('[instagram] imagem do criativo', error)
      }
    })
  )
  return images
}

/** Os slides de um post do Criativos em JPEG, no tamanho real, como o editor baixa. */
export async function renderCreative(set: CreativeSet, post: Post): Promise<Blob[]> {
  const images = await creativeImages(set, post.slides)
  return Promise.all(post.slides.map((slide) => slideToBlob(slide, post.format, images, 'jpg')))
}

/** Story pede 9:16; feed, de 4:5 a 1,91:1. */
export const creativeFits = (post: Post): PublishKind => {
  const { width, height } = sizeOf(post.format)
  return width / height < FEED_RATIO.min - 0.01 ? 'story' : 'feed'
}

// ---------- números ----------

export const compact = (n: number | undefined) =>
  n === undefined ? '—' : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi` : n >= 10_000 ? `${(n / 1000).toFixed(1).replace('.', ',')} mil` : n.toLocaleString('pt-BR')

export const percent = (n: number | undefined, digits = 1) => (n === undefined || !Number.isFinite(n) ? '—' : `${(n * 100).toFixed(digits).replace('.', ',')}%`)

/** `2026-10-24` de hoje em São Paulo, menos `days`. */
export const dayKey = (daysAgo = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() - daysAgo * 86_400_000))
