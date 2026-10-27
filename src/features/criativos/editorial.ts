import { mix } from '@/features/space/brand/color'
import { paletteOf, type Palette } from './brand'
import { alpha } from './color'
import { caseBySlug, caseImage, ILLUSTRATIONS } from './library'
import type { SlideSpec, TemplateId } from './plan'
import { measureText, widestLine } from './render'
import { sizeOf, uid, type FormatId, type ImageLayer, type Layer, type SetBrand, type ShapeLayer, type Slide, type TextLayer } from './types'

/**
 * A linguagem editorial (a da direção criativa de 26/10/2026, testada no
 * conjunto "TEste skill"): o trabalho ocupa a peça, metadados pequenos em
 * alinhamentos fixos no topo, logo pequeno e contador embaixo, título Inter
 * Tight 500 com uma palavra no destaque, até três níveis de texto, uma cor de
 * acento, margem de 64 px. Sem anéis, grade de pontos nem quadrado girado:
 * nada de decoração sem função. Os mesmos modelos (`TemplateId`) da linguagem
 * clássica, desenhados de outro jeito; o conjunto escolhe qual vale.
 */

/** Faixas do story que o Instagram cobre (barra e perfil em cima, resposta embaixo). */
const SAFE = { top: 250, bottom: 300 }

export interface SlideAt {
  index: number
  total: number
  /** Assunto da série, no canto do topo ("Diagnóstico de site", o pilar do story). */
  series?: string
}

interface Ed {
  brand: SetBrand
  p: Palette
  w: number
  h: number
  m: number
  story: boolean
  dark: boolean
  bg: string
  /** Linha dos metadados (topo) e linha do logo (base). */
  meta: number
  foot: number
  /** Onde o conteúdo começa e termina. */
  y0: number
  y1: number
  fg: string
  body: string
  muted: string
  line: string
  /** Acento que lê bem no fundo atual (texto, números); `accent` pinta o botão. */
  hi: string
  at?: SlideAt
}

const lum = (hex: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return 0
  const n = parseInt(m[1], 16)
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
}

/** O tom claro seguinte ao papel (a "pedra"), para variar o fundo sem sair da marca. */
const stoneOf = (brand: SetBrand, p: Palette) => {
  const light = brand.colors.map((c) => c.hex.toLowerCase()).filter((hex) => hex !== p.paper.toLowerCase() && hex !== '#ffffff' && lum(hex) > 200)
  return light.sort((a, b) => lum(b) - lum(a))[0] ?? mix(p.paper, p.ink, 0.06)
}

type Tone = 'paper' | 'white' | 'stone'

const edOf = (brand: SetBrand, format: FormatId, dark: boolean, at?: SlideAt, tone: Tone = 'paper'): Ed => {
  const p = paletteOf(brand)
  const { width: w, height: h } = sizeOf(format)
  const story = h / w > 1.7
  const meta = story ? SAFE.top : 56
  const foot = story ? h - SAFE.bottom - 26 : h - 80
  const bg = dark ? p.ink : tone === 'white' ? '#ffffff' : tone === 'stone' ? stoneOf(brand, p) : p.paper
  return {
    brand, p, w, h, m: 64, story, dark, bg, meta, foot, at,
    y0: meta + (story ? 130 : 134),
    y1: foot - (story ? 70 : 60),
    fg: dark ? '#ffffff' : p.ink,
    body: dark ? mix(p.paper, p.ink, 0.12) : mix(p.ink, p.paper, 0.18),
    muted: dark ? mix(p.paper, p.ink, 0.4) : p.muted,
    line: dark ? 'rgba(255, 255, 255, 0.14)' : mix(p.ink, p.paper, 0.86),
    hi: dark ? mix(p.accent, '#ffffff', 0.5) : p.accent,
  }
}

// ---------- camadas ----------

const text = (c: Ed, name: string, t: string, o: Partial<TextLayer> & Pick<TextLayer, 'x' | 'y' | 'w' | 'size'>): TextLayer => ({
  id: uid(), type: 'text', name, text: t, h: 0, font: c.brand.bodyFont, weight: 400, color: c.fg, align: 'left', lineHeight: 1.3, letterSpacing: 0, emphasisColor: c.hi, ...o,
})

const heightOf = (layer: TextLayer) => measureText(layer).height

/** Encolhe aos poucos até caber em `maxLines` linhas e na largura (sem passar de `floor` do tamanho). */
function fit(layer: TextLayer, maxLines: number, floor = 0.62): TextLayer {
  let current = layer
  const min = layer.size * floor
  while (current.size > min && (measureText(current).lines.length > maxLines || widestLine(current) > current.w + 0.5)) current = { ...current, size: Math.round(current.size * 0.94) }
  return current
}

const title = (c: Ed, t: string, o: Partial<TextLayer> & Pick<TextLayer, 'x' | 'y' | 'w' | 'size'> & { maxLines?: number }) => {
  const { maxLines, ...rest } = o
  return fit(text(c, 'Título', t, { font: c.brand.headingFont, weight: 500, lineHeight: 1.02, letterSpacing: -0.045, emphasis: true, ...rest }), maxLines ?? 4)
}

const label = (c: Ed, t: string, x: number, y: number, w: number) => text(c, 'Rótulo', t, { x, y, w, size: c.story ? 24 : 22, weight: 600, letterSpacing: 0.14, upper: true, color: c.hi })

const support = (c: Ed, t: string, x: number, y: number, w: number, lines = 4) => fit(text(c, 'Apoio', t, { x, y, w, size: c.story ? 34 : 30, color: c.body }), lines, 0.8)

const rect = (name: string, o: Partial<ShapeLayer> & Pick<ShapeLayer, 'x' | 'y' | 'w' | 'h' | 'fill'>): ShapeLayer => ({ id: uid(), type: 'rect', name, radius: 0, ...o })

const image = (name: string, src: string, o: Partial<ImageLayer> & Pick<ImageLayer, 'x' | 'y' | 'w' | 'h'>): ImageLayer => ({ id: uid(), type: 'image', name, src, fit: 'cover', radius: 0, frame: 'none', ...o })

const slide = (c: Ed, layers: Layer[]): Slide => ({ id: uid(), background: c.bg, layers })

/** Topo: a marca à esquerda e o assunto da série à direita, pequenos, sempre no mesmo lugar. */
const metaRow = (c: Ed, color = c.muted): Layer[] => {
  const o = { y: c.meta, w: c.w - c.m * 2, size: c.story ? 20 : 18, weight: 600, letterSpacing: 0.12, upper: true, color, lineHeight: 1.3 }
  return [
    text(c, 'Meta esquerda', c.brand.name, { x: c.m, ...o }),
    ...(c.at?.series ? [text(c, 'Meta direita', c.at.series, { x: c.m, ...o, align: 'right' as const })] : []),
  ]
}

/** Base: o logo pequeno e, no carrossel, o contador (no story, a barra do Instagram já conta as telas). */
const footRow = (c: Ed, onDark = c.dark, color = c.muted): Layer[] => {
  const src = onDark ? c.brand.logoOnDark ?? c.brand.logoOnLight : c.brand.logoOnLight ?? c.brand.logoOnDark
  const logo: Layer = src
    ? image('Logo', src, { x: c.m, y: c.foot, w: 140, h: 26, fit: 'contain' })
    : text(c, 'Logo', c.brand.name, { x: c.m, y: c.foot - 4, w: 400, size: 26, weight: 600, font: c.brand.headingFont, letterSpacing: -0.04, color: onDark ? '#ffffff' : c.p.ink })
  const count = !c.story && c.at && c.at.total > 1 ? [text(c, 'Contador', `${String(c.at.index + 1).padStart(2, '0')} / ${String(c.at.total).padStart(2, '0')}`, { x: c.m, y: c.foot - 2, w: c.w - c.m * 2, size: 20, weight: 600, letterSpacing: 0.08, color, align: 'right' as const })] : []
  return [logo, ...count]
}

/** Botão quadrado no acento, em maiúsculas com a seta. */
const button = (c: Ed, t: string, x: number, y: number): Layer[] => {
  const t2 = `${t.trim()}  →`
  const probe = text(c, 'Botão (texto)', t2, { x: x + 36, y: 0, w: 2000, size: c.story ? 28 : 26, weight: 600, letterSpacing: 0.08, upper: true, color: c.p.onAccent })
  const w = Math.min(c.w - c.m * 2, Math.max(320, Math.ceil(widestLine(probe)) + 72))
  const h = c.story ? 104 : 96
  return [rect('Botão', { x, y, w, h, fill: c.p.accent }), { ...probe, w: w - 72, y: y + (h - heightOf(probe)) / 2 }]
}

/** Linhas numeradas (01, 02…) entre filetes, como um índice. */
function rows(c: Ed, items: string[], top: number, bottom: number): Layer[] {
  const list = items.slice(0, 5)
  const step = Math.min(c.story ? 200 : 150, (bottom - top) / Math.max(1, list.length))
  const size = c.story ? 48 : 44
  return [
    ...list.flatMap((r, i): Layer[] => {
      const y = top + i * step
      const item = fit(text(c, `Item ${i + 1}`, r, { x: c.m + 110, y: 0, w: c.w - c.m * 2 - 110, size, weight: 500, lineHeight: 1.1, letterSpacing: -0.03 }), 2, 0.7)
      const ih = heightOf(item)
      return [
        rect(`Linha ${i + 1}`, { x: c.m, y, w: c.w - c.m * 2, h: 2, fill: c.line }),
        text(c, `Número ${i + 1}`, String(i + 1).padStart(2, '0'), { x: c.m, y: y + step / 2 - 17, w: 80, size: 26, weight: 600, letterSpacing: 0.04, color: c.hi }),
        { ...item, y: y + (step - ih) / 2 },
      ]
    }),
    rect('Linha final', { x: c.m, y: top + list.length * step, w: c.w - c.m * 2, h: 2, fill: c.line }),
  ]
}

/** Um bloco de camadas empilhadas a partir de `y`, com os vãos dados; devolve as camadas e onde acabou. */
function stack(items: { layer: TextLayer; gap: number }[], y: number): { layers: TextLayer[]; end: number } {
  let at = y
  const layers = items.map(({ layer, gap }, i) => {
    at += i ? gap : 0
    const placed = { ...layer, y: at }
    at += heightOf(placed)
    return placed
  })
  return { layers, end: at }
}

const shift = (layers: TextLayer[], dy: number) => layers.map((l) => ({ ...l, y: l.y + dy }))

const caseOf = (spec: SlideSpec) => caseBySlug(spec.case ?? '') ?? caseBySlug('processbase')!

const scene = (spec: SlideSpec, fallback: string) =>
  spec.prompt?.trim() ? spec.prompt.trim() : `Editorial photograph, soft natural light, muted tones, generous empty space, no text, no logos. Subject: ${fallback}`

type Build = (brand: SetBrand, format: FormatId, spec: SlideSpec, at?: SlideAt) => Slide

export const EDITORIAL: Record<TemplateId, Build> = {
  // Foto em tela cheia: manchete no alto (sobre o céu ou o espaço livre), frase do serviço e o logo embaixo
  'foto-manchete': (brand, format, spec, at) => {
    const c = edOf(brand, format, true, at)
    const wide = c.w - c.m * 2
    const head = title(c, spec.title ?? 'Seu projeto é *exclusivo*, seu site também deveria ser.', { x: c.m, y: c.y0, w: Math.round(wide * 0.84), size: c.story ? 112 : 84, maxLines: 4 })
    return slide(c, [
      image('Foto', spec.photo ?? '', { x: 0, y: 0, w: c.w, h: c.h, ...(spec.photo ? {} : { prompt: scene(spec, spec.title ?? 'a contemporary house, natural light, calm') }) }),
      rect('Véu do topo', { x: 0, y: 0, w: c.w, h: Math.round(c.h * 0.5), fill: alpha(c.p.ink, 0.4), fill2: alpha(c.p.ink, 0), angle: 180 }),
      rect('Véu da base', { x: 0, y: Math.round(c.h * 0.8), w: c.w, h: c.h - Math.round(c.h * 0.8), fill: alpha(c.p.ink, 0), fill2: alpha(c.p.ink, 0.4), angle: 180 }),
      ...metaRow(c, 'rgba(255, 255, 255, 0.82)'),
      head,
      ...(spec.body ? [text(c, 'Apoio', spec.body, { x: c.m, y: c.foot - (c.story ? 64 : 58), w: wide, size: c.story ? 32 : 28, color: 'rgba(255, 255, 255, 0.88)' })] : []),
      ...footRow(c, true),
    ])
  },

  // Abre ou fecha uma ideia: rótulo e título grande no alto, a frase de apoio embaixo, perto do logo
  manifesto: (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? true, at)
    const wide = c.w - c.m * 2
    const block = stack([
      ...(spec.label ? [{ layer: label(c, spec.label, c.m, 0, wide), gap: 0 }] : []),
      { layer: title(c, spec.title ?? 'Sites com *acabamento* de estúdio.', { x: c.m, y: 0, w: wide, size: c.story ? 140 : 112, maxLines: 5 }), gap: 28 },
    ], c.y0 + (c.story ? 40 : 0))
    const body = spec.body ? support(c, spec.body, c.m, 0, wide - 160, 3) : undefined
    return slide(c, [
      ...metaRow(c),
      ...block.layers,
      ...(body ? [{ ...body, y: Math.max(block.end + 64, c.y1 - heightOf(body)) }] : []),
      ...footRow(c),
    ])
  },

  // Uma ideia em letras grandes, no meio da tela
  'viral-frase': (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? false, at)
    const wide = c.w - c.m * 2
    const block = stack([
      ...(spec.label ? [{ layer: label(c, spec.label, c.m, 0, wide), gap: 0 }] : []),
      { layer: title(c, spec.title ?? 'Marca forte não *explica*. Ela se faz lembrar.', { x: c.m, y: 0, w: wide, size: c.story ? 128 : 112, maxLines: 6 }), gap: 28 },
      ...(spec.body ? [{ layer: support(c, spec.body, c.m, 0, wide - 80, 3), gap: 44 }] : []),
    ], 0)
    const top = Math.max(c.y0, Math.round((c.y0 + c.y1) / 2 - block.end / 2 - (c.story ? 60 : 0)))
    return slide(c, [...metaRow(c), ...shift(block.layers, top), ...footRow(c)])
  },

  // Um número enorme no acento, um filete e o que ele quer dizer
  'viral-dado': (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? true, at)
    const wide = c.w - c.m * 2
    const size = c.story ? 380 : 320
    const numY = c.y0 + (c.story ? 120 : 60)
    const head = title(c, spec.title ?? 'das pessoas decidem *em segundos*', { x: c.m, y: numY + size * 0.98 + 64, w: wide, size: c.story ? 88 : 76, maxLines: 4 })
    return slide(c, [
      ...metaRow(c),
      label(c, spec.label ?? 'O número', c.m, c.y0, wide),
      text(c, 'Dado', spec.number ?? '73%', { x: c.m - 10, y: numY, w: wide + 20, size, weight: 500, letterSpacing: -0.06, lineHeight: 0.98, color: c.hi, font: brand.headingFont }),
      rect('Filete', { x: c.m, y: numY + size * 0.98 + 24, w: wide, h: 2, fill: c.line }),
      head,
      ...(spec.body ? [text(c, 'Fonte', spec.body, { x: c.m, y: c.y1 - 40, w: wide, size: 22, weight: 500, color: c.muted })] : []),
      ...footRow(c),
    ])
  },

  // Pergunta e três ou quatro linhas numeradas
  lista: (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? false, at)
    const wide = c.w - c.m * 2
    const items = spec.items?.length ? spec.items : ['O site não aparece quando procuram.', 'Quem chega no celular desiste.', 'O WhatsApp quase não toca.']
    const block = stack([
      ...(spec.label ? [{ layer: label(c, spec.label, c.m, 0, wide), gap: 0 }] : []),
      { layer: title(c, spec.title ?? 'Seu site *faz isso*?', { x: c.m, y: 0, w: wide, size: c.story ? 112 : 92, maxLines: 3 }), gap: 28 },
    ], 0)
    const gap = c.story ? 96 : 80
    const step = c.story ? 200 : 150
    const listH = Math.min(items.slice(0, 5).length * step, c.y1 - c.y0 - block.end - gap - 20)
    // No story o bloco (título e linhas) fica no meio da tela; no feed, no alto
    const top = c.story ? Math.max(c.y0, Math.round((c.y0 + c.y1) / 2 - (block.end + gap + listH) / 2 - 40)) : c.y0
    const listTop = top + block.end + gap
    return slide(c, [...metaRow(c), ...shift(block.layers, top), ...rows(c, items, listTop, listTop + listH), ...footRow(c)])
  },

  // O convite: título, botão quadrado e o contato
  cta: (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? true, at)
    const wide = c.w - c.m * 2
    const handle = spec.body && spec.body.length <= 40 && spec.body.includes('@') ? spec.body : undefined
    const block = stack([
      ...(spec.label ? [{ layer: label(c, spec.label, c.m, 0, wide), gap: 0 }] : []),
      { layer: title(c, spec.title ?? 'Veja o site do seu negócio *antes* de fechar.', { x: c.m, y: 0, w: wide, size: c.story ? 116 : 100, maxLines: 5 }), gap: 28 },
      ...(spec.body && !handle ? [{ layer: support(c, spec.body, c.m, 0, wide - 120, 3), gap: 44 }] : []),
    ], 0)
    const btnH = c.story ? 104 : 96
    const total = block.end + 64 + btnH + (handle ? 40 + 40 : 0)
    const top = c.story ? Math.max(c.y0, Math.round((c.y0 + c.y1) / 2 - total / 2 - 40)) : c.y0
    const btnY = top + block.end + 64
    return slide(c, [
      ...metaRow(c),
      ...shift(block.layers, top),
      ...button(c, spec.cta ?? 'Fale com a gente', c.m, btnY),
      ...(handle ? [text(c, 'Perfil', handle, { x: c.m, y: btnY + btnH + 36, w: wide, size: c.story ? 30 : 26, weight: 500, color: c.muted })] : []),
      ...footRow(c),
    ])
  },

  // A capa do site na janela, o título e a ficha (segmento, cidade, plataforma)
  'case-capa': (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? true, at)
    const k = caseOf(spec)
    const wide = c.w - c.m * 2
    const cover = caseImage(k, 'capa')
    const winY = c.meta + (c.story ? 90 : 68)
    const facts = [['Segmento', k.segment], ['Cidade', k.place], ['Plataforma', k.stack]].filter((f): f is [string, string] => !!f[1])
    const colW = Math.floor((wide - 24 * (facts.length - 1)) / facts.length)
    const block = stack([
      ...(spec.label ? [{ layer: label(c, spec.label, c.m, 0, wide), gap: 0 }] : []),
      { layer: title(c, spec.title ?? `${k.name}.`, { x: c.m, y: 0, w: wide, size: c.story ? 104 : 92, maxLines: 3 }), gap: 24 },
      ...(spec.body ? [{ layer: support(c, spec.body, c.m, 0, wide - 80, 2), gap: 28 }] : []),
    ], 0)
    // A janela cede altura para o título e a ficha caberem sem encostar
    const gapWin = c.story ? 72 : 44
    const factsH = 92
    const winH = Math.max(280, Math.min(Math.round(wide * (c.story ? 0.7 : 0.62)), c.y1 - winY - gapWin - block.end - 56 - factsH))
    const blockTop = winY + winH + gapWin
    const factY = Math.min(c.y1 - factsH + 20, blockTop + block.end + 56)
    return slide(c, [
      ...metaRow(c),
      image('Tela do site', cover.src, { x: c.m, y: winY, w: wide, h: winH, frame: 'browser', focusY: 0 }),
      ...shift(block.layers, blockTop),
      ...facts.flatMap(([name, value], i): Layer[] => [
        text(c, `${name} (rótulo)`, name, { x: c.m + i * (colW + 24), y: factY, w: colW, size: 16, weight: 600, letterSpacing: 0.14, upper: true, color: c.muted }),
        fit(text(c, name, value, { x: c.m + i * (colW + 24), y: factY + 30, w: colW, size: 26, weight: 500, lineHeight: 1.2 }), 2, 0.8),
      ]),
      ...footRow(c),
    ])
  },

  // A página do case grande, numa janela, com o rótulo e uma legenda
  'case-janela': (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? false, at, 'white')
    const k = caseOf(spec)
    const wide = c.w - c.m * 2
    const view = spec.view === 'capa' ? 'capa' : 'pagina'
    const block = stack([
      { layer: label(c, spec.label ?? 'No computador', c.m, 0, wide), gap: 0 },
      ...(spec.title ? [{ layer: title(c, spec.title, { x: c.m, y: 0, w: wide, size: c.story ? 84 : 72, maxLines: 3 }), gap: 24 }] : []),
    ], c.y0)
    const caption = support(c, spec.body ?? `${k.name} · ${k.segment}`, c.m, 0, wide, 2)
    const capH = heightOf(caption)
    const winY = block.end + 44
    const winH = Math.max(320, c.y1 - capH - 32 - winY)
    return slide(c, [
      ...metaRow(c),
      ...block.layers,
      image('Página no computador', caseImage(k, view).src, { x: c.m, y: winY, w: wide, h: winH, frame: 'browser', focusY: spec.focus ?? 0 }),
      { ...caption, y: winY + winH + 32, size: Math.min(caption.size, c.story ? 30 : 26) },
      ...footRow(c),
    ])
  },

  // O site no celular de um lado e o texto do outro
  'case-duo': (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? false, at, 'stone')
    const k = caseOf(spec)
    const phW = c.story ? 470 : 440
    const phH = Math.min(Math.round(phW * 2.13), c.y1 - c.y0 + 60)
    const phY = c.story ? Math.round((c.y0 + c.y1) / 2 - phH / 2) : c.y0 - 40
    const tx = c.m + phW + 56
    const tw = c.w - c.m - tx
    const block = stack([
      { layer: label(c, spec.label ?? 'No celular', tx, 0, tw), gap: 0 },
      { layer: title(c, spec.title ?? `${k.name} nas *duas telas*.`, { x: tx, y: 0, w: tw, size: c.story ? 64 : 58, lineHeight: 1.04, letterSpacing: -0.035, maxLines: 6 }), gap: 24 },
      ...(spec.body ? [{ layer: support(c, spec.body, tx, 0, tw, 6), gap: 32 }] : []),
      { layer: text(c, 'Crédito', `${k.name}${k.place ? ` · ${k.place}` : ''}`, { x: tx, y: 0, w: tw, size: 20, weight: 500, color: c.muted }), gap: 40 },
    ], 0)
    return slide(c, [
      ...metaRow(c),
      image('Página no celular', caseImage(k, 'celular').src, { x: c.m, y: phY, w: phW, h: phH, frame: 'phone', focusY: spec.focus ?? 0 }),
      ...shift(block.layers, phY + (c.story ? 60 : 40)),
      ...footRow(c),
    ])
  },

  // Uma ilustração da identidade, com título e uma frase
  ilustracao: (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? false, at)
    const art = ILLUSTRATIONS.find((i) => i.id === spec.illustration) ?? ILLUSTRATIONS[0]
    const wide = c.w - c.m * 2
    const block = stack([
      ...(spec.label ? [{ layer: label(c, spec.label, c.m, 0, wide), gap: 0 }] : []),
      { layer: title(c, spec.title ?? 'Seu site tem *poucos segundos*.', { x: c.m, y: 0, w: wide, size: c.story ? 96 : 84, maxLines: 4 }), gap: 28 },
      ...(spec.body ? [{ layer: support(c, spec.body, c.m, 0, wide - 60, 3), gap: 36 }] : []),
    ], c.y0)
    const room = c.y1 - block.end - 80
    const artH = Math.min(Math.round((wide * art.height) / art.width), room, Math.round(c.h * 0.4))
    return slide(c, [
      ...metaRow(c),
      ...block.layers,
      image('Ilustração', art.src, { x: c.m, y: c.y1 - artH, w: wide, h: artH, fit: 'contain' }),
      ...footRow(c),
    ])
  },

  // Foto gerada em tela cheia; um véu do fundo deixa o título ler no alto (claro) ou na base (escuro)
  'viral-capa': (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? false, at)
    const wide = c.w - c.m * 2
    const veil = c.dark ? c.p.ink : c.p.paper
    const block = stack([
      ...(spec.label ? [{ layer: label(c, spec.label, c.m, 0, wide), gap: 0 }] : []),
      { layer: title(c, spec.title ?? 'Como a marca *conquistou* todo mundo', { x: c.m, y: 0, w: wide, size: c.story ? 116 : 104, maxLines: 4 }), gap: 28 },
      ...(spec.body ? [{ layer: support(c, spec.body, c.m, 0, Math.round(wide * 0.7), 3), gap: 32 }] : []),
    ], 0)
    const top = c.dark ? c.y1 - 40 - block.end : c.y0
    const cover = Math.min(c.h, Math.round(top + block.end + c.h * 0.16))
    return slide(c, [
      image('Foto de capa', '', { x: 0, y: 0, w: c.w, h: c.h, prompt: scene(spec, spec.title ?? 'an empty, quiet room with soft daylight') }),
      ...(c.dark ? [rect('Véu do topo', { x: 0, y: 0, w: c.w, h: c.meta + 150, fill: alpha(c.p.ink, 0.62), fill2: alpha(c.p.ink, 0), angle: 180 })] : []),
      c.dark
        ? rect('Véu', { x: 0, y: Math.round(top - c.h * 0.2), w: c.w, h: c.h - Math.round(top - c.h * 0.2), fill: alpha(veil, 0), fill2: alpha(veil, 0.95), angle: 180 })
        : rect('Véu', { x: 0, y: 0, w: c.w, h: cover, fill: alpha(veil, 0.95), fill2: alpha(veil, 0), angle: 180 }),
      ...metaRow(c, c.dark ? 'rgba(255, 255, 255, 0.8)' : c.p.ink),
      ...shift(block.layers, top),
      ...(c.dark ? footRow(c, true) : []),
    ])
  },

  // Foto em cima; embaixo o número no quadrado do acento, o título e uma frase
  'viral-foto': (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? false, at)
    const wide = c.w - c.m * 2
    const imgH = Math.round(c.h * (c.story ? 0.44 : 0.46))
    const badge = c.story ? 64 : 56
    const block = stack([
      { layer: title(c, spec.title ?? 'O detalhe que *ninguém* percebeu', { x: c.m, y: 0, w: wide, size: c.story ? 76 : 64, lineHeight: 1.05, letterSpacing: -0.04, maxLines: 3 }), gap: 0 },
      ...(spec.body ? [{ layer: support(c, spec.body, c.m, 0, wide - 60, 3), gap: 28 }] : []),
    ], imgH + 56 + badge + 36)
    return slide(c, [
      image('Foto', '', { x: 0, y: 0, w: c.w, h: imgH, prompt: scene(spec, spec.title ?? 'a candid editorial photograph') }),
      rect('Véu do topo', { x: 0, y: 0, w: c.w, h: Math.round(c.meta + 120), fill: alpha(c.p.ink, 0.55), fill2: alpha(c.p.ink, 0), angle: 180 }),
      ...metaRow(c, 'rgba(255, 255, 255, 0.85)'),
      rect('Número (fundo)', { x: c.m, y: imgH + 56, w: badge, h: badge, fill: c.p.accent }),
      text(c, 'Número', spec.number ?? '01', { x: c.m, y: imgH + 56 + (badge - 36) / 2, w: badge, size: 28, weight: 600, align: 'center', color: c.p.onAccent }),
      ...block.layers,
      ...footRow(c),
    ])
  },

  // Fecho do carrossel: o que fazer com o post, numerado
  'viral-fecho': (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? true, at)
    const wide = c.w - c.m * 2
    const items = spec.items?.length ? spec.items : ['Salve para consultar depois', 'Envie para quem precisa ver', 'Siga para ver o próximo']
    const block = stack([
      { layer: label(c, spec.label ?? 'Gostou?', c.m, 0, wide), gap: 0 },
      { layer: title(c, spec.title ?? 'Isso vale *ouro*. Não deixe passar.', { x: c.m, y: 0, w: wide, size: c.story ? 104 : 92, maxLines: 3 }), gap: 28 },
    ], c.y0)
    const top = block.end + 72
    return slide(c, [
      ...metaRow(c),
      ...block.layers,
      ...rows(c, items, top, Math.min(c.y1 - 90, top + items.length * 130)),
      ...(spec.body ? [text(c, 'Perfil', spec.body, { x: c.m, y: c.y1 - 40, w: wide, size: 26, weight: 500, color: c.muted })] : []),
      ...footRow(c),
    ])
  },
}
