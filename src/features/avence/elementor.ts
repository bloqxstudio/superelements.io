import type { SectionNodeData } from '@/types/space'
import { AV, AV_EASE, AV_FONTS, AV_LAYOUT as L, AV_LOGO, AV_NAME, avAsset } from './tokens'
import { arrowRightMask, arrowOutMask } from './symbol'

/**
 * Construtor de árvores nativas do Elementor para o Avence Studio (partiu do
 * padrão da Stemmer e da Júnior Automáticos). Todo container declara padding
 * e gap, porque o Elementor põe 10px e 20px quando o JSON não diz nada. Uma
 * família só, a Space Grotesk do site atual: títulos em 500, com a entrelinha
 * curta; texto em 400; rótulos e botões em 600, caixa alta espaçada, como os
 * botões do site atual.
 *
 * Para a marca aplicada por cima não mudar nada: toda cor dos settings está em
 * `AV` (e no front matter do DESIGN.md) e os botões têm o canto da marca (0).
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

/** Item flex que não cresce nem encolhe. */
export const FIXED = { _flex_size: 'none' } as const
/** Item flex que ocupa o resto da linha e pode encolher. */
export const FILL = { _flex_size: 'custom', _flex_grow: 1, _flex_shrink: 1 } as const
/** Largura automática (o widget do tamanho do conteúdo). */
export const AUTO = { _element_width: 'auto' } as const
/** Medida de leitura: nunca passa da coluna. */
export const maxw = (width: number) => ({ _element_width: 'initial', _element_custom_width: fluid(`min(100%, ${width}px)`) })

export interface TypeSpec {
  font?: keyof typeof AV_FONTS
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
  [`${group}_font_family`]: AV_FONTS[spec.font ?? 'text'],
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
  hero: { font: 'title', size: 100, tablet: 68, mobile: 46, weight: 500, line: 0.96, letter: -0.04 },
  h2: { font: 'title', size: 60, tablet: 46, mobile: 36, weight: 500, line: 1, letter: -0.03 },
  h3: { font: 'title', size: 28, tablet: 25, mobile: 22, weight: 500, line: 1.1, letter: -0.02 },
  /** número das etapas e das ofertas */
  numeral: { font: 'title', size: 56, tablet: 48, mobile: 40, weight: 400, line: 1, letter: -0.04 },
  lede: { size: 19, tablet: 18, mobile: 17, line: 1.55, letter: -0.005 },
  body: { size: 16, mobile: 15, line: 1.7 },
  small: { size: 14, line: 1.6 },
  list: { size: 15, line: 1.55 },
  strong: { size: 16, weight: 500, line: 1.45 },
  nav: { size: 14, weight: 500, line: 1.2 },
  /** rótulo: caixa alta espaçada, como "Soluções digitais" no cabeçalho do site atual */
  eyebrow: { size: 12, weight: 500, line: 1.4, letter: 0.14, transform: 'uppercase' },
  tag: { size: 11, weight: 500, line: 1.3, letter: 0.12, transform: 'uppercase' },
  /** botão: caixa alta espaçada, como "Solicitar um orçamento →" no site atual */
  button: { size: 12.5, weight: 600, line: 1.2, letter: 0.1, transform: 'uppercase' },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Bloco que sobe uma vez ao entrar na tela (story.ts). Nunca junto com animação de entrada do Elementor. */
export const RISE = 'av-rise'
/** Peças da abertura que entram em sequência ao abrir a página (story.ts). */
export const INTRO = 'av-intro'
/** Classe extra no `_css_classes` de um widget ou no `css_classes` de um container. */
export const cls = (...names: string[]) => names.filter(Boolean).join(' ')
/** Container do tamanho do conteúdo (`css_classes`). */
export const AUTOBOX = 'av-auto'

/** Link, foco, botão, rótulo e parágrafos: vale para toda seção do Avence. */
const BASE_CSS = [
  'selector{overflow-x:clip;scroll-margin-top:72px}',
  // container do tamanho do conteúdo (num container em linha, o Elementor daria 100%)
  'selector .av-auto{--width:auto;width:auto!important;max-width:100%;flex:0 0 auto}',
  // container que ocupa o resto da linha
  'selector .av-grow{--width:auto;width:auto!important;flex:1 1 0%;min-width:0}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p{margin:0 0 .85em}selector .elementor-widget-text-editor p:last-child{margin-bottom:0}',
  'selector .elementor-widget-text-editor a{text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  'selector p.elementor-heading-title{text-wrap:pretty}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper{line-height:0}',
  'selector .elementor-button{min-height:52px;display:inline-flex;align-items:center;justify-content:center}',
  'selector .elementor-button-content-wrapper{align-items:center}',
  'selector .elementor-button-icon{display:inline-flex;align-items:center;line-height:1}selector .elementor-button-icon i{font-size:1.1em}',
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button{transition-property:color,background-color,border-color,transform!important;transition-duration:180ms;transition-timing-function:${AV_EASE}}selector .elementor-button:active{transform:scale(.97)}}`,
  // a seta do botão avança um pouco com o mouse (a cor já muda sozinha)
  `@media(hover:hover) and (prefers-reduced-motion:no-preference){selector .av-go .elementor-button-icon{transition:transform 220ms ${AV_EASE}}selector .av-go .elementor-button:hover .elementor-button-icon{transform:translateX(4px)}}`,
  // rótulo: o ponto azul do símbolo na frente (azul claro na tinta)
  `selector .av-eyebrow .elementor-heading-title{display:inline-flex;align-items:center;gap:10px}selector .av-eyebrow .elementor-heading-title::before{content:"";width:7px;height:7px;flex:none;background:${AV.blue}}`,
  `selector .av-eyebrow-dark .elementor-heading-title::before{background:${AV.blueLight}}`,
  // a seta dos botões e ligações é a do símbolo ("→" e, para fora, "↗"), desenhada por máscara; o ícone do Font Awesome fica por baixo, para quem não tem CSS
  `selector .av-go .elementor-button-icon i,selector .av-go .elementor-button-icon svg{display:none}selector .av-go .elementor-button-icon::before{content:"";width:13px;height:13px;background:currentColor;-webkit-mask:${arrowRightMask} center/contain no-repeat;mask:${arrowRightMask} center/contain no-repeat}`,
  `selector .av-out .elementor-button-icon::before{width:11px;height:11px;-webkit-mask-image:${arrowOutMask};mask-image:${arrowOutMask}}`,
  `@media(hover:hover) and (prefers-reduced-motion:no-preference){selector .av-out .elementor-button:hover .elementor-button-icon{transform:translate(2px,-2px)}}`,
  'selector .av-num .elementor-heading-title{font-variant-numeric:tabular-nums}',
  // a serifada só nos destaques: a palavra marcada (itálico azul), a assinatura e os números grandes
  `selector .av-em,selector .av-serif .elementor-heading-title{font-family:"Instrument Serif",Georgia,serif;font-weight:400;letter-spacing:-.01em}selector .av-em{font-style:italic;font-size:1.1em;line-height:0;color:${AV.blue};padding-right:.04em}selector.av-dark .av-em{color:${AV.blueLight}}`,
  // a assinatura em texto: "avence" na serifada, o ponto azul e "studio" pequeno em caixa alta
  `selector .av-wm .elementor-heading-title{font-family:"Instrument Serif",Georgia,serif;font-weight:400;white-space:nowrap}selector .av-wm a{color:inherit}selector .av-wm .av-pt{display:inline-block;width:.15em;height:.15em;margin-left:.03em;background:${AV.blue}}selector.av-dark .av-wm .av-pt{background:${AV.blueLight}}selector .av-wm .av-studio{font-family:"Inter Tight",sans-serif;font-size:.34em;font-weight:500;letter-spacing:.26em;text-transform:uppercase;margin-left:.75em}`,
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition-property:color,background-color,border-color;transition-duration:180ms;transition-timing-function:${AV_EASE}}}`,
  // containers, inclusive a própria seção: a transição do Elementor (transform .4s) não pode pegar o transform do GSAP
  // nem o do ScrollTrigger ao soltar o pin (a seção deslizava no fim dos cases)
  'selector,selector .e-con{transition-property:background,border,box-shadow}',
  // o que o GSAP move não tem transição própria (a do Elementor deixaria o movimento arrastado)
  'selector .av-rise,selector .av-intro,selector .av-arrow,selector .av-frame,selector .av-frame-in,selector .av-ht{transition:none!important}',
  // meio-tom: camada de fundo que não pega clique; o resto da seção fica por cima
  'selector .av-ht{position:absolute!important;pointer-events:none;z-index:0;min-height:0;padding:0}',
  'selector>.e-con-inner>:not(.av-ht):not(.av-behavior):not(.av-glow-hero),selector>:not(.e-con-inner):not(.av-ht):not(.av-behavior):not(.av-glow-hero){position:relative;z-index:1}',
  '@media(prefers-reduced-motion:reduce){selector *{transition:none!important}}',
  `selector a:focus-visible,selector summary:focus-visible,selector button:focus-visible,selector .elementor-button:focus-visible,selector input:focus-visible,selector textarea:focus-visible,selector select:focus-visible{outline:2px solid ${AV.blue};outline-offset:3px}`,
  `selector.av-dark a:focus-visible,selector.av-dark summary:focus-visible,selector.av-dark .elementor-button:focus-visible{outline-color:${AV.blueLight}}`,
].join('')

export type ButtonVariant = 'primary' | 'dark' | 'outline' | 'outlineLight' | 'light'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  // azul-sinal com branco (7:1); com o mouse, o azul fundo
  primary: {
    background_color: AV.blue, button_text_color: AV.white,
    button_background_hover_color: AV.blueDeep, hover_color: AV.white,
    ...border(AV.blue, sides(1)), button_hover_border_color: AV.blueDeep,
  },
  // tinta com papel; com o mouse, o azul
  dark: {
    background_color: AV.ink, button_text_color: AV.paper,
    button_background_hover_color: AV.blue, hover_color: AV.white,
    ...border(AV.ink, sides(1)), button_hover_border_color: AV.blue,
  },
  outline: {
    background_color: AV.clear, button_text_color: AV.ink,
    button_background_hover_color: AV.ink, hover_color: AV.paper,
    ...border(AV.ink, sides(1)), button_hover_border_color: AV.ink,
  },
  outlineLight: {
    background_color: AV.clear, button_text_color: AV.paper,
    button_background_hover_color: AV.paper, hover_color: AV.ink,
    ...border(AV.onDarkMuted, sides(1)), button_hover_border_color: AV.paper,
  },
  light: {
    background_color: AV.paper, button_text_color: AV.ink,
    button_background_hover_color: AV.white, hover_color: AV.ink,
    ...border(AV.paper, sides(1)), button_hover_border_color: AV.white,
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

  const heading = (title: string, spec: TypeSpec, color: string = AV.ink, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = AV.body, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(avAsset(path), alt), image_size: 'full', ...options })
  /** Widget HTML só com comportamento (script), nunca com conteúdo. */
  const behavior = (html: string) => widget('html', { html, _css_classes: 'av-behavior' })

  /**
   * Botão de canto reto, em caixa alta espaçada. Sem `icon`, leva a seta à
   * direita (que avança com o mouse); com `icon` (o WhatsApp), o ícone vai antes.
   */
  const button = (label: string, url: string, variant: ButtonVariant = 'primary', options: JsonRecord & { icon?: string; id?: string; after?: boolean; out?: boolean } = {}) => {
    const { icon: given, id, after, out, _css_classes: extra, ...rest } = options as JsonRecord & { icon?: string; id?: string; after?: boolean; out?: boolean; _css_classes?: string }
    const icon = out ? 'fas fa-external-link-alt' : given
    const arrow = !icon || !!after || !!out
    return widget('button', {
      text: label, link: link(url), size: 'md',
      ...typography(T.button),
      text_padding: sides(17, 24),
      border_radius: sides(L.radius.button),
      ...BUTTON_COLORS[variant],
      ...(arrow
        ? { selected_icon: fa(icon ?? 'fas fa-arrow-right'), icon_align: 'right', icon_indent: px(12) }
        : { selected_icon: fa(icon!), icon_align: 'left', icon_indent: px(10) }),
      ...(id ? { button_css_id: id } : {}),
      _css_classes: cls(arrow ? 'av-go' : '', out ? 'av-out' : '', extra ?? ''),
      ...rest,
    })
  }

  /** Rótulo em caixa alta com o símbolo pequeno na frente: azul no papel, azul claro na tinta. */
  const eyebrow = (label: string, tone: Tone = 'light', options: JsonRecord = {}) => {
    const { _css_classes: extra, ...rest } = options as JsonRecord & { _css_classes?: string }
    return heading(label, T.eyebrow, tone === 'dark' ? AV.blueLight : AV.blue, { _css_classes: cls('av-eyebrow', tone === 'dark' ? 'av-eyebrow-dark' : '', extra ?? ''), ...rest })
  }

  /** Etiqueta pequena (um retângulo de contorno fino, sem preenchimento). */
  const tag = (label: string, tone: Tone = 'light', options: JsonRecord = {}) => {
    const { _css_classes: extra, ...rest } = options as JsonRecord & { _css_classes?: string }
    return heading(label, T.tag, tone === 'dark' ? AV.onDark : AV.ink, { ...FIXED, ...AUTO, _css_classes: cls('av-tag', tone === 'dark' ? 'av-tag-dark' : '', extra ?? ''), ...rest })
  }

  /** Cabeça de seção: rótulo, título e texto de apoio. */
  const sectionHead = (head: { label: string; title: string; lede?: string; tone?: Tone; align?: 'left' | 'center'; width?: number; ledeWidth?: number; tag?: string }, options: JsonRecord = {}) => {
    const tone = head.tone ?? 'light'
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      eyebrow(head.label, tone, align),
      heading(head.title, T.h2, tone === 'dark' ? AV.paper : AV.ink, { header_size: head.tag ?? 'h2', ...align, ...maxw(head.width ?? 820) }),
      ...(head.lede ? [text(head.lede, T.lede, tone === 'dark' ? AV.onDark : AV.body, { ...align, ...maxw(head.ledeWidth ?? 620) })] : []),
    ], 20, { flex_align_items: center ? 'center' : 'flex-start', css_classes: RISE, ...options })
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

  /** Símbolo com largura explícita (a marca reconhece o arquivo e mantém o tamanho). */
  const mark = (width: number, ink: 'dark' | 'light' = 'dark', options: JsonRecord = {}) => image(ink === 'dark' ? AV_LOGO.symbol : AV_LOGO.symbolLight, AV_NAME, {
    width: px(width), space: px(width), ...FIXED, ...AUTO,
    custom_css: `selector img{display:block;width:100%;height:auto;aspect-ratio:${AV_LOGO.ratio.toFixed(4)}}`,
    ...options,
  })

  /**
   * Assinatura (o "a" com o quadrado + avence + STUDIO) como imagem, com largura explícita
   * e o espaço que a marca põe nos logos já preenchido: aplicar a marca não muda nada.
   */
  const logo = (width: number, ink: 'dark' | 'light' = 'dark', options: JsonRecord & { mobile?: number } = {}) => {
    const { mobile, ...rest } = options as JsonRecord & { mobile?: number }
    return image(ink === 'dark' ? AV_LOGO.lockupDark : AV_LOGO.lockupLight, AV_NAME, {
      width: px(width), space: px(width), space_mobile: pct(100),
      ...(mobile ? { width_mobile: px(mobile) } : {}),
      ...FIXED, ...AUTO,
      custom_css: `selector img{display:block;width:100%;height:auto;aspect-ratio:${AV_LOGO.lockupRatio.toFixed(4)}}`,
      ...rest,
    })
  }

  /**
   * Camada de meio-tom (halftone): um container sem conteúdo com a textura como
   * fundo nativo (sobe junto ao publicar). A posição vem do CSS da seção (`.av-ht`).
   */
  const halftone = (texture: { path: string }, extra: string, settings: JsonRecord = {}) => container({
    css_classes: cls('av-ht', extra),
    background_background: 'classic',
    background_image: { id: '', url: avAsset(texture.path), source: 'url', alt: '' },
    background_repeat: 'no-repeat', background_size: 'cover', background_position: 'center center',
    ...settings,
  })

  /** Container raiz de uma seção: fundo de ponta a ponta, conteúdo em 1240px. */
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
      css_classes: cls(options.dark ? 'av-dark' : '', extra),
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { uid, container, widget, col, row, grid, heading, text, image, behavior, button, eyebrow, tag, sectionHead, list, mark, logo, halftone, root, section }
}

export type AvBuilder = ReturnType<typeof createBuilder>

/** Etiqueta: contorno fino, caixa alta pequena. */
export const TAG_CSS = [
  `selector .av-tag .elementor-heading-title{display:inline-flex;align-items:center;min-height:26px;padding:4px 10px;border:1px solid ${AV.line};background:${AV.white}}`,
  `selector .av-tag-dark .elementor-heading-title{border-color:${AV.lineDark};background:transparent}`,
].join('')

/** Navegação da Home (âncoras). */
export const NAV: Array<[string, string]> = [
  ['Cases', '#cases'], ['Serviços', '#entregas'], ['Como funciona', '#como-funciona'], ['Perguntas', '#perguntas'],
]

export const DESK = '(min-width:1025px)'
export const MOBILE = '(max-width:1024px)'
export const PHONE = '(max-width:767px)'
