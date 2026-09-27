import { contrast, type Rgba } from '../color'
import { colorOf, composite, fontPx, isSet, readDims, sideCount, sliderAt, stripTags, type Settings } from './elementor'

/**
 * Leitura do papel de cada peça da seção, sempre sobre os settings originais:
 * o que é rótulo, título, texto ou número; que botão é cheio, contorno, link
 * ou só ícone; que container é faixa da seção e qual é card.
 */

export type TextKind = 'heading' | 'body' | 'label' | 'numeric' | 'button'

const DEFAULT_SIZE: Record<string, number> = { h1: 40, h2: 32, h3: 28, h4: 24, h5: 20, h6: 16, p: 16, span: 16, div: 16 }
const NUMERIC = /^[\s\d.,:+\-–%$€£R×x/]+[kKmMbB]?\+?$/

/** Grupos de tipografia que o elemento define por conta própria (não pela tipografia global). */
export function typographyGroups(s: Settings): string[] {
  const globals = (s.__globals__ ?? {}) as Record<string, unknown>
  return Object.keys(s)
    .filter((k) => k.endsWith('_typography') && s[k] === 'custom')
    .map((k) => k.slice(0, -'_typography'.length))
    .filter((g) => !isSet(globals[`${g}_typography`]))
}

/** Heading do Elementor que não é título: rótulo pequeno, parágrafo ou número. */
function headingKind(s: Settings): TextKind {
  const text = stripTags(s.title)
  const tag = String(s.header_size || 'h2').toLowerCase()
  const size = fontPx(s, 'typography') ?? DEFAULT_SIZE[tag] ?? 32
  if (text && /\d/.test(text) && NUMERIC.test(text)) return 'numeric'
  const upper = s.typography_text_transform === 'uppercase'
  const tracking = sliderAt(s, 'typography_letter_spacing', '')
  const tracked = !!tracking && (tracking.unit === 'px' ? tracking.size >= 1 : tracking.size >= 0.06)
  if (size <= 16 && text.length <= 60 && (upper || tracked || /^(p|span|div|h6)$/.test(tag))) return 'label'
  if (s._background_background === 'classic' && isSet(s._border_radius) && text.length <= 40) return 'label'
  if (/^(p|span|div)$/.test(tag) && size <= 20 && (text.length > 80 || text.split(' ').length >= 12)) return 'body'
  return 'heading'
}

export function textKind(widgetType: string | undefined, group: string, s: Settings): TextKind {
  if (widgetType === 'heading' && group === 'typography') return headingKind(s)
  if ((widgetType === 'button' && group === 'typography') || group === 'button_typography' || group === 'button') return 'button'
  if (/number|price/.test(group)) return 'numeric'
  if (/title|heading|drop_cap/.test(group)) return (fontPx(s, group) ?? 20) <= 14 ? 'label' : 'heading'
  if (/label|menu|nav|tab|badge|tag/.test(group)) return 'label'
  if (widgetType === 'counter' && group === 'typography') return 'numeric'
  return 'body'
}

// ---------------------------------------------------------------------------
// Botões

export type ButtonKind = 'primary' | 'secondary' | 'link' | 'icon'

/** Chaves do botão: o widget `button` e o botão de envio do `form` usam nomes diferentes. */
export interface ButtonKeys {
  background: string
  backgroundType: string
  text: string
  border: string
  radius: string
  hoverBackground: string
  hoverText: string
  hoverBorder: string
  typography: string
  shadow: string
}

export const BUTTON_WIDGET: ButtonKeys = {
  background: 'background_color',
  backgroundType: 'background_background',
  text: 'button_text_color',
  border: 'border',
  radius: 'border_radius',
  hoverBackground: 'button_background_hover_color',
  hoverText: 'hover_color',
  hoverBorder: 'button_hover_border_color',
  typography: 'typography',
  shadow: 'button_box_shadow',
}

export const FORM_BUTTON: ButtonKeys = {
  background: 'button_background_color',
  backgroundType: 'button_background_background',
  text: 'button_text_color',
  border: 'button_border',
  radius: 'button_border_radius',
  hoverBackground: 'button_background_hover_color',
  hoverText: 'button_hover_color',
  hoverBorder: 'button_hover_border_color',
  typography: 'button_typography',
  shadow: 'button_box_shadow',
}

/** `parentBg` null: o botão está sobre uma foto, e qualquer fundo opaco conta como cheio. */
export function buttonKind(s: Settings, keys: ButtonKeys, parentBg: Rgba | null, isWidget: boolean): ButtonKind {
  const icon = s.selected_icon as { value?: unknown } | undefined
  if (isWidget && !stripTags(s.text) && isSet(icon?.value)) return 'icon'
  const gradient = s[keys.backgroundType] === 'gradient'
  const bg = colorOf(s[keys.background])
  const filled = gradient || (!!bg && bg.a >= 0.5 && (!parentBg || contrast(composite(bg, parentBg), parentBg) >= 1.15))
  if (filled) return 'primary'
  const style = s[`${keys.border}_border`]
  const width = readDims(s[`${keys.border}_width`])
  const borderColor = colorOf(s[`${keys.border}_color`])
  const bordered = isSet(style) && style !== 'none' && sideCount(width) > 0 && (!borderColor || borderColor.a >= 0.3)
  return bordered ? 'secondary' : 'link'
}

// ---------------------------------------------------------------------------
// Containers

/** Fundo próprio que o container pinta (cor sólida), ou null. */
export function ownFill(s: Settings): Rgba | null {
  if (s.background_background !== 'classic') return null
  return colorOf(s.background_color)
}

export const hasBackgroundImage = (s: Settings) =>
  s.background_background === 'gradient' ||
  !!(s.background_image as { url?: string } | undefined)?.url ||
  s.background_overlay_background === 'classic' ||
  s.background_overlay_background === 'gradient'

/**
 * Faixa da seção: o container do topo, ou um filho direto de um container de
 * topo que só embrulha (sem fundo e sem padding), o padrão de faixas empilhadas.
 */
export function isBand(s: Settings, depth: number, parent: Settings | null): boolean {
  if (depth === 0) return true
  if (depth !== 1 || !parent) return false
  const wrapper = !ownFill(parent) && !hasBackgroundImage(parent)
  const padding = readDims(parent.padding)
  const tight = !padding || [padding.top, padding.right, padding.bottom, padding.left].every((n) => n <= 1)
  return wrapper && tight
}

/** Borda nos quatro lados (card) ou em um ou dois (filete). */
export function borderSides(s: Settings, prefix = 'border'): number {
  const style = s[`${prefix}_border`]
  if (!isSet(style) || style === 'none') return 0
  return sideCount(readDims(s[`${prefix}_width`]))
}

/** `parentBg` null: o container está sobre uma foto; qualquer fundo próprio conta como superfície. */
export function isCard(s: Settings, band: boolean, parentBg: Rgba | null): boolean {
  if (band) return false
  if (hasBackgroundImage(s) || s.position === 'absolute' || s.position === 'fixed') return false
  const fill = ownFill(s)
  const surface = !!fill && fill.a >= 0.05 && (!parentBg || contrast(composite(fill, parentBg), parentBg) >= 1.04)
  const outlined = borderSides(s) === 4
  const shadow = s.box_shadow_box_shadow_type === 'yes'
  return surface || outlined || shadow
}

/** Container em forma de pílula (selo, chip): recebe o raio de botão, não o de card. */
export function isPill(s: Settings): boolean {
  const d = readDims(s.border_radius)
  return !!d && ((d.unit === '%' && d.top >= 50) || (d.unit === 'px' && d.top >= 50))
}
