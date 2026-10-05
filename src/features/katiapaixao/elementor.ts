import type { SectionNodeData } from '@/types/space'
import { KP, KP_EASE, KP_FONTS, KP_LAYOUT as L, KP_MONOGRAM, KP_MONOGRAM_LIGHT, KP_LOGO, KP_LOGO_LIGHT, KP_NAME, KP_RATIO, kpAsset } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para a Kátia Paixão Advocacia
 * (partiu do padrão da Cerveira Braggio e da Júnior Automáticos). Todo
 * container declara padding e gap, porque o Elementor põe 10px e 20px quando o
 * JSON não diz nada. Títulos em Italiana (o alto contraste fino do K|P), texto,
 * rótulos, botões e situações em Manrope.
 *
 * Para a marca aplicada por cima não mudar nada: toda cor dos settings está em
 * `KP` (e no front matter do DESIGN.md); widget `heading` acima de 16px é
 * sempre Italiana; texto em Manrope acima de 16px vai em `text-editor`; rótulos
 * de até 16px e botões usam Manrope; os botões têm o canto da marca (3px).
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

export type Tone = 'light' | 'wine'

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
  font?: keyof typeof KP_FONTS
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
  [`${group}_font_family`]: KP_FONTS[spec.font ?? 'text'],
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
  hero: { font: 'title', size: 78, tablet: 62, mobile: 46, weight: 400, line: 1.02, letter: -0.01 },
  h2: { font: 'title', size: 54, tablet: 46, mobile: 38, weight: 400, line: 1.05, letter: -0.005 },
  h3: { font: 'title', size: 32, tablet: 30, mobile: 28, weight: 400, line: 1.1 },
  quote: { font: 'title', size: 40, tablet: 36, mobile: 30, weight: 400, line: 1.14 },
  numeral: { font: 'title', size: 44, tablet: 40, mobile: 36, weight: 400, line: 1 },
  lede: { size: 19, tablet: 18, mobile: 17, line: 1.6 },
  body: { size: 17, mobile: 16, line: 1.65 },
  /** situação em primeira pessoa: Manrope semibold, sempre em `text-editor` */
  situation: { size: 19, tablet: 18, mobile: 17, weight: 600, line: 1.4 },
  small: { size: 15, line: 1.6 },
  list: { size: 16, line: 1.55 },
  strong: { size: 16, weight: 700, line: 1.4 },
  nav: { size: 15, weight: 500, line: 1.2 },
  /** rótulo: caixa alta espaçada, com a barra do K|P na frente */
  eyebrow: { size: 12, weight: 700, line: 1.4, letter: 0.16, transform: 'uppercase' },
  field: { size: 11, weight: 600, line: 1.3, letter: 0.14, transform: 'uppercase' },
  button: { size: 15, weight: 700, line: 1.2, letter: 0.01 },
  chip: { size: 14, weight: 600, line: 1.25 },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Bloco que sobe uma vez ao entrar na tela (story.ts). Nunca junto com animação de entrada do Elementor. */
export const RISE = 'kp-rise'
/** Peças da abertura que entram em sequência ao abrir a página (story.ts). */
export const INTRO = 'kp-intro'
/** Classe extra no `_css_classes` de um widget ou no `css_classes` de um container. */
export const cls = (...names: string[]) => names.filter(Boolean).join(' ')

/** Link, foco, botão, rótulo e parágrafos: vale para toda seção da Kátia Paixão. */
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
  // rótulo: a barra vertical do K|P na frente
  'selector .kp-eyebrow .elementor-heading-title{display:inline-flex;align-items:center;gap:12px}selector .kp-eyebrow .elementor-heading-title::before{content:"";width:1px;height:16px;flex:none;background:currentColor}',
  'selector .kp-num .elementor-heading-title{font-variant-numeric:lining-nums}',
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition-property:color,background-color,border-color;transition-duration:180ms;transition-timing-function:${KP_EASE}}}`,
  // containers: a transição de fundo e borda do Elementor não pode pegar o transform do GSAP
  'selector .e-con{transition-property:background,border,box-shadow}',
  // o que o GSAP move não tem transição própria (a do Elementor deixaria o movimento arrastado)
  'selector .kp-rise,selector .kp-intro,selector .kp-portrait,selector .kp-field,selector .kp-seam{transition:none!important}',
  '@media(prefers-reduced-motion:reduce){selector *{transition:none!important}}',
  `selector a:focus-visible,selector summary:focus-visible,selector button:focus-visible,selector .elementor-button:focus-visible{outline:2px solid ${KP.wine};outline-offset:3px}`,
  `selector.kp-on-wine a:focus-visible,selector.kp-on-wine summary:focus-visible,selector.kp-on-wine .elementor-button:focus-visible,selector .kp-on-wine a:focus-visible,selector .kp-on-wine .elementor-button:focus-visible{outline-color:${KP.champagne}}`,
].join('')

export type ButtonVariant = 'wine' | 'outline' | 'champagne' | 'outlineLight'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  // no claro: vinho com linho (9:1); com o mouse, o vinho fundo
  wine: {
    background_color: KP.wine, button_text_color: KP.linen,
    button_background_hover_color: KP.wineDeep, hover_color: KP.linen,
    ...border(KP.wine, sides(1)), button_hover_border_color: KP.wineDeep,
  },
  outline: {
    background_color: KP.clear, button_text_color: KP.wine,
    button_background_hover_color: KP.wine, hover_color: KP.linen,
    ...border(KP.wine, sides(1)), button_hover_border_color: KP.wine,
  },
  // no vinho: champanhe com vinho fundo (7,9:1)
  champagne: {
    background_color: KP.champagne, button_text_color: KP.wineDeep,
    button_background_hover_color: KP.champagneLight, hover_color: KP.wineDeep,
    ...border(KP.champagne, sides(1)), button_hover_border_color: KP.champagneLight,
  },
  outlineLight: {
    background_color: KP.clear, button_text_color: KP.linen,
    button_background_hover_color: KP.linen, hover_color: KP.wine,
    ...border(KP.onWineMuted, sides(1)), button_hover_border_color: KP.linen,
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

  /** Título em Italiana (acima de 16px) ou rótulo em Manrope (até 16px). */
  const heading = (title: string, spec: TypeSpec, color: string = KP.ink, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  /** Texto em Manrope, em qualquer tamanho (a marca trata `text-editor` como texto). */
  const text = (html: string, spec: TypeSpec = T.body, color: string = KP.body, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(kpAsset(path), alt), image_size: 'full', ...options })
  /** Widget HTML só com comportamento (script), nunca com conteúdo. */
  const behavior = (html: string) => widget('html', { html, _css_classes: 'kp-behavior' })

  /** Botão de canto quase reto; `icon` vai antes do texto (o WhatsApp, por exemplo). */
  const button = (label: string, url: string, variant: ButtonVariant = 'wine', options: JsonRecord & { icon?: string } = {}) => {
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

  /** Rótulo em caixa alta com a barra do K|P: champanhe no vinho, vinho no claro. */
  const eyebrow = (label: string, tone: Tone = 'light', options: JsonRecord = {}) => {
    const { _css_classes: extra, ...rest } = options as JsonRecord & { _css_classes?: string }
    return heading(label, T.eyebrow, tone === 'wine' ? KP.champagne : KP.wine, { _css_classes: cls('kp-eyebrow', extra ?? ''), ...rest })
  }

  /** Cabeça de seção: rótulo, título (uma frase por linha) e texto de apoio. */
  const sectionHead = (head: { label: string; title: string; lede?: string; tone?: Tone; align?: 'left' | 'center'; width?: number; ledeWidth?: number; tag?: string }, options: JsonRecord = {}) => {
    const tone = head.tone ?? 'light'
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      eyebrow(head.label, tone, align),
      heading(head.title, T.h2, tone === 'wine' ? KP.onWine : KP.ink, { header_size: head.tag ?? 'h2', ...align, ...maxw(head.width ?? 760) }),
      ...(head.lede ? [text(head.lede, T.lede, tone === 'wine' ? KP.onWineMuted : KP.body, { ...align, ...maxw(head.ledeWidth ?? 600) })] : []),
    ], 22, { flex_align_items: center ? 'center' : 'flex-start', css_classes: RISE, ...options })
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

  /** A barra do K|P: um filete vertical de 1px (a cor e a altura vêm do CSS da seção). */
  const bar = (extra = '') => container({ css_classes: cls('kp-bar', extra) })

  /** Monograma K|P com largura explícita: a marca reconhece o arquivo e mantém o tamanho. */
  const monogram = (width: number, tone: Tone = 'light', options: JsonRecord = {}) => image(tone === 'wine' ? KP_MONOGRAM_LIGHT : KP_MONOGRAM, KP_NAME, {
    width: px(width), space: px(width), ...FIXED, ...AUTO,
    custom_css: `selector img{display:block;width:100%;height:auto;aspect-ratio:${KP_RATIO.monogram.toFixed(4)}}`,
    ...options,
  })
  /** Logo horizontal com largura explícita. */
  const logo = (width: number, tone: Tone = 'light', options: JsonRecord = {}) => image(tone === 'wine' ? KP_LOGO_LIGHT : KP_LOGO, KP_NAME, {
    width: px(width), space: px(width), ...FIXED, ...AUTO,
    custom_css: `selector img{display:block;width:100%;height:auto;aspect-ratio:${KP_RATIO.logo.toFixed(4)}}`,
    ...options,
  })

  /** Container raiz de uma seção: fundo de ponta a ponta, conteúdo em 1200px. */
  const root = (elements: ElementorNode[], options: { background: string; id?: string; tag?: string; css?: string; space?: number; pad?: [number, number, number] | false; wine?: boolean; settings?: JsonRecord }) => {
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
      css_classes: cls(options.wine ? 'kp-on-wine' : '', extra),
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { uid, container, widget, col, row, grid, heading, text, image, behavior, button, eyebrow, sectionHead, list, bar, monogram, logo, root, section }
}

export type KpBuilder = ReturnType<typeof createBuilder>

/** Navegação da Home (âncoras). */
export const NAV: Array<[string, string]> = [
  ['Situações', '#situacoes'], ['A advogada', '#advogada'], ['Como funciona', '#como-funciona'], ['Onde fica', '#onde-fica'], ['Dúvidas', '#duvidas'],
]

export const DESK = '(min-width:1025px)'
export const MOBILE = '(max-width:1024px)'
export const PHONE = '(max-width:767px)'
