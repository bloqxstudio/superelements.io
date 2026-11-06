/**
 * Modelo publicitário de delivery (hamburgueria, pizzaria, restaurante): um
 * filme de marca de 9:16 no ritmo da trilha, no estilo dos comerciais de app de
 * comida. Abre com a frase escrita à mão, bate o nome da marca, mostra o celular
 * na mão, passa as categorias (título gigante, prato voando com rastro, etiqueta
 * de preço que salta), a moto "rapidinho", o pino no mapa, o pedido entregue com
 * estrelas e fecha na marca. Tudo em keyframes (`fx: 'keys'`), então cada peça
 * se ajusta na linha do tempo; as cenas trocam em corte seco, mas cada uma sai
 * para um lado e a próxima entra do outro, o que dá o "contínuo" do comercial.
 */

import { BURGER, CART, HAND, MOTO, PHONE, PIN, PIZZA, SALAD, SUSHI } from './foodArt'
import { uid, type Layer, type LayerMotion, type MotionKey, type Post, type Slide, type TextLayer } from './types'

export interface FoodCategory {
  name: string
  price: string
  /** Imagem do prato (`asset:<id>` ou endereço); sem ela, a ilustração provisória. */
  image?: string
}

export interface FoodAdOptions {
  brand: string
  /** Cor principal (o fundo das cenas fortes). */
  color?: string
  /** Segunda cor (mão, "rapidinho"). */
  accent?: string
  hook?: string
  tagline?: string
  categories?: FoodCategory[]
  delivered?: string
  closing?: string
  cta?: string
  /** Batidas por minuto da trilha: as cenas duram batidas inteiras. */
  bpm?: number
}

const W = 1080
const DISPLAY = 'Montserrat'
const HAND_FONT = 'Permanent Marker'

const DEFAULT_CATEGORIES: FoodCategory[] = [
  { name: 'Burger', price: 'R$ 29,90', image: BURGER },
  { name: 'Pizza', price: 'R$ 44,00', image: PIZZA },
  { name: 'Sushi', price: 'R$ 64,00', image: SUSHI },
  { name: 'Salada', price: 'R$ 24,90', image: SALAD },
]

const ART = [BURGER, PIZZA, SUSHI, SALAD]

const text = (name: string, value: string, x: number, y: number, w: number, h: number, size: number, color: string, extra: Partial<TextLayer> = {}): TextLayer => ({
  id: uid(),
  type: 'text',
  name,
  text: value,
  x,
  y,
  w,
  h,
  font: DISPLAY,
  weight: 900,
  size,
  color,
  align: 'center',
  lineHeight: 1,
  letterSpacing: -0.02,
  ...extra,
})

const image = (name: string, src: string, x: number, y: number, w: number, h: number): Layer => ({ id: uid(), type: 'image', name, src, x, y, w, h, fit: 'contain', radius: 0, frame: 'none' })

const rect = (name: string, fill: string, x: number, y: number, w: number, h: number, radius = 0): Layer => ({ id: uid(), type: 'rect', name, fill, x, y, w, h, radius })

const r2 = (n: number) => Math.round(n * 100) / 100

/** Tamanho para o nome caber numa linha (Montserrat 900 tem ~0,64 em por letra). */
const fitSize = (value: string, max: number, width = W - 120) => Math.round(Math.min(max, width / Math.max(1, value.length * 0.64)))

/** A camada anima por keyframes (o começo e a duração da barra saem dos pontos). */
function keys(layer: Layer, list: MotionKey[], extra: Partial<LayerMotion> = {}): Layer {
  const ks = list.map((k) => ({ ...k, t: r2(Math.max(0, k.t)) }))
  const ts = ks.map((k) => k.t)
  const start = Math.min(...ts)
  return { ...layer, motion: { fx: 'keys', start, dur: Math.max(0.1, r2(Math.max(...ts) - start)), keys: ks, ...extra } } as Layer
}

/**
 * Peças de um grupo que crescem e giram em volta do centro do grupo, não cada uma
 * em volta do próprio centro (a etiqueta de preço salta inteira).
 */
function groupKeys(layers: Layer[], list: MotionKey[], extra: Partial<LayerMotion> = {}): Layer[] {
  const x0 = Math.min(...layers.map((l) => l.x))
  const y0 = Math.min(...layers.map((l) => l.y))
  const gx = (Math.max(...layers.map((l) => l.x + l.w)) + x0) / 2
  const gy = (Math.max(...layers.map((l) => l.y + l.h)) + y0) / 2
  const group = uid()
  const full = list.map((k, i) => ({ scale: 1, rotate: 0, x: 0, y: 0, ...list.slice(0, i).reduce((acc, p) => ({ ...acc, ...p }), {}), ...k }))
  return layers.map((l) => {
    const ox = l.x + l.w / 2 - gx
    const oy = l.y + l.h / 2 - gy
    return {
      ...keys(
        l,
        full.map((k) => {
          const a = ((k.rotate ?? 0) * Math.PI) / 180
          const s = k.scale ?? 1
          const rx = (ox * Math.cos(a) - oy * Math.sin(a)) * s
          const ry = (ox * Math.sin(a) + oy * Math.cos(a)) * s
          return { ...k, x: (k.x ?? 0) + rx - ox, y: (k.y ?? 0) + ry - oy }
        }),
        extra
      ),
      group,
    }
  })
}

const fx = (layer: Layer, motion: LayerMotion): Layer => ({ ...layer, motion }) as Layer

/** Entra pela direita, segura e sai pela esquerda (a "passada" das cenas). */
const swipe = (enter: number, leave: number, from = W * 1.2, to = -W * 1.35): MotionKey[] => [
  { t: enter, x: from },
  { t: enter + 0.35, x: 0, ease: 'forte' },
  { t: leave, x: 0, ease: 'linear' },
  { t: leave + 0.3, x: to, ease: 'acelera' },
]

const slide = (name: string, background: string, dur: number, layers: Layer[], extra: Partial<Slide> = {}): Slide => ({ id: uid(), background, dur: r2(dur), layers: layers.map((l) => ({ ...l, name: `${name} · ${l.name}` })), ...extra })

export function foodAdPost(o: FoodAdOptions): Post {
  const red = o.color ?? '#E3262F'
  const accent = o.accent ?? '#9B7BFF'
  const ink = '#1B1B1F'
  const b = 60 / Math.min(180, Math.max(70, o.bpm ?? 120))
  const cats = (o.categories?.length ? o.categories : DEFAULT_CATEGORIES.slice(0, 3)).slice(0, 4).map((c, i) => ({ ...c, image: c.image || ART[i % ART.length] }))
  const slides: Slide[] = []

  // 1 · A frase escrita à mão
  {
    const d = 4 * b
    slides.push(
      slide('Abertura', red, d, [fx(text('Frase', o.hook ?? 'Tá com fome?', 80, 860, W - 160, 200, 128, '#ffffff', { font: HAND_FONT, weight: 400, letterSpacing: 0 }), { fx: 'letters', start: 0.15, dur: 2 * b, ease: 'forte', exit: 'zoom', exitDur: 0.25 })])
    )
  }

  // 2 · A marca bate na tela
  {
    const d = 4 * b
    const name = keys(text('Marca', o.brand, 60, 860, W - 120, 200, fitSize(o.brand, 210), '#ffffff', { letterSpacing: -0.04 }), [
      { t: 0, scale: 0.15, rotate: -14, opacity: 0 },
      { t: b, scale: 1, rotate: 0, opacity: 1, ease: 'salto' },
      { t: d - 0.25, scale: 1.04, ease: 'linear' },
      { t: d, scale: 3, opacity: 0, ease: 'acelera' },
    ], { blur: true, shakes: [{ t: b, amp: 12, dur: 0.3 }] })
    const line = fx(rect('Traço', '#ffffff', 340, 1090, 400, 14, 7), { fx: 'wipe', start: b + 0.05, dur: 0.35, exit: 'fade', exitDur: 0.2 })
    slides.push(slide('Marca', red, d, [name, line], { shakes: [{ t: b, amp: 16, dur: 0.35 }], flashes: [{ t: b, dur: 0.18 }] }))
  }

  // 3 · O app na palma da mão
  {
    const d = 6 * b
    const glow = fx(rect('Brilho', '#ffffff', -110, 380, 1300, 1300, 999), { fx: 'pop', start: 0, dur: 0.5, loop: 'respirar' })
    const hand = keys(image('Mão', HAND(accent), 300, 980, 620, 760), [
      { t: 0, y: 900 },
      { t: 0.55, y: 0, ease: 'forte' },
      { t: d - 0.35, y: -20, ease: 'linear' },
      { t: d, x: -W * 1.3, ease: 'acelera' },
    ], { blur: true })
    const phone = keys(image('Celular', PHONE(red), 290, 560, 520, 1000), [
      { t: 0.08, y: 1100, rotate: 24 },
      { t: 0.7, y: 0, rotate: -8, ease: 'salto' },
      { t: d - 0.35, y: -30, rotate: -5, ease: 'linear' },
      { t: d, x: -W * 1.3, rotate: -20, ease: 'acelera' },
    ], { blur: true })
    const title = fx(text('Título', o.tagline ?? 'Na palma da sua mão!', 60, 200, W - 120, 300, 112, '#ffffff', { italic: true, upper: true, lineHeight: 0.95 }), { fx: 'words', start: 0.7, dur: 0.6, ease: 'elastico', exit: 'left', exitDur: 0.3 })
    slides.push(slide('Celular', red, d, [{ ...glow, opacity: 0.12 }, hand, phone, title]))
  }

  // 4 · As categorias: título gigante, prato voando, etiqueta de preço
  cats.forEach((c, i) => {
    const d = 4 * b
    const leave = d - 0.3
    const title = keys(text('Título', c.name, 50, 300, W - 100, 280, fitSize(c.name, 250, W - 100), '#ffffff', { align: 'left', letterSpacing: -0.05 }), swipe(0, leave), { blur: true })
    const fromLeft = i % 2 === 0
    const dish = keys(image('Prato', c.image!, 150, 640, 780, 740), [
      { t: 0.05, x: fromLeft ? -950 : 950, y: 700, rotate: fromLeft ? -50 : 50, scale: 0.7 },
      { t: 0.55, x: 0, y: 0, rotate: -6, scale: 1, ease: 'forte' },
      { t: 0.65, sx: 1.07, sy: 0.93, ease: 'linear' },
      { t: 0.9, sx: 1, sy: 1, ease: 'salto' },
      { t: leave, rotate: -2, scale: 1.05, ease: 'linear' },
      { t: d, x: -W * 1.4, y: -250, rotate: -30, ease: 'acelera' },
    ], { blur: true })
    const tagKeys: MotionKey[] = [
      { t: 1.5 * b, scale: 0, rotate: -10 },
      { t: 1.5 * b + 0.35, scale: 1, rotate: 0, ease: 'salto' },
      { t: leave, scale: 1, ease: 'linear' },
      { t: d, x: -W * 1.3, ease: 'acelera' },
    ]
    const tag = groupKeys([rect('Etiqueta', '#ffffff', 400, 1420, 580, 150, 999), text('Preço', c.price, 430, 1458, 400, 76, 68, ink, { weight: 800 }), image('Carrinho', CART(red), 836, 1430, 130, 130)], tagKeys)
    slides.push(
      slide(`Categoria ${i + 1}`, red, d, [dish, title, ...tag], {
        shakes: [{ t: 0.55, amp: 10, dur: 0.25 }],
      })
    )
  })

  // 5 · Rapidinho
  {
    const d = 5 * b
    const word = keys(text('Rapidinho', 'RAPIDINHO', 20, 580, W - 40, 220, 165, accent, { letterSpacing: -0.06 }), [
      { t: 0, x: 900, sx: 2.4, opacity: 0 },
      { t: 0.35, x: 0, sx: 1, opacity: 1, ease: 'forte' },
      { t: d - 0.3, x: -40, ease: 'linear' },
      { t: d, x: -W * 1.4, sx: 1.8, ease: 'acelera' },
    ], { blur: true })
    const moto = keys(image('Moto', MOTO(red), 90, 840, 900, 620), [
      { t: 0.15, x: -1300 },
      { t: 0.6, x: 0, ease: 'forte' },
      { t: d - 0.4, x: 60, ease: 'linear' },
      { t: d, x: 1500, ease: 'acelera' },
    ], { blur: true, shakes: [{ t: 0.6, amp: 5, dur: d - 1 }] })
    slides.push(slide('Rapidinho', '#FAFAF7', d, [word, moto]))
  }

  // 6 · O pino no mapa
  {
    const d = 5 * b
    const blocks: Layer[] = []
    for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) blocks.push(rect('Quadra', '#ECE6D6', 40 + c * 350, 120 + r * 300, 300, 250, 28))
    const pin = keys(image('Pino', PIN(red), 460, 760, 160, 220), [
      { t: 0.2, y: -1000 },
      { t: 0.6, y: 0, ease: 'acelera' },
      { t: 0.68, sx: 1.25, sy: 0.75, ease: 'linear' },
      { t: 0.95, sx: 1, sy: 1, ease: 'salto' },
    ], { shakes: [] })
    const label = fx(text('Chegando', 'Chegando…', 140, 1040, 800, 90, 72, ink, { weight: 800 }), { fx: 'rise', start: 0.9, dur: 0.4 })
    slides.push(slide('Mapa', '#F6F2E8', d, [...blocks, pin, label], { camera: 'zoom-in', shakes: [{ t: 0.6, amp: 8, dur: 0.2 }] }))
  }

  // 7 · Pedido entregue
  {
    const d = 5 * b
    const circle = keys(rect('Círculo', '#2BB673', 410, 620, 260, 260, 999), [
      { t: 0.1, scale: 0 },
      { t: 0.5, scale: 1, ease: 'salto' },
    ], { shakes: [{ t: 0.5, amp: 6, dur: 0.2 }] })
    const check = fx(text('Certo', '✓', 410, 655, 260, 190, 170, '#ffffff', { font: 'Inter', weight: 800 }), { fx: 'pop', start: 0.45, dur: 0.35 })
    const msg = fx(text('Mensagem', o.delivered ?? 'Seu pedido foi entregue', 80, 950, W - 160, 90, 64, ink, { weight: 800 }), { fx: 'words', start: 0.7, dur: 0.5 })
    const stars = fx(text('Estrelas', '★★★★★', 240, 1080, 600, 110, 96, '#FFC21A', { font: 'Inter', weight: 700, letterSpacing: 0.08 }), { fx: 'letters', start: 1.1, dur: 0.6, ease: 'elastico' })
    slides.push(slide('Entregue', '#ffffff', d, [circle, check, msg, stars]))
  }

  // 8 · Foi tranquilo
  {
    const d = 4 * b
    slides.push(slide('Tranquilo', red, d, [fx(text('Frase', o.closing ?? 'Foi tranquilo!', 80, 860, W - 160, 200, 120, '#ffffff', { font: HAND_FONT, weight: 400, letterSpacing: 0 }), { fx: 'letters', start: 0.1, dur: 1.6 * b, ease: 'forte' })]))
  }

  // 9 · Fecho na marca
  {
    const d = 6 * b
    const name = keys(text('Marca', o.brand, 60, 800, W - 120, 200, fitSize(o.brand, 200), '#ffffff', { letterSpacing: -0.04 }), [
      { t: 0, scale: 0.2, opacity: 0, rotate: 10 },
      { t: b, scale: 1, opacity: 1, rotate: 0, ease: 'salto' },
    ], { shakes: [{ t: b, amp: 12, dur: 0.3 }] })
    const group = uid()
    const btn = fx(rect('Botão', '#ffffff', 290, 1110, 500, 130, 999), { fx: 'pulse', start: 2 * b, dur: 0.5, loop: 'pulsar' })
    const label = fx(text('Botão · texto', (o.cta ?? 'Peça agora').toUpperCase(), 290, 1145, 500, 64, 52, red, { weight: 900 }), { fx: 'pulse', start: 2 * b, dur: 0.5, loop: 'pulsar' })
    slides.push(slide('Fecho', red, d, [name, { ...btn, group }, { ...label, group }], { flashes: [{ t: b, dur: 0.2 }], shakes: [{ t: b, amp: 14, dur: 0.3 }] }))
  }

  return { id: uid(), name: `${o.brand} · Comercial de delivery`, format: '9x16', slides, motion: { transition: 'cut', transitionDur: 0.1, bpm: o.bpm ?? 120 } }
}
