import type { SectionNodeData } from '@/types/space'
import { CB, CB_EASE, CB_FONTS, CB_LAYOUT as L, CB_MONOGRAM, CB_NAME, cbAsset } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para a Cerveira Braggio (partiu
 * do padrão da Júnior Automáticos e da Macarthy Scherer). Todo container
 * declara padding e gap, porque o Elementor põe 10px e 20px quando o JSON não
 * diz nada. Títulos em Marcellus (as capitulares romanas do logo), texto,
 * rótulos e botões em IBM Plex Sans (a letra técnica das anotações de planta).
 *
 * Para a marca aplicada por cima não mudar nada: toda cor dos settings está em
 * `CB` (e no front matter do DESIGN.md), títulos acima de 16px usam a fonte de
 * título, rótulos de até 16px e botões usam a fonte de texto, e os botões têm
 * o canto da marca (reto).
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
  font?: keyof typeof CB_FONTS
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
  [`${group}_font_family`]: CB_FONTS[spec.font ?? 'text'],
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
  hero: { font: 'title', size: 70, tablet: 56, mobile: 40, weight: 400, line: 1.04, letter: -0.015 },
  h2: { font: 'title', size: 48, tablet: 40, mobile: 32, weight: 400, line: 1.08, letter: -0.01 },
  h3: { font: 'title', size: 26, tablet: 24, mobile: 22, weight: 400, line: 1.18, letter: -0.005 },
  situation: { font: 'title', size: 23, tablet: 22, mobile: 21, weight: 400, line: 1.25 },
  numeral: { font: 'title', size: 40, tablet: 36, mobile: 32, weight: 400, line: 1 },
  lede: { size: 19, tablet: 18, mobile: 17, line: 1.6 },
  body: { size: 17, mobile: 16, line: 1.65 },
  small: { size: 15, line: 1.6 },
  list: { size: 16, line: 1.55 },
  strong: { size: 16, weight: 600, line: 1.4 },
  nav: { size: 15, weight: 500, line: 1.2 },
  /** anotação de planta: caixa alta, espaçada, números tabulares */
  eyebrow: { size: 12, weight: 500, line: 1.4, letter: 0.16, transform: 'uppercase' },
  field: { size: 11, weight: 500, line: 1.3, letter: 0.14, transform: 'uppercase' },
  button: { size: 15, weight: 600, line: 1.2, letter: 0.01 },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Bloco que sobe uma vez ao entrar na tela (story.ts). Nunca junto com animação de entrada do Elementor. */
export const RISE = 'cb-rise'
/** Peças da abertura que entram em sequência ao abrir a página (story.ts). */
export const INTRO = 'cb-intro'
/** Classe extra no `_css_classes` de um widget ou no `css_classes` de um container. */
export const cls = (...names: string[]) => names.filter(Boolean).join(' ')

/** Link, foco, botão, cartão, rótulo e parágrafos: vale para toda seção da Cerveira Braggio. */
const BASE_CSS = [
  'selector{overflow-x:clip;scroll-margin-top:76px}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p{margin:0 0 .85em}selector .elementor-widget-text-editor p:last-child{margin-bottom:0}',
  'selector .elementor-widget-text-editor a{text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  'selector p.elementor-heading-title{text-wrap:pretty}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper{line-height:0}',
  'selector .elementor-button{min-height:50px;display:inline-flex;align-items:center;justify-content:center}',
  'selector .elementor-button-content-wrapper{align-items:center}',
  'selector .elementor-button-icon{display:inline-flex;align-items:center;line-height:1}selector .elementor-button-icon i{font-size:1.1em}',
  // anotação de planta: um quadradinho dourado na frente, números tabulares
  `selector .cb-eyebrow .elementor-heading-title{display:inline-flex;align-items:center;gap:12px;font-variant-numeric:tabular-nums}selector .cb-eyebrow .elementor-heading-title::before{content:"";width:7px;height:7px;flex:none;background:${CB.gold}}`,
  'selector .cb-num .elementor-heading-title,selector .cb-field .elementor-heading-title{font-variant-numeric:tabular-nums}',
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition-property:color,background-color,border-color;transition-duration:180ms;transition-timing-function:${CB_EASE}}}`,
  // containers: a transição de fundo e borda do Elementor não pode pegar o transform do GSAP
  'selector .e-con{transition-property:background,border,box-shadow}',
  // o que o GSAP move não tem transição própria (a do Elementor deixaria o movimento arrastado)
  'selector .cb-rise,selector .cb-intro,selector .cb-portrait,selector .cb-room-in,selector .cb-plan,selector .cb-sheet-grid{transition:none!important}',
  '@media(prefers-reduced-motion:reduce){selector *{transition:none!important}}',
  `selector a:focus-visible,selector summary:focus-visible,selector button:focus-visible,selector .elementor-button:focus-visible{outline:2px solid ${CB.goldInk};outline-offset:3px}`,
  `selector.cb-dark a:focus-visible,selector.cb-dark summary:focus-visible,selector.cb-dark .elementor-button:focus-visible{outline-color:${CB.gold}}`,
].join('')

export type ButtonVariant = 'primary' | 'outline' | 'gold' | 'outlineLight'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  // branco no nanquim (17:1); com o mouse, o dourado com nanquim (7,4:1)
  primary: {
    background_color: CB.ink, button_text_color: CB.paper,
    button_background_hover_color: CB.gold, hover_color: CB.ink,
    ...border(CB.ink, sides(1)), button_hover_border_color: CB.gold,
  },
  outline: {
    background_color: CB.clear, button_text_color: CB.ink,
    button_background_hover_color: CB.ink, hover_color: CB.paper,
    ...border(CB.ink, sides(1)), button_hover_border_color: CB.ink,
  },
  // nas faixas escuras: dourado com nanquim
  gold: {
    background_color: CB.gold, button_text_color: CB.ink,
    button_background_hover_color: CB.goldLight, hover_color: CB.ink,
    ...border(CB.gold, sides(1)), button_hover_border_color: CB.goldLight,
  },
  outlineLight: {
    background_color: CB.clear, button_text_color: CB.paper,
    button_background_hover_color: CB.paper, hover_color: CB.ink,
    ...border(CB.onDarkMuted, sides(1)), button_hover_border_color: CB.paper,
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

  const heading = (title: string, spec: TypeSpec, color: string = CB.ink, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = CB.body, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(cbAsset(path), alt), image_size: 'full', ...options })
  /** Widget HTML só com comportamento (script), nunca com conteúdo. */
  const behavior = (html: string) => widget('html', { html, _css_classes: 'cb-behavior' })

  /** Botão de canto reto; `icon` vai antes do texto (o WhatsApp, por exemplo). */
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

  /** Anotação em caixa alta com o quadradinho dourado: dourado no escuro, dourado escuro no claro. */
  const eyebrow = (label: string, tone: Tone = 'light', options: JsonRecord = {}) => {
    const { _css_classes: extra, ...rest } = options as JsonRecord & { _css_classes?: string }
    return heading(label, T.eyebrow, tone === 'dark' ? CB.gold : CB.goldInk, { _css_classes: cls('cb-eyebrow', extra ?? ''), ...rest })
  }

  /** Cabeça de seção: anotação, título e texto de apoio. */
  const sectionHead = (head: { label: string; title: string; lede?: string; tone?: Tone; align?: 'left' | 'center'; width?: number; ledeWidth?: number; tag?: string }, options: JsonRecord = {}) => {
    const tone = head.tone ?? 'light'
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      eyebrow(head.label, tone, align),
      heading(head.title, T.h2, tone === 'dark' ? CB.paper : CB.ink, { header_size: head.tag ?? 'h2', ...align, ...maxw(head.width ?? 760) }),
      ...(head.lede ? [text(head.lede, T.lede, tone === 'dark' ? CB.onDark : CB.body, { ...align, ...maxw(head.ledeWidth ?? 620) })] : []),
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
   * Cota de desenho técnico: duas pontas com o traço a 45°, a linha e o texto
   * no meio. A linha e as pontas são CSS (`.cb-cota` na seção que usa).
   */
  const cota = (label: string, tone: Tone = 'light', options: JsonRecord = {}) => {
    const { css_classes: extra, ...rest } = options as JsonRecord & { css_classes?: string }
    return row([
      container({ min_height: px(1), css_classes: 'cb-cota-line', ...FILL }),
      heading(label, T.eyebrow, tone === 'dark' ? CB.gold : CB.goldInk, { ...FIXED, ...AUTO, _css_classes: 'cb-cota-label', align: 'center' }),
      container({ min_height: px(1), css_classes: 'cb-cota-line', ...FILL }),
    ], 14, { css_classes: cls('cb-cota', tone === 'dark' ? 'cb-cota-dark' : '', extra ?? ''), ...rest })
  }

  /** Monograma com largura explícita: a marca reconhece o arquivo e mantém o tamanho. */
  const monogram = (width: number, options: JsonRecord = {}) => image(CB_MONOGRAM, CB_NAME, {
    width: px(width), space: px(width), ...FIXED, ...AUTO,
    custom_css: 'selector img{display:block;width:100%;height:auto;aspect-ratio:1}',
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
      css_classes: cls(options.dark ? 'cb-dark' : '', extra),
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { uid, container, widget, col, row, grid, heading, text, image, behavior, button, eyebrow, sectionHead, list, cota, monogram, root, section }
}

export type CbBuilder = ReturnType<typeof createBuilder>

/** CSS da cota (linha dourada fina com as pontas a 45°). Vai no `css` da seção que usa `cota()`. */
export const COTA_CSS = [
  `selector .cb-cota-line{height:1px;min-height:1px!important;background:${CB.goldInk}}`,
  `selector .cb-cota::before,selector .cb-cota::after{content:"";flex:none;width:1px;height:14px;background:${CB.goldInk};transform:rotate(45deg)}`,
  `selector .cb-cota-dark .cb-cota-line,selector .cb-cota-dark::before,selector .cb-cota-dark::after{background:${CB.gold}}`,
  'selector .cb-cota-label .elementor-heading-title{white-space:nowrap;font-variant-numeric:tabular-nums}',
].join('')

/** Quadriculado da planta (papel milimetrado): só textura, sempre fraca e com máscara. */
export const gridTexture = (alpha = 0.06, major = 96, minor = 24) => [
  `background-image:linear-gradient(rgba(29,27,24,${alpha * 1.6}) 1px,transparent 1px),linear-gradient(90deg,rgba(29,27,24,${alpha * 1.6}) 1px,transparent 1px),linear-gradient(rgba(29,27,24,${alpha}) 1px,transparent 1px),linear-gradient(90deg,rgba(29,27,24,${alpha}) 1px,transparent 1px)`,
  `background-size:${major}px ${major}px,${major}px ${major}px,${minor}px ${minor}px,${minor}px ${minor}px`,
].join(';')

/** Navegação da Home (âncoras). */
export const NAV: Array<[string, string]> = [
  ['Situações', '#situacoes'], ['A advogada', '#advogada'], ['Primeiro contato', '#primeiro-contato'], ['Onde fica', '#onde-fica'], ['Dúvidas', '#duvidas'],
]

export const DESK = '(min-width:1025px)'
export const MOBILE = '(max-width:1024px)'
export const PHONE = '(max-width:767px)'
