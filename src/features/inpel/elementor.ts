import type { SectionNodeData } from '@/types/space'
import { INPEL as C, INPEL_FONT as F, INPEL_LAYOUT as L, inpelAsset } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para a Inpel: containers,
 * headings, text-editor, image, button, icon-list, social-icons, carrossel,
 * formulário, busca, mapa e vídeo. Todo container declara padding e gap,
 * porque o Elementor põe 10px e 20px quando o JSON não diz nada.
 */

type JsonRecord = Record<string, unknown>

export interface ElementorNode {
  id: string
  elType: 'container' | 'widget'
  isInner: boolean
  widgetType?: string
  settings: JsonRecord
  elements: ElementorNode[]
}

export type Size = number | string

export const px = (size: number) => ({ unit: 'px', size, sizes: [] })
export const pct = (size: number) => ({ unit: '%', size, sizes: [] })
export const em = (size: number) => ({ unit: 'em', size, sizes: [] })
/** Valor livre (min, calc): unidade `custom` do Elementor. */
export const fluid = (value: string) => ({ unit: 'custom', size: value, sizes: [] })
const size = (v: Size) => (typeof v === 'number' ? px(v) : fluid(v))
export const gap = (row: number, column = row) => ({ unit: 'px', size: row, row: String(row), column: String(column), isLinked: row === column })
export const sides = (top: number, right = top, bottom = top, left = right) => ({
  unit: 'px', top: String(top), right: String(right), bottom: String(bottom), left: String(left),
  isLinked: top === right && right === bottom && bottom === left,
})
export const media = (url: string, alt = '') => ({ id: '', url, alt, source: 'url', size: '' })
export const link = (url: string, external = url.startsWith('http')) => ({ url, is_external: external ? 'on' : '', nofollow: '', custom_attributes: '' })
/** Ícone do Font Awesome 5 (a biblioteca que o Elementor carrega). */
export const fa = (value: string) => ({ value, library: value.startsWith('fab') ? 'fa-brands' : value.startsWith('far') ? 'fa-regular' : 'fa-solid' })

/** Item flex que não cresce nem encolhe. */
export const FIXED = { _flex_size: 'none' } as const
/** Item flex que ocupa o resto da linha e pode encolher. */
export const FILL = { _flex_size: 'custom', _flex_grow: 1, _flex_shrink: 1 } as const

export interface TypeSpec {
  size: Size
  tablet?: Size
  mobile?: Size
  weight?: number | string
  /** altura de linha em px, como o site mede */
  line?: number
  transform?: string
}

export const typography = (spec: TypeSpec, group = 'typography'): JsonRecord => ({
  [`${group}_typography`]: 'custom',
  [`${group}_font_family`]: F,
  [`${group}_font_size`]: size(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: size(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: size(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line !== undefined ? { [`${group}_line_height`]: px(spec.line) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
})

/**
 * Escala da Inpel. O site carrega só 400/500/700 da Montserrat: o 800 que
 * alguns títulos pedem aparece como 700, então 700 é o peso máximo aqui.
 */
export const T = {
  /** h3.title das seções e títulos das páginas internas */
  title: { size: 24, mobile: 21, weight: 700, line: 26.4 },
  /** "CAIXAS DE TRANSMISSÃO" da home (25px em caixa alta) */
  titleCaps: { size: 25, mobile: 21, weight: 700, line: 27.5, transform: 'uppercase' },
  /** título dos cartões com faixa vermelha */
  shop: { size: 24, weight: 700, line: 26.4 },
  body: { size: 14, weight: 400, line: 20 },
  bodyMedium: { size: 14, weight: 500, line: 20 },
  small: { size: 12, weight: 500, line: 17 },
  /** categoria do cartão de produto */
  category: { size: 12, weight: 400, line: 17, transform: 'uppercase' },
  /** nome do produto no cartão */
  product: { size: 14, weight: 500, line: 15.4, transform: 'uppercase' },
  /** título dos posts na grade */
  post: { size: 18, mobile: 16, weight: 500, line: 25.7 },
  /** título das colunas do rodapé e do "CATEGORIAS" */
  label: { size: 18, weight: 700, line: 19.8, transform: 'uppercase' },
  nav: { size: 14, weight: 500, line: 20 },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Link, foco, parágrafos e imagem: vale para toda seção da Inpel. */
const BASE_CSS = [
  'selector{overflow-x:clip}',
  'selector a{text-decoration:none;transition:color .2s}',
  // p { margin: 0 0 5px } do tema
  'selector .elementor-widget-text-editor p{margin:0 0 5px}',
  'selector .elementor-widget-text-editor p:last-child{margin-bottom:0}',
  'selector .elementor-widget-text-editor .ql-align-justify{text-align:justify}',
  'selector .elementor-widget-text-editor .ql-align-center{text-align:center}',
  'selector .elementor-widget-text-editor .ql-size-large{font-size:1.5em}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper{line-height:0}',
  `selector a:focus-visible,selector button:focus-visible,selector summary:focus-visible,selector input:focus-visible,selector select:focus-visible,selector textarea:focus-visible,selector [tabindex]:focus-visible{outline:2px solid ${C.red};outline-offset:2px}`,
].join('')


export const createBuilder = (prefix: string) => {
  let sequence = 0
  const uid = () => `${prefix}${(++sequence).toString(36).padStart(7 - prefix.length, '0')}`

  const container = (settings: JsonRecord, elements: ElementorNode[] = []): ElementorNode => ({
    id: uid(), elType: 'container', isInner: true,
    settings: { content_width: 'full', padding: sides(0), flex_gap: gap(0), ...settings },
    elements,
  })
  const widget = (widgetType: string, settings: JsonRecord): ElementorNode => ({ id: uid(), elType: 'widget', isInner: false, widgetType, settings, elements: [] })

  const col = (elements: ElementorNode[], space = 0, settings: JsonRecord = {}) =>
    container({ flex_direction: 'column', flex_gap: gap(space), ...settings }, elements)
  const row = (elements: ElementorNode[], space = 0, settings: JsonRecord = {}) =>
    container({ flex_direction: 'row', flex_wrap: 'nowrap', flex_align_items: 'center', flex_gap: gap(space), ...settings }, elements)
  const grid = (elements: ElementorNode[], columns: string, space: number | [number, number] = 0, settings: JsonRecord = {}, responsive: { tablet?: string; mobile?: string } = {}) =>
    container({
      container_type: 'grid',
      grid_columns_grid: fluid(columns),
      grid_columns_grid_tablet: fluid(responsive.tablet ?? columns),
      grid_columns_grid_mobile: fluid(responsive.mobile ?? '1fr'),
      grid_rows_grid: fluid('auto'),
      grid_gaps: Array.isArray(space) ? gap(space[0], space[1]) : gap(space),
      ...settings,
    }, elements)

  const heading = (title: string, spec: TypeSpec, color: string = C.ink, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = C.body, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (file: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(file.startsWith('http') ? file : inpelAsset(file), alt), image_size: 'full', ...options })

  const divider = (color: string = C.line, options: JsonRecord = {}) =>
    widget('divider', { style: 'solid', weight: px(1), color, gap: px(0), ...FILL, ...options })


  /** Lista com ícone opcional por item (rodapé, contatos, categorias). */
  const list = (items: Array<{ text: string; url?: string; icon?: string }>, options: JsonRecord = {}) => widget('icon-list', {
    icon_list: items.map((item) => ({
      _id: uid(),
      text: item.text,
      selected_icon: item.icon ? fa(item.icon) : { value: '', library: '' },
      ...(item.url ? { link: link(item.url) } : {}),
    })),
    ...options,
  })

  /** Container raiz de uma seção: fundo de ponta a ponta, conteúdo em 1140px. */
  const root = (elements: ElementorNode[], options: { id?: string; tag?: string; css?: string; space?: number; pad?: [number, number] | false; background?: string; settings?: JsonRecord } = {}) => {
    const [top, bottom] = options.pad === false ? [0, 0] : options.pad ?? [L.section, L.section]
    const node = container({
      content_width: 'boxed', boxed_width: px(L.content),
      flex_direction: 'column', flex_gap: gap(options.space ?? 0),
      padding: sides(top, L.gutter.desktop, bottom, L.gutter.desktop),
      padding_tablet: sides(top, L.gutter.tablet, bottom, L.gutter.tablet),
      padding_mobile: sides(top, L.gutter.mobile, bottom, L.gutter.mobile),
      background_background: 'classic', background_color: options.background ?? C.paper,
      html_tag: options.tag ?? 'section',
      ...(options.id ? { _element_id: options.id } : {}),
      ...options.settings,
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { container, widget, col, row, grid, heading, text, image, divider, list, root, section }
}

export type InpelBuilder = ReturnType<typeof createBuilder>
