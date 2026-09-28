import type { SectionNodeData } from '@/types/space'
import { JA, JA_EASE, JA_FONTS, JA_LAYOUT as L, jaAsset } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para a Júnior Automáticos. Todo
 * container declara padding e gap, porque o Elementor põe 10px e 20px quando
 * o JSON não diz nada. Títulos em Saira, texto em Barlow, um dourado só.
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
  font?: keyof typeof JA_FONTS
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
  [`${group}_font_family`]: JA_FONTS[spec.font ?? 'text'],
  [`${group}_font_size`]: px(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: px(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: px(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line !== undefined ? { [`${group}_line_height`]: em(spec.line) } : {}),
  ...(spec.letter !== undefined ? { [`${group}_letter_spacing`]: em(spec.letter) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
})

/**
 * Escala do DESIGN.md §4. Títulos em Saira com a entrelinha e o espaçamento
 * do papel de título da marca; rótulos, menu e botões em Barlow, a fonte de
 * texto, porque a marca não tem papel de rótulo. Assim a marca aplicada por
 * cima do modelo não muda nada.
 */
export const T = {
  hero: { font: 'title', size: 60, tablet: 50, mobile: 36, weight: 700, line: 1.1, letter: -0.01 },
  h2: { font: 'title', size: 44, tablet: 38, mobile: 30, weight: 700, line: 1.1, letter: -0.01 },
  statement: { font: 'title', size: 28, tablet: 26, mobile: 23, weight: 700, line: 1.1, letter: -0.01 },
  card: { font: 'title', size: 20, mobile: 19, weight: 700, line: 1.1, letter: -0.01 },
  stat: { font: 'title', size: 72, tablet: 64, mobile: 56, weight: 700, line: 1, letter: -0.02 },
  lede: { size: 19, mobile: 17, line: 1.65 },
  body: { size: 17, mobile: 16, line: 1.65 },
  small: { size: 15, line: 1.65 },
  /** listas com ícone: a marca as trata como texto corrido */
  list: { size: 16, line: 1.65 },
  strong: { size: 16, weight: 600, line: 1.4 },
  nav: { size: 15, weight: 500, line: 1.2 },
  eyebrow: { size: 12, weight: 700, line: 1.4, letter: 0.16, transform: 'uppercase' },
  button: { size: 15, weight: 600, line: 1.2, letter: 0.06, transform: 'uppercase' },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Entrada curta ao rolar (DESIGN.md §6). */
export const reveal = (delay = 0, target: 'widget' | 'container' = 'widget') => (target === 'widget'
  ? { _animation: 'fadeInUp', _animation_delay: delay, animation_duration: 'fast' }
  : { animation: 'fadeInUp', animation_delay: delay, animation_duration: 'fast' })

/** Link, foco, botão, cartão e parágrafos: vale para toda seção da Júnior Automáticos. */
const BASE_CSS = [
  'selector{overflow-x:clip;scroll-margin-top:72px}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p{margin:0 0 .85em}selector .elementor-widget-text-editor p:last-child{margin-bottom:0}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper{line-height:0}',
  'selector .elementor-button{min-height:50px;display:inline-flex;align-items:center;justify-content:center}',
  'selector .elementor-button-icon{display:inline-flex;align-items:center;line-height:1}selector .elementor-button-icon i{font-size:1.15em}',
  // rótulo: filete dourado na frente, como a linha do logo
  `selector .ja-eyebrow .elementor-heading-title{display:inline-flex;align-items:center;gap:10px}selector .ja-eyebrow .elementor-heading-title::before{content:"";width:22px;height:2px;flex:none;background:${JA.gold}}`,
  // quadrado do ícone com a mesma medida para qualquer ícone
  'selector .ja-badge .elementor-icon-wrapper{line-height:0}selector .ja-badge .elementor-icon{display:inline-flex;align-items:center;justify-content:center;width:1em;height:1em;box-sizing:content-box;transition:none}selector .ja-badge .elementor-icon i{width:1em;text-align:center}',
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition-property:color,background-color,border-color,transform;transition-duration:180ms;transition-timing-function:${JA_EASE}}selector .elementor-button:active{transform:scale(.96)}}`,
  // cartão: só a borda fica dourada com o mouse; nada essencial muda no hover
  `@media(prefers-reduced-motion:no-preference){selector .ja-card{transition:border-color 200ms ${JA_EASE}}}`,
  `@media(hover:hover) and (pointer:fine){selector .ja-card:hover{border-color:${JA.gold}}}`,
  // entrada: sobe 14px, não a altura inteira do elemento
  '@media(prefers-reduced-motion:no-preference){@keyframes jaIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}selector .animated.fadeInUp{animation-name:jaIn;animation-duration:520ms;animation-timing-function:cubic-bezier(.2,.7,.2,1)}}',
  '@media(prefers-reduced-motion:reduce){selector .animated,selector.animated{animation:none!important}selector .elementor-invisible{visibility:visible!important}selector *{transition:none!important}}',
  `selector a:focus-visible,selector summary:focus-visible,selector button:focus-visible,selector .elementor-button:focus-visible{outline:3px solid ${JA.gold};outline-offset:3px}`,
].join('')

/** Grade técnica bem fraca, apagando para as bordas (como a folha de um manual). */
export const techGrid = (color: string, at = '50% 0%', size = 56) => {
  const mask = `radial-gradient(ellipse 60% 70% at ${at},#000 10%,transparent 72%)`
  return `selector{isolation:isolate}selector::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background-image:linear-gradient(${color} 1px,transparent 1px),linear-gradient(90deg,${color} 1px,transparent 1px);background-size:${size}px ${size}px;-webkit-mask-image:${mask};mask-image:${mask}}`
}

export type ButtonVariant = 'primary' | 'outline' | 'outlineLight'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  // texto preto no dourado (7,9:1); branco não passa
  primary: {
    background_color: JA.gold, button_text_color: JA.black,
    button_background_hover_color: JA.goldHover, hover_color: JA.black,
    ...border(JA.gold, sides(1)), button_hover_border_color: JA.goldHover,
  },
  outline: {
    background_color: 'rgba(255,255,255,0)', button_text_color: JA.ink,
    button_background_hover_color: JA.ink, hover_color: JA.white,
    ...border(JA.ink, sides(1)), button_hover_border_color: JA.ink,
  },
  outlineLight: {
    background_color: 'rgba(255,255,255,0)', button_text_color: JA.white,
    button_background_hover_color: 'rgba(255,255,255,0)', hover_color: JA.gold,
    ...border('rgba(255,255,255,0.32)', sides(1)), button_hover_border_color: JA.gold,
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

  const heading = (title: string, spec: TypeSpec, color: string = JA.ink, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = JA.body, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(jaAsset(path), alt), image_size: 'full', ...options })

  /** Botão de cantos retos (6px); `icon` vai antes do texto (o WhatsApp, por exemplo). */
  const button = (label: string, url: string, variant: ButtonVariant = 'primary', options: JsonRecord & { icon?: string } = {}) => {
    const { icon, ...rest } = options
    return widget('button', {
      text: label, link: link(url), size: 'md',
      ...typography(T.button),
      text_padding: sides(15, 26),
      border_radius: sides(L.radius.button),
      ...BUTTON_COLORS[variant],
      ...(icon ? { selected_icon: fa(icon), icon_align: 'left', icon_indent: px(10) } : {}),
      ...rest,
    })
  }

  /** Rótulo em caixa alta com filete: dourado no escuro, dourado escuro no claro. */
  const eyebrow = (label: string, tone: Tone = 'light', options: JsonRecord = {}) =>
    heading(label, T.eyebrow, tone === 'dark' ? JA.gold : JA.goldInk, { _css_classes: 'ja-eyebrow', ...options })

  /** Cabeça de seção: rótulo, título e texto de apoio. */
  const sectionHead = (head: { label: string; title: string; lede?: string; tone?: Tone; align?: 'left' | 'center'; width?: number; tag?: string }, options: JsonRecord = {}) => {
    const tone = head.tone ?? 'light'
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      eyebrow(head.label, tone, { ...align, ...reveal(0) }),
      heading(head.title, T.h2, tone === 'dark' ? JA.white : JA.ink, { header_size: head.tag ?? 'h2', ...align, ...maxw(head.width ?? 760), ...reveal(80) }),
      ...(head.lede ? [text(head.lede, T.lede, tone === 'dark' ? JA.onDark : JA.body, { ...align, ...maxw(640), ...reveal(160) })] : []),
    ], 18, { flex_align_items: center ? 'center' : 'flex-start', ...options })
  }

  /** Ícone num quadrado: preto com ícone dourado no claro, dourado a 12% no escuro. */
  const badge = (icon: string, tone: Tone = 'light', options: { size?: number } = {}) => widget('icon', {
    selected_icon: fa(icon), view: 'stacked', shape: 'square',
    primary_color: tone === 'dark' ? 'rgba(207,155,58,0.12)' : JA.black, secondary_color: JA.gold,
    size: px(options.size ?? 20), icon_padding: px(14), border_radius: sides(10),
    align: 'left', ...FIXED, _element_width: 'auto', _css_classes: 'ja-badge',
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

  /** Cartão com borda fina: branco no claro, um tom acima do preto no escuro. */
  const card = (elements: ElementorNode[], tone: Tone = 'light', options: JsonRecord = {}) => col(elements, 14, {
    padding: sides(28), padding_mobile: sides(22),
    ...bg(tone === 'dark' ? JA.raised : JA.white), ...border(tone === 'dark' ? JA.lineDark : JA.line), border_radius: sides(L.radius.card),
    css_classes: 'ja-card',
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

export type JaBuilder = ReturnType<typeof createBuilder>
