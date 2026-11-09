import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { creativeImages, renderCreative } from '@/features/crm/instagram'
import { approvalUrl } from '@/features/pauta/api'
import { hasMotion, hasMotionData } from './motion'
import type { CreativeSet, Post } from './types'
import { audioFor, coverAtOf, frameAt, postToCarousel, postToMp4, videoSupported } from './video'

/**
 * Mandar um criativo para o cliente aprovar (2026-11-09; o usuário: "enviar um link para o cliente
 * aprovar do criativo, podendo ser estático, carrossel, vídeo ou motion… visualizar como vai ficar no
 * Instagram dele simuladamente e aprovar por esse link, ou colocar algum ajuste").
 *
 * Usa o mesmo envio da Pauta (página /pauta/aprovar/:id, migração 20261109140000): cada post vira um
 * item `criativo` com as imagens (ou o vídeo, quando o post tem motion) no bucket público
 * `crm-aprovacao`, enviados uma vez só (cache de um ano; nada de link assinado). A página desenha como
 * no Instagram: feed, carrossel, Reels ou story.
 */

const db = supabase as unknown as SupabaseClient
const BUCKET = 'crm-aprovacao'

export type ApprovalView = 'feed' | 'carrossel' | 'reels' | 'story'

export const VIEW_LABEL: Record<ApprovalView, string> = { feed: 'Post no feed', carrossel: 'Carrossel', reels: 'Reels', story: 'Story' }

/** Como o post aparece no Instagram, pelo formato e pelo movimento (`animate`: se vai animado). */
export function viewOf(post: Post, animate = hasMotion(post)): ApprovalView {
  if (post.format === '9x16') return animate ? 'reels' : 'story'
  return post.slides.length > 1 ? 'carrossel' : 'feed'
}

/** As vistas que fazem sentido para o post (a pessoa pode trocar Reels por Story, por exemplo). */
export function viewsFor(post: Post): ApprovalView[] {
  if (post.format === '9x16') return post.slides.length > 1 ? ['story', 'reels'] : ['reels', 'story']
  return post.slides.length > 1 ? ['carrossel'] : ['feed']
}

export interface SendInput {
  teamId: string
  set: CreativeSet
  /** `animate`: manda em vídeo (só vale se o post tem animação); falso manda as imagens paradas. */
  posts: { post: Post; view: ApprovalView; animate: boolean }[]
  title: string
  message: string
  /** O @ do Instagram que a simulação mostra. */
  ig?: string
  onStep?: (text: string) => void
}

const upload = async (path: string, blob: Blob, type: string) => {
  const { error } = await db.storage.from(BUCKET).upload(path, blob, { contentType: type, cacheControl: '31536000', upsert: false })
  if (error) throw new Error(/mime|type/i.test(error.message) ? 'O armazenamento recusou o arquivo.' : error.message)
}

/** Gera as peças, sobe e cria o link. Devolve o endereço para mandar ao cliente. */
export async function sendCreativeApproval(input: SendInput): Promise<{ id: string; url: string }> {
  const link = crypto.randomUUID()
  const say = (t: string) => input.onStep?.(t)
  const items = []
  for (const [index, { post, view, animate }] of input.posts.entries()) {
    const item = crypto.randomUUID()
    const base = `${input.teamId}/${link}/${item}`
    const label = post.name || `Post ${index + 1}`
    const images = await creativeImages(input.set, post.slides)
    const slides: string[] = []
    let poster: string | undefined
    // Vai animado só se a pessoa escolheu e o post tem animação (mesmo marcado como estático no editor)
    const moving = animate && hasMotionData(post) && videoSupported()
    if (moving && post.slides.length === 1) {
      say(`Gerando o vídeo de ${label}`)
      const audio = await audioFor(post, input.set.assets).catch(() => undefined)
      const video = await postToMp4(post, images, { audio })
      say(`Enviando ${label}`)
      await upload(`${base}/p1-s1.mp4`, video, 'video/mp4')
      slides.push(`${base}/p1-s1.mp4`)
      const cover = await frameAt(post, images, coverAtOf(post))
      await upload(`${base}/p1-capa.jpg`, cover, 'image/jpeg')
      poster = `${base}/p1-capa.jpg`
    } else if (moving) {
      say(`Gerando os slides animados de ${label}`)
      const audio = await audioFor(post, input.set.assets).catch(() => undefined)
      const parts = await postToCarousel(post, images, { audio, base: 'slide' })
      say(`Enviando ${label}`)
      for (const [i, part] of parts.entries()) {
        const path = `${base}/p1-s${i + 1}.${part.type === 'video' ? 'mp4' : 'jpg'}`
        await upload(path, part.blob, part.type === 'video' ? 'video/mp4' : 'image/jpeg')
        slides.push(path)
      }
    } else {
      say(`Gerando as imagens de ${label}`)
      const blobs = await renderCreative(input.set, post)
      say(`Enviando ${label}`)
      for (const [i, blob] of blobs.entries()) {
        const path = `${base}/p1-s${i + 1}.jpg`
        await upload(path, blob, 'image/jpeg')
        slides.push(path)
      }
    }
    items.push({
      itemId: item,
      setId: input.set.id,
      postId: post.id,
      setHash: '',
      title: post.name || input.title,
      format: post.format,
      media: [{ name: label, format: post.format, caption: post.caption ?? '', view, slides, poster }],
    })
  }
  say('Criando o link')
  const { error } = await db.rpc('crm_creative_approval_create', {
    p_team: input.teamId,
    p_link: link,
    p_title: input.title.trim(),
    p_message: input.message.trim(),
    p_ig: input.ig?.replace(/^@/, '').trim() || null,
    p_items: items,
  })
  if (error) throw new Error(/modulo_desligado/.test(error.message) ? 'Os módulos de conteúdo e criativos estão desligados nesta conta.' : /sem_acesso/.test(error.message) ? 'Você não é desta conta.' : error.message)
  return { id: link, url: approvalUrl(link) }
}

export interface CreativeApprovalStatus {
  itemId: string
  linkId: string
  decision: 'pendente' | 'aprovado' | 'ajuste'
  decidedName?: string
  decidedAt?: number
  sentAt: number
  url: string
  comments: { id: string; name: string; body: string; client: boolean; createdAt: number }[]
}

/** O último envio deste post (para o editor mostrar se o cliente aprovou ou pediu ajuste). */
export async function latestCreativeApproval(setId: string, postId: string): Promise<CreativeApprovalStatus | undefined> {
  const { data, error } = await db
    .from('crm_approval_items')
    .select('id, link_id, decision, decided_name, decided_at, created_at, comments:crm_content_comments(id, author_name, body, from_client, internal, created_at)')
    .eq('kind', 'criativo')
    .eq('set_id', setId)
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return undefined
  const row = data as { id: string; link_id: string; decision: CreativeApprovalStatus['decision']; decided_name: string | null; decided_at: string | null; created_at: string; comments: { id: string; author_name: string; body: string; from_client: boolean; internal: boolean; created_at: string }[] }
  return {
    itemId: row.id,
    linkId: row.link_id,
    decision: row.decision,
    decidedName: row.decided_name ?? undefined,
    decidedAt: row.decided_at ? Date.parse(row.decided_at) : undefined,
    sentAt: Date.parse(row.created_at),
    url: approvalUrl(row.link_id),
    comments: (row.comments ?? []).filter((c) => !c.internal).map((c) => ({ id: c.id, name: c.author_name, body: c.body, client: c.from_client, createdAt: Date.parse(c.created_at) })).sort((a, b) => a.createdAt - b.createdAt),
  }
}

/** O @ da conta de Instagram ligada a esta conta (para a simulação). */
export async function accountInstagram(teamId: string): Promise<string | undefined> {
  const { data } = await db.from('crm_instagram_accounts').select('username').eq('team_id', teamId).limit(1).maybeSingle()
  return (data as { username?: string } | null)?.username ?? undefined
}
