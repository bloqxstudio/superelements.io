import { EV, EV_EASE as E, EV_FONTS as F, evAsset } from './tokens'
import { EV_MOTION_SCRIPT } from './motion'
import { EVERMIND_CONTENT, type EvContent } from './content'

/**
 * Hero "Animated Hero with Scrolling Gallery" (BYQ, template Evermind™) como
 * árvore nativa do Elementor. Medidas do CSS do Webflow; os três widgets de
 * vidro, que no original são SVGs do Figma com o texto em curvas, viram
 * containers com texto nativo, nas medidas dos SVGs. Só o arco do medidor é
 * imagem (PNG: o WordPress recusa SVG).
 *
 * O desenho é sempre o do original; os textos e as imagens de conteúdo vêm de
 * um `EvContent` (content.ts): o do template ou o do Superelements.
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

export const px = (size: number) => ({ unit: 'px', size, sizes: [] })
export const pct = (size: number) => ({ unit: '%', size, sizes: [] })
export const fluid = (value: string) => ({ unit: 'custom', size: value, sizes: [] })
export const gap = (row: number, column = row) => ({ unit: 'px', size: row, row: String(row), column: String(column), isLinked: row === column })
export const sides = (top: number, right = top, bottom = top, left = right) => ({
  unit: 'px', top: String(top), right: String(right), bottom: String(bottom), left: String(left),
  isLinked: top === right && right === bottom && bottom === left,
})
export const media = (url: string, alt = '') => ({ id: '', url, alt, source: 'url', size: '' })
export const link = (url: string) => ({ url, is_external: '', nofollow: '', custom_attributes: '' })
export const bg = (color: string) => ({ background_background: 'classic', background_color: color })
/** Gradiente linear da esquerda para a direita. */
export const gradient = (from: string, to: string, angle = 90) => ({
  background_background: 'gradient',
  background_color: from, background_color_stop: pct(0),
  background_color_b: to, background_color_b_stop: pct(100),
  background_gradient_type: 'linear', background_gradient_angle: { unit: 'deg', size: angle, sizes: [] },
})
const radius = (value: number) => ({ border_radius: sides(value) })
const ROUND = radius(999)
/** Container de medida fixa em todos os aparelhos. */
const fixed = (width: number, height?: number): JsonRecord => ({
  _flex_size: 'none', width: px(width), width_tablet: px(width), width_mobile: px(width),
  ...(height !== undefined ? { min_height: px(height) } : {}),
})
const AUTO_WIDTH = { width: fluid('auto'), width_tablet: fluid('auto'), width_mobile: fluid('auto'), _flex_size: 'none' }

/** Largura e altura mínima por aparelho (desktop, tablet, celular). */
const box = (width: [number, number, number], height: [number, number, number]): JsonRecord => ({
  _flex_size: 'none',
  width: px(width[0]), width_tablet: px(width[1]), width_mobile: px(width[2]),
  min_height: px(height[0]), min_height_tablet: px(height[1]), min_height_mobile: px(height[2]),
})

interface TypeSpec {
  family: string
  size: number
  line: number
  weight: number
  /** Em px. */
  letter?: number
  transform?: string
  mobile?: { size: number; line: number; letter?: number }
}

const typography = (spec: TypeSpec, group = 'typography'): JsonRecord => ({
  [`${group}_typography`]: 'custom',
  [`${group}_font_family`]: spec.family,
  [`${group}_font_size`]: px(spec.size),
  [`${group}_line_height`]: px(spec.line),
  [`${group}_font_weight`]: String(spec.weight),
  ...(spec.letter !== undefined ? { [`${group}_letter_spacing`]: px(spec.letter) } : {}),
  ...(spec.transform ? { [`${group}_text_transform`]: spec.transform } : {}),
  ...(spec.mobile
    ? {
        [`${group}_font_size_mobile`]: px(spec.mobile.size),
        [`${group}_line_height_mobile`]: px(spec.mobile.line),
        ...(spec.mobile.letter !== undefined ? { [`${group}_letter_spacing_mobile`]: px(spec.mobile.letter) } : {}),
      }
    : {}),
})

/** Escala do template (classes text-h1, text-h4, body, text-small, label-small e cta). */
export const T = {
  h1: { family: F.serif, size: 60, line: 64, weight: 400, letter: -2.5, mobile: { size: 48, line: 52, letter: -2 } },
  h4: { family: F.serif, size: 32, line: 40, weight: 400, letter: -1, mobile: { size: 28, line: 32, letter: -1 } },
  body: { family: F.sans, size: 16, line: 24, weight: 500, letter: 0, mobile: { size: 14, line: 20 } },
  small: { family: F.sans, size: 12, line: 16, weight: 500, letter: 0, mobile: { size: 10, line: 14 } },
  label: { family: F.sans, size: 10, line: 12, weight: 500, letter: 1, transform: 'uppercase', mobile: { size: 8, line: 10, letter: 0.5 } },
  button: { family: F.sans, size: 14, line: 20, weight: 400, letter: 0, mobile: { size: 12, line: 20 } },
  // widgets de vidro: medidas fixas dos SVGs (lá eram imagem e não mudavam com o aparelho)
  wLabel: { family: F.sans, size: 10, line: 12, weight: 500, letter: 1, transform: 'uppercase' },
  wQuote: { family: F.sans, size: 16, line: 24, weight: 500, letter: 0 },
  wTitle: { family: F.sans, size: 16, line: 24, weight: 400, letter: 0 },
  wSmall: { family: F.sans, size: 12, line: 16, weight: 400, letter: 0 },
  wBar: { family: F.sans, size: 14, line: 16, weight: 500, letter: -0.28 },
  wValue: { family: F.sans, size: 10, line: 12, weight: 500, letter: 0.5 },
  wLink: { family: F.sans, size: 14, line: 20, weight: 400, letter: 0 },
  wNumber: { family: F.serif, size: 44, line: 44, weight: 400, letter: -2 },
} satisfies Record<string, TypeSpec>

// ---------- CSS da seção ----------

const svg = (body: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'>${body}</svg>`)}")`
const CHEVRON = svg("<path d='M6 12L10 8L6 4' stroke='black' stroke-width='2' stroke-linecap='square'/>")
const ARROW = svg("<path d='M3.336 8H12.003M8.003 3.332L12.669 8L8.003 12.665' stroke='black' stroke-linecap='round' stroke-linejoin='round'/>")
const mask = (url: string) => `-webkit-mask:${url} center/16px 16px no-repeat;mask:${url} center/16px 16px no-repeat`

const INSET = 'inset 0 -1px 0 0 rgba(26,26,23,.08),inset 0 1px 0 0 rgba(26,26,23,.04)'
const GLASS = `box-shadow:${INSET};-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)`
const MOTION = '@media(prefers-reduced-motion:no-preference){'

export const EV_CSS = [
  'selector{overflow:clip;position:relative}',
  'selector,selector *{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}',
  'selector a{color:inherit;text-decoration:none}selector a:focus{outline:none}',
  'selector .elementor-heading-title{margin:0}selector .elementor-widget-text-editor p{margin:0}',
  'selector .elementor-widget-image{line-height:0}selector .elementor-widget-image img{display:block}',
  // o Elementor anima o transform dos containers (0,4s): aqui o transform é do carrossel
  'selector,selector .e-con{transition-property:background,border,box-shadow}',

  // fundo de pontos: 1px a cada 17px, 36% de tinta, com máscara radial (Dots.svg do original)
  'selector .ev-dots{position:absolute!important;top:0!important;left:50%!important;right:auto!important;width:1440px!important;max-width:none!important;height:1080px;min-height:0;padding:0;margin:0;transform:translateX(-50%);pointer-events:none;z-index:0;border-radius:8px;',
  'background-image:conic-gradient(from 0deg at 1px 1px,rgba(25,25,22,0) 75%,rgba(25,25,22,.36) 0);background-size:17px 17px;background-position:22px 21px;',
  '-webkit-mask-image:radial-gradient(closest-side,#000,transparent);mask-image:radial-gradient(closest-side,#000,transparent)}',

  'selector .ev-main{position:relative;z-index:2}selector .ev-head{text-align:center}',

  // links que cobrem a peça inteira (o original é um <a> em volta)
  'selector .ev-stretch,selector .ev-stretch>.elementor-widget-container{position:static}',
  'selector .ev-stretch a::after{content:"";position:absolute;inset:0;z-index:3;border-radius:100vw}',
  'selector .ev-card .e-con{position:static}selector .ev-card .ev-stretch a::after{border-radius:8px}',
  'selector .ev-stretch a:focus-visible::after{outline:2px solid #1a1a17;outline-offset:3px}',

  // rótulo do topo; em tela estreita o texto quebra, como no flex do Webflow
  'selector .ev-label{position:relative;max-width:100%}selector .ev-label .ev-stretch{flex:0 1 auto!important;min-width:0}',
  'selector .ev-icon img{width:24px;height:24px;border-radius:100vw;object-fit:cover}',
  `selector .ev-chevron{flex:none!important;width:16px!important;height:16px;min-height:16px;padding:0;${mask(CHEVRON)}}`,

  // Buy Template: o fundo é uma camada própria que encolhe a 95% e escurece; o texto rola 1,5em e a cópia clara vem do text-shadow
  'selector .ev-cta .elementor-button{position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;background:none!important;border:0!important;box-shadow:none;transition:color 1s}',
  `selector .ev-cta .elementor-button::before{content:"";position:absolute;inset:0;z-index:-1;border:1px solid rgba(26,26,23,0);border-radius:100vw;background-color:${EV.lime};box-shadow:inset 0 1px 0 0 rgba(26,26,23,.04),inset 0 -1px 0 0 rgba(26,26,23,.08);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);transition:border-color 1s,background-color 1s,transform .4s ${E.easeOut}}`,
  'selector .ev-cta .elementor-button:hover::before,selector .ev-cta .elementor-button:focus-visible::before{border-color:rgba(244,243,234,.08);background-color:rgba(26,26,23,.88)}',
  'selector .ev-cta .elementor-button-content-wrapper{display:block;height:20px;overflow:hidden}',
  'selector .ev-cta .elementor-button:focus-visible{outline:2px solid #1a1a17;outline-offset:3px}',

  // Book a call: o fundo encolhe a 95% e o texto rola com uma cópia igual
  'selector .ev-book{position:relative;isolation:isolate}',
  `selector .ev-book::before{content:"";position:absolute;inset:0;width:auto;height:auto;z-index:-1;opacity:1;mix-blend-mode:normal;border:1px solid rgba(26,26,23,.32);border-radius:100vw;background-color:${EV.paper};transition:background-color 1s,transform .4s ${E.easeOut}}`,
  'selector .ev-face{position:relative;flex:none!important;width:44px!important;height:28px;min-height:28px;padding:0}',
  'selector .ev-face img{width:44px;height:28px;object-fit:cover;border:1px solid rgba(26,26,23,.08);border-radius:32px;box-sizing:border-box}',
  `selector .ev-status{position:absolute!important;right:0!important;bottom:0!important;left:auto!important;top:auto!important;width:12px!important;height:12px;min-height:12px;padding:0;z-index:1;border:2px solid ${EV.paper};border-radius:100vw;box-sizing:border-box}`,
  'selector .ev-mask{display:block;height:20px;overflow:hidden}selector .ev-roll{display:block}',

  MOTION,
  `selector .ev-cta .elementor-button-text{display:block;color:${EV.ink};text-shadow:0 1.5em 0 ${EV.paper};transition:transform .4s ${E.easeOut}}`,
  `selector .ev-cta .elementor-button:hover .elementor-button-text,selector .ev-cta .elementor-button:focus-visible .elementor-button-text{transform:translateY(-1.5em);transition:transform .6s ${E.outQuint}}`,
  `selector .ev-cta .elementor-button:hover::before,selector .ev-cta .elementor-button:focus-visible::before{transform:scale(.95);transition:border-color 1s,background-color 1s,transform .5s ${E.outCirc}}`,
  `selector .ev-roll{text-shadow:0 1.5em 0 currentColor;transition:transform .4s ${E.easeOut}}`,
  `selector .ev-book:hover .ev-roll,selector .ev-book:focus-within .ev-roll{transform:translateY(-1.5em);transition:transform .6s ${E.outCirc}}`,
  `selector .ev-book:hover::before,selector .ev-book:focus-within::before{transform:scale(.95);transition:background-color 1s,transform .5s ${E.outCirc}}`,
  '}',

  // entrada (motion.ts arma ev-armed antes da primeira pintura e põe ev-play)
  'selector.ev-armed .ev-in{opacity:0;filter:blur(12px)}',
  `selector.ev-armed.ev-play .ev-in{opacity:1;filter:blur(0);transition:opacity .5s linear var(--ev-delay,0s),filter .5s ${E.outCirc} var(--ev-delay,0s)}`,
  'selector .ev-in-1{--ev-delay:.1s}selector .ev-in-2{--ev-delay:.4s}selector .ev-in-3{--ev-delay:.6s}',

  // carrossel: três grupos iguais andam juntos, uma volta = um grupo + o espaço
  'selector .ev-marquee{position:relative;overflow:hidden}',
  'selector .ev-track{--ev-gap:16px;gap:var(--ev-gap)!important;flex-wrap:nowrap!important}',
  'selector .ev-group{flex:none!important;width:auto!important;max-width:none!important;gap:var(--ev-gap)!important;flex-wrap:nowrap!important}',
  '@keyframes ev-marquee{from{transform:translate3d(0,0,0)}to{transform:translate3d(calc(-100% - var(--ev-gap)),0,0)}}',
  'selector.ev-live .ev-group{animation:ev-marquee var(--ev-marquee-time,40s) linear infinite;will-change:transform}',
  'selector .ev-fade{position:absolute!important;top:0!important;bottom:0!important;height:auto!important;min-height:0;width:120px!important;padding:0;z-index:2;pointer-events:none}',
  'selector .ev-fade-l{left:0!important;right:auto!important}selector .ev-fade-r{right:0!important;left:auto!important}',

  // peças: foto em toda a moldura; com parallax a foto tem 120% e fica centrada
  'selector .ev-tile{position:relative;overflow:hidden;flex:none!important}',
  'selector .ev-media{position:absolute!important;top:0;left:0;width:100%!important;max-width:none!important;height:100%;margin:0;z-index:0}',
  'selector .ev-media img{width:100%!important;height:100%!important;max-width:none!important;object-fit:cover;transition:none}',
  'selector .ev-par .ev-media{top:-10%;left:-10%;width:120%!important;height:120%}',
  'selector .ev-overlay{position:absolute!important;inset:0!important;width:100%!important;height:100%;z-index:1}',

  // widgets de vidro (no original, SVGs com desfoque do fundo)
  `selector .ev-glass{flex:none!important;${GLASS}}`,
  'selector .ev-states{-webkit-backdrop-filter:blur(32px);backdrop-filter:blur(32px)}',
  'selector .ev-dot{flex:none!important;width:8px!important;height:8px;min-height:8px;padding:0}',
  'selector .ev-avatar img{width:40px;height:40px;border-radius:100vw;object-fit:cover}',
  'selector .ev-bar{flex:none!important;height:29px}',
  'selector .ev-gauge{position:relative;flex:none!important;width:210px!important;height:102px;min-height:102px;padding:0}',
  'selector .ev-arc img{width:210px;height:102px}',
  'selector .ev-num{position:absolute!important;left:0!important;right:0!important;bottom:-5px!important;top:auto!important;width:100%!important}',
  `selector .ev-go{flex:none!important;width:32px!important;height:32px;min-height:32px;padding:0;${GLASS}}`,
  `selector .ev-arrow{flex:none!important;width:16px!important;height:16px;min-height:16px;padding:0;${mask(ARROW)}}`,
  `selector .ev-card{position:relative;flex:none!important}selector .ev-number-tile{border-left:1px solid ${EV.lime}}`,

  '@media(max-width:767px){selector .ev-track{--ev-gap:12px}selector .ev-states{transform:scale(.8375)}}',
  // até 479px o original encolhe as peças e o card, e as molduras esticam até a altura do card
  '@media(max-width:479px){selector .ev-tile{width:220px!important;min-height:250px}selector .ev-tile.ev-large{width:300px!important}selector .ev-card{width:400px!important}selector .ev-states{transform:scale(.5875)}selector .ev-goal{transform:scale(.9)}}',
].join('')

// ---------- construtor ----------

export const createEvermindBuilder = (content: EvContent = EVERMIND_CONTENT, prefix = 'ev') => {
  let sequence = 0
  const uid = () => `${prefix}${(++sequence).toString(36).padStart(7 - prefix.length, '0')}`
  const K = content

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

  const heading = (title: string, spec: TypeSpec, color: string, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...typography(spec), ...options })
  const text = (html: string, spec: TypeSpec, color: string, options: JsonRecord = {}) =>
    widget('text-editor', { editor: `<p>${html}</p>`, text_color: color, ...typography(spec), ...options })
  const image = (file: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(evAsset(file), alt), image_size: 'full', ...options })
  /** Widget do tamanho do conteúdo (numa linha flex). */
  const auto = { _element_width: 'auto', _flex_size: 'none' }
  /** Círculo lima com a seta. */
  const go = () => container({ ...bg(EV.lime), ...ROUND, css_classes: 'ev-go', flex_justify_content: 'center', flex_align_items: 'center', ...fixed(32, 32) }, [
    container({ ...bg(EV.ink), css_classes: 'ev-arrow', ...fixed(16, 16) }),
  ])

  // ---------- topo ----------

  const label = () => row([
    image(K.pill.icon, '', { ...auto, width: px(24), image_border_radius: sides(999), _css_classes: 'ev-icon' }),
    heading(K.pill.text, T.small, EV.ink, { ...auto, link: link(K.pill.url), _css_classes: 'ev-stretch' }),
    container({ ...bg(EV.chevron), css_classes: 'ev-chevron', ...fixed(16, 16) }),
  ], 8, { css_classes: 'ev-label ev-in ev-in-1', padding: sides(4, 8, 4, 4), ...bg(EV.pill), ...ROUND, ...AUTO_WIDTH })

  const buyButton = () => widget('button', {
    text: K.primary.text, link: link(K.primary.url), size: 'sm',
    ...typography(T.button),
    text_padding: sides(12, 16), text_padding_mobile: sides(10, 12),
    border_radius: sides(32),
    background_color: EV.lime, button_text_color: EV.ink,
    button_background_hover_color: 'rgba(26, 26, 23, 0.88)', hover_color: EV.paper,
    ...auto, _css_classes: 'ev-cta',
  })

  const bookButton = () => row([
    container({ css_classes: 'ev-face', ...fixed(44, 28) }, [
      image(K.secondary.image, '', { width: px(44), height: px(28), 'object-fit': 'cover', image_border_radius: sides(32) }),
      container({ ...bg(EV.lime), ...ROUND, css_classes: 'ev-status', position: 'absolute', _offset_orientation_h: 'end', _offset_x_end: px(0), _offset_orientation_v: 'end', _offset_y_end: px(0), ...fixed(12, 12) }),
    ]),
    heading(`<span class="ev-mask"><span class="ev-roll">${K.secondary.text}</span></span>`, T.button, EV.ink, { ...auto, link: link(K.secondary.url), _css_classes: 'ev-stretch' }),
  ], 8, { css_classes: 'ev-book', padding: sides(8, 16, 8, 12), padding_mobile: sides(8, 12, 8, 10), ...AUTO_WIDTH })

  const headline = () => col([
    label(),
    heading(K.title, T.h1, EV.ink, { header_size: 'h1', align: 'center', _css_classes: 'ev-in ev-in-2' }),
    col([
      text(K.lede, T.body, EV.ink, {
        align: 'center', _element_width: 'initial', _element_custom_width: fluid('min(100%, 552px)'), _element_custom_width_mobile: fluid('min(100%, 400px)'),
      }),
      row([buyButton(), bookButton()], 8, { flex_wrap: 'wrap', flex_justify_content: 'center' }),
    ], 20, { flex_align_items: 'center', css_classes: 'ev-in ev-in-3' }),
  ], 24, {
    css_classes: 'ev-head', flex_gap_mobile: gap(16), flex_align_items: 'center',
    width: fluid('min(100%, 680px)'), width_tablet: fluid('min(100%, 680px)'), width_mobile: fluid('min(100%, 680px)'),
    margin: sides(0, 0, 80, 0), margin_mobile: sides(0, 0, 56, 0),
  })

  // ---------- peças do carrossel ----------

  const SMALL = box([568, 400, 300], [480, 440, 360])
  const LARGE = box([672, 450, 400], [480, 440, 360])

  const photo = (file: string) => image(file, '', {
    width: pct(100), height: px(480), height_tablet: px(440), height_mobile: px(360), 'object-fit': 'cover',
    _css_classes: 'ev-media',
  })
  const tile = (file: string, options: { large?: boolean; parallax?: boolean; overlay?: ElementorNode } = {}) =>
    container({
      ...(options.large ? LARGE : SMALL), ...radius(8), overflow: 'hidden',
      flex_justify_content: 'center', flex_align_items: 'center',
      css_classes: ['ev-tile', options.large && 'ev-large', options.parallax && 'ev-par'].filter(Boolean).join(' '),
    }, [
      photo(file),
      ...(options.overlay
        ? [container({
            css_classes: 'ev-overlay', position: 'absolute',
            flex_direction: 'row', flex_justify_content: 'center', flex_align_items: 'center',
            padding: sides(24), padding_mobile: sides(16),
          }, [options.overlay])]
        : []),
    ])

  const glass = (elements: ElementorNode[], width: number, classes: string, settings: JsonRecord = {}) => col(elements, 0, {
    ...bg(EV.paper48), ...radius(16), ...fixed(width),
    css_classes: `ev-glass ${classes}`,
    ...settings,
  })

  /** Client story (Frame1000004139.svg, 252×204). */
  const storyCard = () => glass([
    row([
      container({ ...bg(EV.lime), ...ROUND, css_classes: 'ev-dot', ...fixed(8, 8) }),
      heading(K.story.label, T.wLabel, EV.label, auto),
    ], 16),
    heading(K.story.quote, T.wQuote, EV.ink),
    row([
      col([
        heading(K.story.name, T.wSmall, EV.ink),
        heading(K.story.role, T.wSmall, EV.inkSoft),
      ], 4, { _flex_size: 'custom', _flex_grow: 1, _flex_shrink: 1 }),
      image(K.story.avatar, K.story.avatarAlt, { ...auto, width: px(40), height: px(40), 'object-fit': 'cover', image_border_radius: sides(999), _css_classes: 'ev-avatar' }),
    ], 16, { flex_align_items: 'flex-end', flex_justify_content: 'space-between' }),
  ], 252, 'ev-story', { padding: sides(16), flex_gap: gap(24) })

  /** Widget.svg (320×252): barras de 272, 229, 207 e 150px. */
  const BAR_WIDTHS = [272, 229, 207, 150]
  const bar = (state: string, value: string, width: number) => row([
    heading(state, T.wBar, EV.lime, auto),
    heading(value, T.wValue, EV.ink, auto),
  ], 8, {
    ...gradient(EV.bar, EV.paper0), ...radius(4),
    css_classes: 'ev-bar', flex_justify_content: 'space-between', padding: sides(0, 8, 0, 9),
    _flex_size: 'none', width: pct(width), width_tablet: pct(width), width_mobile: pct(width), min_height: px(29),
  })
  const barsCard = () => glass([
    heading(K.bars.title, T.wTitle, EV.ink),
    col(K.bars.items.slice(0, 4).map(([state, value], i) => bar(state, value, (BAR_WIDTHS[i] / 272) * 100)), 8),
  ], 320, 'ev-states', { padding: sides(32, 24), flex_gap: gap(24) })

  /** Widget1.svg (274×286): arco em PNG, número e o botão redondo. */
  const gaugeCard = () => glass([
    heading(K.gauge.title, T.wTitle, EV.ink, { align: 'center' }),
    container({ css_classes: 'ev-gauge', ...fixed(210, 102) }, [
      image('gauge.png', '', { width: px(210), _css_classes: 'ev-arc' }),
      heading(K.gauge.number, T.wNumber, EV.ink, { align: 'center', _position: 'absolute', _css_classes: 'ev-num' }),
    ]),
    row([heading(K.gauge.link, T.wLink, EV.ink, auto), go()], 8, { flex_justify_content: 'center' }),
  ], 274, 'ev-goal', { padding: sides(32), flex_gap: gap(32), flex_align_items: 'center' })

  /** Card escuro (card-marquee): o card inteiro é o link. */
  const caseCard = () => col([
    col([
      heading(K.card.label, T.label, EV.paper48),
      heading(K.card.title, T.h4, EV.paper),
    ], 24, { flex_gap_mobile: gap(16) }),
    row([
      col([
        heading(K.card.number, T.h1, EV.paper),
        heading(K.card.caption, T.small, EV.paper64),
      ], 16, { css_classes: 'ev-number-tile', padding: sides(0, 0, 0, 24), padding_mobile: sides(0, 0, 0, 16), flex_gap_mobile: gap(12), flex_align_items: 'flex-start', ...AUTO_WIDTH }),
      row([heading(K.card.link, T.button, EV.paper, { ...auto, link: link(K.card.url), _css_classes: 'ev-stretch' }), go()], 8, AUTO_WIDTH),
    ], 32, { flex_justify_content: 'space-between', flex_align_items: 'flex-end', flex_gap_mobile: gap(24) }),
  ], 48, {
    ...bg(EV.ink), ...radius(8),
    css_classes: 'ev-card', padding: sides(24), padding_mobile: sides(16), flex_gap_mobile: gap(32),
    flex_justify_content: 'space-between', flex_align_items: 'flex-start',
    ...fixed(568),
  })

  const group = () => row([
    tile('testimonial.webp', { parallax: true }),
    tile('feature.webp', { large: true, overlay: storyCard() }),
    tile('cube.webp', { parallax: true }),
    tile('city.webp', { parallax: true, overlay: barsCard() }),
    caseCard(),
    tile('service.webp', { large: true, parallax: true, overlay: gaugeCard() }),
  ], 16, { css_classes: 'ev-group', flex_align_items: 'stretch', _flex_size: 'none' })

  const fade = (side: 'l' | 'r') => container({
    ...gradient(side === 'l' ? EV.paper : EV.paper0, side === 'l' ? EV.paper0 : EV.paper),
    css_classes: `ev-fade ev-fade-${side}`, position: 'absolute',
    ...(side === 'r' ? { _offset_orientation_h: 'end', _offset_x_end: px(0) } : {}),
    ...fixed(120),
  })

  const marquee = () => container({ css_classes: 'ev-marquee', flex_direction: 'column' }, [
    row([group(), group(), group()], 16, { css_classes: 'ev-track', flex_align_items: 'stretch' }),
    fade('l'),
    fade('r'),
  ])

  /** A seção inteira: comportamento, pontos, topo e carrossel. */
  const hero = (): ElementorNode => {
    const node = container({
      html_tag: 'section', css_classes: 'ev-hero',
      flex_direction: 'column', padding: sides(120, 0), ...bg(EV.paper),
      custom_css: EV_CSS,
    }, [
      widget('html', { html: `<script>${EV_MOTION_SCRIPT}</script>`, _css_classes: 'ev-behavior' }),
      container({ css_classes: 'ev-dots', position: 'absolute' }),
      container({ css_classes: 'ev-main', content_width: 'boxed', boxed_width: px(1800), flex_direction: 'column', flex_align_items: 'center', padding: sides(0, 32), padding_mobile: sides(0, 16) }, [headline()]),
      marquee(),
    ])
    node.isInner = false
    return node
  }

  return { hero }
}
