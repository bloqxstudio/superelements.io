import type { SectionNodeData } from '@/types/space'
import { BM, BM_EASE, BM_FONTS, BM_LAYOUT as L, bmAsset } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para o Baldez & Moreira
 * (prospecto). Editorial escuro e tipográfico: Jost leve e grande nos títulos,
 * Albert Sans no texto e na interface, um ouro só, tirado do logo. Todo
 * container declara padding e gap, porque o Elementor põe 10px e 20px quando
 * o JSON não diz nada. Nenhuma animação de entrada do Elementor: o movimento
 * (story.ts) é do GSAP, e o CSS sozinho já é a composição final.
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

export type Tone = 'light' | 'dark'

export const px = (size: number) => ({ unit: 'px', size, sizes: [] })
export const em = (size: number) => ({ unit: 'em', size, sizes: [] })
/** Valor livre (min, calc): unidade `custom` do Elementor. */
export const fluid = (value: string) => ({ unit: 'custom', size: value, sizes: [] })
export const gap = (row: number, column = row) => ({ unit: 'px', size: row, row: String(row), column: String(column), isLinked: row === column })
export const sides = (top: number, right = top, bottom = top, left = right) => ({
  unit: 'px', top: String(top), right: String(right), bottom: String(bottom), left: String(left),
  isLinked: top === right && right === bottom && bottom === left,
})
export const media = (url: string, alt = '') => ({ id: '', url, alt, source: 'url', size: '' })
export const link = (url: string, external = url.startsWith('http')) => ({ url, is_external: external ? 'on' : '', nofollow: '', custom_attributes: '' })
/** Ícone do Font Awesome 5 (a biblioteca que o Elementor carrega). */
export const fa = (value: string) => ({ value, library: value.startsWith('fab') ? 'fa-brands' : value.startsWith('far') ? 'fa-regular' : 'fa-solid' })
export const bg = (color: string) => ({ background_background: 'classic', background_color: color })
export const border = (color: string, width = sides(1)) => ({ border_border: 'solid', border_width: width, border_color: color })

/** Item flex que não cresce nem encolhe. */
export const FIXED = { _flex_size: 'none' } as const
/** Item flex que ocupa o resto da linha e pode encolher. */
export const FILL = { _flex_size: 'custom', _flex_grow: 1, _flex_shrink: 1 } as const
/** Medida de leitura: nunca passa da coluna. */
export const maxw = (width: number) => ({ _element_width: 'initial', _element_custom_width: fluid(`min(100%, ${width}px)`) })

export interface TypeSpec {
  font?: keyof typeof BM_FONTS
  size: number
  tablet?: number
  mobile?: number
  weight?: number
  line?: number
  letter?: number
  transform?: string
  style?: string
}

export const typography = (spec: TypeSpec, group = 'typography'): JsonRecord => ({
  [`${group}_typography`]: 'custom',
  [`${group}_font_family`]: BM_FONTS[spec.font ?? 'text'],
  [`${group}_font_size`]: px(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: px(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: px(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line !== undefined ? { [`${group}_line_height`]: em(spec.line) } : {}),
  ...(spec.letter !== undefined ? { [`${group}_letter_spacing`]: em(spec.letter) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
  ...(spec.style ? { [`${group}_font_style`]: spec.style } : {}),
})

/**
 * Escala do DESIGN.md §4. Títulos em Jost leve (300), grandes e apertados;
 * rótulos, menu e botões em Albert Sans, a fonte de texto, porque a marca não
 * tem papel de rótulo.
 */
export const T = {
  hero: { font: 'title', size: 96, tablet: 70, mobile: 48, weight: 300, line: 0.98, letter: -0.025 },
  display: { font: 'title', size: 64, tablet: 52, mobile: 36, weight: 300, line: 1.04, letter: -0.02 },
  h2: { font: 'title', size: 52, tablet: 42, mobile: 32, weight: 300, line: 1.06, letter: -0.02 },
  h3: { font: 'title', size: 24, tablet: 22, mobile: 20, weight: 400, line: 1.25, letter: -0.005 },
  card: { font: 'title', size: 20, mobile: 19, weight: 500, line: 1.25 },
  numeral: { font: 'title', size: 56, tablet: 48, mobile: 40, weight: 200, line: 1, letter: -0.02 },
  lede: { size: 19, mobile: 17, line: 1.6 },
  body: { size: 17, mobile: 16, line: 1.65 },
  small: { size: 15, line: 1.6 },
  list: { size: 16, line: 1.6 },
  strong: { size: 16, weight: 600, line: 1.4 },
  nav: { size: 15, weight: 500, line: 1.2 },
  eyebrow: { size: 12, weight: 600, line: 1.4, letter: 0.22, transform: 'uppercase' },
  tag: { size: 13, weight: 600, line: 1.3, letter: 0.02 },
  button: { size: 15, weight: 600, line: 1.2, letter: 0.01 },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Link, foco, botão e parágrafos: vale para toda seção do Baldez & Moreira. */
const BASE_CSS = [
  'selector{overflow-x:clip;scroll-margin-top:84px}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p{margin:0 0 .85em}selector .elementor-widget-text-editor p:last-child{margin-bottom:0}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper{line-height:0}',
  'selector .elementor-button{min-height:52px;display:inline-flex;align-items:center;justify-content:center}',
  'selector .elementor-button-icon{display:inline-flex;align-items:center;line-height:1}selector .elementor-button-icon i{font-size:1.1em}',
  // rótulo: um filete na frente, reto como as hastes do monograma
  'selector .bm-eyebrow .elementor-heading-title{display:inline-flex;align-items:center;gap:12px}selector .bm-eyebrow .elementor-heading-title::before{content:"";width:28px;height:1px;flex:none;background:currentColor}',
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition-property:color,background-color,border-color;transition-duration:180ms;transition-timing-function:${BM_EASE}}}`,
  // a seta dos links anda 4px com o mouse; nada essencial depende disso
  `@media(prefers-reduced-motion:no-preference) and (hover:hover){selector .bm-arrow .elementor-icon-list-icon,selector .bm-arrow i{transition:transform 220ms ${BM_EASE}}selector a:hover .bm-arrow-i,selector .bm-row a:hover i{transform:translateX(4px)}}`,
  '@media(prefers-reduced-motion:reduce){selector *{transition:none!important;animation:none!important}}',
  // foco: ouro no escuro, azul-marinho no papel (o ouro não passa de 3:1 no claro)
  `selector a:focus-visible,selector summary:focus-visible,selector button:focus-visible,selector .elementor-button:focus-visible{outline:2px solid ${BM.gold};outline-offset:4px}`,
  `selector.bm-light a:focus-visible,selector.bm-light summary:focus-visible,selector.bm-light .elementor-button:focus-visible{outline-color:${BM.navy}}`,
].join('')

export type ButtonVariant = 'primary' | 'outline' | 'outlineLight'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  // texto noite no ouro (8,5:1)
  primary: {
    background_color: BM.gold, button_text_color: BM.ink,
    button_background_hover_color: BM.goldHover, hover_color: BM.ink,
    ...border(BM.gold, sides(1)), button_hover_border_color: BM.goldHover,
  },
  // no papel: contorno azul-marinho que enche com o mouse
  outline: {
    background_color: 'rgba(255,255,255,0)', button_text_color: BM.navy,
    button_background_hover_color: BM.navy, hover_color: BM.paper,
    ...border(BM.navy, sides(1)), button_hover_border_color: BM.navy,
  },
  // no escuro: contorno claro que fica ouro com o mouse
  outlineLight: {
    background_color: 'rgba(255,255,255,0)', button_text_color: BM.white,
    button_background_hover_color: 'rgba(255,255,255,0)', hover_color: BM.gold,
    ...border('rgba(236,231,221,0.34)', sides(1)), button_hover_border_color: BM.gold,
  },
}

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

  const heading = (title: string, spec: TypeSpec, color: string = BM.heading, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = BM.body, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(bmAsset(path), alt), image_size: 'full', ...options })

  /** Botão quase reto (2px); `icon` vai antes do texto (o WhatsApp, por exemplo). */
  const button = (label: string, url: string, variant: ButtonVariant = 'primary', options: JsonRecord & { icon?: string; after?: boolean } = {}) => {
    const { icon, after, ...rest } = options
    return widget('button', {
      text: label, link: link(url), size: 'md',
      ...typography(T.button),
      text_padding: sides(16, 26),
      border_radius: sides(L.radius.button),
      ...BUTTON_COLORS[variant],
      ...(icon ? { selected_icon: fa(icon), icon_align: after ? 'right' : 'left', icon_indent: px(10) } : {}),
      ...rest,
    })
  }

  /** Rótulo em caixa alta com filete: ouro no escuro, ouro escuro no papel. */
  const eyebrow = (label: string, tone: Tone = 'light', options: JsonRecord = {}) =>
    heading(label, T.eyebrow, tone === 'dark' ? BM.gold : BM.goldInk, { _css_classes: 'bm-eyebrow', ...options })

  /** Cabeça de seção: rótulo, título e texto de apoio. */
  const sectionHead = (head: { label: string; title: string; lede?: string; tone?: Tone; align?: 'left' | 'center'; width?: number; ledeWidth?: number; tag?: string; spec?: TypeSpec }, options: JsonRecord = {}) => {
    const tone = head.tone ?? 'light'
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      eyebrow(head.label, tone, align),
      heading(head.title, head.spec ?? T.h2, tone === 'dark' ? BM.white : BM.heading, { header_size: head.tag ?? 'h2', ...align, ...maxw(head.width ?? 820) }),
      ...(head.lede ? [text(head.lede, T.lede, tone === 'dark' ? BM.soft : BM.body, { ...align, ...maxw(head.ledeWidth ?? 600) })] : []),
    ], 22, { flex_align_items: center ? 'center' : 'flex-start', css_classes: 'bm-rise', ...options })
  }

  /** Lista com ícone opcional por item. */
  const list = (items: Array<{ text: string; url?: string; icon?: string }>, options: JsonRecord = {}) => widget('icon-list', {
    icon_list: items.map((item) => ({
      _id: uid(),
      text: item.text,
      selected_icon: item.icon ? fa(item.icon) : { value: '', library: '' },
      ...(item.url ? { link: link(item.url) } : {}),
    })),
    ...options,
  })

  /** Widget HTML só de comportamento (o script do movimento); nunca conteúdo. */
  const behavior = (html: string) => widget('html', { html, _css_classes: 'bm-behavior' })

  /** Container raiz de uma seção: fundo de ponta a ponta, conteúdo em 1240px. */
  const root = (elements: ElementorNode[], options: { background: string; tone?: Tone; id?: string; tag?: string; css?: string; space?: number; classes?: string; pad?: [number, number, number] | false; settings?: JsonRecord }) => {
    const [desktop, tablet, mobile] = options.pad === false ? [0, 0, 0] : options.pad ?? [L.section.desktop, L.section.tablet, L.section.mobile]
    const tone = options.tone ?? 'dark'
    const node = container({
      content_width: 'boxed', boxed_width: px(L.content),
      flex_direction: 'column', flex_gap: gap(options.space ?? 0),
      // o respiro entre os blocos encolhe junto com a tela
      flex_gap_tablet: gap(Math.round((options.space ?? 0) * 0.8)), flex_gap_mobile: gap(Math.round((options.space ?? 0) * 0.66)),
      padding: sides(desktop, L.gutter.desktop, desktop, L.gutter.desktop),
      padding_tablet: sides(tablet, L.gutter.tablet, tablet, L.gutter.tablet),
      padding_mobile: sides(mobile, L.gutter.mobile, mobile, L.gutter.mobile),
      ...bg(options.background),
      html_tag: options.tag ?? 'section',
      ...(options.id ? { _element_id: options.id } : {}),
      css_classes: [`bm-${tone}`, options.classes].filter(Boolean).join(' '),
      ...options.settings,
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { container, widget, col, row, grid, heading, text, image, button, eyebrow, sectionHead, list, behavior, root, section, uid }
}

export type BmBuilder = ReturnType<typeof createBuilder>
