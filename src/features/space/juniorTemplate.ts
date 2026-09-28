import type { SectionNodeData } from '@/types/space'
import type { LandingTemplate } from './landingTemplates'
import {
  bg, border, createBuilder, FILL, FIXED, fluid, link, maxw, px, reveal, sides, T, techGrid, tweak, typography,
  type JaBuilder,
} from '@/features/junior/elementor'
import { JA, JA_CONTACT as K, JA_LAYOUT as L, JA_SHADOW, jaDirections, jaInstagram, jaWhatsApp } from '@/features/junior/tokens'

/**
 * Júnior Automáticos: landing page da oficina de câmbio automático de São
 * José dos Campos, em containers e widgets nativos do Elementor. A copy é a
 * do cliente (`brands/junior-automaticos/COPY.md`) e a marca está em
 * `brands/junior-automaticos/DESIGN.md`. Zero widgets HTML.
 */

type JsonRecord = Record<string, unknown>

const DESK = '(min-width:1025px)'
const MOBILE = '(max-width:1024px)'
const LOGO = '/brands/junior-automaticos/logo/junior-automaticos-logo-horizontal.png'
const SYMBOL = '/brands/junior-automaticos/logo/junior-automaticos-simbolo.png'
const BRAND = 'Júnior Automáticos'
const QUOTE = 'Solicitar orçamento'
/** Proporção do logo horizontal (541 × 128) e do símbolo (404 × 720). */
const LOGO_RATIO = 541 / 128
const SYMBOL_RATIO = 404 / 720

const NAV: Array<[string, string]> = [
  ['Home', '#inicio'], ['Diagnóstico', '#diagnostico'], ['Serviços', '#servicos'], ['Quem somos', '#quem-somos'], ['Dúvidas', '#duvidas'],
]

/**
 * Logo com largura explícita: a marca aplicada por cima mantém o tamanho
 * quando o arquivo é o dela, e troca o logo sem mudar a altura quando é outra.
 */
const logo = (b: JaBuilder, height: number, options: JsonRecord = {}) => {
  const width = px(Math.round(height * LOGO_RATIO))
  return b.image(LOGO, BRAND, {
    link_to: 'custom', link: link('#inicio'), width, space: width, ...FIXED, _element_width: 'auto',
    custom_css: 'selector img{display:block;height:auto}', ...options,
  })
}

/** O botão de sempre: orçamento pelo WhatsApp. */
const quote = (b: JaBuilder, options: JsonRecord = {}) => b.button(QUOTE, jaWhatsApp(), 'primary', { icon: 'fab fa-whatsapp', ...FIXED, ...options })

/** Desenhos técnicos locais; são ilustrações, nunca fotos de serviços reais. */
const drawing = (b: JaBuilder, name: string) => b.image(`/brands/junior-automaticos/icons/${name}.svg`, '', {
  width: px(80), space: px(80), ...FIXED, _element_width: 'auto',
  custom_css: 'selector img{display:block;width:80px;height:80px}',
})

// ── cabeçalho ───────────────────────────────────────────────────────────────

const makeHeader = (): SectionNodeData => {
  const b = createBuilder('jah')
  const nav = b.row(NAV.map(([label, url]) => b.heading(label, T.nav, JA.onDark, {
    link: link(url), title_hover_color: JA.gold, ...FIXED, _css_classes: 'ja-nav-link',
  })), 30, { flex_wrap: 'wrap', flex_justify_content: 'center', ...FILL })
  const desk = b.row([logo(b, 46), nav, quote(b, { text_padding: sides(13, 20) })], 32, {
    flex_justify_content: 'space-between', min_height: px(80), css_classes: 'ja-desk',
  })

  // celular e tablet: o logo e o botão "Menu" (acordeão nativo) que abre a lista
  const panel = b.col([
    b.list(NAV.map(([text, url]) => ({ text, url })), {
      space_between: px(0), text_color: JA.white, text_color_hover: JA.gold,
      ...typography(tweak(T.list, { size: 18 }), 'icon_typography'),
      divider: 'yes', divider_color: JA.lineDark, _css_classes: 'ja-menu-links',
    }),
    b.button(QUOTE, jaWhatsApp(), 'primary', { icon: 'fab fa-whatsapp', align: 'justify', _margin: sides(18, 0, 0, 0) }),
  ], 0, {
    padding: sides(8, L.gutter.tablet, 24, L.gutter.tablet), padding_mobile: sides(8, L.gutter.mobile, 24, L.gutter.mobile),
    ...bg(JA.black), ...border(JA.lineDark, sides(0, 0, 1, 0)),
  })
  const accordion = b.widget('nested-accordion', {
    items: [{ _id: 'jahmenu', item_title: 'Menu' }],
    default_state: 'all_collapsed', max_items_expended: 'one',
    ...typography(tweak(T.button, { size: 14 }), 'title_typography'),
    normal_title_color: JA.white,
    _css_classes: 'ja-menu', ...FIXED,
  })
  accordion.elements = [panel]
  const mobile = b.row([logo(b, 38), accordion], 16, { flex_justify_content: 'space-between', min_height: px(64), css_classes: 'ja-mob' })

  const root = b.root([desk, mobile], {
    background: JA.black, tag: 'header', pad: false,
    settings: border(JA.lineDark, sides(0, 0, 1, 0)),
    css: [
      'selector{position:sticky;top:0;z-index:50}',
      `@media ${MOBILE}{selector .ja-desk{display:none!important}}`,
      `@media ${DESK}{selector .ja-mob{display:none!important}}`,
      // filete dourado embaixo do link com o mouse; a cor já muda para o dourado
      `selector .ja-nav-link .elementor-heading-title a{display:block;padding:8px 0;background:linear-gradient(${JA.gold},${JA.gold}) left bottom/0 2px no-repeat}`,
      '@media(prefers-reduced-motion:no-preference){selector .ja-nav-link .elementor-heading-title a{transition:background-size 180ms ease,color 180ms ease}}',
      'selector .ja-nav-link .elementor-heading-title a:hover{background-size:100% 2px}',
      // botão "Menu": contorno fino; o painel desce por cima da página
      `selector .ja-menu .e-n-accordion-item-title{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 16px;border:1px solid rgba(255,255,255,.32);border-radius:${L.radius.button}px;background:transparent;cursor:pointer;list-style:none}`,
      'selector .ja-menu .e-n-accordion-item-title::-webkit-details-marker{display:none}',
      'selector .ja-menu .e-n-accordion-item-title-icon{display:none}',
      `selector .ja-menu .e-n-accordion-item-title-header::before{content:"\\f0c9";font-family:"Font Awesome 5 Free","Font Awesome 6 Free";font-weight:900;margin-right:8px;color:${JA.gold}}`,
      'selector .ja-menu .e-n-accordion-item-title-header{display:flex;align-items:center}',
      `selector .ja-menu .e-n-accordion-item[open] .e-n-accordion-item-title{border-color:${JA.gold}}`,
      `selector .ja-menu .e-n-accordion-item>.e-con{position:absolute;left:-${L.gutter.tablet}px;right:-${L.gutter.tablet}px;top:64px;z-index:60;border:0;box-shadow:${JA_SHADOW}}`,
      `@media(max-width:767px){selector .ja-menu .e-n-accordion-item>.e-con{left:-${L.gutter.mobile}px;right:-${L.gutter.mobile}px}}`,
      'selector .ja-mob{position:relative;flex-wrap:nowrap!important}selector .ja-menu,selector .ja-menu .e-n-accordion,selector .ja-menu .e-n-accordion-item{position:static}',
      'selector .ja-menu-links .elementor-icon-list-item{padding-block:14px!important;margin:0!important}',
    ].join(''),
  })
  // o cabeçalho tem a própria altura: sem o padding vertical das seções, mas com as margens laterais
  root.settings.padding = sides(0, L.gutter.desktop, 0, L.gutter.desktop)
  root.settings.padding_tablet = sides(0, L.gutter.tablet, 0, L.gutter.tablet)
  root.settings.padding_mobile = sides(0, L.gutter.mobile, 0, L.gutter.mobile)
  return b.section('Júnior Automáticos · Cabeçalho', 'junior-cabecalho', root)
}

// ── hero ────────────────────────────────────────────────────────────────────

/** O seletor P R N D do logo, com o D aceso: engata uma vez ao abrir a página. */
const gearSelector = (b: JaBuilder) => b.row(['P', 'R', 'N', 'D'].map((letter) => b.col([
  b.heading(letter, tweak(T.eyebrow, { size: 14, letter: 0 }), letter === 'D' ? JA.black : JA.mutedDark, { align: 'center' }),
], 0, {
  width: px(34), width_mobile: px(32), min_height: px(34), ...FIXED,
  flex_justify_content: 'center', flex_align_items: 'center',
  ...(letter === 'D' ? bg(JA.gold) : {}),
  css_classes: `ja-gear ja-gear--${letter.toLowerCase()}`,
})), 0, {
  // contorno em CSS: com borda nativa o seletor viraria cartão para a marca
  width: fluid('auto'), width_mobile: fluid('auto'), ...FIXED,
  border_radius: sides(L.radius.button), css_classes: 'ja-gears',
})

const makeHero = (): SectionNodeData => {
  const b = createBuilder('jar')
  const trust = b.list([
    { text: 'Mais de 40 anos de mercado', icon: 'fas fa-history' },
    { text: 'Diagnóstico antes do reparo', icon: 'fas fa-search' },
    { text: 'Atendimento pelo WhatsApp', icon: 'fab fa-whatsapp' },
  ], {
    view: 'inline', space_between: px(24), icon_size: px(15), text_indent: px(8),
    icon_color: JA.gold, text_color: JA.onDark,
    ...typography(tweak(T.list, { size: 15 }), 'icon_typography'),
    ...reveal(320),
  })
  const copy = b.col([
    b.row([
      gearSelector(b),
      b.heading('Câmbios automáticos e automatizados', T.eyebrow, JA.onDark, FILL),
    ], 14, { flex_wrap: 'wrap', ...reveal(0, 'container') }),
    b.heading(`Especialista em <span class="ja-gold">Câmbio Automático</span> em São José dos Campos e Região`, T.hero, JA.white, {
      header_size: 'h1', ...maxw(680), ...reveal(80),
    }),
    b.text('Mais de 40 anos trabalhando com um diagnóstico preciso, manutenção especializada e reparo de câmbios automáticos.', T.lede, JA.onDark, {
      ...maxw(560), ...reveal(160),
    }),
    b.row([
      quote(b),
      b.button('Conheça os serviços', '#servicos', 'outlineLight', FIXED),
    ], 12, { flex_wrap: 'wrap', flex_justify_content: 'flex-start', ...reveal(240, 'container'), _margin: sides(8, 0, 10, 0) }),
    trust,
  ], 24, { flex_justify_content: 'center' })

  const visual = b.col([
    // o texto alternativo é o do logo da marca, que a marca aplicada põe de volta de qualquer jeito
    b.image(SYMBOL, BRAND, {
      width: px(Math.round(460 * SYMBOL_RATIO)), width_tablet: px(Math.round(340 * SYMBOL_RATIO)), width_mobile: px(Math.round(240 * SYMBOL_RATIO)),
      space: px(Math.round(460 * SYMBOL_RATIO)), _css_classes: 'ja-hero-symbol',
    }),
  ], 0, { flex_align_items: 'center', flex_justify_content: 'center', css_classes: 'ja-hero-visual', ...reveal(120, 'container') })

  const root = b.root([
    b.grid([copy, visual], 'minmax(0,1.2fr) minmax(0,.8fr)', [40, 48], { grid_align_items: 'center' }, { tablet: 'minmax(0,1.3fr) minmax(0,.7fr)', mobile: '1fr' }),
  ], {
    background: JA.black, id: 'inicio', pad: [80, 64, 48],
    css: [
      techGrid('rgba(255,255,255,.035)', '75% 40%', 64),
      `selector .ja-gold{color:${JA.gold}}`,
      `selector .ja-gears{overflow:hidden;box-shadow:inset 0 0 0 1px ${JA.lineDark}}`,
      // o D aceso tem fundo nativo e a marca o arredondaria como cartão: as casas são sempre retas
      'selector .ja-gear{border-radius:0!important}',
      `selector .ja-gear+.ja-gear{border-left:1px solid ${JA.lineDark}}`,
      // engata P → R → N → D uma vez; sem movimento, o D já está aceso
      `@media(prefers-reduced-motion:no-preference){@keyframes jaGearPass{0%,100%{background:transparent}30%,60%{background:${JA.gold}}}@keyframes jaGearPassText{0%,100%{color:${JA.mutedDark}}30%,60%{color:${JA.black}}}@keyframes jaGearOn{from{background:transparent}to{background:${JA.gold}}}@keyframes jaGearOnText{from{color:${JA.mutedDark}}to{color:${JA.black}}}`
        + 'selector .ja-gear--p{animation:jaGearPass 360ms ease 300ms both}selector .ja-gear--r{animation:jaGearPass 360ms ease 560ms both}selector .ja-gear--n{animation:jaGearPass 360ms ease 820ms both}selector .ja-gear--d{animation:jaGearOn 240ms ease 1080ms both}'
        + 'selector .ja-gear--p .elementor-heading-title{animation:jaGearPassText 360ms ease 300ms both}selector .ja-gear--r .elementor-heading-title{animation:jaGearPassText 360ms ease 560ms both}selector .ja-gear--n .elementor-heading-title{animation:jaGearPassText 360ms ease 820ms both}selector .ja-gear--d .elementor-heading-title{animation:jaGearOnText 240ms ease 1080ms both}}',
      // o símbolo em 3D sob um foco de luz dourado
      'selector .ja-hero-visual{position:relative;isolation:isolate}',
      'selector .ja-hero-visual::before{content:"";position:absolute;left:50%;top:50%;width:min(520px,120%);aspect-ratio:1;transform:translate(-50%,-50%);z-index:-1;pointer-events:none;background:radial-gradient(circle,rgba(207,155,58,.22) 0%,rgba(207,155,58,.08) 38%,transparent 68%)}',
      'selector .ja-hero-symbol img{display:block;height:auto;margin-inline:auto}',
      '@media(max-width:767px){selector .ja-hero-visual{padding-top:8px}}',
    ].join(''),
  })
  return b.section('Júnior Automáticos · Hero', 'junior-hero', root)
}

// ── marcas ──────────────────────────────────────────────────────────────────

const MARCAS: Array<[string, string, number]> = [
  ['jeep', 'Jeep', 30], ['fiat', 'Fiat', 46], ['chevrolet', 'Chevrolet', 26], ['ford', 'Ford', 34], ['kia', 'Kia', 22],
]

const makeBrands = (): SectionNodeData => {
  const b = createBuilder('jam')
  const group = (duplicate = false) => b.row(MARCAS.map(([file, name, height]) => b.image(`/brands/junior-automaticos/marcas/${file}.svg`, duplicate ? '' : name, {
    ...FIXED, _element_width: 'auto', _css_classes: 'ja-marca',
    custom_css: `selector img{display:block;height:${height}px;width:auto}@media(max-width:767px){selector img{height:${Math.round(height * 0.82)}px}}`,
  })), 0, { css_classes: `ja-brand-group${duplicate ? ' ja-brand-copy' : ''}`, ...(duplicate ? { _attributes: 'aria-hidden|true' } : {}) })
  const logos = b.col([b.row([group(), group(true)], 0, { css_classes: 'ja-brand-track' })], 0, { css_classes: 'ja-brand-window', ...FILL })
  const root = b.root([
    b.row([
      b.heading('Trabalhamos com diversas marcas', tweak(T.eyebrow, { size: 13 }), JA.white, { ...FIXED, _css_classes: 'ja-eyebrow' }),
      logos,
    ], 56, { flex_direction_tablet: 'column', flex_align_items_tablet: 'center', flex_gap_tablet: { unit: 'px', size: 28, row: '28', column: '28', isLinked: true } }),
  ], {
    background: JA.raised, pad: [36, 36, 32],
    settings: border(JA.lineDark, sides(1, 0, 1, 0)),
    css: [
      'selector .ja-brand-window{overflow:hidden;min-width:0;mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)}',
      'selector .ja-brand-track{width:max-content!important;max-width:none;flex-wrap:nowrap!important;gap:0!important}',
      'selector .ja-brand-group{width:720px!important;flex:0 0 720px;flex-direction:row!important;flex-wrap:nowrap!important;justify-content:space-around!important;padding-inline:20px}',
      'selector .ja-marca{flex:0 0 auto!important}',
      '@media(prefers-reduced-motion:no-preference){@keyframes jaMarquee{to{transform:translateX(-50%)}}selector .ja-brand-track{animation:jaMarquee 28s linear infinite}selector .ja-brand-window:hover .ja-brand-track{animation-play-state:paused}}',
      '@media(prefers-reduced-motion:reduce){selector .ja-brand-copy{display:none}selector .ja-brand-window{mask-image:none}selector .ja-brand-track,selector .ja-brand-group{width:100%!important;flex-basis:auto;flex-wrap:wrap!important;gap:28px!important}}',
      '@media(max-width:767px){selector .ja-brand-window{width:100%}selector .ja-brand-group{width:560px!important;flex-basis:560px}}',
      '@media(max-width:767px) and (prefers-reduced-motion:reduce){selector .ja-brand-group{width:100%!important;flex-basis:auto}}',
    ].join(''),
  })
  return b.section('Júnior Automáticos · Marcas', 'junior-marcas', root)
}

// ── problema ────────────────────────────────────────────────────────────────

const SINAIS: Array<[string, string, string]> = [
  ['shift', 'Na troca de marcha', 'Trancos, demora para engatar ou dificuldade para trocar de marcha.'],
  ['gauge', 'Ao dirigir', 'Perda de desempenho, câmbio patinando ou falhas durante a condução.'],
  ['oil', 'Debaixo do carro', 'Vazamento de óleo ou manchas no local onde o carro fica parado.'],
  ['alert', 'No som e no painel', 'Ruídos diferentes, luzes de alerta ou comportamento irregular do câmbio.'],
]

const makeProblem = (): SectionNodeData => {
  const b = createBuilder('jap')
  const signs = SINAIS.map(([icon, label, description], index) => b.col([
    drawing(b, icon),
    b.heading(label, T.card, JA.ink, { header_size: 'h3' }),
    b.text(description, T.small, JA.body),
  ], 14, {
    padding: sides(20), padding_mobile: sides(14, 16),
    ...bg(JA.white), ...border(JA.line), border_radius: sides(L.radius.card),
    css_classes: 'ja-card',
    ...reveal(40 * (index % 5), 'container'),
  }))
  const closing = b.row([
    b.heading('Se você percebeu algum desses sinais, o primeiro passo é realizar um diagnóstico.', tweak(T.statement, { size: 24, tablet: 22, mobile: 20 }), JA.white, {
      ...FILL, ...maxw(640),
    }),
    quote(b),
  ], 32, {
    padding: sides(32, 40), padding_mobile: sides(24, 22),
    ...bg(JA.black), border_radius: sides(L.radius.card),
    flex_justify_content: 'space-between',
    flex_direction_tablet: 'column', flex_align_items_tablet: 'flex-start', flex_gap_tablet: { unit: 'px', size: 20, row: '20', column: '20', isLinked: true },
    ...reveal(0, 'container'),
  })
  const root = b.root([
    b.sectionHead({
      label: 'Sinais de alerta',
      title: 'Seu carro apresenta algum destes sinais?',
      lede: 'Alguns problemas no câmbio começam com pequenos sinais e podem evoluir com o tempo.',
    }),
    b.col([
      b.grid(signs, 'repeat(4, minmax(0,1fr))', [16, 16], {}, { tablet: 'repeat(2, minmax(0,1fr))', mobile: '1fr' }),
    ], 20),
    closing,
  ], {
    background: JA.paper, id: 'sinais', space: 44,
    css: techGrid('rgba(11,11,12,.045)', '100% 0%', 56),
  })
  return b.section('Júnior Automáticos · Sinais de problema', 'junior-sinais', root)
}

// ── diagnóstico ─────────────────────────────────────────────────────────────

const makeDiagnosis = (): SectionNodeData => {
  const b = createBuilder('jad')
  const intro = b.col([
    b.sectionHead({ label: 'Diagnóstico técnico', title: 'Antes de trocar peças, entenda o problema.', tone: 'dark', width: 560 }),
    b.text('Trancos ou falhas não significam, necessariamente, trocar o câmbio inteiro. O diagnóstico orienta o próximo passo.', T.lede, JA.onDark, { ...maxw(480), ...reveal(160) }),
    quote(b),
  ], 22)
  const panel = b.col([
    ...[
      ['fas fa-comment-dots', 'Você conta o que percebeu', 'Explique os sinais e quando eles aparecem.'],
      ['fas fa-search', 'Avaliamos a origem da falha', 'O veículo é avaliado para entender o problema.'],
      ['fas fa-tools', 'Indicamos o serviço adequado', 'A solução depende do que o diagnóstico identificar.'],
    ].map(([icon, title, text], index) => b.row([
      b.col([b.heading(`0${index + 1}`, tweak(T.card, { size: 14 }), JA.gold), b.badge(icon, 'dark')], 10, { width: px(56), ...FIXED }),
      b.col([b.heading(title, T.card, JA.white, { header_size: 'h3' }), b.text(text, T.small, JA.onDark)], 8),
    ], 20, { flex_align_items: 'center', padding: sides(20, 0), ...(index < 2 ? border(JA.lineDark, sides(0, 0, 1, 0)) : {}) })),
  ], 20, {
    padding: sides(40), padding_tablet: sides(32), padding_mobile: sides(24, 22),
    ...bg(JA.raised), ...border(JA.lineDark), border_radius: sides(L.radius.card),
    ...reveal(120, 'container'),
  })
  const root = b.root([
    b.grid([intro, panel], 'minmax(0,.95fr) minmax(0,1.05fr)', [40, 64], { grid_align_items: 'center' }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: JA.black, id: 'diagnostico',
    css: techGrid('rgba(255,255,255,.03)', '0% 100%', 64),
  })
  return b.section('Júnior Automáticos · Diagnóstico', 'junior-diagnostico', root)
}

// ── serviços ────────────────────────────────────────────────────────────────

const SERVICOS: Array<[string, string, string]> = [
  ['diagnostic', 'Diagnóstico', 'Entenda a origem da falha antes de definir o reparo.'],
  ['repair', 'Reparo do câmbio', 'Correção de falhas em câmbios automáticos e automatizados.'],
  ['shield', 'Manutenção preventiva', 'Cuidados para preservar o funcionamento do câmbio.'],
  ['oil', 'Troca de óleo', 'Fluido adequado às especificações do seu veículo.'],
  ['parts', 'Troca de peças', 'Substituição dos componentes necessários ao reparo.'],
  ['leak', 'Avaliação de vazamentos', 'Identificação da origem e orientação sobre o reparo.'],
]

const makeServices = (): SectionNodeData => {
  const b = createBuilder('jas')
  const cards = SERVICOS.map(([icon, title, copy], index) => b.card([
    drawing(b, icon),
    b.heading(title, T.card, JA.ink, { header_size: 'h3', _margin: sides(6, 0, 0, 0) }),
    b.text(copy, T.small, JA.body),
  ], 'light', reveal(60 * (index % 3), 'container')))
  const root = b.root([
    b.row([
      b.sectionHead({ label: 'Serviços', title: 'Nossos serviços' }, FILL),
      quote(b),
    ], 32, { flex_align_items: 'flex-end', flex_justify_content: 'space-between', flex_direction_tablet: 'column', flex_align_items_tablet: 'flex-start' }),
    b.grid(cards, 'repeat(3, minmax(0,1fr))', [18, 18], {}, { tablet: 'repeat(2, minmax(0,1fr))', mobile: '1fr' }),
  ], { background: JA.paper, id: 'servicos', space: 44 })
  return b.section('Júnior Automáticos · Serviços', 'junior-servicos', root)
}

// ── quem somos ──────────────────────────────────────────────────────────────

const DIFERENCIAIS: Array<[string, string, string]> = [
  ['fas fa-history', 'Mais de 40 anos de mercado', 'Uma história construída ao longo de décadas trabalhando com câmbios e transmissões.'],
  ['fas fa-cog', 'Especialização', 'Nosso foco está em câmbios automáticos e automatizados.'],
  ['fas fa-wrench', 'Conhecimento técnico', 'Experiência prática para diagnosticar diferentes tipos de falhas e problemas.'],
  ['fas fa-car', 'Diversas marcas', 'Trabalhamos com diferentes modelos de veículos.'],
  ['fas fa-clipboard-check', 'Diagnóstico completo', 'Antes de indicar o serviço, buscamos entender a origem do problema.'],
  ['fab fa-whatsapp', 'Atendimento direto', 'Fale com nossa equipe pelo WhatsApp e explique o que está acontecendo com o seu carro.'],
]

const makeAbout = (): SectionNodeData => {
  const b = createBuilder('jaq')
  const stat = b.row([
    b.heading('+40', T.stat, JA.gold, FIXED),
    b.heading('anos de história com câmbios e transmissões', tweak(T.strong, { size: 16, line: 1.35 }), JA.onDark, maxw(200)),
  ], 18, { _margin: sides(12, 0, 0, 0), ...reveal(200, 'container') })
  const head = b.col([
    b.sectionHead({ label: 'Quem somos', title: 'Nossa História', tone: 'dark' }),
    stat,
  ], 18)
  const story = b.col([
    b.text('<p>A história da Júnior Automáticos começou há cerca de 40 anos com o Sr. Júnior.</p><p>Hoje, a empresa segue sua trajetória familiar sob a gestão de Rafael, mantendo o conhecimento técnico e a experiência construídos ao longo de décadas de atuação.</p><p>Mais do que trabalhar com carros, construímos uma história de especialização em transmissões automáticas.</p>', T.lede, JA.onDark, reveal(120)),
    b.heading('Tradição, conhecimento técnico e experiência no mesmo lugar.', tweak(T.statement, { size: 22, tablet: 21, mobile: 19 }), JA.white, reveal(180)),
  ], 20)
  const cards = DIFERENCIAIS.map(([icon, title, copy], index) => b.card([
    b.badge(icon, 'dark'),
    b.heading(title, T.card, JA.white, { header_size: 'h3', _margin: sides(4, 0, 0, 0) }),
    b.text(copy, T.small, JA.onDark),
  ], 'dark', reveal(60 * (index % 3), 'container')))
  const root = b.root([
    b.grid([head, story], 'minmax(0,.9fr) minmax(0,1.1fr)', [32, 64], { grid_align_items: 'start' }, { tablet: '1fr', mobile: '1fr' }),
    b.grid(cards, 'repeat(3, minmax(0,1fr))', [18, 18], {}, { tablet: 'repeat(2, minmax(0,1fr))', mobile: '1fr' }),
    b.row([quote(b)], 0, { flex_justify_content: 'center' }),
  ], {
    background: JA.black, id: 'quem-somos', space: 48,
    css: techGrid('rgba(255,255,255,.03)', '100% 0%', 64),
  })
  return b.section('Júnior Automáticos · Quem somos', 'junior-quem-somos', root)
}

// ── dúvidas ─────────────────────────────────────────────────────────────────

const FAQ: Array<[string, string]> = [
  ['Vocês trabalham apenas com câmbio automático?', 'Somos especializados em câmbios automáticos e automatizados.'],
  ['Quais marcas vocês atendem?', 'Trabalhamos com veículos de diversas marcas. Atualmente, Jeep e Fiat estão entre as marcas com maior fluxo na oficina.'],
  ['Vocês fazem apenas reparos?', 'Não. Também trabalhamos com diagnóstico, manutenção preventiva, troca de óleo, avaliação de vazamentos e troca de peças.'],
  ['Meu carro está dando trancos. Preciso trocar o câmbio?', 'Não necessariamente. Existem diferentes causas possíveis. O ideal é realizar um diagnóstico antes de definir qualquer reparo.'],
  ['Vocês fazem manutenção preventiva?', 'Sim. A manutenção preventiva é uma forma de acompanhar as condições do câmbio e identificar possíveis necessidades de manutenção.'],
  ['Onde vocês estão localizados?', 'A Júnior Automáticos está em São José dos Campos, situado na Av. Ouro Fino, 2140 - Bosque dos Eucaliptos, e atende clientes de toda a região do Vale do Paraíba.'],
]

const makeFaq = (): SectionNodeData => {
  const b = createBuilder('jaf')
  const accordion = b.widget('nested-accordion', {
    items: FAQ.map(([question], index) => ({ item_title: question, _id: `jafq${index + 1}` })),
    default_state: 'all_collapsed',
    max_items_expended: 'multiple',
    n_accordion_animation_duration: { unit: 'ms', size: 300, sizes: [] },
    accordion_item_title_icon: { value: 'fas fa-plus', library: 'fa-solid' },
    accordion_item_title_icon_active: { value: 'fas fa-minus', library: 'fa-solid' },
    accordion_item_title_position_horizontal: 'stretch',
    ...typography(tweak(T.card, { size: 18, mobile: 17 }), 'title_typography'),
    normal_title_color: JA.ink, hover_title_color: JA.ink, active_title_color: JA.ink,
    normal_icon_color: JA.gold, hover_icon_color: JA.gold, active_icon_color: JA.black,
    _css_classes: 'ja-faq',
  })
  accordion.elements = FAQ.map(([, answer]) => b.col([
    b.text(answer, T.body, JA.body, maxw(640)),
  ], 0, { padding: sides(0, 24, 22, 24), padding_mobile: sides(0, 18, 18, 18) }))

  const root = b.root([
    b.grid([
      b.col([
        b.sectionHead({
          label: 'Dúvidas',
          title: 'Perguntas frequentes',
          lede: 'Não encontrou a sua dúvida? Fale com a nossa equipe pelo WhatsApp.',
        }),
        b.button('Falar no WhatsApp', jaWhatsApp('Olá! Tenho uma dúvida sobre o câmbio do meu carro.'), 'outline', { icon: 'fab fa-whatsapp', ...reveal(200) }),
      ], 24),
      accordion,
    ], 'minmax(0,.8fr) minmax(0,1.2fr)', [40, 56], { grid_align_items: 'start' }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: JA.paper, id: 'duvidas',
    css: [
      'selector .ja-faq .e-n-accordion{display:flex;flex-direction:column;gap:12px}',
      `selector .ja-faq .e-n-accordion-item{border:1px solid ${JA.line};border-radius:${L.radius.card}px;background:${JA.white};overflow:hidden}`,
      'selector .ja-faq .e-n-accordion-item-title{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 24px;border:0;border-radius:0;background:transparent;cursor:pointer;list-style:none}',
      'selector .ja-faq .e-n-accordion-item-title::-webkit-details-marker{display:none}',
      `selector .ja-faq .e-n-accordion-item-title-icon{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;flex:none;background:${JA.black};color:${JA.gold};line-height:1}`,
      'selector .ja-faq .e-n-accordion-item-title-icon i{font-size:14px!important;width:14px;text-align:center}selector .ja-faq .e-n-accordion-item-title-icon svg{width:14px;height:14px}',
      `selector .ja-faq .e-n-accordion-item[open]{border-color:${JA.gold}}selector .ja-faq .e-n-accordion-item[open] .e-n-accordion-item-title-icon{background:${JA.gold};color:${JA.black}}`,
      'selector .ja-faq .e-n-accordion-item>.e-con{border:0}',
      '@media(prefers-reduced-motion:no-preference){selector .ja-faq .e-n-accordion-item{transition:border-color 200ms ease}selector .ja-faq .e-n-accordion-item[open]>.e-con{animation:jaAnswerIn 220ms ease-out}@keyframes jaAnswerIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}}',
      '@media(max-width:767px){selector .ja-faq .e-n-accordion-item-title{padding:18px}}',
    ].join(''),
  })
  return b.section('Júnior Automáticos · Dúvidas', 'junior-duvidas', root)
}

// ── CTA final e contato ─────────────────────────────────────────────────────

const makeContact = (): SectionNodeData => {
  const b = createBuilder('jak')
  const info = b.col([
    b.sectionHead({ label: 'Contato', title: 'Há 40 anos, experiência faz diferença!', tone: 'dark', width: 560 }),
    b.text('Quando o assunto é câmbio automático, não entregue seu veículo para qualquer oficina. Conte com quem conhece esse sistema, trabalha com ele há décadas e está preparado para identificar o problema antes de indicar a solução.', T.body, JA.onDark, { ...maxw(560), ...reveal(160) }),
    b.list([
      { text: `WhatsApp: ${K.whatsappLabel}`, url: jaWhatsApp(), icon: 'fab fa-whatsapp' },
      { text: `E-mail: ${K.email}`, url: `mailto:${K.email}`, icon: 'far fa-envelope' },
      { text: `Instagram: @${K.instagram}`, url: jaInstagram, icon: 'fab fa-instagram' },
      { text: `${K.street}, ${K.district} – ${K.city}`, url: jaDirections, icon: 'fas fa-map-marker-alt' },
      { text: 'Atendimento em São José dos Campos e Região', icon: 'fas fa-route' },
    ], {
      space_between: px(16), icon_size: px(17), text_indent: px(12), icon_color: JA.gold,
      text_color: JA.white, text_color_hover: JA.gold,
      ...typography(T.list, 'icon_typography'),
      _css_classes: 'ja-contact-list', ...reveal(200),
    }),
    b.row([
      quote(b),
      b.button('Como chegar', jaDirections, 'outlineLight', { icon: 'fas fa-map-marker-alt', ...FIXED }),
    ], 12, { flex_wrap: 'wrap', _margin: sides(6, 0, 0, 0), ...reveal(240, 'container') }),
  ], 26)
  const map = b.col([
    b.widget('google_maps', { address: K.maps, zoom: { unit: 'px', size: 16, sizes: [] }, height: px(480), height_tablet: px(400), height_mobile: px(320) }),
  ], 0, {
    ...border(JA.lineDark), border_radius: sides(L.radius.card), css_classes: 'ja-map', ...reveal(120, 'container'),
  })
  const root = b.root([
    b.grid([info, map], 'minmax(0,1fr) minmax(0,1fr)', [40, 56], { grid_align_items: 'center' }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: JA.black, id: 'contato',
    css: [
      techGrid('rgba(255,255,255,.03)', '0% 0%', 64),
      'selector .ja-map{overflow:hidden}selector .ja-map iframe{display:block;width:100%;border:0}',
      'selector .ja-contact-list .elementor-icon-list-icon i{width:20px;text-align:center}',
      'selector .ja-contact-list .elementor-icon-list-text{overflow-wrap:anywhere}',
    ].join(''),
  })
  return b.section('Júnior Automáticos · Contato', 'junior-contato', root)
}

// ── rodapé ──────────────────────────────────────────────────────────────────

const makeFooter = (): SectionNodeData => {
  const b = createBuilder('jaz')
  const title = (label: string) => b.heading(label, T.eyebrow, JA.gold, { header_size: 'h3', _margin: sides(0, 0, 16, 0) })
  const links = (items: Array<{ text: string; url?: string; icon?: string }>) => b.list(items, {
    space_between: px(10), icon_size: px(15), text_indent: px(items.some((i) => i.icon) ? 10 : 0), icon_color: JA.gold,
    text_color: JA.onDark, text_color_hover: JA.gold,
    ...typography(tweak(T.list, { size: 15 }), 'icon_typography'),
    _css_classes: 'ja-footer-list',
  })
  const first = b.col([
    logo(b, 56, { align: 'left' }),
    b.text('Especialistas em câmbio automático. Diagnóstico, manutenção e reparo de câmbios automáticos e automatizados em São José dos Campos e região.', T.small, JA.onDark, maxw(340)),
  ], 20)
  const main = b.grid([
    first,
    b.col([title('Navegação'), links(NAV.map(([text, url]) => ({ text, url })))]),
    b.col([title('Atendimento'), links([
      { text: K.whatsappLabel, url: jaWhatsApp(), icon: 'fab fa-whatsapp' },
      { text: K.email, url: `mailto:${K.email}`, icon: 'far fa-envelope' },
      { text: `@${K.instagram}`, url: jaInstagram, icon: 'fab fa-instagram' },
      { text: `${K.street}, ${K.district} – ${K.city}`, url: jaDirections, icon: 'fas fa-map-marker-alt' },
    ])]),
  ], 'minmax(0,1.3fr) minmax(0,.7fr) minmax(0,1fr)', [32, 40], {}, { tablet: 'repeat(2, minmax(0,1fr))', mobile: '1fr' })
  const bottom = b.row([
    b.text(`Copyright 2026 © ${BRAND}. Todos os direitos reservados.`, tweak(T.small, { size: 14 }), JA.mutedDark),
    b.heading('Voltar ao topo ↑', tweak(T.strong, { size: 14 }), JA.white, { link: link('#inicio'), title_hover_color: JA.gold, ...FIXED }),
  ], 16, { flex_justify_content: 'space-between', flex_wrap: 'wrap', padding: sides(24, 0, 0, 0), ...border(JA.lineDark, sides(1, 0, 0, 0)) })
  const root = b.root([main, bottom], {
    background: JA.deep, tag: 'footer', space: 40, pad: [64, 56, 48],
    settings: border(JA.lineDark, sides(1, 0, 0, 0)),
    css: 'selector .ja-footer-list .elementor-icon-list-icon i{width:16px;text-align:center}selector .ja-footer-list .elementor-icon-list-text{overflow-wrap:anywhere}',
  })
  return b.section('Júnior Automáticos · Rodapé', 'junior-rodape', root)
}

// ── WhatsApp flutuante ──────────────────────────────────────────────────────

const makeWhatsApp = (): SectionNodeData => {
  const b = createBuilder('jaw')
  const button = b.widget('button', {
    text: 'Falar no WhatsApp', size: 'md',
    link: link(jaWhatsApp(), true),
    selected_icon: { value: 'fab fa-whatsapp', library: 'fa-brands' }, icon_align: 'left', icon_indent: px(0),
    ...typography(T.button),
    // sem fundo nem borda nativos: a marca trataria o botão como o dourado; o verde vem do CSS
    text_padding: sides(0), border_radius: sides(999),
    background_color: 'rgba(255,255,255,0)', button_text_color: JA.white,
    button_background_hover_color: 'rgba(255,255,255,0)', hover_color: JA.white,
    _css_classes: 'ja-wa',
  })
  const root = b.root([button], {
    background: 'transparent', tag: 'div', pad: false,
    settings: { css_classes: 'ja-wa-dock' },
    css: [
      // preso no canto, acima do cabeçalho (50)
      'selector{position:fixed!important;right:24px;bottom:24px;left:auto;top:auto;z-index:900;width:auto!important;max-width:none;padding:0!important;background:transparent!important;overflow:visible}',
      'selector>.e-con-inner{width:auto;max-width:none;padding:0}',
      // o verde do WhatsApp só no círculo; a sombra separa do preto e do papel
      `selector .ja-wa .elementor-button{width:60px;height:60px;min-height:60px;padding:0!important;border-radius:50%;background:${JA.whatsapp};color:${JA.white};box-shadow:0 2px 4px rgba(0,0,0,.2),0 12px 28px -8px rgba(0,0,0,.5)}`,
      'selector .ja-wa .elementor-button:hover{background:#1FBF5B;color:#FFFFFF}',
      'selector .ja-wa .elementor-button-content-wrapper{gap:0!important}selector .ja-wa .elementor-button-icon{margin:0}selector .ja-wa .elementor-button-icon i{font-size:30px}selector .ja-wa .elementor-button-icon svg{width:30px;height:30px}',
      // o texto some da tela mas continua para o leitor de tela
      'selector .ja-wa .elementor-button-text{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
      '@media(prefers-reduced-motion:no-preference){@keyframes jaWaIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}selector{animation:jaWaIn 360ms cubic-bezier(.2,.7,.2,1) 700ms both}}',
      '@media(max-width:767px){selector{right:16px;bottom:16px}selector .ja-wa .elementor-button{width:56px;height:56px;min-height:56px}}',
    ].join(''),
  })
  return b.section('Júnior Automáticos · WhatsApp flutuante', 'junior-whatsapp', root)
}

export const createJuniorTemplate = (): LandingTemplate => ({
  id: 'junior-automaticos-home',
  name: 'Oficina de câmbio · Júnior Automáticos',
  description: 'Landing page da oficina de câmbio automático: sinais de problema, diagnóstico, serviços, história, dúvidas, contato com mapa e orçamento pelo WhatsApp.',
  audience: 'Júnior Automáticos',
  sections: [
    makeHeader(), makeHero(), makeBrands(), makeProblem(), makeDiagnosis(), makeServices(), makeAbout(), makeFaq(), makeContact(), makeFooter(), makeWhatsApp(),
  ],
})
