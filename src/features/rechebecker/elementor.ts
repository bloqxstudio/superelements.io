import type { SectionNodeData } from '@/types/space'
import { ERB, ERB_EASE, ERB_FONTS, ERB_LAYOUT as L, ERB_MONOGRAM, ERB_NAME, erbAsset } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para a Emmanuel Becker Advocacia
 * (partiu do padrão da Júnior Automáticos e dos escritórios de São Leopoldo).
 * Todo container declara padding e gap, porque o Elementor põe 10px e 20px
 * quando o JSON não diz nada. Títulos em IBM Plex Mono (letra por casa, como
 * no caça-palavras), texto, rótulos, menu e botões em Sora (a fonte de texto do
 * site atual).
 *
 * Para a marca aplicada por cima não mudar nada: toda cor dos settings está em
 * `ERB` (e no front matter do DESIGN.md), títulos acima de 16px usam a fonte de
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
  font?: keyof typeof ERB_FONTS
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
  [`${group}_font_family`]: ERB_FONTS[spec.font ?? 'text'],
  [`${group}_font_size`]: px(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: px(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: px(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line !== undefined ? { [`${group}_line_height`]: em(spec.line) } : {}),
  ...(spec.letter !== undefined ? { [`${group}_letter_spacing`]: em(spec.letter) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
  ...(spec.style ? { [`${group}_font_style`]: spec.style } : {}),
})

/** Escala do DESIGN.md §4. A monoespaçada tem 0,6em por letra: os títulos cabem pela contagem de letras. */
export const T = {
  hero: { font: 'title', size: 48, tablet: 44, mobile: 30, weight: 500, line: 1.1, letter: -0.03 },
  h2: { font: 'title', size: 40, tablet: 34, mobile: 26, weight: 500, line: 1.14, letter: -0.025 },
  h3: { font: 'title', size: 22, tablet: 21, mobile: 19, weight: 500, line: 1.32, letter: -0.01 },
  situation: { font: 'title', size: 19, tablet: 19, mobile: 17, weight: 500, line: 1.45, letter: -0.01 },
  numeral: { font: 'title', size: 40, tablet: 36, mobile: 30, weight: 500, line: 1, letter: -0.02 },
  /** letras do caça-palavras (o tamanho real vem do CSS da grade, pela largura da casa) */
  letters: { font: 'title', size: 24, weight: 500, line: 1, letter: 0 },
  lede: { size: 18, tablet: 17, mobile: 16, line: 1.65 },
  body: { size: 16, line: 1.7 },
  small: { size: 14, line: 1.6 },
  list: { size: 15, line: 1.55 },
  strong: { size: 15, weight: 600, line: 1.4 },
  nav: { size: 14, weight: 500, line: 1.2 },
  /** rótulo: caixa alta espaçada, com o anel do caça-palavras na frente */
  eyebrow: { size: 12, weight: 600, line: 1.4, letter: 0.16, transform: 'uppercase' },
  field: { size: 12, weight: 500, line: 1.35, letter: 0.08, transform: 'uppercase' },
  button: { size: 15, weight: 600, line: 1.2, letter: 0 },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Bloco que sobe uma vez ao entrar na tela (story.ts). Nunca junto com animação de entrada do Elementor. */
export const RISE = 'erb-rise'
/** Peças da abertura que entram em sequência ao abrir a página (story.ts). */
export const INTRO = 'erb-intro'
/** Classe extra no `_css_classes` de um widget ou no `css_classes` de um container. */
export const cls = (...names: string[]) => names.filter(Boolean).join(' ')

/**
 * Palavra achada: vermelha e circulada, como no caça-palavras. Vai dentro do
 * texto do título, então o leitor de tela lê a frase inteira normalmente.
 */
export const found = (word: string) => `<span class="erb-w">${word}</span>`

/** Link, foco, botão, rótulo, palavra achada e parágrafos: vale para toda seção da Emmanuel Becker. */
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
  'selector .elementor-button-icon{display:inline-flex;align-items:center;line-height:1}selector .elementor-button-icon i{font-size:1.1em}',
  // rótulo: o anel do caça-palavras na frente (a palavra achada)
  `selector .erb-eyebrow .elementor-heading-title{display:inline-flex;align-items:center;gap:12px}selector .erb-eyebrow .elementor-heading-title::before{content:"";width:22px;height:11px;flex:none;border:1.5px solid ${ERB.red};border-radius:99px}`,
  `selector.erb-dark .erb-eyebrow .elementor-heading-title::before{border-color:${ERB.redLight}}`,
  // palavra achada: vermelha, circulada; no grafite, o vermelho claro
  `selector .erb-w{position:relative;display:inline-block;color:${ERB.redInk};white-space:nowrap}`,
  'selector .erb-w::before{content:"";position:absolute;left:-.3em;right:-.3em;top:-.04em;bottom:-.08em;border:1.5px solid currentColor;border-radius:999px;pointer-events:none}',
  `selector.erb-dark .erb-w{color:${ERB.redLight}}`,
  'selector .erb-num .elementor-heading-title{font-variant-numeric:tabular-nums}',
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition-property:color,background-color,border-color;transition-duration:180ms;transition-timing-function:${ERB_EASE}}}`,
  // containers: a transição de fundo e borda do Elementor não pode pegar o transform do GSAP
  'selector .e-con{transition-property:background,border,box-shadow}',
  // o que o GSAP move não tem transição própria (a do Elementor deixaria o movimento arrastado)
  'selector .erb-rise,selector .erb-intro,selector .erb-puzzle,selector .erb-sign{transition:none!important}',
  '@media(prefers-reduced-motion:reduce){selector *{transition:none!important}}',
  `selector a:focus-visible,selector summary:focus-visible,selector button:focus-visible,selector .elementor-button:focus-visible,selector input:focus-visible,selector select:focus-visible,selector textarea:focus-visible{outline:2px solid ${ERB.redInk};outline-offset:3px}`,
  `selector.erb-dark a:focus-visible,selector.erb-dark summary:focus-visible,selector.erb-dark .elementor-button:focus-visible{outline-color:${ERB.onDarkStrong}}`,
].join('')

export type ButtonVariant = 'red' | 'outline' | 'outlineLight' | 'ink'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  // branco no vermelho do monograma (5:1); com o mouse, o vermelho escuro (6,5:1)
  red: {
    background_color: ERB.red, button_text_color: ERB.white,
    button_background_hover_color: ERB.redInk, hover_color: ERB.white,
    ...border(ERB.red, sides(1)), button_hover_border_color: ERB.redInk,
  },
  // contorno de grafite no claro; com o mouse, enche de grafite
  outline: {
    background_color: ERB.clear, button_text_color: ERB.ink,
    button_background_hover_color: ERB.ink, hover_color: ERB.white,
    ...border(ERB.ink, sides(1)), button_hover_border_color: ERB.ink,
  },
  // contorno claro no grafite; com o mouse, enche de claro
  outlineLight: {
    background_color: ERB.clear, button_text_color: ERB.onDarkStrong,
    button_background_hover_color: ERB.onDarkStrong, hover_color: ERB.graphite,
    ...border(ERB.onDarkMuted, sides(1)), button_hover_border_color: ERB.onDarkStrong,
  },
  ink: {
    background_color: ERB.graphite, button_text_color: ERB.white,
    button_background_hover_color: ERB.red, hover_color: ERB.white,
    ...border(ERB.graphite, sides(1)), button_hover_border_color: ERB.red,
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

  const heading = (title: string, spec: TypeSpec, color: string = ERB.ink, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = ERB.body, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(erbAsset(path), alt), image_size: 'full', ...options })
  /** Widget HTML só com comportamento (script), nunca com conteúdo. */
  const behavior = (html: string) => widget('html', { html, _css_classes: 'erb-behavior' })

  /** Botão de canto 6px; `icon` vai antes do texto (o WhatsApp, por exemplo). */
  const button = (label: string, url: string, variant: ButtonVariant = 'red', options: JsonRecord & { icon?: string } = {}) => {
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

  /** Rótulo em caixa alta com o anel vermelho: vermelho escuro no claro, claro no grafite. */
  const eyebrow = (label: string, tone: Tone = 'light', options: JsonRecord = {}) => {
    const { _css_classes: extra, ...rest } = options as JsonRecord & { _css_classes?: string }
    return heading(label, T.eyebrow, tone === 'dark' ? ERB.onDark : ERB.redInk, { _css_classes: cls('erb-eyebrow', extra ?? ''), ...rest })
  }

  /** Cabeça de seção: rótulo, título e texto de apoio. */
  const sectionHead = (head: { label: string; title: string; lede?: string; tone?: Tone; align?: 'left' | 'center'; width?: number; ledeWidth?: number; tag?: string }, options: JsonRecord = {}) => {
    const tone = head.tone ?? 'light'
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      eyebrow(head.label, tone, align),
      heading(head.title, T.h2, tone === 'dark' ? ERB.onDarkStrong : ERB.ink, { header_size: head.tag ?? 'h2', ...align, ...maxw(head.width ?? 760) }),
      ...(head.lede ? [text(head.lede, T.lede, tone === 'dark' ? ERB.onDark : ERB.body, { ...align, ...maxw(head.ledeWidth ?? 600) })] : []),
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

  /** Monograma ERB com largura explícita: a marca reconhece o arquivo e mantém o tamanho. */
  const monogram = (width: number, options: JsonRecord = {}) => image(ERB_MONOGRAM, ERB_NAME, {
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
      css_classes: cls(options.dark ? 'erb-dark' : '', extra),
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { uid, container, widget, col, row, grid, heading, text, image, behavior, button, eyebrow, sectionHead, list, monogram, root, section }
}

export type ErbBuilder = ReturnType<typeof createBuilder>

/**
 * Caça-palavras da abertura (o fundo do site atual, agora vivo): 14 casas por
 * linha. `[PALAVRA]` é uma área escondida na grade (cinza mais claro) e
 * `{PALAVRA}` é uma palavra achada (vermelha e circulada). Sai como HTML de um
 * título nativo, todo marcado `aria-hidden`: é enfeite, a frase de verdade é o h1.
 */
export const PUZZLE_ROWS = [
  'PZ[ACIDENTE]MRGB',
  'K[VOO]T[HERANÇA]JD',
  'BW{CASO}Q[PLANO]XZ',
  'R[NOME]UJ[GOLPE]YH',
  'T[DÍVIDA]XS[CNH]QW',
  'MFRBG{SOLUÇÃO}ZK',
  '[SEGURO]X[IMÓVEL]J',
  'YH[FAMÍLIA]QBTRC',
  'W[CONTRATO]EPDXG',
] as const
export const PUZZLE_COLUMNS = 14

export const puzzleHtml = (rows: readonly string[] = PUZZLE_ROWS) => {
  let found = 0
  const out = rows.map((line) => {
    let html = ''
    let count = 0
    const re = /\[([^\]]+)\]|\{([^}]+)\}|([^[{])/gu
    for (const m of line.matchAll(re)) {
      const letters = (word: string) => [...word].map((ch) => `<span class="erb-l">${ch}</span>`).join('')
      if (m[1]) { html += `<span class="erb-gw">${letters(m[1])}</span>`; count += [...m[1]].length }
      else if (m[2]) { html += `<span class="erb-gf erb-gf-${++found}">${letters(m[2])}</span>`; count += [...m[2]].length }
      else { html += `<span class="erb-l">${m[3]}</span>`; count += 1 }
    }
    if (count !== PUZZLE_COLUMNS) throw new Error(`Linha do caça-palavras com ${count} casas: ${line}`)
    return `<span class="erb-gr">${html}</span>`
  }).join('')
  return `<span class="erb-grid" aria-hidden="true">${out}</span>`
}

/** Navegação da Home (âncoras). */
export const NAV: Array<[string, string]> = [
  ['Situações', '#situacoes'], ['Como funciona', '#como-funciona'], ['O advogado', '#advogado'], ['Onde fica', '#onde-fica'], ['Dúvidas', '#duvidas'],
]

export const DESK = '(min-width:1025px)'
export const MOBILE = '(max-width:1024px)'
export const PHONE = '(max-width:767px)'
