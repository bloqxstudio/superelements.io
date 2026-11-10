/**
 * Motion dos Criativos: cada camada pode ganhar uma entrada (efeito, início e
 * duração) e o post vira um vídeo, slide a slide, com transição entre eles. Tudo
 * é desenhado pelo mesmo `drawLayer` do editor, então o vídeo é o criativo que a
 * pessoa vê, só que andando. Sem DOM além do canvas: a prévia e o MP4 usam isto.
 */

import { drawLayer, isVideo, layerBox, placeText, type ImageMap, type PlacedRun } from './render'
import { sizeOf, type BrandMotion, type FormatId, type Layer, type LayerMotion, type KeyEase, type MotionEase, type MotionExit, type MotionFx, type MotionKey, type MotionLoop, type MotionShake, type MotionTransition, type Post, type PostMotion, type Slide, type SlideCamera, type TextLayer } from './types'

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
  { id: 'words', label: 'Palavra por palavra' },
  { id: 'letters', label: 'Letra por letra' },
  { id: 'move', label: 'Mover de um ponto' },
  { id: 'keys', label: 'Keyframes (livre)' },
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

export const postMotionOf = (post: Post): Required<Omit<PostMotion, 'audio' | 'output' | 'beats' | 'bpm' | 'paused'>> => ({
  slideDur: post.motion?.slideDur ?? 0,
  transition: post.motion?.transition ?? 'push',
  transitionDur: Math.min(1.2, Math.max(0.1, post.motion?.transitionDur ?? 0.5)),
})


// Estático ou animado (as regras ficam em motionFlags.ts, sem imports, para os testes do Node)
export { slideHasMotion, slideMoves, hasMotion, hasMotionData, setPostStatic } from './motionFlags'
import { slideHasMotion } from './motionFlags'

export type PostOutput = 'video' | 'carousel'

/** Um vídeo só (o padrão) ou carrossel em que cada slide é um item. Um slide só é sempre vídeo. */
export const postOutput = (post: Post): PostOutput => (post.slides.length > 1 && post.motion?.output === 'carousel' ? 'carousel' : 'video')

/** Um slide sozinho como post: o vídeo de um item do carrossel. */
export const slideAsPost = (post: Post, slide: Slide): Post => ({ ...post, slides: [slide] })

/** O slide volta a ser imagem: sem entradas e sem câmera. */
export const clearSlideMotion = (slide: Slide): Slide => ({
  ...slide,
  camera: undefined,
  flashes: undefined,
  shakes: undefined,
  layers: slide.layers.map((l) => {
    const { motion: _drop, ...rest } = l
    return rest as Layer
  }),
})

/** Quando o slide termina as entradas (segundos). */
export const entrancesEnd = (slide: Slide) =>
  Math.max(
    slide.layers.reduce((end, l) => (l.motion && !l.hidden ? Math.max(end, l.motion.start + l.motion.dur, ...(l.motion.keys ?? []).map((k) => k.t)) : end), 0),
    ...(slide.flashes ?? []).map((f) => f.t + (f.dur ?? 0.25)),
    ...(slide.shakes ?? []).map((f) => f.t + (f.dur ?? 0.35))
  )

export function slideDuration(post: Post, slide: Slide): number {
  if (slide.dur && slide.dur > 0) return Math.min(MAX_SLIDE, Math.max(0.3, slide.dur))
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
const easeStrong = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))
const easeElastic = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1)

export const MOTION_EASES: { id: MotionEase; label: string }[] = [
  { id: 'suave', label: 'Suave' },
  { id: 'forte', label: 'Forte (freia no fim)' },
  { id: 'elastico', label: 'Elástico' },
  { id: 'linear', label: 'Linear' },
]

const EASE: Record<MotionEase, (t: number) => number> = { suave: easeOut, forte: easeStrong, linear: (t) => t, elastico: easeElastic }
const easeOf = (m: Pick<LayerMotion, 'ease'>) => EASE[m.ease ?? 'suave'] ?? easeOut

export const MOTION_EXITS: { id: MotionExit; label: string }[] = [
  { id: 'fade', label: 'Sumir' },
  { id: 'rise', label: 'Subir e sumir' },
  { id: 'drop', label: 'Descer e sumir' },
  { id: 'left', label: 'Sair pela esquerda' },
  { id: 'right', label: 'Sair pela direita' },
  { id: 'zoom', label: 'Afastar' },
  { id: 'pop', label: 'Encolher' },
]

export const SLIDE_CAMERAS: { id: SlideCamera; label: string }[] = [
  { id: 'zoom-in', label: 'Aproximar devagar' },
  { id: 'zoom-out', label: 'Afastar devagar' },
  { id: 'pan-left', label: 'Deslizar para a esquerda' },
  { id: 'pan-right', label: 'Deslizar para a direita' },
  { id: 'pan-up', label: 'Subir' },
  { id: 'pan-down', label: 'Descer' },
]

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

// Keyframes, loops e impactos

const easeIn = (t: number) => t * t * t
const easeHold = (t: number) => (t < 1 ? 0 : 1)

export const KEY_EASES: { id: KeyEase; label: string }[] = [
  { id: 'suave', label: 'Suave (freia)' },
  { id: 'salto', label: 'Salto (passa e volta)' },
  { id: 'elastico', label: 'Elástico' },
  { id: 'forte', label: 'Forte' },
  { id: 'acelera', label: 'Acelera (cai)' },
  { id: 'linear', label: 'Linear' },
  { id: 'segura', label: 'Segura (corte seco)' },
]

const KEY_EASE: Record<KeyEase, (t: number) => number> = { ...EASE, salto: easeBack, acelera: easeIn, segura: easeHold }

export const MOTION_LOOPS: { id: MotionLoop; label: string }[] = [
  { id: 'respirar', label: 'Respirar (cresce e volta)' },
  { id: 'flutuar', label: 'Flutuar' },
  { id: 'balancar', label: 'Balançar' },
  { id: 'pulsar', label: 'Pulsar na batida' },
  { id: 'girar', label: 'Girar sem parar' },
]

type KeyProps = Required<Omit<MotionKey, 't' | 'ease'>>
const KEY_REST: KeyProps = { x: 0, y: 0, scale: 1, sx: 1, sy: 1, rotate: 0, opacity: 1 }
const KEY_FIELDS = Object.keys(KEY_REST) as (keyof KeyProps)[]

/** Os keyframes em ordem, cada um com todos os valores (o que falta repete o anterior). */
export function filledKeys(keys: MotionKey[]): (KeyProps & { t: number; ease?: KeyEase })[] {
  const sorted = [...keys].sort((a, b) => a.t - b.t)
  let prev: KeyProps = { ...KEY_REST }
  return sorted.map((k) => {
    const full = { ...prev }
    for (const f of KEY_FIELDS) if (typeof k[f] === 'number' && Number.isFinite(k[f])) full[f] = k[f] as number
    prev = full
    return { ...full, t: k.t, ease: k.ease }
  })
}

/** Os valores da animação livre no instante `t`. */
export function keysAt(keys: MotionKey[], t: number): KeyProps {
  const k = filledKeys(keys)
  if (!k.length) return { ...KEY_REST }
  if (t <= k[0].t) return k[0]
  const last = k[k.length - 1]
  if (t >= last.t) return last
  const i = k.findIndex((x) => x.t > t)
  const a = k[i - 1]
  const b = k[i]
  const span = Math.max(1e-4, b.t - a.t)
  const e = (KEY_EASE[b.ease ?? 'suave'] ?? easeOut)(clamp01((t - a.t) / span))
  const out = { ...a }
  for (const f of KEY_FIELDS) out[f] = a[f] + (b[f] - a[f]) * e
  return out
}

/** Começo e duração da barra na linha do tempo a partir dos keyframes. */
export function keysSpan(keys: MotionKey[]): { start: number; dur: number } {
  if (!keys.length) return { start: 0, dur: 0.1 }
  const ts = keys.map((k) => k.t)
  const start = Math.max(0, Math.min(...ts))
  return { start: Math.round(start * 100) / 100, dur: Math.max(0.1, Math.round((Math.max(...ts) - start) * 100) / 100) }
}

/** Ruído determinístico (o mesmo quadro sempre treme igual). */
const wobble = (t: number, seed: number) => Math.sin(t * 91.3 + seed * 12.9) * 0.6 + Math.sin(t * 57.1 + seed * 3.7) * 0.4

/** Deslocamento de tremidas no instante `t`. */
export function shakeAt(shakes: MotionShake[] | undefined, t: number): { dx: number; dy: number; rot: number } {
  let dx = 0
  let dy = 0
  let rot = 0
  for (const [i, s] of (shakes ?? []).entries()) {
    const dur = s.dur ?? 0.35
    const local = t - s.t
    if (local < 0 || local > dur) continue
    const k = Math.pow(1 - local / dur, 2) * (s.amp ?? 18)
    dx += wobble(local, i + 1) * k
    dy += wobble(local + 3.1, i + 7) * k
    rot += wobble(local + 5.3, i + 2) * k * 0.08
  }
  return { dx, dy, rot }
}

function loopPose(m: LayerMotion, t: number, beat: number): { dy: number; scale: number; rotate: number } {
  const since = t - (m.start + m.dur)
  if (!m.loop || since <= 0) return { dy: 0, scale: 1, rotate: 0 }
  const sp = m.loopSpeed ?? 1
  const ramp = Math.min(1, since / 0.3)
  switch (m.loop) {
    case 'respirar':
      return { dy: 0, scale: 1 + 0.03 * Math.sin(since * sp * Math.PI) * ramp, rotate: 0 }
    case 'flutuar':
      return { dy: -14 * Math.sin(since * sp * Math.PI * 0.8) * ramp, scale: 1, rotate: 0 }
    case 'balancar':
      return { dy: 0, scale: 1, rotate: 5 * Math.sin(since * sp * Math.PI * 1.2) * ramp }
    case 'girar':
      return { dy: 0, scale: 1, rotate: since * sp * 120 }
    case 'pulsar': {
      // Um soco a cada batida (ou a cada 0,5 s) que volta rápido
      const ph = (since % beat) / beat
      return { dy: 0, scale: 1 + 0.07 * Math.pow(1 - ph, 3) * ramp, rotate: 0 }
    }
  }
}

// Uma camada num instante

interface Pose {
  alpha: number
  dx: number
  dy: number
  scale: number
  rotate?: number
  /** Recorte de revelação: 0 nada, 1 tudo. */
  wipe?: { p: number; dir: 'x' | 'y' }
  /** Escala dentro da própria caixa (a foto cresce sem sair da moldura). */
  inner?: number
  /** Texto por palavra ou por letra: o andamento da entrada (0 a 1). */
  split?: { by: 'words' | 'letters'; p: number }
  /** Amassar e esticar (keyframes). */
  sx?: number
  sy?: number
}

const REST: Pose = { alpha: 1, dx: 0, dy: 0, scale: 1 }

function enterPose(m: LayerMotion, t: number, slideDur: number, width: number): Pose {
  const raw = m.dur > 0 ? clamp01((t - m.start) / m.dur) : t >= m.start ? 1 : 0
  const p = easeOf(m)(raw)
  const q = Math.min(1, p)
  const d = width * 0.05
  switch (m.fx) {
    case 'fade':
      return { alpha: clamp01(p), dx: 0, dy: 0, scale: 1 }
    case 'rise':
      return { alpha: q, dx: 0, dy: d * (1 - p), scale: 1 }
    case 'drop':
      return { alpha: q, dx: 0, dy: -d * (1 - p), scale: 1 }
    case 'left':
      return { alpha: q, dx: -d * 1.4 * (1 - p), dy: 0, scale: 1 }
    case 'right':
      return { alpha: q, dx: d * 1.4 * (1 - p), dy: 0, scale: 1 }
    case 'pop':
      return { alpha: clamp01(raw * 2), dx: 0, dy: 0, scale: 0.8 + 0.2 * (m.ease ? p : easeBack(raw)) }
    case 'zoom':
      return { alpha: q, dx: 0, dy: 0, scale: 1.12 - 0.12 * p }
    case 'wipe':
      return { alpha: 1, dx: 0, dy: 0, scale: 1, wipe: { p: m.ease ? q : easeInOut(raw), dir: 'x' } }
    case 'wipe-up':
      return { alpha: 1, dx: 0, dy: 0, scale: 1, wipe: { p: m.ease ? q : easeInOut(raw), dir: 'y' } }
    case 'ken': {
      // Aparece na entrada (se não começa no zero) e cresce devagar até o fim do slide
      const span = Math.max(0.1, slideDur - m.start)
      const k = clamp01((t - m.start) / span)
      return { alpha: m.start > 0.05 ? q : 1, dx: 0, dy: 0, scale: 1, inner: 1 + 0.1 * k }
    }
    case 'pulse': {
      const after = t - (m.start + m.dur)
      const beat = after > 0 ? 1 + 0.035 * Math.sin((after / 1.1) * Math.PI * 2) * Math.min(1, after / 0.4) : 1
      return { alpha: clamp01(raw * 2), dx: 0, dy: 0, scale: (0.8 + 0.2 * easeBack(raw)) * beat }
    }
    case 'words':
    case 'letters':
      return { alpha: raw > 0 ? 1 : 0, dx: 0, dy: 0, scale: 1, split: { by: m.fx, p: raw } }
    case 'move': {
      const f = m.from ?? {}
      return { alpha: 1, dx: (f.dx ?? 0) * (1 - p), dy: (f.dy ?? 0) * (1 - p), scale: 1 + ((f.scale ?? 1) - 1) * (1 - p), rotate: (f.rotate ?? 0) * (1 - p) }
    }
    case 'keys': {
      const k = keysAt(m.keys ?? [], t)
      return { alpha: clamp01(k.opacity), dx: k.x, dy: k.y, scale: k.scale, rotate: k.rotate, sx: k.sx, sy: k.sy }
    }
  }
}

/** A saída, no fim do slide: o contrário de uma entrada. */
function exitPose(m: LayerMotion, t: number, slideDur: number, width: number): Pose | undefined {
  if (!m.exit) return undefined
  const dur = Math.min(2, Math.max(0.1, m.exitDur ?? 0.4))
  const from = slideDur - dur - 0.05
  if (t <= from) return undefined
  const p = easeInOut(clamp01((t - from) / dur))
  const d = width * 0.05
  const a = 1 - p
  switch (m.exit) {
    case 'fade':
      return { alpha: a, dx: 0, dy: 0, scale: 1 }
    case 'rise':
      return { alpha: a, dx: 0, dy: -d * p, scale: 1 }
    case 'drop':
      return { alpha: a, dx: 0, dy: d * p, scale: 1 }
    case 'left':
      return { alpha: a, dx: -d * 1.6 * p, dy: 0, scale: 1 }
    case 'right':
      return { alpha: a, dx: d * 1.6 * p, dy: 0, scale: 1 }
    case 'zoom':
      return { alpha: a, dx: 0, dy: 0, scale: 1 - 0.1 * p }
    case 'pop':
      return { alpha: a, dx: 0, dy: 0, scale: 1 - 0.25 * p }
  }
}

function poseOf(m: LayerMotion, t: number, slideDur: number, width: number, beat = 0.5): Pose {
  let pose = enterPose(m, t, slideDur, width)
  const out = exitPose(m, t, slideDur, width)
  if (out) pose = { ...pose, alpha: pose.alpha * out.alpha, dx: pose.dx + out.dx, dy: pose.dy + out.dy, scale: pose.scale * out.scale }
  if (m.loop) {
    const l = loopPose(m, t, beat)
    pose = { ...pose, dy: pose.dy + l.dy, scale: pose.scale * l.scale, rotate: (pose.rotate ?? 0) + l.rotate }
  }
  if (m.shakes?.length) {
    const s = shakeAt(m.shakes, t)
    pose = { ...pose, dx: pose.dx + s.dx, dy: pose.dy + s.dy, rotate: (pose.rotate ?? 0) + s.rot }
  }
  return pose
}

/** Texto entrando por palavra ou por letra: cada pedaço com o seu atraso, desenhado com as contas do `drawText`. */
function drawSplitText(ctx: CanvasRenderingContext2D, layer: TextLayer, split: NonNullable<Pose['split']>, ease: (t: number) => number) {
  const runs = placeText(layer, ctx)
  type Piece = { text: string; x: number; y: number; run: PlacedRun }
  const pieces: Piece[] = []
  ctx.save()
  for (const run of runs) {
    if (split.by === 'words') {
      pieces.push({ text: run.text, x: run.x, y: run.y, run })
      continue
    }
    ctx.font = `${run.italic ? 'italic ' : ''}${run.weight} ${run.size}px "${run.font}", system-ui, sans-serif`
    ctx.letterSpacing = `${run.letterSpacing}px`
    const chars = [...run.text]
    let acc = ''
    for (const ch of chars) {
      pieces.push({ text: ch, x: run.x + ctx.measureText(acc).width, y: run.y, run })
      acc += ch
    }
  }
  const n = Math.max(1, pieces.length)
  // Cada pedaço anda numa janela; as janelas se sobrepõem (as palavras mais, as letras menos)
  const span = split.by === 'words' ? 0.55 : 0.35
  const step = n > 1 ? (1 - span) / (n - 1) : 0
  const rise = layer.size * (split.by === 'words' ? 0.35 : 0.18)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  pieces.forEach((piece, i) => {
    const local = clamp01((split.p - i * step) / span)
    if (local <= 0) return
    const e = ease(local)
    const { run } = piece
    ctx.font = `${run.italic ? 'italic ' : ''}${run.weight} ${run.size}px "${run.font}", system-ui, sans-serif`
    ctx.letterSpacing = `${run.letterSpacing}px`
    ctx.fillStyle = run.color
    ctx.globalAlpha = (layer.opacity ?? 1) * clamp01(e) * (ctx.globalAlpha || 1)
    ctx.fillText(piece.text, piece.x, piece.y + rise * (1 - e))
    ctx.globalAlpha = 1
  })
  ctx.restore()
}

/** Rastro de velocidade: cópias mais fracas nos instantes de antes, quando a camada anda rápido. */
const BLUR_SAMPLES = 5
const BLUR_SPAN = 1.6 / FPS

function drawLayerAt(ctx: CanvasRenderingContext2D, layer: Layer, images: ImageMap, t: number, slideDur: number, width: number, beat = 0.5) {
  const m = layer.motion
  if (m?.blur) {
    const now = poseOf(m, t, slideDur, width, beat)
    const before = poseOf(m, t - BLUR_SPAN, slideDur, width, beat)
    const box = layerBox(layer)
    const moved = Math.hypot(now.dx - before.dx, now.dy - before.dy) + Math.abs(now.scale - before.scale) * Math.max(box.w, box.h) + Math.abs((now.rotate ?? 0) - (before.rotate ?? 0)) * 6
    if (moved > 6) {
      for (let i = BLUR_SAMPLES; i >= 1; i--) {
        drawLayerPose(ctx, layer, images, t - (BLUR_SPAN * i) / BLUR_SAMPLES, slideDur, width, beat, 0.22 * (1 - i / (BLUR_SAMPLES + 1)))
      }
    }
  }
  drawLayerPose(ctx, layer, images, t, slideDur, width, beat)
}

function drawLayerPose(ctx: CanvasRenderingContext2D, layer: Layer, images: ImageMap, t: number, slideDur: number, width: number, beat: number, fade = 1) {
  const m = layer.motion
  if (!m) return drawLayer(ctx, layer, images)
  const raw = poseOf(m, t, slideDur, width, beat)
  const pose = fade === 1 ? raw : { ...raw, alpha: raw.alpha * fade }
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
  const sx = pose.scale * (pose.sx ?? 1)
  const sy = pose.scale * (pose.sy ?? 1)
  if (sx !== 1 || sy !== 1 || pose.rotate) {
    ctx.translate(cx, cy)
    if (pose.rotate) ctx.rotate((pose.rotate * Math.PI) / 180)
    ctx.scale(Math.max(0.001, sx), Math.max(0.001, sy))
    ctx.translate(-cx, -cy)
  }
  if (pose.split && draw.type === 'text') {
    if (draw.rotation) {
      ctx.translate(cx, cy)
      ctx.rotate((draw.rotation * Math.PI) / 180)
      ctx.translate(-cx, -cy)
    }
    drawSplitText(ctx, draw, pose.split, easeOf(m))
  } else drawLayer(ctx, draw, images)
  ctx.restore()
}

function cameraTransform(ctx: CanvasRenderingContext2D, camera: SlideCamera, k: number, width: number, height: number) {
  const e = easeInOut(clamp01(k))
  const cx = width / 2
  const cy = height / 2
  let s = 1.06
  let dx = 0
  let dy = 0
  if (camera === 'zoom-in') s = 1 + 0.08 * e
  else if (camera === 'zoom-out') s = 1.08 - 0.08 * e
  else if (camera === 'pan-left') dx = width * 0.025 * (1 - 2 * e)
  else if (camera === 'pan-right') dx = -width * 0.025 * (1 - 2 * e)
  else if (camera === 'pan-up') dy = height * 0.02 * (1 - 2 * e)
  else if (camera === 'pan-down') dy = -height * 0.02 * (1 - 2 * e)
  ctx.translate(cx + dx, cy + dy)
  ctx.scale(s, s)
  ctx.translate(-cx, -cy)
}

/** O slide no instante `t` (segundos desde o começo dele). */
export function drawSlideAt(ctx: CanvasRenderingContext2D, slide: Slide, format: FormatId, images: ImageMap, t: number, slideDur: number, beat = 0.5) {
  const { width, height } = sizeOf(format)
  ctx.save()
  ctx.fillStyle = slide.background
  ctx.fillRect(0, 0, width, height)
  if (slide.shakes?.length) {
    // A tela treme: um pouco maior, para a borda não aparecer
    const s = shakeAt(slide.shakes, t)
    const k = 1 + Math.min(0.08, (Math.abs(s.dx) + Math.abs(s.dy)) / width)
    ctx.translate(width / 2 + s.dx, height / 2 + s.dy)
    ctx.rotate((s.rot * Math.PI) / 180)
    ctx.scale(k, k)
    ctx.translate(-width / 2, -height / 2)
  }
  if (slide.camera) cameraTransform(ctx, slide.camera, t / Math.max(0.1, slideDur), width, height)
  for (const layer of slide.layers) if (!layer.hidden) drawLayerAt(ctx, layer, images, t, slideDur, width, beat)
  ctx.restore()
  for (const f of slide.flashes ?? []) {
    const dur = f.dur ?? 0.25
    const local = t - f.t
    if (local < 0 || local > dur) continue
    ctx.save()
    ctx.globalAlpha = 0.85 * Math.pow(1 - local / dur, 2)
    ctx.fillStyle = f.color ?? '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  }
}

/** O intervalo entre batidas do post (0,5 s sem trilha lida). */
export const beatOf = (post: Post) => (post.motion?.bpm ? 60 / post.motion.bpm : 0.5)

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

  /** Os vídeos que aparecem no instante e o tempo de cada um (o vídeo anda desde a entrada da camada, em loop). */
  private videosAt(time: number): { el: HTMLVideoElement; at: number }[] {
    const { segments, total } = timeline(this.post)
    const t = Math.min(Math.max(0, time), Math.max(0, total - 1e-4))
    const i = Math.max(0, segments.findIndex((s) => t >= s.start && t < s.start + s.dur))
    const { transitionDur } = postMotionOf(this.post)
    const shown = [segments[i], i > 0 && t - segments[i].start < transitionDur ? segments[i - 1] : undefined].filter(Boolean) as Segment[]
    const out: { el: HTMLVideoElement; at: number }[] = []
    for (const seg of shown) {
      const local = Math.min(seg.dur, t - seg.start)
      for (const l of seg.slide.layers) {
        if (l.type !== 'image' || l.hidden) continue
        const el = this.images.get(l.src)
        if (!isVideo(el) || !Number.isFinite(el.duration) || el.duration <= 0) continue
        const run = Math.max(0, local - (l.motion?.start ?? 0))
        out.push({ el, at: run % el.duration })
      }
    }
    return out
  }

  get hasVideo() {
    return this.post.slides.some((s) => s.layers.some((l) => l.type === 'image' && isVideo(this.images.get(l.src))))
  }

  /** Exportação: põe cada vídeo no quadro exato antes de desenhar. */
  async seek(time: number) {
    await Promise.all(
      this.videosAt(time).map(({ el, at }) =>
        Math.abs(el.currentTime - at) < 0.001
          ? undefined
          : new Promise<void>((resolve) => {
              const done = () => {
                el.removeEventListener('seeked', done)
                clearTimeout(timer)
                resolve()
              }
              const timer = setTimeout(done, 2000)
              el.addEventListener('seeked', done)
              el.pause()
              el.currentTime = at
            })
      )
    )
  }

  /** Prévia: tocando, os vídeos correm sozinhos e só se acertam quando escorregam; parada, vão ao quadro certo. */
  sync(time: number, playing: boolean) {
    const live = this.videosAt(time)
    const liveSet = new Set(live.map((v) => v.el))
    for (const el of this.images.values()) if (isVideo(el) && !liveSet.has(el) && !el.paused) el.pause()
    for (const { el, at } of live) {
      if (playing) {
        if (Math.abs(el.currentTime - at) > 0.3) el.currentTime = at
        if (el.paused) void el.play().catch(() => undefined)
      } else {
        if (!el.paused) el.pause()
        if (Math.abs(el.currentTime - at) > 0.04) el.currentTime = at
      }
    }
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
      drawSlideAt(ctx, seg.slide, post.format, images, local, seg.dur, beatOf(post))
      return
    }
    const prev = segments[i - 1]
    const p = easeInOut(local / T)
    const ca = this.a.getContext('2d')!
    const cb = this.b.getContext('2d')!
    drawSlideAt(ca, prev.slide, post.format, images, prev.dur, prev.dur, beatOf(post))
    drawSlideAt(cb, seg.slide, post.format, images, local, seg.dur, beatOf(post))
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
  if (style === 'dinamico') return layer.type === 'text' && isTitle && !m.count ? { fx: 'words', dur: 0.9 } : m
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

  // Sem foto em zoom lento, a câmera aproxima devagar o slide todo (menos no Suave)
  const hasKen = [...plan.values()].some((m) => m.fx === 'ken')
  const camera = style !== 'suave' && !hasKen ? ('zoom-in' as const) : undefined
  return {
    ...slide,
    camera,
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

/** Anima o post no estilo; com o padrão da marca, a transição e o ritmo saem dele. */
export const autoPostMotion = (post: Post, style: MotionStyle = 'dinamico', brand?: BrandMotion): Post => {
  const pace = Math.min(1.6, Math.max(0.5, brand?.pace ?? 1))
  const slides = post.slides.map((s) => {
    const done = autoSlideMotion(s, post.format, style)
    if (pace === 1) return done
    return { ...done, layers: done.layers.map((l) => (l.motion ? ({ ...l, motion: { ...l.motion, start: Math.round(l.motion.start * pace * 100) / 100, dur: Math.round(l.motion.dur * pace * 100) / 100 } } as Layer) : l)) }
  })
  return {
    ...post,
    motion: {
      ...post.motion,
      // Animar de propósito tira a marca de estático
      paused: undefined,
      transition: post.slides.length > 1 ? brand?.transition ?? STYLE_TRANSITION[style] : 'fade',
      transitionDur: brand?.transitionDur ?? (style === 'impacto' ? 0.35 : 0.5),
    },
    slides,
  }
}

/**
 * Só a capa anda: o primeiro slide ganha a animação, os outros ficam imagem, e o
 * post vira carrossel (a capa em vídeo, os internos em foto).
 */
export const coverOnlyMotion = (post: Post, style: MotionStyle = 'dinamico', brand?: BrandMotion): Post => {
  const animated = autoPostMotion({ ...post, slides: post.slides.slice(0, 1) }, style, brand)
  return {
    ...post,
    motion: { ...post.motion, output: post.slides.length > 1 ? 'carousel' : post.motion?.output },
    slides: post.slides.map((s, i) => (i === 0 ? animated.slides[0] : clearSlideMotion(s))),
  }
}

export const clearPostMotion = (post: Post): Post => ({
  ...post,
  motion: post.motion?.output ? { output: post.motion.output } : undefined,
  slides: post.slides.map((s) => ({
    ...s,
    camera: undefined,
    flashes: undefined,
    shakes: undefined,
    layers: s.layers.map((l) => {
      const { motion: _drop, ...rest } = l
      return rest as Layer
    }),
  })),
})

// Batidas

/** A batida mais perto de `t` (segundos do vídeo), se estiver a menos de `max`. */
export function nearestBeat(beats: number[], t: number, max = 0.25): number | undefined {
  let best: number | undefined
  for (const b of beats) if (Math.abs(b - t) <= max && (best === undefined || Math.abs(b - t) < Math.abs(best - t))) best = b
  return best
}

/**
 * Encaixa o post nas batidas: o começo de cada entrada, cada keyframe, clarão e
 * tremida vai para a batida mais perto (até 0,25 s). Os keyframes de uma camada
 * andam juntos (o primeiro encaixa e os outros seguem), para não deformar o movimento.
 */
export function snapPostToBeats(post: Post): Post {
  const beats = post.motion?.beats
  if (!beats?.length) return post
  const { segments } = timeline(post)
  const snapLocal = (seg: Segment, t: number) => {
    const b = nearestBeat(beats, seg.start + t)
    return b === undefined ? t : Math.max(0, Math.round((b - seg.start) * 100) / 100)
  }
  return {
    ...post,
    slides: post.slides.map((slide) => {
      const seg = segments.find((x) => x.slide.id === slide.id)
      if (!seg) return slide
      return {
        ...slide,
        flashes: slide.flashes?.map((f) => ({ ...f, t: snapLocal(seg, f.t) })),
        shakes: slide.shakes?.map((f) => ({ ...f, t: snapLocal(seg, f.t) })),
        layers: slide.layers.map((l) => {
          const m = l.motion
          if (!m) return l
          if (m.fx === 'keys' && m.keys?.length) {
            // Encaixa o keyframe de impacto (o que chega com "salto" ou "acelera"), senão o primeiro
            const hit = m.keys.find((k) => k.ease === 'salto' || k.ease === 'acelera') ?? [...m.keys].sort((a, b) => a.t - b.t)[0]
            const shift = snapLocal(seg, hit.t) - hit.t
            const keys = m.keys.map((k) => ({ ...k, t: Math.max(0, Math.round((k.t + shift) * 100) / 100) }))
            return { ...l, motion: { ...m, keys, ...keysSpan(keys), shakes: m.shakes?.map((x) => ({ ...x, t: Math.max(0, x.t + shift) })) } } as Layer
          }
          return { ...l, motion: { ...m, start: snapLocal(seg, m.start), shakes: m.shakes?.map((x) => ({ ...x, t: snapLocal(seg, x.t) })) } } as Layer
        }),
      }
    }),
  }
}
