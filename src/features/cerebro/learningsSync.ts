import { supabase } from '@/integrations/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { learningsNote, learningsPath, type LearningFacts } from './learnings'

/**
 * Lê os números da conta e grava a nota de aprendizados do mês no Cérebro (`learnings.ts`). Roda sozinha
 * uma vez por mês por conta, quando alguém abre o Início (o radar chama), e pode ser refeita do Cérebro.
 */

const db = supabase as unknown as SupabaseClient
const day = (iso: string) => iso.slice(0, 10)

export async function buildLearnings(teamId: string, now = new Date()): Promise<{ path: string; content: string }> {
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [media, comments, items] = await Promise.all([
    db.from('crm_instagram_media').select('caption, permalink, posted_at, media_type, product_type, like_count, comments_count, insights').eq('team_id', teamId).gte('posted_at', since).limit(200)
      .then(({ data }) => (data ?? []) as { caption: string | null; permalink: string | null; posted_at: string; media_type: string; product_type: string | null; like_count: number | null; comments_count: number | null; insights: Record<string, number> | null }[], () => []),
    db.from('crm_content_comments').select('body, created_at, content_id').eq('team_id', teamId).eq('from_client', true).gte('created_at', since).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => (data ?? []) as { body: string; created_at: string; content_id: string }[], () => []),
    db.from('crm_approval_items').select('decision, decided_at').eq('team_id', teamId).gte('decided_at', since).limit(500)
      .then(({ data }) => (data ?? []) as { decision: string | null }[], () => []),
  ])
  const ids = [...new Set(comments.map((c) => c.content_id))]
  const titles = new Map<string, string>()
  if (ids.length) {
    const { data } = await db.from('crm_contents').select('id, title').in('id', ids)
    for (const r of (data ?? []) as { id: string; title: string }[]) titles.set(r.id, r.title)
  }
  const facts: LearningFacts = {
    month,
    posts: media.map((m) => ({
      caption: m.caption ?? '',
      permalink: m.permalink ?? undefined,
      postedAt: day(m.posted_at),
      kind: m.product_type === 'REELS' ? 'REELS' : m.media_type,
      likes: m.insights?.likes ?? m.like_count ?? 0,
      comments: m.insights?.comments ?? m.comments_count ?? 0,
      saved: m.insights?.saved ?? 0,
      shares: m.insights?.shares ?? 0,
      reach: m.insights?.reach ?? 0,
    })),
    clientComments: comments.map((c) => ({ title: titles.get(c.content_id) ?? 'Peça', body: c.body, at: day(c.created_at) })),
    approved: items.filter((i) => i.decision === 'aprovado').length,
    adjusted: items.filter((i) => i.decision === 'ajuste').length,
  }
  return { path: learningsPath(month), content: learningsNote(facts) }
}

/** Grava a nota do mês se ainda não existe (ou sempre, com `force`). Devolve o caminho gravado. */
export async function syncLearnings(teamId: string, force = false): Promise<string | undefined> {
  const { path, content } = await buildLearnings(teamId)
  if (!force) {
    const { data } = await db.from('crm_knowledge_notes').select('id').eq('team_id', teamId).eq('path', path).maybeSingle()
    if (data) return undefined
  }
  const { error } = await db.from('crm_knowledge_notes').upsert({ team_id: teamId, path, content }, { onConflict: 'team_id,path' })
  if (error) throw new Error(error.message)
  return path
}
