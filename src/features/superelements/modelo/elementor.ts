import { px, gap, sides, media, link } from '../elementor'
import { brl } from '../plans'
import { PUBLISH_STEPS } from '../screens'
import { SX, SX_FONT, SX_LOGO_FONT, SX_EASE as E, SX_LAYOUT as L } from './tokens'
import { SX_ICONS } from './icons'
import { SX_MOTION_SCRIPT } from './motion'
import {
  SX_NAV, SX_HERO, SX_SIMPLE, SX_SPLIT, SX_FEATURES, SX_LIBRARY, SX_PLANS, SX_NEWS, SX_FAQ, SX_FOOTER,
  type Chip, type Feature,
} from './content'

/**
 * Página modelo no desenho do jota.ai, em árvore nativa do Elementor. As
 * medidas vêm do CSS do original (frame de 1440px; o celular segue o frame de
 * 393px, com os mesmos pontos de quebra: 1200, 900, 760 e 560px). Cores e
 * tipografia ficam nos settings do Elementor; o que é desenho do original
 * (cantos, alturas, a nuvem de peças, o painel amarelo, o retrato que abre)
 * fica no CSS de cada seção, sempre sob `selector`.
 *
 * Três trechos se desenham numa escala própria, em `em` sobre uma fonte de
 * 1px que acompanha a largura da caixa (container queries): a nuvem de peças,
 * as conversas dos cards e as peças da cena. Assim encolhem inteiros no
 * celular, como as imagens do original.
 *
 * Todo container declara padding e gap, porque o Elementor põe 10px e 20px
 * quando o JSON não diz nada.
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

const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost'
const asset = (path: string) => `${ORIGIN}${path}`
const photo = (name: string) => asset(`/sections/c25/businesses/${name}.webp`)

export interface Spec {
  size: number
  /** Entrelinha: até 4 é proporcional (em), acima é px. */
  line: number
  weight?: number
  /** Em px. */
  letter?: number
  family?: string
  tablet?: { size: number; line?: number; letter?: number }
  mobile?: { size: number; line?: number; letter?: number }
}

const lh = (value: number) => (value <= 4 ? { unit: 'em', size: value, sizes: [] } : px(value))

export const type = (s: Spec, group = 'typography'): JsonRecord => ({
  [`${group}_typography`]: 'custom',
  [`${group}_font_family`]: s.family ?? SX_FONT,
  [`${group}_font_size`]: px(s.size),
  [`${group}_font_weight`]: String(s.weight ?? 400),
  [`${group}_line_height`]: lh(s.line),
  ...(s.letter !== undefined ? { [`${group}_letter_spacing`]: px(s.letter) } : {}),
  ...(s.tablet ? {
    [`${group}_font_size_tablet`]: px(s.tablet.size),
    ...(s.tablet.line !== undefined ? { [`${group}_line_height_tablet`]: lh(s.tablet.line) } : {}),
    ...(s.tablet.letter !== undefined ? { [`${group}_letter_spacing_tablet`]: px(s.tablet.letter) } : {}),
  } : {}),
  ...(s.mobile ? {
    [`${group}_font_size_mobile`]: px(s.mobile.size),
    ...(s.mobile.line !== undefined ? { [`${group}_line_height_mobile`]: lh(s.mobile.line) } : {}),
    ...(s.mobile.letter !== undefined ? { [`${group}_letter_spacing_mobile`]: px(s.mobile.letter) } : {}),
  } : {}),
})

/** Escala do original (h1 90, h2 80, h3 64, todos a 0,9 e −3%). */
const T = {
  h1: { size: 90, line: 0.9, letter: -2.7, tablet: { size: 64 }, mobile: { size: 40, line: 1, letter: -1.2 } },
  h2: { size: 80, line: 0.9, letter: -2.4, tablet: { size: 57 }, mobile: { size: 40, line: 0.9, letter: -1.2 } },
  h2big: { size: 90, line: 0.9, letter: -2.7, tablet: { size: 64 }, mobile: { size: 40, line: 0.9, letter: -1.2 } },
  lede: { size: 20, line: 1.4, letter: -0.6, mobile: { size: 16, line: 1.3, letter: -0.48 } },
  lede24: { size: 24, line: 1.3, letter: 0, tablet: { size: 17 }, mobile: { size: 16, line: 1.3, letter: -0.48 } },
  logo: { size: 30, line: 1, weight: 700, letter: -1.05, family: SX_LOGO_FONT, mobile: { size: 19, letter: -0.66 } },
  mode: { size: 16, line: 1.2, weight: 500, letter: -0.48, mobile: { size: 10, letter: -0.3 } },
  button: { size: 16, line: 1, weight: 500, letter: -0.48 },
  placeholder: { size: 18.5, line: 1.2, mobile: { size: 16.2, line: 1 } },
  chip: { size: 15.3, line: 1.2, weight: 500, mobile: { size: 12, line: 1.2 } },
  b18: { size: 18, line: 25.2, weight: 700, letter: -0.54 },
  p14: { size: 14, line: 19.6, weight: 500, letter: -0.42 },
  work: { size: 24, line: 1, weight: 600, letter: -0.72 },
  /** Texto das peças em escala própria (o CSS refaz o tamanho em em). */
  ui: { size: 14, line: 1.2, weight: 500 },
  h3: { size: 48, line: 0.9, letter: -1.44, tablet: { size: 40 }, mobile: { size: 24, line: 0.9, letter: -0.72 } },
  p20: { size: 20, line: 1.3, letter: -0.2, mobile: { size: 14, line: 1.2, letter: 0 } },
  chan: { size: 13.9, line: 1, weight: 500, mobile: { size: 10.6, line: 1.2 } },
  name20: { size: 20, line: 26, weight: 700 },
  role20: { size: 20, line: 26 },
  p14b: { size: 14, line: 18.2, letter: -0.42 },
  pill: { size: 12.33, line: 15.2, weight: 500 },
  planName: { size: 20, line: 1.2, weight: 700, letter: 0 },
  per: { size: 10.6, line: 13, weight: 500 },
  price: { size: 40, line: 1.1, weight: 700, letter: -1.2 },
  list: { size: 12, line: 1.4 },
  tag: { size: 10.6, line: 13, weight: 500 },
  news: { size: 20, line: 26, weight: 500 },
  small14: { size: 14, line: 19.6 },
  faqQ: { size: 20, line: 40, weight: 500, letter: -0.2, mobile: { size: 18, line: 26 } },
  faqA: { size: 16, line: 1.4, letter: -0.16 },
  trust: { size: 14, line: 20 },
  trustName: { size: 15, line: 1.2, weight: 600, letter: -0.3 },
  fcolH: { size: 16, line: 22.4, weight: 500, letter: -0.16 },
  flink: { size: 14, line: 28, letter: -0.14 },
  fine: { size: 10, line: 14, letter: -0.1 },
} satisfies Record<string, Spec>

// ---------- CSS comum ----------

const MOTION_OK = '@media (prefers-reduced-motion:no-preference){'

/** Vale para toda seção da página modelo. */
const BASE_CSS = [
  // a coluna de 1126px e a sangria das listas que rolam de lado
  'selector{--sx-gutter:max(24px,calc((100vw - 1126px) / 2));position:relative}',
  'selector,selector *{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
  `selector ::selection{background:${SX.yellow};color:${SX.ink}}`,
  'selector a{color:inherit;text-decoration:none}',
  'selector .elementor-heading-title{margin:0}selector .elementor-widget-text-editor p{margin:0}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  'selector .elementor-widget-image{line-height:0}selector .elementor-widget-image img{display:block}',
  // o motor e o Elementor animam o transform dos containers (0,4s): aqui quem move é o script
  'selector,selector .e-con{transition-property:background,border,box-shadow}',
  // link que cobre a peça inteira (a pílula, o chip, o card)
  'selector .sx-stretch,selector .sx-stretch>.elementor-widget-container{position:static}',
  'selector .sx-stretch a::after{content:"";position:absolute;inset:0;z-index:2;border-radius:inherit}',
  `selector a:focus-visible,selector summary:focus-visible,selector [role=button]:focus-visible,selector [role=switch]:focus-visible{outline:2px solid ${SX.ink};outline-offset:4px;border-radius:6px}`,
  'selector .sx-stretch a:focus-visible{outline:none}selector .sx-stretch a:focus-visible::after{outline:2px solid #222;outline-offset:3px}',
  // botão escuro do original: pílula #222, sobe 2px com sombra
  `selector .sx-btn .elementor-button{display:inline-flex;align-items:center;justify-content:center;height:48px;padding:0 32px;border-radius:32px;white-space:nowrap;transition:transform .18s,box-shadow .18s,height .45s ${E}}`,
  'selector .sx-btn .elementor-button:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(0,0,0,.18)}',
  '@media (prefers-reduced-motion:reduce){selector *{transition:none!important;animation:none!important}}',
  // o motor (e o Elementor) quebram a linha dos containers no celular; numa coluna isso estica tudo até a peça mais larga
  '@media (max-width:767px){selector,selector>.e-con-inner,selector .e-con{flex-wrap:nowrap}}',
].join('')

const iconUri = (name: string) => `url("data:image/svg+xml,${encodeURIComponent(SX_ICONS[name])}")`
/** CSS dos ícones usados numa seção (só os dela). */
export const iconCss = (names: Iterable<string>) => [
  'selector .sx-i{flex:none!important;padding:0!important;min-height:0;background-color:var(--sx-ic,currentColor);-webkit-mask:var(--sx-mask) center/contain no-repeat;mask:var(--sx-mask) center/contain no-repeat}',
  ...[...new Set(names)].sort().map((name) => `selector .sx-i-${name}{--sx-mask:${iconUri(name)}}`),
].join('')

// ---------- construtor ----------

export const createModelBuilder = (prefix: string, base: string = BASE_CSS) => {
  let sequence = 0
  const uid = () => `${prefix}${(++sequence).toString(36).padStart(7 - prefix.length, '0')}`
  const icons = new Set<string>()

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
  /** Container com classe (peça de desenho, forma, moldura). */
  const box = (classes: string, elements: ElementorNode[] = [], settings: JsonRecord = {}) =>
    container({ css_classes: classes, flex_direction: 'row', flex_align_items: 'center', flex_justify_content: 'center', ...settings }, elements)
  /** Ícone de traço (máscara CSS): `.sx-i.sx-i-<nome>`. */
  const icon = (name: string, classes = '') => {
    icons.add(name)
    return container({ css_classes: `sx-i sx-i-${name} ${classes}`.trim() })
  }
  const useIcons = (names: string[]) => names.forEach((name) => icons.add(name))

  const heading = (title: string, spec: Spec, color: string, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...type(spec), ...options })
  const text = (html: string, spec: Spec, color: string, options: JsonRecord = {}) =>
    widget('text-editor', { editor: html.startsWith('<') ? html : `<p>${html}</p>`, text_color: color, ...type(spec), ...options })
  const image = (url: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(url, alt), image_size: 'full', ...options })
  /** Pílula escura do original. */
  const button = (label: string, url: string, classes = '', options: JsonRecord = {}) => widget('button', {
    text: label, link: link(url), size: 'md',
    ...type(T.button, 'typography'),
    background_color: SX.ink, button_text_color: SX.button,
    button_background_hover_color: SX.ink, hover_color: SX.button,
    border_radius: sides(32), text_padding: sides(0, 32),
    ...options,
    _css_classes: `sx-btn ${classes}`.trim(),
  })
  /** O símbolo do Superelements desenhado em CSS: quadrado lima com os dois traços. */
  const mark = (classes: string) => box(`sx-mark ${classes}`, [icon('se', 'sx-mark-se')])

  /** Raiz da seção: coluna de 1126px (24px de cada lado abaixo de 1174px). */
  const root = (elements: ElementorNode[], options: { classes: string; css: string; tag?: string; id?: string; full?: boolean; background?: string; settings?: JsonRecord }) => {
    const node = container({
      ...(options.full ? {} : { content_width: 'boxed', boxed_width: px(L.content) }),
      flex_direction: 'column',
      padding: sides(0, options.full ? 0 : L.pad),
      background_background: 'classic', background_color: options.background ?? SX.bg,
      html_tag: options.tag ?? 'section',
      css_classes: options.classes,
      ...(options.id ? { _element_id: options.id } : {}),
      ...options.settings,
      custom_css: base + iconCss(icons) + options.css,
    }, elements)
    node.isInner = false
    return node
  }

  const behavior = (html: string) => widget('html', { html, _css_classes: 'sx-behavior' })

  return { uid, container, widget, col, row, box, icon, useIcons, heading, text, image, button, mark, root, behavior }
}

type B = ReturnType<typeof createModelBuilder>

/** Cabeça com o título à esquerda e as setas (time e novidades do original). */
const rowhead = (b: B, title: string) => b.row([
  b.heading(title, T.h2, SX.black, { header_size: 'h2', _css_classes: 'sx-rowhead-h' }),
  b.row([
    b.box('sx-arrow sx-prev', [b.icon('prev', 'sx-arrow-ic')]),
    b.box('sx-arrow sx-next', [b.icon('next', 'sx-arrow-ic')]),
  ], 10, { css_classes: 'sx-arrows' }),
], 24, { css_classes: 'sx-rowhead', flex_justify_content: 'space-between', flex_align_items: 'flex-end' })

const ROWHEAD_CSS = [
  'selector{overflow-x:clip}',
  'selector .sx-rowhead-h{max-width:500px}',
  'selector .sx-rowhead-h .elementor-heading-title{font-size:clamp(40px,5.55vw,80px)}',
  'selector .sx-arrows{width:auto!important;flex:none!important;margin-bottom:7px}',
  'selector .sx-arrow{width:56px!important;height:56px;flex:none!important;border:1px solid #D9D9D9;border-radius:50%;cursor:pointer;transition:background .18s}',
  'selector .sx-arrow:hover{background:rgba(0,0,0,.05)}',
  `selector .sx-arrow-ic{width:22px!important;height:22px;--sx-ic:${SX.ink}}`,
  'selector .sx-scroller{flex-wrap:nowrap!important;align-items:flex-start!important;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;margin-top:80px;padding-right:var(--sx-gutter)!important}',
  'selector .sx-scroller::-webkit-scrollbar{display:none}',
  'selector .sx-scroller>*{flex:none!important;scroll-snap-align:start}',
  // sangria: a lista começa na coluna e rola até as duas bordas da janela
  'selector .sx-bleed{width:auto!important;margin-left:calc(-1 * var(--sx-gutter));margin-right:calc(-1 * var(--sx-gutter));padding-left:var(--sx-gutter)!important;scroll-padding-left:var(--sx-gutter)}',
  '@media (max-width:560px){selector .sx-arrows{gap:7px!important;margin-bottom:0}selector .sx-arrow{width:40px!important;height:40px}selector .sx-arrow-ic{width:18px!important;height:18px}}',
].join('')

// =====================================================================
// 1. Cabeçalho: fixo, com desfoque, encolhe pela metade ao rolar
// =====================================================================

export const buildHeader = () => {
  const b = createModelBuilder('sxh')
  const brand = b.row([
    b.mark('sx-logo-mark'),
    b.heading('superelements', T.logo, SX.black, { link: link('/'), _css_classes: 'sx-logo-word' }),
  ], 10, { css_classes: 'sx-brand' })
  const mode = b.row([
    b.heading(SX_NAV.mode, T.mode, SX.title, { _css_classes: 'sx-modo-label' }),
    b.box('sx-switch', [b.box('sx-knob')]),
  ], 8, { css_classes: 'sx-modo' })
  return b.root([
    b.behavior(`<script>${SX_MOTION_SCRIPT}</script>`),
    brand,
    mode,
    b.button(SX_NAV.cta.text, SX_NAV.cta.url, 'sx-nav-btn'),
  ], {
    full: true, tag: 'header', classes: 'sx-nav',
    background: 'rgba(245, 245, 245, 0.88)',
    settings: {
      flex_direction: 'row', flex_justify_content: 'space-between', flex_align_items: 'center', flex_wrap: 'nowrap',
      padding: sides(0, 40, 0, 48),
    },
    css: [
      // fica preso no topo; ao rolar, a altura cai pela metade e a margem devolve o espaço (nada pula)
      `selector{position:sticky!important;top:0;z-index:100;height:132px;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);transition:height .45s ${E},margin-bottom .45s ${E}!important}`,
      'html.sx-small selector{height:66px;margin-bottom:66px}',
      'selector .sx-behavior{position:absolute!important;width:0;height:0;overflow:hidden}',
      `selector .sx-brand{width:auto!important;flex:none!important;transform-origin:left center;transition:transform .45s ${E}!important}`,
      'html.sx-small selector .sx-brand{transform:scale(.67)}',
      `selector .sx-mark{width:48px!important;height:48px;flex:none!important;border-radius:12px;background:${SX.lime}}`,
      `selector .sx-mark-se{width:100%!important;height:100%;--sx-ic:${SX.graphite}}`,
      'selector .sx-logo-word{flex:none}',
      // a chave do modo agência, no centro da barra
      'selector .sx-modo{position:absolute!important;left:50%;top:50%;transform:translate(-50%,-50%);width:auto!important;cursor:pointer;-webkit-user-select:none;user-select:none;z-index:1}',
      'selector .sx-modo-label{white-space:nowrap}',
      'selector .sx-switch{position:relative;width:44px!important;height:26px;flex:none!important;border-radius:50px;background:#C9CED1;transition:background .2s!important}',
      'selector .sx-knob{position:absolute!important;top:2px;left:2px;width:22px!important;height:22px;border-radius:50%;background:#FEFEFD;transition:transform .2s!important}',
      'html.sx-agencia selector .sx-switch{background:#262E33}html.sx-agencia selector .sx-knob{transform:translateX(18px)}',
      'selector .sx-nav-btn .elementor-button{width:180px;padding:0}',
      'html.sx-small selector .sx-nav-btn .elementor-button{height:36px}',
      '@media (max-width:900px){selector{height:96px;padding:0 24px!important}html.sx-small selector{height:48px;margin-bottom:48px}selector .sx-nav-btn .elementor-button{width:auto;padding:0 20px}}',
      '@media (max-width:560px){selector{height:80px}html.sx-small selector{height:56px;margin-bottom:24px}html.sx-small selector .sx-brand{transform:scale(.8)}',
      'selector .sx-mark{width:32px!important;height:32px;border-radius:8px}selector .sx-brand{gap:6px!important}',
      'selector .sx-nav-btn .elementor-button{width:104px;height:32px;padding:0;font-size:12px;letter-spacing:0}html.sx-small selector .sx-nav-btn .elementor-button{height:30px}',
      'selector .sx-modo{gap:6px!important;padding:12px 0!important}selector .sx-switch{width:27px!important;height:16px}selector .sx-knob{top:1.5px;left:1.5px;width:13px!important;height:13px}html.sx-agencia selector .sx-knob{transform:translateX(11px)}}',
      // celular estreito: a palavra do logo sai, fica o símbolo
      '@media (max-width:400px){selector .sx-logo-word{display:none}}',
    ].join(''),
  })
}

// =====================================================================
// 2. Abertura: título, painel amarelo com o pedido ao agente e a faixa
// =====================================================================

const chip = (b: B, [label, glyph, tint]: Chip, classes: string) => b.row([
  b.box('sx-chip-ic', [b.icon(glyph, 'sx-chip-glyph')], { background_background: 'classic', background_color: tint }),
  b.heading(label, T.chip, SX.ink, { link: link(SX_HERO.promptUrl), _css_classes: 'sx-stretch sx-chip-text' }),
], 5, { css_classes: `sx-chip ${classes}` })

/** Fundo do painel sem script (e por baixo do líquido): o amarelo marmorizado parado. */
const LIQUID_BG = [
  'radial-gradient(60% 90% at 18% 22%,rgba(255,250,200,.95),rgba(255,250,200,0) 62%)',
  'radial-gradient(45% 80% at 82% 78%,rgba(247,184,20,.85),rgba(247,184,20,0) 60%)',
  'radial-gradient(38% 70% at 58% 18%,rgba(255,214,64,.9),rgba(255,214,64,0) 62%)',
  'radial-gradient(50% 70% at 38% 92%,rgba(255,240,150,.9),rgba(255,240,150,0) 60%)',
  'linear-gradient(115deg,#FFE84C,#FFD83A 45%,#FFE97A)',
].join(',')

export const buildHero = () => {
  const b = createModelBuilder('sxa')
  b.useIcons([...SX_HERO.chipPool, ...SX_HERO.chips, ...SX_HERO.chipsAgency].map((c) => c[1]))
  const bar = b.row([
    b.icon('plus', 'sx-bar-plus'),
    b.heading(SX_HERO.prompt, T.placeholder, SX.placeholder, { link: link(SX_HERO.promptUrl), _css_classes: 'sx-stretch sx-bar-ph' }),
    b.icon('mic', 'sx-bar-mic'),
    b.box('sx-send', [b.icon('up', 'sx-send-ic')]),
  ], 10, { css_classes: 'sx-bar' })
  const panel = b.col([
    b.box('sx-liquid'),
    bar,
    b.row([
      ...SX_HERO.chips.map((c) => chip(b, c, 'sx-s')),
      ...SX_HERO.chipsAgency.map((c) => chip(b, c, 'sx-f')),
    ], 10, { css_classes: 'sx-chips', flex_wrap: 'wrap', flex_justify_content: 'center' }),
  ], 25, { css_classes: 'sx-panel', flex_justify_content: 'center', flex_align_items: 'center' })
  const proof = b.row([
    b.col([
      b.icon('trend', 'sx-trend'),
      b.heading(SX_HERO.proof.title, T.b18, SX.ink, { _css_classes: 'sx-proof-b' }),
      b.heading(SX_HERO.proof.text, T.p14, SX.soft, { _css_classes: 'sx-proof-t' }),
    ], 0, { css_classes: 'sx-proof-l' }),
    b.row(SX_HERO.works.map((name) => b.heading(name, T.work, '#A6A6A6', { _css_classes: 'sx-work' })), 24, { css_classes: 'sx-works', flex_justify_content: 'space-between', flex_align_items: 'flex-end' }),
  ], 32, { css_classes: 'sx-proof', flex_justify_content: 'space-between', flex_align_items: 'flex-end', flex_wrap: 'wrap' })

  return b.root([
    b.heading(SX_HERO.title, T.h1, SX.black, { header_size: 'h1', align: 'center', _css_classes: 'sx-h1' }),
    b.text(SX_HERO.lede, T.lede, SX.lede, { align: 'center', _css_classes: 'sx-hero-lede sx-s' }),
    b.text(SX_HERO.ledeAgency, T.lede, SX.lede, { align: 'center', _css_classes: 'sx-hero-lede sx-f' }),
    panel,
    proof,
  ], {
    classes: 'sx-hero',
    settings: { flex_align_items: 'center', padding: sides(40, L.pad, 0, L.pad) },
    css: [
      'html.sx-agencia selector .sx-s,html:not(.sx-agencia) selector .sx-f{display:none!important}',
      'selector .sx-h1{width:100%}selector .sx-h1 .elementor-heading-title{font-size:clamp(40px,6.25vw,90px)}',
      'selector .sx-hero-lede{margin-top:24px;width:100%}selector .sx-hero-lede p{font-size:clamp(16px,1.4vw,20px)}',
      // painel: amarelo com o líquido (canvas do script) por baixo da barra e dos chips
      `selector .sx-panel{position:relative;isolation:isolate;overflow:hidden;margin-top:117px;height:358px;border-radius:56px;padding:0 24px!important;background:${SX.yellow}}`,
      `selector .sx-liquid{position:absolute!important;inset:0;z-index:-1;width:auto!important;background:${LIQUID_BG}}`,
      'selector .sx-liquid canvas{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .8s}',
      'selector .sx-liquid canvas.is-on{opacity:1}',
      `selector .sx-bar{position:relative;width:min(659px,100%)!important;height:84px;flex:none!important;padding:0 24px 0 21px!important;border-radius:115px;background:#fff;border:.8px solid rgba(44,51,56,.05);transition:transform .25s ${E}!important}`,
      'selector .sx-bar:active{transform:scale(.98)}',
      `selector .sx-bar-plus{width:37px!important;height:37px;--sx-ic:${SX.ink};-webkit-mask-size:20px;mask-size:20px}`,
      'selector .sx-bar-ph{flex:1 1 auto!important;text-align:left}',
      `selector .sx-bar-mic{width:22px!important;height:22px;margin-right:6px;--sx-ic:${SX.ink}}`,
      'selector .sx-send{width:46px!important;height:46px;flex:none!important;border-radius:50%;background:#000}',
      'selector .sx-send-ic{width:24px!important;height:24px;--sx-ic:#fff}',
      'selector .sx-chips{width:auto!important;max-width:100%;flex:none!important;flex-wrap:wrap!important}',
      `selector .sx-chip{position:relative;width:auto!important;flex:none!important;height:48px;padding:11px 13px!important;border-radius:94px;background:#fff;transition:transform .3s ${E}!important}`,
      'selector .sx-chip-ic{width:25px!important;height:25px;flex:none!important;border-radius:50%}',
      'selector .sx-chip-glyph{width:14px!important;height:14px;--sx-ic:#fff}',
      'selector .sx-chip-text{white-space:nowrap}',
      '@media (hover:hover){selector .sx-chip:hover{transform:translateY(-2px)}selector .sx-bar:hover{transform:translateY(-1px)}}',
      // faixa: o que o Superelements é, e com o que trabalha
      'selector .sx-proof{width:100%;margin-top:73px;text-align:left;flex-wrap:wrap!important}',
      'selector .sx-proof-l{width:auto!important;flex:0 1 auto!important;padding-bottom:15px!important}',
      `selector .sx-trend{width:28px!important;height:28px;--sx-ic:${SX.ink};margin-bottom:1px}`,
      'selector .sx-works{width:541px!important;max-width:100%;flex:0 1 541px!important;padding-bottom:15px!important}',
      'selector .sx-work{flex:none}',
      '@media (max-width:760px){selector .sx-proof{flex-direction:column!important;align-items:center!important;text-align:center;gap:40px!important;margin-top:80px;padding:40px 24px!important;min-height:309px;border-radius:32px;background:#fff}',
      'selector .sx-proof-l{align-items:center;padding-bottom:0!important}selector .sx-trend{margin:0 auto 20px}',
      'selector .sx-works{flex-wrap:wrap!important;justify-content:center!important;gap:18px 28px!important;padding-bottom:0!important;max-width:300px;flex:none!important}selector .sx-work .elementor-heading-title{font-size:20px}}',
      '@media (max-width:560px){selector .sx-h1 .elementor-heading-title{color:#222}selector .sx-hero-lede{max-width:280px;margin-top:16px}',
      'selector .sx-panel{margin-top:56.6px;height:345px;border-radius:32px;gap:20px!important}',
      'selector .sx-bar{width:min(296.5px,100%)!important;height:60px;gap:3px!important;padding:0 13.8px 0 16.5px!important;border-radius:82.6px}',
      'selector .sx-bar-ph{min-width:0}selector .sx-bar-ph .elementor-heading-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}selector .sx-bar-plus{width:26.4px!important;height:26.4px;-webkit-mask-size:16px;mask-size:16px}selector .sx-bar-mic{width:18px!important;height:18px;margin-right:4px}',
      'selector .sx-send{width:32px!important;height:32px}selector .sx-send-ic{width:17px!important;height:17px}',
      'selector .sx-chips{gap:10.4px 9.6px!important}selector .sx-chip{height:36.7px;padding:0 9.9px!important;gap:4.6px!important;border-radius:73.6px}',
      'selector .sx-chip-ic{width:19.3px!important;height:19.3px}selector .sx-chip-glyph{width:11px!important;height:11px}',
      'selector .sx-proof{margin-top:40px}}',
    ].join(''),
  })
}

// =====================================================================
// 3. Você pede: título, texto e a nuvem de peças do produto
// =====================================================================

/** Posição de cada peça na nuvem (desktop 1037×306; celular 660×530), em px da caixa. */
const CLOUD: Record<string, { d: [number, number, number, number]; m: [number, number, number, number] }> = {
  a: { d: [22, 0, 180, 88], m: [0, 0, 180, 88] },
  b: { d: [225, 0, 168, 88], m: [200, 0, 168, 88] },
  c: { d: [415, 0, 212, 88], m: [388, 0, 212, 88] },
  d: { d: [649, 0, 132, 88], m: [206, 110, 132, 88] },
  e: { d: [803, 0, 232, 196], m: [358, 110, 232, 196] },
  f: { d: [0, 110, 225, 88], m: [0, 330, 225, 88] },
  g: { d: [249, 110, 132, 196], m: [245, 330, 132, 196] },
  h: { d: [403, 110, 378, 88], m: [0, 220, 338, 88] },
  i: { d: [403, 218, 186, 88], m: [0, 110, 186, 88] },
  j: { d: [613, 218, 233, 88], m: [397, 330, 233, 88] },
  k: { d: [869, 218, 133, 88], m: [397, 440, 133, 88] },
}

export const buildSimple = () => {
  const b = createModelBuilder('sxb')
  const tile = (key: string, elements: ElementorNode[], extra = '') => b.box(`sx-t sx-t-${key} ${extra}`.trim(), elements)
  const label = (value: string, classes = '') => b.heading(value, T.ui, SX.ink, { _css_classes: `sx-tl ${classes}`.trim() })
  const tiles = [
    tile('a', [b.mark('sx-t-mark'), label('Projetos', 'sx-tl-26')]),
    tile('b', [b.box('sx-sw sx-sw-1'), b.box('sx-sw sx-sw-2'), b.box('sx-sw sx-sw-3')]),
    tile('c', [b.box('sx-ava', [b.icon('sparkle', 'sx-ava-ic')]), b.icon('play', 'sx-t-play'), b.box('sx-t-dot'), b.icon('wave', 'sx-t-wave')]),
    tile('d', [b.box('sx-wp', [b.icon('globe', 'sx-wp-ic')]), b.icon('check', 'sx-t-check')]),
    tile('e', [
      b.box('sx-e-ic', [b.icon('link', 'sx-e-glyph')]),
      label('Aprovado', 'sx-tl-32'),
      label('Home · versão 3', 'sx-tl-14'),
      b.row([b.box('sx-pg sx-pg-on'), b.box('sx-pg'), b.box('sx-pg')], 0, { css_classes: 'sx-pager' }),
    ], 'sx-card'),
    tile('f', [b.icon('stack', 'sx-t-ic'), label('Inserir seção', 'sx-tl-22')]),
    tile('g', [
      b.box('sx-ring', [b.image(photo('pet-daycare'), '', { _css_classes: 'sx-ring-img' })]),
      label('11 seções', 'sx-tl-18'),
      label('Caramelo Pet', 'sx-tl-11'),
    ], 'sx-card'),
    tile('h', [
      b.box('sx-h-ic', [b.icon('upload', 'sx-h-glyph')]),
      b.col([
        b.row([label('Publicando', 'sx-tl-14'), label('Home', 'sx-tl-14 sx-tl-soft')], 8, { css_classes: 'sx-h-top', flex_justify_content: 'space-between' }),
        b.box('sx-track', [b.box('sx-fill')]),
      ], 0, { css_classes: 'sx-h-mid' }),
      label('72%', 'sx-tl-28'),
    ]),
    tile('i', [b.icon('undo', 'sx-t-ic'), label('Desfazer', 'sx-tl-22')]),
    tile('j', [b.icon('desktop', 'sx-t-dev'), b.icon('tablet', 'sx-t-dev'), b.icon('phone', 'sx-t-dev')]),
    tile('k', [b.box('sx-k-ring', [b.icon('upload', 'sx-k-ic')]), b.icon('check', 'sx-k-check')], 'sx-dark'),
  ]
  const place = (key: string, [l, t, w, h]: number[]) => `selector .sx-t-${key}{left:${l}em;top:${t}em;width:${w}em!important;height:${h}em}`

  return b.root([
    b.heading(SX_SIMPLE.title, T.h2big, SX.black, { header_size: 'h2', align: 'center', _css_classes: 'sx-simple-h' }),
    b.text(SX_SIMPLE.lede, T.lede24, SX.lede, { align: 'center', _css_classes: 'sx-simple-lede' }),
    b.container({ css_classes: 'sx-cloud' }, [b.container({ css_classes: 'sx-cloud-in' }, tiles)]),
  ], {
    classes: 'sx-simple', id: 'dia',
    settings: { flex_align_items: 'center', padding: sides(192, L.pad, 0, L.pad) },
    css: [
      'selector .sx-simple-h{width:100%}selector .sx-simple-h .elementor-heading-title{font-size:clamp(40px,6.25vw,90px)}',
      'selector .sx-simple-lede{width:100%;max-width:780px;margin-top:24px}selector .sx-simple-lede p{font-size:clamp(17px,1.66vw,24px)}',
      // a nuvem encolhe inteira: 1em = 1px na largura de 1037px
      'selector .sx-cloud{position:relative;width:1037px!important;max-width:100%;aspect-ratio:1037/306;margin-top:80px;flex:none!important;container-type:inline-size}',
      'selector .sx-cloud-in{position:absolute!important;inset:0;font-size:calc(100cqw / 1037)}',
      'selector .sx-t{position:absolute!important;box-sizing:border-box;padding:0 22em!important;gap:12em!important;border-radius:999em;background:#fff;flex-wrap:nowrap!important}',
      'selector .sx-t.sx-card{flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;border-radius:32em;padding:22em!important;gap:4em!important}',
      `selector .sx-t.sx-dark{background:${SX.ink}}`,
      ...Object.entries(CLOUD).map(([key, value]) => place(key, value.d)),
      'selector .sx-tl{flex:none;white-space:nowrap}selector .sx-tl .elementor-heading-title{font-size:14em;line-height:1.2;font-weight:500;letter-spacing:-.02em}',
      'selector .sx-tl-26 .elementor-heading-title{font-size:26em;letter-spacing:-.03em}selector .sx-tl-22 .elementor-heading-title{font-size:22em;letter-spacing:-.03em}',
      'selector .sx-tl-32 .elementor-heading-title{font-size:32em;letter-spacing:-.04em}selector .sx-tl-28 .elementor-heading-title{font-size:28em;letter-spacing:-.03em}',
      'selector .sx-tl-18 .elementor-heading-title{font-size:18em;font-weight:600}selector .sx-tl-11 .elementor-heading-title{font-size:11em;color:#666}',
      'selector .sx-tl-14 .elementor-heading-title{font-size:14em}selector .sx-tl-soft .elementor-heading-title{color:#888}',
      'selector .sx-t .sx-mark{width:46em!important;height:46em;flex:none!important;border-radius:12em;background:#D2F525}selector .sx-t .sx-mark-se{width:100%!important;height:100%;--sx-ic:#282828}',
      // b: a paleta da marca
      'selector .sx-t-b{gap:0!important}selector .sx-sw{width:46em!important;height:46em;flex:none!important;border-radius:50%;border:3em solid #fff;box-sizing:content-box;margin-left:-12em}',
      `selector .sx-sw-1{margin-left:0;background:${SX.lime}}selector .sx-sw-2{background:${SX.violet}}selector .sx-sw-3{background:${SX.agent}}`,
      // c: um áudio para o agente
      `selector .sx-ava{width:46em!important;height:46em;flex:none!important;border-radius:50%;background:${SX.agent}}selector .sx-ava-ic{width:22em!important;height:22em;--sx-ic:#fff}`,
      `selector .sx-t-play{width:18em!important;height:18em;--sx-ic:${SX.ink}}selector .sx-t-dot{width:8em!important;height:8em;flex:none!important;border-radius:50%;background:${SX.ink};margin-right:-6em}`,
      `selector .sx-t-wave{width:80em!important;height:24em;--sx-ic:${SX.ink}}`,
      // d: o site conectado
      'selector .sx-wp{width:46em!important;height:46em;flex:none!important;border-radius:50%;background:#2271B1}selector .sx-wp-ic{width:24em!important;height:24em;--sx-ic:#fff}',
      `selector .sx-t-check{width:24em!important;height:24em;--sx-ic:${SX.ink}}`,
      // e: aprovação
      'selector .sx-e-ic{width:30em!important;height:30em;flex:none!important;border-radius:50%;background:#EDE9FE;margin-bottom:10em}selector .sx-e-glyph{width:16em!important;height:16em;--sx-ic:#7C3AED}',
      'selector .sx-pager{gap:5em!important;margin-top:auto;width:auto!important}selector .sx-pg{width:6em!important;height:6em;flex:none!important;border-radius:50%;background:#E5E5E5}selector .sx-pg-on{background:#222}',
      // f, i: ação com ícone
      `selector .sx-t-ic{width:30em!important;height:30em;--sx-ic:${SX.ink}}`,
      // g: anel de progresso em volta da foto
      'selector .sx-t-g{align-items:center!important}',
      'selector .sx-ring{position:relative;width:84em!important;height:84em;flex:none!important;border-radius:50%;margin-bottom:10em;background:conic-gradient(#F59E0B 0 70%,#F0F0F0 70% 100%)}',
      'selector .sx-ring-img{width:68em!important;flex:none}selector .sx-ring-img img{width:68em;height:68em;border-radius:50%;object-fit:cover;border:4em solid #fff;box-sizing:border-box}',
      // h: publicando
      `selector .sx-h-ic{width:40em!important;height:40em;flex:none!important;border-radius:10em;background:${SX.lime}}selector .sx-h-glyph{width:20em!important;height:20em;--sx-ic:#222}`,
      'selector .sx-h-mid{flex:1 1 auto!important;width:auto!important;gap:8em!important}selector .sx-h-top{width:100%}',
      `selector .sx-track{width:100%!important;height:6em;border-radius:6em;background:#EEE;justify-content:flex-start!important}selector .sx-fill{width:72%!important;height:100%;border-radius:6em;background:${SX.yellow}}`,
      // j: os aparelhos do Player
      `selector .sx-t-j{gap:22em!important;justify-content:center!important}selector .sx-t-dev{width:30em!important;height:30em;--sx-ic:${SX.ink}}`,
      // k: publicar, em tinta
      'selector .sx-t-k{gap:18em!important;justify-content:center!important}selector .sx-k-ring{width:40em!important;height:40em;flex:none!important;border-radius:50%;border:2em solid #fff;box-sizing:border-box}',
      'selector .sx-k-ic{width:18em!important;height:18em;--sx-ic:#fff}selector .sx-k-check{width:24em!important;height:24em;--sx-ic:#fff}',
      '@media (max-width:560px){selector{padding-top:79px!important}selector .sx-simple-lede{max-width:313px;margin-top:16px}',
      'selector .sx-cloud{width:100%!important;aspect-ratio:660/530;margin-top:40px}selector .sx-cloud-in{font-size:calc(100cqw / 660)}',
      ...Object.entries(CLOUD).map(([key, value]) => place(key, value.m)),
      '}',
    ].join(''),
  })
}

// =====================================================================
// 4. O retrato que abre: preso na tela, a janela vira a cena inteira
// =====================================================================

export const buildSplit = () => {
  const b = createModelBuilder('sxc')
  const card = (classes: string, elements: ElementorNode[]) => b.col(elements, 0, { css_classes: `sx-wg ${classes}` })
  const tx = (value: string, classes: string, color = SX.ink) => b.heading(value, T.ui, color, { _css_classes: `sx-wt ${classes}` })
  const projects = card('sx-wg-1', [
    ...SX_SPLIT.projects.map(([name, status, fg, bgc], i) => b.row([
      b.box(`sx-wsq sx-wsq-${i + 1}`),
      tx(name, 'sx-wt-name'),
      b.box('sx-wpill', [tx(status, 'sx-wt-pill', fg)], { background_background: 'classic', background_color: bgc }),
    ], 0, { css_classes: 'sx-wrow' })),
    b.row([b.box('sx-pg sx-pg-on'), b.box('sx-pg'), b.box('sx-pg')], 0, { css_classes: 'sx-wpager' }),
  ])
  const connect = (classes: string, glyph: string, tint: string, name: string, action: string) => b.row([
    b.box('sx-wc-ic', [b.icon(glyph, 'sx-wc-glyph')], { background_background: 'classic', background_color: tint }),
    tx(name, 'sx-wt-conn', '#444'),
    b.box('sx-wbtn', [tx(action, 'sx-wt-btn')]),
  ], 0, { css_classes: `sx-wg sx-wpillcard ${classes}` })
  const BARS = [38, 52, 30, 44, 66, 28, 50]
  const chart = card('sx-wg-4', [
    b.row([tx('Seções publicadas', 'sx-wt-xs', '#555'), tx('Hoje', 'sx-wt-xs', '#555')], 0, { css_classes: 'sx-wch-top', flex_justify_content: 'space-between' }),
    tx('+11', 'sx-wt-val'),
    tx('Home · Caramelo Pet', 'sx-wt-xxs', '#888'),
    b.row(BARS.map((h, i) => b.box(`sx-wbar sx-wbar-${h}${i === 4 ? ' sx-wbar-on' : ''}`)), 0, { css_classes: 'sx-wbars', flex_align_items: 'flex-end' }),
  ])

  return b.root([
    b.container({ css_classes: 'sx-split' }, [
      b.container({ css_classes: 'sx-stage' }, [
        b.container({ css_classes: 'sx-stage-wrap' }, [
          b.heading(SX_SPLIT.left, T.h2, SX.black, { header_size: 'h2', _css_classes: 'sx-split-h sx-split-l' }),
          b.container({ css_classes: 'sx-portrait' }, [b.image(asset(SX_SPLIT.photo), 'Estúdio criativo com mesa de trabalho e plantas', { _css_classes: 'sx-portrait-photo' })]),
          b.heading(SX_SPLIT.right, T.h2, SX.black, { header_size: 'h2', _css_classes: 'sx-split-h sx-split-r' }),
        ]),
        b.container({ css_classes: 'sx-scene' }, [
          b.container({ css_classes: 'sx-scene-in' }, [
            b.image(asset(SX_SPLIT.photo), '', { _css_classes: 'sx-scene-photo' }),
            projects,
            connect('sx-wg-2', 'globe', '#2271B1', 'WordPress', 'Conectar'),
            connect('sx-wg-3', 'link', SX.violet, 'Link de aprovação', 'Enviar'),
            chart,
          ]),
        ]),
      ]),
    ]),
  ], {
    full: true, classes: 'sx-split-sec',
    css: [
      // 190px do Figma, menos a folga que o centramento do palco põe acima do retrato
      'selector{padding-top:calc(190px - clamp(0px, (100vh - 810px) / 2, 190px))!important}',
      '@media (max-width:1200px){selector{padding-top:calc(160px - clamp(0px, (100vh - 810px) / 2, 160px))!important}}',
      'selector .sx-split{position:relative;flex:none!important}',
      'selector .sx-stage{--p:0;--navh:132px;--q:clamp(0, calc(1 - var(--p) / .7), 1);position:relative;overflow:hidden;padding:80px 0!important}',
      'selector .sx-stage-wrap{display:grid!important;grid-template-columns:1fr 394px 1fr;align-items:center;gap:40px!important;max-width:1126px;margin:0 auto;box-sizing:border-box}',
      'selector .sx-split-h{max-width:300px;width:auto;opacity:clamp(0, calc(1 - var(--p) * 2.5), 1)}',
      'selector .sx-split-h .elementor-heading-title{font-size:clamp(40px,5.55vw,80px)}',
      'selector .sx-split-l{justify-self:start;margin-left:34px;transform:translateX(calc(var(--p) * -60px))}',
      'selector .sx-split-r{transform:translateX(calc(var(--p) * 60px))}',
      'selector .sx-portrait{width:394px!important;max-height:calc(100vh - var(--navh) - 48px);aspect-ratio:394/738;border-radius:56px;overflow:hidden;justify-self:center}',
      'selector .sx-portrait-photo,selector .sx-portrait-photo .elementor-widget-container{width:100%;height:100%}',
      'selector .sx-portrait-photo img{width:100%;height:100%;object-fit:cover;object-position:50% 50%}',
      'selector .sx-scene{display:none!important}',
      // com o script: a seção cresce para 2,8 telas, o palco fica preso e a cena (a mesma foto) abre do retrato
      'html.sx-live selector .sx-split{height:280vh}',
      'html.sx-live selector .sx-stage{position:sticky!important;top:0;height:100vh;padding:0!important}',
      'html.sx-live selector .sx-stage-wrap{height:100%;padding-top:var(--navh)!important}',
      'html.sx-live selector .sx-portrait-photo{visibility:hidden}',
      'html.sx-live selector .sx-scene{display:block!important;position:absolute!important;inset:0;padding:0!important;clip-path:inset(calc(var(--ct,0px) * var(--q)) calc(var(--cr,0px) * var(--q)) calc(var(--cb,0px) * var(--q)) calc(var(--cl,0px) * var(--q)) round calc(var(--r,56px) * var(--q)))}',
      'selector .sx-scene-in{position:absolute!important;inset:0;padding:0!important;transform-origin:var(--ox,50%) var(--oy,50%);transform:scale(calc(1 + .16 * var(--q)))}',
      'selector .sx-scene-photo{position:absolute!important;inset:0;width:100%!important}selector .sx-scene-photo .elementor-widget-container{height:100%}',
      'selector .sx-scene-photo img{width:100%;height:100%;object-fit:cover;object-position:50% 50%}',
      // as peças do produto entram uma a uma (escala própria: 1em = 1px a 1440px)
      'selector .sx-wg{--a:clamp(0, calc((var(--p) - var(--d)) * 4), 1);position:absolute!important;width:auto!important;font-size:clamp(.62px, calc(100vw / 1440), 1px);opacity:var(--a);transform:translateY(calc((1 - var(--a)) * 28px)) scale(calc(.92 + .08 * var(--a)));transform-origin:50% 100%;background:#fff;box-shadow:0 18em 44em rgba(0,0,0,.14)}',
      'selector .sx-wg-1{--d:.45;left:27.2%;top:31.3%;width:226em!important;padding:20em 20em 16em!important;border-radius:26em;gap:12em!important}',
      'selector .sx-wg-2{--d:.55;left:55.9%;top:39%}selector .sx-wg-3{--d:.65;left:53%;top:48.3%}',
      'selector .sx-wg-4{--d:.75;left:35.5%;top:52.8%;width:200em!important;padding:14em 14em 16em!important;border-radius:18em;gap:2em!important}',
      'selector .sx-wt .elementor-heading-title{font-size:14em;line-height:1.2;font-weight:500;white-space:nowrap}',
      'selector .sx-wrow{gap:10em!important}selector .sx-wt-name{flex:1 1 auto}',
      'selector .sx-wsq{width:22em!important;height:22em;flex:none!important;border-radius:7em}',
      `selector .sx-wsq-1{background:#F2994A}selector .sx-wsq-2{background:#6B4F3A}selector .sx-wsq-3{background:${SX.violet}}`,
      'selector .sx-wpill{width:auto!important;flex:none!important;padding:4em 8em!important;border-radius:999em}selector .sx-wt-pill .elementor-heading-title{font-size:11em}',
      'selector .sx-wpager{gap:5em!important;margin-top:4em;justify-content:flex-start!important}selector .sx-pg{width:6em!important;height:6em;flex:none!important;border-radius:50%;background:#E5E5E5}selector .sx-pg-on{background:#222}',
      'selector .sx-wpillcard{width:340em!important;height:68em;padding:0 14em 0 14em!important;border-radius:999em;gap:12em!important}',
      'selector .sx-wc-ic{width:40em!important;height:40em;flex:none!important;border-radius:50%}selector .sx-wc-glyph{width:20em!important;height:20em;--sx-ic:#fff}',
      'selector .sx-wt-conn{flex:1 1 auto}selector .sx-wt-conn .elementor-heading-title{font-size:17em;font-weight:400}',
      'selector .sx-wbtn{width:auto!important;flex:none!important;height:42em;padding:0 16em!important;border-radius:999em;background:#EFEFEF}selector .sx-wt-btn .elementor-heading-title{font-size:16em}',
      'selector .sx-wt-xs .elementor-heading-title{font-size:9.5em;font-weight:400}selector .sx-wt-val{margin-top:6em}selector .sx-wt-val .elementor-heading-title{font-size:18em}selector .sx-wt-xxs .elementor-heading-title{font-size:8.5em;font-weight:400}',
      'selector .sx-wbars{height:76em;gap:9em!important;margin-top:10em;justify-content:center!important}',
      `selector .sx-wbar{width:9em!important;flex:none!important;border-radius:5em;background:#E4F59A}selector .sx-wbar-on{background:${SX.lime}}`,
      ...[38, 52, 30, 44, 66, 28, 50].map((h) => `selector .sx-wbar-${h}{height:${h}em}`),
      '@media (max-width:900px){selector .sx-stage{--navh:96px}selector .sx-stage-wrap{grid-template-columns:1fr;text-align:center;justify-items:center;align-content:center}',
      'selector .sx-split-l{justify-self:center;margin:0;transform:translateY(calc(var(--p) * -40px))}selector .sx-split-r{transform:translateY(calc(var(--p) * 40px))}selector .sx-split-h{max-width:none}',
      'selector .sx-portrait{width:100%!important;max-width:346px;aspect-ratio:346/204;border-radius:27.29px}}',
      '@media (max-width:560px){selector{padding-top:calc(255px - (100vh - 80px) / 2)!important}selector .sx-stage{--navh:80px}html.sx-live selector .sx-split{height:215vh}',
      'selector .sx-stage-wrap{padding-left:24px!important;padding-right:23px!important}',
      'selector .sx-wg-1{left:10.7%;top:28%}selector .sx-wg-2{left:39.7%;top:46%}selector .sx-wg-3{left:33.5%;top:55.4%}selector .sx-wg-4{left:10.7%;top:66.3%}}',
      // tela baixa (celular deitado): sem pin, a cena já aberta
      '@media (max-height:520px){html.sx-live selector .sx-split{height:auto}html.sx-live selector .sx-stage{position:relative!important;height:auto}selector .sx-portrait{display:none}html.sx-live selector .sx-scene{position:relative!important;aspect-ratio:1441/1024;clip-path:none}selector .sx-scene-in{transform:none}selector .sx-wg{--a:1}selector .sx-split-h{opacity:1;transform:none}}',
    ].join(''),
  })
}

// =====================================================================
// 5. Funcionalidades: arte com a conversa ao lado do card de texto
// =====================================================================

/** Fundos desfocados das artes (líquido parado, em seis paletas). */
const PALETTES: Record<number, string> = {
  1: 'radial-gradient(40% 35% at 30% 25%,#FFD24A,transparent 70%),radial-gradient(35% 40% at 70% 60%,#F6B23C,transparent 70%),radial-gradient(45% 45% at 20% 80%,#CFE0EE,transparent 70%),radial-gradient(40% 30% at 80% 15%,#F3E3B5,transparent 70%),#A9C9E3',
  2: 'radial-gradient(30% 50% at 25% 40%,#6F9A3E,transparent 70%),radial-gradient(35% 45% at 65% 30%,#DDE57A,transparent 70%),radial-gradient(30% 45% at 80% 75%,#9DBB55,transparent 70%),radial-gradient(40% 35% at 35% 85%,#E8EA9A,transparent 70%),#B9CC6A',
  3: 'radial-gradient(25% 60% at 20% 50%,#FFB000,transparent 70%),radial-gradient(22% 60% at 55% 45%,#9FC9D8,transparent 70%),radial-gradient(25% 55% at 85% 55%,#FFE97A,transparent 70%),radial-gradient(40% 30% at 50% 95%,#FFC94D,transparent 70%),#FFD400',
  4: 'radial-gradient(40% 40% at 25% 30%,#F4B6C9,transparent 70%),radial-gradient(35% 45% at 75% 35%,#B7A4E8,transparent 70%),radial-gradient(45% 35% at 50% 85%,#FCE3EC,transparent 70%),radial-gradient(30% 30% at 85% 85%,#9F8BE0,transparent 70%),#D9C6F2',
  5: 'radial-gradient(40% 40% at 30% 30%,#5BB8A4,transparent 70%),radial-gradient(35% 40% at 75% 25%,#D7F2E8,transparent 70%),radial-gradient(40% 40% at 70% 80%,#F7E79B,transparent 70%),radial-gradient(35% 35% at 20% 85%,#8FD3C0,transparent 70%),#9FDCCB',
  6: 'radial-gradient(40% 40% at 25% 25%,#FFC21A,transparent 70%),radial-gradient(35% 45% at 75% 40%,#FFF4A8,transparent 70%),radial-gradient(40% 35% at 40% 85%,#F59E0B,transparent 70%),radial-gradient(30% 30% at 85% 85%,#FFE07A,transparent 70%),#FFE84C',
}

const STEP_LABELS = PUBLISH_STEPS.map((step) => step.replace(/…$/, '').replace(/ \(\d+ de \d+\)/, ''))

export const buildFeatures = () => {
  const b = createModelBuilder('sxd')
  const tx = (value: string, classes: string, color = SX.ink) => b.heading(value, T.ui, color, { _css_classes: `sx-ct ${classes}` })
  const check = () => b.icon('check', 'sx-rcheck')
  const item = (elements: ElementorNode[], classes = '') => b.row(elements, 0, { css_classes: `sx-ri ${classes}`.trim() })

  const results: Record<string, () => ElementorNode[]> = {
    montar: () => [
      tx('Home · Caramelo Pet', 'sx-ct-cap', '#888'),
      ...[['Abertura', 1], ['Serviços', 1], ['Contato', 0]].map(([name, done]) => item([
        b.box(`sx-rthumb sx-rthumb-${String(name).length % 3}`),
        tx(String(name), 'sx-ct-row'),
        done ? check() : tx('montando', 'sx-ct-busy', '#7C3AED'),
      ])),
    ],
    marca: () => [
      tx('Marca · Caramelo Pet', 'sx-ct-cap', '#888'),
      item(['#1F2A44', '#F2994A', '#9ED8F7', '#FFF7EC', '#FDE9D3'].map((c, i) => b.box(`sx-rsw sx-rsw-${i + 1}`)), 'sx-ri-sw'),
      item([b.heading('Aa', { size: 26, line: 1, weight: 600, family: 'Fredoka' }, '#1F2A44', { _css_classes: 'sx-ct sx-ct-aa' }), tx('Fredoka nos títulos, Nunito nos textos', 'sx-ct-row sx-ct-wrap')]),
      item([check(), tx('Valendo em todas as seções', 'sx-ct-row')]),
    ],
    editar: () => [
      tx('Navigator', 'sx-ct-cap', '#888'),
      item([b.icon('layers', 'sx-rli'), tx('Abertura', 'sx-ct-row')]),
      item([b.icon('type', 'sx-rli'), tx('Título', 'sx-ct-row')], 'sx-ri-sub sx-ri-sel'),
      item([b.icon('page', 'sx-rli'), tx('Texto', 'sx-ct-row')], 'sx-ri-sub'),
      item([b.icon('link', 'sx-rli'), tx('Botão', 'sx-ct-row')], 'sx-ri-sub'),
    ],
    importar: () => [
      item([b.box('sx-rglobe', [b.icon('globe', 'sx-rglobe-ic')]), tx('caramelopet.exemplo', 'sx-ct-row')], 'sx-ri-head'),
      ...[['Início', 'ligada', '#047857', '#ECFDF5'], ['Serviços', 'importada', '#6D28D9', '#EDE9FE'], ['Contato', 'no site', '#4B5563', '#F3F4F6']].map(([name, state, fg, bgc]) => item([
        tx(name, 'sx-ct-row'),
        b.box('sx-rpill', [tx(state, 'sx-ct-pill', fg)], { background_background: 'classic', background_color: bgc }),
      ], 'sx-ri-split')),
    ],
    aprovar: () => [
      item([b.image(photo('pet-daycare'), '', { _css_classes: 'sx-rshot' })], 'sx-ri-shot'),
      item([tx('Home · versão 3', 'sx-ct-row'), b.box('sx-rpill sx-rok', [b.icon('check', 'sx-rok-ic'), tx('Aprovado', 'sx-ct-pill', '#047857')])], 'sx-ri-split'),
      item([b.box('sx-rbtn', [tx('Pedir ajuste', 'sx-ct-btn')]), b.box('sx-rbtn sx-rbtn-dark', [tx('Aprovar', 'sx-ct-btn', '#fff')])], 'sx-ri-btns'),
    ],
    publicar: () => [
      ...STEP_LABELS.map((step) => item([check(), tx(step, 'sx-ct-row sx-ct-wrap')])),
      item([b.box('sx-rpill sx-rok', [b.box('sx-rdot'), tx('No site', 'sx-ct-pill', '#047857')])], 'sx-ri-end'),
    ],
  }

  const art = (f: Feature) => b.container({ css_classes: `sx-art sx-pal-${f.palette}` }, [
    b.container({ css_classes: 'sx-fluid' }),
    b.col([
      b.container({ css_classes: 'sx-msg sx-msg-me' }, [tx(f.ask, 'sx-ct-msg', '#fff')]),
      b.container({ css_classes: 'sx-aiwrap' }, [
        b.row([b.box('sx-tdot'), b.box('sx-tdot'), b.box('sx-tdot')], 0, { css_classes: 'sx-typing' }),
        b.container({ css_classes: 'sx-msg sx-msg-ai' }, [
          b.row([b.mark('sx-ai-mark'), tx('Superelements', 'sx-ct-name')], 0, { css_classes: 'sx-ai-head' }),
          tx(f.answer, 'sx-ct-msg'),
        ]),
      ]),
      b.col(results[f.id](), 0, { css_classes: `sx-res sx-res-${f.id}` }),
    ], 0, { css_classes: 'sx-chat' }),
  ])

  const copy = (f: Feature) => b.col([
    b.box('sx-ficon', [b.icon(f.icon, 'sx-ficon-ic')]),
    b.heading(f.title, T.h3, SX.title, { header_size: 'h3', _css_classes: 'sx-fh3' }),
    b.text(f.text, T.p20, SX.lede, { _css_classes: 'sx-fp' }),
    b.row(f.chips.map(([label, glyph]) => b.row([
      b.icon(glyph, 'sx-chan-ic'),
      b.heading(label, T.chan, SX.ink, { link: link('/produto'), _css_classes: 'sx-stretch sx-chan-t' }),
    ], 5, { css_classes: 'sx-chan' })), 10, { css_classes: 'sx-chans' }),
  ], 0, { css_classes: 'sx-copy', flex_align_items: 'flex-start' })

  const pairs = SX_FEATURES.map((f) => b.container({ css_classes: `sx-feature sx-feature-${f.id}`, _element_id: f.id }, [art(f), copy(f)]))

  return b.root(pairs, {
    classes: 'sx-features',
    settings: { padding: sides(200, L.pad, 0, L.pad) },
    css: [
      'selector>.e-con-inner{gap:200px!important}',
      'selector .sx-feature{display:grid!important;grid-template-columns:1fr 1fr;gap:40px!important;align-items:stretch}',
      // arte: o líquido desfocado e a conversa por cima (1em = 1px na largura de 543px)
      'selector .sx-art{position:relative;isolation:isolate;overflow:hidden;border-radius:56px;background:#fff;aspect-ratio:543/660;container-type:inline-size;height:100%}',
      'selector .sx-fluid{position:absolute!important;inset:-14%;width:auto!important;filter:blur(30px);transform:scale(1.05)}',
      ...Object.entries(PALETTES).map(([n, g]) => `selector .sx-pal-${n} .sx-fluid{background:${g}}`),
      `${MOTION_OK}@keyframes sx-drift{0%{transform:scale(1.05) translate(0,0) rotate(0)}50%{transform:scale(1.18) translate(-4%,3%) rotate(8deg)}100%{transform:scale(1.1) translate(3%,-3%) rotate(-6deg)}}selector .sx-art.sx-on .sx-fluid{animation:sx-drift 16s ease-in-out infinite alternate}}`,
      `selector .sx-chat{position:absolute!important;left:50%;top:50%;transform:translate(-50%,-50%);width:350em!important;font-size:calc(100cqw / 543);gap:12em!important;transition:opacity .45s ${E}}`,
      'selector .sx-ct .elementor-heading-title{font-size:14em;line-height:1.35;font-weight:500;letter-spacing:-.01em}',
      'selector .sx-msg{width:auto!important;max-width:300em;padding:11em 15em!important;border-radius:20em;box-shadow:0 8em 24em rgba(0,0,0,.08)}',
      `selector .sx-msg-me{align-self:flex-end;background:${SX.ink};border-bottom-right-radius:6em}`,
      'selector .sx-msg-ai{align-self:flex-start;background:#fff;border-bottom-left-radius:6em;gap:5em!important}',
      'selector .sx-ct-msg .elementor-heading-title{font-size:15em;font-weight:400}',
      'selector .sx-ai-head{gap:7em!important}selector .sx-ai-mark{width:18em!important;height:18em;flex:none!important;border-radius:5em;background:#D2F525}selector .sx-ai-mark .sx-mark-se{width:100%!important;height:100%;--sx-ic:#282828}',
      'selector .sx-ct-name .elementor-heading-title{font-size:12em;font-weight:600}',
      'selector .sx-aiwrap{position:relative}',
      'selector .sx-typing{display:none!important;position:absolute!important;left:0;top:0;width:auto!important;gap:5em!important;padding:15em 16em!important;border-radius:20em;border-bottom-left-radius:6em;background:#fff;box-shadow:0 8em 24em rgba(0,0,0,.08)}',
      'selector .sx-tdot{width:7em!important;height:7em;flex:none!important;border-radius:50%;background:#9CA3AF}',
      'selector .sx-res{width:100%!important;padding:14em!important;border-radius:20em;background:#fff;gap:9em!important;box-shadow:0 10em 30em rgba(0,0,0,.10)}',
      'selector .sx-ri{gap:10em!important;width:100%}selector .sx-ri-split{justify-content:space-between!important}',
      'selector .sx-ct-cap .elementor-heading-title{font-size:11em;font-weight:500}',
      'selector .sx-ct-row{flex:1 1 auto}selector .sx-ct-row .elementor-heading-title{font-size:13em}selector .sx-ct-wrap .elementor-heading-title{white-space:normal}',
      'selector .sx-ct-busy .elementor-heading-title{font-size:11em}',
      'selector .sx-rcheck{width:16em!important;height:16em;--sx-ic:#10B981}',
      'selector .sx-rthumb{width:46em!important;height:30em;flex:none!important;border-radius:6em}',
      'selector .sx-rthumb-0{background:linear-gradient(135deg,#FDE9D3,#F2994A)}selector .sx-rthumb-1{background:linear-gradient(135deg,#9ED8F7,#1F2A44)}selector .sx-rthumb-2{background:linear-gradient(135deg,#FFF7EC,#9ED8F7)}',
      'selector .sx-ri-sw{gap:7em!important}selector .sx-rsw{width:34em!important;height:34em;flex:none!important;border-radius:50%;border:1px solid rgba(0,0,0,.06)}',
      'selector .sx-rsw-1{background:#1F2A44}selector .sx-rsw-2{background:#F2994A}selector .sx-rsw-3{background:#9ED8F7}selector .sx-rsw-4{background:#FFF7EC}selector .sx-rsw-5{background:#FDE9D3}',
      'selector .sx-ct-aa{flex:none}selector .sx-ct-aa .elementor-heading-title{font-size:26em;font-weight:600;line-height:1}',
      'selector .sx-rli{width:15em!important;height:15em;--sx-ic:#6B7280}selector .sx-ri-sub{padding-left:18em!important}',
      'selector .sx-ri-sel{background:#EDE9FE;border-radius:8em;padding-top:5em!important;padding-bottom:5em!important;box-shadow:inset 0 0 0 1px #8B5CF6}selector .sx-ri-sel .sx-rli{--sx-ic:#7C3AED}',
      'selector .sx-rglobe{width:26em!important;height:26em;flex:none!important;border-radius:50%;background:#2271B1}selector .sx-rglobe-ic{width:15em!important;height:15em;--sx-ic:#fff}',
      'selector .sx-ri-head{padding-bottom:4em!important;border-bottom:1px solid #F0F0F0}',
      'selector .sx-rpill{width:auto!important;flex:none!important;gap:4em!important;padding:4em 9em!important;border-radius:999em}selector .sx-ct-pill .elementor-heading-title{font-size:11em}',
      'selector .sx-rok{background:#ECFDF5}selector .sx-rok-ic{width:12em!important;height:12em;--sx-ic:#047857}selector .sx-rdot{width:7em!important;height:7em;flex:none!important;border-radius:50%;background:#10B981}',
      'selector .sx-ri-shot{line-height:0}selector .sx-rshot{width:100%}selector .sx-rshot img{width:100%;height:96em;object-fit:cover;border-radius:10em}',
      'selector .sx-ri-btns{gap:8em!important}selector .sx-rbtn{flex:1 1 0!important;height:34em;border-radius:999em;border:1px solid #E5E5E5}selector .sx-rbtn-dark{background:#222;border-color:#222}selector .sx-ct-btn .elementor-heading-title{font-size:12em;font-weight:500}',
      'selector .sx-ri-end{justify-content:flex-end!important}',
      // a conversa toca quando o card aparece (o script põe sx-on e recomeça em volta); sem script fica tudo à vista
      'html.sx-live selector .sx-typing{display:flex!important;opacity:0}',
      'html.sx-live selector .sx-msg,html.sx-live selector .sx-res,html.sx-live selector .sx-ri{opacity:0}',
      `@keyframes sx-in{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}`,
      `@keyframes sx-type{0%{opacity:0;transform:translateY(10px)}18%{opacity:1;transform:none}82%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-4px)}}`,
      '@keyframes sx-bounce{0%,60%,100%{transform:none;opacity:.5}30%{transform:translateY(-4em);opacity:1}}',
      `html.sx-live selector .sx-on .sx-msg-me{animation:sx-in .5s ${E} .3s both}`,
      `html.sx-live selector .sx-on .sx-typing{animation:sx-type 1.3s ${E} 1.1s both}`,
      'html.sx-live selector .sx-on .sx-tdot{animation:sx-bounce 1s infinite}html.sx-live selector .sx-on .sx-tdot:nth-child(2){animation-delay:.15s}html.sx-live selector .sx-on .sx-tdot:nth-child(3){animation-delay:.3s}',
      `html.sx-live selector .sx-on .sx-msg-ai{animation:sx-in .5s ${E} 2.4s both}`,
      `html.sx-live selector .sx-on .sx-res{animation:sx-in .55s ${E} 3.1s both}`,
      ...[1, 2, 3, 4, 5, 6].map((n) => `html.sx-live selector .sx-on .sx-ri:nth-child(${n}){animation:sx-in .45s ${E} ${(3.45 + n * 0.32).toFixed(2)}s both}`),
      'html.sx-live selector .sx-art.sx-out .sx-chat{opacity:0}',
      'html.sx-live selector .sx-art.sx-paused *{animation-play-state:paused!important}',
      // card de texto
      `selector .sx-copy{padding:60px!important;border-radius:40px;background:${SX.card2}}`,
      'selector .sx-ficon{width:90px!important;height:90px;flex:none!important;border-radius:50%;background:#fff;border:1px solid #F0F0F0}',
      'selector .sx-ficon-ic{width:40px!important;height:40px}',
      ...SX_FEATURES.map((f) => `selector .sx-feature-${f.id} .sx-ficon-ic{--sx-ic:${f.tint}}`),
      'selector .sx-fh3{margin-top:40px}selector .sx-fp{margin-top:40px}',
      'selector .sx-chans{margin-top:40px;width:auto!important}',
      `selector .sx-chan{position:relative;width:auto!important;flex:none!important;height:42px;padding:0 14px!important;border-radius:85px;background:${SX.chip};transition:background .18s!important}`,
      'selector .sx-chan:hover{background:#E6E6E6}',
      `selector .sx-chan-ic{width:17px!important;height:17px;--sx-ic:${SX.ink}}selector .sx-chan-t{white-space:nowrap}`,
      '@media (max-width:1200px){selector{padding-top:160px!important}selector>.e-con-inner{gap:160px!important}selector .sx-copy{padding:48px!important}}',
      '@media (max-width:900px){selector .sx-feature{grid-template-columns:1fr;gap:20px!important}selector .sx-art{border-radius:33px;height:auto}selector .sx-copy{border-radius:33px;padding:40px!important}}',
      '@media (max-width:560px){selector{padding:120px 35px 0 36px!important}selector>.e-con-inner{gap:80px!important}',
      'selector .sx-art{border-radius:33.17px;aspect-ratio:322/380}',
      `selector .sx-copy{padding:40px!important;border-radius:40px;background:${SX.card3}}`,
      'selector .sx-ficon{width:48px!important;height:48px}selector .sx-ficon-ic{width:22px!important;height:22px}',
      'selector .sx-fh3,selector .sx-fp,selector .sx-chans{margin-top:20px}',
      'selector .sx-chans{gap:7.6px!important}selector .sx-chan{height:32.4px;padding:0 10.9px 0 11px!important;gap:4.1px!important;border-radius:65.3px}selector .sx-chan-ic{width:13px!important;height:13px}}',
    ].join(''),
  })
}

// =====================================================================
// 6. Biblioteca: carrossel no desenho do time do original
// =====================================================================

export const buildLibrary = () => {
  const b = createModelBuilder('sxe')
  const card = (c: (typeof SX_LIBRARY.cards)[number]) => b.col([
    b.container({ css_classes: 'sx-person-photo' }, [b.image(photo(c.photo), c.name, { _css_classes: 'sx-person-img' })]),
    b.heading(c.name, T.name20, SX.ink, { header_size: 'h3', _css_classes: 'sx-person-name' }),
    b.heading(c.role, T.role20, SX.soft, { _css_classes: 'sx-person-role' }),
    b.box('sx-person-in', [b.icon('plus', 'sx-person-plus')]),
    b.text(c.text, T.p14b, SX.soft, { _css_classes: 'sx-person-text' }),
  ], 0, { css_classes: 'sx-person' })
  return b.root([
    rowhead(b, SX_LIBRARY.title),
    b.row(SX_LIBRARY.cards.map(card), 40, { css_classes: 'sx-scroller sx-bleed' }),
  ], {
    classes: 'sx-lib sx-rows', id: 'biblioteca',
    settings: { padding: sides(200, L.pad, 0, L.pad) },
    css: [
      ROWHEAD_CSS,
      'selector .sx-person{width:312px!important}',
      'selector .sx-person-photo{width:100%;aspect-ratio:312/366;border-radius:32px;overflow:hidden;background:#fff}',
      'selector .sx-person-img,selector .sx-person-img .elementor-widget-container{width:100%;height:100%}selector .sx-person-img img{width:100%;height:100%;object-fit:cover;object-position:top}',
      'selector .sx-person-name{margin-top:20px}',
      `selector .sx-person-in{width:24px!important;height:24px;margin-top:20px;border-radius:4px;background:${SX.ink}}selector .sx-person-plus{width:14px!important;height:14px;--sx-ic:#fff}`,
      'selector .sx-person-text{margin-top:20px}',
      '@media (max-width:1200px){selector{padding-top:160px!important}}',
      '@media (max-width:560px){selector{padding-top:90px!important}selector .sx-rowhead-h{margin-left:8px}selector .sx-scroller{margin-top:77px}',
      'selector .sx-person{width:190px!important}selector .sx-person-photo{aspect-ratio:190/220;border-radius:19.34px}}',
    ].join(''),
  })
}

// =====================================================================
// 7. Planos: as funções em pílulas e os três planos
// =====================================================================

export const buildPlans = () => {
  const b = createModelBuilder('sxf')
  const pill = (label: string) => b.heading(label, T.pill, SX.ink, { _css_classes: 'sx-pill' })
  const plan = (p: (typeof SX_PLANS.plans)[number]) => {
    const items = p.items.filter((i) => !/^Tudo do plano/.test(i))
    const first = p.key === 'produto' ? 'Tudo para um site, incluindo:' : 'Tudo do Produto, mais:'
    return b.col([
      ...(p.featured ? [b.row([b.icon('star', 'sx-tag-ic'), b.heading(p.featured, T.tag, SX.ink, { _css_classes: 'sx-tag-t' })], 4, { css_classes: 'sx-tag sx-tag-top' })] : []),
      b.box('sx-picon', [b.icon(SX_PLANS.icons[p.key], 'sx-picon-ic')]),
      b.heading(`${p.name}<small>${p.text}</small>`, T.planName, SX.lede, { header_size: 'h3', _css_classes: 'sx-plan-name' }),
      b.heading(SX_PLANS.perMonth, T.per, SX.ink, { _css_classes: 'sx-per' }),
      b.heading(brl(p.price), T.price, SX.title, { _css_classes: 'sx-price' }),
      b.text(`<ul><li class="sx-inherit${p.key === 'produto' ? ' sx-all' : ''}">${first}</li>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`, T.list, SX.lede, { _css_classes: 'sx-plan-list' }),
      b.button(SX_PLANS.cta, '/auth', 'sx-plan-btn'),
    ], 0, { css_classes: `sx-plan sx-plan-${p.key}${p.featured ? ' sx-plan-plus' : ''}`, flex_align_items: 'flex-start' })
  }
  return b.root([
    b.heading(SX_PLANS.title, T.h2big, SX.black, { header_size: 'h2', _css_classes: 'sx-plans-h' }),
    b.text(SX_PLANS.lede, { size: 20, line: 28, letter: -0.6, mobile: { size: 16, line: 20.8, letter: -0.48 } }, SX.lede, { _css_classes: 'sx-plans-lede' }),
    b.col(SX_PLANS.features.map((r) => b.row(r.map(pill), 10, { css_classes: 'sx-feat-row', flex_wrap: 'wrap' })), 10, { css_classes: 'sx-feats' }),
    b.row(SX_PLANS.plans.map(plan), 15, { css_classes: 'sx-planrow', flex_align_items: 'stretch' }),
  ], {
    classes: 'sx-plans', id: 'planos',
    settings: { padding: sides(120, L.pad, 0, L.pad) },
    css: [
      'selector{overflow-x:clip}',
      'selector .sx-plans-h .elementor-heading-title{font-size:clamp(40px,6.25vw,90px)}',
      'selector .sx-plans-lede{margin-top:24px;max-width:760px}',
      'selector .sx-feats{margin-top:40px}selector .sx-feat-row{width:100%;flex-wrap:wrap!important}',
      'selector .sx-pill{flex:none;display:inline-flex;align-items:center;height:40px;padding:0 12px;border-radius:76px;background:#fff;white-space:nowrap}',
      'selector .sx-planrow{margin-top:60px;padding-top:16px!important;overflow-x:auto;scrollbar-width:none}selector .sx-planrow::-webkit-scrollbar{display:none}',
      `selector .sx-plan{position:relative;flex:1 0 269px!important;width:auto!important;padding:40px!important;border-radius:40px;background:${SX.card3}}`,
      `selector .sx-plan-plus{border:1.6px solid ${SX.yellow}}`,
      `selector .sx-tag{position:absolute!important;top:-16px;left:37px;width:auto!important;height:32.4px;padding:0 10.9px!important;border-radius:65px;background:${SX.yellow};white-space:nowrap}`,
      `selector .sx-tag-ic{width:13px!important;height:13px;--sx-ic:${SX.ink}}`,
      'selector .sx-picon{width:48px!important;height:48px;flex:none!important;border:.8px solid #F5F5F5;border-radius:50%;background:#fff}',
      'selector .sx-picon-ic{width:22px!important;height:22px}',
      `selector .sx-plan-produto .sx-picon-ic{--sx-ic:${SX.violet}}selector .sx-plan-completo .sx-picon-ic{--sx-ic:#F59E0B}selector .sx-plan-agencia .sx-picon-ic{--sx-ic:${SX.emerald}}`,
      'selector .sx-plan-name{margin-top:20px}selector .sx-plan-name small{display:block;min-height:3.6em;font-size:14px;font-weight:400;line-height:1.2;margin-top:2px}',
      'selector .sx-per{margin-top:20px}selector .sx-per .elementor-heading-title{display:inline-flex;align-items:center;height:22px;padding:0 10px;border:.78px solid #000;border-radius:65px;white-space:nowrap}',
      'selector .sx-price{margin-top:20px}',
      'selector .sx-plan-list{margin:20px 0}selector .sx-plan-list ul{margin:0;padding-left:18px}',
      `selector .sx-plan-list li.sx-inherit{list-style:none;display:flex;align-items:center;gap:8px;margin:0 0 14px -18px;padding:8px 12px 8px 8px;border-radius:12px;background:#F2F3F3;color:${SX.title};font-size:12.5px;line-height:1.3;font-weight:700}`,
      'selector .sx-plan-list li.sx-inherit::before{content:"+";flex:none;display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#222;color:#fff;font-size:14px;line-height:1;font-weight:500}',
      'selector .sx-plan-list li.sx-all::before{content:"✓";font-size:11px}',
      'selector .sx-plan-btn{width:100%;margin-top:auto}selector .sx-plan-btn .elementor-button{width:100%;padding:0 16px}',
      '@media (max-width:560px){selector{padding-top:40px!important}selector .sx-plans-lede{margin-top:16px}',
      // celular: as linhas de pílulas passam da tela e rolam juntas; os planos viram carrossel
      'selector .sx-feats{width:auto!important;margin-left:calc(-1 * var(--sx-gutter));margin-right:calc(-1 * var(--sx-gutter));padding:0 var(--sx-gutter)!important;overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain}selector .sx-feats::-webkit-scrollbar{display:none}',
      'selector .sx-feat-row{flex-wrap:nowrap!important;width:max-content!important}',
      'selector .sx-planrow{scroll-snap-type:x mandatory;margin-right:calc(-1 * var(--sx-gutter));padding-right:var(--sx-gutter)!important;width:auto!important}selector .sx-plan{flex:0 0 269px!important;scroll-snap-align:start}}',
    ].join(''),
  })
}

// =====================================================================
// 8. Novidades: carrossel no desenho da mídia do original
// =====================================================================

export const buildNews = () => {
  const b = createModelBuilder('sxg')
  const card = (n: (typeof SX_NEWS.items)[number]) => b.col([
    b.box('sx-nlogo', [b.icon(n.icon, 'sx-nlogo-ic')], { background_background: 'classic', background_color: n.tint }),
    b.heading(n.title, T.news, SX.ink, { header_size: 'h3', link: link(SX_NEWS.url), _css_classes: 'sx-stretch sx-ntitle' }),
    b.heading(n.when, T.small14, SX.placeholder, { _css_classes: 'sx-nwhen' }),
    b.icon('ext', 'sx-next-ic'),
  ], 16, { css_classes: 'sx-news', flex_align_items: 'flex-start' })
  return b.root([
    rowhead(b, SX_NEWS.title),
    b.row(SX_NEWS.items.map(card), 20, { css_classes: 'sx-scroller sx-bleed' }),
  ], {
    classes: 'sx-press sx-rows', id: 'novidades',
    settings: { padding: sides(120, L.pad, 0, L.pad) },
    css: [
      ROWHEAD_CSS,
      `selector .sx-news{position:relative;width:300px!important;padding:24px!important;border-radius:40px;background:${SX.card2};transition:transform .18s!important}`,
      'selector .sx-news:hover{transform:translateY(-3px)}',
      'selector .sx-nlogo{width:48px!important;height:48px;flex:none!important;border-radius:50%;margin-bottom:4px}selector .sx-nlogo-ic{width:22px!important;height:22px;--sx-ic:#fff}',
      `selector .sx-next-ic{width:28px!important;height:28px;--sx-ic:${SX.ink};-webkit-mask-size:18px;mask-size:18px}`,
      '@media (max-width:560px){selector .sx-news{width:240px!important}}',
    ].join(''),
  })
}

// =====================================================================
// 9. Perguntas: lista que abre com o + virando −
// =====================================================================

export const buildFaq = () => {
  const b = createModelBuilder('sxk')
  const accordion = b.widget('nested-accordion', {
    items: SX_FAQ.items.map(([question], i) => ({ item_title: question, _id: `sxq${i + 1}` })),
    default_state: 'all_collapsed',
    max_items_expended: 'multiple',
    n_accordion_animation_duration: { unit: 'ms', size: 350, sizes: [] },
    ...type(T.faqQ, 'title_typography'),
    normal_title_color: SX.black, hover_title_color: SX.soft, active_title_color: SX.black,
    _css_classes: 'sx-faq-list',
  })
  accordion.elements = SX_FAQ.items.map(([, answer]) => b.col([
    b.text(answer, T.faqA, SX.faqAnswer, { _css_classes: 'sx-faq-a' }),
  ], 0, { css_classes: 'sx-faq-body' }))
  return b.root([
    b.heading(SX_FAQ.title, T.h2, SX.black, { header_size: 'h2', _css_classes: 'sx-faq-h' }),
    accordion,
  ], {
    classes: 'sx-faq', id: 'perguntas',
    settings: { padding: sides(206, L.pad, 200, L.pad) },
    css: [
      'selector .sx-faq-h .elementor-heading-title{font-size:clamp(40px,5.55vw,80px)}',
      `selector .e-n-accordion{display:block;margin-top:84px;border-top:1px solid ${SX.faqLine}}`,
      `selector .e-n-accordion-item{display:block;border-bottom:1px solid ${SX.faqLine};interpolate-size:allow-keywords}`,
      `selector .e-n-accordion-item-title{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:44px 0!important;border:0!important;border-radius:0!important;background:none!important;list-style:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:padding .35s ${E},color .18s}`,
      'selector .e-n-accordion-item[open]>.e-n-accordion-item-title{padding-bottom:12px!important}',
      'selector .e-n-accordion-item-title::-webkit-details-marker{display:none}',
      'selector .e-n-accordion-item-title-header{flex:1 1 auto}',
      // o + do original: duas barras de 2px; aberto, a vertical encolhe e fica o −
      'selector .e-n-accordion-item-title-icon{position:relative;display:block!important;width:20px;height:20px;flex:none}selector .e-n-accordion-item-title-icon>*{display:none!important}',
      `selector .e-n-accordion-item-title-icon::after{content:"";position:absolute;inset:0;background:linear-gradient(#000,#000) center/100% 2px no-repeat,linear-gradient(#000,#000) center/2px 100% no-repeat;transition:background-size .3s ${E}}`,
      'selector .e-n-accordion-item[open] .e-n-accordion-item-title-icon::after{background-size:100% 2px,2px 0}',
      'selector .e-n-accordion-item>.e-con,selector .sx-faq-body{border:0!important;padding:0 0 48px!important}',
      'selector .sx-faq-a{max-width:426px}selector .sx-faq-a p{font-feature-settings:"salt" 1}',
      `selector .e-n-accordion-item::details-content{block-size:0;overflow:hidden;transition:block-size .35s ${E},content-visibility .35s allow-discrete}`,
      'selector .e-n-accordion-item[open]::details-content{block-size:auto}',
      '@media (max-width:560px){selector{padding:50px 24px 80px!important}selector .e-n-accordion{margin-top:40px}selector .e-n-accordion-item-title{text-wrap:balance}selector .sx-faq-a{max-width:281px}}',
    ].join(''),
  })
}

// =====================================================================
// 10. Rodapé grafite: quatro garantias e as colunas de links
// =====================================================================

export const buildFooter = () => {
  const b = createModelBuilder('sxm')
  const trust = b.container({ css_classes: 'sx-trust' }, SX_FOOTER.trust.map((t) => b.col([
    b.row([b.icon(t.icon, 'sx-trust-ic'), b.heading(t.name, T.trustName, '#fff', { _css_classes: 'sx-trust-name' })], 8, { css_classes: 'sx-trust-logo' }),
    b.text(t.text, T.trust, SX.onDark, { _css_classes: 'sx-trust-text' }),
  ], 20, { css_classes: 'sx-trust-card' })))
  const columns = SX_FOOTER.columns.map(([title, links], i) => b.col([
    b.heading(title, T.fcolH, '#fff', { header_size: 'h3', _css_classes: 'sx-fcol-h' }),
    ...links.map(([label, url]) => b.heading(label, T.flink, '#fff', { link: link(url), _css_classes: 'sx-flink' })),
  ], 0, { css_classes: `sx-fcol${i === 3 ? ' sx-sup' : ''}` }))
  return b.root([
    trust,
    b.container({ css_classes: 'sx-fgrid' }, [
      b.col([
        b.mark('sx-fmark'),
        b.text(SX_FOOTER.note, T.trust, '#AAB4BA', { _css_classes: 'sx-fnote' }),
      ], 0, { css_classes: 'sx-fbrand' }),
      ...columns,
      b.heading(SX_FOOTER.copyright, T.fine, SX.faint, { _css_classes: 'sx-cnpj' }),
    ]),
  ], {
    tag: 'footer', classes: 'sx-footer', background: SX.dark,
    settings: { padding: sides(200, L.pad, 200, L.pad) },
    css: [
      'selector .sx-trust{display:grid!important;grid-template-columns:repeat(4,1fr);gap:19px!important}',
      `selector .sx-trust-card{min-height:167px;padding:24px!important;border:1px solid ${SX.line};border-radius:32px;background:${SX.dark};gap:20px!important}`,
      'selector .sx-trust-logo{width:auto!important}selector .sx-trust-ic{width:20px!important;height:20px;--sx-ic:#fff}',
      'selector .sx-fgrid{display:grid!important;grid-template-columns:397px 207px 198px 195px 1fr;margin-top:200px}',
      'selector .sx-fbrand{justify-content:space-between!important;gap:40px!important}',
      `selector .sx-fmark{width:56px!important;height:56px;flex:none!important;border-radius:14px;background:${SX.lime}}selector .sx-fmark .sx-mark-se{width:100%!important;height:100%;--sx-ic:${SX.graphite}}`,
      'selector .sx-fnote{max-width:260px}',
      'selector .sx-fcol-h{margin-bottom:10px}selector .sx-flink{white-space:nowrap}selector .sx-flink a{transition:opacity .18s}selector .sx-flink a:hover{opacity:.7}',
      'selector .sx-sup,selector .sx-cnpj{grid-column:5;grid-row:1}selector .sx-cnpj{align-self:end}',
      '@media (max-width:1200px){selector .sx-fgrid{grid-template-columns:1.4fr 1fr 1fr 1fr 1fr;gap:24px!important}}',
      '@media (max-width:900px){selector{padding-top:80px!important;padding-bottom:80px!important}selector .sx-trust{grid-template-columns:1fr 1fr}',
      'selector .sx-fgrid{grid-template-columns:1fr 1fr;gap:40px 24px!important;margin-top:120px}selector .sx-fbrand{grid-column:1/-1;flex-direction:row!important;align-items:center}',
      'selector .sx-sup{grid-column:auto;grid-row:auto}selector .sx-cnpj{grid-column:1/-1;grid-row:auto}}',
      '@media (max-width:560px){selector{padding:69px 24px 77px!important;text-align:center}',
      'selector .sx-trust{display:flex!important;flex-direction:row!important;gap:20px!important;overflow-x:auto;scrollbar-width:none;margin:0 calc(-1 * var(--sx-gutter)) 0 -4px;padding-right:var(--sx-gutter)!important;width:auto!important}selector .sx-trust::-webkit-scrollbar{display:none}',
      'selector .sx-trust-card{flex:none!important;width:220px!important;min-height:169px;text-align:left}',
      'selector .sx-fgrid{display:flex!important;flex-direction:column;align-items:center;gap:40px!important;margin-top:120px}selector .sx-fbrand{display:contents!important}',
      'selector .sx-fmark{order:-1;margin-bottom:40px}selector .sx-fnote{order:9;margin-top:60px}selector .sx-cnpj{order:10;margin-top:-4px}selector .sx-fcol{align-items:center}}',
    ].join(''),
  })
}
