import { contrast, hoverShade, parseColor, type Rgba } from '../color'
import type { Brand } from '../designMd'
import type { ButtonSpec } from '../layers'
import type { Stroke } from '../values'
import type { ButtonKeys, ButtonKind } from './classify'
import { borderSides } from './classify'
import {
  clearResponsive,
  cssLength,
  isRound,
  isSet,
  mapCorners,
  readDims,
  slider,
  uniformDims,
  withAlpha,
  writeDims,
  type Settings,
} from './elementor'

/** Botões, cantos, campos, imagens e divisores. */

function setRadius(s: Settings, key: string, value: string | undefined, mode: 'all' | 'corners') {
  const len = value && cssLength(value)
  if (!len) return
  const size = len.unit === 'px' && len.size >= 999 ? 999 : len.size
  s[key] = mode === 'all' ? uniformDims(size, len.unit) : writeDims(mapCorners(readDims(s[key]), size, len.unit))
  clearResponsive(s, key)
}

function setStroke(s: Settings, prefix: string, stroke: Stroke | 'none', fallbackColor?: string) {
  if (stroke === 'none') {
    s[`${prefix}_border`] = 'none'
    return
  }
  s[`${prefix}_border`] = stroke.style
  s[`${prefix}_width`] = uniformDims(stroke.width)
  clearResponsive(s, `${prefix}_width`)
  const color = stroke.color ?? fallbackColor
  if (color) s[`${prefix}_color`] = color
}

/**
 * Botão cheio ou de contorno com o que o guia define. Links e botões só de
 * ícone recebem no máximo o canto. `parentBg` é o fundo (já com a marca)
 * sobre o qual o botão fica; `readable` escolhe uma cor da marca legível nele.
 */
export function applyButton(
  s: Settings,
  keys: ButtonKeys,
  kind: ButtonKind,
  spec: ButtonSpec | undefined,
  brand: Brand,
  parentBg: Rgba | null,
  readable: (bg: Rgba) => string
) {
  if (kind === 'link') return
  setRadius(s, keys.radius, spec?.radius ?? brand.radius.button, 'all')
  if (kind === 'icon' || !spec) return

  let bg = spec.background
  let text = spec.text
  const bgColor = bg && bg !== 'transparent' ? parseColor(bg) : null
  // Botão cheio da mesma cor do fundo sumiria: inverte fundo e texto
  if (kind === 'primary' && bgColor && parentBg && text && contrast(bgColor, parentBg) < 1.15) [bg, text] = [text, bg]
  // Contorno e texto escuros numa faixa escura (ou claros numa clara): troca por uma cor legível da marca
  if (kind === 'secondary' && parentBg) {
    const current = parseColor(text ?? s[keys.text])
    if (current && contrast(current, parentBg) < 3) text = readable(parentBg)
  }

  if (bg) {
    if (s[keys.backgroundType] === 'gradient') s[keys.backgroundType] = 'classic'
    s[keys.background] = bg === 'transparent' ? 'rgba(0,0,0,0)' : bg
  }
  if (text) s[keys.text] = text

  const hasBorder = isSet(s[`${keys.border}_border`]) && s[`${keys.border}_border`] !== 'none'
  if (spec.border) setStroke(s, keys.border, kind === 'secondary' && spec.border !== 'none' && spec.border.color === spec.text ? { ...spec.border, color: text } : spec.border, text)
  else if (hasBorder) s[`${keys.border}_color`] = kind === 'primary' && bg && bg !== 'transparent' ? bg : text ?? s[`${keys.border}_color`]

  const fill = bg && bg !== 'transparent' ? bg : undefined
  const ink = text ?? (s[keys.text] as string | undefined)
  if (kind === 'primary' && fill) {
    s[keys.hoverBackground] = spec.hover?.background ?? hoverShade(fill)
    if (ink) s[keys.hoverText] = spec.hover?.text ?? ink
    s[keys.hoverBorder] = spec.hover?.border ?? (s[keys.hoverBackground] as string)
  } else if (kind === 'secondary' && ink) {
    s[keys.hoverBackground] = spec.hover?.background ?? withAlpha(ink, 0.1)
    s[keys.hoverText] = spec.hover?.text ?? ink
    s[keys.hoverBorder] = spec.hover?.border ?? ink
  }
}

/**
 * Card e pílula: canto de card (mantendo cantos retos de meia-borda) ou de
 * botão. Um bloco arredondado dentro de um card (o topo com foto, por
 * exemplo) acompanha o canto do card.
 */
export function applyContainerShape(s: Settings, brand: Brand, card: boolean, pill: boolean, inCard: boolean) {
  if (pill) setRadius(s, 'border_radius', brand.radius.button, 'all')
  else if (card) setRadius(s, 'border_radius', brand.radius.card, 'corners')
  else if (inCard) {
    const current = readDims(s.border_radius)
    if (current && !isRound(current) && current.top + current.right + current.bottom + current.left > 0) setRadius(s, 'border_radius', brand.radius.card, 'corners')
  }
}

/**
 * Imagem: canto de imagem da marca; sem ele, imagem arredondada dentro de card
 * acompanha o canto do card (a foto de topo com dois cantos continua encaixada).
 * Avatares redondos ficam como estão.
 */
export function applyImageShape(s: Settings, brand: Brand, inCard: boolean) {
  const current = readDims(s.image_border_radius)
  if (isRound(current)) return
  if (brand.radius.image) setRadius(s, 'image_border_radius', brand.radius.image, 'all')
  else if (inCard && brand.radius.card && current && current.top + current.right + current.bottom + current.left > 0) {
    setRadius(s, 'image_border_radius', brand.radius.card, 'corners')
  }
}

/** Campos do formulário. */
export function applyInputs(s: Settings, brand: Brand, parentBg: Rgba | null, readable: (bg: Rgba) => string) {
  setRadius(s, 'field_border_radius', brand.radius.input ?? brand.radius.button, 'all')
  const spec = brand.layers.inputs
  if (!spec) return
  if (spec.background) s.field_background_color = spec.background === 'transparent' ? 'rgba(0,0,0,0)' : spec.background
  // Campo transparente mostra o fundo da faixa: o texto e a linha precisam ser legíveis nele
  const surface = spec.background && spec.background !== 'transparent' ? parseColor(spec.background) : parentBg
  let ink = spec.text
  if (surface && ink && contrast(parseColor(ink) ?? surface, surface) < 3) ink = readable(surface)
  if (ink) s.field_text_color = ink
  if (spec.border === 'none') s.field_border_width = uniformDims(0)
  else if (spec.border) {
    const w = spec.border.width
    s.field_border_width = writeDims({ unit: 'px', top: spec.underline ? 0 : w, right: spec.underline ? 0 : w, bottom: w, left: spec.underline ? 0 : w })
    const color = spec.border.color === spec.text ? ink : spec.border.color
    if (color) s.field_border_color = color
  }
}

/** Divisor: o widget, o separador de listas e filetes de container (borda em 1 ou 2 lados, fina). */
export function applyDivider(s: Settings, widgetType: string | undefined, brand: Brand, isContainer: boolean) {
  const stroke = brand.layers.divider
  if (!stroke) return
  if (widgetType === 'divider') {
    s.style = stroke.style
    s.weight = slider(stroke.width)
    clearResponsive(s, 'weight')
    if (stroke.color) s.color = stroke.color
    return
  }
  if (widgetType === 'icon-list' && s.divider === 'yes') {
    s.divider_style = stroke.style
    s.divider_weight = slider(stroke.width)
    if (stroke.color) s.divider_color = stroke.color
    return
  }
  if (isContainer) {
    const sides = borderSides(s)
    const width = readDims(s.border_width)
    if (!width || sides < 1 || sides > 2 || Math.max(width.top, width.right, width.bottom, width.left) > 2) return
    s.border_border = stroke.style
    const w = (n: number) => (n > 0 ? stroke.width : 0)
    s.border_width = writeDims({ ...width, top: w(width.top), right: w(width.right), bottom: w(width.bottom), left: w(width.left) })
    clearResponsive(s, 'border_width')
    if (stroke.color) s.border_color = stroke.color
  }
}
