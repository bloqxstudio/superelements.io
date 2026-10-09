import { px, gap, sides, media, link } from '../superelements/elementor'
import { RO, RO_LIGHT, RO_FONT, RO_MONO, RO_EASE as E, RO_MARGIN } from './tokens'
import { RO_CASES, RO_NAV, RO_HUD, RO_TEXT } from './content'
import { RO_MOTION_SCRIPT } from './motion'

/**
 * Experimento "Rodas" em árvore nativa do Elementor: o cabeçalho com a faixa
 * de leitura, o palco com as duas rodas ligadas (os cases à esquerda, um dado
 * por case à direita, o texto do case no meio) e a lista de cases, que é o que
 * aparece sem WebGL. Todo o conteúdo fica em widgets nativos; o script (um
 * widget HTML só de comportamento, primeiro filho do cabeçalho) lê os cases do
 * palco e desenha as rodas por cima.
 *
 * O CSS sozinho já é a composição final: o primeiro case no centro, a capa
 * dele inclinada à esquerda, as vizinhas cortadas nos cantos e os dados à
 * direita, parados. As cores dos settings são as do tema escuro; o claro vem
 * do CSS (`html[data-ro-theme=light]`).
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

interface Spec { size: number; line: number; weight?: number; letter?: number; family?: string; transform?: string }

const type = (s: Spec, group = 'typography'): JsonRecord => ({
  [`${group}_typography`]: 'custom',
  [`${group}_font_family`]: s.family ?? RO_FONT,
  [`${group}_font_size`]: px(s.size),
  [`${group}_font_weight`]: String(s.weight ?? 400),
  [`${group}_line_height`]: { unit: 'em', size: s.line, sizes: [] },
  ...(s.letter !== undefined ? { [`${group}_letter_spacing`]: { unit: 'em', size: s.letter, sizes: [] } } : {}),
  ...(s.transform ? { [`${group}_text_transform`]: s.transform } : {}),
})

/** Escala medida no original (rem de 16px). */
const T = {
  hud: { size: 10, line: 1.5, weight: 600, letter: -0.04, family: RO_MONO },
  nav: { size: 16, line: 1.1, letter: -0.02 },
  logo: { size: 22, line: 1, weight: 500, letter: -0.06 },
  eyebrow: { size: 12, line: 1.1, letter: -0.02, transform: 'uppercase' },
  title: { size: 38, line: 1.06, weight: 500, letter: -0.028 },
  chip: { size: 12, line: 1.1, letter: -0.02, transform: 'uppercase' },
  tag: { size: 14, line: 1.1, letter: -0.02 },
  die: { size: 64, line: 1, weight: 600, letter: -0.04 },
  h2: { size: 48, line: 1.06, weight: 500, letter: -0.028 },
  drawer: { size: 40, line: 1.06, weight: 500, letter: -0.028 },
} satisfies Record<string, Spec>

// ---------- CSS comum ----------

const vars = (c: Record<string, string>) => [
  `--ro-paper:${c.paper}`, `--ro-surface:${c.surface}`, `--ro-ink:${c.ink}`, `--ro-muted:${c.muted}`,
  `--ro-hud-k:${c.hudKey}`, `--ro-hud-v:${c.hudValue}`, `--ro-fill:${c.fill}`, `--ro-line:${c.line}`,
  `--ro-divider:${c.divider}`, `--ro-spot:${c.spot}`,
].join(';')

const noise = (size: number, freq: number, octaves: number, alpha: number, seed: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='linear' slope='${alpha}'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`)}")`
const dots = (alpha: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><g fill='#808080' fill-opacity='${alpha}'><circle cx='4' cy='4' r='1'/><circle cx='0' cy='0' r='1'/><circle cx='8' cy='0' r='1'/><circle cx='0' cy='8' r='1'/><circle cx='8' cy='8' r='1'/></g></svg>`)}")`

/**
 * O papel: cor, fibra larga, pontinhos e o dente fino que pula oito vezes por
 * segundo (parado com movimento reduzido), mais as dobras de uma folha
 * dobrada em três na horizontal e ao meio na vertical. Fica em toda seção,
 * para a miniatura de cada uma já sair no papel.
 */
const fold = (dir: 'bottom' | 'right', at: number, hi: string, lo: string) =>
  `linear-gradient(to ${dir},transparent calc(${at}% - 1px),${hi} calc(${at}% - 1px),${hi} ${at}%,${lo} ${at}%,${lo} calc(${at}% + 1px),transparent calc(${at}% + 1px))`
const FOLDS_DARK = [
  fold('bottom', 30.5, 'rgba(255,255,255,.035)', 'rgba(0,0,0,.22)'),
  fold('bottom', 65, 'rgba(255,255,255,.03)', 'rgba(0,0,0,.2)'),
  fold('right', 55.5, 'rgba(255,255,255,.025)', 'rgba(0,0,0,.16)'),
  'linear-gradient(to bottom,rgba(255,255,255,.012) 0 30.5%,rgba(0,0,0,.03) 30.5% 65%,rgba(255,255,255,.01) 65%)',
  'linear-gradient(to right,rgba(0,0,0,.025) 0 55.5%,rgba(255,255,255,.012) 55.5%)',
].join(',')
const FOLDS_LIGHT = [
  fold('bottom', 30.5, 'rgba(255,255,255,.45)', 'rgba(0,0,0,.07)'),
  fold('bottom', 65, 'rgba(255,255,255,.4)', 'rgba(0,0,0,.06)'),
  fold('right', 55.5, 'rgba(255,255,255,.35)', 'rgba(0,0,0,.05)'),
  'linear-gradient(to bottom,rgba(255,255,255,.08) 0 30.5%,rgba(0,0,0,.025) 30.5% 65%,rgba(255,255,255,.05) 65%)',
  'linear-gradient(to right,rgba(0,0,0,.02) 0 55.5%,rgba(255,255,255,.06) 55.5%)',
].join(',')

const PAPER_CSS = [
  `:root{${vars(RO)};--ro-fiber:${noise(600, 0.015, 5, 0.018, 7)};--ro-tooth:${noise(160, 0.75, 2, 0.04, 3)};--ro-dots:${dots(0.04)};--ro-folds:${FOLDS_DARK};--ro-margin:${RO_MARGIN};--ro-headh:96px}`,
  `html[data-ro-theme=light]{${vars(RO_LIGHT)};--ro-fiber:${noise(600, 0.015, 5, 0.055, 7)};--ro-tooth:${noise(160, 0.75, 2, 0.14, 3)};--ro-dots:${dots(0.055)};--ro-folds:${FOLDS_LIGHT};color-scheme:light}`,
  '@media (max-width:767px){:root{--ro-headh:72px}}',
  'html{color-scheme:dark;background-color:var(--ro-paper)}',
  'body{background-color:var(--ro-paper)!important;background-image:var(--ro-dots),var(--ro-fiber)!important;isolation:isolate;transition:background-color .5s}',
  'body::before{content:"";position:fixed;inset:-160px;z-index:-1;pointer-events:none;background-image:var(--ro-tooth);animation:ro-grain .8s step-end infinite}',
  'body::after{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:var(--ro-folds)}',
  '@keyframes ro-grain{0%,100%{transform:none}12.5%{transform:translate(-64px,40px)}25%{transform:translate(32px,-104px)}37.5%{transform:translate(-112px,-24px)}50%{transform:translate(88px,72px)}62.5%{transform:translate(-20px,120px)}75%{transform:translate(108px,-60px)}87.5%{transform:translate(-90px,-132px)}}',
  '@media (prefers-reduced-motion:reduce){body::before{animation:none}}',
  `::selection{background:color-mix(in srgb,var(--ro-spot) 24%,transparent);color:var(--ro-ink)}`,
].join('')

const MOTION_OK = '@media (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference){'

const BASE_CSS = [
  PAPER_CSS,
  'selector{position:relative}',
  'selector,selector *{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
  'selector a{color:inherit;text-decoration:none}',
  'selector .elementor-heading-title{margin:0}',
  'selector .elementor-widget-image{line-height:0}selector .elementor-widget-image img{display:block}',
  // o motor e o Elementor animam o transform dos containers (0,4s): aqui quem move é o script
  'selector,selector .e-con{transition-property:background,border,box-shadow}',
  // a cor do texto acompanha o tema
  'selector .ro-ink .elementor-heading-title,selector .ro-ink .elementor-heading-title a{color:var(--ro-ink)!important}',
  'selector .ro-muted .elementor-heading-title{color:var(--ro-muted)!important}',
  // link que cobre a peça inteira
  'selector .ro-stretch,selector .ro-stretch>.elementor-widget-container{position:static}',
  'selector .ro-stretch a::after{content:"";position:absolute;inset:0;z-index:2;border-radius:inherit}',
  'selector a:focus-visible,selector [role=button]:focus-visible{outline:2px solid var(--ro-ink);outline-offset:3px;border-radius:4px}',
  'selector .ro-stretch a:focus-visible{outline:none}selector .ro-stretch a:focus-visible::after{outline:2px solid var(--ro-ink);outline-offset:2px}',
  // chip do original: caixinha de 4px, fundo 8%, maiúsculas, tinta a 60%
  'selector .ro-chip{flex:none;width:auto!important;padding:4px 8px!important;border-radius:4px;background:var(--ro-fill);white-space:nowrap}',
  'selector .ro-chip .elementor-heading-title{color:color-mix(in srgb,var(--ro-ink) 60%,transparent)!important;white-space:nowrap;font-variant-numeric:tabular-nums}',
  'selector .ro-chip.ro-pill{border-radius:999px}',
  // texto que rola no hover (o script quebra em letras; sem script fica parado)
  'selector .ro-roll{display:inline-block;clip-path:inset(-12% 0)}',
  `selector .ro-roll>span{display:inline-block;white-space:pre;text-shadow:0 var(--ro-roll,1.3em) currentColor;transition:translate .45s calc(var(--i,0) * 12.5ms) ${E}}`,
  // ícones em máscara
  'selector .ro-i{flex:none!important;padding:0!important;min-height:0;background-color:currentColor;-webkit-mask:var(--ro-mask) center/contain no-repeat;mask:var(--ro-mask) center/contain no-repeat}',
  '@media (prefers-reduced-motion:reduce){selector *{transition:none!important;animation:none!important}}',
  // o motor (e o Elementor) quebram a linha dos containers no celular
  '@media (max-width:767px){selector,selector>.e-con-inner,selector .e-con{flex-wrap:nowrap}}',
].join('')

const svg = (body: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>${body}</svg>`)}")`
const ICONS: Record<string, string> = {
  sun: svg("<circle cx='12' cy='12' r='4'/><path d='M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'/>"),
  moon: svg("<path d='M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'/>"),
  search: svg("<circle cx='11' cy='11' r='6.5'/><path d='M20 20l-4.2-4.2'/>"),
  arrow: svg("<path d='M7 17L17 7M9 7h8v8'/>"),
}
const iconCss = (names: string[]) => names.map((n) => `selector .ro-i-${n}{--ro-mask:${ICONS[n]}}`).join('')

/**
 * Peças que o script põe no `body` (fora de qualquer seção): o papel da
 * entrada com o contador e a busca do ⌘K. Ficam no CSS do cabeçalho.
 */
const FONT = `${RO_FONT},"Geist Variable",system-ui,sans-serif`
const MONO = `"${RO_MONO}",ui-monospace,monospace`
const GLOBAL_CSS = [
  // entrada: o papel, a assinatura embaixo à esquerda e o contador que sobe pela direita
  '.ro-veil{position:fixed;inset:0;z-index:1200;background-color:var(--ro-paper);background-image:var(--ro-dots),var(--ro-fiber);color:var(--ro-ink);animation:ro-veil-fail .5s ease-out 6s forwards}',
  '@keyframes ro-veil-fail{to{opacity:0;visibility:hidden}}',
  '.ro-veil.is-leaving{opacity:0;pointer-events:none;transition:opacity .7s ease-out .25s}',
  '.ro-veil.is-fast.is-leaving{transition:opacity .35s ease-out}',
  '.ro-veil.is-fast .ro-veil-word,.ro-veil.is-fast .ro-veil-count{display:none}',
  `.ro-veil-word{position:absolute;left:24px;bottom:24px;display:flex;align-items:baseline;gap:3px;font:500 22px/1 ${FONT};letter-spacing:-.06em}`,
  '.ro-veil-word i{display:block;width:6px;height:6px;background:currentColor}',
  `.ro-veil-count{position:absolute;right:24px;bottom:24px;display:flex;font:500 clamp(48px,calc(31px + 4.5vw),96px)/1 ${FONT};letter-spacing:-.042em;font-variant-numeric:tabular-nums;animation:ro-veil-up .9s ${E} .05s both}`,
  `.ro-veil.is-leaving .ro-veil-count{animation:ro-veil-down .5s cubic-bezier(.7,0,.84,0) both}`,
  '@keyframes ro-veil-up{from{transform:translateY(calc(100% + 24px))}}',
  '@keyframes ro-veil-down{to{transform:translateY(calc(100% + 24px))}}',
  '.ro-veil-d{display:block;width:.6em;height:1em;overflow:hidden;text-align:right;transition:opacity .2s}',
  '.ro-veil-d.is-off{opacity:0}',
  `.ro-veil-s{display:block;transition:transform .45s ${E}}`,
  '.ro-veil-s span{display:block;height:1em}',
  // busca ⌘K
  '.ro-cmd{position:fixed;inset:0;z-index:1100;visibility:hidden;opacity:0;transition:opacity .2s linear,visibility 0s linear .2s}',
  'html.ro-cmd-open .ro-cmd{visibility:visible;opacity:1;transition:opacity .2s linear}',
  '.ro-cmd-scrim{position:absolute;inset:0;background:rgba(0,0,0,.6)}',
  'html[data-ro-theme=light] .ro-cmd-scrim{background:rgba(30,30,30,.4)}',
  `.ro-cmd-panel{position:absolute;left:50%;top:min(18vh,160px);width:min(560px,calc(100vw - 32px));overflow:hidden;border:1px solid var(--ro-line);border-radius:12px;background-color:var(--ro-surface);background-image:var(--ro-dots);box-shadow:0 24px 70px -20px rgba(0,0,0,.7);color:var(--ro-ink);font-family:${FONT};transform:translateX(-50%) scale(.97);transition:transform .35s ${E}}`,
  'html.ro-cmd-open .ro-cmd-panel{transform:translateX(-50%)}',
  '.ro-cmd-search{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--ro-line)}',
  `.ro-cmd-ic{flex:none;width:16px;height:16px;background:var(--ro-muted);-webkit-mask:${ICONS.search} center/contain no-repeat;mask:${ICONS.search} center/contain no-repeat}`,
  `.ro-cmd .ro-cmd-input{flex:1;min-width:0;height:auto;padding:0!important;border:0!important;border-radius:0;outline:0;box-shadow:none!important;background:none!important;color:var(--ro-ink);font:400 16px/1.3 ${FONT};letter-spacing:-.02em}`,
  '.ro-cmd-input::placeholder{color:var(--ro-muted)}',
  `.ro-cmd kbd{flex:none;padding:4px 6px;border-radius:4px;background:var(--ro-fill);color:var(--ro-muted);font:600 10px/1 ${MONO}}`,
  '.ro-cmd-list{max-height:min(420px,60vh);overflow:auto;padding:6px 8px 10px;overscroll-behavior:contain}',
  `.ro-cmd-h{margin:10px 8px 6px;color:var(--ro-muted);font:400 12px/1.1 ${FONT};letter-spacing:-.02em;text-transform:uppercase}`,
  `.ro-cmd-item{display:flex;align-items:center;gap:10px;width:100%;padding:10px;border:0;border-radius:6px;background:none;color:var(--ro-ink);font:400 15px/1.2 ${FONT};letter-spacing:-.02em;text-align:left;cursor:pointer}`,
  '.ro-cmd-item.is-on{background:var(--ro-fill)}',
  `.ro-cmd-arrow{flex:none;width:14px;height:14px;background:currentColor;opacity:.45;-webkit-mask:${ICONS.arrow} center/contain no-repeat;mask:${ICONS.arrow} center/contain no-repeat}`,
  '.ro-cmd-item.is-on .ro-cmd-arrow{opacity:1}',
  `.ro-cmd-hint{margin-left:auto;padding-left:12px;color:var(--ro-muted);font:400 12px/1.2 ${MONO};white-space:nowrap}`,
  `.ro-cmd-empty{padding:18px 10px;color:var(--ro-muted);font:400 14px/1.3 ${FONT}}`,
].join('')

// ---------- construtor ----------

const createBuilder = (prefix: string) => {
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
  const box = (classes: string, elements: ElementorNode[] = [], settings: JsonRecord = {}) =>
    container({ css_classes: classes, flex_direction: 'row', flex_align_items: 'center', flex_justify_content: 'center', ...settings }, elements)
  const icon = (name: string, classes = '') => container({ css_classes: `ro-i ro-i-${name} ${classes}`.trim() })
  const heading = (title: string, spec: Spec, color: string, options: JsonRecord = {}) =>
    widget('heading', { title, header_size: 'p', title_color: color, ...type(spec), ...options })
  const image = (url: string, alt: string, options: JsonRecord = {}) =>
    widget('image', { image: media(url, alt), image_size: 'full', ...options })
  const chip = (label: string, classes = '') => box(`ro-chip ${classes}`.trim(), [heading(label, T.chip, RO.muted)], { flex_justify_content: 'flex-start' })

  const root = (elements: ElementorNode[], options: { classes: string; css: string; icons?: string[]; tag?: string; id?: string; settings?: JsonRecord }) => {
    const node = container({
      flex_direction: 'column',
      html_tag: options.tag ?? 'section',
      css_classes: options.classes,
      ...(options.id ? { _element_id: options.id } : {}),
      ...options.settings,
      custom_css: BASE_CSS + iconCss(options.icons ?? []) + options.css,
    }, elements)
    node.isInner = false
    return node
  }
  const behavior = (html: string) => widget('html', { html, _css_classes: 'ro-behavior' })
  return { uid, container, widget, col, row, box, icon, heading, image, chip, root, behavior }
}

// =====================================================================
// 1. Cabeçalho: faixa de leitura, assinatura, menu em pílula, ⌘K e o tema
// =====================================================================

export const buildHeader = () => {
  const b = createBuilder('roh')
  const hud = b.row(RO_HUD.map((h) => b.row([
    b.heading(h.key, T.hud, RO.hudKey, { _css_classes: 'ro-hud-k' }),
    b.heading(h.value, T.hud, RO.hudValue, { _css_classes: `ro-hud-v${'live' in h ? ` ro-hud-${h.live}` : ''}` }),
  ], 0, { css_classes: 'ro-hud-chip' })), 8, { css_classes: 'ro-hud', flex_wrap: 'wrap' })

  const logo = b.row([
    b.heading(RO_TEXT.wordmark, T.logo, RO.ink, { link: link('#cases', false), _css_classes: 'ro-ink ro-stretch ro-logo-word' }),
    b.box('ro-logo-pt'),
  ], 3, { css_classes: 'ro-logo', flex_align_items: 'baseline' })

  const nav = b.row(RO_NAV.map((n) => b.heading(n.label, T.nav, RO.ink, {
    link: link(n.url), _css_classes: 'ro-ink ro-nav-link',
  })), 2, { css_classes: 'ro-navpill' })
  const cmdk = b.box('ro-cmdk', [b.heading('⌘K', T.nav, RO.ink, { _css_classes: 'ro-ink ro-cmdk-label' })])

  const theme = b.row([
    b.box('ro-seg ro-seg-light', [b.icon('sun', 'ro-seg-ic')]),
    b.box('ro-seg ro-seg-dark', [b.icon('moon', 'ro-seg-ic')]),
  ], 0, { css_classes: 'ro-theme' })
  const right = b.row([
    b.box('ro-iconbtn ro-search', [b.icon('search', 'ro-iconbtn-ic')]),
    theme,
    b.box('ro-iconbtn ro-menu', [b.box('ro-menu-bars')]),
  ], 8, { css_classes: 'ro-right' })

  const drawer = b.col(RO_NAV.map((n) => b.heading(n.label, T.drawer, RO.ink, {
    link: link(n.url), _css_classes: 'ro-ink ro-drawer-link',
  })), 6, { css_classes: 'ro-drawer' })

  return b.root([
    b.behavior(`<script>${RO_MOTION_SCRIPT}</script>`),
    b.heading(RO_TEXT.h1, T.nav, RO.ink, { header_size: 'h1', _css_classes: 'ro-sr' }),
    hud,
    b.container({ css_classes: 'ro-bar', flex_direction: 'row', flex_align_items: 'center', flex_justify_content: 'space-between' }, [
      logo,
      b.row([nav, cmdk], 4, { css_classes: 'ro-center' }),
      right,
    ]),
    drawer,
  ], {
    tag: 'header', classes: 'ro-header', icons: ['sun', 'moon', 'search'],
    settings: { padding: sides(0, 30, 20, 30), flex_gap: gap(0) },
    css: [
      GLOBAL_CSS,
      // por cima do palco: o palco sobe por baixo (margem negativa no CSS dele)
      `selector{position:sticky!important;top:0;z-index:950;padding:0 var(--ro-margin) 20px!important;height:var(--ro-headh);transition:transform .45s ${E}!important}`,
      'selector .ro-behavior{position:absolute!important;width:0;height:0;overflow:hidden}',
      'selector .ro-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
      // faixa de leitura: chips presos no topo, cantos de baixo de 2px
      'selector .ro-hud{width:auto!important;margin-bottom:18px;align-self:flex-start;pointer-events:none}',
      'selector .ro-hud-chip{width:auto!important;flex:none;padding:2px 6px!important;border-radius:0 0 2px 2px;background:color-mix(in srgb,var(--ro-ink) 8%,var(--ro-paper))}',
      'selector .ro-hud-chip .elementor-heading-title{white-space:nowrap}',
      'selector .ro-hud-k .elementor-heading-title{color:var(--ro-hud-k)!important}',
      'selector .ro-hud-v .elementor-heading-title{color:var(--ro-hud-v)!important;font-variant-numeric:tabular-nums}',
      // a barra: três colunas, o menu no centro exato
      'selector .ro-bar{display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:clamp(16px,2vw,30px)!important;align-items:center}',
      'selector .ro-logo{position:relative;width:auto!important;justify-self:start;cursor:pointer}',
      `selector .ro-logo-pt{width:6px!important;height:6px;flex:none;background:var(--ro-ink);transition:background-color .25s ${E},transform .25s ${E}!important}`,
      'selector .ro-logo:hover .ro-logo-pt{background:var(--ro-spot);transform:rotate(45deg)}',
      'selector .ro-center{width:auto!important;justify-self:center}',
      'selector .ro-navpill,selector .ro-theme{height:40px;background:var(--ro-surface);border:1px solid var(--ro-line);border-radius:6px;box-shadow:0 2px 6px -2px rgba(0,0,0,.2)}',
      'html[data-ro-theme=light] selector .ro-navpill,html[data-ro-theme=light] selector .ro-theme{box-shadow:0 0 0 1px rgba(30,30,30,.06),0 2px 6px -2px rgba(30,30,30,.14)}',
      'selector .ro-navpill{position:relative;width:auto!important;padding:0 8px!important}',
      'selector .ro-nav-link{position:relative;z-index:1}',
      `selector .ro-nav-link a{display:block;padding:4px 10px;transition:opacity .3s ${E}}`,
      // a pílula que corre por baixo do link (o script põe e move)
      `selector .ro-pill{position:absolute;left:0;top:0;width:0;height:0;border-radius:4px;background:var(--ro-fill);box-shadow:0 0 0 1px rgba(247,247,247,.04),0 1px 3px rgba(0,0,0,.15);opacity:0;pointer-events:none;transition:transform .4s ${E},width .4s ${E},height .4s ${E},opacity .25s ease-out}`,
      `${MOTION_OK}selector .ro-navpill:has(.ro-nav-link:hover) .ro-nav-link:not(:hover) a{opacity:.4}selector .ro-nav-link a:hover .ro-roll>span,selector .ro-cmdk:hover .ro-roll>span{translate:0 calc(var(--ro-roll,1.3em) * -1)}}`,
      `selector .ro-cmdk{position:relative;isolation:isolate;width:auto!important;min-width:48px;height:40px;padding:0 10px!important;cursor:pointer;-webkit-user-select:none;user-select:none}`,
      `selector .ro-cmdk::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--ro-surface);border:1px solid var(--ro-line);border-radius:6px;box-shadow:0 2px 6px -2px rgba(0,0,0,.2);transition:scale .22s ease-out}`,
      `${MOTION_OK}selector .ro-cmdk:hover::before{scale:.97}}selector .ro-cmdk:active::before{scale:.95}`,
      // direita: tema (dois segmentos e o fundo que corre)
      'selector .ro-right{width:auto!important;justify-self:end}',
      'selector .ro-theme{position:relative;isolation:isolate;width:auto!important;padding:2px!important}',
      `selector .ro-theme::before{content:"";position:absolute;z-index:-1;top:2px;bottom:2px;left:2px;width:36px;border-radius:4px;background:var(--ro-fill);box-shadow:0 0 0 1px rgba(247,247,247,.04),0 1px 3px rgba(0,0,0,.15);transform:translateX(36px);transition:transform .45s ${E}}`,
      'html[data-ro-theme=light] selector .ro-theme::before{transform:none}',
      `selector .ro-seg{width:36px!important;height:100%;flex:none;cursor:pointer;color:var(--ro-muted);transition:color .3s ease-out,scale .2s ease-out!important}`,
      'selector .ro-seg:hover{color:var(--ro-ink)}selector .ro-seg:active{scale:.96}',
      'html:not([data-ro-theme=light]) selector .ro-seg-dark,html[data-ro-theme=light] selector .ro-seg-light{color:var(--ro-ink)}',
      'selector .ro-seg-ic{width:16px!important;height:16px}',
      `selector .ro-iconbtn{display:none;width:40px!important;height:40px;flex:none;cursor:pointer;color:var(--ro-ink);background:var(--ro-surface);border:1px solid var(--ro-line);border-radius:6px;transition:scale .2s ease-out!important}`,
      'selector .ro-iconbtn:active{scale:.96}',
      'selector .ro-iconbtn-ic{width:16px!important;height:16px}',
      'selector .ro-menu-bars{position:relative;width:16px!important;height:10px;flex:none}',
      `selector .ro-menu-bars::before,selector .ro-menu-bars::after{content:"";position:absolute;left:0;right:0;height:1.5px;border-radius:2px;background:currentColor;transition:transform .4s ${E}}`,
      'selector .ro-menu-bars::before{top:0}selector .ro-menu-bars::after{bottom:0}',
      'html.ro-drawer-open selector .ro-menu-bars::before{transform:translateY(4.25px) rotate(45deg)}html.ro-drawer-open selector .ro-menu-bars::after{transform:translateY(-4.25px) rotate(-45deg)}',
      // gaveta do celular: os links grandes
      `selector .ro-drawer{position:fixed!important;left:0;right:0;top:0;z-index:-1;padding:calc(var(--ro-headh) + 24px) var(--ro-margin) 32px!important;background:var(--ro-paper);background-image:var(--ro-dots),var(--ro-fiber);border-bottom:1px solid var(--ro-line);transform:translateY(-102%);visibility:hidden;transition:transform .55s ${E},visibility 0s linear .55s!important}`,
      `html.ro-drawer-open selector .ro-drawer{transform:none;visibility:visible;transition:transform .55s ${E},visibility 0s!important}`,
      'selector .ro-drawer-link{width:auto!important}',
      '@media (max-width:767px){selector{padding-top:16px!important;padding-bottom:16px!important}selector .ro-hud,selector .ro-center{display:none}selector .ro-bar{grid-template-columns:1fr auto}selector .ro-iconbtn{display:flex}}',
    ].join(''),
  })
}

// =====================================================================
// 2. Palco: as duas rodas e o case do meio
// =====================================================================

const pad = (n: number) => String(n).padStart(2, '0')

export const buildStage = () => {
  const b = createBuilder('ros')
  const total = RO_CASES.length
  const cases = RO_CASES.map((c, i) => b.container({ css_classes: `ro-case ro-case-${i + 1}`, flex_direction: 'column' }, [
    b.box('ro-card', [b.image(asset(c.cover), `Página inicial do site ${c.name}`, { _css_classes: 'ro-card-img' })]),
    b.box('ro-die', [b.heading(c.letter, T.die, RO.ink, { _css_classes: 'ro-die-letter' })]),
    b.col([
      b.box('ro-line ro-l-eyebrow', [b.heading(`Nº${pad(i + 1)} / ${pad(total)}`, T.eyebrow, RO.muted, { _css_classes: 'ro-muted ro-eyebrow' })]),
      b.box('ro-line ro-l-title', [b.heading(c.name, T.title, RO.ink, { header_size: 'h2', _css_classes: 'ro-ink ro-title' })]),
      b.box('ro-line ro-l-chips', [b.row([b.chip(c.segment), b.chip(c.stack, 'ro-pill')], 2, { css_classes: 'ro-chips' })]),
      b.box('ro-line ro-l-cta', [b.box('ro-btn', [b.heading(RO_TEXT.cta, T.tag, RO.paper, {
        link: link(c.url), _css_classes: 'ro-stretch ro-btn-label',
      })])]),
    ], 0, { css_classes: 'ro-info' }),
  ]))
  return b.root([
    b.container({ css_classes: 'ro-cases', flex_direction: 'column' }, cases),
  ], {
    classes: 'ro-stage', id: 'cases',
    css: [
      // a tela inteira, por baixo do cabeçalho
      // o motor do Space troca vh pela altura da tela do canvas; selector vira o caminho do elemento, então a
      // subida por baixo do cabeçalho usa as classes (no WordPress os dois containers são irmãos)
      'selector{height:100vh;min-height:560px;overflow:hidden;-webkit-user-select:none;user-select:none}',
      '.ro-header+.ro-stage{margin-top:calc(-1 * var(--ro-headh))!important}',
      'selector .ro-cases{position:absolute!important;inset:0}',
      'selector .ro-case{position:absolute!important;inset:0;pointer-events:none}',
      'selector .ro-case:not(.ro-case-1) .ro-info{visibility:hidden}',
      // o case do meio: coluna de 26rem centrada, linhas com recorte para o tambor
      'selector .ro-info{position:absolute!important;left:50%;top:53%;width:min(416px,33vw)!important;transform:translate(-50%,-50%);text-align:center;z-index:3;align-items:center}',
      'selector .ro-line{position:relative;width:100%!important;overflow:hidden;margin:-2px 0;padding:2px 0!important}',
      'selector .ro-l-title{margin-top:8px}selector .ro-l-chips{margin-top:12px}selector .ro-l-cta{margin-top:22px}',
      'selector .ro-eyebrow .elementor-heading-title{font-variant-numeric:tabular-nums;font-size:clamp(12px,calc(8px + .3vw),12.8px)}',
      'selector .ro-title .elementor-heading-title{font-size:clamp(22px,calc(14.4px + 1.7vw),38.4px);text-wrap:balance}',
      'selector .ro-chips{width:auto!important}',
      // botão "Ver projeto": fundo 8% que encolhe no hover, o texto rola
      `selector .ro-btn{position:relative;isolation:isolate;width:auto!important;padding:4px 8px!important;border-radius:4px;pointer-events:auto;transition:scale .2s ease-out!important}`,
      `selector .ro-btn::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:4px;background:var(--ro-fill);transition:scale .4s ${E}}`,
      'selector .ro-btn:active{scale:.96}',
      'selector .ro-btn-label .elementor-heading-title,selector .ro-btn-label a{color:var(--ro-ink)!important;white-space:nowrap}',
      `${MOTION_OK}selector .ro-btn:hover::before{scale:.95}selector .ro-btn:hover .ro-roll>span{translate:0 calc(var(--ro-roll,1.3em) * -1)}}`,
      // a capa como cartão impresso: cantos de 8px, contorno fino, inclinada
      'selector .ro-card{position:absolute!important;width:clamp(260px,30.3vw,640px)!important;aspect-ratio:1.75;border-radius:8px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 12px 30px -18px rgba(0,0,0,.55)}',
      'selector .ro-card-img,selector .ro-card-img .elementor-widget-container{width:100%;height:100%}',
      'selector .ro-card-img img{width:100%!important;height:100%!important;object-fit:cover;object-position:top}',
      'selector .ro-case-1 .ro-card{left:calc(20.4vw - clamp(130px,15.15vw,320px));top:53%;transform:translateY(-50%) perspective(1400px) rotateY(12deg) rotateX(-3deg)}',
      'selector .ro-case-2 .ro-card{left:calc(20.4vw - 33vh - clamp(130px,15.15vw,320px));top:96.4%;transform:translateY(-50%) rotate(-29.8deg);opacity:.8}',
      `selector .ro-case-${total} .ro-card{left:calc(20.4vw - 33vh - clamp(130px,15.15vw,320px));top:9.6%;transform:translateY(-50%) rotate(29.8deg);opacity:.8}`,
      `selector .ro-case:not(.ro-case-1):not(.ro-case-2):not(.ro-case-${total}) .ro-card{display:none}`,
      // o dado: quadrado escuro com a letra do case
      'selector .ro-die{position:absolute!important;width:clamp(96px,9.6vw,184px)!important;aspect-ratio:1;border-radius:14%;background:linear-gradient(145deg,#2a2a2a,#121212);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),inset 0 1px 0 rgba(255,255,255,.12),0 18px 30px -16px rgba(0,0,0,.7)}',
      'html[data-ro-theme=light] selector .ro-die{background:linear-gradient(145deg,#f4f3f1,#e2e1de);box-shadow:inset 0 0 0 1px rgba(0,0,0,.06),0 18px 30px -18px rgba(0,0,0,.35)}',
      'selector .ro-die-letter .elementor-heading-title{font-size:clamp(46px,4.8vw,90px);background:linear-gradient(135deg,#f2f2f2 10%,#8d8d8d 40%,#e7c8d8 58%,#9fd6d2 72%,#f7f7f7 90%);-webkit-background-clip:text;background-clip:text;color:transparent!important}',
      'selector .ro-case-1 .ro-die{left:calc(72.5vw - clamp(48px,4.8vw,92px));top:53%;transform:translateY(-50%) perspective(900px) rotateY(-14deg) rotateX(5deg)}',
      'selector .ro-case-2 .ro-die{left:calc(72.5vw + 36.2vh - clamp(48px,4.8vw,92px));top:91.9%;transform:translateY(-50%) rotate(-36deg)}',
      `selector .ro-case-${total} .ro-die{left:calc(72.5vw + 36.2vh - clamp(48px,4.8vw,92px));top:14.1%;transform:translateY(-50%) rotate(36deg)}`,
      `selector .ro-case:not(.ro-case-1):not(.ro-case-2):not(.ro-case-${total}) .ro-die{display:none}`,
      // com as rodas no ar, quem desenha capas e dados é o WebGL; o texto do meio é o do case ativo
      'html.ro-wheels selector .ro-card,html.ro-wheels selector .ro-die{visibility:hidden}',
      'html.ro-wheels selector .ro-case .ro-info{visibility:hidden}',
      'html.ro-wheels selector .ro-case.is-active .ro-info,html.ro-wheels selector .ro-case.is-leaving .ro-info{visibility:visible}',
      'selector .ro-w{display:inline-block;white-space:nowrap}selector .ro-ch{display:inline-block;white-space:pre;will-change:transform}',
      'selector .ro-live{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
      'selector:focus-visible{outline:2px solid var(--ro-ink);outline-offset:-6px}',
      'selector .ro-gl{position:absolute;inset:0;width:100%;height:100%;z-index:1;display:block;cursor:grab;touch-action:none}',
      'selector .ro-gl.is-grabbing{cursor:grabbing}',
      // celular: rodas em cima e embaixo, o texto um pouco abaixo do meio
      '@media (max-width:767px){',
      'selector .ro-info{top:calc(50% + 12svh);width:min(416px,86vw)!important}',
      'selector .ro-card{width:min(88vw,460px)!important}',
      'selector .ro-case-1 .ro-card{left:50%;top:calc(var(--ro-headh) + 40px);transform:translateX(-50%)}',
      'selector .ro-case-2 .ro-card{left:auto;right:-74vw;top:calc(var(--ro-headh) + 70px);transform:rotate(-14deg)}',
      `selector .ro-case-${total} .ro-card{left:-74vw;top:calc(var(--ro-headh) + 70px);transform:rotate(14deg)}`,
      'selector .ro-die{width:88px!important}selector .ro-die-letter .elementor-heading-title{font-size:44px}',
      'selector .ro-case-1 .ro-die{left:calc(50% - 44px);top:auto;bottom:-22px;transform:perspective(600px) rotateX(18deg)}',
      `selector .ro-case-2 .ro-die,selector .ro-case-${total} .ro-die{display:none}}`,
    ].join(''),
  })
}

// =====================================================================
// 3. Lista de cases: a vista sem WebGL (e para quem lê)
// =====================================================================

export const buildList = () => {
  const b = createBuilder('rol')
  const rows = RO_CASES.map((c) => b.row([
    b.heading(c.name, T.tag, RO.ink, { link: link(c.url), _css_classes: 'ro-ink ro-stretch ro-row-label' }),
    b.box('ro-row-line'),
    b.row([
      b.chip(c.segment, 'ro-row-tag'),
      b.chip(c.stack, 'ro-pill ro-row-tag'),
      b.box('ro-linkcircle', [b.icon('arrow', 'ro-linkcircle-ic')]),
    ], 2, { css_classes: 'ro-row-tags' }),
  ], 12, { css_classes: 'ro-row' }))
  return b.root([
    b.heading(RO_TEXT.list, T.h2, RO.ink, { header_size: 'h2', _css_classes: 'ro-ink ro-list-h' }),
    b.col(rows, 0, { css_classes: 'ro-rows' }),
  ], {
    classes: 'ro-list', icons: ['arrow'],
    settings: { padding: sides(144, 30, 96, 30) },
    css: [
      'selector{padding:clamp(144px,16svh,192px) var(--ro-margin) 96px!important}',
      'selector .ro-list-h .elementor-heading-title{font-size:clamp(30px,calc(23.7px + 1.69vw),48px)}',
      'selector .ro-rows{margin-top:32px}',
      `selector .ro-row{position:relative;padding:8px 0!important;transition:opacity .3s ease-out}`,
      'selector .ro-row-label{flex:0 0 auto!important;width:auto!important;max-width:60%;min-width:0}',
      'selector .ro-row-label .elementor-heading-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      'selector .ro-row-line{position:relative;flex:1 1 auto;min-width:16px;height:1px;background:color-mix(in srgb,var(--ro-ink) 14%,transparent)}',
      `selector .ro-row-line::after{content:"";position:absolute;inset:0;background:color-mix(in srgb,var(--ro-ink) 45%,transparent);transform:scaleX(0);transform-origin:left;transition:transform .5s ${E}}`,
      'selector .ro-row-tags{width:auto!important;flex:none}',
      'selector .ro-row-tag{position:relative;z-index:0;overflow:hidden}',
      `selector .ro-row-tag::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--ro-ink);transform:scaleX(0);transform-origin:left;transition:transform .45s ${E}}`,
      'selector .ro-row-tag .elementor-heading-title{transition:color .3s ease-out}',
      'selector .ro-linkcircle{width:20px!important;height:20px;flex:none;border-radius:999px;background:#484848;color:#f7f7f7;overflow:hidden;transition:width .4s ' + E + ',opacity .3s ease-out!important}',
      'selector .ro-linkcircle-ic{width:10px!important;height:10px}',
      `${MOTION_OK}`,
      'selector .ro-rows:has(.ro-row:hover) .ro-row:not(:hover){opacity:.4}',
      'selector .ro-row:hover .ro-row-line::after{transform:scaleX(1);transition-delay:60ms}',
      'selector .ro-row:hover .ro-row-tag::before{transform:scaleX(1)}',
      'selector .ro-row:hover .ro-row-tag .elementor-heading-title{color:var(--ro-paper)!important}',
      'selector .ro-row:hover .ro-row-tag:first-child,selector .ro-row:hover .ro-row-tag:first-child::before{transition-delay:.12s}',
      'selector .ro-row:hover .ro-row-tag:nth-child(2),selector .ro-row:hover .ro-row-tag:nth-child(2)::before{transition-delay:.18s}',
      'selector .ro-row .ro-linkcircle{width:0!important;opacity:0}',
      'selector .ro-row:hover .ro-linkcircle{width:20px!important;opacity:1;transition-delay:.16s}}',
      '@media (max-width:544px){selector .ro-row-line{display:none}selector .ro-row-tags{margin-left:auto}}',
      // com as rodas no ar a lista sai, como no original
      'html.ro-wheels selector{display:none!important}',
    ].join(''),
  })
}
