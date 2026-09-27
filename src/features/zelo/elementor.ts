import type { SectionNodeData } from '@/types/space'
import { ZELO as C, ZELO_FONTS as F, ZELO_LAYOUT as L, zeloAsset } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para a marca Zelo: containers,
 * headings, text-editor, image, button, divider, form e nested-accordion.
 * Todo container declara padding e gap, porque o Elementor põe 10px e 20px
 * quando o JSON não diz nada.
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
/** Valor livre (clamp, calc): unidade `custom` do Elementor. */
export const fluid = (value: string) => ({ unit: 'custom', size: value, sizes: [] })
const size = (v: Size) => (typeof v === 'number' ? px(v) : fluid(v))
export const gap = (row: number, column = row) => ({ unit: 'px', size: row, row: String(row), column: String(column), isLinked: row === column })
export const sides = (top: number, right = top, bottom = top, left = right) => ({
  unit: 'px', top: String(top), right: String(right), bottom: String(bottom), left: String(left),
  isLinked: top === right && right === bottom && bottom === left,
})
export const media = (url: string, alt = '') => ({ id: '', url, alt, source: 'url', size: '' })
export const link = (url: string, external = false) => ({ url, is_external: external ? 'on' : '', nofollow: '', custom_attributes: '' })

/** Item flex que não cresce nem encolhe. */
export const FIXED = { _flex_size: 'none' } as const
/** Item flex que ocupa o resto da linha e pode encolher (quebra linha em vez de vazar). */
export const FILL = { _flex_size: 'custom', _flex_grow: 1, _flex_shrink: 1 } as const

export interface TypeSpec {
  family: string
  size: Size
  tablet?: Size
  mobile?: Size
  weight?: number | string
  line?: number
  letter?: number
  transform?: string
}

export const typography = (spec: TypeSpec, group = 'typography'): JsonRecord => ({
  [`${group}_typography`]: 'custom',
  [`${group}_font_family`]: spec.family,
  [`${group}_font_size`]: size(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: size(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: size(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line !== undefined ? { [`${group}_line_height`]: em(spec.line) } : {}),
  ...(spec.letter !== undefined ? { [`${group}_letter_spacing`]: em(spec.letter) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
})

/** Escala tipográfica da Zelo (px já com o rem de 12,8px). */
export const T = {
  hero: { family: F.title, size: 'clamp(30.72px, 4.96vw, 53.12px)', weight: 800, line: 1, letter: -0.032 },
  h2: { family: F.ui, size: 'clamp(23.68px, 3.12vw, 34.56px)', weight: 800, line: 1.08, letter: -0.032 },
  lede: { family: F.text, size: 14.46, weight: 400, line: 1.62 },
  body: { family: F.text, size: 12.8, weight: 400, line: 1.62 },
  small: { family: F.text, size: 11.65, weight: 400, line: 1.62 },
  fine: { family: F.text, size: 10.75, weight: 400, line: 1.45 },
  rail: { family: F.ui, size: 11.52, mobile: 11, weight: 700, line: 1.3, letter: -0.006 },
  rot: { family: F.ui, size: 10.5, weight: 700, line: 1.62, letter: -0.002 },
  card: { family: F.ui, size: 12.29, weight: 600, line: 1.16, letter: -0.01 },
  ui: { family: F.ui, size: 11.78, weight: 600, line: 1.3 },
  mono: { family: F.mono, size: 10.5, weight: 500, line: 1.62, letter: -0.01 },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Link, foco e parágrafos: vale para toda seção da Zelo. */
const BASE_CSS = [
  // halos e brilhos não criam rolagem lateral (o site usa overflow-x: hidden no body)
  'selector{overflow-x:clip}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p:last-child{margin-block-end:0}',
  // títulos equilibrados como no site (h1, h2, h3 { text-wrap: balance })
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  // imagem e botão sem a caixa de linha do texto em volta
  'selector .elementor-widget-image,selector .elementor-button-wrapper{line-height:0}',
  `selector a:focus-visible,selector summary:focus-visible,selector [tabindex]:focus-visible,selector button:focus-visible{outline:2px solid ${C.green};outline-offset:3px;border-radius:7px}`,
  `selector .zl-verde{color:${C.titleGreen};background-image:linear-gradient(100deg,${C.titleDeep} 0%,${C.titleGreen} 32%,${C.titleShine} 47%,${C.titleGreen} 62%,${C.titleDeep} 100%);background-size:210% 100%;background-repeat:no-repeat;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}`,
  '@media (prefers-reduced-motion:no-preference){selector .zl-verde{animation:zl-brilho 2.8s ease-in-out infinite alternate}}',
  '@keyframes zl-brilho{from{background-position:0 0}to{background-position:100% 0}}',
].join('')

/** Botões: brilho que atravessa no hover, só com movimento liberado. */
export const BUTTON_CSS = [
  'selector .elementor-button{position:relative;overflow:hidden;transition:transform .16s ease,background-color .16s ease,color .16s ease,border-color .16s ease}',
  'selector .elementor-button:hover{transform:translateY(-1px)}',
  'selector .elementor-button::before{content:"";position:absolute;top:-20%;bottom:-20%;left:-75%;width:55%;transform:skewX(-18deg);background:linear-gradient(105deg,transparent,rgba(255,255,255,.38) 50%,transparent);pointer-events:none}',
  'selector .zl-btn--ghost .elementor-button::before{background:linear-gradient(105deg,transparent,rgba(144,184,166,.22) 50%,transparent)}',
  '@media (prefers-reduced-motion:no-preference){selector .elementor-button:hover::before{animation:zl-shine .8s ease}}',
  '@media (prefers-reduced-motion:reduce){selector .elementor-button:hover{transform:none}}',
  '@keyframes zl-shine{to{left:130%}}',
].join('')

/** Ponto "vivo" das pastilhas e das listas: pulsa quando há movimento. */
export const DOT_CSS = [
  `selector .zl-dot{display:inline-block;flex:none;width:7px;height:7px;border-radius:999px;background:${C.green};vertical-align:middle}`,
  '@media (prefers-reduced-motion:no-preference){selector .zl-dot--vivo{animation:zl-vivo 2s ease-in-out infinite}}',
  '@keyframes zl-vivo{0%,100%{opacity:1;transform:none}50%{opacity:.3;transform:scale(.75)}}',
].join('')

export type ButtonVariant = 'fill' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'wide' | 'form'

const BUTTON_SIZE: Record<ButtonSize, { font: number; pad: [number, number] }> = {
  sm: { font: 11.33, pad: [6.4, 11.52] },
  md: { font: 11.14, pad: [9.22, 14.72] },
  wide: { font: 12.03, pad: [12.16, 14.72] },
  form: { font: 12.8, pad: [13.44, 14.72] },
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

  const heading = (title: string, spec: TypeSpec, color: string = C.ink, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = C.soft, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (file: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(zeloAsset(file), alt), image_size: 'full', ...options })
  const icon = (name: string, box = 21, options: JsonRecord = {}) =>
    image(`icons/${name}.svg`, '', { width: px(box), align: 'left', _element_width: 'auto', ...FIXED, ...options })
  const divider = (color: string = '#90B8A64D', options: JsonRecord = {}) =>
    widget('divider', { style: 'solid', weight: px(1), color, gap: px(0), ...FILL, ...options })

  const button = (label: string, url: string, variant: ButtonVariant = 'fill', kind: ButtonSize = 'md', options: JsonRecord = {}) => {
    const { font, pad } = BUTTON_SIZE[kind]
    const fill = variant === 'fill'
    return widget('button', {
      text: label,
      link: link(url, url.startsWith('http')),
      size: 'sm',
      ...(kind === 'wide' || kind === 'form' ? { align: 'justify' } : {}),
      ...typography({ family: F.ui, size: font, weight: 600, line: 1.62, letter: -0.005 }),
      button_text_color: fill ? '#000000' : C.ink,
      background_color: fill ? C.green : 'transparent',
      border_border: 'solid', border_width: sides(1), border_color: fill ? C.green : C.lineStrong,
      border_radius: sides(L.radius.pill),
      text_padding: sides(pad[0], pad[1], pad[0], pad[1]),
      hover_color: fill ? '#000000' : C.green,
      button_background_hover_color: fill ? C.green2 : 'transparent',
      button_hover_border_color: fill ? C.green2 : C.green,
      _css_classes: `zl-btn zl-btn--${variant}`,
      ...options,
    })
  }

  /** Rótulo verde com o filete que corre até a borda (a `.rail` do site). */
  const rail = (label: string, extra: ElementorNode[] = [], options: JsonRecord = {}) =>
    row([heading(label, T.rail, C.green, { ...FIXED }), ...extra, divider('#90B8A64D')], 10.24, {
      padding: sides(0, 0, 9.22, 0), css_classes: 'zl-rail', ...options,
    })

  /** Pastilha de texto com contorno (tags, selos, pílulas das telinhas). */
  const pill = (title: string, spec: TypeSpec, color: string, options: JsonRecord = {}) =>
    heading(title, spec, color, {
      _element_width: 'auto', ...FIXED,
      _padding: sides(2.56, 9.22, 2.56, 9.22),
      _border_border: 'solid', _border_width: sides(1), _border_color: C.lineStrong,
      _border_radius: sides(L.radius.pill),
      ...options,
    })

  /** Container raiz de uma seção: fundo de ponta a ponta, conteúdo em 1044px. */
  const root = (elements: ElementorNode[], options: { id?: string; tag?: string; css?: string; space?: number; pad?: [number, number, number] | false; settings?: JsonRecord } = {}) => {
    const [desktop, tablet, mobile] = options.pad === false ? [0, 0, 0] : options.pad ?? [L.section.desktop, L.section.tablet, L.section.mobile]
    const node = container({
      content_width: 'boxed', boxed_width: px(L.content),
      flex_direction: 'column', flex_gap: gap(options.space ?? 0),
      padding: sides(desktop, L.gutter.desktop, desktop, L.gutter.desktop),
      padding_tablet: sides(tablet, L.gutter.tablet, tablet, L.gutter.tablet),
      padding_mobile: sides(mobile, L.gutter.mobile, mobile, L.gutter.mobile),
      background_background: 'classic', background_color: C.paper,
      html_tag: options.tag ?? 'section',
      ...(options.id ? { _element_id: options.id } : {}),
      ...options.settings,
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { container, widget, col, row, grid, heading, text, image, icon, divider, button, rail, pill, root, section }
}

export type ZeloBuilder = ReturnType<typeof createBuilder>
