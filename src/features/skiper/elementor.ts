import { SK, SK_EASE as E, SK_FONTS, SK_LAYOUT as L, SK_PHOTOS, skAsset, type SkPhoto } from './tokens'

/**
 * Construtor de árvores nativas do Elementor para o experimento Skiper UI (no
 * padrão do Avence Studio). Todo container declara padding e gap, porque o
 * Elementor põe 10px e 20px quando o JSON não diz nada. Os efeitos vivem no
 * CSS das seções e num único script de comportamento (motion.ts), no
 * cabeçalho; sem o script, o CSS já é a composição final.
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
export const bg = (color: string) => ({ background_background: 'classic', background_color: color })

/** Item flex que não cresce nem encolhe. */
export const FIXED = { _flex_size: 'none' } as const
/** Largura automática (o widget do tamanho do conteúdo). */
export const AUTO = { _element_width: 'auto' } as const
/** Medida de leitura: nunca passa da coluna. */
export const maxw = (width: number) => ({ _element_width: 'initial', _element_custom_width: fluid(`min(100%, ${width}px)`) })
export const cls = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(' ')

export const DESK = '(min-width:1025px)'
export const MOBILE = '(max-width:1024px)'
export const PHONE = '(max-width:767px)'
export const MOTION = '(prefers-reduced-motion:no-preference)'

export interface TypeSpec {
  font?: keyof typeof SK_FONTS
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
  [`${group}_font_family`]: SK_FONTS[spec.font ?? 'sans'],
  [`${group}_font_size`]: px(spec.size),
  ...(spec.tablet !== undefined ? { [`${group}_font_size_tablet`]: px(spec.tablet) } : {}),
  ...(spec.mobile !== undefined ? { [`${group}_font_size_mobile`]: px(spec.mobile) } : {}),
  [`${group}_font_weight`]: String(spec.weight ?? 400),
  ...(spec.line !== undefined ? { [`${group}_line_height`]: em(spec.line) } : {}),
  ...(spec.letter !== undefined ? { [`${group}_letter_spacing`]: em(spec.letter) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
})

/** Escala tirada das demos da Skiper (Geist bold e apertada nos títulos, mono nos índices). */
export const T = {
  /** skiper31: caixa alta, bold, tracking-tighter */
  display: { size: 168, tablet: 112, mobile: 58, weight: 700, line: 0.84, letter: -0.06, transform: 'uppercase' },
  /** skiper19: font-medium, tracking -0.08em */
  giant: { size: 128, tablet: 92, mobile: 54, weight: 500, line: 0.9, letter: -0.08 },
  h2: { size: 64, tablet: 50, mobile: 38, weight: 600, line: 0.95, letter: -0.05 },
  h3: { size: 24, tablet: 22, mobile: 20, weight: 500, line: 1.15, letter: -0.02 },
  lede: { size: 18, tablet: 17, mobile: 16, line: 1.5, letter: -0.01 },
  body: { size: 16, mobile: 15, line: 1.6 },
  small: { size: 13, line: 1.5 },
  /** skiper28: text-6xl bold tracking-tighter */
  crawl: { size: 60, tablet: 46, mobile: 30, weight: 700, line: 1.04, letter: -0.05 },
  number: { size: 132, tablet: 96, mobile: 72, weight: 500, line: 0.9, letter: -0.06 },
  /** o rótulo "role para ver" das demos: text-xs, caixa alta, entrelinha curta */
  hint: { size: 12, weight: 500, line: 1.15, letter: 0.02, transform: 'uppercase' },
  index: { font: 'mono', size: 12, weight: 500, line: 1.3, letter: 0.02, transform: 'uppercase' },
  nav: { size: 13, weight: 500, line: 1.2, letter: -0.01 },
  micro: { font: 'mono', size: 11, weight: 500, line: 1.45, letter: 0.02, transform: 'uppercase' },
} satisfies Record<string, TypeSpec>

export const tweak = (spec: TypeSpec, patch: Partial<TypeSpec>): TypeSpec => ({ ...spec, ...patch })

/** Bloco que sobe uma vez ao entrar na tela (motion.ts). */
export const RISE = 'sk-rise'

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Texto que rola letra a letra com o mouse (skiper58): duas camadas de letras,
 * a de baixo entra enquanto a de cima sai, com atraso a partir do centro. Quem
 * lê a tela ouve só a palavra (`sk-sr`).
 */
export const rollHtml = (word: string) => {
  const chars = [...word]
  const mid = (chars.length - 1) / 2
  const layer = chars.map((c, i) => `<span class="sk-l" style="--i:${Math.abs(i - mid).toFixed(1)}">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')
  return `<span class="sk-sr">${esc(word)}</span><span class="sk-roll" aria-hidden="true"><span class="sk-roll-a">${layer}</span><span class="sk-roll-b">${layer}</span></span>`
}

/** O que vale para toda seção do laboratório. */
const BASE_CSS = [
  'selector{overflow-x:clip;scroll-margin-top:24px}',
  'selector,selector *{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
  'selector .sk-auto{--width:auto;width:auto!important;max-width:100%;flex:0 0 auto}',
  'selector a{text-decoration:none;color:inherit}',
  'selector .elementor-heading-title{margin:0}',
  'selector .elementor-widget-text-editor p{margin:0 0 .85em}selector .elementor-widget-text-editor p:last-child{margin-bottom:0}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title{text-wrap:balance}',
  'selector .elementor-widget-image{line-height:0}selector .elementor-widget-image img{display:block}',
  'selector .sk-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
  // números da página em algarismos de mesma largura
  'selector .sk-num .elementor-heading-title{font-variant-numeric:tabular-nums}',
  // o rótulo "role para ver" das demos: texto a 40% e um fio de 64px que vai do fundo à tinta
  'selector .sk-hint .elementor-heading-title{position:relative;display:inline-block;max-width:12ch;opacity:.45;padding-bottom:76px}',
  `selector .sk-hint .elementor-heading-title::after{content:"";position:absolute;left:50%;bottom:0;width:1px;height:64px;background:linear-gradient(to bottom,rgba(10,10,10,0),${SK.ink})}`,
  `selector.sk-dark .sk-hint .elementor-heading-title::after{background:linear-gradient(to bottom,rgba(245,244,243,0),${SK.onDark})}`,
  // índice mono entre colchetes: [ 02 ] skiper16
  'selector .sk-index .elementor-heading-title{display:inline-flex;gap:.9em;align-items:center}',
  `selector .sk-index .sk-ref{color:${SK.orange}}`,
  // o texto que rola (skiper58)
  'selector .sk-roll{position:relative;display:inline-block;overflow:hidden;vertical-align:top;line-height:1.2}',
  'selector .sk-roll-a,selector .sk-roll-b{display:block;white-space:nowrap}selector .sk-roll-b{position:absolute;inset:0}',
  'selector .sk-l{display:inline-block}selector .sk-roll-b .sk-l{transform:translateY(100%)}',
  `@media(hover:hover) and ${MOTION}{selector .sk-l{transition:transform .5s ${E.inOut} calc(var(--i) * 35ms)}`,
  'selector a:hover .sk-roll-a .sk-l,selector a:focus-visible .sk-roll-a .sk-l{transform:translateY(-100%)}',
  'selector a:hover .sk-roll-b .sk-l,selector a:focus-visible .sk-roll-b .sk-l{transform:translateY(0)}}',
  // containers, inclusive a própria seção: a transição do Elementor (transform .4s) não pode pegar o transform do GSAP
  'selector,selector .e-con{transition-property:background,border,box-shadow}',
  'selector .sk-rise,selector .sk-move{transition:none!important}',
  `@media ${MOTION}{selector .elementor-button,selector a{transition-property:color,background-color,border-color,opacity;transition-duration:200ms}}`,
  '@media(prefers-reduced-motion:reduce){selector *{transition:none!important}}',
  `selector a:focus-visible,selector .elementor-button:focus-visible{outline:2px solid ${SK.orange};outline-offset:3px}`,
].join('')

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

  const heading = (title: string, spec: TypeSpec, color: string = SK.ink, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec = T.body, color: string = SK.body, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (photo: SkPhoto, options: JsonRecord = {}) =>
    widget('image', { image: media(skAsset(SK_PHOTOS[photo].path), SK_PHOTOS[photo].alt), image_size: 'full', ...options })
  /** Widget HTML só com comportamento (script), nunca com conteúdo. */
  const behavior = (html: string) => widget('html', { html, _css_classes: 'sk-behavior' })

  /** Container com a foto como fundo nativo (sobe junto ao publicar). */
  const photoBox = (photo: SkPhoto, settings: JsonRecord = {}, elements: ElementorNode[] = []) => container({
    background_background: 'classic',
    background_image: { id: '', url: skAsset(SK_PHOTOS[photo].path), source: 'url', alt: SK_PHOTOS[photo].alt },
    background_repeat: 'no-repeat', background_size: 'cover', background_position: 'center center',
    ...settings,
  }, elements)

  /** "role para ver": o rótulo das demos da Skiper, com o fio embaixo. */
  const hint = (label: string, tone: Tone = 'light', options: JsonRecord = {}) =>
    heading(label, T.hint, tone === 'dark' ? SK.onDark : SK.ink, { align: 'center', _css_classes: 'sk-hint', ...options })

  /** Índice do efeito: [ 02 ] e o componente da Skiper, em mono. */
  const index = (n: string, ref: string, tone: Tone = 'light', options: JsonRecord = {}) =>
    heading(`<span>[ ${n} ]</span><span class="sk-ref">${ref}</span>`, T.index, tone === 'dark' ? SK.onDarkMuted : SK.muted, { _css_classes: 'sk-index', ...options })

  /** Cabeça de seção do laboratório: índice, nome do efeito e uma frase. */
  const labHead = (head: { n: string; ref: string; title: string; lede?: string; tone?: Tone; align?: 'left' | 'center'; width?: number }, options: JsonRecord = {}) => {
    const tone = head.tone ?? 'light'
    const center = head.align === 'center'
    const align = center ? { align: 'center' } : {}
    return col([
      index(head.n, head.ref, tone, align),
      heading(head.title, T.h2, tone === 'dark' ? SK.onDark : SK.ink, { header_size: 'h2', ...align, ...maxw(head.width ?? 760) }),
      ...(head.lede ? [text(head.lede, T.lede, tone === 'dark' ? SK.onDarkMuted : SK.body, { ...align, ...maxw(540) })] : []),
    ], 18, { flex_align_items: center ? 'center' : 'flex-start', css_classes: RISE, ...options })
  }

  /** Container raiz de uma seção: fundo de ponta a ponta, conteúdo em 1240px. */
  const root = (elements: ElementorNode[], options: { background: string; id?: string; css?: string; space?: number; pad?: [number, number, number] | false; dark?: boolean; full?: boolean; settings?: JsonRecord }) => {
    const [desktop, tablet, mobile] = options.pad === false ? [0, 0, 0] : options.pad ?? [L.section.desktop, L.section.tablet, L.section.mobile]
    const extra = (options.settings?.css_classes as string | undefined) ?? ''
    const gutter = options.full ? { desktop: 0, tablet: 0, mobile: 0 } : L.gutter
    const node = container({
      content_width: options.full ? 'full' : 'boxed', boxed_width: px(L.content),
      flex_direction: 'column', flex_gap: gap(options.space ?? 0),
      padding: sides(desktop, gutter.desktop, desktop, gutter.desktop),
      padding_tablet: sides(tablet, gutter.tablet, tablet, gutter.tablet),
      padding_mobile: sides(mobile, gutter.mobile, mobile, gutter.mobile),
      ...(options.background === 'transparent' ? {} : bg(options.background)),
      html_tag: 'section',
      ...(options.id ? { _element_id: options.id } : {}),
      ...options.settings,
      css_classes: cls('sk-sec', options.dark && 'sk-dark', extra),
      custom_css: BASE_CSS + (options.css ?? ''),
    }, elements)
    node.isInner = false
    return node
  }

  return { uid, container, widget, col, row, grid, heading, text, image, behavior, photoBox, hint, index, labHead, root }
}

export type SkBuilder = ReturnType<typeof createBuilder>
