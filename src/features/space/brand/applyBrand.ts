import type { ElementorKit } from '@/engine/elementor/types'
import type { ElementorCustomization } from '@/features/elementor-preview/useElementorDocument'
import {
  BUTTON_WIDGET,
  buttonKind,
  FORM_BUTTON,
  hasBackgroundImage,
  isBand,
  isCard,
  isPill,
  type ButtonKeys,
  type ButtonKind,
} from './apply/classify'
import { brandRole, setBrandCss, type BrandRole, type Settings } from './apply/elementor'
import { applyLogo, siteLogoUrls } from './apply/logo'
import { applyEntrance, buttonHover, cardHover, delayRanks, isAnimated, originalDelay } from './apply/motion'
import { applyButton, applyContainerShape, applyDivider, applyImageShape, applyInputs } from './apply/shape'
import { applyCard, applyImageFilter, applyShadow } from './apply/surfaces'
import { applyTypography } from './apply/typography'
import { contrast, oklch, parseColor, recolor, type Rgba } from './color'
import type { Brand } from './designMd'

/**
 * Aplica a marca do DESIGN.md numa seção do Elementor, por código: a mesma
 * seção com a mesma marca sai sempre igual, e aplicar de novo não muda nada.
 *
 * Cores: as seções trazem hex fixo em cada widget (o pack não usa cores
 * globais), então cada cor vira a cor da marca de luminosidade mais próxima.
 * Isso mantém o claro claro e o escuro escuro. Cores vivas vão para as cores
 * vivas da marca quando a luminosidade é parecida. Se a troca deixar um texto
 * ilegível sobre o fundo (e ele era legível antes), o texto vai para a cor da
 * marca que contrasta.
 *
 * Depois das cores vêm as camadas (pasta `apply/`), cada uma só quando o guia
 * fala dela: tipografia por papel do texto, botões, cantos, campos, divisores,
 * cards e sombra, imagens, logo e movimento. O layout (tamanhos, espaços,
 * estrutura) não muda.
 */

interface Element {
  elType?: string
  widgetType?: string
  settings?: Record<string, unknown> | unknown[]
  elements?: Element[]
  [key: string]: unknown
}

interface Swatch {
  hex: string
  rgba: Rgba
  l: number
  c: number
}

interface Palette {
  all: Swatch[]
  neutrals: Swatch[]
  vivid: Swatch[]
}

/** Croma a partir do qual a cor conta como viva, não como tom de cinza. */
const VIVID_CHROMA = 0.07
/** Diferença máxima de luminosidade para uma cor viva virar a cor viva da marca. */
const VIVID_MAX_DISTANCE = 0.3

const MIN_CONTRAST = 3
const GOOD_CONTRAST = 4.5

/** Cores de texto conferidas contra o fundo em que ficam. */
const FOREGROUND_KEYS = [
  'title_color',
  'text_color',
  'description_color',
  'button_text_color',
  'number_color',
  'heading_color',
  'price_color',
]

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 }

function buildPalette(brand: Brand): Palette {
  const all = brand.colors.map(({ hex }) => {
    const rgba = parseColor(hex)!
    return { hex, rgba, ...oklch(rgba) }
  })
  return {
    all,
    neutrals: all.filter((s) => s.c < VIVID_CHROMA),
    vivid: all.filter((s) => s.c >= VIVID_CHROMA),
  }
}

const nearest = (swatches: Swatch[], l: number) =>
  swatches.reduce((best, s) => (Math.abs(s.l - l) < Math.abs(best.l - l) ? s : best))

function brandSwatchFor(color: Rgba, palette: Palette): Swatch {
  const { l, c } = oklch(color)
  if (c >= VIVID_CHROMA && palette.vivid.length) {
    const vivid = nearest(palette.vivid, l)
    if (Math.abs(vivid.l - l) <= VIVID_MAX_DISTANCE) return vivid
  }
  return nearest(palette.neutrals.length ? palette.neutrals : palette.all, l)
}

interface Context {
  palette: Palette
  brand: Brand
  /** Cor original (texto do JSON) → cor da marca, para a seção inteira sair coerente. */
  cache: Map<string, string>
  /** Cor de filete: a do divisor, ou a cor de borda da paleta. */
  hairline?: string
}

function mapColor(value: string, ctx: Context): string {
  const cached = ctx.cache.get(value)
  if (cached) return cached
  const color = parseColor(value)
  const mapped = color ? recolor(value, brandSwatchFor(color, ctx.palette).hex) : value
  ctx.cache.set(value, mapped)
  return mapped
}

/** Toda string de cor em chaves `*color*`, inclusive em objetos aninhados (sombras, itens de lista). */
function recolorDeep(node: unknown, ctx: Context, key = ''): unknown {
  if (Array.isArray(node)) return node.map((item) => recolorDeep(item, ctx))
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    // __globals__ guarda referências às cores do kit, não cores
    for (const k of Object.keys(obj)) if (k !== '__globals__') obj[k] = recolorDeep(obj[k], ctx, k)
    return obj
  }
  if (typeof node === 'string' && /color/i.test(key) && parseColor(node)) return mapColor(node, ctx)
  return node
}

interface Background {
  original: Rgba
  branded: Rgba
}

/** Fundo sólido que o próprio elemento pinta, antes e depois da marca. */
function ownBackground(before: Record<string, unknown>, after: Record<string, unknown>, prefix: string): Background | null {
  if (before[`${prefix}_background`] !== 'classic') return null
  const original = parseColor(before[`${prefix}_color`])
  const branded = parseColor(after[`${prefix}_color`])
  return original && branded && original.a >= 0.5 ? { original, branded } : null
}

/** Cor para um texto que ficou ilegível: neutra de preferência, para não espalhar o acento pelos textos. */
function readableSwatch(background: Rgba, current: Rgba, palette: Palette, target: number): Swatch {
  const { l } = oklch(current)
  const passes = (s: Swatch) => contrast(s.rgba, background) >= target
  const good = palette.neutrals.filter(passes).length ? palette.neutrals.filter(passes) : palette.all.filter(passes)
  if (good.length) return nearest(good, l)
  return palette.all.reduce((best, s) => (contrast(s.rgba, background) > contrast(best.rgba, background) ? s : best))
}

function guardContrast(before: Record<string, unknown>, after: Record<string, unknown>, bg: Background, ctx: Context) {
  for (const key of FOREGROUND_KEYS) {
    const original = parseColor(before[key])
    const branded = parseColor(after[key])
    if (!original || !branded || original.a < 0.5) continue

    // Texto de botão fica sobre o fundo do botão (se a marca deixou o botão transparente, sobre o fundo em volta)
    let pair = bg
    if (key === 'button_text_color') {
      for (const bgKey of ['button_background_color', 'background_color']) {
        const o = parseColor(before[bgKey])
        const b = parseColor(after[bgKey])
        if (o && b && o.a >= 0.5) {
          if (b.a >= 0.5) pair = { original: o, branded: b }
          break
        }
      }
    }

    // A marca nunca deixa o texto menos legível do que ele era (até o mínimo de 3:1).
    // Ao corrigir, mira entre 3:1 e 4.5:1 e fica no tom mais próximo: texto discreto continua discreto.
    const was = contrast(original, pair.original)
    if (contrast(branded, pair.branded) >= Math.min(MIN_CONTRAST, was)) continue
    const target = Math.min(GOOD_CONTRAST, Math.max(MIN_CONTRAST, was))
    after[key] = recolor(before[key] as string, readableSwatch(pair.branded, branded, ctx.palette, target).hex)
  }
}

/**
 * Cor da marca para texto de botão ou campo que ficaria apagado sobre `bg`:
 * a neutra de maior contraste (branco numa faixa escura, e não um cinza médio).
 */
function readableOn(bg: Rgba, palette: Palette): string {
  if (!palette.all.length) return oklch(bg).l > 0.6 ? '#111111' : '#ffffff'
  const pool = palette.neutrals.length ? palette.neutrals : palette.all
  return pool.reduce((best, s) => (contrast(s.rgba, bg) > contrast(best.rgba, bg) ? s : best)).hex
}

/** Onde o elemento está: fundo em volta, profundidade, faixa e card que o contêm. */
interface Scope {
  bg: Background
  depth: number
  parent: Settings | null
  /** A faixa tem foto ou degradê (vidro faz sentido). */
  overImage: boolean
  inCard: boolean
  /** O fundo mais próximo é uma foto (ou degradê): não dá para medir contraste contra ele. */
  imageBehind: boolean
  /** Atraso original → posição na faixa, para escalonar a entrada. */
  ranks: Map<number, number> | null
  /** Alcance 'content': próxima posição na faixa, na ordem do documento. */
  order: { next: number } | null
  /** URLs que são o logo do site nesta seção. */
  siteLogos: Set<string>
}

/** Widgets que não têm o que mostrar entrando (espaço, filete, código). */
const STILL_WIDGETS = new Set(['spacer', 'divider', 'html', 'shortcode', 'menu-anchor'])

const settingsOf = (el: Element): Settings | null => (el.settings && !Array.isArray(el.settings) ? (el.settings as Settings) : null)

/** Atrasos das animações de entrada de uma faixa inteira (antes de qualquer troca). */
function collectDelays(el: Element, out: number[] = []): number[] {
  const s = settingsOf(el)
  const isWidget = el.elType === 'widget' || !!el.widgetType
  if (s && isAnimated(s, isWidget)) out.push(originalDelay(s, isWidget))
  for (const child of el.elements ?? []) collectDelays(child, out)
  return out
}

function brandElements(elements: Element[], scope: Scope, ctx: Context) {
  const { brand, palette } = ctx
  const isContainer = (el: Element) => !(el.elType === 'widget' || el.widgetType)

  // Cards irmãos numa grade ganham o hover de card
  const cards = elements.map((el) => {
    const s = settingsOf(el)
    if (!s || !isContainer(el) || scope.inCard) return false
    return !!brandRole(s) || isCard(s, isBand(s, scope.depth, scope.parent), scope.imageBehind ? null : scope.bg.original)
  })
  const inGrid = cards.filter(Boolean).length >= 2

  elements.forEach((el, index) => {
    let inner = scope.bg
    const s = settingsOf(el)
    const siteLogos = scope.depth === 0 && brand.logo ? siteLogoUrls(el, brand) : scope.siteLogos
    let childScope: Scope = { ...scope, depth: scope.depth + 1, siteLogos }

    if (s) {
      const before = { ...s }
      const widget = !isContainer(el)
      const band = !widget && isBand(before, scope.depth, scope.parent)
      const card = cards[index]
      const ranks = band && brand.layers.motion?.stagger !== undefined ? delayRanks(collectDelays(el)) : scope.ranks
      const order = band && brand.layers.motion?.animate === 'content' ? { next: 0 } : scope.order
      const overImage = scope.overImage || (band && hasBackgroundImage(before))
      const readable = (bg: Rgba) => readableOn(bg, palette)
      const css: string[] = []
      let role: BrandRole | undefined

      if (palette.all.length) recolorDeep(s, ctx)

      // Botão: o tipo (cheio, contorno, link, ícone) é lido antes das cores mudarem
      let keys: ButtonKeys | null = null
      let kind: ButtonKind | null = null
      if (el.widgetType === 'button') keys = BUTTON_WIDGET
      if (el.widgetType === 'form') keys = FORM_BUTTON
      const around = scope.imageBehind ? null : scope.bg.branded
      if (keys) kind = buttonKind(before, keys, scope.imageBehind ? null : scope.bg.original, el.widgetType === 'button')
      const spec = kind === 'primary' || kind === 'secondary' ? brand.layers.buttons?.[kind] : undefined

      applyTypography(s, el.widgetType, brand, spec)

      if (keys && kind) applyButton(s, keys, kind, spec, brand, around, readable)
      if (el.widgetType === 'form') applyInputs(s, brand, around, readable)
      if (widget) {
        applyShadow(s, brand.layers.shadow)
        applyDivider(s, el.widgetType, brand, false)
      } else {
        role = card ? (brandRole(before) ?? (isPill(before) ? 'pill' : 'card')) : undefined
        applyContainerShape(s, brand, card, role === 'pill', scope.inCard)
        if (card) css.push(applyCard(s, brand, { overImage, parentBg: around, hairline: ctx.hairline }))
        else {
          applyShadow(s, brand.layers.shadow)
          applyDivider(s, undefined, brand, true)
        }
      }
      if (el.widgetType === 'image') {
        const url = String((before.image as { url?: unknown } | undefined)?.url ?? '')
        const logo = siteLogos.has(url) && applyLogo(s, brand, scope.imageBehind ? null : scope.bg.branded, scope.parent)
        if (!logo) {
          applyImageShape(s, brand, scope.inCard)
          applyImageFilter(s, brand)
        }
      }

      const motion = brand.layers.motion
      if (motion) {
        if (motion.animate === 'content') {
          // O card entra inteiro; fora de card, cada peça entra na sua vez
          const target = !scope.inCard && (widget ? !STILL_WIDGETS.has(String(el.widgetType)) : !!card)
          css.push(applyEntrance(s, widget, motion, target && order ? order.next++ : undefined, target))
        } else css.push(applyEntrance(s, widget, motion, ranks?.get(originalDelay(before, widget))))
        if (el.widgetType === 'button') css.push(buttonHover(s, motion))
        if (card && inGrid) css.push(cardHover(motion))
      }
      // Sempre: tira o bloco de uma aplicação anterior mesmo quando não há CSS novo
      setBrandCss(s, css.filter(Boolean).join(''), role)

      // O fundo é seguido mesmo sem cores na marca: o logo escolhe a versão por ele
      inner = ownBackground(before, s, widget ? '_background' : 'background') ?? scope.bg
      // Sobre foto não há fundo para medir: texto branco sobre a imagem continua como a seção pensou
      if (palette.all.length && widget && (!scope.imageBehind || inner !== scope.bg)) guardContrast(before, s, inner, ctx)
      // Foto sem cor por cima: o que vem dentro fica sobre a foto; um fundo sólido volta a ser medível
      const ownPhoto = !widget && hasBackgroundImage(before) && !ownBackground(before, s, 'background')
      const imageBehind = ownPhoto || (!ownBackground(before, s, widget ? '_background' : 'background') && scope.imageBehind)
      childScope = { bg: inner, depth: scope.depth + 1, parent: before, overImage, inCard: scope.inCard || card, imageBehind, ranks, order, siteLogos }
    }
    if (Array.isArray(el.elements) && el.elements.length) brandElements(el.elements, childScope, ctx)
  })
}

/** Cópia dos elementos com a marca aplicada. */
export function applyBrand<T>(elements: T[], brand: Brand): T[] {
  const result: Element[] = JSON.parse(JSON.stringify(elements))
  const hairline = brand.layers.divider?.color ?? brand.colors.find((c) => /border|outline|stroke|borda|divider|muted/i.test(c.name))?.hex
  const ctx: Context = { palette: buildPalette(brand), brand, cache: new Map(), hairline }
  // A página do Elementor é branca por padrão
  const white = { original: WHITE, branded: WHITE }
  brandElements(result, { bg: white, depth: 0, parent: null, overImage: false, inCard: false, imageBehind: false, ranks: null, order: null, siteLogos: new Set() }, ctx)
  return result as T[]
}

/**
 * Kit do Elementor com a marca, para widgets sem cor ou fonte no próprio JSON
 * (e referências `__globals__` de seções coladas de outros sites).
 */
export function brandKit(brand: Brand): Partial<ElementorKit> {
  const kit: Partial<ElementorKit> = {}
  if (brand.colors.length) {
    const byName = (...names: string[]) => brand.colors.find((c) => names.includes(c.name.toLowerCase()))?.hex
    const darkest = brand.colors.reduce((a, b) => (oklch(parseColor(a.hex)!).l <= oklch(parseColor(b.hex)!).l ? a : b)).hex
    const primary = byName('primary') ?? darkest
    kit.colors = {
      primary,
      secondary: byName('secondary') ?? primary,
      text: byName('text', 'on-surface', 'on-background', 'foreground') ?? darkest,
      accent: byName('accent', 'tertiary') ?? primary,
    }
  }
  const heading = brand.fonts.heading ?? brand.fonts.body
  const body = brand.fonts.body ?? brand.fonts.heading
  if (heading && body) {
    kit.typography = { primary: heading, secondary: heading, text: body, accent: body }
  }
  return kit
}

/** A marca como customização das miniaturas da biblioteca. */
export const brandCustomization = (brand: Brand): ElementorCustomization => ({
  key: brand.key,
  transform: (elements) => applyBrand(elements, brand),
  kit: brandKit(brand),
})
