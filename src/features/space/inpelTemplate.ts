import type { SectionNodeData } from '@/types/space'
import type { LandingTemplate } from './landingTemplates'
import {
  createBuilder, fa, FILL, FIXED, fluid, gap, link, pct, px, sides, T, tweak, typography,
  type ElementorNode, type InpelBuilder,
} from '@/features/inpel/elementor'
import { INPEL as C, INPEL_CONTACT as K, INPEL_FONT as F, INPEL_LAYOUT as L, inpelWhatsApp } from '@/features/inpel/tokens'
import {
  ABOUT, DOWNLOADS, FEEDBACK, HIGHLIGHTS, LEGAL, PARTNERS, POSTS, PRODUCT, PRODUCTS, SEGMENTS, SLIDES,
} from '@/features/inpel/content'

/**
 * Inpel (inpel.com.br) em containers e widgets nativos do Elementor. Cada
 * página do site é um modelo; cada bloco da página, um SectionNodeData.
 * O conteúdo vem da API pública do site (`src/features/inpel/content.ts`).
 */

type JsonRecord = Record<string, unknown>

/** O site troca o topo de desktop pelo de celular abaixo de 992px (Bootstrap 3). */
const DESK = '(min-width:992px)'
const MOBILE = '(max-width:991px)'

const bg = (color: string) => ({ background_background: 'classic', background_color: color })
const border = (color: string, width = sides(1)) => ({ border_border: 'solid', border_width: width, border_color: color })
/** Container interno em 1140px (a .container do Bootstrap), com o próprio fundo de ponta a ponta. */
const band = (b: InpelBuilder, elements: ElementorNode[], settings: JsonRecord = {}) => b.container({
  content_width: 'boxed', boxed_width: px(L.content),
  flex_direction: 'column', flex_gap: gap(0),
  padding: sides(0, L.gutter.desktop, 0, L.gutter.desktop),
  ...settings,
}, elements)
const centered = { align: 'center' } as const

// ── cabeçalho ───────────────────────────────────────────────────────────────

const NAV: Array<[string, string]> = [
  ['Home', '/'], ['Sobre', '/sobre'], ['Caixas de Transmissão', '/segmentos'], ['Carreira', K.careers],
  ['Contato', '/contato'], ['Blog', '/blog'], ['Reclamações/Sugestões', '/sugestoes'],
]

const search = (b: InpelBuilder, options: JsonRecord = {}) => b.widget('search-form', {
  skin: 'classic', placeholder: 'Digite Pesquisa', button_type: 'text', button_text: 'Pesquisar',
  selected_icon: fa('fas fa-search'),
  size: px(40), button_width: { unit: 'px', size: 4, sizes: [] },
  ...typography({ size: 13, weight: 400, line: 18.6 }, 'input_typography'),
  ...typography({ size: 14, weight: 700, line: 20 }, 'button_typography'),
  input_text_color: C.body, input_placeholder_color: '#9A9DA8', input_background_color: C.paper,
  input_border_color: C.line, border_width: sides(1, 0, 1, 1), border_radius: px(L.radius.pill),
  button_text_color: C.paper, button_background_color: C.red, button_text_color_hover: C.paper, button_background_color_hover: C.redDeep,
  _css_classes: 'in-busca',
  ...options,
})

const makeHeader = (prefix: string): SectionNodeData => {
  const b = createBuilder(prefix)
  const contact = b.list([
    { text: K.phone, url: K.phoneHref, icon: 'fas fa-phone-alt' },
    { text: K.email, url: `mailto:${K.email}`, icon: 'far fa-envelope' },
    { text: K.address, url: 'https://www.google.com/maps/search/?api=1&query=Ind%C3%BAstria+de+Pe%C3%A7as+Inpel+Sapucaia+do+Sul', icon: 'fas fa-map-marker-alt' },
  ], {
    view: 'inline', space_between: px(15), icon_size: px(12), text_indent: px(5),
    icon_color: C.red, text_color: C.paper, text_color_hover: C.red,
    ...typography(T.small, 'icon_typography'),
    ...FILL,
  })
  const quote = b.list([{ text: 'Orçamento', url: '/contato', icon: 'fas fa-shopping-cart' }], {
    view: 'inline', icon_size: px(12), text_indent: px(5),
    icon_color: C.red, text_color: C.paper, text_color_hover: C.red,
    ...typography(T.small, 'icon_typography'),
    _element_width: 'auto', ...FIXED,
  })
  const topBar = band(b, [b.row([contact, quote], 15, { flex_justify_content: 'space-between', min_height: px(L.topBar) })], {
    ...bg(C.bar), css_classes: 'in-desk',
  })

  const logo = (width: number) => b.image('brand/inpel-70-anos.jpg', 'Inpel Transmissões Mecânicas, 70 anos', {
    width: px(width), align: 'left', _element_width: 'auto', ...FIXED, link_to: 'custom', link: link('/'), _css_classes: 'in-logo',
  })
  const nav = b.row(NAV.map(([label, url]) => b.heading(label, T.nav, C.ink, {
    link: link(url), title_hover_color: C.red, ...FIXED, _css_classes: 'in-nav-link',
  })), 10, { flex_wrap: 'wrap', padding: sides(10, 0, 0, 0), css_classes: 'in-nav' })
  const mainBar = band(b, [b.row([
    b.col([logo(225)], 0, { width: px(263), ...FIXED, padding: sides(5, 0, 0, 0) }),
    b.col([
      b.container({ flex_direction: 'row', flex_justify_content: 'center', padding: sides(10, 0, 0, 0) }, [search(b, { _element_width: 'initial', _element_custom_width: fluid('min(100%, 520px)') })]),
      nav,
    ], 0, { ...FILL, padding: sides(0, 0, 0, 30) }),
  ], 0, { flex_align_items: 'flex-start', min_height: px(105) })], { css_classes: 'in-desk' })

  // celular e tablet: botão "Menu" que abre a lista (acordeão nativo) e a marca à direita
  const menuPanel = b.col([
    b.list(NAV.map(([text, url]) => ({ text, url })), {
      space_between: px(0), text_color: C.ink, text_color_hover: C.red,
      ...typography(tweak(T.nav, { size: 16, line: 24 }), 'icon_typography'),
      divider: 'yes', divider_color: C.line, _css_classes: 'in-menu-links',
    }),
    search(b, { _margin: sides(15, 0, 0, 0) }),
  ], 0, { padding: sides(10, 15, 20, 15), ...bg(C.paper) })
  const menu = b.container({ flex_direction: 'column', width: fluid('auto'), ...FILL }, [])
  const accordion = b.widget('nested-accordion', {
    items: [{ _id: `${prefix}m`, item_title: 'Menu' }],
    default_state: 'all_collapsed', max_items_expended: 'one',
    ...typography({ size: 14, weight: 400, line: 20 }, 'title_typography'),
    normal_title_color: C.paper,
    _css_classes: 'in-menu',
  })
  accordion.elements = [menuPanel]
  menu.elements = [accordion]
  const mobileBar = b.container({
    flex_direction: 'row', flex_wrap: 'nowrap', flex_align_items: 'flex-start', min_height: px(80), css_classes: 'in-mob', padding: sides(0, 8, 0, 8),
  }, [menu, logo(180)])

  const root = b.root([topBar, mainBar, mobileBar], {
    tag: 'header', pad: false,
    settings: {
      content_width: 'full', padding: sides(0), padding_tablet: sides(0), padding_mobile: sides(0),
      ...border(C.line, sides(3, 0, 2, 0)),
    },
    css: [
      `selector{border-top-color:${C.red}!important}`,
      `@media ${MOBILE}{selector .in-desk{display:none!important}selector{border-width:0!important}}`,
      `@media ${DESK}{selector .in-mob{display:none!important}}`,
      'selector .in-logo img{display:block}',
      // sublinhado vermelho que cresce no hover, como o .main-nav do tema
      `selector .in-nav-link .elementor-heading-title a{display:block;position:relative;padding:10px 8px}selector .in-nav-link .elementor-heading-title a::after{content:"";position:absolute;left:0;bottom:0;height:2px;width:0;background:${C.red};transition:width .2s}selector .in-nav-link .elementor-heading-title a:hover::after{width:100%}`,
      '@media (prefers-reduced-motion:reduce){selector .in-nav-link .elementor-heading-title a::after{transition:none}}',
      // busca: pílula com o botão vermelho colado à direita
      'selector .in-busca .elementor-search-form__submit{border-radius:0 40px 40px 0;margin-block:-1px}',
      'selector .in-busca .elementor-search-form__submit i{font-size:13px}',
      // botão "Menu": cinza do Bootstrap, raio de 4px, margem de 10px
      'selector .in-menu .e-n-accordion-item-title{display:inline-flex;margin:10px;padding:6px 12px;border:0;border-radius:4px;background:#6C757D;gap:6px}',
      'selector .in-menu .e-n-accordion-item-title-icon{display:none}',
      'selector .in-menu .e-n-accordion-item-title-header::before{content:"\\f0c9";font-family:"Font Awesome 5 Free";font-weight:900;margin-right:6px}',
      'selector .in-menu .e-n-accordion-item-title-header{display:flex;align-items:center}',
      'selector .in-menu .e-n-accordion-item>.e-con{border:0;position:absolute;left:0;right:0;top:80px;z-index:50;box-shadow:0 10px 24px rgba(21,22,29,.12)}',
      `selector .in-menu-links .elementor-icon-list-item{padding-block:12px!important;margin:0!important}`,
      'selector .in-mob{position:relative}selector .in-mob .in-logo{margin-left:auto}',
      'selector .in-mob .in-logo img{width:180px;max-width:46vw}',
    ].join(''),
  })
  return b.section('Inpel · Cabeçalho', 'inpel-cabecalho', root)
}

/** Faixa cinza com a trilha "HOME / PÁGINA" das páginas internas. */
const makeBreadcrumb = (prefix: string, current: string, trail: Array<[string, string]> = []): SectionNodeData => {
  const b = createBuilder(prefix)
  const crumb = (label: string, url?: string) => b.heading(label, tweak(T.small, { transform: 'uppercase' }), url ? C.muted : C.body, {
    ...(url ? { link: link(url), title_hover_color: C.red } : {}), ...FIXED,
  })
  const slash = () => b.heading('/', T.small, C.muted, FIXED)
  const items = [crumb('Home', '/'), ...trail.flatMap(([label, url]) => [slash(), crumb(label, url)]), slash(), crumb(current)]
  const root = b.root([b.row(items, 10, { flex_wrap: 'wrap' })], {
    tag: 'nav',
    settings: {
      ...bg(C.mist), ...border(C.line, sides(0, 0, 1, 0)),
      margin: sides(0, 0, 30, 0), aria_label: 'Você está em',
    },
  })
  return b.section(`Inpel · Trilha (${current.toLowerCase()})`, `inpel-trilha-${prefix}`, root)
}

// ── rodapé ──────────────────────────────────────────────────────────────────

const FOOTER_COLUMNS: Array<[string, Array<[string, string]>]> = [
  ['Institucional', [['Sobre', '/sobre'], ['Caixas de Transmissão', '/segmentos'], ['Blog', '/blog'], ['Manual de Produto', K.manual]]],
  ['Contato', [['Carreira', K.careers], ['Contato', '/contato'], ['Reclamações/Sugestões', '/sugestoes']]],
  ['LGPD', LEGAL.map((item) => [item.title, item.url] as [string, string])],
]

const makeFooter = (prefix: string): SectionNodeData => {
  const b = createBuilder(prefix)
  const title = (label: string) => b.heading(label, T.label, C.paper, { header_size: 'h3', _margin: sides(0, 0, 30, 0) })
  const links = (items: Array<{ text: string; url?: string; icon?: string }>) => b.list(items, {
    space_between: px(15), icon_size: px(14), text_indent: px(items.some((item) => item.icon) ? 15 : 0), icon_color: C.red,
    text_color: C.footerText, text_color_hover: C.red,
    ...typography(T.bodyMedium, 'icon_typography'),
  })
  const first = b.col([
    title('Inpel'),
    b.text(`<p>${K.addressLines[0]}</p><p>${K.addressLines[1]}</p><p>Fone: (51)3034-3000</p>`, T.body, C.footerText),
    links([
      { text: '(51)99831-4010 (setor de vendas)', url: inpelWhatsApp, icon: 'fab fa-whatsapp' },
      { text: K.email, url: `mailto:${K.email}`, icon: 'far fa-envelope' },
    ]),
  ])
  const columns = FOOTER_COLUMNS.map(([label, items]) => b.col([title(label), links(items.map(([text, url]) => ({ text, url })))]))
  const main = band(b, [b.grid([first, ...columns], 'repeat(4, minmax(0, 1fr))', [30, 30], {}, { tablet: 'repeat(2, minmax(0, 1fr))', mobile: '1fr' })], {
    ...bg(C.footer), padding: sides(60, 15, 60, 15),
  })
  const credit = band(b, [b.image('brand/avance-digital.png', 'Avance Digital', {
    width: px(43), align: 'center', link_to: 'custom', link: link(K.agency),
  })], { ...bg(C.bar), padding: sides(26, 15, 24, 15) })
  const root = b.root([main, credit], {
    tag: 'footer', pad: false,
    settings: { content_width: 'full', padding: sides(0), padding_tablet: sides(0), padding_mobile: sides(0), ...bg(C.footer) },
    css: 'selector .elementor-widget-text-editor p,selector .elementor-widget-text-editor p:last-child{margin:0 0 5px}selector .elementor-icon-list-icon i{width:14px;text-align:center}',
  })
  return b.section('Inpel · Rodapé', 'inpel-rodape', root)
}

/** "Atendimento via WhatsApp": selo fixo no canto esquerdo, como no site. */
const makeWhatsApp = (): SectionNodeData => {
  const b = createBuilder('iwa')
  const badge = b.image('brand/atendimento-whatsapp.png', 'Atendimento via WhatsApp', {
    width: px(200), link_to: 'custom', link: link(inpelWhatsApp, true), _css_classes: 'in-wa',
  })
  const root = b.root([badge], {
    tag: 'div', pad: false, background: 'transparent',
    settings: { content_width: 'full', padding: sides(0), padding_tablet: sides(0), padding_mobile: sides(0) },
    css: [
      'selector{position:fixed!important;left:0;bottom:2%;top:auto;z-index:900;width:auto!important;max-width:none;background:transparent!important;overflow:visible}',
      'selector .in-wa img{display:block;transition:transform .2s ease}',
      '@media (hover:hover){selector .in-wa a:hover img{transform:translateX(4px)}}',
      '@media (max-width:767px){selector .in-wa img{width:160px}}',
      '@media (prefers-reduced-motion:reduce){selector .in-wa img{transition:none}}',
    ].join(''),
  })
  return b.section('Inpel · WhatsApp flutuante', 'inpel-whatsapp', root)
}

// ── cartões ─────────────────────────────────────────────────────────────────

/** Contorno de 1px que vira vermelho no hover (o .product do tema). */
const CARD_CSS = [
  `selector .in-card{box-shadow:0 0 0 1px ${C.line};transition:box-shadow .2s}`,
  `selector .in-card:hover{box-shadow:0 0 6px 0 ${C.line},0 0 0 2px ${C.red}}`,
  'selector .in-card .elementor-widget-image{overflow:hidden}',
  `selector .in-card .elementor-heading-title a{color:inherit}`,
  `selector .in-card .elementor-heading-title a:hover{color:${C.red}}`,
  `selector .in-tag{position:absolute;top:15px;right:15px;z-index:2}`,
  '@media (prefers-reduced-motion:reduce){selector .in-card{transition:none}}',
].join('')

interface CardSpec { name: string; url: string; image: string; category?: string; tag?: string | null; imageHeight?: number }

const card = (b: InpelBuilder, spec: CardSpec) => {
  const tag = spec.tag ? [b.heading(spec.tag, { size: 13, weight: 500, line: 16, transform: 'uppercase' }, C.paper, {
    _background_background: 'classic', _background_color: C.red, _padding: sides(3, 12, 3, 12),
    _element_width: 'auto', _css_classes: 'in-tag',
  })] : []
  return b.col([
    ...tag,
    b.image(spec.image, spec.name, {
      link_to: 'custom', link: link(spec.url),
      width: pct(100),
      ...(spec.imageHeight ? { height: px(spec.imageHeight), 'object-fit': 'cover' } : {}),
    }),
    b.col([
      b.heading(spec.category ?? 'Caixas de Transmissão', T.category, C.muted, { align: 'center', _margin: sides(0, 0, 5, 0) }),
      b.heading(spec.name, T.product, C.ink, { header_size: 'h3', align: 'center', link: link(spec.url) }),
    ], 0, { padding: sides(15), ...bg(C.paper), min_height: px(110) }),
  ], 0, { position: 'relative', css_classes: 'in-card', ...bg(C.paper) })
}

const segmentCard = (b: InpelBuilder, item: (typeof SEGMENTS)[number]) => card(b, { ...item, imageHeight: 160 })

// ── home ────────────────────────────────────────────────────────────────────

const carousel = (b: InpelBuilder, slides: ElementorNode[], settings: JsonRecord) => {
  const node = b.widget('nested-carousel', {
    carousel_name: 'Carrossel',
    carousel_items: slides.map((_, i) => ({ _id: `s${i}`, slide_title: `Slide #${i + 1}` })),
    autoplay: 'yes', autoplay_speed: 5000, pause_on_hover: 'yes', infinite: 'yes', speed: 500,
    ...settings,
  })
  node.elements = slides
  return node
}

const makeSlider = (): SectionNodeData => {
  const b = createBuilder('isl')
  const slides = SLIDES.map((slide) => b.col([b.image(slide.image, slide.name, { width: pct(100) })]))
  const root = b.root([carousel(b, slides, {
    slides_to_show: '1', slides_to_show_tablet: '1', slides_to_show_mobile: '1',
    image_spacing_custom: px(0),
    arrows: 'yes', arrows_size: px(20), arrow_normal_color: C.paper, arrow_hover_color: C.paper,
    navigation_previous_icon_horizontal_position: px(98), navigation_next_icon_horizontal_position: px(98),
    pagination: 'bullets', dots_position: 'inside', dots_vertical_position: 'bottom', dots_vertical_offset: px(-20),
    dots_size: px(10), dots_normal_color: 'transparent', dots_hover_color: C.paper,
  })], {
    pad: false,
    settings: { content_width: 'full', padding: sides(0), padding_tablet: sides(0), padding_mobile: sides(0) },
    css: [
      'selector .swiper-slide img{display:block;width:100%}',
      'selector .elementor-swiper-button{filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}',
      `selector .swiper-pagination{gap:2px!important}selector .swiper-pagination-bullet{border:1px solid ${C.paper};opacity:1}`,
      'selector .swiper-pagination-bullet-active{width:12px!important;height:12px!important}',
      '@media (max-width:767px){selector .elementor-swiper-button{display:none}}',
    ].join(''),
  })
  return b.section('Inpel · Slider', 'inpel-slider', root)
}

const makeHighlights = (): SectionNodeData => {
  const b = createBuilder('ide')
  const cards = HIGHLIGHTS.map((item) => b.col([
    b.image(item.image, '', { width: pct(100), height: px(253), 'object-fit': 'cover', _css_classes: 'in-shop-img' }),
    b.col([
      b.heading(item.name, T.shop, C.paper, { header_size: 'h3', _margin: sides(0, 0, 10, 0) }),
      b.widget('button', {
        text: 'Saiba mais', link: link(item.url), selected_icon: fa('fas fa-arrow-circle-right'), icon_align: 'row-reverse', icon_indent: px(5),
        ...typography({ size: 14, weight: 500, line: 20, transform: 'uppercase' }),
        button_text_color: C.paper, background_color: 'transparent', hover_color: C.paper,
        text_padding: sides(0), _css_classes: 'in-shop-cta',
      }),
    ], 0, { padding: sides(30), css_classes: 'in-shop-body' }),
  ], 0, { position: 'relative', css_classes: 'in-shop', overflow: 'hidden' }))
  const root = b.root([b.grid(cards, 'repeat(3, minmax(0, 1fr))', 30, { padding: sides(15, 0, 15, 0) }, { tablet: 'repeat(3, minmax(0, 1fr))', mobile: '1fr' })], {
    css: [
      // as duas faixas vermelhas inclinadas a 45° (o .shop::before/::after do tema)
      'selector .in-shop{isolation:isolate}',
      `selector .in-shop::before,selector .in-shop::after{content:"";position:absolute;top:0;bottom:0;background:${C.red};opacity:.9;z-index:1;pointer-events:none;transition:transform .2s}`,
      'selector .in-shop::before{left:0;width:60%;transform:skewX(-45deg)}',
      'selector .in-shop::after{left:1px;right:-1px;transform:skewX(-45deg) translateX(-100%)}',
      'selector .in-shop-body{position:absolute!important;top:0;left:0;z-index:2;max-width:270px}',
      'selector .in-shop-img img{display:block;transition:transform .2s}',
      '@media (hover:hover){selector .in-shop:hover .in-shop-img img{transform:scale(1.1)}}',
      'selector .in-shop-cta .elementor-button:hover .elementor-button-icon{transform:translateX(3px)}selector .in-shop-cta .elementor-button-icon{transition:transform .2s}',
      '@media (prefers-reduced-motion:reduce){selector .in-shop-img img,selector .in-shop-cta .elementor-button-icon{transition:none}selector .in-shop:hover .in-shop-img img{transform:none}}',
    ].join(''),
  })
  return b.section('Inpel · Destaques', 'inpel-destaques', root)
}

const makeSegmentsCarousel = (): SectionNodeData => {
  const b = createBuilder('icx')
  const root = b.root([
    b.heading('Caixas de Transmissão', T.titleCaps, C.ink, { header_size: 'h2', ...centered, _margin: sides(15, 0, 30, 0) }),
    carousel(b, SEGMENTS.map((item) => b.col([segmentCard(b, item)], 0, { padding: sides(25, 10, 25, 10) })), {
      slides_to_show: '4', slides_to_show_tablet: '3', slides_to_show_mobile: '1',
      slides_to_scroll: '4', slides_to_scroll_tablet: '3', slides_to_scroll_mobile: '1',
      image_spacing_custom: px(0),
      arrows: 'yes', arrows_size: px(14), arrow_normal_color: '#000000', arrow_hover_color: C.red,
      navigation_previous_icon_horizontal_position: px(-28), navigation_next_icon_horizontal_position: px(-28),
      pagination: 'bullets', dots_size: px(10), dots_normal_color: '#EFEFEF', dots_hover_color: '#000000', dots_pagination_spacing: px(60),
    }),
  ], {
    pad: [30, 40],
    css: [
      CARD_CSS,
      'selector .elementor-widget-nested-carousel{overflow:visible}',
      'selector .swiper-pagination-bullet{opacity:1;margin:10px}',
      '@media (max-width:1199px){selector .elementor-swiper-button-prev{left:-10px!important}selector .elementor-swiper-button-next{right:-10px!important}}',
    ].join(''),
  })
  return b.section('Inpel · Caixas de transmissão (carrossel)', 'inpel-caixas-carrossel', root)
}

const postCard = (b: InpelBuilder, post: (typeof POSTS)[number]) => b.col([
  b.image(post.image, post.title, { width: pct(100), link_to: 'custom', link: link(post.url) }),
  b.heading(post.title, T.post, C.ink, { header_size: 'h3', ...centered, link: link(post.url), title_hover_color: C.red, _padding: sides(10, 0, 0, 0), _margin: sides(0, 0, 5, 0) }),
], 0, { css_classes: 'in-post' })

const POST_CSS = 'selector .in-post .elementor-widget-image img{display:block;transition:opacity .2s}@media (hover:hover){selector .in-post .elementor-widget-image a:hover img{opacity:.88}}'

const makePostsGrid = (title: string, prefix: string, heading: 'h2' | 'h1' = 'h2'): SectionNodeData => {
  const b = createBuilder(prefix)
  const root = b.root([
    b.heading(title, T.title, C.ink, { header_size: heading, ...centered, _margin: sides(heading === 'h1' ? 13 : 0, 0, 40, 0) }),
    b.grid(POSTS.map((post) => postCard(b, post)), 'repeat(3, minmax(0, 1fr))', [heading === 'h1' ? 48 : 0, 30], {}, { tablet: 'repeat(2, minmax(0, 1fr))', mobile: '1fr' }),
  ], { css: POST_CSS })
  return b.section(heading === 'h1' ? 'Inpel · Blog' : 'Inpel · Últimos posts', heading === 'h1' ? 'inpel-blog' : 'inpel-ultimos-posts', root)
}

const makeSocial = (): SectionNodeData => {
  const b = createBuilder('ire')
  const icons = b.widget('social-icons', {
    social_icon_list: [
      ['fab fa-facebook-f', K.social.facebook], ['fab fa-linkedin-in', K.social.linkedin],
      ['fab fa-instagram', K.social.instagram], ['fab fa-youtube', K.social.youtube],
    ].map(([icon, url], i) => ({ _id: `r${i}`, social_icon: fa(icon), link: link(url, true) })),
    shape: 'square', align: 'center', icon_size: px(14), icon_padding: { unit: 'em', size: 0.93, sizes: [] }, icon_spacing: px(5),
    icon_color: 'custom', icon_primary_color: C.paper, icon_secondary_color: C.ink,
    image_border_border: 'solid', image_border_width: sides(1), image_border_color: C.line,
    hover_primary_color: C.red, hover_secondary_color: C.paper, hover_border_color: C.red,
  })
  const root = b.root([
    b.heading('Encontre a Inpel nas Redes', { size: 24, mobile: 20, weight: 700, line: 34.3 }, C.body, { header_size: 'h2', ...centered, _margin: sides(0, 0, 10, 0) }),
    icons,
  ], {
    pad: [32, 33],
    settings: { ...border(C.line, sides(2, 0, 0, 0)), margin: sides(30, 0, 0, 0) },
    css: 'selector .elementor-social-icon{width:40px;height:40px;transition:background-color .2s,border-color .2s}selector .elementor-social-icon i{color:var(--e-social-icon-icon-color)}',
  })
  return b.section('Inpel · Redes sociais', 'inpel-redes', root)
}

// ── páginas internas ────────────────────────────────────────────────────────

const pageTitle = (b: InpelBuilder, title: string, options: JsonRecord = {}) =>
  b.heading(title, T.title, C.ink, { header_size: 'h1', ...options })

const makeAbout = (): SectionNodeData => {
  const b = createBuilder('iap')
  const root = b.root([b.grid([
    b.col([
      pageTitle(b, ABOUT.title, { _margin: sides(0, 0, 10, 0) }),
      b.text(ABOUT.html, T.body, C.body, { _margin: sides(18, 0, 0, 0), _css_classes: 'in-rich' }),
    ]),
    b.image(ABOUT.image, 'Fachada da fábrica da Inpel em Sapucaia do Sul', { width: pct(100) }),
  ], 'repeat(2, minmax(0, 1fr))', [30, 30], {}, { tablet: '1fr', mobile: '1fr' })], {
    css: 'selector .in-rich strong{font-weight:700}selector .in-rich p{text-align:justify}',
  })
  return b.section('Inpel · Apresentação', 'inpel-apresentacao', root)
}

const sectionTitle = (b: InpelBuilder, title: string) => b.heading(title, T.title, C.ink, { header_size: 'h2', ...centered, _margin: sides(0, 0, 31, 0) })

const makeVideo = (): SectionNodeData => {
  const b = createBuilder('ivi')
  const root = b.root([
    sectionTitle(b, ABOUT.videoTitle),
    b.container({ flex_direction: 'row', flex_justify_content: 'center' }, [b.widget('video', {
      video_type: 'youtube', youtube_url: ABOUT.video, aspect_ratio: '169',
      _element_width: 'initial', _element_custom_width: fluid('min(100%, 660px)'),
      _border_border: 'solid', _border_width: sides(1), _border_color: '#CCCCCC',
    })]),
  ], { pad: [45, 45] })
  return b.section('Inpel · Vídeo institucional', 'inpel-video', root)
}

const makeDownloads = (): SectionNodeData => {
  const b = createBuilder('idl')
  const root = b.root([
    sectionTitle(b, 'Downloads'),
    b.grid(DOWNLOADS.map((item) => b.image(item.image, item.name, {
      width: pct(100), link_to: 'custom', link: link(item.url, true), _css_classes: 'in-download',
    })), 'repeat(2, minmax(0, 1fr))', [30, 30], {}, { tablet: 'repeat(2, minmax(0, 1fr))', mobile: '1fr' }),
  ], { css: 'selector .in-download img{transition:transform .2s}@media (hover:hover){selector .in-download a:hover img{transform:scale(1.02)}}@media (prefers-reduced-motion:reduce){selector .in-download img{transition:none}selector .in-download a:hover img{transform:none}}' })
  return b.section('Inpel · Downloads', 'inpel-downloads', root)
}

const makePartners = (): SectionNodeData => {
  const b = createBuilder('ipa')
  const slides = PARTNERS.map((partner) => b.col([b.image(partner.image, partner.name, {
    width: pct(100), image_border_border: 'solid', image_border_width: sides(1), image_border_color: '#D7D7D7',
  })], 0, { padding: sides(0, 10, 0, 10) }))
  const root = b.root([
    sectionTitle(b, 'Parceiros Inpel'),
    carousel(b, slides, {
      slides_to_show: '6', slides_to_show_tablet: '4', slides_to_show_mobile: '2',
      slides_to_scroll: '6', slides_to_scroll_tablet: '4', slides_to_scroll_mobile: '2',
      image_spacing_custom: px(0), arrows: '', pagination: 'bullets',
      dots_size: px(10), dots_normal_color: '#EFEFEF', dots_hover_color: '#000000', dots_pagination_spacing: px(30),
    }),
  ], {
    pad: [30, 40],
    css: 'selector .swiper-slide{align-items:flex-start}selector .swiper-slide img{display:block}selector .swiper-pagination-bullet{opacity:1;margin:0 10px}',
  })
  return b.section('Inpel · Parceiros', 'inpel-parceiros', root)
}

/** Coluna "CATEGORIAS" do catálogo: um link por aplicação, marcado quando é a atual. */
const categoryAside = (b: InpelBuilder, current?: string) => b.col([
  b.heading('Categorias', T.label, C.ink, { header_size: 'h2', _margin: sides(15, 0, 30, 0) }),
  b.list([{ text: 'Linha completa', url: '/segmentos' }, ...SEGMENTS.map((item) => ({ text: item.name, url: item.url }))].map((item) => ({
    ...item, icon: item.text === current ? 'fas fa-check-square' : 'far fa-square',
  })), {
    space_between: px(17), icon_size: px(14), text_indent: px(6),
    icon_color: C.line, icon_color_hover: C.red, text_color: C.ink, text_color_hover: C.red,
    ...typography({ size: 13, weight: 500, line: 18.6, transform: 'uppercase' }, 'icon_typography'),
    icon_self_vertical_align: 'flex-start', _css_classes: 'in-categorias',
  }),
], 0, { width: px(263), ...FIXED, css_classes: 'in-aside' })

const CATALOG_CSS = [
  CARD_CSS,
  `selector .in-categorias .elementor-icon-list-item:has(.fa-check-square) i{color:${C.red}}`,
  'selector .in-categorias .elementor-icon-list-icon{margin-top:2px}',
  '@media (max-width:1024px){selector .in-aside{width:100%!important}selector .in-catalogo{flex-direction:column!important}}',
].join('')

const makeCatalog = (): SectionNodeData => {
  const b = createBuilder('ica')
  const main = b.col([
    pageTitle(b, 'Caixas de Transmissão', { _margin: sides(62, 0, 15, 0), _margin_tablet: sides(15, 0, 15, 0) }),
    b.grid(SEGMENTS.map((item) => segmentCard(b, item)), 'repeat(3, minmax(0, 1fr))', [30, 30], { padding: sides(15, 0, 0, 0) }, { tablet: 'repeat(3, minmax(0, 1fr))', mobile: '1fr' }),
  ], 0, FILL)
  const root = b.root([b.row([categoryAside(b), main], 30, { flex_align_items: 'flex-start', css_classes: 'in-catalogo' })], {
    pad: [30, 60], css: CATALOG_CSS,
  })
  return b.section('Inpel · Catálogo de aplicações', 'inpel-catalogo', root)
}

const makeProducts = (): SectionNodeData => {
  const b = createBuilder('ipr')
  const main = b.col([
    pageTitle(b, 'Roçadeiras', { _margin: sides(87, 0, 15, 0), _margin_tablet: sides(15, 0, 15, 0), typography_text_transform: 'uppercase' }),
    b.grid(PRODUCTS.map((item) => card(b, { ...item })), 'repeat(3, minmax(0, 1fr))', [30, 30], { padding: sides(15, 0, 0, 0) }, { tablet: 'repeat(3, minmax(0, 1fr))', mobile: '1fr' }),
  ], 0, FILL)
  const root = b.root([b.row([categoryAside(b, 'ROÇADEIRAS'), main], 30, { flex_align_items: 'flex-start', css_classes: 'in-catalogo' })], {
    pad: [30, 45], css: CATALOG_CSS,
  })
  return b.section('Inpel · Produtos de uma aplicação', 'inpel-produtos', root)
}

const makeProduct = (): SectionNodeData => {
  const b = createBuilder('ipd')
  const heading = (label: string) => b.heading(label, { size: 16, weight: 700, line: 18, transform: 'uppercase' }, C.ink, { header_size: 'h2', _margin: sides(30, 0, 15, 0) })
  const fileRow = (name: string, url: string) => b.row([
    b.heading(name, tweak(T.bodyMedium, { weight: 400, transform: 'uppercase', line: 17 }), C.body, FIXED),
    b.heading('Clique aqui', tweak(T.bodyMedium, { transform: 'uppercase', line: 17 }), C.red, { link: link(url, true), title_hover_color: C.redDeep, ...FIXED }),
  ], 28, { flex_wrap: 'wrap' })
  const gallery = b.col([
    b.image(PRODUCT.gallery[0], PRODUCT.name, { width: pct(100) }),
    b.row(PRODUCT.gallery.map((file, i) => b.image(file, `${PRODUCT.name}, foto ${i + 1}`, {
      width: px(74), height: px(58), 'object-fit': 'cover', link_to: 'file', open_lightbox: 'yes',
      image_border_border: 'solid', image_border_width: sides(2), image_border_color: C.red, ...FIXED,
    })), 2, { flex_wrap: 'wrap', margin: sides(15, 0, 0, 0) }),
    b.text(`<p><strong>${PRODUCT.note}</strong></p>`, T.body, C.body, { _margin: sides(15, 0, 0, 0) }),
  ], 0, { css_classes: 'in-galeria' })
  const info = b.col([
    b.row([
      b.heading(PRODUCT.name, { size: 16, weight: 700, line: 18, transform: 'uppercase' }, C.ink, { header_size: 'h1', ...FILL }),
      b.heading('Voltar', T.body, C.body, { link: link('/produtos/24/ROÇADEIRAS'), title_hover_color: C.red, ...FIXED }),
    ], 20, { flex_align_items: 'flex-start', margin: sides(0, 0, 10, 0) }),
    ...PRODUCT.files.map((file) => fileRow(file.name, file.url)),
    heading('Aplicações'),
    b.text(PRODUCT.summary, T.body, C.body),
    heading('Descrição'),
    b.text(PRODUCT.html, T.body, C.body, { _css_classes: 'in-rich' }),
  ], 0, FILL)
  const top = b.grid([gallery, info], '5fr 7fr', [30, 30], { padding: sides(15, 0, 45, 0) }, { tablet: '1fr', mobile: '1fr' })

  const tab = b.row([
    b.divider(),
    b.heading('Monte a sua caixa', tweak(T.bodyMedium, { weight: 700, transform: 'uppercase' }), C.red, {
      header_size: 'h2', ...FIXED, _padding: sides(0, 0, 4, 0), _border_border: 'solid', _border_width: sides(0, 0, 2, 0), _border_color: C.red,
    }),
    b.divider(),
  ], 15)
  const fields = Object.entries(PRODUCT.options).map(([label, options], i) => ({
    _id: `f${i}`, custom_id: `campo_${i + 1}`, field_type: 'select', field_label: label, required: 'true',
    field_options: ['Selecione', ...options].join('\n'), width: '100',
  }))
  const form = b.widget('form', {
    form_name: `Orçamento ${PRODUCT.name}`, form_fields: [
      ...fields,
      { _id: 'fprod', custom_id: 'produto', field_type: 'hidden', field_value: PRODUCT.name },
    ],
    show_labels: 'yes', input_size: 'sm',
    button_text: 'Incluir lista de orçamento', button_size: 'sm', button_width: '100', button_align: 'center',
    email_to: K.email, email_subject: `Orçamento ${PRODUCT.name} pelo site`,
    success_message: 'Recebemos seu pedido de orçamento. O comercial da Inpel entra em contato.',
    column_gap: px(10), row_gap: px(18), label_spacing: px(8),
    label_color: C.ink, ...typography({ size: 17, weight: 700, line: 19 }, 'label_typography'),
    field_text_color: C.body, field_background_color: C.paper, field_border_color: C.line, field_border_width: sides(1), field_border_radius: sides(0),
    ...typography({ size: 14, weight: 400, line: 20 }, 'field_typography'),
    button_background_color: C.red, button_text_color: C.paper, button_background_hover_color: C.redDeep,
    ...typography({ size: 13, weight: 700, line: 16, transform: 'uppercase' }, 'button_typography'),
    button_border_radius: sides(L.radius.pill), button_text_padding: sides(12, 28, 12, 28),
    _css_classes: 'in-monte',
  })
  const builder = b.col([
    tab,
    b.text(PRODUCT.config, T.body, C.body, { _margin: sides(30, 0, 25, 0), _css_classes: 'in-rich in-passos' }),
    b.grid([
      b.image(PRODUCT.table, `Tabela de construção da ${PRODUCT.name}: tipo, relação, eixos e sentido de giro`, { width: pct(100) }),
      form,
    ], '3fr 1fr', [30, 30], {}, { tablet: '1fr', mobile: '1fr' }),
  ])
  const root = b.root([top, builder], {
    pad: [30, 60],
    css: [
      'selector .in-rich strong{font-weight:700}selector .in-rich p{text-align:justify}',
      `selector .in-passos .in-alerta{color:${C.red}}selector .in-passos p{line-height:22px}`,
      'selector .in-galeria .elementor-widget-image a img{cursor:zoom-in}',
      'selector .in-monte .elementor-field-type-submit{margin-top:12px}',
    ].join(''),
  })
  return b.section('Inpel · Detalhe do produto', 'inpel-produto', root)
}

const makePost = (): SectionNodeData => {
  const post = POSTS[0]
  const b = createBuilder('ipo')
  const [year, month, day] = post.date.split('-')
  const root = b.root([
    pageTitle(b, post.title, { ...centered, typography_text_transform: 'uppercase' }),
    b.heading(`${day}/${month}/${year}`, T.small, C.body, { ...centered, _margin: sides(10, 0, 30, 0), typography_font_weight: '400' }),
    b.grid([
      b.image(post.image, post.title, { width: pct(100) }),
      b.text(post.html, T.body, C.body, { _css_classes: 'in-rich', link_color: C.link }),
    ], '1fr 1fr', [30, 30], {}, { tablet: '1fr', mobile: '1fr' }),
    b.heading('Voltar', { size: 18, weight: 400, line: 25.7 }, C.body, { ...centered, link: link('/blog'), title_hover_color: C.red, _margin: sides(40, 0, 0, 0) }),
  ], {
    pad: [30, 60],
    css: `selector .in-rich p{text-align:justify;overflow-wrap:anywhere}selector .in-rich a{color:${C.link}}selector .in-rich a:hover{text-decoration:underline}`,
  })
  return b.section('Inpel · Post', 'inpel-post', root)
}

const contactFields = (withMessageFirst = false) => {
  const message = { _id: 'fmsg', custom_id: 'mensagem', field_type: 'textarea', placeholder: 'Mensagem', field_label: 'Mensagem', rows: 4, width: '100' }
  const rest = [
    { _id: 'fnom', custom_id: 'nome', field_type: 'text', placeholder: 'Nome', field_label: 'Nome', required: 'true', width: '100' },
    { _id: 'fema', custom_id: 'email', field_type: 'email', placeholder: 'E-mail', field_label: 'E-mail', required: 'true', width: '100' },
    { _id: 'ftel', custom_id: 'telefone', field_type: 'tel', placeholder: 'Telefone', field_label: 'Telefone', width: '100' },
  ]
  return withMessageFirst ? [message, ...rest] : [...rest, message]
}

const formStyle = (subject: string): JsonRecord => ({
  show_labels: '', input_size: 'sm', button_size: 'sm', button_width: '', button_align: 'start',
  email_to: K.email, email_subject: subject,
  column_gap: px(0), row_gap: px(15),
  field_text_color: C.body, field_background_color: C.paper, field_border_color: C.line, field_border_width: sides(1), field_border_radius: sides(0),
  ...typography({ size: 20, weight: 400, line: 24 }, 'field_typography'),
  button_background_color: C.red, button_text_color: C.paper, button_background_hover_color: C.redDeep,
  ...typography({ size: 14, weight: 700, line: 20, transform: 'uppercase' }, 'button_typography'),
  button_border_radius: sides(L.radius.pill), button_text_padding: sides(12, 30, 12, 30),
  _css_classes: 'in-form',
})

const FORM_CSS = [
  'selector .in-form .elementor-field-textual{min-height:40px;padding:6px 15px}',
  'selector .in-form textarea.elementor-field-textual{font-size:14px;padding-top:15px;min-height:90px}',
  'selector .in-form .elementor-field-textual::placeholder{color:#8B8B8B;opacity:1}',
  'selector .in-form .elementor-field-textual:focus{border-color:#B9BABC;box-shadow:none}',
  'selector .in-form .elementor-field-type-submit{margin-top:10px}',
  'selector .in-form .elementor-button{min-width:116px;transition:background-color .2s}',
].join('')

const makeContact = (): SectionNodeData => {
  const b = createBuilder('ico')
  const left = b.col([
    pageTitle(b, 'Fale conosco', { typography_font_size: px(25), typography_text_transform: 'uppercase', _margin: sides(0, 0, 25, 0) }),
    b.list([
      { text: K.whatsappLabel, url: inpelWhatsApp, icon: 'fab fa-whatsapp' },
      { text: K.email, url: `mailto:${K.email}`, icon: 'far fa-envelope' },
    ], {
      space_between: px(15), icon_size: px(14), text_indent: px(15), icon_color: C.red,
      text_color: C.muted, text_color_hover: C.red, ...typography(tweak(T.body, { size: 15 }), 'icon_typography'),
      _margin: sides(0, 0, 25, 0),
    }),
    b.widget('form', { form_name: 'Fale conosco', form_fields: contactFields(), button_text: 'Enviar', success_message: 'Mensagem enviada. Obrigado pelo contato!', ...formStyle('Contato pelo site da Inpel') }),
  ])
  const right = b.col([
    b.heading('Onde estamos', { size: 25, weight: 700, line: 27.5, transform: 'uppercase' }, C.ink, { header_size: 'h2', ...centered, _margin: sides(0, 0, 10, 0) }),
    b.widget('google_maps', { address: K.maps, zoom: { unit: 'px', size: 16, sizes: [] }, height: px(350) }),
  ], 0, { padding: sides(30, 30, 60, 30), ...border(C.line) })
  const root = b.root([b.grid([left, right], '1fr 1fr', [30, 30], { padding: sides(15, 0, 0, 0) }, { tablet: '1fr', mobile: '1fr' })], {
    pad: [15, 30], css: FORM_CSS + 'selector .elementor-widget-google_maps iframe{height:350px;display:block}',
  })
  return b.section('Inpel · Fale conosco', 'inpel-contato', root)
}

const makeFeedback = (): SectionNodeData => {
  const b = createBuilder('isg')
  const stars = { _id: 'fnot', custom_id: 'nota', field_type: 'radio', field_label: 'Deixe sua classificação sobre nós.', field_options: Array.from({ length: 10 }, (_, i) => String(i + 1)).join('\n'), width: '100', inline_list: 'elementor-subgroup-inline' }
  const [message, ...contact] = contactFields(true)
  const form = b.widget('form', {
    form_name: 'Reclamações e sugestões',
    form_fields: [
      stars,
      message,
      { _id: 'fret', custom_id: 'retorno', field_type: 'html', field_html: '<p class="in-retorno">Gostaria de receber nosso retorno?</p>', width: '100' },
      ...contact,
    ],
    button_text: 'Enviar', success_message: 'Obrigado pela avaliação!',
    ...formStyle('Reclamação ou sugestão pelo site da Inpel'),
    show_labels: 'yes', button_align: 'center', label_color: C.body, ...typography({ size: 14, weight: 400, line: 20 }, 'label_typography'),
  })
  const column = b.col([
    pageTitle(b, FEEDBACK.title, { ...centered, typography_font_size: px(25), typography_text_transform: 'uppercase', _margin: sides(0, 0, 20, 0) }),
    b.text(FEEDBACK.html, tweak(T.body, { size: 15, line: 20 }), C.body, { align: 'center', _margin: sides(0, 0, 30, 0) }),
    form,
  ], 0, { _element_width: 'initial', width: fluid('min(100%, 555px)') })
  const root = b.root([b.container({ flex_direction: 'row', flex_justify_content: 'center' }, [column])], {
    pad: [30, 60],
    css: [
      FORM_CSS,
      // classificação de 1 a 10 desenhada como as estrelas do site; continua um grupo de rádio
      'selector .elementor-field-group-nota{justify-content:center}selector .elementor-field-group-nota>label{width:100%;text-align:center;margin-bottom:12px}',
      'selector .elementor-field-group-nota .elementor-field-subgroup{justify-content:center;gap:0}',
      'selector .elementor-field-group-nota .elementor-field-option{position:relative}',
      'selector .elementor-field-group-nota input{position:absolute;opacity:0;width:1px;height:1px}',
      'selector .elementor-field-group-nota .elementor-field-option label{margin:0;font-size:0;cursor:pointer}',
      // os demais campos têm só o placeholder, como no site; o rótulo fica para o leitor de tela
      'selector .elementor-field-group:not(.elementor-field-group-nota)>label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
      'selector .elementor-field-group-nota .elementor-field-option label::before{content:"\\f005";font-family:"Font Awesome 5 Free";font-weight:900;font-size:28px;color:#C9C9C9;padding:0 1px;transition:color .15s}',
      // acende a estrela escolhida e as anteriores (1 a 10 da esquerda para a direita, na ordem do teclado)
      `selector .elementor-field-group-nota .elementor-field-option:hover label::before,selector .elementor-field-group-nota .elementor-field-option:has(~.elementor-field-option:hover) label::before,selector .elementor-field-group-nota .elementor-field-option:has(input:checked) label::before,selector .elementor-field-group-nota .elementor-field-option:has(~.elementor-field-option input:checked) label::before{color:${C.red}}`,
      `selector .elementor-field-group-nota input:focus-visible+label::before{outline:2px solid ${C.red};outline-offset:2px}`,
      `selector .in-retorno{margin:5px 0 -10px;text-align:center;width:100%;font-family:${F},sans-serif;font-size:14px;color:${C.body}}`,
      'selector .in-form .elementor-field-type-submit{justify-content:center}',
    ].join(''),
  })
  return b.section('Inpel · Reclamações e sugestões', 'inpel-sugestoes', root)
}

const makeLegal = (item: (typeof LEGAL)[number]): SectionNodeData => {
  const b = createBuilder(`il${item.id % 10}`)
  const aside = b.col([
    b.heading('Departamentos', T.title, C.ink, { header_size: 'h2', _margin: sides(0, 0, 25, 0) }),
    b.list(LEGAL.map((doc) => ({ text: doc.title, url: doc.url })), {
      space_between: px(14), text_color: '#9A9DA8', text_color_hover: C.red,
      ...typography({ size: 17, weight: 400, line: 24 }, 'icon_typography'),
      divider: 'yes', divider_color: '#B9BABC', divider_weight: px(1), _css_classes: 'in-docs',
    }),
  ], 0, { width: px(197), ...FIXED, css_classes: 'in-aside' })
  const main = b.col([
    pageTitle(b, item.title, { ...centered, _margin: sides(0, 0, 20, 0) }),
    b.text(item.html, { size: 13, weight: 400, line: 18.6 }, C.body, { _css_classes: 'in-rich in-legal' }),
  ], 0, FILL)
  const root = b.root([b.row([aside, main], 78, { flex_align_items: 'flex-start', css_classes: 'in-catalogo' })], {
    pad: [30, 60],
    css: [
      `selector .in-docs .elementor-icon-list-item:not(:last-child)::after{bottom:0}selector .in-docs .elementor-icon-list-item{padding-bottom:4px!important}`,
      // os títulos do texto seguem o tema: h3 de 24px e h4 de 18px, 10px abaixo; listas sem marcador
      `selector .in-legal h1,selector .in-legal h2,selector .in-legal h3,selector .in-legal h4{font-family:${F},sans-serif;color:${C.ink};font-weight:700;margin:0 0 10px}`,
      'selector .in-legal h1,selector .in-legal h2,selector .in-legal h3{font-size:24px;line-height:26.4px}selector .in-legal h4{font-size:18px;line-height:19.8px}',
      'selector .in-legal p{text-align:justify}',
      'selector .in-legal ul,selector .in-legal ol{list-style:none;padding:0;margin:0}',
      '@media (max-width:1024px){selector .in-aside{width:100%!important}selector .in-catalogo{flex-direction:column!important;gap:30px!important}}',
    ].join(''),
  })
  return b.section(`Inpel · ${item.title}`, `inpel-lgpd-${item.id}`, root)
}

// ── registro ────────────────────────────────────────────────────────────────

const AUDIENCE = 'Inpel'

const page = (id: string, name: string, description: string, content: SectionNodeData[], key: string): LandingTemplate => {
  const sections = [makeHeader(`ih${key}`), ...content, makeFooter(`if${key}`), makeWhatsApp()]
  return { id: `inpel-${id}`, name: `Inpel · ${name}`, description, audience: AUDIENCE, componentIds: sections.map((section) => section.sourceId!), sections }
}

export const createInpelTemplates = (): LandingTemplate[] => [
  page('home', 'página inicial', 'Home da Inpel: slider, três destaques com a faixa vermelha, carrossel das 21 aplicações, últimos posts e redes, em containers e widgets nativos.',
    [makeSlider(), makeHighlights(), makeSegmentsCarousel(), makePostsGrid('Útimos Posts', 'ipt'), makeSocial()], 'a'),
  page('sobre', 'sobre', 'Apresentação da fábrica, vídeo institucional, certificados para baixar e parceiros.',
    [makeBreadcrumb('ibs', 'Sobre a Inpel'), makeAbout(), makeVideo(), makeDownloads(), makePartners()], 'b'),
  page('caixas', 'caixas de transmissão', 'Catálogo das aplicações com a coluna de categorias e a grade de cartões.',
    [makeCatalog()], 'c'),
  page('produtos', 'produtos de uma aplicação', 'Lista de modelos de uma aplicação (Roçadeiras), com as etiquetas de lançamento e garantia.',
    [makeProducts()], 'd'),
  page('produto', 'detalhe do produto', 'Ficha do CT-145: galeria, arquivos técnicos, aplicação, descrição e o "Monte a sua caixa" como formulário de orçamento.',
    [makeBreadcrumb('ibp', 'Caixas de Transmissão'), makeProduct()], 'e'),
  page('blog', 'blog', 'Grade de posts do Blog Inpel.',
    [makeBreadcrumb('ibb', 'Blog'), makePostsGrid('Blog Inpel', 'ipb', 'h1')], 'f'),
  page('post', 'post', 'Post do blog com imagem, data e texto (Recorde de colheita).',
    [makeBreadcrumb('ibq', 'Blog'), makePost()], 'g'),
  page('contato', 'contato', 'Fale conosco com WhatsApp, e-mail, formulário nativo e o mapa da fábrica.',
    [makeBreadcrumb('ibc', 'Fale conosco'), makeContact()], 'h'),
  page('sugestoes', 'reclamações e sugestões', 'Avaliação de 1 a 10, mensagem e contato opcional em um formulário nativo.',
    [makeBreadcrumb('ibr', 'Reclamações, críticas ou sugestões'), makeFeedback()], 'i'),
  ...LEGAL.map((item, i) => page(`lgpd-${item.id}`, item.title.toLowerCase(), `${item.title} da Inpel, com a lista dos documentos da LGPD ao lado.`,
    [makeBreadcrumb(`ib${i}`, 'Informações gerais'), makeLegal(item)], `${i}`)),
]
