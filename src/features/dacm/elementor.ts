import type { SectionNodeData } from '@/types/space'
import { DC, DC_EASE, DC_FONTS, DC_LAYOUT as L, DC_LOGO, DC_NAME, dcAsset } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para a DACM Advogados (partiu do
 * padrão da Júnior Automáticos e da Cerveira Braggio). Todo container declara
 * padding e gap, porque o Elementor põe 10px e 20px quando o JSON não diz
 * nada. Títulos em Sofia Sans Condensed (grotesca condensada, firme como uma
 * placa), texto, rótulos e botões em Sofia Sans.
 *
 * O conceito é "os quatro quadros": o monograma 2×2 do logo (D e M em cinza,
 * A e C em azul-ardósia, com os cantos de fora arredondados em diagonal) vira
 * o sistema da página. `tile()` desenha um quadro com os dois cantos opostos
 * arredondados, como o bloco do monograma.
 *
 * Para a marca aplicada por cima não mudar nada: toda cor dos settings está em
 * `DC` (e no front matter do DESIGN.md), títulos acima de 16px usam a fonte de
 * título, rótulos de até 16px e botões usam a fonte de texto, e os botões têm
 * o canto da marca (4px).
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
export type TileTone = 'gray' | 'slate' | 'paper' | 'concrete' | 'raised'

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
/** Canto do monograma: superior esquerdo e inferior direito arredondados. */
export const leaf = (size: number = L.radius.tile) => sides(size, 0, size, 0)
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
  font?: keyof typeof DC_FONTS
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
  [`${group}_font_family`]: DC_FONTS[spec.font ?? 'text'],
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
  hero: { font: 'title', size: 78, tablet: 62, mobile: 46, weight: 700, line: 0.98, letter: -0.012 },
  h2: { font: 'title', size: 54, tablet: 44, mobile: 36, weight: 700, line: 1.02, letter: -0.01 },
  h3: { font: 'title', size: 28, tablet: 26, mobile: 24, weight: 700, line: 1.08 },
  tile: { font: 'title', size: 27, tablet: 25, mobile: 23, weight: 600, line: 1.1 },
  numeral: { font: 'title', size: 56, tablet: 48, mobile: 44, weight: 700, line: 0.9 },
  lede: { size: 20, tablet: 19, mobile: 18, line: 1.5 },
  body: { size: 18, mobile: 17, line: 1.6 },
  small: { size: 16, line: 1.5 },
  list: { size: 16, line: 1.45 },
  strong: { size: 16, weight: 700, line: 1.35 },
  nav: { size: 16, weight: 600, line: 1.2 },
  /** rótulo: caixa alta espaçada, com o quadradinho do monograma na frente */
  eyebrow: { size: 13, weight: 700, line: 1.4, letter: 0.14, transform: 'uppercase' },
  field: { size: 12, weight: 600, line: 1.35, letter: 0.12, transform: 'uppercase' },
  button: { size: 16, weight: 700, line: 1.2, letter: 0.01 },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Bloco que sobe uma vez ao entrar na tela (story.ts). Nunca junto com animação de entrada do Elementor. */
export const RISE = 'dc-rise'
/** Peças da abertura que entram em sequência ao abrir a página (story.ts). */
export const INTRO = 'dc-intro'
/** Quadro que chega na ordem do xadrez (story.ts): `dc-q` + `dc-q-tl|tr|bl|br` diz de que canto ele vem. */
export const QUAD = 'dc-q'
/** Classe extra no `_css_classes` de um widget ou no `css_classes` de um container. */
export const cls = (...names: string[]) => names.filter(Boolean).join(' ')

/** Quadradinho 2×2 do monograma (cinza, azul / azul, cinza), em CSS. */
export const MINI_MONOGRAM = `conic-gradient(${DC.slate} 0 25%,${DC.gray} 0 50%,${DC.slate} 0 75%,${DC.gray} 0)`

/** Link, foco, botão, rótulo, quadros e parágrafos: vale para toda seção da DACM. */
const BASE_CSS = [
  'selector{overflow-x:clip;scroll-margin-top:80px}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p{margin:0 0 .85em}selector .elementor-widget-text-editor p:last-child{margin-bottom:0}',
  'selector .elementor-widget-text-editor a{text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  'selector p.elementor-heading-title{text-wrap:pretty}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper{line-height:0}',
  'selector .elementor-button{min-height:52px;display:inline-flex;align-items:center;justify-content:center}',
  'selector .elementor-button-content-wrapper{align-items:center}',
  'selector .elementor-button-icon{display:inline-flex;align-items:center;line-height:1}selector .elementor-button-icon i{font-size:1.15em}',
  // rótulo: o quadradinho do monograma na frente
  `selector .dc-eyebrow .elementor-heading-title{display:inline-flex;align-items:center;gap:11px}selector .dc-eyebrow .elementor-heading-title::before{content:"";width:11px;height:11px;flex:none;border-radius:3px 0 3px 0;background:${MINI_MONOGRAM}}`,
  'selector .dc-num .elementor-heading-title{font-variant-numeric:tabular-nums}',
  // quadro clicável: o título leva o link e cobre o quadro inteiro
  'selector .dc-tile{position:relative}selector .dc-tile-link .elementor-heading-title a{color:inherit}selector .dc-tile-link .elementor-heading-title a::after{content:"";position:absolute;inset:0;z-index:1;border-radius:inherit}',
  `selector .dc-tile-cue .elementor-heading-title::after{content:"";display:inline-block;width:.5em;height:.5em;margin-left:.5em;border-top:2px solid currentColor;border-right:2px solid currentColor;transform:translateY(-.06em) rotate(45deg)}`,
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition-property:color,background-color,border-color;transition-duration:180ms;transition-timing-function:${DC_EASE}}}`,
  // containers: a transição de fundo e borda do Elementor não pode pegar o transform do GSAP
  'selector .e-con{transition-property:background,border,box-shadow}',
  // o que o GSAP move não tem transição própria (a do Elementor deixaria o movimento arrastado)
  'selector .dc-rise,selector .dc-intro,selector .dc-q{transition:none!important}',
  '@media(prefers-reduced-motion:reduce){selector *{transition:none!important}}',
  `selector a:focus-visible,selector summary:focus-visible,selector button:focus-visible,selector .elementor-button:focus-visible{outline:2px solid ${DC.ink};outline-offset:3px}`,
  `selector.dc-dark a:focus-visible,selector.dc-dark summary:focus-visible,selector.dc-dark .elementor-button:focus-visible,selector .dc-on-dark a:focus-visible{outline-color:#ffffff}`,
  'selector .dc-tile-link .elementor-heading-title a:focus-visible{outline:0}',
  `selector .dc-tile:has(.dc-tile-link a:focus-visible){outline:3px solid ${DC.ink};outline-offset:3px}`,
  'selector .dc-dark .dc-tile:has(.dc-tile-link a:focus-visible),selector.dc-dark .dc-tile:has(.dc-tile-link a:focus-visible){outline-color:#ffffff}',
].join('')

export type ButtonVariant = 'primary' | 'outline' | 'light' | 'outlineLight'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  // branco na tinta do logo (10,5:1); com o mouse, o azul quase preto
  primary: {
    background_color: DC.ink, button_text_color: DC.paper,
    button_background_hover_color: DC.deep, hover_color: DC.paper,
    ...border(DC.ink, sides(1)), button_hover_border_color: DC.deep,
  },
  outline: {
    background_color: DC.clear, button_text_color: DC.ink,
    button_background_hover_color: DC.ink, hover_color: DC.paper,
    ...border(DC.ink, sides(1)), button_hover_border_color: DC.ink,
  },
  // nas faixas escuras: branco com a tinta
  light: {
    background_color: DC.paper, button_text_color: DC.ink,
    button_background_hover_color: DC.concrete, hover_color: DC.deep,
    ...border(DC.paper, sides(1)), button_hover_border_color: DC.concrete,
  },
  outlineLight: {
    background_color: DC.clear, button_text_color: DC.paper,
    button_background_hover_color: DC.paper, hover_color: DC.ink,
    ...border(DC.onDarkMuted, sides(1)), button_hover_border_color: DC.paper,
  },
}

/** Fundo e cores de texto de cada tom de quadro (contrastes no DESIGN.md §3). */
export const TILE: Record<TileTone, { bg: string; title: string; text: string; label: string; dark: boolean }> = {
  gray: { bg: DC.gray, title: DC.deep, text: DC.deep, label: DC.deep, dark: false },
  slate: { bg: DC.slate, title: DC.paper, text: DC.onDark, label: DC.onDark, dark: true },
  raised: { bg: DC.slateRaised, title: DC.paper, text: DC.onDark, label: DC.onDark, dark: true },
  paper: { bg: DC.paper, title: DC.ink, text: DC.body, label: DC.muted, dark: false },
  concrete: { bg: DC.concrete, title: DC.ink, text: DC.body, label: DC.muted, dark: false },
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

  const heading = (title: string, spec: TypeSpec, color: string = DC.ink, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = DC.body, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(dcAsset(path), alt), image_size: 'full', ...options })
  /** Widget HTML só com comportamento (script), nunca com conteúdo. */
  const behavior = (html: string) => widget('html', { html, _css_classes: 'dc-behavior' })

  /** Botão de canto quase reto; `icon` vai antes do texto (o WhatsApp, por exemplo). */
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

  /** Rótulo em caixa alta com o quadradinho do monograma. */
  const eyebrow = (label: string, tone: Tone = 'light', options: JsonRecord = {}) => {
    const { _css_classes: extra, ...rest } = options as JsonRecord & { _css_classes?: string }
    return heading(label, T.eyebrow, tone === 'dark' ? DC.onDark : DC.muted, { _css_classes: cls('dc-eyebrow', extra ?? ''), ...rest })
  }

  /** Cabeça de seção: rótulo, título (uma frase por linha) e texto de apoio. */
  const sectionHead = (head: { label: string; title: string; lede?: string; tone?: Tone; align?: 'left' | 'center'; width?: number; ledeWidth?: number; tag?: string }, options: JsonRecord = {}) => {
    const tone = head.tone ?? 'light'
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      eyebrow(head.label, tone, align),
      heading(head.title, T.h2, tone === 'dark' ? DC.paper : DC.ink, { header_size: head.tag ?? 'h2', ...align, ...maxw(head.width ?? 820) }),
      ...(head.lede ? [text(head.lede, T.lede, tone === 'dark' ? DC.onDark : DC.body, { ...align, ...maxw(head.ledeWidth ?? 620) })] : []),
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

  /**
   * Quadro do monograma: fundo do tom, cantos opostos arredondados (`corner`
   * diz quais: o par do monograma, só um deles ou nenhum) e padding próprio.
   */
  const tile = (tone: TileTone, elements: ElementorNode[], options: JsonRecord & { corner?: 'leaf' | 'tl' | 'br' | 'none'; radius?: number } = {}) => {
    const { corner = 'leaf', radius = L.radius.tile, css_classes: extra, ...rest } = options as JsonRecord & { corner?: 'leaf' | 'tl' | 'br' | 'none'; radius?: number; css_classes?: string }
    const r = corner === 'leaf' ? leaf(radius) : corner === 'tl' ? sides(radius, 0, 0, 0) : corner === 'br' ? sides(0, 0, radius, 0) : sides(0)
    return container({
      flex_direction: 'column', flex_justify_content: 'space-between', flex_gap: gap(24),
      padding: sides(32, 30, 28, 30), padding_tablet: sides(28, 26, 26, 26), padding_mobile: sides(24, 20, 22, 20),
      ...bg(TILE[tone].bg), border_radius: r,
      css_classes: cls('dc-tile', `dc-tile-${tone}`, TILE[tone].dark ? 'dc-on-dark' : '', extra ?? ''),
      ...rest,
    }, elements)
  }

  /** Logo do site atual com largura explícita: a marca reconhece o arquivo e mantém o tamanho. */
  const logo = (width: number, options: JsonRecord = {}) => image(DC_LOGO.path, DC_NAME, {
    width: px(width), space: px(width), ...FIXED, ...AUTO,
    custom_css: `selector img{display:block;width:100%;height:auto;aspect-ratio:${DC_LOGO.ratio.toFixed(4)}}`,
    ...options,
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
      css_classes: cls(options.dark ? 'dc-dark' : '', extra),
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { uid, container, widget, col, row, grid, heading, text, image, behavior, button, eyebrow, sectionHead, list, tile, logo, root, section }
}

export type DcBuilder = ReturnType<typeof createBuilder>

/** Navegação da Home (âncoras). */
export const NAV: Array<[string, string]> = [
  ['Assuntos', '#assuntos'], ['Como começa', '#como-comeca'], ['O escritório', '#escritorio'], ['Onde fica', '#onde-fica'], ['Dúvidas', '#duvidas'],
]

export const DESK = '(min-width:1025px)'
export const MOBILE = '(max-width:1024px)'
export const PHONE = '(max-width:767px)'
