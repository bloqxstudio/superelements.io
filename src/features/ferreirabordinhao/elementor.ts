import type { SectionNodeData } from '@/types/space'
import { FB, FB_EASE, FB_FONTS, FB_LAYOUT as L, FB_LOGO, FB_NAME, fbAsset } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para a Ferreira & Bordinhão
 * (partiu do padrão da Júnior Automáticos e da Cerveira Braggio). Todo
 * container declara padding e gap, porque o Elementor põe 10px e 20px quando o
 * JSON não diz nada. Títulos e números em Zilla Slab (a serifa egípcia de
 * documento), texto, rótulos e botões em Fira Sans.
 *
 * Para a marca aplicada por cima não mudar nada: toda cor dos settings está em
 * `FB` (e no front matter do DESIGN.md), títulos acima de 16px usam a fonte de
 * título, rótulos de até 16px e botões usam a fonte de texto, e os botões têm
 * o canto da marca (6px).
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
  font?: keyof typeof FB_FONTS
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
  [`${group}_font_family`]: FB_FONTS[spec.font ?? 'text'],
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
  hero: { font: 'title', size: 62, tablet: 52, mobile: 38, weight: 600, line: 1.06, letter: -0.012 },
  h2: { font: 'title', size: 46, tablet: 38, mobile: 31, weight: 600, line: 1.1, letter: -0.01 },
  h3: { font: 'title', size: 25, tablet: 23, mobile: 22, weight: 600, line: 1.2 },
  /** a situação, na primeira pessoa */
  situation: { font: 'title', size: 23, tablet: 22, mobile: 21, weight: 500, line: 1.25 },
  /** o número da lei */
  law: { font: 'title', size: 54, tablet: 48, mobile: 44, weight: 600, line: 1, letter: -0.01 },
  lawSmall: { font: 'title', size: 40, tablet: 36, mobile: 32, weight: 600, line: 1, letter: -0.01 },
  lede: { size: 19, tablet: 18, mobile: 17, line: 1.6 },
  body: { size: 17, mobile: 16, line: 1.65 },
  small: { size: 15, line: 1.6 },
  list: { size: 16, line: 1.55 },
  strong: { size: 16, weight: 600, line: 1.4 },
  nav: { size: 15, weight: 500, line: 1.2 },
  /** rótulo: caixa alta espaçada */
  eyebrow: { size: 13, weight: 600, line: 1.4, letter: 0.14, transform: 'uppercase' },
  /** referência da lei ("CLT, art. 477"): caixa alta pequena, números tabulares */
  cite: { size: 12, weight: 600, line: 1.35, letter: 0.1, transform: 'uppercase' },
  button: { size: 16, weight: 600, line: 1.2 },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Bloco que sobe uma vez ao entrar na tela (story.ts). Nunca junto com animação de entrada do Elementor. */
export const RISE = 'fb-rise'
/** Peças da abertura que entram em sequência ao abrir a página (story.ts). */
export const INTRO = 'fb-intro'
/** Número da lei: os algarismos rolam até o valor, como as bandas de um carimbo datador (story.ts). */
export const ROLL = 'fb-roll'
/** Classe extra no `_css_classes` de um widget ou no `css_classes` de um container. */
export const cls = (...names: string[]) => names.filter(Boolean).join(' ')

/** Link, foco, botão, rótulo e parágrafos: vale para toda seção da Ferreira & Bordinhão. */
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
  // rótulo: um filete curto de azul-petróleo na frente
  `selector .fb-eyebrow .elementor-heading-title{display:inline-flex;align-items:center;gap:12px}selector .fb-eyebrow .elementor-heading-title::before{content:"";width:22px;height:2px;flex:none;background:${FB.accent}}`,
  `selector.fb-dark .fb-eyebrow .elementor-heading-title::before{background:${FB.accentLight}}`,
  // números da lei e referências: algarismos tabulares, alinhados
  'selector .fb-law .elementor-heading-title,selector .fb-cite .elementor-heading-title{font-variant-numeric:tabular-nums lining-nums}',
  'selector .fb-law .elementor-heading-title{white-space:nowrap}',
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition-property:color,background-color,border-color;transition-duration:180ms;transition-timing-function:${FB_EASE}}}`,
  // containers: a transição de fundo e borda do Elementor não pode pegar o transform do GSAP
  'selector .e-con{transition-property:background,border,box-shadow}',
  // o que o GSAP move não tem transição própria (a do Elementor deixaria o movimento arrastado)
  'selector .fb-rise,selector .fb-intro,selector .fb-roll{transition:none!important}',
  '@media(prefers-reduced-motion:reduce){selector *{transition:none!important}}',
  `selector a:focus-visible,selector summary:focus-visible,selector button:focus-visible,selector .elementor-button:focus-visible{outline:2px solid ${FB.accentInk};outline-offset:3px}`,
  `selector.fb-dark a:focus-visible,selector.fb-dark summary:focus-visible,selector.fb-dark .elementor-button:focus-visible{outline-color:${FB.accentLight}}`,
].join('')

export type ButtonVariant = 'primary' | 'navy' | 'outline' | 'light' | 'outlineLight'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  // azul-petróleo com branco (5,1:1); com o mouse, o petróleo escuro (6,4:1)
  primary: {
    background_color: FB.accent, button_text_color: FB.paper,
    button_background_hover_color: FB.accentInk, hover_color: FB.paper,
    ...border(FB.accent, sides(1)), button_hover_border_color: FB.accentInk,
  },
  navy: {
    background_color: FB.navy, button_text_color: FB.paper,
    button_background_hover_color: FB.accent, hover_color: FB.paper,
    ...border(FB.navy, sides(1)), button_hover_border_color: FB.accent,
  },
  outline: {
    background_color: FB.clear, button_text_color: FB.navy,
    button_background_hover_color: FB.navy, hover_color: FB.paper,
    ...border(FB.navy, sides(1)), button_hover_border_color: FB.navy,
  },
  // nas faixas de marinho: petróleo claro com texto marinho (6,1:1)
  light: {
    background_color: FB.accentLight, button_text_color: FB.navy,
    button_background_hover_color: FB.accentPale, hover_color: FB.navy,
    ...border(FB.accentLight, sides(1)), button_hover_border_color: FB.accentPale,
  },
  outlineLight: {
    background_color: FB.clear, button_text_color: FB.paper,
    button_background_hover_color: FB.paper, hover_color: FB.navy,
    ...border(FB.onDarkMuted, sides(1)), button_hover_border_color: FB.paper,
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

  const heading = (title: string, spec: TypeSpec, color: string = FB.navy, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = FB.body, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(fbAsset(path), alt), image_size: 'full', ...options })
  /** Widget HTML só com comportamento (script), nunca com conteúdo. */
  const behavior = (html: string) => widget('html', { html, _css_classes: 'fb-behavior' })

  /** Botão de canto discreto; `icon` vai antes do texto (o WhatsApp, por exemplo). */
  const button = (label: string, url: string, variant: ButtonVariant = 'primary', options: JsonRecord & { icon?: string } = {}) => {
    const { icon, ...rest } = options
    return widget('button', {
      text: label, link: link(url), size: 'md',
      ...typography(T.button),
      text_padding: sides(15, 24),
      border_radius: sides(L.radius.button),
      ...BUTTON_COLORS[variant],
      ...(icon ? { selected_icon: fa(icon), icon_align: 'left', icon_indent: px(10) } : {}),
      ...rest,
    })
  }

  /** Rótulo em caixa alta com o filete: petróleo escuro no claro, petróleo claro no marinho. */
  const eyebrow = (label: string, tone: Tone = 'light', options: JsonRecord = {}) => {
    const { _css_classes: extra, ...rest } = options as JsonRecord & { _css_classes?: string }
    return heading(label, T.eyebrow, tone === 'dark' ? FB.accentLight : FB.accentInk, { _css_classes: cls('fb-eyebrow', extra ?? ''), ...rest })
  }

  /** Cabeça de seção: rótulo, título e texto de apoio. */
  const sectionHead = (head: { label: string; title: string; lede?: string; tone?: Tone; align?: 'left' | 'center'; width?: number; ledeWidth?: number; tag?: string }, options: JsonRecord = {}) => {
    const tone = head.tone ?? 'light'
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      eyebrow(head.label, tone, align),
      heading(head.title, T.h2, tone === 'dark' ? FB.paper : FB.navy, { header_size: head.tag ?? 'h2', ...align, ...maxw(head.width ?? 760) }),
      ...(head.lede ? [text(head.lede, T.lede, tone === 'dark' ? FB.silver : FB.body, { ...align, ...maxw(head.ledeWidth ?? 620) })] : []),
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
   * O número da lei ("10 dias", "50%", "art. 483"): Zilla Slab grande, com os
   * algarismos que rolam ao entrar (`ROLL`, story.ts). Sem script é só texto.
   */
  const law = (value: string, color: string, spec: TypeSpec = T.law, options: JsonRecord = {}) => {
    const { _css_classes: extra, ...rest } = options as JsonRecord & { _css_classes?: string }
    return heading(value, spec, color, { _css_classes: cls('fb-law', ROLL, extra ?? ''), ...rest })
  }
  /** Referência da lei ("CLT, art. 477"), pequena, embaixo do número. */
  const cite = (label: string, color: string, options: JsonRecord = {}) => {
    const { _css_classes: extra, ...rest } = options as JsonRecord & { _css_classes?: string }
    return heading(label, T.cite, color, { _css_classes: cls('fb-cite', extra ?? ''), ...rest })
  }

  /** Logo com largura explícita: a marca reconhece o arquivo e mantém o tamanho. */
  const logo = (variant: keyof typeof FB_LOGO, width: number, options: JsonRecord = {}) => {
    const file = FB_LOGO[variant]
    return image(file.path, FB_NAME, {
      width: px(width), space: px(width), ...FIXED, ...AUTO,
      custom_css: `selector img{display:block;width:100%;height:auto;aspect-ratio:${file.ratio.toFixed(4)}}`,
      ...options,
    })
  }

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
      css_classes: cls(options.dark ? 'fb-dark' : '', extra),
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { uid, container, widget, col, row, grid, heading, text, image, behavior, button, eyebrow, sectionHead, list, law, cite, logo, root, section }
}

export type FbBuilder = ReturnType<typeof createBuilder>

/** Navegação da Home (âncoras). */
export const NAV: Array<[string, string]> = [
  ['Situações', '#situacoes'], ['Como funciona', '#como-funciona'], ['Os advogados', '#advogados'], ['Onde fica', '#onde-fica'], ['Dúvidas', '#duvidas'],
]

export const DESK = '(min-width:1025px)'
export const MOBILE = '(max-width:1024px)'
export const PHONE = '(max-width:767px)'
