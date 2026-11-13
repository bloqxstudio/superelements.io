import { useEditor, currentPost } from './store'
import { sizeOf, uid, type CreativeSet, type FormatId, type Layer, type Post, type Slide } from './types'

/**
 * Copiar, colar e mover slides e posts dentro do conjunto: Ctrl/⌘ + C e V no
 * canvas, e o arrasto de um slide para outro post. Uma cópia ganha ids novos
 * (os grupos viram grupos novos) e sai da faixa contínua do post de origem;
 * num post de outro formato, as camadas acompanham a proporção.
 */

/** O slide no formato do post de destino (como `reformat` faz com o post inteiro). */
export function fitSlide(slide: Slide, from: FormatId, to: FormatId): Slide {
  if (from === to) return slide
  const a = sizeOf(from)
  const b = sizeOf(to)
  const fx = b.width / a.width
  const fy = b.height / a.height
  const f = Math.min(fx, fy)
  return {
    ...slide,
    layers: slide.layers.map((l) => ({ ...l, x: l.x * fx, y: l.y * fy, w: l.w * fx, h: l.h * fy, ...(l.type === 'text' ? { size: l.size * f } : {}) })) as Layer[],
  }
}

/** Ids novos para o slide e as camadas; grupos novos; fora da faixa contínua (ela é do post de origem). */
export function cloneSlide(slide: Slide): Slide {
  const groups = new Map<string, string>()
  const groupOf = (g?: string) => {
    if (!g) return undefined
    if (!groups.has(g)) groups.set(g, uid())
    return groups.get(g)
  }
  return {
    ...slide,
    id: uid(),
    layers: slide.layers.map((l) => {
      const { span: _span, ...rest } = l
      return { ...rest, id: uid(), group: groupOf(l.group) } as Layer
    }),
  }
}

/** Ids novos no post inteiro (as faixas contínuas continuam faixas, com ids próprios). */
export function clonePost(post: Post, name?: string): Post {
  const spans = new Map<string, string>()
  const groups = new Map<string, string>()
  const map = (m: Map<string, string>, k?: string) => {
    if (!k) return undefined
    if (!m.has(k)) m.set(k, uid())
    return m.get(k)
  }
  return {
    ...post,
    id: uid(),
    name: name ?? `${post.name} (cópia)`,
    approved: undefined,
    slides: post.slides.map((s) => ({
      ...s,
      id: uid(),
      layers: s.layers.map((l) => ({ ...l, id: uid(), group: map(groups, l.group), span: l.span ? { id: map(spans, l.span.id)!, index: l.span.index } : undefined }) as Layer),
    })),
  }
}

/** Tira o slide da faixa contínua quando ele muda de post. */
const unspan = (slide: Slide): Slide => (slide.layers.some((l) => l.span) ? { ...slide, layers: slide.layers.map((l) => (l.span ? ({ ...l, span: undefined } as Layer) : l)) } : slide)

/**
 * Move (ou copia) um slide para a posição `index` de um post. No mesmo post só
 * reordena; noutro, o slide vai no formato do destino. O post de origem nunca
 * fica sem slide: mover o último vira cópia.
 */
export function moveSlide(set: CreativeSet, from: { postId: string; slideId: string }, to: { postId: string; index: number }, copy: boolean): { set: CreativeSet; slideId: string } | undefined {
  const source = set.posts.find((p) => p.id === from.postId)
  const target = set.posts.find((p) => p.id === to.postId)
  const slide = source?.slides.find((s) => s.id === from.slideId)
  if (!source || !target || !slide) return undefined
  const keep = copy || (source.id !== target.id && source.slides.length < 2)
  const moved = keep ? cloneSlide(slide) : source.id === target.id ? slide : unspan(slide)
  const placed = fitSlide(moved, source.format, target.format)
  const posts = set.posts.map((p) => {
    let slides = p.slides
    if (p.id === source.id && !keep) slides = slides.filter((s) => s.id !== slide.id)
    if (p.id === target.id) {
      // No mesmo post, a posição conta sem o slide que saiu
      const before = p.id === source.id && !keep ? p.slides.slice(0, to.index).filter((s) => s.id !== slide.id).length : to.index
      slides = [...slides]
      slides.splice(Math.max(0, Math.min(slides.length, before)), 0, placed)
    }
    return slides === p.slides ? p : { ...p, slides }
  })
  return { set: { ...set, posts }, slideId: placed.id }
}

// Área de transferência do conjunto

type Clip = { kind: 'slide'; slide: Slide; format: FormatId; setId: string } | { kind: 'post'; post: Post; setId: string } | { kind: 'layers'; layers: Layer[]; format: FormatId; setId: string }

let clip: Clip | undefined
/** O texto que vai para a área de transferência do sistema: se ele mudou, a pessoa copiou outra coisa depois. */
let marker = ''

const LABEL = { slide: 'slide', post: 'post', layers: 'componentes' } as const

/**
 * Copia o que está escolhido: componentes, o post inteiro (fileira escolhida) ou
 * o slide aberto. Devolve o que copiou, ou nada.
 */
export function copySelection(data?: DataTransfer | null): Clip['kind'] | undefined {
  const st = useEditor.getState()
  const post = currentPost(st)
  if (!st.set || !post) return undefined
  const slide = post.slides.find((s) => s.id === st.slideId)
  if (st.layerIds.length && slide) {
    const layers = slide.layers.filter((l) => st.layerIds.includes(l.id))
    if (layers.length) clip = { kind: 'layers', layers: structuredClone(layers), format: post.format, setId: st.set.id }
  } else if (st.row) clip = { kind: 'post', post: structuredClone(post), setId: st.set.id }
  else if (slide) clip = { kind: 'slide', slide: structuredClone(slide), format: post.format, setId: st.set.id }
  else return undefined
  marker = `Criativo copiado (${LABEL[clip.kind]}) · ${uid()}`
  data?.setData('text/plain', marker)
  return clip.kind
}

/** Cola o que foi copiado aqui, se a área de transferência ainda é ela. */
export function pasteClip(text: string | undefined, force = false): Clip['kind'] | undefined {
  if (!clip || (!force && text !== marker)) return undefined
  const st = useEditor.getState()
  const post = currentPost(st)
  // As fotos enviadas são de cada conjunto: a cópia vale dentro do mesmo conjunto
  if (!st.set || !post || clip.setId !== st.set.id) return undefined
  if (clip.kind === 'post') {
    const copy = clonePost(clip.post)
    const at = st.set.posts.findIndex((p) => p.id === post.id)
    st.edit((s) => {
      const posts = [...s.posts]
      posts.splice(at + 1, 0, copy)
      return { ...s, posts }
    })
    st.selectRow(copy.id)
  } else if (clip.kind === 'slide') {
    const copy = fitSlide(cloneSlide(clip.slide), clip.format, post.format)
    const at = post.slides.findIndex((s) => s.id === st.slideId)
    st.edit((s) => ({ ...s, posts: s.posts.map((p) => (p.id !== post.id ? p : { ...p, slides: [...p.slides.slice(0, at + 1), copy, ...p.slides.slice(at + 1)] })) }))
    st.selectSlide(copy.id)
  } else {
    const slideId = st.slideId
    if (!slideId) return undefined
    const sameFormat = clip.format === post.format
    const fitted = fitSlide({ id: '', background: '', layers: clip.layers }, clip.format, post.format).layers
    const groups = new Map<string, string>()
    const copies = fitted.map((l) => {
      const { span: _span, ...rest } = l
      const group = l.group ? groups.get(l.group) ?? groups.set(l.group, uid()).get(l.group) : undefined
      const here = post.slides.find((s) => s.id === slideId)?.layers.some((x) => x.id === l.id)
      // Colar no mesmo slide desloca um pouco, para a cópia não sumir atrás da original
      const shift = here && sameFormat ? 30 : 0
      return { ...rest, id: uid(), group, x: l.x + shift, y: l.y + shift } as Layer
    })
    st.edit((s) => ({ ...s, posts: s.posts.map((p) => (p.id !== post.id ? p : { ...p, slides: p.slides.map((x) => (x.id === slideId ? { ...x, layers: [...x.layers, ...copies] } : x)) })) }))
    st.selectLayers(copies.map((c) => c.id))
  }
  return clip.kind
}

/** Há algo copiado deste conjunto para colar. */
export const hasClip = () => !!clip && clip.setId === useEditor.getState().set?.id
