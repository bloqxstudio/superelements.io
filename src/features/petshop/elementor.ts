import type { SectionNodeData } from '@/types/space'
import { PET, PET_EASE, PET_FONTS, PET_LAYOUT as L, petAsset } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para a Caramelo Pet. Todo
 * container declara padding e gap, porque o Elementor põe 10px e 20px quando
 * o JSON não diz nada. Títulos em Fredoka, texto em Nunito, um caramelo só.
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
  font?: keyof typeof PET_FONTS
  size: number
  tablet?: number
  mobile?: number
  weight?: number
  line?: number
  letter?: number
  transform?: string
}

export const typography = (spec: TypeSpec, group = 'typography'): JsonRecord => ({
  [`${group}_typography`]: 'custom',
  [`${group}_font_family`]: PET_FONTS[spec.font ?? 'text'],
  [`${group}_font_size`]: px(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: px(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: px(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line !== undefined ? { [`${group}_line_height`]: em(spec.line) } : {}),
  ...(spec.letter !== undefined ? { [`${group}_letter_spacing`]: em(spec.letter) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
})

/** Escala do DESIGN.md §4. */
export const T = {
  hero: { font: 'title', size: 64, tablet: 52, mobile: 40, weight: 600, line: 1.02, letter: -0.02 },
  h2: { font: 'title', size: 44, tablet: 38, mobile: 32, weight: 600, line: 1.08, letter: -0.015 },
  card: { font: 'title', size: 22, mobile: 20, weight: 600, line: 1.2 },
  price: { font: 'title', size: 40, mobile: 34, weight: 600, line: 1, letter: -0.02 },
  quote: { size: 19, mobile: 17, weight: 400, line: 1.6 },
  brand: { font: 'title', size: 26, weight: 600, line: 1, letter: -0.01 },
  lede: { size: 19, mobile: 17, line: 1.6 },
  body: { size: 17, mobile: 16, line: 1.6 },
  small: { size: 15, line: 1.55 },
  strong: { size: 15, weight: 700, line: 1.4 },
  nav: { size: 15, weight: 700, line: 1.2 },
  eyebrow: { size: 12, weight: 800, line: 1.4, letter: 0.12, transform: 'uppercase' },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Entrada curta ao rolar (DESIGN.md §6). */
export const reveal = (delay = 0, target: 'widget' | 'container' = 'widget') => (target === 'widget'
  ? { _animation: 'fadeInUp', _animation_delay: delay, animation_duration: 'fast' }
  : { animation: 'fadeInUp', animation_delay: delay, animation_duration: 'fast' })

/** Link, foco, botão, cartão e parágrafos: vale para toda seção da Caramelo Pet. */
const BASE_CSS = [
  'selector{overflow-x:clip;scroll-margin-top:24px}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p{margin:0 0 .75em}selector .elementor-widget-text-editor p:last-child{margin-bottom:0}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper{line-height:0}',
  'selector .elementor-button{min-height:48px;display:inline-flex;align-items:center;justify-content:center}',
  'selector .elementor-button-icon{display:inline-flex;align-items:center;line-height:1}selector .elementor-button-icon i{font-size:1.1em}',
  // quadrado do ícone com a mesma medida para qualquer ícone
  'selector .pet-badge .elementor-icon-wrapper{line-height:0}selector .pet-badge .elementor-icon{display:inline-flex;align-items:center;justify-content:center;width:1em;height:1em;box-sizing:content-box;transition:none}selector .pet-badge .elementor-icon i{width:1em;text-align:center}',
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition-property:color,background-color,border-color,transform;transition-duration:180ms;transition-timing-function:${PET_EASE}}selector .elementor-button:active{transform:scale(.96)}}`,
  // cartão: sobe 4px com o mouse; nada essencial muda no hover
  `@media(prefers-reduced-motion:no-preference){selector .pet-card{transition-property:transform,border-color;transition-duration:220ms;transition-timing-function:${PET_EASE}}}`,
  `@media(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference){selector .pet-card:hover{transform:translateY(-4px)}}`,
  `@media(hover:hover) and (pointer:fine){selector .pet-card:hover{border-color:${PET.caramel}}}`,
  // entrada: sobe 14px, não a altura inteira do elemento
  '@media(prefers-reduced-motion:no-preference){@keyframes petIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}selector .animated.fadeInUp{animation-name:petIn;animation-duration:520ms;animation-timing-function:cubic-bezier(.2,.7,.2,1)}}',
  '@media(prefers-reduced-motion:reduce){selector .animated,selector.animated{animation:none!important}selector .elementor-invisible{visibility:visible!important}selector *{transition:none!important}}',
  `selector a:focus-visible,selector summary:focus-visible,selector button:focus-visible,selector .elementor-button:focus-visible,selector input:focus-visible,selector select:focus-visible,selector textarea:focus-visible{outline:3px solid ${PET.ink};outline-offset:3px}`,
].join('')

/** Rastro de patas bem fraco, no canto da seção (o símbolo da marca, em padrão). */
export const pawTrail = (color: string, at: string, size = 88) => {
  const paw = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g fill='${color}'><path d='M32 30c-7.5 0-13 6.6-13 12.4 0 4.6 3.4 7.1 7.4 7.1 2.4 0 3.9-1 5.6-1s3.2 1 5.6 1c4 0 7.4-2.5 7.4-7.1C45 36.6 39.5 30 32 30z'/><ellipse cx='19.6' cy='28.4' rx='4' ry='5.2' transform='rotate(-22 19.6 28.4)'/><ellipse cx='27' cy='20.4' rx='4.2' ry='5.6' transform='rotate(-8 27 20.4)'/><ellipse cx='37' cy='20.4' rx='4.2' ry='5.6' transform='rotate(8 37 20.4)'/><ellipse cx='44.4' cy='28.4' rx='4' ry='5.2' transform='rotate(22 44.4 28.4)'/></g></svg>`
  const url = `url("data:image/svg+xml,${encodeURIComponent(paw)}")`
  const mask = `radial-gradient(ellipse 45% 55% at ${at},#000 10%,transparent 70%)`
  return `selector{isolation:isolate}selector::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background-image:${url},${url};background-size:${size}px ${size}px;background-position:0 0,${size / 2}px ${size / 2}px;-webkit-mask-image:${mask};mask-image:${mask}}`
}

export type ButtonVariant = 'primary' | 'outline' | 'light' | 'outlineLight'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  // texto azul-marinho no caramelo (6,4:1); branco não passa
  primary: {
    background_color: PET.caramel, button_text_color: PET.ink,
    button_background_hover_color: PET.caramelHover, hover_color: PET.ink,
    ...border(PET.caramel, sides(2)), button_hover_border_color: PET.caramelHover,
  },
  outline: {
    background_color: 'rgba(255,255,255,0)', button_text_color: PET.ink,
    button_background_hover_color: PET.ink, hover_color: PET.white,
    ...border(PET.ink, sides(2)), button_hover_border_color: PET.ink,
  },
  light: {
    background_color: PET.white, button_text_color: PET.ink,
    button_background_hover_color: PET.cream, hover_color: PET.ink,
    ...border(PET.white, sides(2)), button_hover_border_color: PET.cream,
  },
  outlineLight: {
    background_color: 'rgba(255,255,255,0)', button_text_color: PET.white,
    button_background_hover_color: PET.white, hover_color: PET.ink,
    ...border('rgba(255,255,255,0.6)', sides(2)), button_hover_border_color: PET.white,
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

  const heading = (title: string, spec: TypeSpec, color: string = PET.ink, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = PET.body, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(petAsset(path), alt), image_size: 'full', ...options })

  /** Botão em pílula; `icon` vai antes do texto (o WhatsApp, por exemplo). */
  const button = (label: string, url: string, variant: ButtonVariant = 'primary', options: JsonRecord & { icon?: string } = {}) => {
    const { icon, ...rest } = options
    return widget('button', {
      text: label, link: link(url), size: 'md',
      ...typography({ size: 16, weight: 800, line: 1.2 }),
      text_padding: sides(14, 26),
      border_radius: sides(L.radius.pill),
      ...BUTTON_COLORS[variant],
      ...(icon ? { selected_icon: fa(icon), icon_align: 'left', icon_indent: px(10) } : {}),
      ...rest,
    })
  }

  /** Rótulo em caixa alta: caramelo escuro no claro, caramelo no escuro. */
  const eyebrow = (label: string, tone: Tone = 'light', options: JsonRecord = {}) =>
    heading(label, T.eyebrow, tone === 'dark' ? PET.caramel : PET.caramelInk, options)

  /** Cabeça de seção: rótulo, título e texto de apoio. */
  const sectionHead = (head: { label: string; labelColor?: string; title: string; lede?: string; tone?: Tone; align?: 'left' | 'center'; width?: number }, options: JsonRecord = {}) => {
    const tone = head.tone ?? 'light'
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      eyebrow(head.label, tone, { ...align, ...(head.labelColor ? { title_color: head.labelColor } : {}), ...reveal(0) }),
      heading(head.title, T.h2, tone === 'dark' ? PET.white : PET.ink, { header_size: 'h2', ...align, ...maxw(head.width ?? 760), ...reveal(80) }),
      ...(head.lede ? [text(head.lede, T.lede, tone === 'dark' ? PET.onInk : PET.body, { ...align, ...maxw(620), ...reveal(160) })] : []),
    ], 16, { flex_align_items: center ? 'center' : 'flex-start', ...options })
  }

  /** Ícone num quadrado de cantos redondos (fundo caramelo claro, ícone azul-marinho). */
  const badge = (icon: string, options: { background?: string; color?: string; size?: number } = {}) => widget('icon', {
    selected_icon: fa(icon), view: 'stacked', shape: 'square',
    primary_color: options.background ?? PET.warm, secondary_color: options.color ?? PET.ink,
    size: px(options.size ?? 22), icon_padding: px(15), border_radius: sides(16),
    align: 'left', ...FIXED, _element_width: 'auto', _css_classes: 'pet-badge',
  })

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

  /** Cartão branco com borda fina e raio de 24px. */
  const card = (elements: ElementorNode[], options: JsonRecord = {}) => col(elements, 16, {
    padding: sides(28), padding_mobile: sides(24),
    ...bg(PET.white), ...border(PET.line), border_radius: sides(L.radius.card),
    css_classes: 'pet-card',
    ...options,
  })

  /** Container raiz de uma seção: fundo de ponta a ponta, conteúdo em 1200px. */
  const root = (elements: ElementorNode[], options: { background: string; id?: string; tag?: string; css?: string; space?: number; pad?: [number, number, number] | false; settings?: JsonRecord }) => {
    const [desktop, tablet, mobile] = options.pad === false ? [0, 0, 0] : options.pad ?? [L.section.desktop, L.section.tablet, L.section.mobile]
    const node = container({
      content_width: 'boxed', boxed_width: px(L.content),
      flex_direction: 'column', flex_gap: gap(options.space ?? 0),
      padding: sides(desktop, L.gutter.desktop, desktop, L.gutter.desktop),
      padding_tablet: sides(tablet, L.gutter.tablet, tablet, L.gutter.tablet),
      padding_mobile: sides(mobile, L.gutter.mobile, mobile, L.gutter.mobile),
      ...bg(options.background),
      html_tag: options.tag ?? 'section',
      ...(options.id ? { _element_id: options.id } : {}),
      ...options.settings,
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { container, widget, col, row, grid, heading, text, image, button, eyebrow, sectionHead, badge, list, card, root, section }
}

export type PetBuilder = ReturnType<typeof createBuilder>
