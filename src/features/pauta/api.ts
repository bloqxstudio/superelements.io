import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { publicAppUrl } from '@/features/approval/shares'
import { listContents, toContent, toLink, type ContentRow, type LinkRow } from '@/features/conteudos/api'
import type { Content, ContentLink } from '@/features/conteudos/rules'
import { setHash } from '@/features/conteudos/forward'
import { coverUrls, loadSet, readSummaries } from '@/features/criativos/storage'
import type { PostInfo, SetSummary } from '@/features/criativos/types'

/**
 * Pauta no Supabase (migração 20261105120000). A equipe lê pelas políticas (membros, módulo Copy)
 * e grava pelas funções do servidor; o cliente só fala com as três funções públicas do link.
 */

const db = supabase as unknown as SupabaseClient
const BUCKET = 'crm-aprovacao'

const ERRORS: [string, string][] = [
  ['conflito_de_versao', 'Outra pessoa mudou este conteúdo agora. Recarregue a Pauta.'],
  ['nao_aprovado', 'Só vai ao cliente o que o gestor já aprovou.'],
  ['so_gestor', 'Só dono e gestor da conta enviam ao cliente.'],
  ['link_inativo', 'Este link não está mais ativo. Peça um novo à equipe.'],
  ['nome_obrigatorio', 'Escreva seu nome antes de responder.'],
  ['comentario_obrigatorio', 'Conte o que precisa mudar.'],
  ['limite_respostas', 'Este link recebeu respostas demais. Fale com a equipe.'],
  ['modulo_desligado', 'O módulo de conteúdos está desligado nesta conta.'],
  ['sem_acesso', 'Você não tem acesso a esta conta.'],
  ['tag_repetida', 'Já existe um tipo com esse nome.'],
  ['limite_tags', 'Limite de tipos atingido (5 por conteúdo, 40 por conta).'],
  ['campo_invalido', 'Algum campo está vazio ou longo demais.'],
]

export class PautaError extends Error {}

const fail = (error: { code?: string; message: string }): never => {
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202') throw new PautaError('Falta aplicar a migração 20261105120000_crm_pauta.sql no Supabase.')
  const hit = ERRORS.find(([k]) => error.message.includes(k))
  throw new PautaError(hit ? hit[1] : `Não consegui concluir (${error.message}).`)
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args)
  if (error) fail(error)
  return data as T
}

// ---------- leitura da Pauta ----------

export interface SentItem {
  id: string
  linkId: string
  contentId: string
  decision: 'pendente' | 'aprovado' | 'ajuste'
  decidedName?: string
  decidedAt?: number
  contentHash: string
  setHash: string
  media: SentPost[]
  createdAt: number
}

export interface SentPost {
  name: string
  format: string
  caption: string
  slides: string[]
  /** Como aparece no Instagram (envio de criativo, 2026-11-09): feed, carrossel, reels ou story. */
  view?: string
  /** A capa do vídeo, quando o slide é um MP4. */
  poster?: string
}

type ItemRow = { id: string; link_id: string; content_id: string; decision: SentItem['decision']; decided_name: string | null; decided_at: string | null; content_hash: string; set_hash: string; media: SentPost[]; created_at: string }

const toItem = (r: ItemRow): SentItem => ({
  id: r.id,
  linkId: r.link_id,
  contentId: r.content_id,
  decision: r.decision,
  decidedName: r.decided_name ?? undefined,
  decidedAt: r.decided_at ? Date.parse(r.decided_at) : undefined,
  contentHash: r.content_hash,
  setHash: r.set_hash,
  media: Array.isArray(r.media) ? r.media : [],
  createdAt: Date.parse(r.created_at),
})

export interface PautaData {
  contents: Content[]
  /** Conjunto de Criativos ligado a cada conteúdo. */
  creatives: Record<string, ContentLink>
  /** O envio mais recente de cada conteúdo. */
  sent: Record<string, SentItem>
  /** Comentários do cliente ainda não resolvidos, por conteúdo. */
  open: Record<string, number>
  /** Tipos de conteúdo da conta (migração 20261112120000), na ordem do catálogo. */
  tags: ContentTag[]
}

export async function loadPauta(teamId: string): Promise<PautaData> {
  const [contents, links, items, comments, tags] = await Promise.all([
    listContents(teamId),
    db.from('crm_content_links').select('*').eq('team_id', teamId).eq('kind', 'criativos'),
    db.from('crm_approval_items').select('id, link_id, content_id, decision, decided_name, decided_at, content_hash, set_hash, media, created_at').eq('team_id', teamId).order('created_at', { ascending: false }).limit(1000),
    db.from('crm_content_comments').select('content_id').eq('team_id', teamId).eq('from_client', true).is('resolved_at', null).limit(2000),
    listTags(teamId).catch((e) => {
      console.error('[pauta] tipos de conteúdo', e)
      return [] as ContentTag[]
    }),
  ])
  if (links.error) fail(links.error)
  if (items.error) fail(items.error)
  if (comments.error) fail(comments.error)
  const creatives: Record<string, ContentLink> = {}
  for (const r of (links.data ?? []) as LinkRow[]) creatives[r.content_id] = toLink(r)
  const sent: Record<string, SentItem> = {}
  for (const r of (items.data ?? []) as ItemRow[]) if (!sent[r.content_id]) sent[r.content_id] = toItem(r)
  const open: Record<string, number> = {}
  for (const r of (comments.data ?? []) as { content_id: string }[]) open[r.content_id] = (open[r.content_id] ?? 0) + 1
  return { contents, creatives, sent, open, tags }
}

// ---------- tipos de conteúdo (tags) ----------

export type TagColor = 'violet' | 'sky' | 'emerald' | 'amber' | 'rose' | 'orange' | 'teal' | 'slate'

export interface ContentTag {
  id: string
  name: string
  color: TagColor
  position: number
}

type TagRow = { id: string; name: string; color: TagColor; position: number }
const toTag = (r: TagRow): ContentTag => ({ id: r.id, name: r.name, color: r.color, position: r.position })

export async function listTags(teamId: string): Promise<ContentTag[]> {
  const { data, error } = await db.from('crm_content_tags').select('id, name, color, position').eq('team_id', teamId).order('position').order('created_at')
  if (error) fail(error)
  return ((data ?? []) as TagRow[]).map(toTag)
}

export async function saveTag(teamId: string, id: string | null, name: string, color: TagColor): Promise<ContentTag> {
  const row = await rpc<TagRow | TagRow[]>('crm_content_tag_save', { p_team: teamId, p_id: id, p_name: name, p_color: color })
  return toTag(Array.isArray(row) ? row[0] : row)
}

export const deleteTag = (id: string) => rpc<void>('crm_content_tag_delete', { p_id: id })

export async function setContentTags(id: string, tagIds: string[]): Promise<Content> {
  const row = await rpc<ContentRow | ContentRow[]>('crm_content_set_tags', { p_id: id, p_tags: tagIds })
  return toContent(Array.isArray(row) ? row[0] : row)
}

export const contentFromRow = (row: unknown) => toContent(row as ContentRow)

export async function scheduleContent(c: Content, date: string | null, time: string | null, channel: string | null): Promise<Content> {
  const row = await rpc<ContentRow | ContentRow[]>('crm_content_schedule', { p_id: c.id, p_expected: c.version, p_date: date, p_time: date && time ? time : null, p_channel: channel || null })
  return toContent(Array.isArray(row) ? row[0] : row)
}

// ---------- capas dos criativos ----------

export interface CoverInfo {
  summary: SetSummary
  posts: PostInfo[]
  urls: Record<string, string>
}

/** A capa de cada conteúdo com criativo: uma leitura do índice por pasta, capas pelo cache de 7 dias. */
export async function loadCovers(creatives: Record<string, ContentLink>): Promise<Record<string, CoverInfo>> {
  const byFolder = new Map<string, ContentLink[]>()
  for (const link of Object.values(creatives)) {
    const key = link.projectId ?? ''
    byFolder.set(key, [...(byFolder.get(key) ?? []), link])
  }
  const out: Record<string, CoverInfo> = {}
  const paths: string[] = []
  await Promise.all(
    [...byFolder.entries()].map(async ([folder, links]) => {
      const list = await readSummaries(folder || undefined).catch(() => [] as SetSummary[])
      for (const link of links) {
        const summary = list.find((s) => s.id === link.artifactId)
        if (!summary) continue
        const posts = summary.postsInfo ?? []
        out[link.contentId] = { summary, posts, urls: {} }
        for (const p of posts) if (p.cover) paths.push(p.cover)
      }
    })
  )
  if (paths.length) {
    const urls = await coverUrls(paths).catch(() => ({}) as Record<string, string>)
    for (const info of Object.values(out)) info.urls = urls
  }
  return out
}

// ---------- envios ao cliente ----------

export const approvalUrl = (id: string) => `${publicAppUrl()}/pauta/aprovar/${id}`
export const mediaUrl = (path: string) => db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

export interface ApprovalLink {
  id: string
  title: string
  message: string
  createdAt: number
  expiresAt: number
  revokedAt?: number
  createdBy?: string
  items: { contentId: string | null; decision: SentItem['decision'] }[]
}

export async function listApprovalLinks(teamId: string): Promise<ApprovalLink[]> {
  const { data, error } = await db
    .from('crm_approval_links')
    .select('id, title, message, created_at, expires_at, revoked_at, created_by, items:crm_approval_items(content_id, decision)')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) fail(error)
  return ((data ?? []) as { id: string; title: string; message: string; created_at: string; expires_at: string; revoked_at: string | null; created_by: string | null; items: { content_id: string | null; decision: SentItem['decision'] }[] }[]).map((r) => ({
    id: r.id,
    title: r.title,
    message: r.message,
    createdAt: Date.parse(r.created_at),
    expiresAt: Date.parse(r.expires_at),
    revokedAt: r.revoked_at ? Date.parse(r.revoked_at) : undefined,
    createdBy: r.created_by ?? undefined,
    items: (r.items ?? []).map((i) => ({ contentId: i.content_id, decision: i.decision })),
  }))
}

export const revokeApprovalLink = (id: string) => rpc<null>('crm_approval_revoke', { p_link: id })

export type SendStep = { done: number; total: number; label: string }

/**
 * Envia ao cliente: desenha cada slide dos criativos ligados em JPEG (o mesmo desenho do editor),
 * sobe à pasta do envio e grava o envio com a foto de cada conteúdo. O cliente aprova o que viu.
 */
export async function sendToClient(teamId: string, title: string, message: string, contents: Content[], creatives: Record<string, ContentLink>, onStep?: (s: SendStep) => void): Promise<string> {
  const { renderCreative } = await import('@/features/crm/instagram')
  const linkId = crypto.randomUUID()
  const items: { contentId: string; setHash: string; media: SentPost[] }[] = []
  let done = 0
  for (const c of contents) {
    onStep?.({ done, total: contents.length, label: c.title })
    const link = creatives[c.id]
    const media: SentPost[] = []
    let hash = ''
    if (link) {
      const set = await loadSet(link.artifactId, link.projectId).catch(() => undefined)
      if (set) {
        hash = await setHash(set)
        for (const [pi, post] of set.posts.slice(0, 10).entries()) {
          const blobs = (await renderCreative(set, post)).slice(0, 20)
          const slides: string[] = []
          for (const [si, blob] of blobs.entries()) {
            const path = `${teamId}/${linkId}/${c.id}/p${pi + 1}-s${si + 1}.jpg`
            const { error } = await db.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
            if (error) throw new PautaError(`Não consegui enviar as imagens de "${c.title}" (${error.message}).`)
            slides.push(path)
          }
          media.push({ name: post.name ?? '', format: post.format, caption: post.caption ?? '', slides })
        }
      }
    }
    items.push({ contentId: c.id, setHash: hash, media })
    done += 1
  }
  onStep?.({ done, total: contents.length, label: 'Gravando o envio' })
  await rpc<string>('crm_approval_create', { p_team: teamId, p_link: linkId, p_title: title.trim(), p_message: message.trim(), p_items: items })
  return linkId
}

// ---------- comentários (equipe) ----------

export interface Comment {
  id: string
  contentId: string
  itemId?: string
  authorId?: string
  name: string
  client: boolean
  internal: boolean
  post?: number
  slide?: number
  body: string
  createdAt: number
  resolved: boolean
}

type CommentRow = { id: string; content_id: string; item_id: string | null; author_id: string | null; author_name: string; from_client: boolean; internal: boolean; post: number | null; slide: number | null; body: string; created_at: string; resolved_at: string | null }

const toComment = (r: CommentRow): Comment => ({
  id: r.id,
  contentId: r.content_id,
  itemId: r.item_id ?? undefined,
  authorId: r.author_id ?? undefined,
  name: r.author_name,
  client: r.from_client,
  internal: r.internal,
  post: r.post ?? undefined,
  slide: r.slide ?? undefined,
  body: r.body,
  createdAt: Date.parse(r.created_at),
  resolved: !!r.resolved_at,
})

export async function listComments(contentId: string): Promise<Comment[]> {
  const { data, error } = await db.from('crm_content_comments').select('*').eq('content_id', contentId).order('created_at').limit(500)
  if (error) fail(error)
  return ((data ?? []) as CommentRow[]).map(toComment)
}

export const addComment = async (contentId: string, body: string, internal: boolean, post?: number, slide?: number) =>
  toComment(await rpc<CommentRow>('crm_content_comment', { p_content: contentId, p_body: body, p_internal: internal, p_post: post ?? null, p_slide: slide ?? null }))

export const resolveComment = (id: string, resolved: boolean) => rpc<null>('crm_content_comment_resolve', { p_comment: id, p_resolved: resolved })
export const deleteComment = (id: string) => rpc<null>('crm_content_comment_delete', { p_comment: id })

// ---------- página pública do cliente ----------

export interface PublicComment {
  id: string
  name: string
  client: boolean
  post?: number
  slide?: number
  body: string
  createdAt: number
  resolved: boolean
}

export interface PublicItem {
  id: string
  /** `criativo`: um post enviado do editor de criativos, sem conteúdo da Pauta. */
  kind: 'conteudo' | 'criativo'
  title: string
  format: string
  channel?: string
  date?: string
  time?: string
  script: string
  media: SentPost[]
  decision: SentItem['decision']
  decidedName?: string
  decidedAt?: number
  replaced: boolean
  comments: PublicComment[]
}

export type PublicApproval =
  | { state: 'inexistente' | 'revogado' | 'expirado'; teamName?: string; title?: string }
  | { state: 'ativo'; id: string; title: string; teamName: string; message: string; createdAt: number; expiresAt: number; items: PublicItem[]; igUsername?: string }

type RawPublic = {
  state: 'ativo' | 'inexistente' | 'revogado' | 'expirado'
  id?: string
  title?: string
  team_name?: string
  message?: string
  ig_username?: string | null
  created_at?: string
  expires_at?: string
  items?: {
    id: string
    kind?: 'conteudo' | 'criativo'
    title: string
    format: string
    channel: string | null
    date: string | null
    time: string | null
    script: string
    media: SentPost[]
    decision: SentItem['decision']
    decided_name: string | null
    decided_at: string | null
    replaced: boolean
    comments: { id: string; name: string; client: boolean; post: number | null; slide: number | null; body: string; created_at: string; resolved: boolean }[]
  }[]
}

export async function getApproval(id: string): Promise<PublicApproval> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { state: 'inexistente' }
  const raw = await rpc<RawPublic>('crm_approval_get', { p_link: id })
  if (raw.state !== 'ativo') return { state: raw.state, teamName: raw.team_name, title: raw.title }
  return {
    state: 'ativo',
    id: raw.id!,
    title: raw.title ?? '',
    teamName: raw.team_name ?? '',
    message: raw.message ?? '',
    igUsername: raw.ig_username ?? undefined,
    createdAt: Date.parse(raw.created_at!),
    expiresAt: Date.parse(raw.expires_at!),
    items: (raw.items ?? []).map((i) => ({
      id: i.id,
      kind: i.kind ?? 'conteudo',
      title: i.title,
      format: i.format,
      channel: i.channel ?? undefined,
      date: i.date ?? undefined,
      time: i.time ?? undefined,
      script: i.script,
      media: Array.isArray(i.media) ? i.media : [],
      decision: i.decision,
      decidedName: i.decided_name ?? undefined,
      decidedAt: i.decided_at ? Date.parse(i.decided_at) : undefined,
      replaced: i.replaced,
      comments: (i.comments ?? []).map((c) => ({ id: c.id, name: c.name, client: c.client, post: c.post ?? undefined, slide: c.slide ?? undefined, body: c.body, createdAt: Date.parse(c.created_at), resolved: c.resolved })),
    })),
  }
}

export const respondApproval = (link: string, item: string, decision: 'aprovado' | 'ajuste', name: string, note: string) =>
  rpc<{ decision: string }>('crm_approval_respond', { p_link: link, p_item: item, p_decision: decision, p_name: name, p_note: note })

export const commentApproval = (link: string, item: string, name: string, body: string, post?: number, slide?: number) =>
  rpc<{ id: string }>('crm_approval_comment', { p_link: link, p_item: item, p_name: name, p_body: body, p_post: post ?? null, p_slide: slide ?? null })
