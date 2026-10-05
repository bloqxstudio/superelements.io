import type { SectionNodeData } from '@/types/space'
import { ST, ST_EASE, ST_FONTS, ST_LAYOUT as L, ST_LOGO, ST_NAME, stAsset } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para a Stemmer Advogados (partiu
 * do padrão da Júnior Automáticos e da Cerveira Braggio). Todo container
 * declara padding e gap, porque o Elementor põe 10px e 20px quando o JSON não
 * diz nada. Títulos em Encode Sans Expanded (a letra larga do "STEMMER" do
 * logo e da fachada); texto, rótulos e botões em Sora (a fonte do site atual).
 *
 * Para a marca aplicada por cima não mudar nada: toda cor dos settings está em
 * `ST` (e no front matter do DESIGN.md), títulos acima de 16px usam a fonte de
 * título, rótulos de até 16px e botões usam a fonte de texto, e os botões têm
 * o canto da marca.
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
export const pct = (size: number) => ({ unit: '%', size, sizes: [] })
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
export const radius = (size: number) => ({ border_radius: sides(size) })

/** Item flex que não cresce nem encolhe. */
export const FIXED = { _flex_size: 'none' } as const
/** Item flex que ocupa o resto da linha e pode encolher. */
export const FILL = { _flex_size: 'custom', _flex_grow: 1, _flex_shrink: 1 } as const
/** Largura automática (o widget do tamanho do conteúdo). */
export const AUTO = { _element_width: 'auto' } as const
/** Medida de leitura: nunca passa da coluna. */
export const maxw = (width: number) => ({ _element_width: 'initial', _element_custom_width: fluid(`min(100%, ${width}px)`) })

export interface TypeSpec {
  font?: keyof typeof ST_FONTS
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
  [`${group}_font_family`]: ST_FONTS[spec.font ?? 'text'],
  [`${group}_font_size`]: px(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: px(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: px(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line !== undefined ? { [`${group}_line_height`]: em(spec.line) } : {}),
  ...(spec.letter !== undefined ? { [`${group}_letter_spacing`]: em(spec.letter) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
  ...(spec.style ? { [`${group}_font_style`]: spec.style } : {}),
})

/** Escala do DESIGN.md §4. */
export const T = {
  hero: { font: 'title', size: 58, tablet: 46, mobile: 31, weight: 600, line: 1.06, letter: -0.025 },
  h2: { font: 'title', size: 40, tablet: 34, mobile: 26, weight: 600, line: 1.12, letter: -0.02 },
  h3: { font: 'title', size: 22, tablet: 21, mobile: 19, weight: 600, line: 1.25, letter: -0.01 },
  /** situação na primeira pessoa, nas linhas do cartão */
  situation: { font: 'title', size: 18, tablet: 18, mobile: 17, weight: 600, line: 1.35, letter: -0.01 },
  /** número grande (1996, 195) */
  numeral: { font: 'title', size: 44, tablet: 40, mobile: 34, weight: 600, line: 1, letter: -0.02 },
  lede: { size: 18, tablet: 17, mobile: 16, line: 1.65 },
  body: { size: 16, mobile: 15, line: 1.7 },
  small: { size: 14, line: 1.6 },
  list: { size: 15, line: 1.55 },
  strong: { size: 15, weight: 600, line: 1.4 },
  nav: { size: 14, weight: 500, line: 1.2 },
  /** rótulo: caixa alta espaçada, como os campos impressos de um cartão de ponto */
  eyebrow: { size: 12, weight: 600, line: 1.4, letter: 0.16, transform: 'uppercase' },
  field: { size: 11, weight: 600, line: 1.3, letter: 0.14, transform: 'uppercase' },
  button: { size: 15, weight: 600, line: 1.2 },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Bloco que sobe uma vez ao entrar na tela (story.ts). Nunca junto com animação de entrada do Elementor. */
export const RISE = 'st-rise'
/** Peças da abertura que entram em sequência ao abrir a página (story.ts). */
export const INTRO = 'st-intro'
/** Classe extra no `_css_classes` de um widget ou no `css_classes` de um container. */
export const cls = (...names: string[]) => names.filter(Boolean).join(' ')

/** Link, foco, botão, rótulo, quadros e parágrafos: vale para toda seção da Stemmer. */
const BASE_CSS = [
  'selector{overflow-x:clip;scroll-margin-top:72px}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p{margin:0 0 .85em}selector .elementor-widget-text-editor p:last-child{margin-bottom:0}',
  'selector .elementor-widget-text-editor a{text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  'selector p.elementor-heading-title{text-wrap:pretty}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper{line-height:0}',
  'selector .elementor-button{min-height:50px;display:inline-flex;align-items:center;justify-content:center}',
  'selector .elementor-button-content-wrapper{align-items:center}',
  'selector .elementor-button-icon{display:inline-flex;align-items:center;line-height:1}selector .elementor-button-icon i{font-size:1.15em}',
  // rótulo: um quadro vazio do cartão na frente (marcado de verde)
  `selector .st-eyebrow .elementor-heading-title{display:inline-flex;align-items:center;gap:10px}selector .st-eyebrow .elementor-heading-title::before{content:"";width:9px;height:9px;flex:none;border:1.5px solid currentColor;background:linear-gradient(currentColor,currentColor) center/5px 5px no-repeat}`,
  'selector .st-num .elementor-heading-title,selector .st-field .elementor-heading-title{font-variant-numeric:tabular-nums}',
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition-property:color,background-color,border-color;transition-duration:180ms;transition-timing-function:${ST_EASE}}}`,
  // containers: a transição de fundo e borda do Elementor não pode pegar o transform do GSAP
  'selector .e-con{transition-property:background,border,box-shadow}',
  // o que o GSAP move não tem transição própria (a do Elementor deixaria o movimento arrastado)
  'selector .st-rise,selector .st-intro,selector .st-punch,selector .st-row,selector .st-photo{transition:none!important}',
  '@media(prefers-reduced-motion:reduce){selector *{transition:none!important}}',
  `selector a:focus-visible,selector summary:focus-visible,selector button:focus-visible,selector .elementor-button:focus-visible,selector input:focus-visible,selector textarea:focus-visible,selector select:focus-visible{outline:2px solid ${ST.green};outline-offset:3px}`,
  `selector.st-dark a:focus-visible,selector.st-dark summary:focus-visible,selector.st-dark .elementor-button:focus-visible{outline-color:${ST.greenLight}}`,
].join('')

export type ButtonVariant = 'primary' | 'dark' | 'outline' | 'outlineLight' | 'light'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  // verde-registro com branco (6,5:1); com o mouse, o verde mais fundo
  primary: {
    background_color: ST.green, button_text_color: ST.paper,
    button_background_hover_color: ST.greenDeep, hover_color: ST.paper,
    ...border(ST.green, sides(1)), button_hover_border_color: ST.greenDeep,
  },
  // preto do logo com branco; com o mouse, o verde
  dark: {
    background_color: ST.ink, button_text_color: ST.paper,
    button_background_hover_color: ST.green, hover_color: ST.paper,
    ...border(ST.ink, sides(1)), button_hover_border_color: ST.green,
  },
  outline: {
    background_color: ST.clear, button_text_color: ST.ink,
    button_background_hover_color: ST.ink, hover_color: ST.paper,
    ...border(ST.ink, sides(1)), button_hover_border_color: ST.ink,
  },
  outlineLight: {
    background_color: ST.clear, button_text_color: ST.paper,
    button_background_hover_color: ST.paper, hover_color: ST.ink,
    ...border(ST.onDarkMuted, sides(1)), button_hover_border_color: ST.paper,
  },
  light: {
    background_color: ST.paper, button_text_color: ST.ink,
    button_background_hover_color: ST.card, hover_color: ST.ink,
    ...border(ST.paper, sides(1)), button_hover_border_color: ST.card,
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

  const heading = (title: string, spec: TypeSpec, color: string = ST.ink, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = ST.body, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(stAsset(path), alt), image_size: 'full', ...options })
  /** Widget HTML só com comportamento (script), nunca com conteúdo. */
  const behavior = (html: string) => widget('html', { html, _css_classes: 'st-behavior' })

  /** Botão de canto quase reto; `icon` vai antes do texto (o WhatsApp, por exemplo); `id` vai no próprio link. */
  const button = (label: string, url: string, variant: ButtonVariant = 'primary', options: JsonRecord & { icon?: string; id?: string } = {}) => {
    const { icon, id, ...rest } = options
    return widget('button', {
      text: label, link: link(url), size: 'md',
      ...typography(T.button),
      text_padding: sides(16, 24),
      border_radius: sides(L.radius.button),
      ...BUTTON_COLORS[variant],
      ...(icon ? { selected_icon: fa(icon), icon_align: 'left', icon_indent: px(10) } : {}),
      ...(id ? { button_css_id: id } : {}),
      ...rest,
    })
  }

  /** Rótulo em caixa alta com o quadro do cartão na frente: verde no claro, verde claro no escuro. */
  const eyebrow = (label: string, tone: Tone = 'light', options: JsonRecord = {}) => {
    const { _css_classes: extra, ...rest } = options as JsonRecord & { _css_classes?: string }
    return heading(label, T.eyebrow, tone === 'dark' ? ST.greenLight : ST.green, { _css_classes: cls('st-eyebrow', extra ?? ''), ...rest })
  }

  /** Cabeça de seção: rótulo, título e texto de apoio. */
  const sectionHead = (head: { label: string; title: string; lede?: string; tone?: Tone; align?: 'left' | 'center'; width?: number; ledeWidth?: number; tag?: string }, options: JsonRecord = {}) => {
    const tone = head.tone ?? 'light'
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      eyebrow(head.label, tone, align),
      heading(head.title, T.h2, tone === 'dark' ? ST.paper : ST.ink, { header_size: head.tag ?? 'h2', ...align, ...maxw(head.width ?? 780) }),
      ...(head.lede ? [text(head.lede, T.lede, tone === 'dark' ? ST.onDark : ST.body, { ...align, ...maxw(head.ledeWidth ?? 620) })] : []),
    ], 18, { flex_align_items: center ? 'center' : 'flex-start', css_classes: RISE, ...options })
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

  /**
   * Quadro numerado do cartão de ponto: o número dentro de um quadrado. Marcado
   * (`st-punched`), o quadro fica verde com o número branco: é o estado final
   * que o CSS mostra sem script; o story.ts só arma o vazio e marca na rolagem.
   */
  const box = (label: string, tone: Tone = 'light', options: JsonRecord = {}) => {
    const { _css_classes: extra, ...rest } = options as JsonRecord & { _css_classes?: string }
    return heading(label, T.field, tone === 'dark' ? ST.greenLight : ST.green, { ...FIXED, ...AUTO, _css_classes: cls('st-box', 'st-num', tone === 'dark' ? 'st-box-dark' : '', extra ?? ''), ...rest })
  }

  /** Logo completo com largura explícita (a marca reconhece o arquivo e mantém o tamanho). */
  const logo = (width: number, ink: 'white' | 'black' = 'white', options: JsonRecord = {}) => image(ink === 'white' ? ST_LOGO.white : ST_LOGO.black, ST_NAME, {
    width: px(width), space: px(width), ...FIXED, ...AUTO,
    custom_css: `selector img{display:block;width:100%;height:auto;aspect-ratio:${ST_LOGO.ratio.toFixed(4)}}`,
    ...options,
  })

  /** Container raiz de uma seção: fundo de ponta a ponta, conteúdo em 1200px. */
  const root = (elements: ElementorNode[], options: { background: string; id?: string; tag?: string; css?: string; space?: number; pad?: [number, number, number] | false; dark?: boolean; settings?: JsonRecord }) => {
    const [desktop, tablet, mobile] = options.pad === false ? [0, 0, 0] : options.pad ?? [L.section.desktop, L.section.tablet, L.section.mobile]
    const extra = (options.settings?.css_classes as string | undefined) ?? ''
    const node = container({
      content_width: 'boxed', boxed_width: px(L.content),
      flex_direction: 'column', flex_gap: gap(options.space ?? 0),
      padding: sides(desktop, L.gutter.desktop, desktop, L.gutter.desktop),
      padding_tablet: sides(tablet, L.gutter.tablet, tablet, L.gutter.tablet),
      padding_mobile: sides(mobile, L.gutter.mobile, mobile, L.gutter.mobile),
      ...(options.background === 'transparent' ? {} : bg(options.background)),
      html_tag: options.tag ?? 'section',
      ...(options.id ? { _element_id: options.id } : {}),
      ...options.settings,
      css_classes: cls(options.dark ? 'st-dark' : '', extra),
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { uid, container, widget, col, row, grid, heading, text, image, behavior, button, eyebrow, sectionHead, list, box, logo, root, section }
}

export type StBuilder = ReturnType<typeof createBuilder>

/**
 * CSS do quadro numerado (`box()`): quadrado de 30px com o número no meio. O
 * estado marcado é o final; `st-armed` (posto pelo story.ts) deixa vazio até
 * a linha entrar na tela e ganhar `is-punched`.
 */
export const BOX_CSS = [
  `selector .st-box .elementor-heading-title{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border:1.5px solid ${ST.green};background:${ST.green};color:${ST.paper}!important;letter-spacing:.04em}`,
  `selector .st-box-dark .elementor-heading-title{border-color:${ST.greenLight};background:${ST.greenLight};color:${ST.ink}!important}`,
  `html.st-armed selector .st-row:not(.is-punched) .st-box .elementor-heading-title{background:transparent;color:${ST.green}!important}`,
  `html.st-armed selector .st-row:not(.is-punched) .st-box-dark .elementor-heading-title{background:transparent;color:${ST.greenLight}!important}`,
  '@media(prefers-reduced-motion:no-preference){html.st-armed selector .st-box .elementor-heading-title{transition:background-color 220ms ease,color 220ms ease}}',
].join('')

/** Pauta do cartão de ponto: linhas finas horizontais, só textura, sempre fraca. */
export const ruledTexture = (color = 'rgba(20,108,67,.10)', step = 32) =>
  `background-image:repeating-linear-gradient(180deg,transparent 0 ${step - 1}px,${color} ${step - 1}px ${step}px)`

/** Navegação da Home (âncoras). */
export const NAV: Array<[string, string]> = [
  ['Situações', '#situacoes'], ['Primeiro contato', '#primeiro-contato'], ['Equipe', '#equipe'], ['Onde fica', '#onde-fica'], ['Dúvidas', '#duvidas'],
]

export const DESK = '(min-width:1025px)'
export const MOBILE = '(max-width:1024px)'
export const PHONE = '(max-width:767px)'
