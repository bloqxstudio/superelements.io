import { AV_CASES } from '@/features/avence/cases'
import type { PlanRequest, PlanResponse, FormatKey } from './plan'
import { buildPost } from './templates'
import type { Post, SetBrand } from './types'
import { FORMATS } from './types'

/** A IA roda no Claude Code desta máquina, pelo servidor de desenvolvimento; no app publicado não existe. */
export async function aiAvailable(): Promise<boolean> {
  if (!import.meta.env.DEV) return false
  try {
    const res = await fetch('/__criativos/status', { cache: 'no-store' })
    return res.ok && (await res.json()).ia === true
  } catch {
    return false
  }
}

export interface AiForm {
  brief: string
  format: FormatKey
  slides: number
  posts: number
  /** `slug` dos cases que o post pode usar. */
  cases: string[]
}

export const AI_EXAMPLES = [
  'Apresentar o estúdio mostrando três cases, para donos de negócio que anunciam e o site não traz conversa.',
  'Um carrossel que mostra o ProcessBase por dentro: capa, a página inteira no computador, no celular e o convite.',
  'Post sobre site parado no tempo e o que muda com um site novo. Sem promessa de resultado.',
]

export async function generatePosts(form: AiForm, brand: SetBrand, signal?: AbortSignal): Promise<Post[]> {
  const request: PlanRequest = {
    brief: form.brief,
    format: form.format,
    slides: form.slides,
    posts: form.posts,
    cases: AV_CASES.filter((c) => form.cases.includes(c.slug)).map((c) => ({ slug: c.slug, name: c.name, segment: c.segment, place: c.place, summary: c.summary, stack: c.stack })),
  }
  const res = await fetch('/__criativos/plano', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal })
  const body = (await res.json().catch(() => ({}))) as Partial<PlanResponse> & { error?: string }
  if (!res.ok || !body.posts) throw new Error(body.error ?? 'A IA não respondeu.')
  const known = new Set(AV_CASES.map((c) => c.slug))
  return body.posts.map((p) =>
    buildPost(
      {
        name: p.name || 'Post',
        format: (p.format in FORMATS ? p.format : form.format) as Post['format'],
        caption: p.caption,
        // Um case que a IA inventou vira o primeiro dos escolhidos
        slides: p.slides.map((s) => ({ ...s, case: s.case && known.has(s.case) ? s.case : form.cases[0] ?? AV_CASES[0].slug })),
      },
      brand
    )
  )
}
