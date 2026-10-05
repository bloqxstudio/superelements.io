import type { SectionNodeData } from '@/types/space'
import { FL, FL_EASE, FL_FONTS, FL_LAYOUT as L, FL_MARK, flAsset } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para a Fonseca & Lorenço
 * (prospecto). Todo container declara padding e gap, porque o Elementor põe
 * 10px e 20px quando o JSON não diz nada. Títulos em Archivo, texto em Public
 * Sans, um amarelo só: o degradê do selo como marca-texto e o âmbar nos botões.
 *
 * Movimento: nenhuma animação de entrada do Elementor. Os blocos que sobem ao
 * rolar levam a classe `fl-rise` e quem move é o GSAP (`story.ts`); sem script
 * a página já está pronta.
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

/** Classe dos blocos que sobem uma vez ao entrar na tela (GSAP, `story.ts`). */
export const RISE = 'fl-rise'
/** Trecho de título marcado com o degradê do selo. */
export const mark = (words: string) => `<mark class="fl-mark">${words}</mark>`

export interface TypeSpec {
  font?: keyof typeof FL_FONTS
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
  [`${group}_font_family`]: FL_FONTS[spec.font ?? 'text'],
  [`${group}_font_size`]: px(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: px(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: px(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line !== undefined ? { [`${group}_line_height`]: em(spec.line) } : {}),
  ...(spec.letter !== undefined ? { [`${group}_letter_spacing`]: em(spec.letter) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
})

/**
 * Escala do DESIGN.md §4. Títulos em Archivo 800, apertados; texto, rótulos,
 * menu e botões em Public Sans, a fonte de texto (a marca não tem papel de
 * rótulo, então aplicada por cima ela não muda nada).
 */
export const T = {
  hero: { font: 'title', size: 68, tablet: 54, mobile: 40, weight: 800, line: 1.02, letter: -0.025 },
  h2: { font: 'title', size: 48, tablet: 40, mobile: 32, weight: 800, line: 1.06, letter: -0.02 },
  statement: { font: 'title', size: 28, tablet: 25, mobile: 22, weight: 700, line: 1.18, letter: -0.01 },
  card: { font: 'title', size: 21, mobile: 19, weight: 700, line: 1.22, letter: -0.01 },
  year: { font: 'title', size: 40, tablet: 36, mobile: 32, weight: 800, line: 1, letter: -0.02 },
  step: { font: 'title', size: 15, weight: 800, line: 1, letter: 0.04 },
  lede: { size: 19, mobile: 17, line: 1.6 },
  body: { size: 17, mobile: 16, line: 1.65 },
  small: { size: 15, line: 1.6 },
  list: { size: 16, line: 1.6 },
  strong: { size: 16, weight: 600, line: 1.4 },
  nav: { size: 15, weight: 500, line: 1.2 },
  eyebrow: { size: 13, weight: 700, line: 1.4, letter: 0.14, transform: 'uppercase' },
  tag: { size: 12, weight: 700, line: 1.2, letter: 0.12, transform: 'uppercase' },
  button: { size: 16, weight: 700, line: 1.2, letter: 0 },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Link, foco, botão, cartão, marca-texto e parágrafos: vale para toda seção. */
const BASE_CSS = [
  'selector{overflow-x:clip;scroll-margin-top:72px}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p{margin:0 0 .85em}selector .elementor-widget-text-editor p:last-child{margin-bottom:0}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper{line-height:0}',
  'selector .elementor-button{min-height:52px;display:inline-flex;align-items:center;justify-content:center}',
  'selector .elementor-button-icon{display:inline-flex;align-items:center;line-height:1}selector .elementor-button-icon i{font-size:1.15em}',
  // marca-texto: o degradê do selo numa faixa baixa atrás das palavras; o texto marcado é sempre grafite
  `selector .fl-mark{--fl-mark:1;color:${FL.graphite};background:${FL_MARK} no-repeat 0 88%/calc(var(--fl-mark) * 100%) .5em;padding:0 .06em;margin:0 -.06em;-webkit-box-decoration-break:clone;box-decoration-break:clone}`,
  // no grafite a faixa ocupa a altura inteira: o texto marcado é grafite e não pode sobrar fora dela
  `selector.fl-on-dark .fl-mark,selector .fl-on-dark .fl-mark{background-size:calc(var(--fl-mark) * 100%) 100%;background-position:0 50%;padding:0 .12em;margin:0 .02em}`,
  // rótulo: barra âmbar na frente (âmbar não passa como texto pequeno no papel)
  `selector .fl-eyebrow .elementor-heading-title{display:inline-flex;align-items:center;gap:10px}selector .fl-eyebrow .elementor-heading-title::before{content:"";width:18px;height:8px;flex:none;background:${FL_MARK}}`,
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition-property:color,background-color,border-color,transform;transition-duration:180ms;transition-timing-function:${FL_EASE}}selector .elementor-button:active{transform:scale(.96)}}`,
  // cartão: só a borda muda com o mouse; nada essencial depende do hover
  `@media(prefers-reduced-motion:no-preference){selector .fl-card{transition:border-color 200ms ${FL_EASE}}}`,
  `@media(hover:hover) and (pointer:fine){selector .fl-card:hover{border-color:${FL.amber}}}`,
  `selector a:focus-visible,selector summary:focus-visible,selector button:focus-visible,selector .elementor-button:focus-visible{outline:3px solid ${FL.amber};outline-offset:3px}`,
  `selector.fl-on-light a:focus-visible,selector.fl-on-light summary:focus-visible,selector.fl-on-light .elementor-button:focus-visible{outline-color:${FL.graphite}}`,
].join('')

export type ButtonVariant = 'primary' | 'dark' | 'outline' | 'outlineLight'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  // grafite no âmbar (8,3:1); branco não passa
  primary: {
    background_color: FL.amber, button_text_color: FL.graphite,
    button_background_hover_color: FL.amberHover, hover_color: FL.graphite,
    ...border(FL.amber, sides(1)), button_hover_border_color: FL.amberHover,
  },
  // na faixa amarela: grafite com texto branco
  dark: {
    background_color: FL.graphite, button_text_color: FL.white,
    button_background_hover_color: FL.deep, hover_color: FL.white,
    ...border(FL.graphite, sides(1)), button_hover_border_color: FL.deep,
  },
  outline: {
    background_color: 'rgba(255,255,255,0)', button_text_color: FL.graphite,
    button_background_hover_color: FL.graphite, hover_color: FL.white,
    ...border(FL.graphite, sides(1)), button_hover_border_color: FL.graphite,
  },
  outlineLight: {
    background_color: 'rgba(255,255,255,0)', button_text_color: FL.white,
    button_background_hover_color: 'rgba(255,255,255,0)', hover_color: FL.amber,
    ...border('rgba(255,255,255,0.4)', sides(1)), button_hover_border_color: FL.amber,
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

  const heading = (title: string, spec: TypeSpec, color: string = FL.ink, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = FL.body, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(flAsset(path), alt), image_size: 'full', ...options })

  /** Botão de canto quase reto (4px); `icon` vai antes do texto (o WhatsApp, por exemplo). */
  const button = (label: string, url: string, variant: ButtonVariant = 'primary', options: JsonRecord & { icon?: string } = {}) => {
    const { icon, ...rest } = options
    return widget('button', {
      text: label, link: link(url), size: 'md',
      ...typography(T.button),
      text_padding: sides(16, 26),
      border_radius: sides(L.radius.button),
      ...BUTTON_COLORS[variant],
      ...(icon ? { selected_icon: fa(icon), icon_align: 'left', icon_indent: px(10) } : {}),
      ...rest,
    })
  }

  /** Rótulo em caixa alta: grafite com a barra do degradê no claro, âmbar no escuro. */
  const eyebrow = (label: string, tone: Tone = 'light', options: JsonRecord = {}) =>
    heading(label, T.eyebrow, tone === 'dark' ? FL.amber : FL.graphite, { _css_classes: 'fl-eyebrow', ...options })

  /** Cabeça de seção: rótulo, título (com marca-texto) e texto de apoio. */
  const sectionHead = (head: { label: string; title: string; lede?: string; tone?: Tone; align?: 'left' | 'center'; width?: number; ledeWidth?: number; tag?: string }, options: JsonRecord = {}) => {
    const tone = head.tone ?? 'light'
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      eyebrow(head.label, tone, align),
      heading(head.title, T.h2, tone === 'dark' ? FL.white : FL.ink, { header_size: head.tag ?? 'h2', ...align, ...maxw(head.width ?? 760), _css_classes: 'fl-title' }),
      ...(head.lede ? [text(head.lede, T.lede, tone === 'dark' ? FL.onDark : FL.body, { ...align, ...maxw(head.ledeWidth ?? 620) })] : []),
    ], 18, { flex_align_items: center ? 'center' : 'flex-start', css_classes: RISE, ...options })
  }

  /** Ícone num quadrado: grafite com ícone âmbar no claro, âmbar a 14% no escuro. */
  const badge = (icon: string, tone: Tone = 'light', options: { size?: number } = {}) => widget('icon', {
    selected_icon: fa(icon), view: 'stacked', shape: 'square',
    primary_color: tone === 'dark' ? 'rgba(255,180,4,0.14)' : FL.graphite, secondary_color: FL.amber,
    size: px(options.size ?? 18), icon_padding: px(12), border_radius: sides(6),
    align: 'left', ...FIXED, _element_width: 'auto', _css_classes: 'fl-badge',
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

  /** Cartão com borda fina: branco no claro, um tom acima do grafite no escuro. */
  const card = (elements: ElementorNode[], tone: Tone = 'light', options: JsonRecord = {}) => col(elements, 12, {
    padding: sides(28), padding_mobile: sides(22),
    ...bg(tone === 'dark' ? FL.raised : FL.white), ...border(tone === 'dark' ? FL.lineDark : FL.line), border_radius: sides(L.radius.card),
    css_classes: `fl-card ${RISE}`,
    ...options,
  })

  /** Container raiz de uma seção: fundo de ponta a ponta, conteúdo em 1160px. */
  const root = (elements: ElementorNode[], options: { background: string; id?: string; tag?: string; css?: string; space?: number; pad?: [number, number, number] | false; tone?: Tone; settings?: JsonRecord }) => {
    const [desktop, tablet, mobile] = options.pad === false ? [0, 0, 0] : options.pad ?? [L.section.desktop, L.section.tablet, L.section.mobile]
    const node = container({
      content_width: 'boxed', boxed_width: px(L.content),
      flex_direction: 'column', flex_gap: gap(options.space ?? 0),
      padding: sides(desktop, L.gutter.desktop, desktop, L.gutter.desktop),
      padding_tablet: sides(tablet, L.gutter.tablet, tablet, L.gutter.tablet),
      padding_mobile: sides(mobile, L.gutter.mobile, mobile, L.gutter.mobile),
      ...bg(options.background),
      html_tag: options.tag ?? 'section',
      css_classes: options.tone === 'dark' ? 'fl-on-dark' : 'fl-on-light',
      ...(options.id ? { _element_id: options.id } : {}),
      ...options.settings,
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { uid, container, widget, col, row, grid, heading, text, image, button, eyebrow, sectionHead, badge, list, card, root, section }
}

export type FlBuilder = ReturnType<typeof createBuilder>
