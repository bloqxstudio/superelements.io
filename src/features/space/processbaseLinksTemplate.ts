import type { LandingTemplate } from './landingTemplates'
import type { SectionNodeData } from '@/types/space'
import { bg, border, createBuilder, FIXED, fluid, hl, link, px, reveal, sides, T, texture, tweak, type PBBuilder } from '@/features/processbase/elementor'
import { PB, PB_CONTACT, PB_EASE, pbWhatsApp } from '@/features/processbase/tokens'

/**
 * Cartao de visita da ProcessBase para o link da bio.
 *
 * A composicao e deliberadamente plana e editorial: em vez de um card com
 * varios cards dentro, a pagina usa tipografia, filetes e uma unica acao em
 * laranja. Tudo continua nativo e editavel no Elementor.
 */

interface ContactLink {
  index: string
  title: string
  detail: string
  url: string
  external?: boolean
}

const SECONDARY_LINKS: ContactLink[] = [
  {
    index: '01',
    title: 'Conhecer o Método Base',
    detail: 'Como organizamos cultura, processos, treinamentos e estratégia.',
    url: PB_CONTACT.site,
  },
  ...(PB_CONTACT.linkedin ? [{
    index: '02',
    title: 'Ver o LinkedIn',
    detail: 'Gian Bianchin Machado',
    url: PB_CONTACT.linkedin,
    external: true,
  }] : []),
  {
    index: PB_CONTACT.linkedin ? '03' : '02',
    title: 'Enviar um e-mail',
    detail: PB_CONTACT.email,
    url: `mailto:${PB_CONTACT.email}`,
  },
]

const secondaryRow = (b: PBBuilder, item: ContactLink, index: number) => b.row([
  b.heading(item.index, tweak(T.micro, { size: 10, weight: 700, letter: 0.14 }), PB.orange, {
    _css_classes: 'pb-link-index', ...FIXED,
  }),
  b.col([
    b.heading(item.title, tweak(T.cardSm, { size: 17, weight: 500, line: 1.2 }), PB.white, {
      link: link(item.url, item.external), _css_classes: 'pb-link-title',
    }),
    b.heading(item.detail, tweak(T.small, { size: 12, line: 1.45 }), PB.slate, {
      _css_classes: 'pb-link-detail',
    }),
  ], 5, { width: fluid('auto'), _flex_size: 'grow' }),
  b.widget('icon', {
    selected_icon: { value: 'fas fa-arrow-right', library: 'fa-solid' },
    view: 'default', primary_color: PB.slate, size: px(13),
    _css_classes: 'pb-link-arrow', ...FIXED,
  }),
], 16, {
  padding: sides(20, 2, 20, 0),
  ...border(PB.lineStrong, sides(1, 0, 0, 0)),
  css_classes: 'pb-link',
  ...reveal(180 + index * 70, 'container'),
})

const makeCard = (): SectionNodeData => {
  const b = createBuilder('pbl')

  const masthead = b.row([
    b.image('logo/processbase-logo-reverse.svg', 'ProcessBase', {
      _css_classes: 'pb-links-logo', ...FIXED,
    }),
    b.heading('São Leopoldo · RS', tweak(T.micro, { size: 9, weight: 700, letter: 0.16 }), PB.slate, {
      _css_classes: 'pb-links-place', ...FIXED,
    }),
  ], 20, {
    flex_justify_content: 'space-between',
    padding: sides(0, 0, 20),
    ...border(PB.lineStrong, sides(0, 0, 1, 0)),
    css_classes: 'pb-links-masthead',
  })

  const intro = b.col([
    b.eyebrow('Sistemas de crescimento operacional', 'dark', { ...reveal(40) }),
    b.heading(`Estrutura para melhorar.<br>${hl('Ritmo para crescer.')}`, tweak(T.hero, {
      size: 46, tablet: 44, mobile: 39, line: 1.01, letter: -0.052,
    }), PB.white, {
      header_size: 'h1', _css_classes: 'pb-links-title', ...reveal(90),
    }),
    b.heading('Cultura · Processos · Treinamentos · Estratégia', tweak(T.micro, {
      size: 9, weight: 600, letter: 0.11,
    }), PB.slate, { _css_classes: 'pb-links-pillars', ...reveal(140) }),
  ], 20, { padding: sides(36, 0, 30), css_classes: 'pb-links-intro' })

  const person = b.row([
    b.image('photos/gian-bianchin-machado-retrato.jpg', 'Gian Bianchin Machado', {
      _css_classes: 'pb-links-portrait', ...FIXED,
    }),
    b.col([
      b.heading('Condução direta', tweak(T.micro, { size: 9, weight: 700, letter: 0.15 }), PB.orange),
      b.heading('Gian Bianchin Machado', tweak(T.cardSm, { size: 18, line: 1.15 }), PB.white),
      b.heading('Engenheiro de Produção · Green Belt Six Sigma', tweak(T.small, { size: 12, line: 1.4 }), PB.slate),
    ], 6, { width: fluid('auto'), _flex_size: 'grow' }),
  ], 18, {
    flex_align_items: 'center',
    padding: sides(0, 0, 28),
    css_classes: 'pb-links-person',
    ...reveal(170, 'container'),
  })

  const whatsapp = b.row([
    b.widget('icon', {
      selected_icon: { value: 'fab fa-whatsapp', library: 'fa-brands' },
      view: 'default', primary_color: PB.white, size: px(20),
      _css_classes: 'pb-cta-icon', ...FIXED,
    }),
    b.col([
      b.heading('Agendar uma conversa', tweak(T.body, { size: 16, weight: 600, line: 1.2 }), PB.white, {
        link: link(pbWhatsApp('Olá, Gian. Vim pelo Instagram da ProcessBase e quero conversar sobre o diagnóstico.'), true),
        _css_classes: 'pb-link-title pb-cta-title',
      }),
      b.heading('WhatsApp direto com o Gian', tweak(T.small, { size: 11, line: 1.3 }), 'rgba(255,255,255,.78)'),
    ], 4, { width: fluid('auto'), _flex_size: 'grow' }),
    b.widget('icon', {
      selected_icon: { value: 'fas fa-arrow-right', library: 'fa-solid' },
      view: 'default', primary_color: PB.white, size: px(14),
      _css_classes: 'pb-link-arrow', ...FIXED,
    }),
  ], 14, {
    padding: sides(17, 18),
    ...bg(PB.orange),
    border_radius: sides(8),
    css_classes: 'pb-link pb-link--primary',
    ...reveal(220, 'container'),
  })

  const links = b.col([
    b.heading('Outros caminhos', tweak(T.micro, { size: 9, weight: 700, letter: 0.16 }), PB.slate, {
      _css_classes: 'pb-links-label', ...reveal(250),
    }),
    ...SECONDARY_LINKS.map((item, index) => secondaryRow(b, item, index)),
  ], 0, { padding: sides(28, 0, 0), css_classes: 'pb-links-list' })

  const footer = b.row([
    b.heading('© 2026 ProcessBase', tweak(T.small, { size: 11 }), PB.slate, FIXED),
    b.heading('Estrutura. Ritmo. Crescimento.', tweak(T.small, { size: 11 }), PB.slate, {
      align: 'right', ...FIXED,
    }),
  ], 16, {
    flex_justify_content: 'space-between',
    padding: sides(28, 0, 0),
    margin: sides(10, 0, 0),
    ...border(PB.lineStrong, sides(1, 0, 0, 0)),
    css_classes: 'pb-links-footer',
  })

  const root = b.root([
    b.image('logo/processbase-symbol-mono-white.svg', '', { _css_classes: 'pb-links-watermark' }),
    masthead,
    intro,
    person,
    whatsapp,
    links,
    footer,
  ], {
    background: PB.navy,
    tag: 'main',
    space: 0,
    pad: [32, 28, 22],
    settings: { boxed_width: fluid('min(100%, 480px)'), flex_justify_content: 'center' },
    css: [
      'selector{min-height:100vh;min-height:100svh;position:relative}',
      'selector>.e-con-inner{width:min(100%,480px);max-width:min(100%,480px);min-width:0;align-items:stretch;justify-content:center}',
      'selector>.e-con-inner>*{width:100%;min-width:0;max-width:100%}',
      'selector .e-con,selector .elementor-widget{min-width:0;max-width:100%}',
      texture.hatch('rgba(130,154,175,.07)', '100% 100%', 18, '55% 48%'),
      'selector .pb-links-logo img{display:block;width:142px;height:auto}',
      'selector .pb-links-watermark{position:absolute!important;right:-84px;bottom:6%;width:270px!important;max-width:none!important;margin:0!important;opacity:.035;pointer-events:none}',
      'selector .pb-links-watermark img{display:block;width:100%;height:auto}',
      'selector .pb-links-title{max-width:450px}',
      'selector .pb-links-portrait{width:76px;height:92px;overflow:hidden;clip-path:polygon(0 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%)}',
      'selector .pb-links-portrait img{display:block;width:76px;height:92px;object-fit:cover;object-position:50% 20%;transform:scale(1.5);transform-origin:48% 26%;outline:1px solid rgba(255,255,255,.12);outline-offset:-1px}',
      'selector .pb-link{position:relative}',
      'selector .pb-link .e-con,selector .pb-link .elementor-widget{position:static}',
      'selector .pb-link .pb-link-title a{color:inherit}',
      'selector .pb-link .pb-link-title a::after{content:"";position:absolute;inset:0;z-index:1;border-radius:inherit}',
      'selector .pb-link-detail .elementor-heading-title{overflow-wrap:anywhere}',
      'selector .pb-link-index{width:24px}',
      `selector .pb-link:not(.pb-link--primary):hover{border-color:${PB.slate}}`,
      `selector .pb-link:not(.pb-link--primary):hover .pb-link-arrow .elementor-icon{color:${PB.white}}`,
      `selector .pb-link--primary:hover{background-color:${PB.orangeHover}}`,
      'selector .pb-link a:focus-visible{outline:none}',
      `selector .pb-link:has(a:focus-visible){outline:2px solid ${PB.orange};outline-offset:4px}`,
      `@media(prefers-reduced-motion:no-preference){selector .pb-link{transition-property:border-color,background-color,transform;transition-duration:180ms;transition-timing-function:${PB_EASE}}selector .pb-link .elementor-icon{transition-property:color,transform;transition-duration:180ms;transition-timing-function:${PB_EASE}}selector .pb-link:hover .pb-link-arrow .elementor-icon{transform:translateX(3px)}selector .pb-link:active{transform:scale(.96)}}`,
      '@media(max-width:767px){selector{width:100%!important;max-width:100vw!important}selector>.e-con-inner,selector>.e-con-inner>*{width:100%!important;max-width:100%!important;min-width:0!important}selector .pb-links-place{max-width:120px}selector .pb-links-footer{align-items:flex-end}selector .pb-links-footer>.elementor-widget-heading:last-child{max-width:150px}selector .pb-links-watermark{width:220px!important;right:-86px;bottom:4%}}',
    ].join(''),
  })

  return b.section('ProcessBase · Cartão de links', 'processbase-links', root)
}

export const createProcessBaseLinksTemplate = (): LandingTemplate => ({
  id: 'processbase-links',
  name: 'ProcessBase · Links',
  description: 'Cartão de visita editorial para o link da bio: conversa, Método Base e contato em uma tela.',
  audience: 'ProcessBase',
  sections: [makeCard()],
})
