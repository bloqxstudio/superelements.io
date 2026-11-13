import type { SectionNodeData } from '@/types/space'

/**
 * Construtor de árvores nativas do Elementor para a LP da Sinfy no Space
 * (projeto "Sinfy", 2026-11-02). Reproduz a linguagem de /lp
 * (src/pages/ProductLanding.css) com widgets nativos: Inter, grafite e papel,
 * lima só no botão e na palavra-chave. Toda cor dos settings está no front
 * matter de brands/sinfy/DESIGN.md, então a marca ligada não muda nada.
 * As partes interativas da /lp (tour, jornada ao vivo, abas, rotina) entram
 * como fotos das telas reais, em molduras grafite.
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

export const SF = {
  dark: '#171B19',
  raised: '#242A26',
  inverse: '#F4F5EF',
  accent: '#D2F525',
  ink: '#1C241F',
  accentInk: '#526B28',
  canvas: '#F1F2ED',
  white: '#FFFFFF',
  panel: '#E4E8DC',
  muted: '#61695F',
  line: '#D9DDD4',
  onDarkMuted: '#B8BFB5',
  titleSoft: '#70786C',
  titleSoftDark: '#98A590',
  onLimeSoft: '#54651F',
  clear: 'rgba(255, 255, 255, 0)',
} as const

export const SF_LOGO = {
  onDark: '/brands/sinfy/logo/sinfy-logo-claro.png',
  onLight: '/brands/sinfy/logo/sinfy-logo-tinta.png',
  symbol: '/brands/sinfy/logo/sinfy-simbolo.svg',
  ratio: 828 / 281,
}

const L = { content: 1240, gutter: [40, 24, 20], section: [128, 96, 72] }

export const px = (size: number) => ({ unit: 'px', size, sizes: [] })
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
export const maxw = (width: number) => ({ _element_width: 'initial', _element_custom_width: fluid(`min(100%, ${width}px)`) })
export const FIXED = { _flex_size: 'none' } as const
export const FILL = { _flex_size: 'custom', _flex_grow: 1, _flex_shrink: 1 } as const
export const AUTO = { _element_width: 'auto' } as const
export const cls = (...names: string[]) => names.filter(Boolean).join(' ')

export interface TypeSpec { size: number; tablet?: number; mobile?: number; weight?: number; line?: number; letter?: number }

export const typography = (spec: TypeSpec, group = 'typography'): JsonRecord => ({
  [`${group}_typography`]: 'custom',
  [`${group}_font_family`]: 'Inter',
  [`${group}_font_size`]: px(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: px(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: px(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line !== undefined ? { [`${group}_line_height`]: em(spec.line) } : {}),
  ...(spec.letter !== undefined ? { [`${group}_letter_spacing`]: em(spec.letter) } : {}),
})

/** A escala da /lp (DESIGN.md §3). */
export const T = {
  hero: { size: 84, tablet: 66, mobile: 40, weight: 550, line: 1.04, letter: -0.06 },
  h2: { size: 64, tablet: 48, mobile: 36, weight: 550, line: 1.07, letter: -0.055 },
  statement: { size: 48, tablet: 38, mobile: 30, weight: 550, line: 1.15, letter: -0.05 },
  closing: { size: 80, tablet: 60, mobile: 42, weight: 550, line: 1.05, letter: -0.06 },
  h3: { size: 40, tablet: 34, mobile: 30, weight: 550, line: 1.1, letter: -0.045 },
  card: { size: 22, tablet: 21, mobile: 20, weight: 550, line: 1.2, letter: -0.035 },
  price: { size: 72, mobile: 60, weight: 550, line: 1, letter: -0.065 },
  lede: { size: 17, mobile: 15, line: 1.7 },
  body: { size: 15, line: 1.65 },
  small: { size: 13, line: 1.6 },
  tiny: { size: 11, line: 1.6 },
  label: { size: 12, weight: 500, line: 1.4 },
  index: { size: 12, weight: 600, line: 1.4, letter: 0.08 },
  question: { size: 15, weight: 500, line: 1.4 },
  button: { size: 14, weight: 550, line: 1.2, letter: -0.015 },
  nav: { size: 12, weight: 400, line: 1.2 },
} satisfies Record<string, TypeSpec>

/** Bloco que sobe uma vez ao entrar (o script da abertura). */
export const RISE = 'sf-rise'

const BASE_CSS = [
  'selector{overflow-x:clip;scroll-margin-top:96px}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p{margin:0 0 .8em}selector .elementor-widget-text-editor p:last-child{margin-bottom:0}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper{line-height:0}',
  'selector .elementor-button{min-height:56px;display:inline-flex;align-items:center}',
  'selector .elementor-button-content-wrapper{align-items:center;gap:28px}',
  'selector .elementor-button-icon{display:inline-flex;align-items:center}',
  // a segunda linha do título, em cinza (ou lima no escuro)
  `selector .sf-soft{color:${SF.titleSoft}}selector.sf-dark .sf-soft,selector .sf-dark .sf-soft{color:${SF.titleSoftDark}}selector .sf-lime{color:${SF.accent}}selector .sf-onlime{color:${SF.onLimeSoft}}`,
  // rótulo: o círculo de 7px em contorno na frente
  'selector .sf-label .elementor-heading-title{display:inline-flex;align-items:center;gap:10px}selector .sf-label .elementor-heading-title::before{content:"";width:7px;height:7px;border:1px solid currentColor;border-radius:50%;flex:none}',
  `selector .sf-dot .elementor-heading-title{display:inline-flex;align-items:center;gap:10px}selector .sf-dot .elementor-heading-title::before{content:"";width:6px;height:6px;border-radius:50%;background:${SF.accent};flex:none}`,
  'selector .sf-shot img{display:block;width:100%;height:auto}',
  '@media(prefers-reduced-motion:no-preference){selector .elementor-button,selector a{transition-property:color,background-color,border-color,transform;transition-duration:150ms}}',
  'selector .elementor-button:active{transform:scale(.98)}',
  'selector .e-con{transition-property:background,border,box-shadow}',
  'selector .sf-rise{transition:none!important}',
  `selector a:focus-visible,selector summary:focus-visible,selector .elementor-button:focus-visible{outline:2px solid ${SF.accentInk};outline-offset:5px}`,
  `selector.sf-dark a:focus-visible,selector.sf-dark .elementor-button:focus-visible{outline-color:${SF.accent}}`,
].join('')

export type ButtonVariant = 'primary' | 'light' | 'ghost'

const BUTTONS: Record<ButtonVariant, JsonRecord> = {
  primary: { background_color: SF.accent, button_text_color: SF.ink, button_background_hover_color: '#BDDB2E', hover_color: SF.ink, ...border(SF.accent), button_hover_border_color: '#BDDB2E' },
  light: { background_color: SF.inverse, button_text_color: SF.ink, button_background_hover_color: '#DFE5D8', hover_color: SF.ink, ...border(SF.inverse), button_hover_border_color: '#DFE5D8' },
  ghost: { background_color: SF.clear, button_text_color: SF.ink, button_background_hover_color: SF.ink, hover_color: SF.inverse, ...border(SF.ink), button_hover_border_color: SF.ink },
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
  const col = (elements: ElementorNode[], space = 0, settings: JsonRecord = {}) => container({ flex_direction: 'column', flex_gap: gap(space), ...settings }, elements)
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

  const heading = (title: string, spec: TypeSpec, color: string = SF.ink, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = SF.muted, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (url: string, alt: string, options: JsonRecord = {}) => widget('image', { image: media(url, alt), image_size: 'full', ...options })
  const behavior = (html: string) => widget('html', { html, _css_classes: 'sf-behavior' })

  /** Botão em pílula, com a seta no fim. */
  const button = (label: string, url: string, variant: ButtonVariant = 'primary', options: JsonRecord = {}) => widget('button', {
    text: label, link: link(url), size: 'md', ...typography(T.button),
    text_padding: sides(16, 24), border_radius: sides(999),
    selected_icon: fa('fas fa-arrow-right'), icon_align: 'right', icon_indent: px(28),
    ...BUTTONS[variant], ...options,
  })

  /** Rótulo pequeno com o círculo em contorno. */
  const label = (textLabel: string, color: string = SF.ink, options: JsonRecord = {}) =>
    heading(textLabel, T.label, color, { _css_classes: 'sf-label', ...options })

  /** Título em duas partes: a segunda em cinza (`soft`), lima (`lime`) ou verde sobre a lima (`onlime`). */
  const title = (first: string, second: string | undefined, spec: TypeSpec, color: string, tone: 'soft' | 'lime' | 'onlime' = 'soft', options: JsonRecord = {}) =>
    heading(second ? `${first}<br><span class="sf-${tone}">${second}</span>` : first, spec, color, { header_size: 'h2', ...options })

  /** Lista com o check verde (ou lima, no escuro). */
  const checks = (items: readonly string[], dark = false, options: JsonRecord = {}) => widget('icon-list', {
    icon_list: items.map((item) => ({ _id: uid(), text: item, selected_icon: fa('fas fa-check') })),
    space_between: px(14), icon_color: dark ? SF.accent : SF.accentInk, icon_size: px(13), text_indent: px(10),
    text_color: dark ? SF.onDarkMuted : SF.ink, ...typography(T.small, 'icon_typography'), ...options,
  })

  /** Foto de uma tela do produto numa moldura grafite (como `.lp-hero__demo`). */
  const shot = (url: string, alt: string, caption: string, options: JsonRecord & { tone?: 'dark' | 'panel' } = {}) => {
    const { tone = 'dark', ...rest } = options
    return col([
      ...(caption ? [heading(caption, T.tiny, tone === 'dark' ? SF.onDarkMuted : SF.muted, { _css_classes: tone === 'dark' ? 'sf-dot' : '', _padding: sides(8, 12, 12, 12) })] : []),
      image(url, alt, { _css_classes: 'sf-shot', image_border_radius: sides(14), custom_css: 'selector img{border-radius:14px}' }),
    ], 0, {
      padding: sides(12), padding_mobile: sides(6),
      ...bg(tone === 'dark' ? SF.raised : SF.panel), ...border(tone === 'dark' ? 'rgba(255, 255, 255, 0.12)' : SF.line),
      border_radius: sides(22), ...rest,
    })
  }

  const logo = (variant: 'onDark' | 'onLight', width: number, options: JsonRecord = {}) => image(SF_LOGO[variant], 'Sinfy', {
    width: px(width), space: px(width), ...FIXED, ...AUTO,
    custom_css: `selector img{display:block;width:100%;height:auto;aspect-ratio:${SF_LOGO.ratio.toFixed(4)}}`,
    ...options,
  })

  /** Container raiz: fundo de ponta a ponta, conteúdo em 1240px. */
  const root = (elements: ElementorNode[], options: { background: string; id?: string; tag?: string; css?: string; space?: number; pad?: [number, number, number]; dark?: boolean; settings?: JsonRecord }) => {
    const [d, t, m] = options.pad ?? (L.section as [number, number, number])
    const extra = (options.settings?.css_classes as string | undefined) ?? ''
    const node = container({
      content_width: 'boxed', boxed_width: px(L.content),
      flex_direction: 'column', flex_gap: gap(options.space ?? 0),
      padding: sides(d, L.gutter[0], d, L.gutter[0]),
      padding_tablet: sides(t, L.gutter[1], t, L.gutter[1]),
      padding_mobile: sides(m, L.gutter[2], m, L.gutter[2]),
      ...bg(options.background),
      html_tag: options.tag ?? 'section',
      ...(options.id ? { _element_id: options.id } : {}),
      ...options.settings,
      css_classes: cls(options.dark ? 'sf-dark' : '', extra),
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  const section = (sectionTitle: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title: sectionTitle, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { uid, container, widget, col, row, grid, heading, text, image, behavior, button, label, title, checks, shot, logo, root, section }
}

export const NAV: Array<[string, string]> = [['#operacao', 'Operação ao vivo'], ['#solucoes', 'Plataforma'], ['#por-que', 'Para agências'], ['#planos', 'Planos']]

export const TELA = (name: string) => `.space/sinfy/build/telas/${name}.webp`
