import type { SectionNodeData } from '@/types/space'
import type { LandingTemplate } from './landingTemplates'
import { PROCESSBASE_GRAPH_SCRIPT } from './processbaseGraph'
import { EMBLEM_PIECES } from '@/features/processbase/emblem'
import { PROCESSBASE_EMBLEM_SCRIPT } from '@/features/processbase/emblem3d'
import { PROCESSBASE_MODAL_SCRIPT } from '@/features/processbase/modal'
import { PROCESSBASE_STORY_SCRIPT } from '@/features/processbase/story'
import {
  ARROW, bg, border, createBuilder, FIXED, fluid, gap, hl, link, maxw, pct, px, reveal, RING_CSS, sides, T, texture, tweak, typography,
  type PBBuilder, type Tone,
} from '@/features/processbase/elementor'
import { PB, PB_CONTACT, PB_EASE, PB_FONT, PB_LAYOUT as L, pbWhatsApp } from '@/features/processbase/tokens'

/**
 * Home da ProcessBase em containers e widgets nativos do Elementor, com os
 * tokens de brands/processbase/DESIGN.md e a copy do vault do projeto
 * (brands/processbase/COPY.md). Os cards seguem a moldura dupla do protótipo
 * da landing: casca fina, miolo com raio de 16px, cabeçalho de painel.
 * Exceções HTML: o menu do celular e o grafo animado do hero.
 */

type JsonRecord = Record<string, unknown>

const NAV_LINKS: Array<[string, string]> = [
  ['Método Base', '#metodo'],
  ['O que muda', '#o-que-muda'],
  ['Como funciona', '#como-funciona'],
  ['O que fica', '#o-que-fica'],
  ['Especialista', '#quem-conduz'],
  ['Dúvidas', '#duvidas'],
]
const CTA = { label: 'Agendar diagnóstico', url: '#contato' }
/** Navbar de vidro: navy a 82%; menos que isso, sobre as seções brancas ele vira um cinza. */
const NAV_GLASS = 'rgba(23,26,44,0.82)'

/** Listas de texto: traço, visto ou xis em laranja; filete entre os itens. */
const LIST_CSS = (rule: string) => [
  'selector .pb-list ul{list-style:none;margin:0;padding:0}',
  `selector .pb-list li{position:relative;padding:12px 0 12px 24px;border-bottom:1px solid ${rule}}`,
  'selector .pb-list li:last-child{border-bottom:0}',
  'selector .pb-list li::before,selector .pb-list li::after{content:"";position:absolute;left:0;background:transparent}',
  `selector .pb-list--dash li::before{top:calc(12px + .72em);width:10px;height:2px;background:${PB.orange}}`,
  `selector .pb-list--check li::before{top:calc(12px + .38em);width:10px;height:5px;border-left:1.5px solid ${PB.orange};border-bottom:1.5px solid ${PB.orange};transform:rotate(-45deg)}`,
  `selector .pb-list--cross li::before,selector .pb-list--cross li::after{top:calc(12px + .72em);width:11px;height:1.5px;background:${PB.slate};transform:rotate(45deg)}`,
  'selector .pb-list--cross li::after{transform:rotate(-45deg)}',
].join('')

const list = (b: PBBuilder, items: string[], kind: 'dash' | 'check' | 'cross', color: string, options: JsonRecord = {}) =>
  b.text(`<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`, T.body, color, { _css_classes: `pb-list pb-list--${kind}`, ...options })

// ── navegação ───────────────────────────────────────────────────────────────

const MENU_CSS = `
selector .pb-menu{position:relative}
selector .pb-menu summary{list-style:none;display:flex;flex-direction:column;justify-content:center;gap:6px;width:40px;height:40px;padding:0 11px;box-sizing:border-box;border:1px solid rgba(130,154,175,.32);border-radius:8px;cursor:pointer;transition:border-color 200ms ${PB_EASE}}
selector .pb-menu summary::-webkit-details-marker{display:none}
selector .pb-menu summary span{display:block;height:1.5px;border-radius:1px;background:${PB.white};transition:transform 240ms ${PB_EASE}}
selector .pb-menu[open] summary{border-color:rgba(255,255,255,.6)}
selector .pb-menu[open] summary span:first-child{transform:translateY(3.75px) rotate(45deg)}
selector .pb-menu[open] summary span:last-child{transform:translateY(-3.75px) rotate(-45deg)}
selector .pb-menu-panel{position:absolute;top:calc(100% + 22px);right:0;width:min(300px,calc(100vw - 40px));display:flex;flex-direction:column;padding:8px;box-sizing:border-box;background:${PB.navy};border:1px solid rgba(130,154,175,.22);border-radius:16px;font-family:${PB_FONT},sans-serif}
selector .pb-menu-panel a{padding:12px 14px;border-radius:8px;color:rgba(255,255,255,.78);font-size:15px;line-height:1.3;text-decoration:none}
selector .pb-menu-panel a:hover{color:${PB.white};background:rgba(255,255,255,.06)}
selector .pb-menu-panel .pb-menu-cta{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:8px;font-weight:600;color:${PB.white};background:${PB.orange}}
selector .pb-menu-panel .pb-menu-cta:hover{color:${PB.white};background:${PB.orangeHover}}
selector .pb-menu-cta i{font-size:.85em}
@media(prefers-reduced-motion:no-preference){selector .pb-menu-cta i{transition:transform 200ms ${PB_EASE}}selector .pb-menu-cta:hover i{transform:translateX(3px)}}
@keyframes pbMenuIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
selector .pb-menu[open] .pb-menu-panel{animation:pbMenuIn 220ms ${PB_EASE}}
@media(prefers-reduced-motion:reduce){selector .pb-menu[open] .pb-menu-panel{animation:none}selector .pb-menu summary span{transition:none}}
`

// O menu do celular copia os links e o botão do menu principal, então basta
// editar os itens da lista e o botão no Elementor.
const MENU_SCRIPT = `
(function () {
  [].forEach.call(document.querySelectorAll('.pb-menu:not([data-pb-ready])'), function (menu) {
    menu.setAttribute('data-pb-ready', '1');
    var panel = menu.querySelector('.pb-menu-panel'), cta = panel.querySelector('.pb-menu-cta');
    var nav = menu.closest('.pb-nav');
    var links = nav ? nav.querySelectorAll('.pb-nav-links a') : [];
    if (links.length) {
      [].forEach.call(panel.querySelectorAll('a:not(.pb-menu-cta)'), function (a) { a.remove(); });
      [].forEach.call(links, function (link) {
        var a = document.createElement('a');
        a.href = link.getAttribute('href');
        a.textContent = link.textContent.trim();
        panel.insertBefore(a, cta);
      });
    }
    var button = nav && nav.querySelector('.pb-nav-cta a.elementor-button');
    if (button && cta) {
      cta.href = button.getAttribute('href') || cta.href;
      var label = cta.querySelector('span') || cta;
      label.textContent = button.textContent.trim() || label.textContent;
    }
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) menu.open = false; });
    document.addEventListener('click', function (e) { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !menu.open) return;
      menu.open = false;
      menu.querySelector('summary').focus();
    });
  });
})();
`

const makeNavbar = (): SectionNodeData => {
  const b = createBuilder('pbn')
  const menuHtml = `<details class="pb-menu"><summary aria-label="Abrir menu"><span></span><span></span></summary><nav class="pb-menu-panel" aria-label="Menu">${
    NAV_LINKS.map(([label, url]) => `<a href="${url}">${label}</a>`).join('')
  }<a class="pb-menu-cta" href="${CTA.url}"><span>${CTA.label}</span><i class="fas fa-arrow-right" aria-hidden="true"></i></a></nav></details><script>${MENU_SCRIPT}</script>`

  const logo = b.image('logo/processbase-logo-reverse.svg', 'ProcessBase', {
    align: 'left', link_to: 'custom', link: link('#inicio'), _css_classes: 'pb-nav-logo',
    custom_css: 'selector{justify-self:start}selector a{display:inline-block}selector img{display:block;height:26px;width:auto}@media(max-width:767px){selector img{height:22px}}',
  })
  const links = b.widget('icon-list', {
    view: 'inline', link_click: 'inline',
    icon_list: NAV_LINKS.map(([text, url], index) => ({ _id: `pbl${index}`, text, link: { url }, selected_icon: { value: '', library: '' } })),
    space_between: px(32), space_between_tablet: px(24),
    // um pouco mais claro que o texto corrido: o vidro deixa passar fundo branco
    text_color: 'rgba(255,255,255,0.82)', text_color_hover: PB.white,
    icon_typography_typography: 'custom', icon_typography_font_family: PB_FONT, icon_typography_font_size: px(14), icon_typography_font_weight: '400',
    hide_tablet: 'hidden-tablet', hide_mobile: 'hidden-mobile',
    _css_classes: 'pb-nav-links',
  })
  const actions = b.row([
    b.button(CTA.label, CTA.url, 'outline', 'sm', { hide_mobile: 'hidden-mobile', _css_classes: 'pb-nav-cta' }),
    b.widget('html', { html: menuHtml, hide_desktop: 'hidden-desktop', _css_classes: 'pb-nav-menu' }),
  ], 12, { flex_justify_content: 'flex-end', css_classes: 'pb-nav-actions' })

  const root = b.root([logo, links, actions], {
    background: NAV_GLASS, tag: 'header', pad: false,
    settings: {
      container_type: 'grid',
      grid_columns_grid: fluid('1fr auto 1fr'),
      grid_columns_grid_tablet: fluid('1fr auto'),
      grid_columns_grid_mobile: fluid('1fr auto'),
      grid_rows_grid: fluid('auto'),
      grid_gaps: gap(24), grid_align_items: 'center',
      padding: sides(14, L.gutter.desktop), padding_tablet: sides(14, L.gutter.tablet), padding_mobile: sides(14, L.gutter.mobile),
      ...border('rgba(255,255,255,0.08)', sides(0, 0, 1, 0)),
      z_index: 100,
      css_classes: 'pb-nav',
      // Pro: fixa com o JS do Elementor; o position:sticky abaixo cobre o motor e o Free.
      sticky: 'top', sticky_on: ['desktop', 'tablet', 'mobile'], sticky_offset: 0,
    },
    css: `
selector{position:sticky;top:0;min-height:${L.nav}px}
/* vidro: o navbar fica por cima do hero (margem negativa) e desfoca o que passa atrás */
selector{margin-bottom:-${L.nav}px;-webkit-backdrop-filter:saturate(1.4) blur(16px);backdrop-filter:saturate(1.4) blur(16px)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){selector{background-color:${PB.navy}!important}}
selector .pb-nav-links .elementor-icon-list-items{flex-wrap:nowrap;white-space:nowrap}
${MENU_CSS}`,
  })
  return b.section('ProcessBase · Navbar fixo', 'processbase-navbar-v2', root)
}

// ── hero e método base ──────────────────────────────────────────────────────

interface Pillar { n: string; name: string; promise: string; steps: string[]; output: string }

const PILLARS: Pillar[] = [
  {
    n: '01', name: 'Cultura e pessoas',
    promise: 'A estrutura começa sabendo quem faz o quê, e por quê.',
    steps: ['Perfil comportamental da equipe', 'Cultura de hoje e cultura desejada', 'Organograma e descrição de cargos', 'Missão, visão e valores'],
    output: 'Organograma, cargos e responsabilidades',
  },
  {
    n: '02', name: 'Processos',
    promise: 'O jeito certo de fazer deixa de morar na cabeça de alguém.',
    steps: ['Macroprocessos e prioridades', 'Mapeamento com quem executa', 'Procedimentos e checklists', 'Gestão diária e semanal de 15 minutos'],
    output: 'Processos padronizados e gestão à vista',
  },
  {
    n: '03', name: 'Treinamentos',
    promise: 'Quem aprende também aprende a ensinar.',
    steps: ['Integração na cultura da empresa', 'Treinamento dos processos mapeados', 'Pontos críticos de cada entrega', 'Treinar os treinadores'],
    output: 'Trilhas de treinamento e treinadores internos',
  },
  {
    n: '04', name: 'Planejamento estratégico',
    promise: 'A rotina passa a responder a uma direção maior.',
    steps: ['Forças, fraquezas, ameaças e oportunidades', 'Prioridades da empresa', 'Plano de ação', 'Horizonte de até 3 anos'],
    output: 'Direção estratégica e plano de ação',
  },
]

/** Casca dos cards empilhados: a ardósia translúcida da moldura já chapada no navy, para o card de baixo não vazar. */
const STACK_SHELL = '#1F2335'
/** Onde cada card prende: abaixo do navbar, com a borda dos anteriores aparecendo. */
const STACK_TOP = (index: number) => L.nav + 40 + index * 16
const STACK_TOP_MOBILE = (index: number) => L.nav + 148 + index * 10

/**
 * Hero e Método Base num container só, porque o fundo é um só: o grafo do
 * hero fica preso na tela e, com o scroll, as ideias viajam até formar o
 * logo da segunda dobra (processbaseGraph + story, com GSAP). Depois, cada
 * card de pilar sobe por cima do anterior e acende a peça dele no logo, no
 * sentido horário, até o logo inteiro ficar laranja. O logo nasce reto e,
 * antes dos pilares, gira até virar um bloco em isometria 2:1 (emblem3d). Os widgets HTML são só o céu e o bloco, os dois
 * canvas com os scripts; cards, legenda e textos são nativos.
 */
const makeHero = (): SectionNodeData => {
  const b = createBuilder('pbh')
  const sky = b.widget('html', {
    html: `<div class="pb-sky" aria-hidden="true"><canvas class="pb-graph" data-line="${PB.slate}" data-accent="${PB.orange}"></canvas></div><script>${PROCESSBASE_GRAPH_SCRIPT}</script><script>${PROCESSBASE_STORY_SCRIPT}</script>`,
    _css_classes: 'pb-hero-graph',
  })

  // primeira dobra, centrada: o resultado que o dono quer, o que fica na empresa
  // e quem conduz. O grafo aparece em volta, mais apagado atrás do texto.
  const content = b.col([
    b.heading('Sistemas de crescimento operacional', T.eyebrow, PB.slate, { align: 'center', ...reveal(0) }),
    b.heading(`Sua empresa pode dar certo<br>${hl('com ou sem você por perto.')}`, tweak(T.hero, { size: 80, tablet: 60, mobile: 42, line: 1.04 }), PB.white, {
      header_size: 'h1', align: 'center', _css_classes: 'pb-hero-title', ...reveal(80),
    }),
    b.text('Em 6 a 12 meses, o Método Base organiza cultura, processos, treinamentos e planejamento com a sua equipe. No fim, o jeito certo de fazer está documentado, a empresa tem quem ensine e um plano de três anos.', T.lede, PB.onNavy, {
      align: 'center', ...maxw(660), _css_classes: 'pb-hero-lede', ...reveal(160),
    }),
    b.row([
      b.button(CTA.label, CTA.url, 'primary', 'md', { align_mobile: 'justify' }),
      b.button('Conhecer o Método Base', '#metodo', 'outline', 'md', { align_mobile: 'justify' }),
    ], 12, {
      flex_justify_content: 'center', flex_direction_mobile: 'column', flex_align_items_mobile: 'stretch',
      margin: sides(12, 0, 0, 0), css_classes: 'pb-hero-actions', ...reveal(240, 'container'),
    }),
    // quem conduz, com rosto: a prova fica ao lado da promessa
    b.row([
      b.image('photos/gian-bianchin-machado.png', 'Gian Bianchin Machado', { _css_classes: 'pb-avatar', ...FIXED }),
      b.col([
        b.heading('Conduzido por Gian Bianchin Machado', tweak(T.small, { weight: 500 }), PB.white),
        b.heading('Engenheiro de produção, oito anos de melhoria contínua na indústria', T.small, PB.slate),
      ], 2, { width: fluid('auto') }),
    ], 14, {
      width: fluid('auto'), flex_justify_content: 'center',
      padding: sides(20, 0, 0, 0), margin: sides(8, 0, 0, 0), ...border(PB.line, sides(1, 0, 0, 0)),
      css_classes: 'pb-hero-proof', ...reveal(320, 'container'),
    }),
  ], 28, { flex_align_items: 'center', flex_gap_mobile: gap(22), css_classes: 'pb-hero-content' })

  const hero = b.col([content], 0, {
    flex_align_items: 'center',
    // o navbar de vidro fica por cima: o respiro de cima soma a altura dele
    padding: sides(120 + L.nav, 0, 64, 0), padding_tablet: sides(88 + L.nav, 0, 48, 0), padding_mobile: sides(56 + L.nav, 0, 32, 0),
    css_classes: 'pb-fold pb-hero-fold',
  })

  // segunda dobra: o logo formado pelas ideias à esquerda, os pilares empilhando à direita.
  // O logo é desenhado no canvas: reto, depois um bloco deitado; a legenda embaixo acende junto com cada peça.
  const emblem = b.widget('html', {
    html: `<canvas class="pb-emblem-canvas" aria-hidden="true"></canvas><script>${PROCESSBASE_EMBLEM_SCRIPT}</script>`,
    _css_classes: 'pb-emblem',
  })
  const legend = b.grid(EMBLEM_PIECES.map((piece, index) => b.col([
    b.heading(String(index + 1).padStart(2, '0'), T.num, PB.slate),
    b.heading(piece.pillar, T.small, PB.slate),
  ], 4, { padding: sides(14, 0, 0, 0), css_classes: `pb-pillar-label pb-pillar-label--${index + 1}` })), 'repeat(4,minmax(0,1fr))', [20, 16], {
    css_classes: 'pb-legend',
  }, { tablet: 'repeat(2,minmax(0,1fr))' })
  const logo = b.col([
    b.col([emblem, legend], 40, { css_classes: 'pb-story-signature' }),
  ], 0, { flex_align_items: 'center', css_classes: 'pb-story-logo' })

  const card = (pillar: Pillar, index: number) => b.frame([
    b.panelHead(`Pilar ${pillar.n}`, `${pillar.n} / 04`, 'dark'),
    b.col([
      b.heading(pillar.name, tweak(T.sub, { size: 32, tablet: 28, mobile: 24 }), PB.white, { header_size: 'h3' }),
      b.text(pillar.promise, T.body, PB.onNavy, { _margin: sides(12, 0, 0, 0) }),
      b.text(`<ul>${pillar.steps.map((step) => `<li>${step}</li>`).join('')}</ul>`, T.small, PB.onNavy, { _css_classes: 'pb-steps', _margin: sides(24, 0, 0, 0) }),
      b.col([
        b.heading('Fica na empresa', T.micro, PB.slate),
        b.heading(pillar.output, tweak(T.body, { weight: 500, line: 1.4 }), PB.white),
      ], 6, { padding: sides(20, 0, 0, 0), margin: sides(24, 0, 0, 0), ...border(PB.line, sides(1, 0, 0, 0)) }),
    ], 0, { padding: sides(32), padding_mobile: sides(22, 20) }),
  ], 'dark', {}, { ...bg(STACK_SHELL), css_classes: `pb-frame pb-stack-card pb-stack-card--${index + 1}` })

  const stack = b.col([
    ...PILLARS.map(card),
    b.container({ css_classes: 'pb-stack-tail' }),
  ], 200, { flex_gap_tablet: gap(180), flex_gap_mobile: gap(160), css_classes: 'pb-stack' })

  const method = b.col([
    b.sectionHead({
      label: 'Método Base', tone: 'dark',
      title: `Uma sequência. Quatro pilares. Uma empresa ${hl('mais capaz de funcionar.')}`,
      lede: 'Não é uma lista de ferramentas. É um sistema: cada pilar prepara o próximo e deixa algo concreto dentro da operação.',
    }, { css_classes: 'pb-head pb-story-head' }),
    logo,
    stack,
  ], 40, {
    flex_gap_mobile: gap(24),
    padding: sides(64, 0, L.section.desktop, 0), padding_tablet: sides(56, 0, L.section.tablet, 0), padding_mobile: sides(48, 0, L.section.mobile, 0),
    _element_id: 'metodo', css_classes: 'pb-fold pb-story-fold',
  })

  const root = b.root([sky, hero, method], {
    background: PB.navy, id: 'inicio', pad: false,
    settings: { css_classes: 'pb-story' },
    css: [
      'selector{isolation:isolate}',
      // holofote ardósia no alto, atrás da headline (o spotlight dos fundos da biblioteca)
      'selector{background-image:radial-gradient(1000px 560px at 50% 0,rgba(130,154,175,.16),transparent 70%)}',
      // o céu cobre a seção inteira; o canvas tem a altura da tela e fica preso no topo
      'selector .pb-hero-graph{position:absolute!important;inset:0;width:auto!important;max-width:none!important;margin:0!important;z-index:0;pointer-events:none;opacity:.7}',
      'selector .pb-sky{position:absolute;inset:0}',
      'selector .pb-graph{position:sticky;top:0;display:block;width:100%;height:100vh}',
      'selector .pb-fold{position:relative;z-index:1}',
      'selector .pb-hero-content{width:min(100%,1080px)}',
      // a prova de quem conduz, separada dos botões por um filete curto
      // avatar redondo, recortado no rosto; contorno claro de 1px sobre o navy
      'selector .pb-hero-proof{max-width:100%}selector .pb-hero-proof .e-con{min-width:0}',
      'selector .pb-hero-lede p{text-wrap:pretty}',
      'selector .pb-avatar{width:48px;height:48px;border-radius:50%;overflow:hidden;outline:1px solid rgba(255,255,255,.12);outline-offset:-1px}',
      // a foto é o Gian inteiro: amplia 2,7× e leva o rosto (61,5% 21% da foto) ao centro do círculo (50% − 2,7 × ponto)
      'selector .pb-avatar img{display:block;width:48px;height:48px;object-fit:cover;transform-origin:0 0;transform:translate(-116.05%,-6.7%) scale(2.7)}',
      `selector .pb-story-fold{scroll-margin-top:${L.nav}px}`,
      // desktop: o logo ocupa a coluna esquerda desde o topo da seção, ao lado do
      // título; título e cards ficam à direita. No celular, título, logo e cards em coluna.
      '@media(min-width:768px){selector .pb-story-fold{display:grid;grid-template-columns:minmax(0,42fr) minmax(0,58fr);grid-template-areas:"logo head" "logo stack";column-gap:88px;row-gap:40px;align-items:start}selector .pb-story-head{grid-area:head}selector .pb-story-logo{grid-area:logo}selector .pb-stack{grid-area:stack}}',
      '@media(min-width:768px) and (max-width:1024px){selector .pb-story-fold{column-gap:48px}}',
      // preso, o logo fica na altura dos cards
      `selector .pb-story-logo{position:sticky;top:${STACK_TOP(0)}px;z-index:2}`,
      'selector .pb-story-signature{width:min(100%,460px)}',
      // quadrado: cabe o logo reto e o bloco deitado sem mudar o layout no giro
      'selector .pb-emblem{width:100%}selector .pb-emblem-canvas{display:block;width:100%;aspect-ratio:1}',
      // legenda: o pilar que entra ganha o filete laranja e o texto branco
      `selector .pb-pillar-label{border-top:2px solid ${PB.lineStrong}}`,
      `@media(prefers-reduced-motion:no-preference){selector .pb-pillar-label{transition:border-color 200ms ${PB_EASE}}selector .pb-pillar-label .elementor-heading-title{transition:color 200ms ${PB_EASE}}}`,
      `selector .pb-pillar-label.is-on{border-top-color:${PB.orange}}selector .pb-pillar-label.is-on .elementor-heading-title{color:${PB.white}}`,
      'selector .pb-stack{min-width:0}',
      'selector .pb-stack-tail{height:40vh}',
      'selector .pb-stack-card{position:sticky;transform-origin:50% 0}',
      ...PILLARS.map((_, index) => `selector .pb-stack-card--${index + 1}{top:${STACK_TOP(index)}px}`),
      // o card de baixo recua escurecendo, sem sombra (DESIGN.md)
      `selector .pb-stack-card::after{content:"";position:absolute;inset:0;border-radius:${L.radius.shell}px;background:${PB.navy};opacity:var(--pb-dim,0);pointer-events:none}`,
      'selector .pb-steps ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px}',
      `selector .pb-steps li{position:relative;padding:9px 0 9px 18px;border-top:1px solid ${PB.line}}`,
      `selector .pb-steps li::before{content:"";position:absolute;left:0;top:calc(9px + .72em);width:8px;height:2px;background:${PB.orange}}`,
      '@media(max-width:1024px){selector .pb-steps ul{grid-template-columns:1fr}}',
      // celular: o logo vira uma faixa presa no alto e os cards prendem logo abaixo
      [
        '@media(max-width:767px){',
        'selector .pb-hero-actions,selector .pb-hero-actions > .elementor-widget-button{width:100%}',
        `selector .pb-story-logo{top:${L.nav}px;padding:10px 0}`,
        'selector .pb-story-signature{width:120px}selector .pb-legend{display:none}selector .pb-stack-card .pb-panel-head{display:none}',
        ...PILLARS.map((_, index) => `selector .pb-stack-card--${index + 1}{top:${STACK_TOP_MOBILE(index)}px}`),
        'selector .pb-steps li{padding:7px 0 7px 18px}selector .pb-steps li::before{top:calc(7px + .72em)}',
        '}',
        // tela baixa demais para um card inteiro preso: os cards rolam, o logo segue preso e acendendo
        '@media(max-width:767px) and (max-height:640px){selector .pb-stack-card{position:relative;top:auto}}',
      ].join(''),
    ].join(''),
  })
  return b.section('ProcessBase · Hero e Método Base', 'processbase-hero-v3', root)
}

// ── como funciona ───────────────────────────────────────────────────────────

const STEPS: Array<[string, string, string]> = [
  ['Conversa de diagnóstico', 'Entendemos o momento da empresa, o que trava o crescimento e quais etapas do método entram no projeto.', 'Início'],
  ['Método Base, pilar a pilar', 'Apresentação para a equipe, perfil comportamental e os quatro pilares em sequência, em reuniões presenciais ou híbridas.', '6 a 12 meses'],
  ['Estrutura em uso', 'Rituais curtos de gestão, documentação e treinadores internos mantêm o ritmo quando o projeto termina.', 'Depois'],
]

const makeComoFunciona = (): SectionNodeData => {
  const b = createBuilder('pbc')
  const card = ([title, copy, tag]: [string, string, string], index: number) => b.frame([
    b.col([
      b.row([
        b.heading(String(index + 1).padStart(2, '0'), { size: 44, tablet: 40, mobile: 36, line: 1, letter: -0.04 }, PB.ink, FIXED),
        b.heading(tag, tweak(T.micro, { size: 10, weight: 700, letter: 0.16 }), PB.ink, { ...FIXED, _css_classes: 'pb-tag' }),
      ], 12, { flex_justify_content: 'space-between', flex_align_items: 'flex-start' }),
      b.heading(title, T.card, PB.ink, { header_size: 'h3', _margin: sides(40, 0, 12, 0), _margin_mobile: sides(28, 0, 10, 0) }),
      b.text(copy, T.body, PB.body),
      // o primeiro passo já é o convite: o botão leva ao formulário
      ...(index === 0 ? [b.button(CTA.label, CTA.url, 'primary', 'sm', { _margin: sides(24, 0, 0, 0) })] : []),
    ], 0, { padding: sides(28), padding_mobile: sides(24, 20) }),
  ], 'light', {}, reveal(index * 80, 'container', 'fadeIn'))

  const root = b.root([
    b.sectionHead({
      label: 'Como funciona', tone: 'light',
      title: `Do diagnóstico ${hl('à rotina', 'light')}, reunião a reunião.`,
      lede: 'Cada projeto é desenhado para a necessidade da empresa. O ritmo é sempre o mesmo: entender, estruturar e deixar a estrutura funcionando sem depender de uma pessoa.',
    }),
    b.grid(STEPS.map(card), 'repeat(3,minmax(0,1fr))', 20, { margin: sides(56, 0, 0, 0), css_classes: 'pb-journey' }, { tablet: '1fr', mobile: '1fr' }),
    b.row([
      b.text('Conforme o porte da empresa, o projeto também inclui controles de produção, como indicadores de OEE e cronoanálise.', T.body, PB.body, { _css_classes: 'pb-note' }),
    ], 0, { padding: sides(24, 0, 0, 0), margin: sides(32, 0, 0, 0), ...border(PB.border, sides(1, 0, 0, 0)) }),
  ], {
    background: PB.mist, id: 'como-funciona',
    css: [
      // grade de estrutura, mais forte no alto e sumindo para as bordas
      texture.grid('rgba(23,26,44,.06)', '50% 0%', 44, '70% 80%'),
      `selector .pb-tag .elementor-heading-title{padding:5px 10px;border:1px solid ${PB.border};border-radius:999px;white-space:nowrap}`,
      'selector .pb-journey>.pb-frame{position:relative;overflow:visible}',
      `selector .pb-journey>.pb-frame:not(:last-child)::after{content:"";position:absolute;width:22px;height:1px;top:62px;left:100%;background:${PB.slate}}`,
      '@media(max-width:1024px){selector .pb-journey>.pb-frame:not(:last-child)::after{width:1px;height:22px;top:100%;left:48px}}',
      `selector .pb-note p::before{content:"";display:inline-block;width:20px;height:2px;margin-right:12px;vertical-align:middle;background:${PB.orange}}`,
    ].join(''),
  })
  return b.section('ProcessBase · Como funciona', 'processbase-como-funciona', root)
}

// ── o que fica ──────────────────────────────────────────────────────────────

type TreeKind = 'open' | 'closed' | 'file' | 'active'
const TREE: Array<[number, string, TreeKind]> = [
  [0, 'Sua empresa', 'open'],
  [1, '01 Cultura e pessoas', 'open'],
  [2, 'Missão, visão e valores', 'file'],
  [2, 'Organograma', 'file'],
  [2, 'Cargos e responsabilidades', 'file'],
  [1, '02 Processos', 'open'],
  [2, 'Mapa de macroprocessos', 'file'],
  [2, 'Procedimentos e checklists', 'file'],
  [2, 'Gestão diária · 15 min', 'active'],
  [1, '03 Treinamentos', 'closed'],
  [1, '04 Planejamento estratégico', 'closed'],
]

const DELIVERABLES: Array<[string, string, string]> = [
  ['Registro', 'Documentação', 'Procedimentos, checklists e fluxos de cada processo mapeado.'],
  ['Ritmo', 'Padrão de reunião', 'Gestão diária e semanal em encontros de 15 minutos.'],
  ['Pessoas', 'Treinamentos', 'Trilhas de integração e de processo, com treinadores da própria equipe.'],
  ['Direção', 'Plano estratégico', 'Prioridades e plano de ação para até 3 anos.'],
]

const makeOQueFica = (): SectionNodeData => {
  const b = createBuilder('pbo')
  const vault = b.frame([
    b.panelHead('Cérebro da empresa', 'FICA COM VOCÊ', 'dark'),
    b.col(TREE.map(([level, label, kind]) => b.heading(label, tweak(T.small, { size: 14, line: 1.3 }), kind === 'file' ? PB.onNavy : PB.white, {
      _css_classes: `pb-tree pb-tree--l${level} pb-tree--${kind}`,
    })), 2, { padding: sides(18, 16, 22), css_classes: 'pb-tree-list' }),
  ], 'dark', {}, reveal(0, 'container', 'fadeIn'))

  const deliverables = b.col([
    b.grid(DELIVERABLES.map(([label, title, copy], index) => b.col([
      b.heading(label, T.micro, PB.orange),
      b.heading(title, T.cardSm, PB.white, { header_size: 'h3', _margin: sides(14, 0, 8, 0) }),
      b.text(copy, T.small, PB.onNavy),
    ], 0, {
      padding: sides(24, 22), ...border(PB.line), border_radius: sides(L.radius.card),
      ...reveal(index * 80, 'container', 'fadeIn'),
    })), 'repeat(2,minmax(0,1fr))', 16, {}, { tablet: 'repeat(2,minmax(0,1fr))', mobile: '1fr' }),
    b.text('É a mesma estrutura de pastas que a ProcessBase usa para organizar o próprio método.', T.small, PB.slate, { _css_classes: 'pb-note' }),
  ], 24)

  const root = b.root([
    b.sectionHead({
      label: 'O que fica com você', tone: 'dark',
      title: `O conhecimento sai da cabeça de alguém e ${hl('passa a ser da empresa.')}`,
      lede: 'Tudo o que o projeto constrói fica registrado num só lugar, o cérebro da empresa: organizado como o próprio método e pronto para consultar, treinar e melhorar.',
    }),
    b.grid([vault, deliverables], 'minmax(0,1fr) minmax(0,1fr)', [32, 40], { margin: sides(56, 0, 0, 0), grid_align_items: 'center' }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: PB.navy, id: 'o-que-fica',
    css: [
      texture.grain('rgba(255,255,255,.14)', '20% 0%', '70% 90%'),
      texture.glow('rgba(130,154,175,.14)', '12% 0%'),
      'selector .pb-tree .elementor-heading-title{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px}',
      'selector .pb-tree--l1 .elementor-heading-title{padding-left:30px}',
      'selector .pb-tree--l2 .elementor-heading-title{padding-left:52px}',
      'selector .pb-tree .elementor-heading-title::before{content:"";flex:none;box-sizing:border-box}',
      `selector .pb-tree--open .elementor-heading-title::before,selector .pb-tree--closed .elementor-heading-title::before{width:7px;height:7px;border-right:1.5px solid ${PB.slate};border-bottom:1.5px solid ${PB.slate};transform:translateY(-2px) rotate(45deg)}`,
      'selector .pb-tree--closed .elementor-heading-title::before{transform:rotate(-45deg)}',
      `selector .pb-tree--file .elementor-heading-title::before,selector .pb-tree--active .elementor-heading-title::before{width:10px;height:12px;border:1.5px solid ${PB.slate};border-radius:2px}`,
      'selector .pb-tree--active .elementor-heading-title{background:rgba(255,89,0,.12)}',
      `selector .pb-tree--active .elementor-heading-title::before{border-color:${PB.orange}}`,
      `selector .pb-note p::before{content:"";display:inline-block;width:20px;height:2px;margin-right:12px;vertical-align:middle;background:${PB.orange}}`,
    ].join(''),
  })
  return b.section('ProcessBase · O que fica', 'processbase-o-que-fica', root)
}

// ── antes e depois ──────────────────────────────────────────────────────────

const makeAntesDepois = (): SectionNodeData => {
  const b = createBuilder('pbd')
  const side = (tone: Tone, label: string, title: string, items: string[]) => b.col([
    b.eyebrow(label, tone),
    b.heading(title, T.card, tone === 'dark' ? PB.white : PB.ink, { header_size: 'h3', _margin: sides(20, 0, 24, 0) }),
    list(b, items, 'dash', tone === 'dark' ? 'rgba(255,255,255,0.86)' : PB.ink, { _css_classes: `pb-list pb-list--dash pb-list--${tone}` }),
  ], 0, {
    padding: sides(36), padding_mobile: sides(28, 22),
    ...bg(tone === 'dark' ? PB.navy : PB.white), border_radius: sides(L.radius.card),
  })
  const axis = b.col([
    b.divider('#AEB3BD', { _css_classes: 'pb-axis-line' }),
    b.heading('Base', tweak(T.micro, { size: 10, weight: 700, letter: 0.18 }), PB.ink, { _css_classes: 'pb-axis-label' }),
    b.divider('#AEB3BD', { _css_classes: 'pb-axis-line' }),
  ], 12, { flex_align_items: 'center', flex_justify_content: 'center', flex_direction_mobile: 'row', css_classes: 'pb-axis' })

  const compare = b.grid([
    side('dark', 'Antes', 'A operação depende de memória e presença.', ['Prioridades disputam espaço', 'Conhecimento concentrado em poucas pessoas', 'Reuniões longas e reativas', 'Crescimento sem previsibilidade']),
    axis,
    side('light', 'Depois', 'A operação trabalha com padrão, ritmo e direção.', ['Responsáveis definidos', 'Processos documentados', 'Rituais curtos de gestão', 'Decisões ligadas à estratégia']),
  ], 'minmax(0,1fr) 48px minmax(0,1fr)', 0, {
    padding: sides(6), ...bg(PB.shellLight), ...border('#DADDE3'), border_radius: sides(L.radius.shell),
    ...reveal(0, 'container', 'fadeIn'),
  }, { tablet: 'minmax(0,1fr) 48px minmax(0,1fr)', mobile: '1fr' })

  const control = b.frame([
    b.panelHead('Estrutura operacional', 'MODELO', 'dark'),
    b.row([
      b.ring('4<small>/4</small>', 100, 96, { size: 30, line: 1, letter: -0.03 }, PB.white),
      b.col([
        b.heading('Pilares conectados', T.cardSm, PB.white, { header_size: 'h3' }),
        b.text('O valor está no sistema completo, não numa ferramenta isolada.', T.small, PB.onNavy),
      ], 8),
    ], 22, { padding: sides(28, 24) }),
    b.row([
      b.heading('Capacidade de execução', T.small, PB.slate, FIXED),
      b.heading('Mais ciclos, mais velocidade', tweak(T.micro, { size: 10, weight: 700 }), PB.orange, FIXED),
    ], 12, { flex_justify_content: 'space-between', flex_wrap: 'wrap', padding: sides(8, 24, 0) }),
    b.image('graphics/curva-ciclos.svg', 'Curva ilustrativa: a capacidade de execução sobe a cada ciclo de melhoria.', { width: pct(100), _css_classes: 'pb-curve' }),
  ], 'dark', { flex_justify_content: 'space-between', min_height: fluid('100%') }, { ...bg(PB.shellLight), ...border('#DADDE3'), ...reveal(80, 'container', 'fadeIn') })

  const root = b.root([
    b.sectionHead({ label: 'O que muda', tone: 'light', title: `Menos improviso. ${hl('Mais empresa.', 'light')}` }),
    b.grid([compare, control], 'minmax(0,1.35fr) minmax(0,.65fr)', 24, { margin: sides(56, 0, 0, 0) }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: PB.white, id: 'o-que-muda',
    css: [
      // só o pontilhado: uma luz aqui apareceria como um retângulo enquanto a seção ainda está navy
      texture.dots('rgba(23,26,44,.16)', '96% 0%', 20, '42% 60%'),
      LIST_CSS('rgba(128,128,128,.22)'),
      'selector .pb-list li{font-size:14px}',
      RING_CSS([100], 'rgba(130,154,175,.24)', PB.navyRaised),
      'selector .pb-axis-line{width:1px;flex:1 1 auto;max-height:90px}',
      'selector .pb-axis-line .elementor-divider{padding:0;height:100%}',
      'selector .pb-axis-line .elementor-divider-separator{width:1px!important;height:100%;border-top:0!important;border-left:1px solid #AEB3BD}',
      'selector .pb-axis-label .elementor-heading-title{writing-mode:vertical-rl}',
      'selector .pb-curve img{display:block;width:100%;height:150px;object-fit:fill}',
      '@media(max-width:767px){selector .pb-axis{padding:14px 0}selector .pb-axis-line{max-height:none;height:1px;width:auto;max-width:70px}selector .pb-axis-line .elementor-divider-separator{width:100%!important;height:1px;border-left:0;border-top:1px solid #AEB3BD!important}selector .pb-axis-label .elementor-heading-title{writing-mode:horizontal-tb}}',
    ].join(''),
  })
  return b.section('ProcessBase · Antes e depois', 'processbase-antes-depois', root)
}

// ── quem conduz ─────────────────────────────────────────────────────────────

const makeQuemConduz = (): SectionNodeData => {
  const b = createBuilder('pbx')
  const photo = b.frame([
    b.image('photos/gian-bianchin-machado-retrato.jpg', 'Gian Bianchin Machado, de camisa azul-marinho, com a mão no queixo, sorrindo', { width: pct(100), _css_classes: 'pb-photo' }),
    b.col([
      b.heading('Quem conduz', tweak(T.micro, { size: 10, weight: 700, letter: 0.18 }), PB.orange),
      b.heading('Todas as reuniões,<br>pessoalmente.', tweak(T.cardSm, { size: 17, line: 1.25 }), PB.white),
    ], 6, {
      padding: sides(16, 20), ...bg('rgba(23,26,44,0.88)'), ...border('rgba(255,255,255,0.1)'), border_radius: sides(12),
      css_classes: 'pb-photo-label',
    }),
  ], 'light', { css_classes: 'pb-core pb-photo-core' }, reveal(0, 'container', 'fadeIn'))

  const signature = b.row([
    b.image('logo/processbase-symbol.svg', '', { width: px(40), _element_width: 'auto', ...FIXED }),
    b.col([
      b.heading('Gian Bianchin Machado', T.cardSm, PB.ink),
      b.heading('Engenheiro de Produção · Green Belt Six Sigma', T.small, PB.body),
    ], 4),
  ], 16, { padding: sides(20, 0), ...border('#E3E5EA', sides(1, 0)), margin: sides(8, 0, 0, 0) })

  const copy = b.col([
    b.eyebrow('Especialista', 'light', reveal(0)),
    b.heading(`Não nasceu numa ${hl('sala de reunião.', 'light')}`, T.h2, PB.ink, { header_size: 'h2', ...reveal(80) }),
    b.text('O Método Base sistematiza oito anos de melhoria contínua na indústria: procedimentos operacionais, PPAP, SMED implantado em duas empresas, certificação de operadores e rotinas de gestão. Primeiro a prática. Depois, o método.', T.lede, PB.body, { ...maxw(560), ...reveal(160) }),
    signature,
    b.text('Conduz pessoalmente todas as reuniões do projeto.', T.body, PB.body),
    b.heading('“O método que a ProcessBase vende é o método que ela pratica.”', tweak(T.sub, { size: 24, tablet: 22, mobile: 20, line: 1.3, letter: -0.02 }), PB.ink, {
      _css_classes: 'pb-quote', _margin: sides(12, 0, 0, 0),
    }),
  ], 22, { flex_justify_content: 'center' })

  const root = b.root([
    b.grid([photo, copy], 'minmax(0,1fr) minmax(0,1fr)', [40, 64], { grid_align_items: 'center' }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: PB.white, id: 'quem-conduz',
    css: [
      // hachura 2:1 do emblema no canto de baixo, atrás da foto
      texture.hatch('rgba(23,26,44,.08)', '0% 100%', 12, '45% 60%'),
      'selector .pb-photo-core{position:relative}',
      // retrato vertical: o corte deixa respiro acima da cabeça no quadrado e no 4:3
      'selector .pb-photo img{display:block;width:100%;aspect-ratio:1;object-fit:cover;object-position:50% 24%}',
      // retrato: sem as linhas diagonais da marca, que cortariam o Gian
      'selector .pb-photo-label{position:absolute!important;left:20px;bottom:20px;width:auto!important;z-index:1}',
      `selector .pb-quote .elementor-heading-title{padding-left:20px;border-left:3px solid ${PB.orange}}`,
      '@media(max-width:1024px){selector .pb-photo img{aspect-ratio:4/3}}',
      '@media(max-width:767px){selector .pb-photo img{aspect-ratio:1}selector .pb-photo-label{left:12px;bottom:12px;padding:10px 14px!important}selector .pb-photo-label .elementor-widget-heading:last-child .elementor-heading-title{font-size:14px}}',
    ].join(''),
  })
  return b.section('ProcessBase · Quem conduz', 'processbase-quem-conduz', root)
}

// ── dúvidas ─────────────────────────────────────────────────────────────────

const FAQ: Array<[string, string]> = [
  ['Quanto tempo dura um projeto?', 'De 6 meses a 1 ano, conforme o tamanho da empresa e os pilares que entram no projeto. O planejamento estratégico construído no fim mira até 3 anos à frente.'],
  ['O método é igual para todas as empresas?', 'A sequência dos quatro pilares é a mesma, mas o projeto é desenhado para a necessidade de cada empresa. Conforme o porte, entram também controles de produção, como OEE e cronoanálise.'],
  ['Quem conduz as reuniões?', 'O Gian, pessoalmente, em todas as reuniões. Por isso a ProcessBase atende um número limitado de empresas ao mesmo tempo.'],
  ['As reuniões são presenciais?', 'Presenciais ou híbridas, combinadas no início do projeto. Atendemos a região metropolitana de Porto Alegre e o Rio Grande do Sul.'],
  ['Quem da empresa precisa participar?', 'O dono ou sócio, a liderança e, nas etapas de processo, quem executa o trabalho. O mapeamento é feito com quem entende do processo, não só com a direção.'],
  ['Como funciona o pagamento?', 'Por projeto, em mensalidades ou à vista. O valor depende do tamanho do projeto e é apresentado depois da conversa de diagnóstico.'],
  ['O que acontece quando o projeto termina?', 'A documentação, os treinamentos, o padrão de reunião e o cérebro da empresa ficam com você. A equipe já tem treinadores internos para seguir multiplicando o conhecimento.'],
]

const makeDuvidas = (): SectionNodeData => {
  const b = createBuilder('pbf')
  const accordion = b.widget('nested-accordion', {
    items: FAQ.map(([question], index) => ({ item_title: question, _id: `pbfi${index + 1}00`.slice(0, 7) })),
    default_state: 'all_collapsed',
    max_items_expended: 'multiple',
    n_accordion_animation_duration: { unit: 'ms', size: 300, sizes: [] },
    accordion_item_title_icon: { value: 'fas fa-plus', library: 'fa-solid' },
    accordion_item_title_icon_active: { value: 'fas fa-minus', library: 'fa-solid' },
    accordion_item_title_position_horizontal: 'stretch',
    title_typography_typography: 'custom', title_typography_font_family: PB_FONT, title_typography_font_size: px(18), title_typography_font_size_mobile: px(16),
    title_typography_font_weight: '400', title_typography_line_height: { unit: 'em', size: 1.35, sizes: [] }, title_typography_letter_spacing: { unit: 'em', size: -0.01, sizes: [] },
    normal_title_color: PB.ink, hover_title_color: PB.ink, active_title_color: PB.ink,
    normal_icon_color: PB.orange, hover_icon_color: PB.orange, active_icon_color: PB.orange,
    _css_classes: 'pb-faq',
  })
  accordion.elements = FAQ.map(([, answer]) => b.col([
    b.text(answer, T.body, PB.body, maxw(620)),
  ], 0, { padding: sides(0, 24, 22, 24), padding_mobile: sides(0, 18, 18, 18) }))

  const root = b.root([
    b.grid([
      b.sectionHead({
        label: 'Dúvidas', tone: 'light',
        title: `O que perguntam ${hl('antes de começar.', 'light')}`,
        lede: 'Se a sua pergunta não estiver aqui, ela cabe na conversa de diagnóstico.',
      }),
      accordion,
    ], 'minmax(0,.9fr) minmax(0,1.1fr)', [40, 56], { grid_align_items: 'start' }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: PB.mist, id: 'duvidas',
    css: [
      texture.dots('rgba(23,26,44,.14)', '0% 100%', 20, '45% 60%'),
      `selector .pb-faq .e-n-accordion{display:flex;flex-direction:column;gap:0;border:1px solid ${PB.border};border-radius:16px;overflow:hidden;background:${PB.white}}`,
      `selector .pb-faq .e-n-accordion-item+.e-n-accordion-item{border-top:1px solid #E3E5EA}`,
      'selector .pb-faq .e-n-accordion-item-title{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 24px;border:0;border-radius:0;background:transparent;cursor:pointer;list-style:none}',
      'selector .pb-faq .e-n-accordion-item-title::-webkit-details-marker{display:none}',
      `selector .pb-faq .e-n-accordion-item-title:hover{background:${PB.mist}}`,
      `selector .pb-faq .e-n-accordion-item-title-icon{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid ${PB.border};border-radius:8px;flex:none;color:${PB.ink};font-size:18px;line-height:1}`,
      `selector .pb-faq .e-n-accordion-item[open]{background:${PB.mist}}`,
      `selector .pb-faq .e-n-accordion-item[open] .e-n-accordion-item-title-icon{background:${PB.navy};border-color:${PB.navy};color:${PB.white}}`,
      '@media(prefers-reduced-motion:no-preference){selector .pb-faq .e-n-accordion-item[open]>.e-con{animation:pbAnswerIn 220ms ease-out}@keyframes pbAnswerIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}}',
      'selector .pb-faq .e-n-accordion-item-title-icon i{font-size:12px}',
      'selector .pb-faq .e-n-accordion-item>.e-con{border:0}',
      '@media(max-width:767px){selector .pb-faq .e-n-accordion-item-title{padding:18px}}',
    ].join(''),
  })
  return b.section('ProcessBase · Dúvidas', 'processbase-duvidas', root)
}

// ── contato ─────────────────────────────────────────────────────────────────

/** Contato público da ProcessBase (PB_CONTACT em processbase/tokens, COPY.md §13d). */
const GIAN_WHATSAPP_LABEL = PB_CONTACT.whatsappLabel
const WHATSAPP_URL = pbWhatsApp('Olá, Gian. Vim pelo site da ProcessBase e quero conversar sobre o diagnóstico.')
const CONTACT_EMAIL = PB_CONTACT.email
const INSTAGRAM_HANDLE = PB_CONTACT.instagramHandle
const INSTAGRAM_URL = PB_CONTACT.instagramUrl

/** Borda dos campos: 3,2:1 no branco (a #C9CCD3 dava 1,6:1 e o campo sumia). */
const FIELD_BORDER = '#8A909C'

/** `prefix` separa os ids dos campos quando o formulário aparece duas vezes (página e modal). */
const contactForm = (b: PBBuilder, prefix = '') => {
  // dois campos por linha no desktop: o formulário fica mais curto que a coluna do texto
  const fields: Array<[string, string, string, string, boolean, string]> = [
    ['nome', 'text', 'Seu nome', 'Como podemos te chamar', true, '50'],
    ['empresa', 'text', 'Empresa', 'Nome da empresa', true, '50'],
    ['papel', 'text', 'Seu papel na empresa', 'Dono, sócio, gerente', false, '50'],
    ['telefone', 'tel', 'WhatsApp', '(51) 00000-0000', true, '50'],
    ['momento', 'textarea', 'O que mais trava a empresa hoje (opcional)', 'Ex.: tudo passa por mim e cada pessoa faz de um jeito', false, '100'],
  ]
  return b.widget('form', {
    form_name: prefix ? 'Diagnóstico ProcessBase (modal)' : 'Diagnóstico ProcessBase',
    form_fields: fields.map(([id, type, label, placeholder, required, width]) => ({
      _id: `${prefix}${id}`, custom_id: `${prefix}${id}`, field_type: type, field_label: label, placeholder, required: required ? 'true' : '', width, width_mobile: '100',
      ...(type === 'textarea' ? { rows: '3' } : {}),
    })),
    input_size: 'sm', show_labels: 'true', button_size: 'md', button_width: '100', button_align: 'stretch', button_text: 'Agendar diagnóstico',
    submit_actions: ['email'],
    email_to: CONTACT_EMAIL,
    email_subject: 'Novo pedido de diagnóstico pelo site da ProcessBase',
    success_message: 'Recebemos. O Gian responde para marcar a conversa.',
    error_message: 'Não foi possível enviar agora. Tente de novo em instantes.',
    required_field_message: 'Este campo é obrigatório.',
    column_gap: px(14), row_gap: px(16), label_spacing: px(6),
    label_color: PB.ink, label_typography_typography: 'custom', label_typography_font_family: PB_FONT, label_typography_font_size: px(13), label_typography_font_weight: '500',
    field_text_color: PB.ink, field_typography_typography: 'custom', field_typography_font_family: PB_FONT, field_typography_font_size: px(15), field_typography_font_weight: '400',
    field_background_color: PB.white, field_border_color: FIELD_BORDER, field_border_width: sides(1), field_border_radius: sides(L.radius.button),
    // o CTA da marca, igual aos outros: laranja, texto branco semibold e a seta
    button_background_color: PB.orange, button_text_color: PB.white, button_background_hover_color: PB.orangeHover, button_hover_color: PB.white,
    button_typography_typography: 'custom', button_typography_font_family: PB_FONT, button_typography_font_size: px(15), button_typography_font_weight: '600',
    selected_button_icon: ARROW, button_icon_align: 'right', button_icon_indent: px(10),
    button_border_radius: sides(L.radius.button), button_text_padding: sides(15, 24),
    custom_css: [
      'selector .elementor-field-group .elementor-field-textual{padding:11px 14px;min-height:0;line-height:1.5;border-style:solid}',
      'selector .elementor-field-group textarea.elementor-field-textual{min-height:96px;resize:vertical}',
      'selector .elementor-field-textual::placeholder{color:#6E7482;opacity:1}',
      `selector .elementor-field-textual:hover{border-color:${PB.body}}`,
      `selector .elementor-field-textual:focus{border-color:${PB.navy};outline:2px solid ${PB.navy};outline-offset:2px;box-shadow:none}`,
      `selector .elementor-button:focus-visible{outline:2px solid ${PB.navy};outline-offset:3px}`,
      'selector .e-form__buttons{margin-top:6px}',
      // seta depois do texto (o motor não aplica o button_icon_align)
      'selector .e-form__buttons .elementor-button-content-wrapper{display:flex;flex-direction:row-reverse;align-items:center;justify-content:center;gap:10px}',
      `@media(prefers-reduced-motion:no-preference){selector .elementor-field-textual{transition:border-color 200ms ${PB_EASE}}selector .elementor-button{transition:background-color 200ms ${PB_EASE},color 200ms ${PB_EASE}}}`,
      '@media(max-width:767px){selector .elementor-field-group{width:100%}}',
    ].join(''),
  })
}

/**
 * Pedido de diagnóstico: bloco navy de canto reto (o bloco institucional da
 * marca) com o texto em branco à esquerda e o formulário num card de moldura
 * dupla à direita. O laranja fica só no botão.
 */
const makeContato = (): SectionNodeData => {
  const b = createBuilder('pbk')
  // quem responde, com rosto: a mesma prova do hero
  const person = b.row([
    b.image('photos/gian-bianchin-machado.png', 'Gian Bianchin Machado', { _css_classes: 'pb-avatar', ...FIXED }),
    b.col([
      b.heading('Gian Bianchin Machado', tweak(T.small, { size: 14, weight: 500 }), PB.white),
      b.heading('Como é ele quem conduz todas as reuniões, a agenda de novos projetos é limitada.', T.small, PB.slate, maxw(360)),
    ], 4, { width: fluid('auto') }),
  ], 14, { padding: sides(24, 0, 0, 0), margin: sides(8, 0, 0, 0), ...border(PB.line, sides(1, 0, 0, 0)), css_classes: 'pb-contact-person' })

  const copy = b.col([
    b.eyebrow('Próximo passo', 'dark'),
    b.heading(`Sua empresa está pronta para crescer ${hl('sem perder o controle?')}`, T.h2, PB.white, { header_size: 'h2', ...maxw(560) }),
    b.text('Conte em poucas linhas o momento da empresa. O Gian responde para marcar a conversa de diagnóstico.', T.lede, PB.onNavy, maxw(480)),
    person,
  ], 22)

  const form = b.frame([
    b.panelHead('Conversa de diagnóstico', 'AGENDA LIMITADA', 'light'),
    b.col([
      contactForm(b),
      b.text('Usamos estes dados só para responder você.', tweak(T.small, { size: 12 }), PB.body, { align: 'center' }),
    ], 16, { padding: sides(24, 28, 26), padding_mobile: sides(20, 18, 22) }),
  ], 'dark', { ...bg(PB.white), ...border('rgba(255,255,255,0.1)') }, { ...bg('rgba(255,255,255,0.06)'), ...border('rgba(255,255,255,0.12)') })

  const block = b.grid([copy, form], 'minmax(0,1fr) minmax(0,1.05fr)', [36, 64], {
    grid_align_items: 'center',
    padding: sides(64), padding_tablet: sides(44), padding_mobile: sides(32, 18),
    ...bg(PB.navy), css_classes: 'pb-contact-block', ...reveal(0, 'container', 'fadeIn'),
  }, { tablet: '1fr', mobile: '1fr' })

  const root = b.root([block], {
    background: PB.white, id: 'contato',
    css: [
      // hachura 2:1 em ardósia no canto do bloco, atrás do texto
      'selector .pb-contact-block{position:relative;isolation:isolate}',
      'selector .pb-contact-block::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background-image:repeating-linear-gradient(116.57deg,rgba(130,154,175,.14) 0 1px,transparent 1px 12px);-webkit-mask-image:radial-gradient(ellipse 55% 70% at 0% 100%,#000 5%,transparent 75%);mask-image:radial-gradient(ellipse 55% 70% at 0% 100%,#000 5%,transparent 75%)}',
      'selector .pb-contact-person .e-con{min-width:0}',
      'selector .pb-avatar{width:44px;height:44px;border-radius:50%;overflow:hidden;outline:1px solid rgba(255,255,255,.12);outline-offset:-1px}',
      'selector .pb-avatar img{display:block;width:44px;height:44px;object-fit:cover;transform:scale(2.7);transform-origin:61% 19%}',
      // celular: a etiqueta desce para baixo do rótulo em vez de ser cortada
      '@media(max-width:767px){selector .pb-contact-block .pb-panel-head{flex-wrap:wrap!important;row-gap:10px}}',
    ].join(''),
  })
  return b.section('ProcessBase · Contato', 'processbase-contato', root)
}

// ── rodapé ──────────────────────────────────────────────────────────────────

const makeRodape = (): SectionNodeData => {
  const b = createBuilder('pbz')
  const footLink = (label: string, url: string) => b.heading(label, T.small, PB.onNavy, { link: link(url, url.startsWith('https:')), title_hover_color: PB.white })
  const column = (title: string, links: Array<[string, string]>, settings = {}) => b.col([
    b.heading(title, T.micro, PB.slate, { _margin: sides(0, 0, 6, 0) }),
    ...links.map(([label, url]) => footLink(label, url)),
  ], 10, settings)

  const main = b.grid([
    b.col([
      b.image('logo/processbase-logo-reverse.svg', 'ProcessBase', { align: 'left', link_to: 'custom', link: link('#inicio'), _css_classes: 'pb-foot-logo' }),
      b.heading(`Estrutura para melhorar.<br>${hl('Ritmo para crescer.')}`, tweak(T.sub, { size: 26, tablet: 24, mobile: 22 }), PB.white, { ...maxw(360), _margin: sides(28, 0, 10, 0) }),
      b.heading('Sistemas de crescimento operacional', T.eyebrow, PB.slate),
    ], 0, { flex_align_items: 'flex-start' }),
    b.grid([
      column('Método Base', [['Cultura e pessoas', '#metodo'], ['Processos', '#metodo'], ['Treinamentos', '#metodo'], ['Planejamento estratégico', '#metodo']]),
      column('A ProcessBase', [['O que muda', '#o-que-muda'], ['Como funciona', '#como-funciona'], ['O que fica com você', '#o-que-fica'], ['Especialista', '#quem-conduz'], ['Dúvidas', '#duvidas']]),
      column('Contato', [
        ['Agendar diagnóstico', '#contato'],
        [`WhatsApp ${GIAN_WHATSAPP_LABEL}`, WHATSAPP_URL],
        [CONTACT_EMAIL, `mailto:${CONTACT_EMAIL}`],
        [`Instagram ${INSTAGRAM_HANDLE}`, INSTAGRAM_URL],
      ], { css_classes: 'pb-foot-contact' }),
    ], 'repeat(3,minmax(0,1fr))', 24, {}, { mobile: 'repeat(2,minmax(0,1fr))' }),
  ], 'minmax(0,1fr) minmax(0,1.3fr)', [40, 56], { padding: sides(72, 0, 56), padding_mobile: sides(56, 0, 40), css_classes: 'pb-foot-main' }, { tablet: '1fr', mobile: '1fr' })

  const base = b.row([
    b.heading('© 2026 ProcessBase · São Leopoldo, RS', T.small, PB.slate, FIXED),
    b.heading('Cultura · Processos · Treinamentos · Estratégia', T.micro, PB.slate, FIXED),
  ], 12, { flex_justify_content: 'space-between', flex_wrap: 'wrap', padding: sides(20, 0, 28), ...border(PB.line, sides(1, 0, 0, 0)) })

  const root = b.root([
    b.image('logo/processbase-symbol-mono-white.svg', '', { _css_classes: 'pb-super' }),
    main, base,
  ], {
    background: PB.navy, tag: 'footer', pad: false,
    settings: {
      overflow: 'hidden',
      padding: sides(0, L.gutter.desktop), padding_tablet: sides(0, L.gutter.tablet), padding_mobile: sides(0, L.gutter.mobile),
    },
    css: [
      'selector{position:relative;isolation:isolate}',
      texture.grain('rgba(255,255,255,.12)', '50% 100%', '80% 80%'),
      'selector .pb-foot-logo img{display:block;height:28px;width:auto}',
      // e-mail e telefone não cabem em meia coluna no celular: o contato ocupa a linha
      '@media(max-width:767px){selector .pb-foot-contact{grid-column:1/-1}}',
      // supergráfico: o emblema em branco a 6%, grande, à direita (DESIGN.md §3)
      'selector .pb-super{position:absolute!important;right:-80px;top:50%;width:460px!important;max-width:none!important;margin:0!important;transform:translateY(-50%);opacity:.06;pointer-events:none;z-index:-1}',
      'selector .pb-super img{display:block;width:100%;height:auto}',
      '@media(max-width:767px){selector .pb-super{width:260px!important;right:-90px;top:auto;bottom:-70px;transform:none}}',
    ].join(''),
  })
  return b.section('ProcessBase · Rodapé', 'processbase-rodape', root)
}

// ── modal de diagnóstico ────────────────────────────────────────────────────

/**
 * Todos os "Agendar diagnóstico" abrem esta modal (o script em
 * processbase/modal intercepta os links para #contato). O formulário do fim
 * da página continua lá para quem não clicou. Fica por último na página.
 */
const makeModal = (): SectionNodeData => {
  const b = createBuilder('pbm')
  const close = b.widget('html', {
    html: `<button type="button" class="pb-modal-close" aria-label="Fechar"><span></span><span></span></button><script>${PROCESSBASE_MODAL_SCRIPT}</script>`,
    _css_classes: 'pb-modal-x',
  })
  const person = b.row([
    b.image('photos/gian-bianchin-machado.png', 'Gian Bianchin Machado', { _css_classes: 'pb-avatar', ...FIXED }),
    b.col([
      b.heading('Gian Bianchin Machado', tweak(T.small, { size: 14, weight: 500 }), PB.ink),
      b.heading('Como é ele quem conduz todas as reuniões, a agenda de novos projetos é limitada.', T.small, PB.body, maxw(380)),
    ], 4, { width: fluid('auto') }),
  ], 14, { padding: sides(18, 0), ...border('#E3E5EA', sides(1, 0)), css_classes: 'pb-modal-person' })

  const card = b.col([
    close,
    b.eyebrow('Conversa de diagnóstico', 'light'),
    b.heading(`Conte o momento ${hl('da empresa.', 'light')}`, tweak(T.sub, { size: 34, tablet: 30, mobile: 28, line: 1.08 }), PB.ink, { header_size: 'h2', _margin: sides(4, 0, 0, 0) }),
    b.text('O Gian responde para marcar a conversa de diagnóstico.', T.body, PB.body),
    person,
    contactForm(b, 'modal_'),
    b.text('Usamos estes dados só para responder você.', tweak(T.small, { size: 12 }), PB.body, { align: 'center' }),
  ], 16, {
    padding: sides(36, 36, 30), padding_mobile: sides(28, 20, 22),
    ...bg(PB.white), border_radius: sides(L.radius.shell), css_classes: 'pb-modal-card',
  })

  const root = b.root([card], {
    background: 'rgba(23,26,44,0.72)', id: 'agendar-diagnostico', tag: 'div', pad: false,
    settings: { flex_justify_content: 'center', flex_align_items: 'center', css_classes: 'pb-modal' },
    css: [
      // fechada por padrão; o script abre (is-open) e, na miniatura do Space, mostra parada (is-preview)
      'selector{position:fixed!important;inset:0;z-index:1000;display:none!important;overflow-y:auto;overscroll-behavior:contain;padding:24px 16px!important;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}',
      // bloco (não flex): se o card for mais alto que a tela, o topo não some e dá para rolar
      'selector.is-open,selector.is-preview{display:block!important}',
      'selector.is-preview{position:relative!important;inset:auto;min-height:0}',
      '.elementor-editor-active selector{display:flex!important;position:relative!important}',
      // margem automática no card: centraliza quando sobra espaço e cola no topo quando não sobra
      'selector>.e-con-inner{width:100%;min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-start}',
      'selector .pb-modal-card{position:relative;width:min(100%,640px)!important;margin:auto}',
      'html.pb-modal-lock{overflow:hidden;scrollbar-gutter:stable}',
      // entrada curta; a saída é mais curta e mais leve
      '@media(prefers-reduced-motion:no-preference){@keyframes pbModalFade{from{opacity:0}to{opacity:1}}@keyframes pbModalIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes pbModalOut{to{opacity:0}}selector.is-open{animation:pbModalFade 200ms ease-out}selector.is-open .pb-modal-card{animation:pbModalIn 260ms cubic-bezier(.2,.7,.2,1)}selector.is-closing{animation:pbModalOut 160ms ease-out forwards}}',
      // fechar: quadrado de 40px com o xis em navy
      'selector .pb-modal-x{position:absolute!important;top:16px;right:16px;width:auto!important;margin:0!important;z-index:2;line-height:0}',
      `selector .pb-modal-close{position:relative;display:block;width:40px;height:40px;padding:0;border:1px solid ${PB.border};border-radius:${L.radius.button}px;background:${PB.white};cursor:pointer}`,
      `selector .pb-modal-close span{position:absolute;left:11px;top:19px;width:16px;height:1.5px;border-radius:1px;background:${PB.navy}}`,
      'selector .pb-modal-close span:first-child{transform:rotate(45deg)}selector .pb-modal-close span:last-child{transform:rotate(-45deg)}',
      `selector .pb-modal-close:hover{border-color:${PB.navy}}`,
      `@media(prefers-reduced-motion:no-preference){selector .pb-modal-close{transition-property:border-color,transform;transition-duration:150ms;transition-timing-function:${PB_EASE}}selector .pb-modal-close:active{transform:scale(.96)}}`,
      'selector .pb-modal-person .e-con{min-width:0}',
      'selector .pb-avatar{width:44px;height:44px;border-radius:50%;overflow:hidden;outline:1px solid rgba(0,0,0,.1);outline-offset:-1px}',
      'selector .pb-avatar img{display:block;width:44px;height:44px;object-fit:cover;transform:scale(2.7);transform-origin:61% 19%}',
      '@media(max-width:767px){selector{padding:12px!important}selector .pb-modal-x{top:12px;right:12px}}',
    ].join(''),
  })
  return b.section('ProcessBase · Modal de diagnóstico', 'processbase-modal', root)
}

// ── whatsapp flutuante ──────────────────────────────────────────────────────

const WHATSAPP_GREEN = '#25D366'

/**
 * Botão fixo no canto inferior direito: pílula navy "Falar com o Gian" com o
 * ícone do WhatsApp num círculo verde; no celular, só o círculo. Abre a
 * conversa direto com o Gian, com a mensagem pronta.
 */
const makeWhatsApp = (): SectionNodeData => {
  const b = createBuilder('pbw')
  const button = b.widget('button', {
    text: 'Falar com o Gian', size: 'md',
    link: link(WHATSAPP_URL, true),
    selected_icon: { value: 'fab fa-whatsapp', library: 'fa-brands' }, icon_align: 'row', icon_indent: px(12),
    ...typography({ size: 14, weight: 600, line: 1.2 }),
    text_padding: sides(6, 20, 6, 6), border_radius: sides(L.radius.pill),
    background_color: PB.navy, button_text_color: PB.white,
    button_background_hover_color: PB.navyRaised, hover_color: PB.white,
    border_border: 'solid', border_width: sides(1), border_color: 'rgba(255,255,255,0.14)', button_hover_border_color: 'rgba(255,255,255,0.28)',
    _css_classes: 'pb-wa',
  })

  const root = b.root([button], {
    background: 'transparent', tag: 'div', pad: false,
    settings: { css_classes: 'pb-wa-dock' },
    css: [
      // preso no canto, abaixo da modal (1000) e acima do navbar (100)
      'selector{position:fixed!important;right:24px;bottom:24px;left:auto;top:auto;z-index:900;width:auto!important;max-width:none;padding:0!important;background:transparent!important;overflow:visible}',
      'selector>.e-con-inner{width:auto;max-width:none;padding:0}',
      // flutua sobre navy e sobre branco: a sombra separa, o filete segura no escuro
      'selector .pb-wa .elementor-button{min-height:52px;box-shadow:0 1px 2px rgba(23,26,44,.18),0 10px 28px -6px rgba(23,26,44,.38)}',
      'selector .pb-wa .elementor-button-content-wrapper{display:flex;align-items:center}',
      `selector .pb-wa .elementor-button-icon{width:40px;height:40px;border-radius:50%;justify-content:center;background:${WHATSAPP_GREEN};color:${PB.white}}`,
      'selector .pb-wa .elementor-button-icon i{font-size:22px}selector .pb-wa .elementor-button-icon svg{width:22px;height:22px}',
      // o ícone não desliza como a seta dos CTAs
      'selector .pb-wa .elementor-button:hover .elementor-button-icon{transform:none}',
      '@media(prefers-reduced-motion:no-preference){@keyframes pbWaIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}selector{animation:pbWaIn 360ms cubic-bezier(.2,.7,.2,1) 700ms both}}',
      // celular: só o círculo verde; o texto some da tela mas continua para o leitor
      `@media(max-width:767px){selector{right:16px;bottom:16px}selector .pb-wa .elementor-button{width:56px;height:56px;min-height:56px;padding:0!important;border:0;background:${WHATSAPP_GREEN}}selector .pb-wa .elementor-button-content-wrapper{gap:0!important}selector .pb-wa .elementor-button-icon{width:56px;height:56px;background:transparent}selector .pb-wa .elementor-button-icon i{font-size:28px}selector .pb-wa .elementor-button-icon svg{width:28px;height:28px}selector .pb-wa .elementor-button-text{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}`,
    ].join(''),
  })
  return b.section('ProcessBase · WhatsApp flutuante', 'processbase-whatsapp', root)
}

export const createProcessBaseTemplate = (): LandingTemplate => ({
  id: 'processbase',
  name: 'ProcessBase',
  description: 'Home da consultoria: Método Base em quatro pilares, o que muda, como funciona, o que fica com o cliente, o especialista, dúvidas e pedido de diagnóstico.',
  audience: 'ProcessBase',
  sections: [
    makeNavbar(), makeHero(), makeAntesDepois(), makeComoFunciona(), makeOQueFica(),
    makeQuemConduz(), makeDuvidas(), makeContato(), makeRodape(), makeModal(), makeWhatsApp(),
  ],
})
