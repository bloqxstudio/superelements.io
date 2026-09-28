import type { LandingTemplate } from './landingTemplates'
import { createBuilder, gap, link, pct, px, sides, T, typography, type ElementorNode, type LsBuilder } from '@/features/leoscherer/elementor'
import { LS as C } from '@/features/leoscherer/tokens'

type JsonRecord = Record<string, unknown>
const SOURCE = 'https://leoscherer.com.br'
const NAV: Array<[string, string]> = [
  ['iPhone', `${SOURCE}/categoria-produto/novos-iphone/`], ['Seminovos', `${SOURCE}/categoria-produto/seminovos/`],
  ['Watch', `${SOURCE}/categoria-produto/novos-watch/`], ['Mac', `${SOURCE}/categoria-produto/novos-mac/`],
  ['AirPods', `${SOURCE}/categoria-produto/novos-airpods/`], ['iPad', `${SOURCE}/categoria-produto/novos-ipad/`],
  ['JBL', `${SOURCE}/categoria-produto/produtos-jbl/`], ['Acessórios', `${SOURCE}/categoria-produto/acessorios/`],
]

const makeHeader = (prefix: string) => {
  const b = createBuilder(prefix)
  const nav = b.row(NAV.map(([label, url]) => b.heading(label, T.nav, C.soft, { link: link(url), title_hover_color: C.paper })), 24, { css_classes: 'ls-nav', flex_justify_content: 'center', flex_wrap: 'wrap' })
  const top = b.row([
    b.image('logo.png', 'LS · Produtos Apple e importados', { width: px(267) }),
    b.widget('search-form', {
      skin: 'minimal', placeholder: 'Pesquisar', button_type: 'icon', selected_icon: { value: 'fas fa-search', library: 'fa-solid' },
      size: px(34), ...typography({ ...T.nav, family: 'body' }, 'input_typography'), input_text_color: C.soft,
      input_background_color: C.paper, input_border_color: C.paper, button_text_color: C.black, width: px(250),
    }),
    b.image('partner.png', 'Tua Case', { width: px(48) }),
  ], 24, { flex_justify_content: 'space-between', css_classes: 'ls-head-top' })
  return b.section('LS · Cabeçalho', `${prefix}-header`, b.root([top, nav], {
    background: C.black, pad: [10, 10, 10], css: [
      'selector{position:relative;z-index:20}',
      'selector .ls-head-top{min-height:48px}',
      '@media(max-width:1024px){selector .ls-head-top{flex-wrap:wrap}selector .ls-head-top>.elementor-element:first-child{width:210px!important}selector .ls-nav{gap:14px!important}}',
      '@media(max-width:767px){selector .ls-head-top{justify-content:center!important}selector .ls-head-top>.elementor-element:first-child{width:190px!important}selector .ls-head-top>.elementor-element:last-child{display:none}selector .ls-nav{display:none}}',
    ].join(''),
  }))
}

const makeFooter = (prefix: string) => {
  const b = createBuilder(prefix)
  return b.section('LS · Rodapé', `${prefix}-footer`, b.root([
    b.heading('Os equipamentos deste site podem sofrer reajustes de valores a qualquer momento, sem prévio aviso. Utilizamos o dólar como norte de mercado.', T.small, C.soft, { align: 'center', header_size: 'p' }),
    b.row([b.heading('Desenvolvido por', T.small, C.ink), b.heading('Bexond', T.small, C.ink, { link: link('https://bexond.com') })], 8, { flex_justify_content: 'center' }),
  ], { background: C.raised, pad: [18, 18, 18], css: 'selector .elementor-heading-title{max-width:720px;margin-inline:auto;text-align:center}' }))
}

type Product = { image: string; name: string; price?: string; url?: string }
const productCard = (b: LsBuilder, product: Product): ElementorNode => b.col([
  b.image(product.image, product.name, { width: pct(100), link_to: product.url ? 'custom' : 'none', link: product.url ? link(product.url) : undefined, _css_classes: 'ls-product-image' }),
  b.heading(product.name, T.card, C.soft, { header_size: 'h3', link: product.url ? link(product.url) : undefined, title_hover_color: C.paper }),
  ...(product.price ? [b.heading(product.price, T.card, C.paper, { header_size: 'p' })] : []),
], 10, { css_classes: 'ls-product-card' })

const FEATURED: Product[] = [
  { image: 'macbook-pro-2015.png', name: 'Macbook PRO 2015 13″ Polegadas 256GB SSD 8GB RAM SILVER', price: 'R$1.990,00' },
  { image: 'macbook-pro-2019.jpeg', name: 'Macbook Pro 2019 16″ 512GB SSD 16GB RAM SPACE GRAY' },
  { image: 'iphone-16-pro.png', name: 'iPhone 16 Pro 256GB TITÂNIO NATURAL (seminovo)' },
  { image: 'watch-se.png', name: 'Apple Watch SE 3ª GERAÇÃO 40mm GPS + CELULAR MIDNIGHT', price: 'R$2.590,00' },
]
const USED: Product[] = [
  { image: 'airpods-used.jpeg', name: 'AirPods 4ª Geração c/ Cancelamento de Ruído (seminovo)', price: 'R$1.490,00' },
  { image: 'iphone-16-rosa.png', name: 'iPhone 16 128GB ROSA (seminovo)', price: 'R$4.490,00' },
  { image: 'iphone-17.png', name: 'iPhone 17 256GB MIST BLUE (seminovo)' },
  { image: 'macbook-m1.jpg', name: 'Macbook Pro M1 13″ 256GB SSD 8GB RAM SPACE GRAY' },
]

const makeHero = () => {
  const b = createBuilder('lhr')
  const copy = b.col([
    b.heading('iPhone 18 Pro', T.hero, C.ink, { header_size: 'h1' }),
    b.heading('Muito mais Pro.', T.heroSub, C.ink, { header_size: 'h2' }),
    b.heading('Adquira o seu conosco', T.small, C.ink, { link: link(`${SOURCE}/categoria-produto/novos-iphone/`), title_hover_color: C.blue }),
  ], 14, { flex_justify_content: 'center' })
  const trade = b.grid([
    b.col([b.image('trade-new.png', 'Aparelhos novos'), b.heading('Aparelhos novos', T.card, C.ink), b.text('Produtos originais, novos e com garantia de 1 ano.', T.small, C.soft)], 10),
    b.col([b.image('trade-used.png', 'Aparelhos seminovos'), b.heading('Aparelhos seminovos', T.card, C.ink), b.text('Produtos usados, com procedência e garantia.', T.small, C.soft)], 10),
  ], '1fr 1fr', 24, '1fr 1fr', '1fr 1fr', { css_classes: 'ls-trade' })
  return b.section('LS · Hero iPhone', 'leoscherer-hero-v2', b.root([
    b.grid([copy, b.image('hero.png', 'iPhone 18 Pro')], '1fr 1.1fr', 40, '1fr 1fr', '1fr', { flex_align_items: 'center' }),
    trade,
  ], { minHeight: 787, pad: [90, 64, 44], css: `selector{background:radial-gradient(circle at 100% 0%,${C.hero},#010101 72%)}selector .ls-trade{max-width:520px;margin:20px auto 0}@media(max-width:767px){selector{text-align:center}selector .ls-trade{margin-top:12px}}` }))
}

const makeWatch = () => {
  const b = createBuilder('lwt')
  return b.section('LS · Apple Watch', 'leoscherer-watch-v2', b.root([
    b.col([b.image('watch-logo.png', 'Apple Watch', { width: px(128) }), b.heading('SERIES 10', T.small, C.red), b.heading('Brilha mais em tudo.', T.h2, C.ink, { header_size: 'h2' }), b.row([b.button('Comprar', SOURCE), b.button('Outros modelos', `${SOURCE}/categoria-produto/novos-watch/`)], 16, { flex_justify_content: 'center' }), b.image('watch.jpg', 'Apple Watch Series 10', { width: pct(72) })], 18, { flex_align_items: 'center', text_align: 'center' }),
  ], { minHeight: 735, pad: [54, 48, 40], css: 'selector .elementor-widget-image img{object-fit:contain}@media(max-width:767px){selector .elementor-widget-image{width:100%!important}}' }))
}

const makeProducts = (kind: 'featured' | 'used') => {
  const b = createBuilder(kind === 'featured' ? 'lfp' : 'lup')
  const products = kind === 'featured' ? FEATURED : USED
  const title = kind === 'featured' ? 'Produtos em destaque' : 'Aparelhos seminovos'
  return b.section(`LS · ${title}`, `leoscherer-${kind}-v2`, b.root([
    b.heading(title, T.title, C.ink, { header_size: 'h2', _margin: sides(0, 0, 34, 0) }),
    b.grid(products.map((product) => productCard(b, product)), 'repeat(4,minmax(0,1fr))', 28, 'repeat(2,minmax(0,1fr))', '1fr'),
  ], { pad: [48, 44, 40], css: 'selector .ls-product-image img{aspect-ratio:1;object-fit:contain;background:#f1f2f3}selector .ls-product-card{min-width:0}' }))
}

const makeAirpods = () => {
  const b = createBuilder('lap')
  return b.section('LS · AirPods', 'leoscherer-airpods-v2', b.root([
    b.grid([
      b.col([b.heading('AirPods', T.title, C.black, { header_size: 'h2' }), b.heading('4ª geração', T.h2, C.black), b.heading('R$1.499,00', T.title, C.black), b.button('Comprar', `${SOURCE}/categoria-produto/novos-airpods/`, { button_text_color: C.black, border_color: C.black, hover_color: C.paper, button_background_hover_color: C.black })], 16, { flex_justify_content: 'center' }),
      b.image('airpods-used.jpeg', 'AirPods 4ª geração', { width: pct(68) }),
    ], '1fr 1fr', 40, '1fr 1fr', '1fr', { flex_align_items: 'center' }),
  ], { background: C.paper, pad: [46, 42, 36] }))
}

const makeHistory = () => {
  const b = createBuilder('lhs')
  return b.section('LS · História', 'leoscherer-historia-v2', b.root([
    b.grid([
      b.image('history-logo.png', 'Símbolo LS', { width: px(146) }),
      b.col([b.heading('+ DE 2 ANOS', T.title, C.ink), b.heading('+ DE 1500 APARELHOS VENDIDOS', T.title, C.ink), b.heading('Conheça nossa história.', T.h2, C.ink, { header_size: 'h2' }), b.text('Me chamo Leonardo Scherer, tenho 20 anos, empreendedor desde os 18 anos com a inserção da TUA CASE no mercado de acessórios para iPhones.', T.small, C.soft), b.button('Saiba mais', SOURCE)], 18),
    ], '.35fr 1fr', 48, '.35fr 1fr', '1fr', { flex_align_items: 'center' }),
  ], { minHeight: 804, pad: [100, 72, 56], css: `selector{background:radial-gradient(circle at 100% 0%,${C.hero},#010101 72%)}@media(max-width:767px){selector{text-align:center}selector .elementor-widget-image{margin-inline:auto}}` }))
}

const makeCategories = () => {
  const b = createBuilder('lct')
  const cards: Array<[string, string, string]> = [
    ['jbl.png', 'Produtos JBL', `${SOURCE}/categoria-produto/produtos-jbl/`],
    ['accessories.png', 'Acessórios', 'https://tuacase.com.br/'],
    ['other-products.png', 'Outros Produtos', `${SOURCE}/categoria-produto/outros-produtos/`],
  ]
  return b.section('LS · Categorias', 'leoscherer-categorias-v2', b.root([
    b.grid(cards.map(([image, title, url]) => b.col([b.image(image, title), b.heading(title, T.title, C.ink, { header_size: 'h2' }), b.heading('Saiba mais', T.small, C.blue, { link: link(url), title_hover_color: C.paper })], 12, { text_align: 'center' })), 'repeat(3,minmax(0,1fr))', 28, 'repeat(3,minmax(0,1fr))', '1fr'),
  ], { pad: [54, 48, 42], css: 'selector img{width:100%;aspect-ratio:16/9;object-fit:contain}' }))
}

const makeImmersion = () => {
  const b = createBuilder('lim')
  return b.section('LS · Experiência audiovisual', 'leoscherer-experiencia-v2', b.root([
    b.col([b.heading('Aperte o play para sentir esta experiência.', T.immersion, C.ink, { header_size: 'h2', align: 'center' }), b.heading('(indicamos o uso de AirPods para melhorar sua experiência)', T.small, C.ink, { align: 'center' }), b.widget('video', { video_type: 'youtube', youtube_url: 'https://www.youtube.com/watch?v=B66M1DZZGtM', aspect_ratio: '169', controls: 'yes', lazy_load: 'yes', width: pct(82) })], 24, { flex_align_items: 'center' }),
  ], { minHeight: 762, pad: [72, 60, 48], css: 'selector{text-align:center}selector .elementor-widget-video{width:min(100%,920px)}' }))
}

const makeServices = () => {
  const b = createBuilder('lsv')
  const items: Array<[string, string]> = [
    ['service-delivery.png', 'Receba seu produto no mesmo dia da compra.'],
    ['service-transfer.png', 'Fazemos todo o processo de transferência de dados.'],
    ['service-trade.png', 'Aceitamos seu usado na troca, faça uma avaliação.'],
    ['service-launches.png', 'Aqui na LS ficamos ligados nos lançamentos Apple.'],
  ]
  return b.section('LS · Serviços', 'leoscherer-servicos-v2', b.root([
    b.grid(items.map(([image, title]) => b.col([b.image(image, title), b.heading(title, T.card, C.ink, { header_size: 'h3', align: 'center' })], 12, { flex_align_items: 'center' })), 'repeat(4,minmax(0,1fr))', 22, 'repeat(2,minmax(0,1fr))', '1fr'),
  ], { pad: [56, 48, 42], css: 'selector img{width:100%;aspect-ratio:251/155;object-fit:cover}' }))
}

const makeFinanceNewsletter = () => {
  const b = createBuilder('lfn')
  const form = b.widget('form', {
    form_name: 'Newsletter LS', form_fields: [{ _id: 'mail', custom_id: 'email', field_type: 'email', placeholder: 'Seu melhor e-mail', required: 'true', width: '70' }],
    button_text: 'Inscrever', button_width: '30', show_labels: '', email_to: '', success_message: 'Cadastro recebido.',
    field_background_color: C.paper, field_text_color: C.black, field_border_color: C.paper, field_border_width: sides(1), field_border_radius: sides(0),
    button_background_color: C.blue, button_text_color: C.black, button_border_radius: sides(0), ...typography(T.button, 'button_typography'), ...typography(T.body, 'field_typography'),
  })
  return b.section('LS · Simulação e newsletter', 'leoscherer-newsletter-v2', b.root([
    b.grid([
      b.col([b.heading('Parcelamento em até 18x', T.h2, C.ink), b.heading('SIMULE SUA COMPRA', T.title, C.ink), b.button('Simular agora', SOURCE)], 18),
      b.col([b.heading('RECEBA NOSSAS NOVIDADES', T.title, C.ink), b.text('Assine nossa newsletter e tenha acesso ao nosso conteúdo mensal, com novidades e ofertas Apple.', T.body, C.soft), form], 18),
    ], '1fr 1fr', 72, '1fr 1fr', '1fr'),
  ], { minHeight: 480, pad: [82, 64, 48], css: 'selector{background:radial-gradient(circle,#0b1b33 6%,#00040a 52%,#000 100%)}' }))
}

const CATEGORY_PRODUCTS: Product[] = [
  { image: 'category-iphone-16e-black.png', name: 'iPhone 16e 128GB (NOVO)' }, { image: 'category-iphone-16e-white.png', name: 'iPhone 16e 256GB (NOVO)' },
  { image: 'category-iphone-16-blue.png', name: 'iPhone 16 128GB (NOVO)' }, { image: 'category-iphone-17-blue.png', name: 'iPhone 17 256GB (NOVO)' },
  { image: 'category-iphone-17-pro-blue.png', name: 'iPhone 17 Pro 256GB (NOVO)' }, { image: 'category-iphone-17-pro-orange.png', name: 'iPhone 17 Pro Max 256GB (NOVO)' },
]

const makeCategory = () => {
  const b = createBuilder('lca')
  return b.section('LS · Categoria iPhone', 'leoscherer-category-v2', b.root([
    b.heading('Novo - iPhone', T.h2, C.ink, { header_size: 'h1', _margin: sides(0, 0, 42, 0) }),
    b.grid(CATEGORY_PRODUCTS.map((product) => productCard(b, product)), 'repeat(3,minmax(0,1fr))', 34, 'repeat(2,minmax(0,1fr))', '1fr'),
  ], { pad: [64, 54, 44], css: 'selector .ls-product-image img{aspect-ratio:1;object-fit:contain;background:#f1f2f3}' }))
}

const makeProductDetail = () => {
  const b = createBuilder('lpd')
  const thumbs = ['product-1.jpeg', 'product-2.jpeg', 'product-3.jpeg', 'product-4.jpeg'].map((file, i) => b.image(file, `iPhone 16 rosa, foto ${i + 1}`, { width: pct(100), link_to: 'file', open_lightbox: 'yes' }))
  const gallery = b.col([b.image('product-main.png', 'iPhone 16 128GB rosa', { width: pct(100) }), b.grid(thumbs, 'repeat(4,1fr)', 8, 'repeat(4,1fr)', 'repeat(4,1fr)')], 12)
  const info = b.col([
    b.heading('iPhone 16 128GB ROSA (seminovo)', T.h2, C.ink, { header_size: 'h1' }),
    b.text('Produto seminovo. Consulte disponibilidade, condição e valor atual antes da compra.', T.body, C.soft),
    b.heading('Negocie diretamente com a LS', T.title, C.ink),
    b.button('Consultar no site original', `${SOURCE}/produto/iphone-16-128gb-rosa-seminovo/`),
    b.text('Os valores podem sofrer reajustes sem aviso prévio. O dólar é usado como norte de mercado.', T.small, C.soft),
  ], 24, { flex_justify_content: 'center' })
  return b.section('LS · Detalhe do produto', 'leoscherer-product-v2', b.root([b.grid([gallery, info], '1fr 1fr', 64, '1fr 1fr', '1fr')], { pad: [64, 54, 44], css: 'selector img{aspect-ratio:1;object-fit:cover}selector .elementor-button-wrapper{line-height:1}' }))
}

const page = (id: string, name: string, description: string, content: ReturnType<LsBuilder['section']>[], key: string): LandingTemplate => {
  const sections = [makeHeader(`lh${key}`), ...content, makeFooter(`lf${key}`)]
  return { id: `leoscherer-${id}`, name: `Leo Scherer · ${name}`, description, audience: 'Varejo Apple e importados', componentIds: sections.map((section) => section.sourceId!), sections }
}

export const createLeoSchererTemplates = (): LandingTemplate[] => [
  page('home', 'página inicial', 'Home editorial escura com lançamentos, carrosséis, história, vídeo, serviços e newsletter.', [makeHero(), makeWatch(), makeProducts('featured'), makeAirpods(), makeHistory(), makeProducts('used'), makeCategories(), makeImmersion(), makeServices(), makeFinanceNewsletter()], 'a'),
  page('category', 'categoria de produtos', 'Listagem representativa da categoria Novo - iPhone com grade nativa e responsiva.', [makeCategory()], 'b'),
  page('product', 'detalhe do produto', 'Galeria e consulta do iPhone 16 128GB rosa seminovo.', [makeProductDetail()], 'c'),
]
