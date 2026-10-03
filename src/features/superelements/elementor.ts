import type { SectionNodeData } from '@/types/space'
import { SE, SE_EASE, SE_FONTS, SE_LAYOUT as L, seAsset } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para o Superelements. Todo
 * container declara padding e gap, porque o Elementor põe 10px e 20px quando
 * o JSON não diz nada. Títulos em Space Grotesk, rótulos e interface em Space
 * Mono, lima só no que se clica e nas marcas pequenas. As telas do produto
 * (o canvas, o diálogo de publicar) também são nativas, em Inter, como o app.
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
/** Widget do tamanho do conteúdo (numa linha flex). */
export const AUTO = { _element_width: 'auto' } as const

export interface TypeSpec {
  font?: keyof typeof SE_FONTS
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
  [`${group}_font_family`]: SE_FONTS[spec.font ?? 'display'],
  [`${group}_font_size`]: px(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: px(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: px(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line !== undefined ? { [`${group}_line_height`]: em(spec.line) } : {}),
  ...(spec.letter !== undefined ? { [`${group}_letter_spacing`]: em(spec.letter) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
})

/** Escala do DESIGN.md. */
export const T = {
  hero: { size: 78, tablet: 60, mobile: 42, weight: 600, line: 0.98, letter: -0.04 },
  h2: { size: 56, tablet: 44, mobile: 34, weight: 600, line: 1.02, letter: -0.035 },
  h3: { size: 30, tablet: 26, mobile: 24, weight: 600, line: 1.1, letter: -0.025 },
  card: { size: 21, mobile: 19, weight: 600, line: 1.2, letter: -0.015 },
  lede: { size: 20, tablet: 19, mobile: 17, line: 1.5, letter: -0.01 },
  body: { size: 16, line: 1.6 },
  small: { size: 14, line: 1.55 },
  /** Logo: Space Grotesk 700, nunca mono (pedido do usuário). */
  brand: { size: 18, weight: 700, line: 1, letter: -0.035 },
  label: { font: 'mono', size: 12, line: 1.4, letter: 0.08, transform: 'uppercase' },
  mono: { font: 'mono', size: 13, line: 1.5 },
  monoSmall: { font: 'mono', size: 11, line: 1.4, letter: 0.04 },
  nav: { font: 'mono', size: 13, line: 1.2 },
  stat: { font: 'mono', size: 14, weight: 700, line: 1.3 },
  index: { font: 'mono', size: 13, weight: 700, line: 1, letter: 0.04 },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Bloco que o GSAP faz subir ao entrar (story.ts). Nada de entrada do Elementor no que o GSAP move. */
export const RISE = 'se-rise'

/** Link, foco, botão, textura e parágrafos: vale para toda seção do Superelements. */
const BASE_CSS = [
  'selector{overflow:clip;scroll-margin-top:72px}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p{margin:0 0 .75em}selector .elementor-widget-text-editor p:last-child{margin-bottom:0}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper,selector .elementor-widget-icon .elementor-icon-wrapper{line-height:0}',
  'selector .elementor-widget-image img{display:block}',
  'selector .se-auto{width:auto!important;max-width:100%}selector .se-faded{opacity:.4}',
  // o Elementor anima o transform dos containers (0,4s): aqui quem move é o GSAP, e o pin não pode deslizar
  'selector,selector .e-con{transition-property:background,border,box-shadow}',
  // no celular o título corre solto, sem a quebra de frase do desktop
  '@media(max-width:767px){selector h2.elementor-heading-title br{display:none}}',
  'selector .elementor-button{min-height:46px;display:inline-flex;align-items:center;justify-content:center}',
  'selector .elementor-button-icon{display:inline-flex;align-items:center;line-height:1}selector .elementor-button-icon i{font-size:.95em}',
  // destaque de uma palavra no título: lima no escuro, tinta com marcação lima no claro
  `selector .se-hl{color:${SE.lime}}selector .se-hl-light{background:linear-gradient(transparent 62%,${SE.lime} 62%,${SE.lime} 92%,transparent 92%);padding:0 .06em}`,
  `selector .se-caret{display:inline-block;width:.5em;height:.08em;margin-left:.08em;background:currentColor;vertical-align:baseline}`,
  // a grade de pontos do canvas do Space é a textura da marca
  'selector .se-dots{background-image:radial-gradient(circle at center,var(--se-dot,rgba(255,255,255,.12)) 1px,transparent 1.2px);background-size:24px 24px;background-position:12px 12px}',
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition-property:color,background-color,border-color,transform;transition-duration:180ms;transition-timing-function:${SE_EASE}}selector .elementor-button:active{transform:scale(.96)}}`,
  '@media(prefers-reduced-motion:reduce){selector *{transition:none!important;animation:none!important}}',
  `selector a:focus-visible,selector summary:focus-visible,selector button:focus-visible,selector .elementor-button:focus-visible{outline:2px solid ${SE.lime};outline-offset:3px;box-shadow:0 0 0 5px ${SE.ink}}`,
].join('')

export type ButtonVariant = 'primary' | 'ghost' | 'ink' | 'outline'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  // texto tinta na lima (15:1); branco não passa
  primary: {
    background_color: SE.lime, button_text_color: SE.ink,
    button_background_hover_color: SE.limeHover, hover_color: SE.ink,
    ...border(SE.lime), button_hover_border_color: SE.limeHover,
  },
  // contorno no escuro
  ghost: {
    background_color: 'rgba(255,255,255,0)', button_text_color: SE.onInk,
    button_background_hover_color: 'rgba(255,255,255,0.08)', hover_color: SE.white,
    ...border(SE.lineStrong), button_hover_border_color: 'rgba(255,255,255,0.4)',
  },
  // cheio em tinta, no claro
  ink: {
    background_color: SE.ink, button_text_color: SE.white,
    button_background_hover_color: '#27272A', hover_color: SE.white,
    ...border(SE.ink), button_hover_border_color: '#27272A',
  },
  // contorno no claro
  outline: {
    background_color: 'rgba(255,255,255,0)', button_text_color: SE.ink,
    button_background_hover_color: SE.ink, hover_color: SE.white,
    ...border(SE.ink), button_hover_border_color: SE.ink,
  },
}

/** Sombra de ilha do Space: anel de 1px no lugar da borda, mais uma sombra curta. */
export const ISLAND_SHADOW = '0 0 0 1px rgb(0 0 0/.06),0 1px 2px -1px rgb(0 0 0/.08),0 4px 12px -2px rgb(0 0 0/.08)'

export const createBuilder = (prefix: string) => {
  let sequence = 0
  const uid = () => `${prefix}${(++sequence).toString(36).padStart(7 - prefix.length, '0')}`

  /**
   * `inline`: largura do conteúdo (o Elementor põe 100% em todo container).
   * `box`: largura fixa em px, em todos os aparelhos.
   */
  const container = (settings: JsonRecord & { inline?: boolean; box?: number }, elements: ElementorNode[] = []): ElementorNode => {
    const { inline, box, ...rest } = settings
    const classes = [rest.css_classes, inline ? 'se-auto' : ''].filter(Boolean).join(' ')
    return {
      id: uid(), elType: 'container', isInner: true,
      settings: {
        content_width: 'full', padding: sides(0), flex_gap: gap(0),
        ...(inline || box ? { _flex_size: 'none' } : {}),
        ...(box ? { width: px(box), width_tablet: px(box), width_mobile: px(box) } : {}),
        ...rest,
        ...(classes ? { css_classes: classes } : {}),
      },
      elements,
    }
  }
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

  // espaço antes do <br>: no celular a quebra sai e as palavras não podem colar
  const heading = (title: string, spec: TypeSpec, color: string = SE.onInk, options: JsonRecord = {}) =>
    widget('heading', { title: title.replace(/\s*<br>/g, ' <br>'), header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = SE.onInkSoft, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(seAsset(path), alt), image_size: 'full', ...options })

  /** Botão de ação; `icon` vai depois do texto (a seta), `iconBefore` antes. */
  const button = (label: string, url: string, variant: ButtonVariant = 'primary', options: JsonRecord & { icon?: string; iconBefore?: boolean } = {}) => {
    const { icon, iconBefore, ...rest } = options
    return widget('button', {
      text: label, link: link(url), size: 'md',
      ...typography({ font: 'mono', size: 14, weight: 700, line: 1.2, letter: -0.01 }),
      text_padding: sides(14, 22),
      border_radius: sides(L.radius.button),
      ...BUTTON_COLORS[variant],
      ...(icon ? { selected_icon: fa(icon), icon_align: iconBefore ? 'left' : 'right', icon_indent: px(10) } : {}),
      ...rest,
    })
  }

  /** Rótulo em mono, com o colchete da marca: `[ 01 ] Produto`. */
  const label = (textValue: string, tone: Tone = 'dark', options: JsonRecord = {}) =>
    heading(textValue, T.label, tone === 'dark' ? SE.onInkSoft : SE.muted, options)

  /** Cabeça de seção: rótulo mono, título com uma frase por linha e texto de apoio. */
  const sectionHead = (head: { label: string; title: string; lede?: string; tone?: Tone; align?: 'left' | 'center'; width?: number; ledeWidth?: number }, options: JsonRecord = {}) => {
    const tone = head.tone ?? 'dark'
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      label(head.label, tone, { ...align, _css_classes: RISE }),
      heading(head.title, T.h2, tone === 'dark' ? SE.white : SE.ink, { header_size: 'h2', ...align, ...maxw(head.width ?? 980), _css_classes: RISE }),
      ...(head.lede ? [text(head.lede, T.lede, tone === 'dark' ? SE.onInkSoft : SE.body, { ...align, ...maxw(head.ledeWidth ?? 640), _css_classes: RISE })] : []),
    ], 20, { flex_align_items: center ? 'center' : 'flex-start', ...options })
  }

  /** Lista com ícone (check lima no escuro, tinta no claro). */
  const checklist = (items: string[], tone: Tone = 'dark', options: JsonRecord = {}) => widget('icon-list', {
    icon_list: items.map((item) => ({ _id: uid(), text: item, selected_icon: fa('fas fa-check') })),
    space_between: px(10),
    icon_size: px(12),
    icon_color: tone === 'dark' ? SE.lime : SE.ink,
    text_color: tone === 'dark' ? SE.onInk : SE.text,
    text_indent: px(10),
    ...typography({ size: 15, line: 1.45 }, 'icon_typography'),
    ...options,
  })

  /** Cartão: no escuro, painel com filete; no claro, branco com filete. Sem sombra. */
  const card = (elements: ElementorNode[], tone: Tone = 'dark', options: JsonRecord = {}) => col(elements, 16, {
    padding: sides(28), padding_mobile: sides(22),
    ...bg(tone === 'dark' ? SE.raised : SE.white),
    ...border(tone === 'dark' ? SE.line : SE.lineLight),
    border_radius: sides(L.radius.card),
    ...options,
  })

  /** Container raiz de uma seção: fundo de ponta a ponta, conteúdo em 1240px. */
  const root = (elements: ElementorNode[], options: { background: string; id?: string; tag?: string; css?: string; space?: number; pad?: [number, number, number] | false; classes?: string; settings?: JsonRecord }) => {
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
      ...(options.classes ? { css_classes: options.classes } : {}),
      ...options.settings,
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  /** Widget HTML só com comportamento (o script de movimento). */
  const behavior = (html: string, cls = 'se-behavior') => widget('html', { html, _css_classes: cls })

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  // ---------- telas do produto (Inter, como o app) ----------

  /** Texto da interface do app. */
  const uiText = (value: string, size = 12, color: string = SE.gray600, weight = 500, options: JsonRecord = {}) =>
    heading(value, { font: 'ui', size, weight, line: 1.25 }, color, { ...AUTO, ...FIXED, ...options })

  /**
   * Botão da interface (ícone + texto), desenhado como no app. Não é link:
   * é parte da tela mostrada. `tone`: ghost (cinza), pressed (fundo cinza),
   * dark (tinta), primary (lima).
   */
  const uiChip = (icon: string | null, value: string, options: { tone?: 'ghost' | 'pressed' | 'dark' | 'primary' | 'violet'; size?: number; classes?: string; settings?: JsonRecord } = {}) => {
    const tone = options.tone ?? 'ghost'
    const colors = {
      ghost: { fg: SE.gray600, bg: 'rgba(255,255,255,0)', icon: SE.gray500 },
      pressed: { fg: SE.gray900, bg: SE.gray100, icon: SE.gray600 },
      dark: { fg: SE.white, bg: SE.gray900, icon: SE.white },
      primary: { fg: SE.ink, bg: SE.lime, icon: SE.ink },
      violet: { fg: SE.gray900, bg: 'rgba(255,255,255,0)', icon: '#7C3AED' },
    }[tone]
    const size = options.size ?? 12
    return row([
      ...(icon ? [widget('icon', { selected_icon: fa(icon), primary_color: colors.icon, size: px(size + 1), ...FIXED, ...AUTO, align: 'left' })] : []),
      ...(value ? [uiText(value, size, colors.fg, tone === 'primary' ? 600 : 500)] : []),
    ], 6, {
      inline: true,
      min_height: px(32),
      padding: sides(0, value ? 10 : 9),
      ...bg(colors.bg),
      border_radius: sides(8),
      ...(options.classes ? { css_classes: options.classes } : {}),
      ...options.settings,
    })
  }

  /** Ilha branca da barra do canvas. */
  const island = (elements: ElementorNode[], settings: JsonRecord = {}) => row(elements, 2, {
    inline: true,
    padding: sides(4),
    ...bg(SE.white),
    border_radius: sides(12),
    css_classes: 'se-island',
    ...settings,
  })

  /** Separador vertical de 20px entre botões da ilha. */
  const divider = () => container({ box: 1, min_height: px(20), ...bg(SE.gray200), margin: sides(0, 4) })

  /** Pílula pequena (chip do quadro da página, selo do Claude). */
  const pill = (value: string, colors: { fg: string; bg: string }, icon?: string, options: JsonRecord = {}) => row([
    ...(icon ? [widget('icon', { selected_icon: fa(icon), primary_color: colors.fg, size: px(10), ...FIXED, ...AUTO })] : []),
    uiText(value, 11, colors.fg, 500),
  ], 4, { inline: true, min_height: px(20), padding: sides(0, 7), ...bg(colors.bg), border_radius: sides(999), ...options })

  return {
    uid, container, widget, col, row, grid, heading, text, image, button, label, sectionHead, checklist, card, root, behavior, section,
    uiText, uiChip, island, divider, pill,
  }
}

export type SeBuilder = ReturnType<typeof createBuilder>
