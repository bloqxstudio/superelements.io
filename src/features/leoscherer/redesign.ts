import type { SectionNodeData } from '@/types/space'

/**
 * A nova versão do site da LS (brands/leo-scherer/DESIGN.md): a mesma marca do
 * site atual (logo LS branco, palco preto com a luz azul-marinho, Helvetica,
 * vermelho pontual), organizada como uma vitrine editorial. Construtor de
 * árvores nativas do Elementor: todo container declara padding e gap, porque o
 * Elementor põe 10px e 20px quando o JSON não diz nada.
 */

export const LS2 = {
  black: '#000000',
  raised: '#101010',
  tile: '#141416',
  /** A luz do palco: radial do hero e da história no site atual. */
  navy: '#151C25',
  /** A luz da faixa de simulação no site atual. */
  deep: '#0B1B33',
  line: 'rgba(255,255,255,0.1)',
  lineStrong: 'rgba(255,255,255,0.32)',
  white: '#FFFFFF',
  /** Fundo das fotos de produto (as fotos têm fundo branco: a imagem multiplica). */
  mist: '#F5F5F7',
  lineLight: '#E3E3E6',
  /** Texto de apoio no escuro (10,6:1 no preto). */
  soft: '#B6B6B6',
  /** Rótulos e preços pequenos no escuro (6,0:1 no preto). */
  gray: '#8E8E93',
  /** Texto de apoio no claro (5,3:1 no branco). */
  body: '#6D6D6D',
  ink: '#111111',
  /** O vermelho do site: só ponto, rótulo pequeno no escuro e o "Simule". Nunca texto no claro. */
  red: '#FF0000',
} as const

export const LS2_FONT = 'Helvetica'

export const LS2_LAYOUT = {
  content: 1200,
  gutter: { desktop: 32, tablet: 24, mobile: 16 },
  section: { desktop: 120, tablet: 88, mobile: 64 },
  radius: { tile: 16, card: 20, frame: 24 },
} as const

export const LS2_EASE = 'cubic-bezier(.2,.7,.2,1)'

const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost'
export const lsImg = (path: string) => (path.startsWith('http') ? path : `${ORIGIN}/brands/leo-scherer/${path.replace(/^\/+/, '')}`)

export const SITE = 'https://leoscherer.com.br'
export const LS_LINKS = {
  instagram: 'https://instagram.com/leooscherer',
  tuaCase: 'https://tuacase.com.br',
  video: 'https://www.youtube.com/watch?v=B66M1DZZGtM',
  // Popups do Elementor do site: abrem quando a página está publicada no WordPress da LS
  simulator: '#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3DeyJpZCI6IjI0MzIiLCJ0b2dnbGUiOnRydWV9',
  simulatorHeader: '#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3DeyJpZCI6IjkwNjQiLCJ0b2dnbGUiOnRydWV9',
  newsletter: '#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3DeyJpZCI6IjM5OTMiLCJ0b2dnbGUiOnRydWV9',
  search: `${SITE}/?s=&post_type=product`,
} as const

export const category = (slug: string) => `${SITE}/categoria-produto/${slug}/`
export const product = (slug: string) => `${SITE}/produto/${slug}/`

export const NAV: Array<[string, string]> = [
  ['iPhone', category('novos-iphone')], ['Seminovos', category('seminovos')], ['Watch', category('novos-watch')],
  ['Mac', category('novos-mac')], ['AirPods', category('novos-airpods')], ['iPad', category('novos-ipad')],
  ['JBL', category('produtos-jbl')], ['Acessórios', category('acessorios')],
]

type JsonRecord = Record<string, unknown>

export interface ElementorNode {
  id: string
  elType: 'container' | 'widget'
  isInner: boolean
  widgetType?: string
  settings: JsonRecord
  elements: ElementorNode[]
}

export type Tone = 'dark' | 'light'

export const px = (size: number) => ({ unit: 'px', size, sizes: [] })
export const pct = (size: number) => ({ unit: '%', size, sizes: [] })
export const em = (size: number) => ({ unit: 'em', size, sizes: [] })
export const fluid = (value: string) => ({ unit: 'custom', size: value, sizes: [] })
export const gap = (row: number, column = row) => ({ unit: 'px', size: row, row: String(row), column: String(column), isLinked: row === column })
export const sides = (top: number, right = top, bottom = top, left = right) => ({
  unit: 'px', top: String(top), right: String(right), bottom: String(bottom), left: String(left),
  isLinked: top === right && right === bottom && bottom === left,
})
export const media = (url: string, alt = '') => ({ id: '', url, alt, source: 'url', size: '' })
export const link = (url: string, external = url.startsWith('http')) => ({ url, is_external: external ? 'on' : '', nofollow: '', custom_attributes: '' })
export const fa = (value: string) => ({ value, library: value.startsWith('fab') ? 'fa-brands' : value.startsWith('far') ? 'fa-regular' : 'fa-solid' })
export const bg = (color: string) => ({ background_background: 'classic', background_color: color })
export const border = (color: string, width = sides(1)) => ({ border_border: 'solid', border_width: width, border_color: color })

export const FIXED = { _flex_size: 'none' } as const
export const FILL = { _flex_size: 'custom', _flex_grow: 1, _flex_shrink: 1 } as const
export const AUTO = { _element_width: 'auto' } as const
/** Medida de leitura: nunca passa da coluna. */
export const maxw = (width: number) => ({ _element_width: 'initial', _element_custom_width: fluid(`min(100%, ${width}px)`) })

export interface TypeSpec { size: number; tablet?: number; mobile?: number; weight?: number; line?: number; letter?: number; transform?: string }

export const typography = (spec: TypeSpec, group = 'typography'): JsonRecord => ({
  [`${group}_typography`]: 'custom',
  [`${group}_font_family`]: LS2_FONT,
  [`${group}_font_size`]: px(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: px(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: px(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line !== undefined ? { [`${group}_line_height`]: em(spec.line) } : {}),
  ...(spec.letter !== undefined ? { [`${group}_letter_spacing`]: em(spec.letter) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
})

/** Escala do DESIGN.md. Helvetica em tudo; títulos fechados como os da Apple. */
export const T = {
  hero: { size: 112, tablet: 84, mobile: 56, weight: 700, line: 0.92, letter: -0.045 },
  heroSub: { size: 44, tablet: 36, mobile: 28, weight: 500, line: 1.05, letter: -0.03 },
  h2: { size: 64, tablet: 50, mobile: 38, weight: 700, line: 1, letter: -0.04 },
  h3: { size: 34, tablet: 30, mobile: 28, weight: 700, line: 1.05, letter: -0.03 },
  card: { size: 22, mobile: 20, weight: 600, line: 1.15, letter: -0.02 },
  stat: { size: 72, tablet: 60, mobile: 52, weight: 700, line: 0.95, letter: -0.045 },
  lede: { size: 20, tablet: 19, mobile: 17, line: 1.5, letter: -0.01 },
  body: { size: 16, line: 1.6 },
  small: { size: 14, line: 1.5 },
  product: { size: 15, weight: 500, line: 1.35, letter: -0.01 },
  price: { size: 15, weight: 600, line: 1.3 },
  label: { size: 12, weight: 600, line: 1.3, letter: 0.14, transform: 'uppercase' },
  nav: { size: 13, weight: 500, line: 1.2 },
  button: { size: 14, weight: 600, line: 1.2, letter: -0.005 },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Bloco que o GSAP faz subir ao entrar (story.ts). Nada de entrada do Elementor no que o GSAP move. */
export const RISE = 'ls-rise'

const BASE_CSS = [
  'selector{overflow:clip;scroll-margin-top:72px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p{margin:0 0 .75em}selector .elementor-widget-text-editor p:last-child{margin-bottom:0}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper,selector .elementor-widget-icon .elementor-icon-wrapper{line-height:0}',
  'selector .elementor-widget-image img{display:block}',
  'selector .ls-auto{width:auto!important;max-width:100%}',
  // o Elementor anima o transform dos containers (0,4s): aqui quem move é o GSAP
  'selector,selector .e-con{transition-property:background,border,box-shadow}',
  // no celular o título corre solto, sem a quebra de frase do desktop
  '@media(max-width:767px){selector h2.elementor-heading-title br{display:none}}',
  'selector .elementor-button{min-height:46px;display:inline-flex;align-items:center;justify-content:center}',
  'selector .elementor-button-icon{display:inline-flex;align-items:center;line-height:1}selector .elementor-button-icon i{font-size:.9em}',
  // o ponto vermelho do site, antes do "Simule"
  `selector .ls-dot .elementor-button-text::before{content:"";display:inline-block;width:7px;height:7px;margin-right:9px;border-radius:50%;background:${LS2.red};vertical-align:.12em}`,
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition-property:color,background-color,border-color,opacity,transform;transition-duration:180ms;transition-timing-function:${LS2_EASE}}selector .elementor-button:active{transform:scale(.96)}}`,
  '@media(prefers-reduced-motion:reduce){selector *{transition:none!important;animation:none!important}}',
  `selector a:focus-visible,selector summary:focus-visible,selector button:focus-visible,selector .elementor-button:focus-visible,selector input:focus-visible{outline:2px solid ${LS2.white};outline-offset:3px;box-shadow:0 0 0 5px ${LS2.black}}`,
].join('')

export type ButtonVariant = 'light' | 'ghost' | 'dark' | 'outline'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  // cheio em branco, no escuro: a ação principal
  light: { background_color: LS2.white, button_text_color: LS2.black, button_background_hover_color: '#E8E8ED', hover_color: LS2.black, ...border(LS2.white), button_hover_border_color: '#E8E8ED' },
  // contorno no escuro (o botão do site atual)
  ghost: { background_color: 'rgba(255,255,255,0)', button_text_color: LS2.white, button_background_hover_color: LS2.white, hover_color: LS2.black, ...border(LS2.lineStrong), button_hover_border_color: LS2.white },
  // cheio em preto, no claro
  dark: { background_color: LS2.black, button_text_color: LS2.white, button_background_hover_color: '#2A2A2D', hover_color: LS2.white, ...border(LS2.black), button_hover_border_color: '#2A2A2D' },
  // contorno no claro
  outline: { background_color: 'rgba(255,255,255,0)', button_text_color: LS2.ink, button_background_hover_color: LS2.black, hover_color: LS2.white, ...border('rgba(0,0,0,0.28)'), button_hover_border_color: LS2.black },
}

export const createBuilder = (prefix: string) => {
  let sequence = 0
  const uid = () => `${prefix}${(++sequence).toString(36).padStart(7 - prefix.length, '0')}`

  /** `inline`: largura do conteúdo (o Elementor põe 100% em todo container). */
  const container = (settings: JsonRecord & { inline?: boolean }, elements: ElementorNode[] = []): ElementorNode => {
    const { inline, ...rest } = settings
    const classes = [rest.css_classes, inline ? 'ls-auto' : ''].filter(Boolean).join(' ')
    return {
      id: uid(), elType: 'container', isInner: true,
      settings: { content_width: 'full', padding: sides(0), flex_gap: gap(0), ...(inline ? { _flex_size: 'none' } : {}), ...rest, ...(classes ? { css_classes: classes } : {}) },
      elements,
    }
  }
  const widget = (widgetType: string, settings: JsonRecord): ElementorNode => ({ id: uid(), elType: 'widget', isInner: false, widgetType, settings, elements: [] })
  const col = (elements: ElementorNode[], space = 0, settings: JsonRecord = {}) => container({ flex_direction: 'column', flex_gap: gap(space), ...settings }, elements)
  const row = (elements: ElementorNode[], space = 0, settings: JsonRecord = {}) =>
    container({ flex_direction: 'row', flex_wrap: 'nowrap', flex_align_items: 'center', flex_gap: gap(space), ...settings }, elements)
  const grid = (elements: ElementorNode[], columns: string, space: number | [number, number] = 0, settings: JsonRecord = {}, responsive: { tablet?: string; mobile?: string } = {}) =>
    container({
      container_type: 'grid', grid_columns_grid: fluid(columns), grid_columns_grid_tablet: fluid(responsive.tablet ?? columns), grid_columns_grid_mobile: fluid(responsive.mobile ?? '1fr'),
      grid_rows_grid: fluid('auto'), grid_gaps: Array.isArray(space) ? gap(space[0], space[1]) : gap(space), ...settings,
    }, elements)

  // espaço antes do <br>: no celular a quebra sai e as palavras não podem colar
  const heading = (title: string, spec: TypeSpec, color: string = LS2.white, options: JsonRecord = {}) =>
    widget('heading', { title: title.replace(/\s*<br>/g, ' <br>'), header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = LS2.soft, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) => widget('image', { image: media(lsImg(path), alt), image_size: 'full', ...options })

  const button = (label: string, url: string, variant: ButtonVariant = 'light', options: JsonRecord & { icon?: string; dot?: boolean } = {}) => {
    const { icon, dot, _css_classes, ...rest } = options
    const classes = [_css_classes, dot ? 'ls-dot' : ''].filter(Boolean).join(' ')
    return widget('button', {
      text: label, link: link(url), size: 'md', ...typography(T.button), text_padding: sides(14, 24), border_radius: sides(999),
      ...BUTTON_COLORS[variant],
      ...(icon ? { selected_icon: fa(icon), icon_align: 'right', icon_indent: px(10) } : {}),
      ...rest,
      ...(classes ? { _css_classes: classes } : {}),
    })
  }

  /** Link de texto com seta (o "Ver modelos" do site). */
  const more = (label: string, url: string, color: string = LS2.white, options: JsonRecord = {}) =>
    heading(`${label} <span class="ls-arrow" aria-hidden="true">→</span>`, tweak(T.button, { size: 15 }), color, { link: link(url), ...AUTO, _css_classes: 'ls-more', ...options })

  /** Rótulo pequeno em caixa alta (cinza no escuro; o ponto vermelho é opcional). */
  const label = (value: string, tone: Tone = 'dark', options: JsonRecord & { red?: boolean } = {}) => {
    const { red, ...rest } = options
    return heading(value, T.label, red ? LS2.red : tone === 'dark' ? LS2.gray : LS2.body, rest)
  }

  /** Cabeça de seção: rótulo, título com uma frase por linha e o texto de apoio. */
  const sectionHead = (head: { label?: string; title: string; lede?: string; tone?: Tone; align?: 'left' | 'center'; width?: number; ledeWidth?: number; red?: boolean }, options: JsonRecord = {}) => {
    const tone = head.tone ?? 'dark'
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      ...(head.label ? [label(head.label, tone, { ...align, red: head.red, _css_classes: RISE })] : []),
      heading(head.title, T.h2, tone === 'dark' ? LS2.white : LS2.ink, { header_size: 'h2', ...align, ...maxw(head.width ?? 900), _css_classes: RISE }),
      ...(head.lede ? [text(head.lede, T.lede, tone === 'dark' ? LS2.soft : LS2.body, { ...align, ...maxw(head.ledeWidth ?? 600), _css_classes: RISE })] : []),
    ], 18, { flex_align_items: center ? 'center' : 'flex-start', ...options })
  }

  /** Container raiz de uma seção: fundo de ponta a ponta, conteúdo em 1200px. */
  const root = (elements: ElementorNode[], options: { background: string; id?: string; tag?: string; css?: string; space?: number; pad?: [number, number, number] | false; classes?: string; settings?: JsonRecord }) => {
    const [desktop, tablet, mobile] = options.pad === false ? [0, 0, 0] : options.pad ?? [LS2_LAYOUT.section.desktop, LS2_LAYOUT.section.tablet, LS2_LAYOUT.section.mobile]
    const g = LS2_LAYOUT.gutter
    const node = container({
      content_width: 'boxed', boxed_width: px(LS2_LAYOUT.content), flex_direction: 'column', flex_gap: gap(options.space ?? 0),
      padding: sides(desktop, g.desktop, desktop, g.desktop), padding_tablet: sides(tablet, g.tablet, tablet, g.tablet), padding_mobile: sides(mobile, g.mobile, mobile, g.mobile),
      ...bg(options.background), html_tag: options.tag ?? 'section',
      ...(options.id ? { _element_id: options.id } : {}), ...(options.classes ? { css_classes: options.classes } : {}),
      ...options.settings, custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  /** Widget HTML só com comportamento (o script de movimento). */
  const behavior = (html: string) => widget('html', { html, _css_classes: 'ls-behavior' })

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { uid, container, widget, col, row, grid, heading, text, image, button, more, label, sectionHead, root, behavior, section }
}

export type Ls2Builder = ReturnType<typeof createBuilder>
