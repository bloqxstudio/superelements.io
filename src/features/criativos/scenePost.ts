/**
 * O criativo dentro da cena em código: cada camada visível dos slides escolhidos
 * vira uma peça (um ImageBitmap desenhado pelo mesmo `drawLayer` do editor, com a
 * fonte, o destaque, a foto e a moldura de verdade) com os dados dela (caixa,
 * texto, cores, a animação que já tinha). A cena move as peças com `lib.layer`
 * e pode redesenhar o texto letra a letra com os dados. Também gera a descrição
 * e as imagens dos slides para a IA.
 */

import { timeline } from './motion'
import { drawLayer, drawSlide, layerBox, type ImageMap } from './render'
import { sizeOf, type CreativeSet, type Layer, type LayerMotion, type Post } from './types'

export interface ScenePiece {
  id: string
  name: string
  type: Layer['type']
  /** Caixa no slide (px do formato) e o centro. */
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
  /** Cobre quase o slide inteiro (fundo, foto de fundo). */
  background: boolean
  /** Ordem de leitura (de cima para baixo) entre as peças que não são fundo. */
  order: number
  text?: string
  font?: string
  weight?: number
  size?: number
  color?: string
  align?: string
  italic?: boolean
  upper?: boolean
  fill?: string
  /** Animação que a camada já tinha no Motion (referência para elevar). */
  motion?: LayerMotion
  sprite: ImageBitmap
  /** Tamanho da peça em px do formato (o bitmap tem `k` vezes isso). */
  spriteW: number
  spriteH: number
  k: number
}

export interface SceneSlide {
  id: string
  index: number
  background: string
  /** Início e duração do slide no vídeo atual do post. */
  start: number
  dur: number
  camera?: string
  layers: ScenePiece[]
}

export interface ScenePost {
  name: string
  format: string
  width: number
  height: number
  slides: SceneSlide[]
}

const cache = new WeakMap<Post, Map<string, Promise<ScenePost>>>()

/** As peças do post (com cache por versão do post e conjunto de slides). */
export function scenePost(post: Post, slideIds: string[], images: ImageMap): Promise<ScenePost> {
  const key = `${slideIds.join(',')}|${images.size}`
  let byPost = cache.get(post)
  if (!byPost) cache.set(post, (byPost = new Map()))
  let hit = byPost.get(key)
  if (!hit) {
    hit = build(post, slideIds, images)
    byPost.set(key, hit)
  }
  return hit
}

async function build(post: Post, slideIds: string[], images: ImageMap): Promise<ScenePost> {
  const { width, height } = sizeOf(post.format)
  const { segments } = timeline(post)
  const chosen = post.slides.filter((s) => slideIds.includes(s.id))
  const slides: SceneSlide[] = []
  for (const slide of chosen.length ? chosen : post.slides) {
    const seg = segments.find((x) => x.slide.id === slide.id)
    const visible = slide.layers.filter((l) => !l.hidden)
    const pieces: ScenePiece[] = []
    const reading = visible
      .map((l) => ({ l, b: layerBox(l) }))
      .filter(({ b }) => b.w * b.h < width * height * 0.8)
      .sort((a, b) => a.b.y - b.b.y || a.b.x - b.b.x)
      .map(({ l }) => l.id)
    for (const layer of visible) {
      const box = layerBox(layer)
      const background = box.w * box.h >= width * height * 0.8
      // Folga para acentos, sombras e giro; fundos com resolução menor (são grandes)
      const k = background ? 1 : 1.5
      const diag = layer.rotation ? Math.hypot(box.w, box.h) : 0
      const pad = Math.max(24, Math.min(box.w, box.h) * 0.15)
      const spriteW = Math.ceil(Math.max(box.w, diag) + pad * 2)
      const spriteH = Math.ceil(Math.max(box.h, diag) + pad * 2)
      const canvas = new OffscreenCanvas(Math.max(1, Math.round(spriteW * k)), Math.max(1, Math.round(spriteH * k)))
      const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D
      ctx.scale(k, k)
      ctx.translate(spriteW / 2 - (box.x + box.w / 2), spriteH / 2 - (box.y + box.h / 2))
      drawLayer(ctx, layer, images)
      const t = layer.type === 'text' ? layer : undefined
      pieces.push({
        id: layer.id,
        name: layer.name,
        type: layer.type,
        x: Math.round(box.x),
        y: Math.round(box.y),
        w: Math.round(box.w),
        h: Math.round(box.h),
        cx: box.x + box.w / 2,
        cy: box.y + box.h / 2,
        background,
        order: reading.indexOf(layer.id),
        ...(t ? { text: t.text.replace(/\*/g, ''), font: t.font, weight: t.weight, size: t.size, color: t.color, align: t.align, italic: t.italic, upper: t.upper } : {}),
        ...(layer.type === 'rect' ? { fill: layer.fill } : {}),
        motion: layer.motion,
        sprite: canvas.transferToImageBitmap(),
        spriteW,
        spriteH,
        k,
      })
    }
    slides.push({ id: slide.id, index: post.slides.indexOf(slide), background: slide.background, start: seg?.start ?? 0, dur: seg?.dur ?? 3, camera: slide.camera, layers: pieces })
  }
  return { name: post.name, format: post.format, width, height, slides }
}

/** Fontes das camadas de texto (para o worker carregar). */
export const fontsOf = (post: ScenePost) => [...new Set(post.slides.flatMap((s) => s.layers.map((l) => l.font).filter(Boolean) as string[]))]

/** O post em texto para a IA: cada slide, cada peça e a animação que já tinha. */
export function describePost(post: ScenePost): string {
  const motion = (m?: LayerMotion) => (m ? ` · animação atual: ${m.fx} de ${m.start.toFixed(2)} s por ${m.dur.toFixed(2)} s${m.exit ? `, sai com ${m.exit}` : ''}${m.loop ? `, loop ${m.loop}` : ''}` : ' · parada')
  return [
    `Post "${post.name}", ${post.width} × ${post.height}, ${post.slides.length} slide(s).`,
    ...post.slides.map((s, i) => [
      `### env.post.slides[${i}] (slide ${s.index + 1} do criativo) · fundo ${s.background} · no vídeo atual: ${s.start.toFixed(1)}–${(s.start + s.dur).toFixed(1)} s${s.camera ? ` · câmera ${s.camera}` : ''}`,
      ...s.layers.map((l, j) => `- layers[${j}] "${l.name}" ${l.type}${l.background ? ' (fundo)' : ''} caixa ${l.x},${l.y} ${l.w}×${l.h}${l.text ? ` · texto "${l.text.slice(0, 160)}" ${l.font} ${l.weight} ${l.size}px ${l.color}` : ''}${l.fill ? ` · cor ${l.fill}` : ''}${motion(l.motion)}`),
    ].join('\n')),
  ].join('\n')
}

/** Imagem de cada slide (JPEG pequeno) para a IA ver o criativo. */
export async function slideImages(post: Post, slideIds: string[], images: ImageMap, max = 8): Promise<string[]> {
  const { width, height } = sizeOf(post.format)
  const k = 480 / Math.max(width, height)
  const out: string[] = []
  for (const slide of post.slides.filter((s) => slideIds.includes(s.id)).slice(0, max)) {
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(width * k), height: Math.round(height * k) })
    const ctx = c.getContext('2d')!
    ctx.scale(k, k)
    drawSlide(ctx, slide, post.format, images)
    out.push(c.toDataURL('image/jpeg', 0.75))
  }
  return out
}

/** Duração da coreografia automática (`POST_SCENE`): o tempo de cada slide (mínimo 2,6 s) menos as passagens de 0,5 s. */
export function postSceneDuration(post: Post, slideIds: string[]): number {
  const { segments } = timeline(post)
  const durs = segments.filter((s) => slideIds.includes(s.slide.id)).map((s) => Math.max(2.6, s.dur))
  return Math.round((durs.reduce((a, b) => a + b, 0) - 0.5 * Math.max(0, durs.length - 1)) * 10) / 10 || 5
}

/** O endereço do motion avançado de um post (estúdio de cena em código, já com o criativo). */
export const advancedMotionLink = (set: Pick<CreativeSet, 'id' | 'shared' | 'projectId'>, postId: string) =>
  `/motion/${set.id}/cena?${new URLSearchParams({ ...(set.shared && set.projectId ? { projeto: set.projectId } : {}), post: postId }).toString()}`
