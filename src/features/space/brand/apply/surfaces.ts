import { contrast, oklch, parseColor, recolor, type Rgba } from '../color'
import type { Brand } from '../designMd'
import type { Shadow } from '../values'
import { borderSides } from './classify'
import { clearResponsive, composite, isSet, slider, stripTags, uniformDims, withAlpha, type Settings } from './elementor'

/** Fundo, borda, sombra e vidro dos cards; sombra do resto; filtro das imagens. */

const SHADOW_GROUPS = ['box_shadow', '_box_shadow', 'image_box_shadow', 'button_box_shadow', 'box_shadow_hover']

const shadowValue = (s: Shadow) => ({ horizontal: s.x, vertical: s.y, blur: s.blur, spread: s.spread, color: s.color })

/**
 * Sombra da marca. `none` apaga todas as sombras do elemento; uma sombra
 * definida substitui só as que já existem (não cria elevação onde não havia).
 */
export function applyShadow(s: Settings, shadow: Shadow | 'none' | undefined) {
  if (!shadow) return
  for (const group of SHADOW_GROUPS) {
    if (s[`${group}_box_shadow_type`] !== 'yes') continue
    if (shadow === 'none') s[`${group}_box_shadow_type`] = ''
    else if (group !== 'box_shadow_hover') s[`${group}_box_shadow`] = shadowValue(shadow)
  }
}

interface CardContext {
  /** A faixa em volta tem foto ou degradê: é onde o vidro faz sentido. */
  overImage: boolean
  /** Fundo em volta do card, já com a marca; null sobre foto. */
  parentBg: Rgba | null
  /** Cor de filete da marca (divisor ou borda). */
  hairline?: string
}

/** Card: fundo, borda, sombra e vidro. Devolve o CSS da marca para o card (vidro). */
export function applyCard(s: Settings, brand: Brand, ctx: CardContext): string {
  const spec = brand.layers.cards
  const hadShadow = s.box_shadow_box_shadow_type === 'yes'
  const shadow = spec?.shadow ?? brand.layers.shadow
  applyShadow(s, shadow)

  // Sem sombra, um card da cor da faixa some: ganha o filete da marca (o "card outline" dos guias sem elevação)
  const fill = s.background_background === 'classic' ? parseColor(s.background_color) : null
  const blends = !!fill && !!ctx.parentBg && contrast(composite(fill, ctx.parentBg), ctx.parentBg) < 1.1
  if (shadow === 'none' && hadShadow && blends && borderSides(s) === 0 && ctx.hairline && spec?.border === undefined) {
    s.border_border = 'solid'
    s.border_width = uniformDims(1)
    s.border_color = ctx.hairline
  }
  if (!spec) return ''

  // Fundo de card da marca só quando é da mesma família (claro com claro, escuro com escuro):
  // um card escuro numa faixa escura não vira branco
  const current = parseColor(s.background_color)
  const target = spec.background && parseColor(spec.background)
  if (target && current && s.background_background === 'classic' && Math.abs(oklch(current).l - oklch(target).l) < 0.35) {
    s.background_color = recolor(String(s.background_color), spec.background!)
  }

  if (spec.border === 'none') s.border_border = 'none'
  else if (spec.border) {
    s.border_border = spec.border.style
    s.border_width = uniformDims(spec.border.width)
    clearResponsive(s, 'border_width')
    if (spec.border.color) s.border_color = spec.border.color
  }

  if (spec.blur && ctx.overImage) {
    if (s.background_background !== 'classic') s.background_background = 'classic'
    const base = isSet(s.background_color) ? String(s.background_color) : '#ffffff'
    s.background_color = withAlpha(base, Math.min(parseColor(base)?.a ?? 1, 0.55))
    return `selector{backdrop-filter:blur(${spec.blur}px);-webkit-backdrop-filter:blur(${spec.blur}px)}`
  }
  return ''
}

/** Filtro de imagem da marca (fotos; logotipos ficam de fora). */
export function applyImageFilter(s: Settings, brand: Brand) {
  const filter = brand.layers.images?.filter
  if (!filter) return
  const image = s.image as { url?: string; alt?: string } | undefined
  if (/logo/i.test(`${image?.url ?? ''} ${image?.alt ?? ''} ${stripTags(s.caption)}`)) return
  s.css_filters_css_filter = 'custom'
  if (filter.brightness !== undefined) s.css_filters_brightness = slider(filter.brightness)
  if (filter.contrast !== undefined) s.css_filters_contrast = slider(filter.contrast)
  if (filter.saturate !== undefined) s.css_filters_saturate = slider(filter.saturate)
  if (filter.hue !== undefined) s.css_filters_hue = slider(filter.hue)
  if (filter.blur !== undefined) s.css_filters_blur = slider(filter.blur)
}
