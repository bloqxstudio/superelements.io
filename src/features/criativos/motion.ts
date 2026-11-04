/**
 * Motion dos Criativos: cada camada pode ganhar uma entrada (efeito, início e
 * duração) e o post vira um vídeo, slide a slide, com transição entre eles. Tudo
 * é desenhado pelo mesmo `drawLayer` do editor, então o vídeo é o criativo que a
 * pessoa vê, só que andando. Sem DOM além do canvas: a prévia e o MP4 usam isto.
 */

import { drawLayer, layerBox, type ImageMap } from './render'
import { sizeOf, type FormatId, type Layer, type LayerMotion, type MotionFx, type MotionTransition, type Post, type PostMotion, type Slide } from './types'

export const MOTION_FX: { id: MotionFx; label: string }[] = [
  { id: 'rise', label: 'Subir' },
  { id: 'fade', label: 'Aparecer' },
  { id: 'drop', label: 'Descer' },
  { id: 'left', label: 'Vir da esquerda' },
  { id: 'right', label: 'Vir da direita' },
  { id: 'pop', label: 'Saltar' },
  { id: 'zoom', label: 'Aproximar' },
  { id: 'wipe', label: 'Revelar (lado)' },
  { id: 'wipe-up', label: 'Revelar (de baixo)' },
  { id: 'ken', label: 'Zoom lento (foto)' },
  { id: 'pulse', label: 'Saltar e pulsar (botão)' },
]

export const MOTION_TRANSITIONS: { id: MotionTransition; label: string }[] = [
  { id: 'push', label: 'Deslizar (carrossel)' },
  { id: 'fade', label: 'Dissolver' },
  { id: 'zoom', label: 'Aproximar' },
  { id: 'cut', label: 'Corte seco' },
]

/** Pausa depois da última entrada, para dar tempo de ler. */
const HOLD = 2
const MIN_SLIDE = 3
const MAX_SLIDE = 20

export const FPS = 30

export const postMotionOf = (post: Post): Required<PostMotion> => ({
  slideDur: post.motion?.slideDur ?? 0,
  transition: post.motion?.transition ?? 'push',
  transitionDur: Math.min(1.2, Math.max(0.1, post.motion?.transitionDur ?? 0.5)),
})

export const hasMotion = (post: Post | undefined) => !!post?.slides.some((s) => s.layers.some((l) => l.motion))

/** Quando o slide termina as entradas (segundos). */
export const entrancesEnd = (slide: Slide) => slide.layers.reduce((end, l) => (l.motion && !l.hidden ? Math.max(end, l.motion.start + l.motion.dur) : end), 0)

export function slideDuration(post: Post, slide: Slide): number {
  const fixed = postMotionOf(post).slideDur
  if (fixed > 0) return Math.min(MAX_SLIDE, Math.max(1, fixed))
  return Math.min(MAX_SLIDE, Math.max(MIN_SLIDE, entrancesEnd(slide) + HOLD))
}

export interface Segment {
  slide: Slide
  start: number
  dur: number
}

export function timeline(post: Post): { segments: Segment[]; total: number } {
  let start = 0
  const segments = post.slides.map((slide) => {
    const dur = slideDuration(post, slide)
    const seg = { slide, start, dur }
    start += dur
    return seg
  })
  return { segments, total: start }
}

// Curvas

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeBack = (t: number) => {
  const c = 1.70158
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}

// Números que contam

const NUMBER = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/

/** O primeiro número do texto, para a contagem. */
export function numberIn(text: string): { value: number; decimals: number; thousands: boolean } | undefined {
  const m = NUMBER.exec(text)
  if (!m) return undefined
  const raw = m[0]
  const thousands = /\.\d{3}/.test(raw)
  const [int, dec = ''] = raw.replace(/\./g, '').split(',')
  return { value: Number(`${int}.${dec || 0}`), decimals: dec.length, thousands }
}

function countText(text: string, p: number): string {
  const n = numberIn(text)
  if (!n) return text
  const v = n.value * p
  const shown = n.thousands || n.decimals ? v.toLocaleString('pt-BR', { minimumFractionDigits: n.decimals, maximumFractionDigits: n.decimals, useGrouping: n.thousands }) : String(Math.round(v))
  return text.replace(NUMBER, shown)
}

// Uma camada num instante

interface Pose {
  alpha: number
  dx: number
  dy: number
  scale: number
  /** Recorte de revelação: 0 nada, 1 tudo. */
  wipe?: { p: number; dir: 'x' | 'y' }
  /** Escala dentro da própria caixa (a foto cresce sem sair da moldura). */
  inner?: number
}

function poseOf(m: LayerMotion, t: number, slideDur: number, width: number): Pose {
  const raw = m.dur > 0 ? clamp01((t - m.start) / m.dur) : t >= m.start ? 1 : 0
  const p = easeOut(raw)
  const d = width * 0.05
  switch (m.fx) {
    case 'fade':
      return { alpha: p, dx: 0, dy: 0, scale: 1 }
    case 'rise':
      return { alpha: p, dx: 0, dy: d * (1 - p), scale: 1 }
    case 'drop':
      return { alpha: p, dx: 0, dy: -d * (1 - p), scale: 1 }
    case 'left':
      return { alpha: p, dx: -d * 1.4 * (1 - p), dy: 0, scale: 1 }
    case 'right':
      return { alpha: p, dx: d * 1.4 * (1 - p), dy: 0, scale: 1 }
    case 'pop':
      return { alpha: clamp01(raw * 2), dx: 0, dy: 0, scale: 0.8 + 0.2 * easeBack(raw) }
    case 'zoom':
      return { alpha: p, dx: 0, dy: 0, scale: 1.12 - 0.12 * p }
    case 'wipe':
      return { alpha: 1, dx: 0, dy: 0, scale: 1, wipe: { p: easeInOut(raw), dir: 'x' } }
    case 'wipe-up':
      return { alpha: 1, dx: 0, dy: 0, scale: 1, wipe: { p: easeInOut(raw), dir: 'y' } }
    case 'ken': {
      // Aparece na entrada (se não começa no zero) e cresce devagar até o fim do slide
      const span = Math.max(0.1, slideDur - m.start)
      const k = clamp01((t - m.start) / span)
      return { alpha: m.start > 0.05 ? p : 1, dx: 0, dy: 0, scale: 1, inner: 1 + 0.1 * k }
    }
    case 'pulse': {
      const after = t - (m.start + m.dur)
      const beat = after > 0 ? 1 + 0.035 * Math.sin((after / 1.1) * Math.PI * 2) * Math.min(1, after / 0.4) : 1
      return { alpha: clamp01(raw * 2), dx: 0, dy: 0, scale: (0.8 + 0.2 * easeBack(raw)) * beat }
    }
  }
}

function drawLayerAt(ctx: CanvasRenderingContext2D, layer: Layer, images: ImageMap, t: number, slideDur: number, width: number) {
  const m = layer.motion
  if (!m) return drawLayer(ctx, layer, images)
  const pose = poseOf(m, t, slideDur, width)
  if (pose.alpha <= 0.001 || (pose.wipe && pose.wipe.p <= 0.001)) return
  let draw: Layer = pose.alpha < 1 ? ({ ...layer, opacity: (layer.opacity ?? 1) * pose.alpha } as Layer) : layer
  if (m.count && layer.type === 'text') {
    const raw = m.dur > 0 ? clamp01((t - m.start) / (m.dur + 0.6)) : 1
    draw = { ...draw, text: countText(layer.text, easeOut(raw)) } as Layer
  }
  const box = layerBox(layer)
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  ctx.save()
  if (pose.wipe) {
    // Folga em volta da caixa para não cortar acentos e descendentes do texto
    const pad = Math.max(12, box.h * 0.15)
    ctx.beginPath()
    if (pose.wipe.dir === 'x') ctx.rect(box.x - pad, box.y - pad, (box.w + pad * 2) * pose.wipe.p, box.h + pad * 2)
    else {
      const h = (box.h + pad * 2) * pose.wipe.p
      ctx.rect(box.x - pad, box.y + box.h + pad - h, box.w + pad * 2, h)
    }
    ctx.clip()
  }
  if (pose.inner && pose.inner !== 1) {
    if (layer.type === 'image' && layer.frame === 'none') {
      ctx.beginPath()
      ctx.roundRect(box.x, box.y, box.w, box.h, Math.max(0, Math.min(layer.radius, box.w / 2, box.h / 2)))
      ctx.clip()
    }
    const s = layer.type === 'image' && layer.frame === 'none' ? pose.inner : 1 + (pose.inner - 1) * 0.4
    ctx.translate(cx, cy)
    ctx.scale(s, s)
    ctx.translate(-cx, -cy)
  }
  if (pose.dx || pose.dy) ctx.translate(pose.dx, pose.dy)
  if (pose.scale !== 1) {
    ctx.translate(cx, cy)
    ctx.scale(pose.scale, pose.scale)
    ctx.translate(-cx, -cy)
  }
  drawLayer(ctx, draw, images)
  ctx.restore()
}

/** O slide no instante `t` (segundos desde o começo dele). */
export function drawSlideAt(ctx: CanvasRenderingContext2D, slide: Slide, format: FormatId, images: ImageMap, t: number, slideDur: number) {
  const { width, height } = sizeOf(format)
  ctx.save()
  ctx.fillStyle = slide.background
  ctx.fillRect(0, 0, width, height)
  for (const layer of slide.layers) if (!layer.hidden) drawLayerAt(ctx, layer, images, t, slideDur, width)
  ctx.restore()
}

/**
 * Desenha o post inteiro como vídeo. Guarda dois canvases de apoio para as
 * transições (o slide que sai e o que entra), do tamanho do formato.
 */
export class MotionRenderer {
  private a: HTMLCanvasElement
  private b: HTMLCanvasElement
  constructor(private post: Post, private images: ImageMap) {
    const { width, height } = sizeOf(post.format)
    this.a = Object.assign(document.createElement('canvas'), { width, height })
    this.b = Object.assign(document.createElement('canvas'), { width, height })
  }

  update(post: Post, images: ImageMap) {
    const { width, height } = sizeOf(post.format)
    if (this.a.width !== width || this.a.height !== height) {
      Object.assign(this.a, { width, height })
      Object.assign(this.b, { width, height })
    }
    this.post = post
    this.images = images
  }

  get total() {
    return timeline(this.post).total
  }

  /** `ctx` tem o tamanho do formato (ou já está escalado para ele). */
  draw(ctx: CanvasRenderingContext2D, time: number) {
    const { post, images } = this
    const { width, height } = sizeOf(post.format)
    const { segments, total } = timeline(post)
    if (!segments.length) return
    const t = Math.min(Math.max(0, time), Math.max(0, total - 1e-4))
    const i = Math.max(0, segments.findIndex((s) => t >= s.start && t < s.start + s.dur))
    const seg = segments[i]
    const local = t - seg.start
    const { transition, transitionDur } = postMotionOf(post)
    const T = Math.min(transitionDur, seg.dur * 0.5)
    if (i === 0 || transition === 'cut' || local >= T) {
      drawSlideAt(ctx, seg.slide, post.format, images, local, seg.dur)
      return
    }
    const prev = segments[i - 1]
    const p = easeInOut(local / T)
    const ca = this.a.getContext('2d')!
    const cb = this.b.getContext('2d')!
    drawSlideAt(ca, prev.slide, post.format, images, prev.dur, prev.dur)
    drawSlideAt(cb, seg.slide, post.format, images, local, seg.dur)
    ctx.save()
    if (transition === 'push') {
      ctx.drawImage(this.a, -width * p, 0)
      ctx.drawImage(this.b, width * (1 - p), 0)
    } else if (transition === 'zoom') {
      ctx.drawImage(this.a, 0, 0)
      const s = 1.15 - 0.15 * p
      ctx.globalAlpha = p
      ctx.drawImage(this.b, (width - width * s) / 2, (height - height * s) / 2, width * s, height * s)
    } else {
      ctx.drawImage(this.a, 0, 0)
      ctx.globalAlpha = p
      ctx.drawImage(this.b, 0, 0)
    }
    ctx.restore()
  }
}

// Animar sozinho

const area = (l: Layer) => {
  const b = layerBox(l)
  return b.w * b.h
}

/**
 * Coreografia automática de um slide: o fundo fica parado, a foto grande faz
 * zoom lento, depois as camadas entram de cima para baixo (título maior sobe,
 * rótulos aparecem, botão salta e pulsa, número grande conta). Camadas do mesmo
 * grupo entram juntas.
 */
export type MotionStyle = 'suave' | 'dinamico' | 'impacto'

export const MOTION_STYLES: { id: MotionStyle; label: string; hint: string }[] = [
  { id: 'suave', label: 'Suave', hint: 'Tudo aparece em fade, um depois do outro.' },
  { id: 'dinamico', label: 'Dinâmico', hint: 'Título sobe, foto em zoom lento, botão pulsa.' },
  { id: 'impacto', label: 'Impacto', hint: 'Entradas rápidas, revelações e saltos.' },
]

/** Troca o efeito de cada entrada pelo do estilo, mantendo a ordem e o ritmo de leitura. */
function styled(m: Omit<LayerMotion, 'start'>, layer: Layer, style: MotionStyle, isTitle: boolean): Omit<LayerMotion, 'start'> {
  if (style === 'dinamico') return m
  if (style === 'suave') {
    if (m.fx === 'ken') return m
    return { fx: 'fade', dur: 0.7, ...(m.count ? { count: true } : {}) }
  }
  // impacto
  if (m.fx === 'ken') return { fx: 'ken', dur: 0.5 }
  if (m.fx === 'pulse') return { fx: 'pulse', dur: 0.4 }
  if (layer.type === 'text' && isTitle) return { fx: 'wipe-up', dur: 0.55, ...(m.count ? { count: true } : {}) }
  if (layer.type === 'text') return { fx: 'left', dur: 0.45 }
  if (layer.type === 'image') return { fx: 'pop', dur: 0.5 }
  return { fx: m.fx === 'wipe' ? 'wipe' : 'pop', dur: 0.45 }
}

export function autoSlideMotion(slide: Slide, format: FormatId, style: MotionStyle = 'dinamico'): Slide {
  const { width, height } = sizeOf(format)
  const full = width * height
  const visible = slide.layers.filter((l) => !l.hidden)
  const texts = visible.filter((l): l is Extract<Layer, { type: 'text' }> => l.type === 'text')
  const biggest = texts.reduce((n, l) => Math.max(n, l.size), 0)
  const inside = (outer: Layer, inner: Layer) => {
    const a = layerBox(outer)
    const b = layerBox(inner)
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    return cx > a.x && cx < a.x + a.w && cy > a.y && cy < a.y + a.h
  }
  // Botão: forma pequena com um texto dentro
  const buttons = new Set(visible.filter((l) => l.type === 'rect' && area(l) < full * 0.12 && l.h < height * 0.14 && texts.some((t) => inside(l, t))).map((l) => l.id))
  const buttonTexts = new Set(texts.filter((t) => visible.some((l) => buttons.has(l.id) && inside(l, t))).map((t) => t.id))

  const plan = new Map<string, Omit<LayerMotion, 'start'>>()
  const background = new Set<string>()
  for (const l of visible) {
    const big = area(l) > full * 0.45
    if (l.type === 'image') {
      if (big) plan.set(l.id, { fx: 'ken', dur: 0.8 })
      else plan.set(l.id, { fx: l.frame === 'none' ? 'zoom' : 'rise', dur: 0.8 })
    } else if (l.type === 'text') {
      if (buttonTexts.has(l.id)) continue
      const count = l.size >= Math.max(72, biggest * 0.8) && !!numberIn(l.text) && l.text.replace(NUMBER, '').trim().length <= 12
      if (l.size >= biggest * 0.8) plan.set(l.id, { fx: 'rise', dur: 0.75, ...(count ? { count: true } : {}) })
      else if (l.size < 34) plan.set(l.id, { fx: 'fade', dur: 0.5 })
      else plan.set(l.id, { fx: 'rise', dur: 0.6 })
    } else if (buttons.has(l.id)) plan.set(l.id, { fx: 'pulse', dur: 0.55 })
    else if (big || l.type === 'dots' || (l.type === 'rect' && l.fill2)) background.add(l.id)
    else if (l.type === 'ring') plan.set(l.id, { fx: 'pop', dur: 0.7 })
    else plan.set(l.id, { fx: l.w > l.h * 4 ? 'wipe' : 'fade', dur: 0.6 })
  }

  // Ordem de leitura: de cima para baixo, da esquerda para a direita; foto grande e fundo começam no zero
  const order = visible
    .filter((l) => plan.has(l.id) && plan.get(l.id)!.fx !== 'ken')
    .sort((a, b) => layerBox(a).y - layerBox(b).y || layerBox(a).x - layerBox(b).x)
  const starts = new Map<string, number>()
  const groupStart = new Map<string, number>()
  let step = 0
  for (const l of order) {
    if (l.group && groupStart.has(l.group)) {
      starts.set(l.id, groupStart.get(l.group)!)
      continue
    }
    const gap = style === 'impacto' ? 0.11 : style === 'suave' ? 0.16 : 0.18
    const at = Math.round(((style === 'impacto' ? 0.15 : 0.3) + step * gap) * 100) / 100
    starts.set(l.id, at)
    if (l.group) groupStart.set(l.group, at)
    step++
  }
  // O texto do botão entra com o botão
  for (const t of texts) {
    if (!buttonTexts.has(t.id)) continue
    const btn = visible.find((l) => buttons.has(l.id) && inside(l, t))
    if (!btn) continue
    plan.set(t.id, { fx: 'fade', dur: 0.4 })
    starts.set(t.id, (starts.get(btn.id) ?? 0) + 0.15)
  }

  return {
    ...slide,
    layers: slide.layers.map((l) => {
      if (background.has(l.id) || !plan.has(l.id)) {
        const { motion: _drop, ...rest } = l
        return rest as Layer
      }
      const isTitle = l.type === 'text' && l.size >= biggest * 0.8
      const m = styled(plan.get(l.id)!, l, buttonTexts.has(l.id) ? 'dinamico' : style, isTitle)
      return { ...l, motion: { ...m, start: m.fx === 'ken' ? 0 : starts.get(l.id) ?? 0.3 } } as Layer
    }),
  }
}

const STYLE_TRANSITION: Record<MotionStyle, MotionTransition> = { suave: 'fade', dinamico: 'push', impacto: 'zoom' }

export const autoPostMotion = (post: Post, style: MotionStyle = 'dinamico'): Post => ({
  ...post,
  motion: { ...post.motion, transition: post.slides.length > 1 ? STYLE_TRANSITION[style] : 'fade', transitionDur: style === 'impacto' ? 0.35 : 0.5 },
  slides: post.slides.map((s) => autoSlideMotion(s, post.format, style)),
})

export const clearPostMotion = (post: Post): Post => ({
  ...post,
  motion: undefined,
  slides: post.slides.map((s) => ({
    ...s,
    layers: s.layers.map((l) => {
      const { motion: _drop, ...rest } = l
      return rest as Layer
    }),
  })),
})
