import type { SectionNodeData } from '@/types/space'
import { MSA, MSA_EASE, MSA_FONTS, MSA_LAYOUT as L, msaAsset } from './tokens'

type JsonRecord = Record<string, unknown>

export interface ElementorNode {
  id: string
  elType: 'container' | 'widget'
  isInner: boolean
  widgetType?: string
  settings: JsonRecord
  elements: ElementorNode[]
}

export interface TypeSpec {
  font?: keyof typeof MSA_FONTS
  size: number
  tablet?: number
  mobile?: number
  weight?: number
  line?: number
  letter?: number
  transform?: string
}

export const px = (size: number) => ({ unit: 'px', size, sizes: [] })
export const vh = (size: number) => ({ unit: 'vh', size, sizes: [] })
export const em = (size: number) => ({ unit: 'em', size, sizes: [] })
export const fluid = (value: string) => ({ unit: 'custom', size: value, sizes: [] })
export const gap = (row: number, column = row) => ({ unit: 'px', size: row, row: String(row), column: String(column), isLinked: row === column })
export const sides = (top: number, right = top, bottom = top, left = right) => ({
  unit: 'px', top: String(top), right: String(right), bottom: String(bottom), left: String(left),
  isLinked: top === right && right === bottom && bottom === left,
})
export const media = (url: string, alt = '') => ({ id: '', url, alt, source: 'url', size: '' })
export const link = (url: string, external = url.startsWith('http')) => ({ url, is_external: external ? 'on' : '', nofollow: '', custom_attributes: '' })
export const bg = (color: string) => ({ background_background: 'classic', background_color: color })
export const border = (color: string, width = sides(1)) => ({ border_border: 'solid', border_width: width, border_color: color })

export const maxw = (width: number) => ({ _element_width: 'initial', _element_custom_width: fluid(`min(100%, ${width}px)`) })

export const typography = (spec: TypeSpec, group = 'typography'): JsonRecord => ({
  [`${group}_typography`]: 'custom',
  [`${group}_font_family`]: MSA_FONTS[spec.font ?? 'body'],
  [`${group}_font_size`]: px(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: px(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: px(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line !== undefined ? { [`${group}_line_height`]: em(spec.line) } : {}),
  ...(spec.letter !== undefined ? { [`${group}_letter_spacing`]: em(spec.letter) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
})

export const T = {
  hero: { font: 'display', size: 76, tablet: 60, mobile: 40, weight: 700, line: 1.02, letter: -0.015, transform: 'uppercase' },
  h2: { font: 'display', size: 52, tablet: 44, mobile: 32, weight: 700, line: 1.06, letter: -0.01, transform: 'uppercase' },
  h3: { font: 'display', size: 24, mobile: 21, weight: 700, line: 1.12, letter: -0.005, transform: 'uppercase' },
  statement: { font: 'display', size: 34, tablet: 30, mobile: 26, weight: 700, line: 1.12, letter: -0.008, transform: 'uppercase' },
  lede: { size: 20, mobile: 18, weight: 300, line: 1.6 },
  body: { size: 17, mobile: 16, weight: 400, line: 1.65 },
  small: { size: 14, weight: 400, line: 1.55 },
  nav: { size: 14, weight: 500, line: 1.2 },
  eyebrow: { size: 11, weight: 600, line: 1.3, letter: 0.18, transform: 'uppercase' },
  button: { size: 15, weight: 600, line: 1.2, letter: 0.03 },
} satisfies Record<string, TypeSpec>

/** Seta dos botões de ação (Font Awesome, como no Elementor). */
export const ARROW = { value: 'fas fa-arrow-right', library: 'fa-solid' }

const FONT_CSS = [
  `@font-face{font-family:Syne;src:url('${msaAsset('/brands/marketing-sem-agencia/assets/fonts/syne-latin.woff2')}') format('woff2');font-style:normal;font-weight:400 800;font-display:swap}`,
  `@font-face{font-family:Urbanist;src:url('${msaAsset('/brands/marketing-sem-agencia/assets/fonts/urbanist-latin.woff2')}') format('woff2');font-style:normal;font-weight:300 600;font-display:swap}`,
].join('')

/**
 * CSS comum a toda seção. O estado sem JavaScript é sempre a composição final:
 * o script de movimento (story.ts) arma os estados iniciais só quando roda.
 */
const baseCss = (dark: boolean) => [
  FONT_CSS,
  'selector{overflow:clip;scroll-margin-top:24px}',
  'selector a{text-decoration:none}',
  'selector .elementor-widget-text-editor p{margin:0 0 .85em}selector .elementor-widget-text-editor p:last-child{margin-bottom:0}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title,selector blockquote.elementor-heading-title{text-wrap:balance}',
  'selector .elementor-widget-text-editor{text-wrap:pretty}',
  '@media(min-width:1025px){selector .msa-lede-offset{margin-left:auto}}',
  'selector .elementor-widget-image,selector .elementor-button-wrapper{line-height:0}',
  'selector .elementor-button{min-height:52px;display:inline-flex;align-items:center;justify-content:center}',
  // o hero some até o script montar a entrada; sem GSAP, o próprio script libera
  'html.msa-pending selector .msa-intro{visibility:hidden}',
  // uma textura só, parada: a grade de planta do hero
  'selector.msa-grid-bg{position:relative;isolation:isolate}',
  `selector.msa-grid-bg:before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(${MSA.lineSoft} 1px,transparent 1px),linear-gradient(90deg,${MSA.lineSoft} 1px,transparent 1px);background-size:84px 84px;opacity:.22;mask-image:linear-gradient(to bottom,transparent 0,#000 20%,#000 70%,transparent 100%)}`,
  'selector.msa-grid-bg>*{position:relative;z-index:1}',
  // cards: quase quadrados, borda estrutural, sem sombra
  'selector .msa-card{position:relative;border:1px solid var(--msa-card-line);border-radius:2px}',
  `selector .msa-card-light{--msa-card-line:${MSA.line};--msa-li-line:${MSA.lineSoft}}`,
  `selector .msa-card-ink{--msa-card-line:${MSA.ink};--msa-li-line:${MSA.lineDark}}`,
  `selector .msa-card-dark{--msa-card-line:${MSA.lineDark};--msa-li-line:${MSA.lineDark};background-color:rgba(243,239,228,.04)}`,
  `selector .msa-card-sage{--msa-card-line:${MSA.sage};--msa-li-line:rgba(47,35,23,.18)}`,
  // listas dos cards: marcador desenhado (quadrado com visto, ou traço)
  'selector .msa-list ul{list-style:none;margin:0;padding:0}',
  'selector .msa-list li{position:relative;margin:0;padding:14px 0 14px 32px;border-top:1px solid var(--msa-li-line)}',
  'selector .msa-list li:before,selector .msa-list li:after{content:"";position:absolute;box-sizing:border-box}',
  `selector .msa-list-check li:before{left:0;top:17px;width:18px;height:18px;background:${MSA.sage}}`,
  `selector .msa-list-check li:after{left:6.5px;top:20px;width:5px;height:9px;border:solid ${MSA.ink};border-width:0 2px 2px 0;transform:rotate(45deg)}`,
  'selector .msa-list-dash li:before{left:0;top:17px;width:18px;height:18px;border:1px solid rgba(97,105,91,.45)}',
  `selector .msa-list-dash li:after{left:5px;top:25.25px;width:8px;height:1.5px;background:${MSA.muted}}`,
  // links de texto: sublinhado reto que se desenha da esquerda
  'selector .msa-link a{background:linear-gradient(currentColor,currentColor) 0 100%/0 1px no-repeat;padding-bottom:3px}',
  `selector .msa-link a,selector .msa-link a:visited{color:inherit}`,
  `selector a:focus-visible,selector summary:focus-visible,selector .elementor-button:focus-visible{outline:2px solid ${dark ? MSA.sage : MSA.ink};outline-offset:4px}`,
  `@media(prefers-reduced-motion:no-preference){selector .elementor-button{transition-property:color,background-color,border-color,transform;transition-duration:180ms;transition-timing-function:${MSA_EASE}}selector .elementor-button:active{transform:scale(.96)}selector .elementor-button-icon{transition:transform 200ms cubic-bezier(.2,0,0,1)}selector .msa-link a{transition:background-size 240ms cubic-bezier(.2,0,0,1)}}`,
  '@media(hover:hover) and (pointer:fine){selector .elementor-button:hover .elementor-button-icon{transform:translateX(3px)}selector .msa-link a:hover{background-size:100% 1px}}',
  '@media(max-width:767px){selector *{min-width:0}selector .elementor-heading-title{overflow-wrap:break-word}}',
].join('')

export type ButtonVariant = 'dark' | 'sage' | 'outlineLight'

const BUTTON_COLORS: Record<ButtonVariant, JsonRecord> = {
  dark: { background_color: MSA.ink, button_text_color: MSA.paper, button_background_hover_color: MSA.muted, hover_color: MSA.paper },
  sage: { background_color: MSA.sage, button_text_color: MSA.ink, button_background_hover_color: MSA.paper, hover_color: MSA.ink },
  outlineLight: { background_color: 'transparent', button_text_color: MSA.paper, button_background_hover_color: MSA.paper, hover_color: MSA.ink, ...border(MSA.lineDark) },
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
  const row = (elements: ElementorNode[], space = 0, settings: JsonRecord = {}) => container({ flex_direction: 'row', flex_wrap: 'nowrap', flex_align_items: 'center', flex_gap: gap(space), ...settings }, elements)
  const grid = (elements: ElementorNode[], columns: string, space: number | [number, number] = 0, settings: JsonRecord = {}, responsive: { tablet?: string; mobile?: string } = {}) => container({
    container_type: 'grid', grid_columns_grid: fluid(columns),
    grid_columns_grid_tablet: fluid(responsive.tablet ?? '1fr'), grid_columns_grid_mobile: fluid(responsive.mobile ?? '1fr'),
    grid_rows_grid: fluid('auto'), grid_gaps: Array.isArray(space) ? gap(space[0], space[1]) : gap(space), ...settings,
  }, elements)
  /** Container vazio que só desenha (laje, andaime, régua); o estado final vem do CSS. */
  const mark = (classes: string, settings: JsonRecord = {}) => container({ css_classes: classes, ...settings })
  const heading = (title: string, spec: TypeSpec, color: string = MSA.ink, options: JsonRecord = {}) => widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = MSA.muted, options: JsonRecord = {}) => widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (path: string, alt: string, options: JsonRecord = {}) => widget('image', { image: media(msaAsset(path), alt), image_size: 'full', ...options })
  const button = (label: string, url: string, variant: ButtonVariant = 'dark', options: JsonRecord = {}, arrow = true) => widget('button', {
    text: label, link: link(url), size: 'md', ...typography(T.button), text_padding: sides(16, 28), border_radius: sides(L.radius.button),
    ...(arrow ? { selected_icon: ARROW, icon_align: 'row-reverse', icon_indent: px(12) } : {}),
    ...BUTTON_COLORS[variant], ...options,
  })
  const eyebrow = (label: string, tone: 'light' | 'dark' = 'light', options: JsonRecord = {}) => heading(label, T.eyebrow, tone === 'dark' ? MSA.sage : MSA.muted, { _css_classes: 'msa-eyebrow', ...options })
  const rule = (color: string = MSA.line, options: JsonRecord = {}) => container({ min_height: px(1), ...bg(color), ...options })
  const root = (elements: ElementorNode[], options: { background: string; id?: string; tag?: string; css?: string; space?: number; pad?: [number, number, number] | false; settings?: JsonRecord }) => {
    const [desktop, tablet, mobile] = options.pad === false ? [0, 0, 0] : options.pad ?? [L.section.desktop, L.section.tablet, L.section.mobile]
    const node = container({
      content_width: 'boxed', boxed_width: px(L.content), flex_direction: 'column', flex_gap: gap(options.space ?? 0),
      padding: sides(desktop, L.gutter.desktop, desktop, L.gutter.desktop),
      padding_tablet: sides(tablet, L.gutter.tablet, tablet, L.gutter.tablet),
      padding_mobile: sides(mobile, L.gutter.mobile, mobile, L.gutter.mobile),
      ...bg(options.background), html_tag: options.tag ?? 'section', ...(options.id ? { _element_id: options.id } : {}),
      ...options.settings, custom_css: baseCss(options.background === MSA.ink) + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }
  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })

  return { container, widget, col, row, grid, mark, heading, text, image, button, eyebrow, rule, root, section }
}
