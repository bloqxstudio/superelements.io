import { px, sides, link } from '../elementor'
import { createModelBuilder, type ElementorNode, type Spec, type as typeSpec } from '../modelo/elementor'
import { SC_MOTION_SCRIPT } from './motion'
import { SC_BRAND, SC_CTA, SC_HERO, SC_BAR, SC_TABS, SC_AGENT, SC_BAND, SC_MODULES, SC_LIBRARY, SC_FAQ, SC_FINAL, SC_FOOTER } from './content'

/**
 * Página modelo no desenho da landing clinipago.com.br/lp/tp (Framer), em
 * árvore nativa do Elementor, com o conteúdo do Superelements. Medidas do
 * original: coluna de 1200px com 24px de cada lado, Inter variável (aqui
 * 400/500/600), títulos a −0,04em, cantos de 20/18/16/12px, lima #DDFF92 no
 * que se clica e o verde-quase-preto #122100 nos cartões escuros.
 *
 * Fotos: da biblioteca de seções do app (as do original são da Clínica
 * Experts). Movimento em `motion.ts`, um widget só de comportamento no
 * cabeçalho; o CSS sozinho já é a composição final.
 */

export const SC = {
  ink: '#1D1D1D',
  night: '#121417',
  green: '#122100',
  greenMid: '#446C08',
  lime: '#DDFF92',
  limeSoft: '#EEFFC5',
  limePale: '#F8FFE4',
  bg: '#F7F7F7',
  white: '#FFFFFF',
  body: '#464646',
  muted: '#A3A3A3',
  soft: '#6B6B6B',
  line: '#E1E0DE',
  onDark: '#E1E0DE',
  blue: '#2E6FD8',
  agent: '#D97757',
} as const

const FONT = 'Inter'
const E = 'cubic-bezier(.22,1,.36,1)'
const t = (s: Omit<Spec, 'family'>): Spec => ({ ...s, family: FONT })

const T = {
  h1: t({ size: 56, line: 63, weight: 500, letter: -2.24, tablet: { size: 46, line: 52 }, mobile: { size: 36, line: 40, letter: -1.44 } }),
  h2: t({ size: 40, line: 46, weight: 500, letter: -1.6, tablet: { size: 34, line: 40 }, mobile: { size: 28, line: 33, letter: -1.12 } }),
  h2big: t({ size: 48, line: 52, weight: 500, letter: -1.92, tablet: { size: 40, line: 46 }, mobile: { size: 30, line: 34, letter: -1.2 } }),
  h3: t({ size: 31, line: 35, weight: 500, letter: -1.24, mobile: { size: 24, line: 28, letter: -0.96 } }),
  lede: t({ size: 18, line: 26, weight: 400, mobile: { size: 16, line: 23 } }),
  body: t({ size: 15.5, line: 25, weight: 400, mobile: { size: 15, line: 23 } }),
  small: t({ size: 14.5, line: 20, weight: 400 }),
  note: t({ size: 13, line: 19, weight: 400 }),
  pill: t({ size: 14.5, line: 18, weight: 500 }),
  button: t({ size: 17, line: 20, weight: 600, letter: -0.17 }),
  tabName: t({ size: 15, line: 19, weight: 500 }),
  tabSub: t({ size: 12.5, line: 16, weight: 400 }),
  card: t({ size: 18, line: 23, weight: 500, letter: -0.36 }),
  cardText: t({ size: 14.5, line: 22, weight: 400 }),
  ui: t({ size: 13, line: 17, weight: 500 }),
  logo: { size: 22, line: 1, weight: 700, letter: -0.77, family: 'Space Grotesk' } as Spec,
  mark: { size: 190, line: 1, weight: 700, letter: -7, family: 'Space Grotesk', tablet: { size: 130 }, mobile: { size: 64, letter: -2.4 } } as Spec,
}

const BASE = [
  'selector{position:relative}',
  'selector,selector *{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
  `selector ::selection{background:${SC.lime};color:${SC.green}}`,
  'selector a{color:inherit;text-decoration:none}',
  'selector .elementor-heading-title{margin:0}selector .elementor-widget-text-editor p{margin:0}',
  'selector h1.elementor-heading-title,selector h2.elementor-heading-title,selector h3.elementor-heading-title{text-wrap:balance}',
  'selector .elementor-widget-image{line-height:0}selector .elementor-widget-image img{display:block}',
  'selector,selector .e-con{transition-property:background,border,box-shadow,color}',
  'selector .sc-stretch,selector .sc-stretch>.elementor-widget-container{position:static}selector .sc-stretch a::after{content:"";position:absolute;inset:0;z-index:2;border-radius:inherit}',
  `selector a:focus-visible,selector summary:focus-visible,selector [role=tab]:focus-visible,selector [role=button]:focus-visible{outline:2px solid ${SC.greenMid};outline-offset:3px;border-radius:8px}`,
  // botões: lima com texto verde-escuro (e o escuro do fim da página)
  `selector .sc-btn .elementor-button{display:inline-flex;align-items:center;justify-content:center;height:50px;padding:0 24px;border-radius:14px;white-space:nowrap;transition:background-color .2s ${E},transform .2s ${E},color .2s}`,
  'selector .sc-btn .elementor-button:hover{transform:translateY(-1px)}',
  // a pílula pequena dos rótulos de seção
  `selector .sc-pill{width:auto!important;flex:none!important;align-self:flex-start;padding:7px 12px!important;border-radius:8px;background:${SC.white}}`,
  // entrada: blocos que sobem 16px (o script arma; sem script ficam à vista)
  `html.sc-live selector .sc-rise{opacity:0;transform:translateY(16px);transition:opacity .7s ${E},transform .7s ${E}}html.sc-live selector .sc-rise.is-in{opacity:1;transform:none}`,
  '@media (prefers-reduced-motion:reduce){selector *{transition:none!important;animation:none!important}}',
  '@media (max-width:767px){selector,selector>.e-con-inner,selector .e-con{flex-wrap:nowrap}}',
].join('')

const builder = (prefix: string) => createModelBuilder(prefix, BASE)
type B = ReturnType<typeof builder>

const pill = (b: B, text: string, dark = false) => b.heading(text, T.pill, dark ? SC.white : SC.ink, { _css_classes: `sc-pill${dark ? ' sc-pill-dark' : ''}` })
const btn = (b: B, text: string, url: string, tone: 'lime' | 'dark' = 'lime', classes = '') => b.widget('button', {
  text, link: link(url), size: 'md',
  ...typeSpec(T.button),
  background_color: tone === 'lime' ? SC.lime : SC.green,
  button_text_color: tone === 'lime' ? SC.green : SC.white,
  button_background_hover_color: tone === 'lime' ? SC.limeSoft : '#24400A',
  hover_color: tone === 'lime' ? SC.green : SC.white,
  border_radius: sides(14), text_padding: sides(0, 24),
  _css_classes: `sc-btn sc-btn-${tone} ${classes}`.trim(),
})
/** Título de duas linhas: a primeira escura, a segunda cinza (ou ao contrário). */
const twoTone = (lines: string[], dimFirst = false) => lines.map((line, i) => ((i === 0) === dimFirst ? `<span class="sc-dim">${line}</span>` : line)).join('<br>')
const mark = (b: B, classes: string) => b.box(`sc-mark ${classes}`, [b.icon('se', 'sc-mark-se')])

const MARK_CSS = `selector .sc-mark{flex:none!important;background:${SC.lime}}selector .sc-mark-se{width:100%!important;height:100%;--sx-ic:${SC.green}}`

// =====================================================================
// 1. Cabeçalho sobre o hero (claro depois dele) e a barra fixa embaixo
// =====================================================================

export const buildHeader = () => {
  const b = builder('sch')
  const bar = b.row([
    mark(b, 'sc-bar-mark'),
    b.col([
      b.heading(SC_BAR.title, t({ size: 14, line: 18, weight: 600 }), SC.white, { _css_classes: 'sc-bar-t' }),
      b.heading(SC_BAR.sub, t({ size: 12.5, line: 16 }), SC.muted, { _css_classes: 'sc-bar-s' }),
    ], 2, { css_classes: 'sc-bar-copy' }),
    btn(b, SC_BAR.cta, SC_CTA.url, 'lime', 'sc-bar-btn'),
  ], 14, { css_classes: 'sc-bar' })
  return b.root([
    b.behavior(`<script>${SC_MOTION_SCRIPT}</script>`),
    b.row([
      mark(b, 'sc-logo-mark'),
      b.heading(SC_BRAND.word, T.logo, SC.white, { link: link('/'), _css_classes: 'sc-logo-word' }),
      b.box('sc-sep'),
      b.heading(SC_BRAND.by, t({ size: 12.5, line: 16, weight: 500 }), SC.white, { _css_classes: 'sc-by' }),
    ], 12, { css_classes: 'sc-brand' }),
    bar,
  ], {
    tag: 'header', classes: 'sc-head', background: 'rgba(18, 20, 23, 0)',
    settings: { flex_direction: 'row', flex_align_items: 'center', padding: sides(0, 24) },
    css: [
      // fica preso no topo e passa por cima do hero; depois do hero, vidro claro com filete
      `selector{position:sticky!important;top:0;z-index:100;height:72px;margin-bottom:-72px;transition:background-color .35s ${E},box-shadow .35s ${E}!important}`,
      // o vidro fica numa camada própria: backdrop-filter no cabeçalho prenderia a barra fixa dentro dele
      `selector::before{content:"";position:absolute;inset:0;z-index:-1;background:rgba(247,247,247,.86);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 1px 0 rgba(0,0,0,.06);opacity:0;transition:opacity .35s ${E};pointer-events:none}`,
      'html.sc-solid selector::before{opacity:1}',
      'selector>.e-con-inner{flex-direction:row!important;align-items:center}',
      'selector .sc-behavior{position:absolute!important;width:0;height:0;overflow:hidden}',
      'selector .sc-brand{width:auto!important;flex:none!important}',
      MARK_CSS,
      'selector .sc-logo-mark{width:36px!important;height:36px;border-radius:10px}',
      'selector .sc-logo-word .elementor-heading-title,selector .sc-by .elementor-heading-title{transition:color .35s}',
      `html.sc-solid selector .sc-logo-word .elementor-heading-title,html.sc-solid selector .sc-by .elementor-heading-title{color:${SC.ink}}`,
      'selector .sc-sep{width:1px!important;height:34px;flex:none!important;margin:0 8px;background:rgba(255,255,255,.25)}html.sc-solid selector .sc-sep{background:rgba(0,0,0,.14)}',
      'selector .sc-by .elementor-heading-title{opacity:.8}',
      // barra fixa: só com o script, depois do hero
      `selector .sc-bar{display:none!important;position:fixed!important;left:50%;bottom:24px;z-index:99;width:690px!important;max-width:calc(100vw - 24px);padding:10px 8px 10px 10px!important;border-radius:16px;background:linear-gradient(90deg,#1D1D1D,${SC.green});box-shadow:0 12px 32px rgba(0,0,0,.28);transform:translate(-50%,140%);transition:transform .55s ${E}!important}`,
      'html.sc-live selector .sc-bar{display:flex!important}html.sc-bar-on selector .sc-bar{transform:translate(-50%,0)}',
      'selector .sc-bar-mark{width:40px!important;height:40px;border-radius:10px}',
      'selector .sc-bar-copy{flex:1 1 auto!important;min-width:0}',
      'selector .sc-bar-btn .elementor-button{height:44px;border-radius:12px;font-size:16px}',
      '@media (max-width:767px){selector .sc-by,selector .sc-sep{display:none}',
      'selector .sc-bar{flex-direction:column!important;align-items:stretch!important;gap:8px!important;padding:10px!important;bottom:12px}selector .sc-bar-mark,selector .sc-bar-s{display:none}',
      'selector .sc-bar-t{text-align:center}selector .sc-bar-t .elementor-heading-title{font-size:12.5px}selector .sc-bar-btn,selector .sc-bar-btn .elementor-button{width:100%}}',
    ].join(''),
  })
}

// =====================================================================
// 2. Abertura escura com foto, o card que flutua e a faixa de provas
// =====================================================================

export const buildHero = () => {
  const b = builder('sca')
  const c = SC_HERO.card
  const float = b.col([
    b.row([
      b.box('sc-f-tile', [b.icon('upload', 'sc-f-ic'), b.box('sc-f-badge', [b.icon('check', 'sc-f-badge-ic')])]),
      b.col([
        b.heading(c.title, t({ size: 13.5, line: 18, weight: 500 }), SC.ink, { _css_classes: 'sc-f-title' }),
        b.heading(c.sub, t({ size: 12.5, line: 16 }), SC.soft),
      ], 2, { css_classes: 'sc-f-copy' }),
      b.heading(c.when, t({ size: 12, line: 16 }), SC.muted, { _css_classes: 'sc-f-when' }),
    ], 12, { flex_align_items: 'flex-start' }),
    b.box('sc-f-line'),
    b.row([
      b.heading(c.value, t({ size: 16, line: 20, weight: 600 }), SC.ink),
      b.row([b.icon('check', 'sc-f-ok-ic'), b.heading(c.status, t({ size: 12, line: 14, weight: 500 }), SC.green)], 5, { css_classes: 'sc-f-ok' }),
    ], 10, { flex_justify_content: 'space-between' }),
  ], 0, { css_classes: 'sc-float' })

  return b.root([
    b.container({ css_classes: 'sc-hero-photo' }, [b.image(asset(SC_HERO.photo), 'Pessoa trabalhando com amostras de material num estúdio', { _css_classes: 'sc-hero-img' })]),
    b.container({ css_classes: 'sc-hero-shade' }),
    b.col([
      b.col([
        b.row([b.box('sc-dot'), b.heading(SC_HERO.pill, T.pill, SC.ink)], 8, { css_classes: 'sc-pill sc-hero-pill sc-in sc-in-1' }),
        b.heading(twoTone(SC_HERO.title, true), T.h1, SC.white, { header_size: 'h1', _css_classes: 'sc-h1 sc-words' }),
        b.text(SC_HERO.lede.join('<br>'), T.lede, SC.onDark, { _css_classes: 'sc-hero-lede sc-in sc-in-2' }),
        btn(b, SC_CTA.text, SC_CTA.url, 'lime', 'sc-hero-cta sc-in sc-in-3'),
        b.text(SC_HERO.note.join('<br>'), T.note, SC.muted, { _css_classes: 'sc-hero-note sc-in sc-in-3' }),
      ], 0, { css_classes: 'sc-hero-copy' }),
      b.row(SC_HERO.features.map(([icon, label]) => b.row([b.icon(icon, 'sc-hf-ic'), b.heading(label, T.small, SC.onDark)], 10, { css_classes: 'sc-hf' })), 40, { css_classes: 'sc-hero-feats sc-in sc-in-4' }),
    ], 0, { css_classes: 'sc-hero-in' }),
    float,
  ], {
    classes: 'sc-hero', background: SC.night,
    settings: { padding: sides(0, 24) },
    css: [
      'selector{min-height:804px;overflow:hidden;isolation:isolate}',
      'selector>.e-con-inner{position:static}',
      'selector .sc-hero-photo{position:absolute!important;inset:0;z-index:-2}selector .sc-hero-img,selector .sc-hero-img .elementor-widget-container{width:100%;height:100%}',
      'selector .sc-hero-img img{width:100%;height:100%;object-fit:cover;object-position:78% 35%}',
      `selector .sc-hero-shade{position:absolute!important;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(18,20,23,.97) 0%,rgba(18,20,23,.9) 34%,rgba(18,20,23,.45) 62%,rgba(18,20,23,.18) 100%),linear-gradient(0deg,rgba(18,20,23,.85),rgba(18,20,23,0) 32%)}`,
      'selector .sc-hero-in{min-height:804px;padding:179px 0 0!important}',
      'selector .sc-hero-copy{max-width:640px;align-items:flex-start}',
      `selector .sc-hero-pill{gap:8px!important}selector .sc-dot{width:8px!important;height:8px;flex:none!important;border-radius:50%;background:${SC.greenMid};box-shadow:0 0 0 3px ${SC.limeSoft}}`,
      'selector .sc-h1{margin-top:24px}selector .sc-dim{color:#9C9C9C}',
      'selector .sc-hero-lede{margin-top:26px}selector .sc-hero-cta{margin-top:32px}selector .sc-hero-note{margin-top:22px}',
      `selector .sc-hero-feats{margin-top:auto;padding:30px 0 34px!important;border-top:1px solid rgba(255,255,255,.16);flex-wrap:wrap!important;gap:16px 40px!important}`,
      'selector .sc-hf{width:auto!important;flex:none!important}',
      `selector .sc-hf-ic{width:18px!important;height:18px;--sx-ic:${SC.lime}}`,
      // card que flutua sobre a foto (o original fica à direita, sobre o tablet)
      `selector .sc-float{position:absolute!important;top:303px;right:max(24px,calc((100vw - 1200px) / 2 - 62px));width:295px!important;padding:14px 16px 14px!important;border-radius:16px;background:${SC.white};box-shadow:0 24px 48px rgba(0,0,0,.28)}`,
      `selector .sc-f-tile{position:relative;width:40px!important;height:40px;flex:none!important;border-radius:10px;background:${SC.limeSoft}}selector .sc-f-ic{width:20px!important;height:20px;--sx-ic:${SC.green}}`,
      `selector .sc-f-badge{position:absolute!important;right:-4px;bottom:-4px;width:16px!important;height:16px;border-radius:50%;background:${SC.green};border:2px solid #fff;box-sizing:content-box}selector .sc-f-badge-ic{width:10px!important;height:10px;--sx-ic:#fff}`,
      'selector .sc-f-copy{flex:1 1 auto!important;min-width:0}selector .sc-f-when{flex:none}',
      'selector .sc-f-line{height:1px;margin:12px 0!important;background:#EEEEEE}',
      `selector .sc-f-ok{width:auto!important;flex:none!important;padding:4px 8px!important;border-radius:6px;background:${SC.limeSoft}}selector .sc-f-ok-ic{width:12px!important;height:12px;--sx-ic:${SC.green}}`,
      // entrada (o script arma sc-live): palavras do título acendem uma a uma, foto acende, card sobe
      `html.sc-live selector .sc-in{opacity:0;transform:translateY(16px)}html.sc-live selector.is-play .sc-in{opacity:1;transform:none;transition:opacity .8s ${E},transform .8s ${E}}`,
      'html.sc-live selector.is-play .sc-in-1{transition-delay:.05s}html.sc-live selector.is-play .sc-in-2{transition-delay:.75s}html.sc-live selector.is-play .sc-in-3{transition-delay:.9s}html.sc-live selector.is-play .sc-in-4{transition-delay:1.1s}',
      `html.sc-live selector .sc-w{opacity:.15;transition:opacity .6s ${E}}html.sc-live selector .sc-w.is-on{opacity:1}`,
      `html.sc-live selector .sc-hero-photo{opacity:0;transition:opacity 1.2s ${E} .5s}html.sc-live selector.is-play .sc-hero-photo{opacity:1}`,
      `html.sc-live selector .sc-float{opacity:.001;transform:translate(-12px,30px) scale(.88);transform-origin:30% 120%}html.sc-live selector.is-play .sc-float{opacity:1;transform:none;transition:opacity .7s ${E} 1.3s,transform .9s ${E} 1.3s}`,
      '@media (max-width:1024px){selector .sc-float{display:none}}',
      '@media (max-width:767px){selector{min-height:0}',
      'selector .sc-hero-photo{bottom:auto;height:420px}selector .sc-hero-img img{object-position:60% 30%}',
      'selector .sc-hero-shade{background:linear-gradient(0deg,rgba(18,20,23,1) 0%,rgba(18,20,23,1) calc(100% - 420px),rgba(18,20,23,.5) calc(100% - 200px),rgba(18,20,23,.15) 100%)}',
      'selector .sc-hero-in{min-height:0;padding:250px 0 0!important}',
      'selector .sc-hero-pill .elementor-heading-title{font-size:12px}selector .sc-hero-cta,selector .sc-hero-cta .elementor-button{width:100%}',
      'selector .sc-hero-note{text-align:center;align-self:center}selector .sc-hero-feats{margin-top:32px;flex-wrap:nowrap!important;gap:8px!important;justify-content:space-between}',
      'selector .sc-hf{flex-direction:column!important;flex:1 1 0!important;text-align:center;gap:8px!important}selector .sc-hf .elementor-heading-title{font-size:11.5px;line-height:15px}}',
    ].join(''),
  })
}

// =====================================================================
// 3. Tudo num espaço só: título, o cartão escuro, as abas e as etapas
// =====================================================================

export const buildTabs = () => {
  const b = builder('scb')
  const S = SC_TABS
  const promo = b.row([
    b.col([
      b.row([b.box('sc-dot'), b.heading(S.promo.pill, t({ size: 12.5, line: 16, weight: 500 }), SC.green)], 6, { css_classes: 'sc-promo-pill' }),
      b.heading(S.promo.title.join('<br>'), t({ size: 27, line: 32, weight: 500, letter: -0.8, mobile: { size: 22, line: 27 } }), SC.white, { header_size: 'h3', _css_classes: 'sc-promo-h' }),
      b.text(S.promo.text, t({ size: 15, line: 23, mobile: { size: 14.5, line: 22 } }), '#C8D2BC', { _css_classes: 'sc-promo-t' }),
    ], 0, { css_classes: 'sc-promo-copy' }),
    btn(b, S.promo.cta, S.promo.url, 'lime', 'sc-promo-btn'),
  ], 32, { css_classes: 'sc-promo sc-rise' })

  const tabList = b.col(S.tabs.map((tab, i) => b.row([
    b.box('sc-tab-ic', [b.icon(tab.icon, 'sc-tab-glyph')]),
    b.col([
      b.heading(tab.name, T.tabName, SC.ink, { _css_classes: 'sc-tab-name' }),
      b.heading(tab.sub, T.tabSub, SC.muted, { _css_classes: 'sc-tab-sub' }),
    ], 2, { css_classes: 'sc-tab-copy' }),
    ...(tab.badge ? [b.heading(tab.badge, t({ size: 10, line: 12, weight: 700, letter: 0.3 }), SC.lime, { _css_classes: 'sc-badge' })] : []),
  ], 12, { css_classes: `sc-tab${i === 0 ? ' is-on' : ''}` })), 4, { css_classes: 'sc-tabs' })

  const panels = b.container({ css_classes: 'sc-panels' }, S.tabs.map((tab, i) => b.col([
    b.heading(`${String(i + 1).padStart(2, '0')} / ${String(S.tabs.length).padStart(2, '0')}`, t({ size: 13, line: 16 }), SC.muted, { _css_classes: 'sc-count' }),
    b.heading(tab.title, T.h3, SC.ink, { header_size: 'h3', _css_classes: 'sc-panel-h' }),
    b.text(tab.text, T.body, SC.soft, { _css_classes: 'sc-panel-t' }),
    b.heading(tab.pill, t({ size: 14, line: 18, weight: 500 }), SC.green, { _css_classes: 'sc-panel-pill' }),
  ], 0, { css_classes: `sc-panel${i === 0 ? ' is-on' : ''}` })))

  const visual = b.container({ css_classes: 'sc-visual' }, [
    b.col([
      b.col([
        b.row([mark(b, 'sc-v-mark'), b.heading('superelements', t({ size: 15, line: 18, weight: 600 }), SC.white, { _css_classes: 'sc-v-word' }), b.icon('eye', 'sc-v-eye')], 8, { css_classes: 'sc-v-top' }),
        b.heading('Projeto · Caramelo Pet', t({ size: 12, line: 16, weight: 500 }), '#C8D2BC', { _css_classes: 'sc-v-cap' }),
        b.heading('Home · 11 seções', t({ size: 26, line: 30, weight: 600, letter: -0.6 }), SC.white, { _css_classes: 'sc-v-big' }),
      ], 0, { css_classes: 'sc-v-head' }),
      b.row([
        b.col([b.box('sc-v-ic', [b.icon('link', 'sc-v-glyph')]), b.heading('Aprovar', t({ size: 12, line: 15, weight: 500 }), SC.ink)], 6, { css_classes: 'sc-v-tile' }),
        b.col([b.box('sc-v-ic', [b.icon('upload', 'sc-v-glyph')]), b.heading('Publicar', t({ size: 12, line: 15, weight: 500 }), SC.ink)], 6, { css_classes: 'sc-v-tile' }),
        b.col([b.box('sc-v-ic', [b.icon('phone', 'sc-v-glyph')]), b.heading('Celular', t({ size: 12, line: 15, weight: 500 }), SC.ink)], 6, { css_classes: 'sc-v-tile sc-v-faint' }),
      ], 8, { css_classes: 'sc-v-tiles' }),
    ], 0, { css_classes: 'sc-v-card' }),
  ])

  const steps = b.row(S.steps.map(([icon, label], i) => b.col([
    b.box('sc-step-node', [b.icon(icon, 'sc-step-ic'), b.box('sc-step-ok', [b.icon('check', 'sc-step-ok-ic')])]),
    b.heading(label, t({ size: 15, line: 19 }), SC.ink, { _css_classes: 'sc-step-t', align: 'center' }),
    ...(i < S.steps.length - 1 ? [b.box('sc-step-line', [b.box('sc-step-fill')])] : []),
  ], 14, { css_classes: `sc-step${i === 0 ? ' is-done' : ''}`, flex_align_items: 'center' })), 0, { css_classes: 'sc-steps sc-rise' })

  return b.root([
    b.col([
      pill(b, S.pill),
      b.heading(twoTone(S.title), T.h2big, SC.ink, { header_size: 'h2', align: 'center', _css_classes: 'sc-tabs-h' }),
      b.text(S.lede, T.body, SC.soft, { align: 'center', _css_classes: 'sc-tabs-lede' }),
    ], 0, { css_classes: 'sc-tabs-head sc-rise', flex_align_items: 'center' }),
    promo,
    b.row([tabList, panels, visual], 0, { css_classes: 'sc-tabbox sc-rise', flex_align_items: 'stretch' }),
    steps,
  ], {
    classes: 'sc-tabs-sec', background: SC.bg, id: 'produto',
    settings: { padding: sides(120, 24, 120, 24) },
    css: [
      MARK_CSS,
      'selector .sc-tabs-head .sc-pill{align-self:center}',
      'selector .sc-tabs-h{margin-top:22px}selector .sc-dim{color:#A8A8A8}',
      'selector .sc-tabs-lede{margin-top:16px;max-width:520px}',
      // cartão escuro (no original, a condição de lançamento)
      `selector .sc-promo{margin-top:56px;padding:34px 48px!important;border-radius:20px;background:radial-gradient(120% 140% at 100% 100%,#55704A 0%,rgba(85,112,74,0) 45%),linear-gradient(90deg,${SC.green},#1B2A0C);justify-content:space-between!important}`,
      'selector .sc-promo-copy{flex:1 1 auto!important;max-width:640px}',
      `selector .sc-promo-pill{width:auto!important;align-self:flex-start;padding:5px 10px!important;border-radius:999px;background:${SC.limeSoft};white-space:nowrap}selector .sc-promo-pill .elementor-heading-title{white-space:nowrap}selector .sc-promo-pill>.elementor-widget{flex:none}`,
      `selector .sc-dot{width:8px!important;height:8px;flex:none!important;border-radius:50%;background:${SC.greenMid};box-shadow:0 0 0 3px ${SC.lime}}`,
      'selector .sc-promo-h{margin-top:16px}selector .sc-promo-t{margin-top:12px}selector .sc-promo-btn{flex:none}',
      // abas: lista à esquerda, texto no meio, a tela à direita
      `selector .sc-tabbox{margin-top:16px;border-radius:20px;background:${SC.white};min-height:446px}`,
      `selector .sc-tabs{width:320px!important;flex:none!important;padding:16px!important;border-right:1px solid #EDEDED}`,
      'selector .sc-tab{position:relative;padding:14px 16px!important;border-radius:12px;cursor:pointer;transition:background-color .3s,box-shadow .3s!important}',
      `selector .sc-tab:hover{background:${SC.bg}}`,
      `selector .sc-tab-ic{width:36px!important;height:36px;flex:none!important;border-radius:10px;background:${SC.limePale}}selector .sc-tab-glyph{width:17px!important;height:17px;--sx-ic:${SC.green}}`,
      'selector .sc-tab-copy{flex:1 1 auto!important}',
      `selector .sc-badge{flex:none;align-self:flex-end}selector .sc-badge .elementor-heading-title{padding:3px 6px;border-radius:5px;background:${SC.green}}`,
      `selector .sc-tab.is-on{background:${SC.green};box-shadow:0 10px 20px rgba(18,33,0,.22)}selector .sc-tab.is-on .sc-tab-name .elementor-heading-title{color:#fff}selector .sc-tab.is-on .sc-tab-sub .elementor-heading-title{color:#B9C4AA}selector .sc-tab.is-on .sc-tab-ic{background:rgba(255,255,255,.1)}selector .sc-tab.is-on .sc-tab-glyph{--sx-ic:${SC.lime}}`,
      `selector .sc-tab.is-on::before{content:"";position:absolute;left:-16px;top:12px;bottom:12px;width:3px;border-radius:0 3px 3px 0;background:${SC.lime}}`,
      'selector .sc-panels{position:relative;flex:1 1 auto!important;padding:0 44px!important;justify-content:center}',
      // sem script, a primeira aba fica à vista; com ele, a ativa entra subindo
      'selector .sc-panel{display:none!important}selector .sc-panel.is-on{display:flex!important}',
      `html.sc-live selector .sc-panel.is-on{animation:sc-panel .5s ${E} both}@keyframes sc-panel{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`,
      'selector .sc-panel-h{margin-top:12px}selector .sc-panel-t{margin-top:16px;max-width:300px}',
      `selector .sc-panel-pill{margin-top:22px;align-self:flex-start}selector .sc-panel-pill .elementor-heading-title{display:inline-block;padding:7px 12px;border-radius:8px;background:${SC.limeSoft}}`,
      `selector .sc-visual{width:380px!important;flex:none!important;margin:52px 32px 52px 0;border-radius:18px;background:radial-gradient(70% 60% at 85% 95%,${SC.limeSoft},rgba(238,255,197,0) 70%),${SC.bg};align-items:center;justify-content:center}`,
      `selector .sc-v-card{width:296px!important;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 18px 40px rgba(0,0,0,.12)}`,
      `selector .sc-v-head{padding:16px 18px 18px!important;background:linear-gradient(180deg,${SC.green},#1D3200)}`,
      'selector .sc-v-mark{width:24px!important;height:24px;border-radius:7px}selector .sc-v-word{flex:1 1 auto}selector .sc-v-eye{width:18px!important;height:18px;--sx-ic:#C8D2BC}',
      'selector .sc-v-cap{margin-top:16px}selector .sc-v-big{margin-top:4px}',
      'selector .sc-v-tiles{padding:14px!important}',
      `selector .sc-v-tile{width:80px!important;flex:none!important;padding:10px!important;border-radius:10px;background:${SC.bg};align-items:flex-start}selector .sc-v-faint{opacity:.4}`,
      `selector .sc-v-ic{width:24px!important;height:24px;flex:none!important;border-radius:50%;background:${SC.limeSoft}}selector .sc-v-glyph{width:13px!important;height:13px;--sx-ic:${SC.green}}`,
      // etapas: os nós se ligam por uma linha que enche (o script anda sozinho)
      'selector .sc-steps{margin-top:44px;justify-content:center!important;align-items:flex-start!important}',
      'selector .sc-step{position:relative;width:253px!important;flex:none!important}',
      'selector .sc-step-node{position:relative;width:44px!important;height:44px;flex:none!important;border:1px solid #E3E3E3;border-radius:12px;background:#fff}',
      `selector .sc-step-ic{width:17px!important;height:17px;--sx-ic:${SC.ink}}`,
      `selector .sc-step-ok{position:absolute!important;top:-9px;right:-9px;width:20px!important;height:20px;border-radius:50%;background:${SC.green};border:2px solid ${SC.bg};opacity:0;transform:scale(.4);transition:opacity .3s,transform .4s ${E}!important}selector .sc-step-ok-ic{width:11px!important;height:11px;--sx-ic:${SC.lime}}`,
      'selector .sc-step.is-done .sc-step-ok{opacity:1;transform:none}',
      'selector .sc-step-line{position:absolute!important;top:22px;left:calc(50% + 30px);width:calc(100% - 60px)!important;height:2px;background:#E3E3E3;justify-content:flex-start!important;overflow:hidden}',
      `selector .sc-step-fill{width:0!important;height:100%;background:${SC.green}}selector .sc-step.is-fill .sc-step-fill{width:100%!important;transition:width var(--sc-step,2.4s) linear!important}`,
      '@media (max-width:1024px){selector .sc-visual{display:none}selector .sc-panels{padding:32px!important}}',
      '@media (max-width:767px){selector{padding-top:72px!important;padding-bottom:72px!important}selector .sc-promo{flex-direction:column!important;align-items:stretch!important;padding:28px 24px!important;gap:24px!important}selector .sc-promo-btn .elementor-button{width:100%}',
      // celular: as abas viram pílulas que rolam de lado
      'selector .sc-tabbox{flex-direction:column!important;min-height:0}selector .sc-tabs{width:auto!important;flex-direction:row!important;overflow-x:auto;scrollbar-width:none;border-right:0;border-bottom:1px solid #EDEDED;padding:12px!important;gap:6px!important}selector .sc-tabs::-webkit-scrollbar{display:none}',
      'selector .sc-tab{flex:none!important;width:auto!important;padding:8px 14px 8px 10px!important;gap:8px!important}selector .sc-tab-sub,selector .sc-badge{display:none}selector .sc-tab-ic{width:26px!important;height:26px;border-radius:8px}selector .sc-tab.is-on::before{display:none}',
      'selector .sc-panels{padding:24px!important}selector .sc-steps{gap:0!important}selector .sc-step{width:33.33%!important}selector .sc-step-t .elementor-heading-title{font-size:12px;line-height:15px}selector .sc-step-line{left:calc(50% + 28px);width:calc(100% - 56px)!important}}',
    ].join(''),
  })
}

// =====================================================================
// 4. O agente em etapas: texto à esquerda, a régua que se marca ao rolar
// =====================================================================

export const buildAgent = () => {
  const b = builder('scc')
  const A = SC_AGENT
  const steps = A.steps.map((s, i) => b.row([
    b.box(`sc-node${i === A.steps.length - 1 ? ' sc-node-last' : ''}`, [b.icon(i === A.steps.length - 1 ? 'clock' : 'check', 'sc-node-ic')]),
    b.col([
      b.heading(s.tag, t({ size: 12.5, line: 16, weight: 500 }), i === A.steps.length - 1 ? SC.blue : SC.greenMid, { _css_classes: 'sc-st-tag' }),
      b.heading(s.title, t({ size: 15, line: 20, weight: 500 }), SC.ink, { _css_classes: 'sc-st-title' }),
      b.row(s.chips.map(([icon, label]) => b.row([b.icon(icon, 'sc-chip-ic'), b.heading(label, t({ size: 12, line: 14, weight: 500 }), SC.body)], 5, { css_classes: 'sc-chip' })), 6, { css_classes: 'sc-chips' }),
    ], 0, { css_classes: 'sc-st-copy' }),
  ], 16, { css_classes: 'sc-st', flex_align_items: 'flex-start' }))

  return b.root([
    b.row([
      b.col([
        pill(b, A.pill),
        b.heading(A.title.join('<br>'), T.h2big, SC.ink, { header_size: 'h2', _css_classes: 'sc-ag-h' }),
        b.text(A.text, t({ size: 17, line: 26, mobile: { size: 15.5, line: 24 } }), '#7A7A7A', { _css_classes: 'sc-ag-t' }),
      ], 0, { css_classes: 'sc-ag-copy sc-rise' }),
      b.col([
        b.row([
          b.box('sc-ag-ava', [b.icon('sparkle', 'sc-ag-ava-ic')]),
          b.col([b.heading(A.head.name, t({ size: 14, line: 18, weight: 600 }), SC.ink), b.heading(A.head.sub, t({ size: 12, line: 15 }), SC.muted)], 2, { css_classes: 'sc-ag-who' }),
          b.row([b.box('sc-ag-live'), b.heading(A.head.status, t({ size: 12, line: 14, weight: 500 }), SC.green)], 5, { css_classes: 'sc-ag-status' }),
        ], 12, { css_classes: 'sc-ag-head' }),
        b.container({ css_classes: 'sc-rail' }, [b.box('sc-rail-fill')]),
        ...steps,
      ], 8, { css_classes: 'sc-timeline sc-rise' }),
    ], 64, { css_classes: 'sc-ag-row', flex_align_items: 'center' }),
  ], {
    classes: 'sc-agent', background: SC.bg,
    settings: { padding: sides(40, 24, 120, 24) },
    css: [
      'selector .sc-ag-copy{flex:1 1 0!important;align-items:flex-start}',
      'selector .sc-ag-h{margin-top:22px}selector .sc-ag-t{margin-top:20px;max-width:540px}',
      'selector .sc-timeline{position:relative;width:556px!important;flex:none!important;padding:8px!important;border-radius:24px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.04)}',
      'selector .sc-ag-head{padding:12px 14px 10px!important}',
      `selector .sc-ag-ava{width:36px!important;height:36px;flex:none!important;border-radius:50%;background:linear-gradient(135deg,#F0B49E,${SC.agent})}selector .sc-ag-ava-ic{width:17px!important;height:17px;--sx-ic:#fff}`,
      'selector .sc-ag-who{flex:1 1 auto!important}',
      `selector .sc-ag-status{width:auto!important;flex:none!important;padding:4px 10px!important;border-radius:999px;background:${SC.limeSoft}}selector .sc-ag-live{width:7px!important;height:7px;flex:none!important;border-radius:50%;background:${SC.greenMid}}`,
      `selector .sc-st{position:relative;z-index:1;padding:14px 16px!important;border-radius:16px;background:${SC.bg}}`,
      'selector .sc-st-copy{flex:1 1 auto!important}selector .sc-st-title{margin-top:2px}selector .sc-chips{margin-top:10px;flex-wrap:wrap!important}',
      'selector .sc-chip{width:auto!important;flex:none!important;padding:4px 8px!important;border-radius:7px;background:#fff;box-shadow:0 0 0 1px #ECECEC}',
      `selector .sc-chip-ic{width:13px!important;height:13px;--sx-ic:${SC.body}}`,
      // nós da régua: verde-limão com check quando passam
      `selector .sc-node{position:relative;z-index:2;width:30px!important;height:30px;flex:none!important;border-radius:50%;background:#fff;box-shadow:0 0 0 1px #E3E3E3;transition:background-color .35s,box-shadow .35s!important}`,
      'selector .sc-node-ic{width:14px!important;height:14px;--sx-ic:#C3C2C0;transition:background-color .3s!important}',
      `selector .sc-st.is-done .sc-node{background:${SC.lime};box-shadow:0 0 0 6px ${SC.limePale}}selector .sc-st.is-done .sc-node-ic{--sx-ic:${SC.green}}`,
      // a linha vertical atrás dos nós (o script a enche com a rolagem)
      'selector .sc-rail{position:absolute!important;left:39px;top:96px;bottom:60px;width:2px!important;background:#E3E3E3;z-index:1;justify-content:flex-start!important;padding:0!important}',
      `selector .sc-rail-fill{width:2px!important;height:calc(var(--sc-rail,1) * 100%);background:${SC.green}}`,
      // sem script: todos marcados menos o último
      'html:not(.sc-live) selector .sc-st:not(:last-child) .sc-node{background:#DDFF92}html:not(.sc-live) selector .sc-st:not(:last-child) .sc-node-ic{--sx-ic:#122100}',
      '@media (max-width:1024px){selector .sc-ag-row{flex-direction:column!important;align-items:stretch!important;gap:40px!important}selector .sc-timeline{width:100%!important}}',
      '@media (max-width:767px){selector{padding-bottom:72px!important}selector .sc-st{padding:12px!important;gap:12px!important}selector .sc-rail{left:35px}}',
    ].join(''),
  })
}

// =====================================================================
// 5. Faixa escura com foto e o chip que flutua
// =====================================================================

const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost'
const asset = (path: string) => `${ORIGIN}${path}`

export const buildBand = () => {
  const b = builder('scd')
  const S = SC_BAND
  return b.root([
    b.container({ css_classes: 'sc-band-photo' }, [b.image(asset(S.photo), 'Pessoa ajustando a roda de uma bicicleta na oficina', { _css_classes: 'sc-band-img' })]),
    b.container({ css_classes: 'sc-band-shade' }),
    b.col([
      pill(b, S.pill, true),
      b.heading(twoTone(S.title, true), T.h2big, SC.white, { header_size: 'h2', _css_classes: 'sc-band-h' }),
      b.text(S.text, T.lede, SC.onDark, { _css_classes: 'sc-band-t' }),
      btn(b, SC_CTA.text, SC_CTA.url, 'lime', 'sc-band-cta'),
    ], 0, { css_classes: 'sc-band-copy sc-rise' }),
    b.row([mark(b, 'sc-chip-mark'), b.heading(S.chip, t({ size: 13, line: 16, weight: 600 }), SC.ink), b.box('sc-chip-dot')], 8, { css_classes: 'sc-band-chip' }),
  ], {
    classes: 'sc-band', background: SC.night,
    settings: { padding: sides(0, 24) },
    css: [
      MARK_CSS,
      'selector{min-height:600px;overflow:hidden;isolation:isolate}selector>.e-con-inner{position:static;justify-content:center}',
      'selector .sc-band-photo{position:absolute!important;top:0;bottom:0;right:0;left:42%;z-index:-2}selector .sc-band-img,selector .sc-band-img .elementor-widget-container{width:100%;height:100%}selector .sc-band-img img{width:100%;height:100%;object-fit:cover;object-position:50% 40%}',
      `selector .sc-band-shade{position:absolute!important;inset:0;z-index:-1;background:linear-gradient(90deg,${SC.night} 0%,${SC.night} 42%,rgba(18,20,23,.55) 58%,rgba(18,20,23,0) 80%)}`,
      'selector .sc-band-copy{max-width:520px;padding:96px 0!important;align-items:flex-start}',
      'selector .sc-pill-dark{background:rgba(255,255,255,.1)}selector .sc-dim{color:#8E8E8E}',
      'selector .sc-band-h{margin-top:22px}selector .sc-band-t{margin-top:20px}selector .sc-band-cta{margin-top:30px}',
      `selector .sc-band-chip{position:absolute!important;top:120px;left:calc(42% + 110px);width:auto!important;padding:8px 12px 8px 8px!important;border-radius:10px;background:#fff;box-shadow:0 14px 30px rgba(0,0,0,.3)}`,
      'selector .sc-chip-mark{width:22px!important;height:22px;border-radius:6px}',
      `selector .sc-chip-dot{width:16px!important;height:16px;flex:none!important;border-radius:50%;background:${SC.green};box-shadow:inset 0 0 0 4px ${SC.lime}}`,
      `html.sc-live selector .sc-band-chip{opacity:0;transform:translateY(16px) scale(.92)}html.sc-live selector .sc-band-chip.is-in{opacity:1;transform:none;transition:opacity .6s ${E} .4s,transform .7s ${E} .4s}`,
      '@media (max-width:767px){selector{min-height:0}selector .sc-band-photo{left:0;top:auto;height:300px}selector .sc-band-shade{background:linear-gradient(0deg,rgba(18,20,23,0) 0,rgba(18,20,23,.2) 200px,#121417 300px)}',
      'selector .sc-band-copy{padding:64px 0 340px!important}selector .sc-band-cta,selector .sc-band-cta .elementor-button{width:100%}selector .sc-band-chip{top:auto;bottom:40px;left:24px}}',
    ].join(''),
  })
}

// =====================================================================
// 6. Um projeto por cliente: título que escurece, órbita e os módulos
// =====================================================================

export const buildModules = () => {
  const b = builder('sce')
  const M = SC_MODULES
  const inner = M.orbit.slice(0, 4)
  const outer = M.orbit.slice(4)
  const orbit = b.container({ css_classes: 'sc-orbit' }, [
    b.box('sc-ring sc-ring-1', inner.map((icon, i) => b.box(`sc-sat sc-sat-s sc-at-${i}`, [b.icon(icon, 'sc-sat-ic')]))),
    b.box('sc-ring sc-ring-2', outer.map((icon, i) => b.box(`sc-sat sc-sat-l sc-at-${i}`, [b.icon(icon, 'sc-sat-ic')]))),
    mark(b, 'sc-orbit-mark'),
  ])
  const card = ([icon, title, text]: [string, string, string]) => b.col([
    b.box('sc-m-ic', [b.icon(icon, 'sc-m-glyph')]),
    b.heading(title, T.card, SC.ink, { header_size: 'h3', _css_classes: 'sc-m-h' }),
    b.text(text, T.cardText, '#7A7A7A', { _css_classes: 'sc-m-t' }),
  ], 0, { css_classes: 'sc-m-card sc-rise' })

  return b.root([
    b.row([
      b.col([
        pill(b, M.pill),
        b.heading(M.title, T.h2big, SC.ink, { header_size: 'h2', _css_classes: 'sc-mod-h sc-reveal' }),
        b.text(M.text, t({ size: 17, line: 26 }), '#7A7A7A', { _css_classes: 'sc-mod-t' }),
        orbit,
      ], 0, { css_classes: 'sc-mod-left' }),
      b.col([
        b.container({ css_classes: 'sc-m-grid' }, M.cards.map(card)),
        b.col([
          b.heading(M.more.title, t({ size: 15, line: 19, weight: 600 }), SC.white),
          b.row(M.more.chips.map((chip) => b.heading(chip, t({ size: 12.5, line: 15, weight: 500 }), '#E6EEDD', { _css_classes: 'sc-more-chip' })), 8, { css_classes: 'sc-more-chips' }),
        ], 16, { css_classes: 'sc-more sc-rise' }),
      ], 16, { css_classes: 'sc-mod-right' }),
    ], 64, { css_classes: 'sc-mod-row', flex_align_items: 'flex-start' }),
  ], {
    classes: 'sc-modules', background: SC.bg,
    settings: { padding: sides(120, 24, 120, 24) },
    css: [
      MARK_CSS,
      // a coluna da esquerda fica presa enquanto os módulos passam
      'selector .sc-mod-left{position:sticky!important;top:110px;width:480px!important;flex:none!important;align-items:flex-start}',
      'selector .sc-mod-h{margin-top:22px}selector .sc-mod-t{margin-top:22px;max-width:390px}',
      // palavras do título: cinza até a rolagem passar (o script põe .is-on)
      `selector .sc-rw{color:#B4B4B4;transition:color .35s}selector .sc-rw.is-on{color:${SC.ink}}`,
      // órbita: dois anéis tracejados com ícones que giram devagar
      'selector .sc-orbit{position:relative;width:280px!important;height:280px;margin-top:40px;flex:none!important}',
      'selector .sc-ring{position:absolute!important;left:50%;top:50%;border-radius:50%;border:1px dashed #D5D5D5}',
      'selector .sc-ring-1{width:156px!important;height:156px;margin:-78px 0 0 -78px}selector .sc-ring-2{width:280px!important;height:280px;margin:-140px 0 0 -140px}',
      'selector .sc-sat{position:absolute!important;left:50%;top:50%;border-radius:50%;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.08)}',
      'selector .sc-sat-s{width:28px!important;height:28px;margin:-14px 0 0 -14px}selector .sc-sat-l{width:44px!important;height:44px;margin:-22px 0 0 -22px}',
      `selector .sc-sat-ic{width:48%!important;height:48%;--sx-ic:${SC.ink}}`,
      ...[0, 1, 2, 3].map((i) => `selector .sc-ring-1 .sc-at-${i}{transform:rotate(${i * 90 + 45}deg) translateY(-78px) rotate(${-(i * 90 + 45)}deg)}`),
      ...[0, 1, 2, 3].map((i) => `selector .sc-ring-2 .sc-at-${i}{transform:rotate(${i * 90}deg) translateY(-140px) rotate(${-i * 90}deg)}`),
      `selector .sc-orbit-mark{position:absolute!important;left:50%;top:50%;width:64px!important;height:64px;margin:-32px 0 0 -32px;border-radius:18px;box-shadow:0 0 0 10px ${SC.limePale}}`,
      `html.sc-live selector .sc-ring-1{animation:sc-spin 40s linear infinite}html.sc-live selector .sc-ring-2{animation:sc-spin 60s linear infinite reverse}`,
      'html.sc-live selector .sc-ring-1 .sc-sat{animation:sc-spin 40s linear infinite reverse}html.sc-live selector .sc-ring-2 .sc-sat{animation:sc-spin 60s linear infinite}',
      '@keyframes sc-spin{to{rotate:360deg}}',
      'selector .sc-mod-right{flex:1 1 auto!important}',
      'selector .sc-m-grid{display:grid!important;grid-template-columns:1fr 1fr;gap:16px!important}',
      'selector .sc-m-card{padding:28px!important;border-radius:20px;background:#fff;min-height:262px}',
      `selector .sc-m-ic{width:46px!important;height:46px;flex:none!important;border-radius:50%;background:${SC.limeSoft}}selector .sc-m-glyph{width:20px!important;height:20px;--sx-ic:${SC.green}}`,
      'selector .sc-m-h{margin-top:48px}selector .sc-m-t{margin-top:12px}',
      `selector .sc-more{padding:28px!important;border-radius:20px;background:radial-gradient(90% 120% at 100% 100%,#4E6B3A,rgba(78,107,58,0) 55%),linear-gradient(90deg,${SC.green},#1B2A0C)}`,
      'selector .sc-more-chips{flex-wrap:wrap!important}selector .sc-more-chip .elementor-heading-title{display:inline-block;padding:6px 10px;border-radius:7px;background:rgba(255,255,255,.08)}',
      '@media (max-width:1024px){selector .sc-mod-row{flex-direction:column!important;align-items:stretch!important;gap:48px!important}selector .sc-mod-left{position:relative!important;top:0;width:auto!important}}',
      '@media (max-width:767px){selector{padding-top:72px!important;padding-bottom:72px!important}selector .sc-m-grid{grid-template-columns:1fr}selector .sc-m-card{min-height:0;padding:24px!important}selector .sc-m-h{margin-top:24px}selector .sc-orbit{transform:scale(.85);transform-origin:0 0;margin-bottom:-42px}}',
    ].join(''),
  })
}

// =====================================================================
// 7. Biblioteca: título centrado e a faixa de fotos que corre
// =====================================================================

export const buildLibrary = () => {
  const b = builder('scf')
  const L = SC_LIBRARY
  const card = ([photo, name, role]: [string, string, string]) => b.container({ css_classes: 'sc-lib-card' }, [
    b.image(asset(`/sections/c25/businesses/${photo}.webp`), name, { _css_classes: 'sc-lib-img' }),
    b.col([
      b.heading(name, t({ size: 15, line: 19, weight: 600 }), SC.white),
      b.heading(role, t({ size: 12.5, line: 16 }), '#D9D9D9'),
    ], 2, { css_classes: 'sc-lib-cap' }),
  ])
  const group = () => b.row(L.cards.map(card), 12, { css_classes: 'sc-lib-group' })
  return b.root([
    b.col([
      pill(b, L.pill),
      b.heading(twoTone(L.title, true), T.h2big, SC.ink, { header_size: 'h2', align: 'center', _css_classes: 'sc-lib-h' }),
    ], 0, { css_classes: 'sc-lib-head sc-rise', flex_align_items: 'center' }),
    b.container({ css_classes: 'sc-marquee' }, [b.row([group(), group()], 12, { css_classes: 'sc-track' })]),
  ], {
    classes: 'sc-lib', background: SC.bg, full: true,
    settings: { padding: sides(40, 0, 120, 0) },
    css: [
      'selector{overflow-x:clip}',
      'selector .sc-lib-head .sc-pill{align-self:center}selector .sc-lib-h{margin-top:22px;padding:0 24px}selector .sc-dim{color:#A8A8A8}',
      'selector .sc-marquee{margin-top:56px;overflow:hidden}',
      'selector .sc-track{width:max-content!important;flex-wrap:nowrap!important}',
      'selector .sc-lib-group{width:max-content!important;flex:none!important;flex-wrap:nowrap!important}',
      'selector .sc-lib-card{position:relative;width:220px!important;height:290px;flex:none!important;border-radius:18px;overflow:hidden;background:#ddd}',
      'selector .sc-lib-img{position:absolute!important;inset:0}selector .sc-lib-img .elementor-widget-container{height:100%}selector .sc-lib-img img{width:100%;height:100%;object-fit:cover}',
      'selector .sc-lib-cap{position:absolute!important;left:0;right:0;bottom:0;padding:40px 16px 16px!important;background:linear-gradient(0deg,rgba(0,0,0,.72),rgba(0,0,0,0))}',
      // a faixa corre sem parar (dois grupos iguais) e para sob o mouse
      '@keyframes sc-marquee{to{transform:translateX(calc(-50% - 6px))}}',
      'html.sc-live selector .sc-track{animation:sc-marquee 46s linear infinite}html.sc-live selector .sc-marquee:hover .sc-track{animation-play-state:paused}',
      '@media (max-width:767px){selector{padding-bottom:72px!important}selector .sc-lib-card{width:180px!important;height:238px}}',
    ].join(''),
  })
}

// =====================================================================
// 8. Perguntas: título à esquerda, o cartão das perguntas à direita
// =====================================================================

export const buildFaq = () => {
  const b = builder('scg')
  const F = SC_FAQ
  const accordion = b.widget('nested-accordion', {
    items: F.items.map(([q], i) => ({ item_title: q, _id: `scq${i + 1}` })),
    default_state: 'expanded', max_items_expended: 'one',
    n_accordion_animation_duration: { unit: 'ms', size: 300, sizes: [] },
    ...typeSpec(t({ size: 15, line: 20, weight: 500 }), 'title_typography'),
    normal_title_color: SC.ink, hover_title_color: SC.ink, active_title_color: SC.ink,
    _css_classes: 'sc-faq-list',
  })
  accordion.elements = F.items.map(([, a]) => b.col([b.text(a, t({ size: 14.5, line: 22 }), '#6B6B6B')], 0, { css_classes: 'sc-faq-a' }))
  return b.root([
    b.row([
      b.col([
        pill(b, F.pill),
        b.heading(twoTone(F.title, true), T.h2big, SC.ink, { header_size: 'h2', _css_classes: 'sc-faq-h' }),
        b.text(F.note, t({ size: 14.5, line: 21 }), SC.muted, { _css_classes: 'sc-faq-note' }),
      ], 0, { css_classes: 'sc-faq-left sc-rise' }),
      b.col([accordion], 0, { css_classes: 'sc-faq-card sc-rise' }),
    ], 64, { css_classes: 'sc-faq-row', flex_align_items: 'flex-start' }),
  ], {
    classes: 'sc-faq', background: SC.bg, id: 'perguntas',
    settings: { padding: sides(40, 24, 140, 24) },
    css: [
      'selector .sc-faq-left{width:420px!important;flex:none!important;align-items:flex-start}selector .sc-faq-h{margin-top:22px}selector .sc-dim{color:#A8A8A8}selector .sc-faq-note{margin-top:16px;max-width:280px}',
      'selector .sc-faq-card{flex:1 1 auto!important;padding:8px 24px!important;border-radius:20px;background:#fff}',
      'selector .e-n-accordion{display:block}selector .e-n-accordion-item{border-bottom:1px solid #F0F0F0}selector .e-n-accordion-item:last-child{border-bottom:0}',
      'selector .e-n-accordion-item-title{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 0!important;border:0!important;background:none!important;list-style:none;cursor:pointer}',
      'selector .e-n-accordion-item-title::-webkit-details-marker{display:none}selector .e-n-accordion-item-title-header{flex:1 1 auto}',
      // o + gira e vira ×
      `selector .e-n-accordion-item-title-icon{position:relative;display:block!important;width:12px;height:12px;flex:none;transition:transform .3s ${E}}selector .e-n-accordion-item-title-icon>*{display:none!important}`,
      'selector .e-n-accordion-item-title-icon::after{content:"";position:absolute;inset:0;background:linear-gradient(#1D1D1D,#1D1D1D) center/100% 1.5px no-repeat,linear-gradient(#1D1D1D,#1D1D1D) center/1.5px 100% no-repeat}',
      'selector .e-n-accordion-item[open] .e-n-accordion-item-title-icon{transform:rotate(45deg)}',
      'selector .e-n-accordion-item>.e-con,selector .sc-faq-a{border:0!important;padding:0 32px 18px 0!important}',
      `selector .e-n-accordion-item::details-content{block-size:0;overflow:hidden;transition:block-size .3s ${E},content-visibility .3s allow-discrete}selector .e-n-accordion-item[open]::details-content{block-size:auto}selector .e-n-accordion-item{interpolate-size:allow-keywords}`,
      '@media (max-width:1024px){selector .sc-faq-row{flex-direction:column!important;align-items:stretch!important;gap:32px!important}selector .sc-faq-left{width:auto!important}}',
      '@media (max-width:767px){selector{padding-bottom:96px!important}selector .sc-faq-card{padding:4px 18px!important}}',
    ].join(''),
  })
}

// =====================================================================
// 9. Chamada final: faixa lima, título com ícones que escurece ao rolar
// =====================================================================

export const buildFinal = () => {
  const b = builder('sch2')
  const F = SC_FINAL
  const html = F.lines.map((line) => line.replace(/\{i:([a-z]+)\}/g, (_, name) => {
    b.useIcons([name])
    return `<span class="sc-ii"><span class="sx-i sx-i-${name}"></span></span>`
  })).join('<br>')
  return b.root([
    b.col([
      pill(b, F.pill),
      b.heading(html, T.h2big, SC.ink, { header_size: 'h2', align: 'center', _css_classes: 'sc-final-h sc-reveal' }),
      b.text(F.text, t({ size: 17, line: 26 }), '#5F5F5F', { align: 'center', _css_classes: 'sc-final-t' }),
      btn(b, SC_CTA.text, SC_CTA.url, 'dark', 'sc-final-cta'),
    ], 0, { css_classes: 'sc-final-head sc-rise', flex_align_items: 'center' }),
    b.container({ css_classes: 'sc-trust' }, F.trust.map(([icon, name, text]) => b.col([
      b.row([b.icon(icon, 'sc-trust-ic'), b.heading(name, t({ size: 12, line: 14, weight: 600 }), '#8A8F82')], 6, { css_classes: 'sc-trust-logo' }),
      b.text(text, t({ size: 13, line: 18 }), '#6E7366', { _css_classes: 'sc-trust-t' }),
    ], 12, { css_classes: 'sc-trust-item' }))),
  ], {
    classes: 'sc-final', background: SC.limePale,
    settings: { padding: sides(120, 24, 110, 24) },
    css: [
      `selector{background:linear-gradient(180deg,${SC.bg} 0%,${SC.limePale} 30%,#EEFFC5 100%)!important;border-radius:0 0 40px 40px;z-index:1}`,
      'selector .sc-final-head .sc-pill{align-self:center}',
      'selector .sc-final-h{margin-top:24px}selector .sc-final-h .elementor-heading-title{font-size:clamp(34px,4vw,58px);line-height:1.12;letter-spacing:-.04em}',
      'selector .sc-ii{display:inline-flex;align-items:center;justify-content:center;width:1em;height:1em;margin:0 .06em;border-radius:.24em;background:#DDFF92;vertical-align:-.12em}selector .sc-ii .sx-i{width:.52em;height:.52em;--sx-ic:#122100;display:block}',
      'selector .sc-final-t{margin-top:22px;max-width:460px}selector .sc-final-cta{margin-top:32px}',
      `selector .sc-rw{color:#B9BFAE;transition:color .35s}selector .sc-rw.is-on{color:${SC.ink}}`,
      'selector .sc-trust{display:grid!important;grid-template-columns:repeat(3,1fr);gap:40px!important;max-width:1000px;margin:84px auto 0;padding-top:36px!important;border-top:1px solid rgba(18,33,0,.1)}',
      `selector .sc-trust-logo{width:auto!important}selector .sc-trust-ic{width:15px!important;height:15px;--sx-ic:#8A8F82}`,
      '@media (max-width:767px){selector{padding-top:80px!important;padding-bottom:72px!important;border-radius:0 0 28px 28px}selector .sc-final-cta,selector .sc-final-cta .elementor-button{width:100%}selector .sc-trust{grid-template-columns:1fr;gap:24px!important;margin-top:56px}}',
    ].join(''),
  })
}

// =====================================================================
// 10. Rodapé escuro com a palavra grande
// =====================================================================

export const buildFooter = () => {
  const b = builder('sci')
  return b.root([
    b.row([
      b.row([
        b.heading(SC_BRAND.word, t({ size: 16, line: 22, weight: 500 }), SC.white),
        mark(b, 'sc-foot-mark'),
        b.heading(SC_FOOTER.line, t({ size: 16, line: 22, weight: 500 }), SC.white, { _css_classes: 'sc-foot-line' }),
      ], 10, { css_classes: 'sc-foot-brand' }),
      b.row(SC_FOOTER.links.map(([label, url]) => b.heading(label, t({ size: 14, line: 18 }), '#BDBDBD', { link: link(url), _css_classes: 'sc-foot-link' })), 24, { css_classes: 'sc-foot-links' }),
    ], 24, { css_classes: 'sc-foot-row', flex_justify_content: 'space-between' }),
    b.heading('<span class="sc-big-a">super</span><span class="sc-big-b">elements</span>', T.mark, '#4A4A4A', { _css_classes: 'sc-big', align: 'center' }),
  ], {
    tag: 'footer', classes: 'sc-footer', background: SC.ink,
    settings: { padding: sides(130, 24, 0, 24) },
    css: [
      MARK_CSS,
      'selector{margin-top:-40px;overflow:hidden}',
      'selector .sc-foot-row{padding:0 26px!important}selector .sc-foot-brand{width:auto!important;flex:1 1 auto!important;flex-wrap:wrap!important}',
      'selector .sc-foot-mark{width:22px!important;height:22px;border-radius:6px}',
      'selector .sc-foot-links{width:auto!important;flex:none!important}selector .sc-foot-link a:hover{color:#fff}',
      'selector .sc-big{margin-top:56px;margin-bottom:-.2em}selector .sc-big .elementor-heading-title{font-size:clamp(44px,10.6vw,150px);white-space:nowrap}',
      `selector .sc-big-b{color:#2E2E2E}`,
      `html.sc-live selector .sc-big{opacity:0;transform:translateY(40px)}html.sc-live selector .sc-big.is-in{opacity:1;transform:none;transition:opacity 1s ${E},transform 1.2s ${E}}`,
      '@media (max-width:767px){selector{padding-top:100px!important}selector .sc-foot-row{flex-direction:column!important;align-items:flex-start!important;padding:0!important}selector .sc-big{margin-top:40px}}',
    ].join(''),
  })
}
