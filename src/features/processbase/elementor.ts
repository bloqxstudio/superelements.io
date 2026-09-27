import type { SectionNodeData } from '@/types/space'
import { PB, PB_EASE, PB_FONT, PB_LAYOUT as L, pbAsset } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para a ProcessBase. Todo
 * container declara padding e gap, porque o Elementor põe 10px e 20px quando
 * o JSON não diz nada. Os cards seguem a moldura dupla do protótipo da
 * landing (casca fina + miolo), sem sombra, como pede o DESIGN.md.
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

export type Tone = 'dark' | 'light'

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
export const link = (url: string, external = false) => ({ url, is_external: external ? 'on' : '', nofollow: '', custom_attributes: '' })
export const bg = (color: string) => ({ background_background: 'classic', background_color: color })
export const border = (color: string, width = sides(1)) => ({ border_border: 'solid', border_width: width, border_color: color })

/** Item flex que não cresce nem encolhe. */
export const FIXED = { _flex_size: 'none' } as const
/** Medida de leitura: nunca passa da coluna. */
export const maxw = (width: number) => ({ _element_width: 'initial', _element_custom_width: fluid(`min(100%, ${width}px)`) })

export interface TypeSpec {
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
  [`${group}_font_family`]: PB_FONT,
  [`${group}_font_size`]: px(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: px(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: px(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line !== undefined ? { [`${group}_line_height`]: em(spec.line) } : {}),
  ...(spec.letter !== undefined ? { [`${group}_letter_spacing`]: em(spec.letter) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
})

/** Escala do DESIGN.md: títulos em Inter 400, nunca negrito; o peso vem do tamanho. */
export const T = {
  hero: { size: 64, tablet: 52, mobile: 40, line: 1.02, letter: -0.05 },
  h2: { size: 48, tablet: 40, mobile: 32, line: 1.05, letter: -0.042 },
  sub: { size: 30, tablet: 26, mobile: 24, line: 1.08, letter: -0.033 },
  card: { size: 24, tablet: 22, mobile: 21, line: 1.12, letter: -0.025 },
  cardSm: { size: 19, line: 1.2, letter: -0.018 },
  lede: { size: 18, mobile: 16, line: 1.55 },
  body: { size: 15, line: 1.55 },
  small: { size: 13, line: 1.45 },
  eyebrow: { size: 12, weight: 700, line: 1.4, letter: 0.15, transform: 'uppercase' },
  micro: { size: 11, weight: 500, line: 1.4, letter: 0.12, transform: 'uppercase' },
  num: { size: 13, weight: 500, line: 1.4, letter: 0.04 },
  stat: { size: 30, tablet: 28, mobile: 22, line: 1, letter: -0.03 },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/**
 * Destaque dentro de um título, como no hero: a frase-chave em semibold, em
 * ardósia no navy e em ardósia escura no claro (a #829AAF não passa contraste
 * no branco). No cartão laranja, só o peso muda. É a única exceção à regra de
 * títulos em Inter 400.
 */
export const hl = (text: string, tone: Tone | 'orange' = 'dark') => `<span class="pb-hl pb-hl--${tone}">${text}</span>`

/** Entrada curta (DESIGN.md §5): texto sobe, bloco grande só aparece. */
export const reveal = (delay = 0, target: 'widget' | 'container' = 'widget', name = 'fadeInUp') => (target === 'widget'
  ? { _animation: name, _animation_delay: delay, animation_duration: 'fast' }
  : { animation: name, animation_delay: delay, animation_duration: 'fast' })

/** Link, foco, rótulo e parágrafos: vale para toda seção da ProcessBase. */
const BASE_CSS = [
  'selector{overflow-x:clip;scroll-margin-top:88px}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p:last-child{margin-block-end:0}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper{line-height:0}',
  // hover só troca cor (DESIGN.md §5)
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a,selector .pb-core{transition-property:color,background-color,border-color;transition-duration:200ms;transition-timing-function:${PB_EASE}}}`,
  // pressionar afunda o botão; o hover continua só na cor
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button{transition-property:color,background-color,border-color,transform}selector .elementor-button:active{transform:scale(.96)}}`,
  'selector .elementor-button{min-height:44px;display:inline-flex;align-items:center;justify-content:center}',
  // seta dos CTAs: depois do texto, no tamanho da letra, e desliza 3px no hover
  'selector .pb-btn-arrow .elementor-button-content-wrapper{flex-direction:row-reverse;align-items:center}',
  'selector .elementor-button-icon{display:inline-flex;align-items:center;line-height:1}selector .elementor-button-icon i{font-size:.85em}selector .elementor-button-icon svg{width:.85em;height:.85em;fill:currentColor}',
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button-icon{transition:transform 200ms ${PB_EASE}}selector .elementor-button:hover .elementor-button-icon,selector .elementor-button:focus-visible .elementor-button-icon{transform:translateX(3px)}}`,
  'selector .pb-panel-head{min-height:64px}',
  `selector .pb-panel-head>.elementor-widget-heading:last-child .elementor-heading-title{padding:6px 9px;border:1px solid ${PB.lineStrong};border-radius:4px}`,
  'selector .pb-frame{height:100%}selector .pb-frame>.pb-core{height:100%}',
  `selector .pb-frame:hover>.pb-core{border-color:${PB.slate}}`,
  '@media(prefers-reduced-motion:no-preference){@keyframes pbEntrance{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}selector .animated.fadeInUp{animation-name:pbEntrance;animation-duration:480ms;animation-timing-function:cubic-bezier(.2,.7,.2,1)}selector .animated.fadeIn{animation-duration:480ms}}',
  '@media(prefers-reduced-motion:reduce){selector .animated,selector.animated{animation:none!important}selector .elementor-invisible{visibility:visible!important}}',
  `selector a:focus-visible,selector summary:focus-visible,selector button:focus-visible,selector .elementor-button:focus-visible{outline:2px solid ${PB.orange};outline-offset:3px}`,
  // destaque nos títulos (hl): a frase-chave em semibold, na voz secundária da marca
  `selector .pb-hl{font-weight:600;letter-spacing:-.035em}selector .pb-hl--dark{color:${PB.slate}}selector .pb-hl--light{color:${PB.slateInk}}selector .pb-hl--orange{color:inherit}`,
  // rótulo com o filete laranja à frente: o laranja marca, o texto fica legível
  `selector .pb-eyebrow .elementor-heading-title::before{content:"";display:inline-block;width:20px;height:2px;margin-right:12px;vertical-align:middle;background:${PB.orange}}`,
  '@media (prefers-reduced-motion:reduce){selector .elementor-button,selector a{transition:none}}',
].join('')

/**
 * Texturas das seções, adaptadas dos fundos da biblioteca
 * (section-pack/decorativeBackgroundPresets: pontilhado, grade e grão), mais a
 * hachura 2:1 dos cortes do emblema. Ficam num pseudo-elemento atrás do
 * conteúdo e somem por máscara, para não disputar com o texto. `at` é onde a
 * textura fica mais forte (posição CSS, ex.: "90% 0%").
 */
const fade = (at: string, size = '60% 70%') => {
  const m = `radial-gradient(ellipse ${size} at ${at},#000 5%,transparent 75%)`
  return `-webkit-mask-image:${m};mask-image:${m}`
}
const layer = (pseudo: 'before' | 'after', css: string) =>
  `selector{isolation:isolate}selector::${pseudo}{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;${css}}`

export const texture = {
  /** Pontos de 1px numa grade quadrada. */
  dots: (color: string, at: string, size = 20, spread?: string) =>
    layer('before', `background-image:radial-gradient(circle,${color} 1px,transparent 1.4px);background-size:${size}px ${size}px;${fade(at, spread)}`),
  /** Grade de linhas finas: estrutura. */
  grid: (color: string, at: string, size = 44, spread?: string) =>
    layer('before', `background-image:linear-gradient(${color} 1px,transparent 1px),linear-gradient(90deg,${color} 1px,transparent 1px);background-size:${size}px ${size}px;background-position:center top;${fade(at, spread)}`),
  /** Grão fino, para o navy não ficar liso demais. */
  grain: (color: string, at: string, spread?: string) =>
    layer('before', `background-image:radial-gradient(${color} .7px,transparent .8px);background-size:5px 5px;${fade(at, spread)}`),
  /** Hachura na inclinação 2:1 dos cortes do emblema (DESIGN.md §5). */
  hatch: (color: string, at: string, gap = 12, spread?: string) =>
    layer('before', `background-image:repeating-linear-gradient(116.57deg,${color} 0 1px,transparent 1px ${gap}px);${fade(at, spread)}`),
  /** Luz difusa (o spotlight dos fundos da biblioteca), no ::after. */
  glow: (color: string, at: string, size = '55% 60%') =>
    layer('after', `background:radial-gradient(ellipse ${size} at ${at},${color},transparent 70%)`),
}

/** Anel de progresso num heading: o número fica editável, o arco vem do CSS. */
export const RING_CSS = (steps: number[], track: string, hole: string) => [
  `selector .pb-ring .elementor-heading-title{--pb-v:0%;display:flex;align-items:center;justify-content:center;aspect-ratio:1;border-radius:50%;font-variant-numeric:tabular-nums;background:radial-gradient(closest-side,${hole} calc(100% - var(--pb-t,8px)),transparent calc(100% - var(--pb-t,8px) + .5px)),conic-gradient(${PB.orange} var(--pb-v),${track} 0)}`,
  'selector .pb-ring small{font-size:.42em;opacity:.6;margin:.5em 0 0 1px}',
  ...steps.map((step) => `selector .pb-ring--${step} .elementor-heading-title{--pb-v:${step}%}`),
].join('')

/** Seta dos CTAs: um ícone só, recolorido pelo texto (currentColor). */
export const ARROW = { value: 'fas fa-arrow-right', library: 'fa-solid' }

export type ButtonVariant = 'primary' | 'outline' | 'outlineLight' | 'navy'
export type ButtonSize = 'sm' | 'md'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  // texto branco no laranja (escolha do usuário: 3,1:1, abaixo do AA; o semibold ajuda a ler)
  primary: {
    background_color: PB.orange, button_text_color: PB.white,
    button_background_hover_color: PB.orangeHover, hover_color: PB.white,
    border_border: 'solid', border_width: sides(1.5), border_color: PB.orange, button_hover_border_color: PB.orangeHover,
  },
  outline: {
    background_color: 'rgba(255,255,255,0)', button_text_color: PB.white,
    button_background_hover_color: 'rgba(255,255,255,0.06)', hover_color: PB.white,
    border_border: 'solid', border_width: sides(1.5), border_color: 'rgba(255,255,255,0.36)', button_hover_border_color: PB.white,
  },
  outlineLight: {
    background_color: 'rgba(255,255,255,0)', button_text_color: PB.navy,
    button_background_hover_color: PB.navy, hover_color: PB.white,
    border_border: 'solid', border_width: sides(1.5), border_color: PB.navy, button_hover_border_color: PB.navy,
  },
  navy: {
    background_color: PB.navy, button_text_color: PB.white,
    button_background_hover_color: PB.white, hover_color: PB.navy,
    border_border: 'solid', border_width: sides(1.5), border_color: PB.navy, button_hover_border_color: PB.white,
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

  const heading = (title: string, spec: TypeSpec, color: string = PB.ink, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = PB.body, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(pbAsset(path), alt), image_size: 'full', ...options })
  const divider = (color: string, options: JsonRecord = {}) =>
    widget('divider', { style: 'solid', weight: px(1), color, gap: px(0), ...options })

  // o laranja leva a seta (ícone nativo, editável no Elementor) e texto semibold
  const button = (label: string, url: string, variant: ButtonVariant = 'primary', kind: ButtonSize = 'md', options: JsonRecord = {}) => widget('button', {
    text: label, link: link(url), size: kind,
    ...typography({ size: kind === 'sm' ? 14 : 15, weight: variant === 'primary' ? 600 : 500, line: 1.2 }),
    text_padding: kind === 'sm' ? sides(10, 18) : sides(14, 24),
    border_radius: sides(L.radius.button),
    ...BUTTON_COLORS[variant],
    ...(variant === 'primary' ? { selected_icon: ARROW, icon_align: 'row-reverse', icon_indent: px(10) } : {}),
    ...options,
    _css_classes: [variant === 'primary' ? 'pb-btn-arrow' : '', options._css_classes].filter(Boolean).join(' '),
  })

  /** Rótulo em caixa alta com o filete laranja: ardósia no navy, navy no claro. */
  const eyebrow = (label: string, tone: Tone, options: JsonRecord = {}) =>
    heading(label, T.eyebrow, tone === 'dark' ? PB.slate : PB.ink, { _css_classes: 'pb-eyebrow', ...options })

  /** Cabeça de seção: rótulo, título e texto de apoio. */
  const sectionHead = (head: { label: string; title: string; lede?: string; tone: Tone; align?: 'left' | 'center'; width?: number }, options: JsonRecord = {}) => {
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      eyebrow(head.label, head.tone, { ...align, ...reveal(0) }),
      heading(head.title, T.h2, head.tone === 'dark' ? PB.white : PB.ink, { header_size: 'h2', ...align, ...maxw(head.width ?? 880), ...reveal(80) }),
      ...(head.lede ? [text(head.lede, T.lede, head.tone === 'dark' ? PB.onNavy : PB.body, { ...align, ...maxw(640), ...reveal(160) })] : []),
    ], 22, { flex_align_items: center ? 'center' : 'flex-start', css_classes: 'pb-head', ...options })
  }

  /**
   * Moldura dupla: casca de 6px e miolo com raio de 16px. No navy a casca é
   * ardósia translúcida; no claro, cinza-frio. Devolve a casca; o miolo é
   * `shell.elements[0]`.
   */
  const frame = (elements: ElementorNode[], tone: Tone, core: JsonRecord = {}, shell: JsonRecord = {}) => {
    const dark = tone === 'dark'
    const inner = col(elements, 0, {
      ...bg(dark ? PB.navyRaised : PB.white),
      ...border(dark ? 'rgba(255,255,255,0.06)' : '#DDE0E5'),
      border_radius: sides(L.radius.card),
      overflow: 'hidden',
      css_classes: 'pb-core',
      ...core,
    })
    return col([inner], 0, {
      padding: sides(6),
      ...bg(dark ? PB.shellDark : PB.shellLight),
      ...border(dark ? 'rgba(130,154,175,0.16)' : '#DADDE3'),
      border_radius: sides(L.radius.shell),
      css_classes: 'pb-frame',
      ...shell,
    })
  }

  /** Cabeçalho de painel: rótulo à esquerda, etiqueta laranja à direita, filete embaixo. */
  const panelHead = (label: string, tag: string, tone: Tone, options: JsonRecord = {}) => row([
    heading(label, T.small, tone === 'dark' ? PB.onNavy : PB.body, FIXED),
    heading(tag, tweak(T.micro, { size: 10, weight: 700, letter: 0.16 }), tone === 'dark' ? PB.orange : PB.ink, FIXED),
  ], 16, {
    flex_justify_content: 'space-between',
    padding: sides(20, 24), padding_mobile: sides(18, 20),
    ...border(tone === 'dark' ? PB.line : '#E3E5EA', sides(0, 0, 1, 0)),
    css_classes: 'pb-panel-head',
    ...options,
  })

  /** Anel de progresso (ver RING_CSS). `value` pode ter `<small>`. */
  const ring = (value: string, percent: number, box: number, spec: TypeSpec, color: string, options: JsonRecord = {}) =>
    heading(value, spec, color, { _css_classes: `pb-ring pb-ring--${percent}`, _element_width: 'initial', _element_custom_width: px(box), ...FIXED, ...options })

  /** Container raiz de uma seção: fundo de ponta a ponta, conteúdo em 1280px. */
  const root = (elements: ElementorNode[], options: { background: string; id?: string; tag?: string; css?: string; space?: number; pad?: [number, number, number] | false; settings?: JsonRecord }) => {
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
      ...options.settings,
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { container, widget, col, row, grid, heading, text, image, divider, button, eyebrow, sectionHead, frame, panelHead, ring, root, section }
}

export type PBBuilder = ReturnType<typeof createBuilder>
