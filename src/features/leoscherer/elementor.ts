import type { SectionNodeData } from '@/types/space'
import { LS as C, LS_FONTS as F, LS_LAYOUT as L, lsAsset } from './tokens'

type JsonRecord = Record<string, unknown>
export interface ElementorNode { id: string; elType: 'container' | 'widget'; isInner: boolean; widgetType?: string; settings: JsonRecord; elements: ElementorNode[] }
export type Size = number | string
export const px = (size: number) => ({ unit: 'px', size, sizes: [] })
export const pct = (size: number) => ({ unit: '%', size, sizes: [] })
export const fluid = (size: string) => ({ unit: 'custom', size, sizes: [] })
export const gap = (row: number, column = row) => ({ unit: 'px', size: row, row: String(row), column: String(column), isLinked: row === column })
export const sides = (top: number, right = top, bottom = top, left = right) => ({ unit: 'px', top: String(top), right: String(right), bottom: String(bottom), left: String(left), isLinked: top === right && right === bottom && bottom === left })
export const link = (url: string) => ({ url, is_external: url.startsWith('http') ? 'on' : '', nofollow: '', custom_attributes: '' })
export const media = (url: string, alt = '') => ({ id: '', url, alt, source: 'url', size: '' })
const size = (value: Size) => typeof value === 'number' ? px(value) : fluid(value)

export interface TypeSpec { size: Size; tablet?: Size; mobile?: Size; weight?: number; line?: number; family?: keyof typeof F; transform?: string }
export const typography = (spec: TypeSpec, group = 'typography'): JsonRecord => ({
  [`${group}_typography`]: 'custom', [`${group}_font_family`]: F[spec.family ?? 'display'],
  [`${group}_font_size`]: size(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: size(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: size(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line ? { [`${group}_line_height`]: px(spec.line) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
})

export const T = {
  hero: { size: 52, tablet: 44, mobile: 30, weight: 600, line: 52 },
  heroSub: { size: 31, tablet: 27, mobile: 20, weight: 400, line: 31 },
  h2: { size: 40, tablet: 34, mobile: 28, weight: 600, line: 40 },
  immersion: { size: 75, tablet: 56, mobile: 34, weight: 600, line: 75 },
  title: { size: 26, mobile: 22, weight: 600, line: 26 },
  card: { size: 13, mobile: 13, weight: 400, line: 17 },
  body: { size: 16, mobile: 15, weight: 400, line: 25, family: 'body' },
  small: { size: 12, weight: 400, line: 17, family: 'body' },
  nav: { size: 12, weight: 400, line: 16 },
  button: { size: 13, weight: 500, line: 16 },
} satisfies Record<string, TypeSpec>

const BASE_CSS = [
  'selector{overflow-x:clip}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p{margin:0}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper{line-height:0}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  `selector a:focus-visible,selector button:focus-visible,selector input:focus-visible,selector .elementor-button:focus-visible{outline:2px solid ${C.blue};outline-offset:3px}`,
  '@media(max-width:767px){selector *{min-width:0;max-width:100%}selector .elementor-heading-title{overflow-wrap:anywhere}}',
  '@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition:color .2s,background-color .2s,border-color .2s,transform .2s}selector .elementor-button:active{transform:scale(.96)}}',
  '@media(prefers-reduced-motion:reduce){selector *{animation:none!important;transition:none!important}}',
].join('')

export const createBuilder = (prefix: string) => {
  let sequence = 0
  const uid = () => `${prefix}${(++sequence).toString(36).padStart(7 - prefix.length, '0')}`
  const container = (settings: JsonRecord, elements: ElementorNode[] = []): ElementorNode => ({ id: uid(), elType: 'container', isInner: true, settings: { content_width: 'full', padding: sides(0), flex_gap: gap(0), ...settings }, elements })
  const widget = (widgetType: string, settings: JsonRecord): ElementorNode => ({ id: uid(), elType: 'widget', isInner: false, widgetType, settings, elements: [] })
  const col = (elements: ElementorNode[], space = 0, settings: JsonRecord = {}) => container({ flex_direction: 'column', flex_gap: gap(space), ...settings }, elements)
  const row = (elements: ElementorNode[], space = 0, settings: JsonRecord = {}) => container({ flex_direction: 'row', flex_wrap: 'nowrap', flex_align_items: 'center', flex_gap: gap(space), ...settings }, elements)
  const grid = (elements: ElementorNode[], columns: string, space = 0, tablet = columns, mobile = '1fr', settings: JsonRecord = {}) => container({
    container_type: 'grid', grid_columns_grid: fluid(columns), grid_columns_grid_tablet: fluid(tablet), grid_columns_grid_mobile: fluid(mobile),
    grid_rows_grid: fluid('auto'), grid_gaps: gap(space), ...settings,
  }, elements)
  const heading = (title: string, spec: TypeSpec, color = C.ink, options: JsonRecord = {}) => widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color = C.body, options: JsonRecord = {}) => widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (file: string, alt: string, options: JsonRecord = {}) => widget('image', { image: media(file.startsWith('http') ? file : lsAsset(file), alt), image_size: 'full', ...options })
  const button = (label: string, url: string, options: JsonRecord = {}) => widget('button', {
    text: label, link: link(url), ...typography(T.button), button_text_color: C.ink, background_color: 'rgba(255,255,255,0)',
    border_border: 'solid', border_width: sides(1), border_color: 'rgba(255,255,255,.5)', border_radius: sides(999), text_padding: sides(10, 18),
    button_background_hover_color: C.paper, hover_color: C.black, button_hover_border_color: C.paper, ...options,
  })
  const root = (elements: ElementorNode[], options: { background?: string; css?: string; pad?: [number, number, number]; minHeight?: number; id?: string; settings?: JsonRecord } = {}) => {
    const [desktop, tablet, mobile] = options.pad ?? [70, 56, 44]
    const node = container({
      content_width: 'boxed', boxed_width: px(L.content), flex_direction: 'column', flex_gap: gap(0),
      padding: sides(desktop, L.gutter.desktop, desktop, L.gutter.desktop), padding_tablet: sides(tablet, L.gutter.tablet, tablet, L.gutter.tablet), padding_mobile: sides(mobile, L.gutter.mobile, mobile, L.gutter.mobile),
      background_background: 'classic', background_color: options.background ?? C.black, html_tag: 'section',
      ...(options.minHeight ? { min_height: px(options.minHeight), min_height_tablet: px(Math.round(options.minHeight * .8)), min_height_mobile: px(Math.round(options.minHeight * .65)) } : {}),
      ...(options.id ? { _element_id: options.id } : {}), ...options.settings, custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }
  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })
  return { container, widget, col, row, grid, heading, text, image, button, root, section }
}

export type LsBuilder = ReturnType<typeof createBuilder>
