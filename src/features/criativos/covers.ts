import { useEffect, useMemo, useRef, useState } from 'react'
import { EMPHASIS_FONT, drawSlide, loadFont, loadImage, loadVideo, type ImageMap } from './render'
import { assetUrl, coverHash, coverUrls, loadSet, readSummary, saveCovers } from './storage'
import { sizeOf, type CreativeSet, type Post, type SetSummary } from './types'

/**
 * Capas dos posts: o primeiro slide em JPEG pequeno, guardado junto do conjunto
 * e listado no índice, para Criativos, Motion e Publicar no Instagram mostrarem
 * os criativos sem abrir cada conjunto. O editor refaz as capas que mudaram
 * pouco depois de salvar; conjunto antigo, sem capa, ganha as dele na primeira
 * vez que aparece numa lista.
 */

const COVER_WIDTH = 360
/** Quantas capas um conjunto ganha (a lista mostra as primeiras). */
const MAX_COVERS = 12

async function coverOf(post: Post, images: ImageMap): Promise<Blob> {
  const { width, height } = sizeOf(post.format)
  const k = COVER_WIDTH / width
  const canvas = Object.assign(document.createElement('canvas'), { width: COVER_WIDTH, height: Math.round(height * k) })
  const ctx = canvas.getContext('2d')!
  ctx.scale(k, k)
  if (post.slides[0]) drawSlide(ctx, post.slides[0], post.format, images)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Sem capa.'))), 'image/jpeg', 0.8))
}

/** Fontes e imagens do primeiro slide de cada post, para desenhar a capa fora do editor. */
async function imagesFor(set: CreativeSet, posts: Post[]): Promise<ImageMap> {
  const fonts = new Set<string>([set.brand.headingFont, set.brand.bodyFont, EMPHASIS_FONT])
  const srcs = new Set<string>()
  for (const p of posts)
    for (const l of p.slides[0]?.layers ?? []) {
      if (l.type === 'text') {
        fonts.add(l.font)
        if (l.emphasisFont) fonts.add(l.emphasisFont)
      }
      if (l.type === 'image' && l.src) srcs.add(l.src)
    }
  await Promise.all([...fonts].map((f) => loadFont(f).catch(() => undefined)))
  const images: ImageMap = new Map()
  await Promise.all(
    [...srcs].map(async (src) => {
      try {
        let url = src
        let video = false
        if (src.startsWith('asset:')) {
          const asset = set.assets.find((a) => a.id === src.slice(6))
          if (!asset || asset.kind === 'audio') return
          url = await assetUrl(asset)
          video = asset.kind === 'video'
        }
        images.set(src, video ? await loadVideo(url) : await loadImage(url))
      } catch {
        // imagem que não abre: a capa sai sem ela
      }
    })
  )
  return images
}

/** Gera e grava as capas que faltam ou mudaram. Devolve o resumo novo, ou nada quando já estava tudo em dia. */
export async function refreshCovers(set: CreativeSet, known?: SetSummary, loaded?: ImageMap): Promise<SetSummary | undefined> {
  const current = known ?? (await readSummary(set))
  const have = new Map((current?.postsInfo ?? []).filter((p) => p.cover).map((p) => [p.id, p.hash]))
  const todo = set.posts.slice(0, MAX_COVERS).filter((p) => p.slides.length && have.get(p.id) !== coverHash(p))
  if (!todo.length && current?.postsInfo) return undefined
  const images = loaded ?? (await imagesFor(set, todo))
  const made = await Promise.all(todo.map(async (p) => ({ postId: p.id, hash: coverHash(p), blob: await coverOf(p, images) })))
  return saveCovers(set, made)
}

// Nas listas

/** Conjuntos sem capa (ou com capa velha) entram numa fila, um por vez. */
const queue: { summary: SetSummary; done: (s?: SetSummary) => void }[] = []
const pending = new Set<string>()
let running = false

const needsCovers = (s: SetSummary) => !s.postsInfo || s.postsInfo.slice(0, 4).some((p) => p.slides > 0 && !p.cover)

async function drain() {
  if (running) return
  running = true
  while (queue.length) {
    const { summary, done } = queue.shift()!
    try {
      const set = await loadSet(summary.id, summary.shared ? summary.projectId : undefined)
      done(set ? await refreshCovers(set, summary) : undefined)
    } catch (error) {
      console.warn('[criativos] capas', summary.name, error)
      done(undefined)
    }
  }
  running = false
}

const backfill = (summary: SetSummary) =>
  new Promise<SetSummary | undefined>((resolve) => {
    const key = `${summary.projectId ?? ''}/${summary.id}`
    if (pending.has(key)) return resolve(undefined)
    pending.add(key)
    queue.push({ summary, done: resolve })
    void drain()
  })

/**
 * As listas de conjuntos com as capas: devolve os resumos (com as capas que
 * chegaram depois) e os endereços de cada capa. Faz as capas que faltam em
 * segundo plano, até `fill` conjuntos por vez.
 */
export function useCovers(sets: SetSummary[] | null, fill = 8): { sets: SetSummary[] | null; urls: Record<string, string> } {
  const [patched, setPatched] = useState<Record<string, SetSummary>>({})
  const [urls, setUrls] = useState<Record<string, string>>({})
  const asked = useRef(new Set<string>())
  const list = useMemo(() => sets?.map((s) => patched[`${s.projectId ?? ''}/${s.id}`] ?? s) ?? null, [sets, patched])
  const paths = useMemo(() => (list ?? []).flatMap((s) => (s.postsInfo ?? []).slice(0, 8).flatMap((p) => (p.cover ? [p.cover] : []))), [list])
  const pathKey = paths.join('|')

  useEffect(() => {
    if (!paths.length) return
    let alive = true
    void coverUrls(paths).then((found) => alive && setUrls((cur) => ({ ...cur, ...found })))
    return () => {
      alive = false
    }
  }, [pathKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sets) return
    let started = 0
    for (const s of sets) {
      const key = `${s.projectId ?? ''}/${s.id}`
      if (started >= fill || asked.current.has(key) || !needsCovers(s)) continue
      asked.current.add(key)
      started++
      void backfill(s).then((next) => next && setPatched((cur) => ({ ...cur, [key]: { ...s, ...next } })))
    }
  }, [sets, fill])

  return { sets: list, urls }
}

/** Busca por nome do conjunto, do projeto ou de um post. */
export const matchesSearch = (s: SetSummary, q: string) => {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return [s.name, s.projectName ?? '', ...(s.postsInfo ?? []).map((p) => p.name)].some((t) => t.toLowerCase().includes(needle))
}
