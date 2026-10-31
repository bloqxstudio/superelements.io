import { resolveIa } from '@/features/ia/porTarefa'
import { AV_CASES } from '@/features/avence/cases'
import type { PlanRequest, PlanResponse, FormatKey } from './plan'
import { buildPost } from './templates'
import type { EditRequest, EditResponse } from './edit'
import { callAi, type CreativeStep } from './link'
import { LIBRARY } from './library'
import { drawSlide, type ImageMap } from './render'
import type { CreativeSet, Layer, Post, SetBrand, Slide } from './types'
import { FORMATS, sizeOf } from './types'

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
    engine: resolveIa('criativos'),
    cases: AV_CASES.filter((c) => form.cases.includes(c.slug)).map((c) => ({ slug: c.slug, name: c.name, segment: c.segment, place: c.place, summary: c.summary, stack: c.stack })),
  }
  const body = await callAi<Partial<PlanResponse>>('plan', request, signal)
  if (!body.posts) throw new Error('A IA não respondeu.')
  const known = new Set(AV_CASES.map((c) => c.slug))
  // Sem nenhum case escolhido (conjunto de outra marca, vindo de Conteúdos) nenhum slide usa case da Avence
  const noCases = form.cases.length === 0
  const posts = body.posts.map((p) =>
    buildPost(
      {
        name: p.name || 'Post',
        format: (p.format in FORMATS ? p.format : form.format) as Post['format'],
        caption: p.caption,
        slides: noCases
          ? p.slides.filter((s) => !s.template.startsWith('case-')).map((s) => ({ ...s, case: undefined }))
          : // Um case que a IA inventou vira o primeiro dos escolhidos
            p.slides.map((s) => ({ ...s, case: s.case && known.has(s.case) ? s.case : form.cases[0] ?? AV_CASES[0].slug })),
      },
      brand
    )
  )
  if (noCases && posts.some((p) => p.slides.length === 0)) throw new Error('A IA só montou telas de cases. Descreva melhor o post no briefing e tente de novo.')
  return posts
}

// Conversa de edição

export type EditScope = EditRequest['scope']

/** Camada inteira, só para o que a IA vai mexer; o resto vai resumido (menos texto, resposta mais rápida). */
const slimLayer = (l: Layer) => ({ id: l.id, type: l.type, name: l.name, ...(l.type === 'text' ? { text: l.text } : {}) })

/**
 * O conjunto como a IA lê: ids, caixas e textos. O que está em foco (o slide
 * escolhido, ou o post inteiro) vai completo; os demais slides, só com os textos.
 */
const compactPosts = (posts: Post[], focus: { postId?: string; slideId?: string; scope: EditScope }) =>
  posts.map((p) => ({
    id: p.id,
    name: p.name,
    format: p.format,
    width: sizeOf(p.format).width,
    height: sizeOf(p.format).height,
    caption: p.caption,
    slides: p.slides.map((s) => {
      const full = p.id === focus.postId && (focus.scope === 'post' || focus.scope === 'set' || s.id === focus.slideId)
      return { id: s.id, background: s.background, layers: full ? s.layers : s.layers.map(slimLayer) }
    }),
  }))

/** JPEG pequeno do slide, para a IA ver o que a pessoa vê. */
export function slidePreview(slide: Slide, format: Post['format'], images: ImageMap, side = 720 /* largura da imagem */): string {
  const { width, height } = sizeOf(format)
  const k = side / width
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * k)
  canvas.height = Math.round(height * k)
  const ctx = canvas.getContext('2d')!
  ctx.scale(k, k)
  drawSlide(ctx, slide, format, images)
  return canvas.toDataURL('image/jpeg', 0.8)
}

export interface EditCall {
  message: string
  scope: EditScope
  set: CreativeSet
  postId?: string
  slideId?: string
  layerId?: string
  layerIds?: string[]
  images: ImageMap
  history: { role: 'user' | 'ai'; text: string }[]
  attachments?: EditRequest['attachments']
  skill?: EditRequest['skill']
  agent?: EditRequest['agent']
  canGenerateImages?: boolean
  references?: EditRequest['references']
  projects?: string[]
}

export async function requestEdit(call: EditCall, fonts: string[], signal?: AbortSignal, onStep?: (step: CreativeStep) => void): Promise<EditResponse> {
  const { set } = call
  const post = set.posts.find((p) => p.id === call.postId)
  const slide = post?.slides.find((s) => s.id === call.slideId)
  const body: EditRequest = {
    agent: call.agent,
    canGenerateImages: call.canGenerateImages,
    references: call.references,
    projects: call.projects,
    message: call.message,
    scope: call.scope,
    postId: call.postId,
    slideId: call.slideId,
    layerId: call.layerId,
    layerIds: call.layerIds,
    brand: { name: set.brand.name, colors: set.brand.colors, headingFont: set.brand.headingFont, bodyFont: set.brand.bodyFont },
    // Escopo menor que o conjunto: só o post aberto vai para a IA
    posts: compactPosts(call.scope === 'set' || !post ? set.posts : [post], { postId: call.postId, slideId: call.slideId, scope: call.scope }),
    fonts,
    images: [
      ...LIBRARY.map((i) => ({ src: i.src, label: i.label })),
      ...set.assets.map((a) => ({ src: `asset:${a.id}`, label: `Enviada: ${a.name}` })),
      ...(set.brand.logoOnLight ? [{ src: set.brand.logoOnLight, label: 'Logo para fundo claro' }] : []),
      ...(set.brand.logoOnDark ? [{ src: set.brand.logoOnDark, label: 'Logo para fundo escuro' }] : []),
    ],
    // Conjunto vindo de Conteúdos: briefing do plano no pedido e nenhum case da Avence
    brief: set.source ? set.brief : undefined,
    cases: set.source ? [] : AV_CASES.map((c) => ({ slug: c.slug, name: c.name, segment: c.segment, summary: c.summary })),
    image: slide && post && call.scope !== 'post' ? slidePreview(slide, post.format, call.images) : undefined,
    // O post inteiro: a IA vê todos os cards, não só um
    previews: post && call.scope === 'post' ? post.slides.slice(0, 10).map((sl) => slidePreview(sl, post.format, call.images, 540)) : undefined,
    history: call.history,
    attachments: call.attachments,
    skill: call.skill,
  }
  const json = await callAi<Partial<EditResponse>>('edit', body, signal, onStep)
  if (!json.ops) throw new Error('A IA não respondeu.')
  return { reply: json.reply ?? '', ops: json.ops }
}
