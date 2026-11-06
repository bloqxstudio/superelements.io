/**
 * Elevar o motion: pega o post como ele está (animado ou não) e o transforma
 * numa peça de motion avançada, para qualquer negócio. Cada camada ganha o
 * papel dela (título, texto, foto, botão, logo, forma, fundo) e vira keyframes
 * editáveis na linha do tempo, com rastro de velocidade, loops, tremidas e
 * clarões, mantendo a ordem em que o post já entrava. Um passo desfazível.
 */

import { slideDuration, timeline } from './motion'
import { layerBox } from './render'
import { sizeOf, type Layer, type LayerMotion, type MotionKey, type MotionTransition, type Post, type Slide } from './types'

export type ElevateStyle = 'impacto' | 'dinamico' | 'elegante'

export const ELEVATE_STYLES: { id: ElevateStyle; label: string; hint: string }[] = [
  { id: 'impacto', label: 'Impacto', hint: 'Título bate na tela com tremida e clarão, foto voa e pousa, botão pulsa. Para promoção e anúncio.' },
  { id: 'dinamico', label: 'Dinâmico', hint: 'Entradas rápidas com rastro, foto que flutua, passagem deslizando. Para o dia a dia do feed.' },
  { id: 'elegante', label: 'Elegante', hint: 'Movimentos lentos, desfoque que abre, sem tremida. Para marcas sóbrias, serviços, imóveis, saúde.' },
]

interface Tune {
  gap: number
  speed: number
  dist: number
  impact: boolean
  transition: MotionTransition
  transitionDur: number
}

const TUNE: Record<ElevateStyle, Tune> = {
  impacto: { gap: 0.12, speed: 0.85, dist: 1, impact: true, transition: 'zoom', transitionDur: 0.35 },
  dinamico: { gap: 0.16, speed: 1, dist: 0.8, impact: false, transition: 'push', transitionDur: 0.4 },
  elegante: { gap: 0.24, speed: 1.5, dist: 0.45, impact: false, transition: 'fade', transitionDur: 0.6 },
}

type Role = 'background' | 'title' | 'text' | 'photo' | 'logo' | 'button' | 'buttonText' | 'line' | 'shape' | 'ring' | 'texture'

const r2 = (n: number) => Math.round(n * 100) / 100

function roles(slide: Slide, width: number, height: number): Map<string, Role> {
  const full = width * height
  const visible = slide.layers.filter((l) => !l.hidden)
  const box = new Map(visible.map((l) => [l.id, layerBox(l)]))
  const area = (l: Layer) => box.get(l.id)!.w * box.get(l.id)!.h
  const texts = visible.filter((l) => l.type === 'text')
  const biggest = Math.max(0, ...texts.map((l) => (l.type === 'text' ? l.size : 0)))
  const inside = (outer: Layer, inner: Layer) => {
    const a = box.get(outer.id)!
    const b = box.get(inner.id)!
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    return cx > a.x && cx < a.x + a.w && cy > a.y && cy < a.y + a.h
  }
  const out = new Map<string, Role>()
  for (const l of visible) {
    const big = area(l) > full * 0.45
    if (l.type === 'dots') out.set(l.id, 'texture')
    else if (big) out.set(l.id, 'background')
    else if (l.type === 'image') out.set(l.id, area(l) < full * 0.05 ? 'logo' : 'photo')
    else if (l.type === 'ring') out.set(l.id, 'ring')
    else if (l.type === 'rect') {
      const b = box.get(l.id)!
      if (b.h < height * 0.14 && texts.some((t) => inside(l, t))) out.set(l.id, 'button')
      else out.set(l.id, b.w > b.h * 4 || b.h > b.w * 4 ? 'line' : 'shape')
    }
  }
  for (const t of texts) {
    if (t.type !== 'text') continue
    if (visible.some((l) => out.get(l.id) === 'button' && inside(l, t))) out.set(t.id, 'buttonText')
    else out.set(t.id, t.size >= biggest * 0.8 ? 'title' : 'text')
  }
  return out
}

const keys = (list: MotionKey[], extra: Partial<LayerMotion> = {}): LayerMotion => {
  const ks = list.map((k) => ({ ...k, t: r2(Math.max(0, k.t)) }))
  const ts = ks.map((k) => k.t)
  const start = Math.min(...ts)
  return { fx: 'keys', start, dur: Math.max(0.1, r2(Math.max(...ts) - start)), keys: ks, ...extra }
}

/** O movimento de cada papel, começando em `at`. */
function motionFor(role: Role, at: number, s: Tune, width: number, slideIndex: number, layerIndex: number): LayerMotion | undefined {
  const d = s.dist
  const k = (n: number) => r2(at + n * s.speed)
  const side = (slideIndex + layerIndex) % 2 ? 1 : -1
  switch (role) {
    case 'background':
      return undefined
    case 'texture':
      return { fx: 'fade', start: r2(at), dur: 0.6 }
    case 'title':
      return s.impact
        ? keys([{ t: k(0), scale: 1.7, opacity: 0, rotate: -4 }, { t: k(0.42), scale: 1, opacity: 1, rotate: 0, ease: 'salto' }], { blur: true, shakes: [{ t: k(0.42), amp: 14, dur: 0.3 }] })
        : keys([{ t: k(0), y: 70 * d, opacity: 0, scale: 1.08 }, { t: k(0.55), y: 0, opacity: 1, scale: 1, ease: 'forte' }], { blur: true })
    case 'text':
      return keys([{ t: k(0), y: 50 * d, opacity: 0 }, { t: k(0.5), y: 0, opacity: 1, ease: 'forte' }], { blur: s.speed < 1.2 })
    case 'photo':
      return s.impact
        ? keys(
            [
              { t: k(0), x: side * width * 0.75, y: 260, rotate: side * 24, scale: 0.75, opacity: 1 },
              { t: k(0.5), x: 0, y: 0, rotate: 0, scale: 1, ease: 'forte' },
              { t: k(0.6), sx: 1.06, sy: 0.94, ease: 'linear' },
              { t: k(0.85), sx: 1, sy: 1, ease: 'salto' },
            ],
            { blur: true, loop: 'flutuar', loopSpeed: 0.8 }
          )
        : keys([{ t: k(0), scale: 0.86, opacity: 0, x: side * 60 * d }, { t: k(0.7), scale: 1, opacity: 1, x: 0, ease: s.speed > 1.2 ? 'suave' : 'salto' }], { blur: true, loop: s.speed > 1.2 ? 'respirar' : 'flutuar', loopSpeed: s.speed > 1.2 ? 0.5 : 0.8 })
    case 'logo':
      return keys([{ t: k(0), scale: 0.4, opacity: 0, rotate: -10 }, { t: k(0.45), scale: 1, opacity: 1, rotate: 0, ease: s.speed > 1.2 ? 'suave' : 'salto' }])
    case 'button':
    case 'buttonText':
      return keys([{ t: k(0), scale: 0, opacity: 0 }, { t: k(0.4), scale: 1, opacity: 1, ease: 'salto' }], { loop: s.speed > 1.2 ? undefined : 'pulsar' })
    case 'line':
      return { fx: 'wipe', start: r2(at), dur: r2(0.5 * s.speed), ease: 'forte' }
    case 'ring':
      return keys([{ t: k(0), scale: 0.3, opacity: 0, rotate: -40 }, { t: k(0.6), scale: 1, opacity: 1, rotate: 0, ease: 'salto' }], { loop: 'girar', loopSpeed: 0.15 })
    case 'shape':
      return keys([{ t: k(0), scale: 0.6, opacity: 0 }, { t: k(0.5), scale: 1, opacity: 1, ease: s.speed > 1.2 ? 'suave' : 'salto' }])
  }
}

/** Arredonda o início para meia batida, quando o post tem BPM. */
const onBeat = (t: number, bpm?: number) => (bpm ? r2(Math.round(t / (30 / bpm)) * (30 / bpm)) : r2(t))

export function elevatePost(post: Post, style: ElevateStyle = 'impacto'): Post {
  const s = TUNE[style]
  const { width, height } = sizeOf(post.format)
  const bpm = post.motion?.bpm
  const before = timeline(post).segments
  const slides = post.slides.map((slide, si) => {
    const role = roles(slide, width, height)
    // A ordem em que o post já entrava (o início de antes); sem animação, a leitura de cima para baixo
    const order = slide.layers
      .filter((l) => !l.hidden && role.has(l.id) && role.get(l.id) !== 'background' && role.get(l.id) !== 'buttonText')
      .sort((a, b) => (a.motion?.start ?? 99) - (b.motion?.start ?? 99) || layerBox(a).y - layerBox(b).y || layerBox(a).x - layerBox(b).x)
    const starts = new Map<string, number>()
    const groups = new Map<string, number>()
    let step = 0
    for (const l of order) {
      if (l.group && groups.has(l.group)) {
        starts.set(l.id, groups.get(l.group)!)
        continue
      }
      const at = onBeat(0.2 + step * s.gap * (s.speed > 1.2 ? 1.2 : 1), bpm)
      starts.set(l.id, at)
      if (l.group) groups.set(l.group, at)
      step++
    }
    let titleLand: number | undefined
    const layers = slide.layers.map((l, li) => {
      const r = role.get(l.id)
      if (!r || l.hidden) return l
      let at = starts.get(l.id) ?? 0.2
      if (r === 'buttonText') {
        const btn = slide.layers.find((b) => role.get(b.id) === 'button' && starts.has(b.id))
        at = btn ? starts.get(btn.id)! : at
      }
      if (r === 'background') {
        // Foto de fundo: zoom lento; cor sólida fica parada
        if (l.type === 'image') return { ...l, motion: { fx: 'ken', start: 0, dur: 0.8 } } as Layer
        const { motion: _drop, ...rest } = l
        return rest as Layer
      }
      const m = motionFor(r, at, s, width, si, li)
      if (r === 'title' && titleLand === undefined) titleLand = r2(at + 0.42 * s.speed)
      if (!m) {
        const { motion: _drop, ...rest } = l
        return rest as Layer
      }
      return { ...l, motion: m } as Layer
    })
    // O slide dura o que já durava, sem cortar as entradas novas
    const ends = layers.reduce((e, l) => (l.motion ? Math.max(e, l.motion.start + l.motion.dur) : e), 0)
    const dur = r2(Math.max(2.4, (before[si]?.dur ?? slideDuration(post, slide)), ends + 1.4))
    return {
      ...slide,
      dur,
      camera: slide.camera ?? (style === 'elegante' ? ('zoom-in' as const) : undefined),
      flashes: s.impact && titleLand !== undefined ? [{ t: titleLand, dur: 0.16 }] : undefined,
      shakes: s.impact && titleLand !== undefined ? [{ t: titleLand, amp: 12, dur: 0.28 }] : undefined,
      layers,
    }
  })
  return { ...post, slides, motion: { ...post.motion, transition: post.slides.length > 1 ? s.transition : 'fade', transitionDur: s.transitionDur } }
}
