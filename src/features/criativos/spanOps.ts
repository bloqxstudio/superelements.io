import { sizeOf, uid, type CreativeSet, type Layer, type Post } from './types'

/**
 * Faixas contínuas: uma peça que atravessa todos os cards de um post (a página
 * de um site deitada correndo de card em card, por exemplo). Cada card guarda
 * uma cópia da peça deslocada uma largura de card por posição, então cada um
 * desenha e exporta a sua fatia e o carrossel emenda no deslizar. As cópias se
 * mantêm iguais: o que muda numa vai para as outras. Funções puras sobre o conjunto.
 */

/** O que as cópias de uma faixa compartilham (a posição vai deslocada, e o nome é de cada uma). */
const SHARED: string[] = ['y', 'w', 'h', 'rotation', 'opacity', 'src', 'fit', 'radius', 'frame', 'focusY', 'prompt', 'genFailed', 'fill', 'fill2', 'angle', 'stroke', 'strokeWidth', 'text', 'font', 'weight', 'size', 'color', 'align', 'lineHeight', 'letterSpacing', 'upper', 'emphasis', 'emphasisColor', 'gap', 'dot', 'hidden', 'locked']

const rec = (l: Layer) => l as unknown as Record<string, unknown>

const differs = (a: Layer, b: Layer) => a.x !== b.x || SHARED.some((k) => JSON.stringify(rec(a)[k]) !== JSON.stringify(rec(b)[k]))

/** Passa a peça para todos os cards do post, emendada: a escolhida vira a posição do card em que está. */
export function spreadLayer(set: CreativeSet, postId: string, slideId: string, layerId: string): CreativeSet {
  const post = set.posts.find((p) => p.id === postId)
  const from = post?.slides.findIndex((s) => s.id === slideId) ?? -1
  const layer = post?.slides[from]?.layers.find((l) => l.id === layerId)
  if (!post || !layer || post.slides.length < 2 || layer.span) return set
  const id = uid()
  const { width } = sizeOf(post.format)
  // A cópia entra na mesma altura de empilhamento que a original tem no card dela
  const at = post.slides[from].layers.findIndex((l) => l.id === layerId)
  return {
    ...set,
    posts: set.posts.map((p) =>
      p.id !== postId
        ? p
        : {
            ...p,
            slides: p.slides.map((slide, j) => {
              if (j === from) return { ...slide, layers: slide.layers.map((l) => (l.id === layerId ? { ...l, span: { id, index: j } } : l)) }
              const copy: Layer = { ...layer, id: uid(), x: layer.x + (from - j) * width, span: { id, index: j } }
              const layers = [...slide.layers]
              layers.splice(Math.min(at, layers.length), 0, copy)
              return { ...slide, layers }
            }),
          }
    ),
  }
}

/** Solta a peça da faixa: cada cópia passa a valer sozinha. */
export function unspreadLayer(set: CreativeSet, postId: string, spanId: string): CreativeSet {
  return { ...set, posts: set.posts.map((p) => (p.id !== postId ? p : { ...p, slides: p.slides.map((s) => ({ ...s, layers: s.layers.map((l) => (l.span?.id === spanId ? { ...l, span: undefined } : l)) })) })) }
}

/**
 * Depois de qualquer mudança: se uma cópia de uma faixa mudou, as outras copiam
 * a mudança (a posição deslocada pela diferença de card). Sem faixas no
 * conjunto, devolve o mesmo objeto, sem custo.
 */
export function syncSpans(prev: CreativeSet, next: CreativeSet): CreativeSet {
  if (prev === next || !next.posts.some((p) => p.slides.some((s) => s.layers.some((l) => l.span)))) return next
  let changedAny = false
  const posts = next.posts.map((post): Post => {
    const before = prev.posts.find((p) => p.id === post.id)
    if (!before) return post
    const old = new Map(before.slides.flatMap((s) => s.layers.map((l) => [l.id, l] as const)))
    const members = new Map<string, { slide: number; layer: Layer }[]>()
    post.slides.forEach((s, i) => s.layers.forEach((l) => l.span && members.set(l.span.id, [...(members.get(l.span.id) ?? []), { slide: i, layer: l }])))
    const { width } = sizeOf(post.format)
    const patches = new Map<string, Partial<Layer>>()
    for (const group of members.values()) {
      if (group.length < 2) continue
      const source = group.find((m) => old.has(m.layer.id) && differs(old.get(m.layer.id)!, m.layer))
      if (!source) continue
      const strip = source.layer.x + source.layer.span!.index * width
      for (const m of group) {
        if (m === source) continue
        const fields: Record<string, unknown> = { x: strip - m.layer.span!.index * width }
        for (const k of SHARED) fields[k] = rec(source.layer)[k]
        patches.set(m.layer.id, fields as Partial<Layer>)
      }
    }
    if (!patches.size) return post
    changedAny = true
    return { ...post, slides: post.slides.map((s) => (s.layers.some((l) => patches.has(l.id)) ? { ...s, layers: s.layers.map((l) => (patches.has(l.id) ? ({ ...l, ...patches.get(l.id) } as Layer) : l)) } : s)) }
  })
  return changedAny ? { ...next, posts } : next
}
