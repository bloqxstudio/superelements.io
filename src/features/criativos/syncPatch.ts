import type { CreativeSet, FormatId, Post, SetAsset, Slide } from './types'

/**
 * O que uma pessoa manda para quem edita o mesmo conjunto: só o que mudou.
 * Slides inteiros (o último a chegar vale), a estrutura dos posts (nome,
 * formato, legenda e a ordem dos slides) e a lista de imagens. Sem imports do
 * app: lido pelos dois lados do canal.
 */

export interface PostMeta {
  id: string
  name: string
  format: FormatId
  caption?: string
  slideIds: string[]
}

export interface SyncPatch {
  /** Estrutura de todos os posts, quando algo nela mudou (criar, apagar, renomear, reordenar). */
  posts?: PostMeta[]
  /** Slides que mudaram, com o post a que pertencem. */
  slides?: { postId: string; slide: Slide }[]
  assets?: SetAsset[]
  name?: string
}

const metaOf = (p: Post): PostMeta => ({ id: p.id, name: p.name, format: p.format, caption: p.caption, slideIds: p.slides.map((s) => s.id) })

const sameMeta = (a: PostMeta, b: PostMeta) =>
  a.id === b.id && a.name === b.name && a.format === b.format && a.caption === b.caption && a.slideIds.length === b.slideIds.length && a.slideIds.every((id, i) => id === b.slideIds[i])

/** O que mudou de `before` para `after`; nada, se são iguais. */
export function diffSets(before: CreativeSet, after: CreativeSet): SyncPatch | undefined {
  const patch: SyncPatch = {}
  const old = new Map(before.posts.flatMap((p) => p.slides.map((s) => [s.id, s] as const)))
  const slides = after.posts.flatMap((p) => p.slides.filter((s) => old.get(s.id) !== s).map((slide) => ({ postId: p.id, slide })))
  if (slides.length) patch.slides = slides
  const a = before.posts.map(metaOf)
  const b = after.posts.map(metaOf)
  if (a.length !== b.length || a.some((m, i) => !sameMeta(m, b[i]))) patch.posts = b
  if (before.assets !== after.assets && JSON.stringify(before.assets) !== JSON.stringify(after.assets)) patch.assets = after.assets
  if (before.name !== after.name) patch.name = after.name
  return Object.keys(patch).length ? patch : undefined
}

/** Aplica o que veio de fora num conjunto (o atual e os guardados no desfazer/refazer). */
export function mergePatch(set: CreativeSet, patch: SyncPatch): CreativeSet {
  const known = new Map(set.posts.flatMap((p) => p.slides.map((s) => [s.id, s] as const)))
  const incoming = new Map((patch.slides ?? []).map((x) => [x.slide.id, x.slide] as const))
  let posts: Post[]
  if (patch.posts) {
    posts = patch.posts.map((meta) => {
      const existing = set.posts.find((p) => p.id === meta.id)
      const slides = meta.slideIds.flatMap((id) => incoming.get(id) ?? known.get(id) ?? [])
      return { ...(existing ?? { id: meta.id, slides: [] }), id: meta.id, name: meta.name, format: meta.format, caption: meta.caption, slides }
    })
  } else {
    posts = set.posts.map((p) => (p.slides.some((s) => incoming.has(s.id)) ? { ...p, slides: p.slides.map((s) => incoming.get(s.id) ?? s) } : p))
  }
  return { ...set, posts, assets: patch.assets ?? set.assets, name: patch.name ?? set.name }
}
