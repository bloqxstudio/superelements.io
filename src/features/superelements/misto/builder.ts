import { gap, media, sides } from '../elementor'
import { type, type Spec } from '../modelo/elementor'

/**
 * Construtor das seções da página Modelo · misto: containers e títulos
 * nativos com o desenho no CSS da seção (classes `ms-*`), e os ícones como
 * máscara CSS (icons.ts). Todo container declara padding, gap e quebra de
 * linha, porque o Elementor põe valores próprios quando o JSON não diz nada.
 */

export type JsonRecord = Record<string, unknown>

export interface ElementorNode {
  id: string
  elType: 'container' | 'widget'
  isInner: boolean
  widgetType?: string
  settings: JsonRecord
  elements: ElementorNode[]
}

const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost'
export const asset = (path: string) => `${ORIGIN}${path}`
export const canvasShot = (file: string) => asset(`/brands/superelements/canvas/${file}`)

// ---------- cores e tipos do app ----------

export const C = {
  ink: '#09090B',
  g900: '#111827',
  g800: '#1F2937',
  g700: '#374151',
  g600: '#4B5563',
  g500: '#6B7280',
  g400: '#9CA3AF',
  g300: '#D1D5DB',
  g200: '#E5E7EB',
  g100: '#F3F4F6',
  g50: '#F9FAFB',
  muted: '#71717A',
  violet: '#8B5CF6',
  violet50: '#F5F3FF',
  agent: '#D97757',
  agentInk: '#A94E2F',
  emerald: '#059669',
  sky: '#0284C7',
  /** hsl(72 89% 55%), o --primary do app. */
  primary: '#CAF226',
  white: '#FFFFFF',
  // a página do exemplo (brands/caramelo-pet)
  navy: '#1F2A44',
  caramel: '#F2994A',
  caramelInk: '#9A4A0B',
  cream: '#FFF7EC',
  pool: '#9ED8F7',
  petBody: '#4B5468',
}

const INTER = 'Inter'
export const ui = (size: number, weight = 500, line = 1.25): Spec => ({ size, weight, line, family: INTER })

// ---------- construtor ----------

export const createBuilder = (prefix: string) => {
  let sequence = 0
  const uid = () => `${prefix}${(++sequence).toString(36).padStart(7 - prefix.length, '0')}`
  const icons = new Set<string>()

  const container = (settings: JsonRecord, elements: ElementorNode[] = []): ElementorNode => ({
    id: uid(), elType: 'container', isInner: true,
    settings: { content_width: 'full', padding: sides(0), flex_gap: gap(0), flex_wrap: 'nowrap', ...settings },
    elements,
  })
  const widget = (widgetType: string, settings: JsonRecord): ElementorNode => ({ id: uid(), elType: 'widget', isInner: false, widgetType, settings, elements: [] })
  /** Linha (ícone e texto lado a lado), centrada na vertical. */
  const row = (cls: string, elements: ElementorNode[] = [], settings: JsonRecord = {}) =>
    container({ css_classes: cls, flex_direction: 'row', flex_align_items: 'center', ...settings }, elements)
  const col = (cls: string, elements: ElementorNode[] = [], settings: JsonRecord = {}) =>
    container({ css_classes: cls, flex_direction: 'column', ...settings }, elements)
  /** Ícone de traço (máscara CSS). */
  const icon = (name: string, cls = '') => {
    icons.add(name)
    return container({ css_classes: `ms-i ms-i-${name} ${cls}`.trim() })
  }
  const heading = (title: string, spec: Spec, color: string, cls = '', options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...type(spec), ...options, ...(cls ? { _css_classes: cls } : {}) })
  const text = (html: string, spec: Spec, color: string, cls = '') =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...type(spec), ...(cls ? { _css_classes: cls } : {}) })
  const image = (url: string, alt: string, cls = '') => widget('image', { image: media(url, alt), image_size: 'full', ...(cls ? { _css_classes: cls } : {}) })
  /** Peças que trocam no mesmo lugar (rótulos, estados): todas na mesma célula da grade. */
  const stack = (cls: string, elements: ElementorNode[]) => container({ css_classes: `ms-stack ${cls}`.trim() }, elements)

  return { uid, icons, container, widget, row, col, icon, heading, text, image, stack }
}

export type B = ReturnType<typeof createBuilder>

