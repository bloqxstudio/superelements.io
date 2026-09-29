import type { SectionElement } from '@/features/space/landingPage'
import type { EditorDevice } from '@/types/space'
import { settingsOf } from './tree'

/**
 * Como o painel de propriedades lê e grava as settings do Elementor: quais
 * chaves têm variante por tamanho de tela (`chave_tablet`, `chave_mobile`) e
 * que nome cada grupo de estilo tem em cada tipo de elemento.
 */

export const RESPONSIVE_KEYS = new Set([
  'padding',
  'margin',
  '_padding',
  '_margin',
  'flex_direction',
  'flex_justify_content',
  'flex_align_items',
  'flex_wrap',
  'flex_gap',
  'grid_columns_grid',
  'grid_rows_grid',
  'grid_gaps',
  'width',
  'boxed_width',
  'min_height',
  '_element_width',
  '_element_custom_width',
  '_flex_size',
  '_flex_align_self',
  'height',
  'space',
  'align',
  'typography_font_size',
  'typography_line_height',
  'typography_letter_spacing',
  'border_radius',
  '_border_radius',
  'image_border_radius',
  'border_width',
  '_border_width',
  'text_padding',
  'object-fit',
  'size',
  '_offset_x',
  '_offset_y',
])

export const isEmptyValue = (value: unknown) => value === undefined || value === null || value === ''

/** Nome da chave no tamanho de tela: no desktop, ou para chaves sem variante, é a própria. */
export const deviceKey = (key: string, device: EditorDevice) => (device === 'desktop' || !RESPONSIVE_KEYS.has(key) ? key : `${key}_${device}`)

const CASCADE: Record<EditorDevice, EditorDevice[]> = {
  desktop: ['desktop'],
  tablet: ['tablet', 'desktop'],
  mobile: ['mobile', 'tablet', 'desktop'],
}

/** Valor que vale no tamanho de tela, herdando celular → tablet → desktop como o Elementor. */
export function readSetting(element: SectionElement | null, key: string, device: EditorDevice): unknown {
  const settings = settingsOf(element)
  if (!RESPONSIVE_KEYS.has(key)) return settings[key]
  for (const d of CASCADE[device]) {
    const value = settings[deviceKey(key, d)]
    if (!isEmptyValue(value) && !(typeof value === 'object' && value && 'size' in value && isEmptyValue((value as { size: unknown }).size))) return value
  }
  return undefined
}

/** O tamanho de tela tem valor próprio para a chave (em vez de herdar). */
export const hasOwnValue = (element: SectionElement | null, key: string, device: EditorDevice) =>
  device !== 'desktop' && RESPONSIVE_KEYS.has(key) && !isEmptyValue(settingsOf(element)[deviceKey(key, device)])

export type ElementFamily = 'container' | 'column' | 'section' | 'widget'

export const familyOf = (element: SectionElement): ElementFamily =>
  element.elType === 'container' ? 'container' : element.elType === 'column' ? 'column' : element.elType === 'section' ? 'section' : 'widget'

/** Nomes dos grupos de estilo no tipo do elemento. */
export function styleKeys(element: SectionElement) {
  const family = familyOf(element)
  const block = family !== 'widget'
  const type = element.widgetType ?? ''
  const settings = settingsOf(element)
  return {
    padding: block ? 'padding' : '_padding',
    margin: block ? 'margin' : '_margin',
    /** Grupo de fundo (`<grupo>_background`, `<grupo>_color`). Botão tem o fundo no próprio botão. */
    background: block ? 'background' : type === 'button' ? (settings.button_background_background ? 'button_background' : null) : '_background',
    /** Botão sem o grupo novo guarda a cor de fundo solta em `background_color`. */
    buttonBackground: type === 'button' && !settings.button_background_background ? 'background_color' : null,
    border: block || type === 'button' ? 'border' : type === 'image' ? 'image_border' : '_border',
    radius: block || type === 'button' ? 'border_radius' : type === 'image' ? 'image_border_radius' : '_border_radius',
    shadow: block ? 'box_shadow' : type === 'button' ? 'button_box_shadow' : type === 'image' ? 'image_box_shadow' : '_box_shadow',
    textColor:
      type === 'heading'
        ? 'title_color'
        : type === 'text-editor'
          ? 'text_color'
          : type === 'button'
            ? 'button_text_color'
            : type === 'icon'
              ? 'primary_color'
              : type === 'divider'
                ? 'color'
                : null,
    hoverColor: type === 'heading' ? 'title_hover_color' : type === 'button' ? 'hover_color' : type === 'icon' ? 'hover_primary_color' : null,
    hoverBackground: type === 'button' ? 'button_background_hover_color' : null,
    typography: type === 'heading' || type === 'text-editor' || type === 'button' ? 'typography' : null,
    position: block ? 'position' : '_position',
    cssClasses: block ? 'css_classes' : '_css_classes',
  }
}

// ---------------------------------------------------------------------------
// Valores compostos do Elementor

export interface Slider {
  unit: string
  size: number | string
}

export const sliderOf = (value: unknown): Slider | null => {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') return { unit: 'px', size: value }
  if (typeof value === 'object' && 'size' in (value as object)) {
    const v = value as { unit?: string; size?: unknown }
    if (isEmptyValue(v.size)) return null
    return { unit: v.unit || 'px', size: v.size as number | string }
  }
  return null
}

export const sliderValue = (size: number | string, unit = 'px') => ({ unit, size, sizes: [] })

export type Sides = [number, number, number, number]

export const sidesOf = (value: unknown): { sides: Sides; unit: string } | null => {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const read = (k: string) => (isEmptyValue(v[k]) ? NaN : Number(v[k]))
  const sides = [read('top'), read('right'), read('bottom'), read('left')]
  if (sides.every((n) => Number.isNaN(n))) return null
  return { sides: sides.map((n) => (Number.isNaN(n) ? 0 : n)) as Sides, unit: typeof v.unit === 'string' ? v.unit : 'px' }
}

export const sidesValue = ([top, right, bottom, left]: Sides, unit = 'px') => ({
  unit,
  top: String(top),
  right: String(right),
  bottom: String(bottom),
  left: String(left),
  isLinked: top === right && right === bottom && bottom === left,
})

export const gapOf = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') return value
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    const n = Number(isEmptyValue(v.row) ? v.size : v.row)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export const gapValue = (size: number) => ({ unit: 'px', size, column: String(size), row: String(size), isLinked: true })
