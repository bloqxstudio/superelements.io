import type { SectionNodeData } from '@/types/space'
import type { LandingTemplate } from './landingTemplates'
import {
  bg, border, createBuilder, FILL, FIXED, fluid, link, maxw, pawTrail, px, reveal, sides, T, tweak, typography,
  type PetBuilder,
} from '@/features/petshop/elementor'
import { PET, PET_CONTACT as K, PET_LAYOUT as L, PET_SHADOW, petWhatsApp } from '@/features/petshop/tokens'

/**
 * Caramelo Pet: a página de exemplo de um petshop de bairro, em containers e
 * widgets nativos do Elementor. A marca está em `brands/caramelo-pet/DESIGN.md`.
 * Preços, contato e depoimentos são de exemplo: troque pelos do cliente.
 */

type JsonRecord = Record<string, unknown>

const DESK = '(min-width:1025px)'
const MOBILE = '(max-width:1024px)'
const SYMBOL = '/brands/caramelo-pet/logo/caramelo-pet-symbol.svg'
const SYMBOL_DARK = '/brands/caramelo-pet/logo/caramelo-pet-symbol-reverse.svg'
const PHOTO = '/sections/c25/businesses/pet-daycare.webp'

const NAV: Array<[string, string]> = [
  ['Serviços', '#servicos'], ['Clube do Banho', '#planos'], ['Loja', '#loja'], ['Dúvidas', '#duvidas'], ['Contato', '#contato'],
]

/** Símbolo + nome, como no DESIGN.md §2: o nome é texto do site, não imagem. */
const brandMark = (b: PetBuilder, tone: 'light' | 'dark' = 'light') => b.row([
  b.image(tone === 'dark' ? SYMBOL_DARK : SYMBOL, '', { width: px(44), ...FIXED, _element_width: 'auto', _css_classes: 'pet-symbol' }),
  b.heading('Caramelo <span class="pet-brand-pet">Pet</span>', T.brand, tone === 'dark' ? PET.white : PET.ink, { link: link('#topo'), ...FIXED }),
], 10, { width: fluid('auto'), width_mobile: fluid('auto'), flex_wrap_mobile: 'nowrap', ...FIXED, css_classes: 'pet-brand' })

const BRAND_CSS = `selector .pet-brand-pet{color:${PET.caramelInk}}selector .pet-brand .elementor-heading-title a{color:inherit}selector .pet-symbol img{display:block;width:44px;height:44px}`

// ── cabeçalho ───────────────────────────────────────────────────────────────

const makeHeader = (): SectionNodeData => {
  const b = createBuilder('pth')
  const nav = b.row(NAV.map(([label, url]) => b.heading(label, T.nav, PET.ink, {
    link: link(url), title_hover_color: PET.caramelInk, ...FIXED, _css_classes: 'pet-nav-link',
  })), 28, { flex_wrap: 'wrap', flex_justify_content: 'center', ...FILL })
  const cta = b.button('Agendar horário', petWhatsApp(), 'primary', { icon: 'fab fa-whatsapp', ...FIXED, text_padding: sides(12, 22) })
  const desk = b.row([brandMark(b), nav, cta], 32, { flex_justify_content: 'space-between', min_height: px(84), css_classes: 'pet-desk' })

  // celular e tablet: a marca e o botão "Menu" (acordeão nativo) que abre a lista
  const panel = b.col([
    b.list(NAV.map(([text, url]) => ({ text, url })), {
      space_between: px(0), text_color: PET.ink, text_color_hover: PET.caramelInk,
      ...typography(tweak(T.nav, { size: 18, line: 1.3 }), 'icon_typography'),
      divider: 'yes', divider_color: PET.line, _css_classes: 'pet-menu-links',
    }),
    b.button('Agendar pelo WhatsApp', petWhatsApp(), 'primary', { icon: 'fab fa-whatsapp', align: 'justify', _margin: sides(18, 0, 0, 0) }),
  ], 0, { padding: sides(8, L.gutter.tablet, 24, L.gutter.tablet), padding_mobile: sides(8, L.gutter.mobile, 24, L.gutter.mobile), ...bg(PET.cream), ...border(PET.line, sides(0, 0, 1, 0)) })
  const accordion = b.widget('nested-accordion', {
    items: [{ _id: 'pthmenu', item_title: 'Menu' }],
    default_state: 'all_collapsed', max_items_expended: 'one',
    ...typography(T.nav, 'title_typography'),
    normal_title_color: PET.ink,
    _css_classes: 'pet-menu', ...FIXED,
  })
  accordion.elements = [panel]
  const mobile = b.row([brandMark(b), accordion], 16, { flex_justify_content: 'space-between', min_height: px(68), css_classes: 'pet-mob' })

  const root = b.root([desk, mobile], {
    background: PET.cream, tag: 'header', id: 'topo', pad: false,
    settings: border(PET.line, sides(0, 0, 1, 0)),
    css: [
      BRAND_CSS,
      'selector{position:relative;z-index:50}',
      `@media ${MOBILE}{selector .pet-desk{display:none!important}}`,
      `@media ${DESK}{selector .pet-mob{display:none!important}}`,
      // sublinhado caramelo no link ativo do mouse; a cor já muda para o caramelo escuro
      `selector .pet-nav-link .elementor-heading-title a{display:block;padding:8px 0;background:linear-gradient(${PET.caramel},${PET.caramel}) left bottom/0 2px no-repeat}`,
      `@media(prefers-reduced-motion:no-preference){selector .pet-nav-link .elementor-heading-title a{transition:background-size 180ms ease,color 180ms ease}}`,
      'selector .pet-nav-link .elementor-heading-title a:hover{background-size:100% 2px}',
      // botão "Menu": pílula com contorno; o painel desce por cima da página
      `selector .pet-menu .e-n-accordion-item-title{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 18px;border:2px solid ${PET.ink};border-radius:999px;background:transparent;cursor:pointer;list-style:none}`,
      'selector .pet-menu .e-n-accordion-item-title::-webkit-details-marker{display:none}',
      'selector .pet-menu .e-n-accordion-item-title-icon{display:none}',
      'selector .pet-menu .e-n-accordion-item-title-header::before{content:"\\f0c9";font-family:"Font Awesome 5 Free","Font Awesome 6 Free";font-weight:900;margin-right:8px}',
      'selector .pet-menu .e-n-accordion-item-title-header{display:flex;align-items:center}',
      `selector .pet-menu .e-n-accordion-item[open] .e-n-accordion-item-title{background:${PET.ink};color:${PET.white}}`,
      `selector .pet-menu .e-n-accordion-item[open] .e-n-accordion-item-title-text{color:${PET.white}}`,
      `selector .pet-menu .e-n-accordion-item>.e-con{position:absolute;left:-${L.gutter.tablet}px;right:-${L.gutter.tablet}px;top:68px;z-index:60;border:0;box-shadow:0 16px 32px -20px rgba(31,42,68,.45)}`,
      `@media(max-width:767px){selector .pet-menu .e-n-accordion-item>.e-con{left:-${L.gutter.mobile}px;right:-${L.gutter.mobile}px}}`,
      'selector .pet-mob{position:relative;flex-wrap:nowrap!important}selector .pet-menu,selector .pet-menu .e-n-accordion,selector .pet-menu .e-n-accordion-item{position:static}',
      'selector .pet-menu-links .elementor-icon-list-item{padding-block:14px!important;margin:0!important}',
    ].join(''),
  })
  // o cabeçalho tem a própria altura: sem o padding vertical das seções, mas com as margens laterais
  root.settings.padding = sides(0, L.gutter.desktop, 0, L.gutter.desktop)
  root.settings.padding_tablet = sides(0, L.gutter.tablet, 0, L.gutter.tablet)
  root.settings.padding_mobile = sides(0, L.gutter.mobile, 0, L.gutter.mobile)
  return b.section('Caramelo Pet · Cabeçalho', 'petshop-cabecalho', root)
}

// ── hero ────────────────────────────────────────────────────────────────────

const makeHero = (): SectionNodeData => {
  const b = createBuilder('ptr')
  const trust = b.list([
    { text: 'Leva e traz grátis até 3 km', icon: 'fas fa-car-side' },
    { text: 'Foto do antes e depois', icon: 'fas fa-camera' },
    { text: 'Produtos hipoalergênicos', icon: 'fas fa-leaf' },
  ], {
    view: 'inline', space_between: px(22), icon_size: px(16), text_indent: px(8),
    icon_color: PET.caramelInk, text_color: PET.ink,
    ...typography(T.strong, 'icon_typography'),
    ...reveal(320),
  })
  const copy = b.col([
    b.eyebrow('Banho, tosa e creche · Vila Mariana', 'light', reveal(0)),
    b.heading('Seu pet volta cheiroso, feliz e <span class="pet-mark">sem estresse.</span>', T.hero, PET.ink, { header_size: 'h1', ...maxw(620), ...reveal(80) }),
    b.text('Banho e tosa com hora marcada, creche com piscina e uma loja com tudo o que ele come e gosta. A gente busca e leva no bairro.', T.lede, PET.body, { ...maxw(540), ...reveal(160) }),
    b.row([
      b.button('Agendar pelo WhatsApp', petWhatsApp(), 'primary', { icon: 'fab fa-whatsapp', ...FIXED }),
      b.button('Ver serviços', '#servicos', 'outline', FIXED),
    ], 12, { flex_wrap: 'wrap', flex_justify_content: 'flex-start', ...reveal(240, 'container'), _margin: sides(8, 0, 8, 0) }),
    trust,
  ], 22, { flex_justify_content: 'center' })

  const chip = b.row([
    b.badge('fas fa-swimming-pool', { background: PET.sky, size: 18 }),
    b.col([
      b.heading('Creche com piscina', tweak(T.card, { size: 18, mobile: 17 }), PET.ink),
      b.text('Segunda a sábado, com monitores', T.small, PET.body),
    ], 2, FILL),
  ], 12, {
    ...bg(PET.white), border_radius: sides(20), padding: sides(14, 20, 14, 14),
    css_classes: 'pet-chip', width: fluid('auto'), width_mobile: fluid('auto'), flex_wrap_mobile: 'nowrap',
  })
  const visual = b.container({ flex_direction: 'column', css_classes: 'pet-hero-visual', ...reveal(120, 'container') }, [
    b.image(PHOTO, 'Cachorro caramelo saltando na piscina da creche, com a monitora sorrindo ao fundo', { width: fluid('100%'), _css_classes: 'pet-hero-photo' }),
    chip,
  ])

  const root = b.root([
    b.grid([copy, visual], 'minmax(0,1.05fr) minmax(0,.95fr)', [40, 64], { grid_align_items: 'center' }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: PET.cream, pad: [72, 56, 40],
    css: [
      pawTrail('rgba(242,153,74,.16)', '100% 0%'),
      `selector .pet-mark{background:linear-gradient(transparent 62%,rgba(242,153,74,.45) 62%);padding:0 .06em;-webkit-box-decoration-break:clone;box-decoration-break:clone}`,
      `selector .pet-hero-photo img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:${L.radius.surface}px;outline:1px solid rgba(31,42,68,.08);outline-offset:-1px}`,
      'selector .pet-hero-visual{position:relative}',
      `selector .pet-chip{position:absolute;left:-24px;bottom:32px;box-shadow:${PET_SHADOW};max-width:calc(100% - 24px)}`,
      '@media(max-width:1024px){selector .pet-hero-photo img{aspect-ratio:5/4}selector .pet-chip{left:16px;bottom:16px}}',
      '@media(max-width:767px){selector .pet-hero-photo img{aspect-ratio:4/5}}',
    ].join(''),
  })
  return b.section('Caramelo Pet · Hero', 'petshop-hero', root)
}

// ── serviços ────────────────────────────────────────────────────────────────

const SERVICES: Array<[string, string, string, string]> = [
  ['fas fa-bath', 'Banho', 'Shampoo certo para cada tipo de pelo, secagem sem susto e um perfume leve.', 'A partir de R$ 60'],
  ['fas fa-cut', 'Tosa', 'Higiênica, na tesoura ou na máquina, do jeito que você pedir. Com foto do resultado.', 'A partir de R$ 90'],
  ['fas fa-dog', 'Creche', 'Dia de brincadeira com monitores, piscina, soneca e relatório no fim da tarde.', 'R$ 75 por dia'],
  ['fas fa-home', 'Hotel', 'Hospedagem com rotina de casa quando você viaja: passeio, comida dele e colo.', 'R$ 110 a diária'],
  ['fas fa-car-side', 'Leva e traz', 'A gente busca e leva no bairro, com caixa de transporte e cinto para cães.', 'Grátis até 3 km'],
  ['fas fa-stethoscope', 'Veterinário parceiro', 'Vacinas e consultas com a clínica parceira, às terças e aos sábados.', 'Consulta a R$ 150'],
]

const makeServices = (): SectionNodeData => {
  const b = createBuilder('pts')
  const cards = SERVICES.map(([icon, title, copy, price], index) => b.card([
    b.badge(icon),
    b.heading(title, T.card, PET.ink, { header_size: 'h3' }),
    b.text(copy, T.small, PET.body, FILL),
    b.heading(price, T.strong, PET.caramelInk, { _margin: sides(4, 0, 0, 0) }),
  ], { ...reveal(60 * (index % 3), 'container') }))
  const root = b.root([
    b.sectionHead({
      label: 'Serviços',
      title: 'Tudo o que seu pet precisa, num endereço só.',
      lede: 'Cães e gatos de todos os portes. Cada banho tem hora marcada, então ninguém fica horas esperando na gaiola.',
    }),
    b.grid(cards, 'repeat(3, minmax(0,1fr))', [20, 20], {}, { tablet: 'repeat(2, minmax(0,1fr))', mobile: '1fr' }),
  ], { background: PET.white, id: 'servicos', space: 48 })
  return b.section('Caramelo Pet · Serviços', 'petshop-servicos', root)
}

// ── como funciona ───────────────────────────────────────────────────────────

const STEPS: Array<[string, string, string]> = [
  ['1', 'Agende pelo WhatsApp', 'Escolha o serviço, o dia e o horário. Respondemos em até 1 hora no horário de funcionamento.'],
  ['2', 'A gente busca', 'Ou você traz. O banho leva cerca de 2 horas; a tosa, até 3.'],
  ['3', 'Volta cheiroso', 'Mandamos a foto do antes e do depois e avisamos quando ele estiver a caminho.'],
]

const makeSteps = (): SectionNodeData => {
  const b = createBuilder('ptc')
  // o número fica num bloco caramelo nativo: a marca enxerga o fundo e mantém o texto azul-marinho
  const number = (n: string) => b.col([b.heading(n, tweak(T.card, { size: 22, mobile: 22 }), PET.ink, { align: 'center' })], 0, {
    width: px(48), width_mobile: px(48), min_height: px(48), ...FIXED,
    flex_justify_content: 'center', flex_align_items: 'center',
    ...bg(PET.caramel), border_radius: sides(14),
  })
  const steps = STEPS.map(([n, title, copy], index) => b.col([
    number(n),
    b.heading(title, T.card, PET.white, { header_size: 'h3' }),
    b.text(copy, T.small, PET.onInk),
  ], 14, {
    padding: sides(28), padding_mobile: sides(24), ...bg(PET.inkRaised), ...border('rgba(255,255,255,0.08)'), border_radius: sides(L.radius.card),
    ...reveal(80 * index, 'container'),
  }))
  const root = b.root([
    b.row([
      b.sectionHead({ label: 'Como funciona', title: 'Três mensagens e o banho está marcado.', tone: 'dark' }, FILL),
      b.button('Agendar agora', petWhatsApp(), 'primary', { icon: 'fab fa-whatsapp', ...FIXED }),
    ], 32, { flex_align_items: 'flex-end', flex_justify_content: 'space-between', flex_direction_tablet: 'column', flex_align_items_tablet: 'flex-start', flex_wrap: 'wrap' }),
    b.grid(steps, 'repeat(3, minmax(0,1fr))', [20, 20], {}, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: PET.ink, space: 48,
    css: pawTrail('rgba(242,153,74,.10)', '0% 100%', 96),
  })
  return b.section('Caramelo Pet · Como funciona', 'petshop-como-funciona', root)
}

// ── clube do banho ──────────────────────────────────────────────────────────

interface Plan { name: string; price: string; period: string; note: string; items: string[]; featured?: boolean }

const PLANS: Plan[] = [
  { name: 'Avulso', price: 'R$ 70', period: 'por banho', note: 'Para quem vem de vez em quando.', items: ['Banho e secagem', 'Corte de unhas', 'Limpeza de ouvidos'] },
  { name: 'Clube 4 banhos', price: 'R$ 230', period: 'por mês', note: 'Um banho por semana, horário fixo.', items: ['4 banhos no mês', 'Leva e traz incluso', 'Hidratação uma vez no mês', 'Cancele quando quiser'], featured: true },
  { name: 'Banho + tosa', price: 'R$ 290', period: 'por mês', note: 'Para quem precisa manter o pelo curto.', items: ['4 banhos e 1 tosa', 'Leva e traz incluso', 'Hidratação uma vez no mês', '10% de desconto na loja'] },
]

const makePlans = (): SectionNodeData => {
  const b = createBuilder('ptp')
  const plan = ({ name, price, period, note, items, featured }: Plan, index: number) => {
    const dark = !!featured
    return b.col([
      b.row([
        b.heading(name, T.card, dark ? PET.white : PET.ink, { header_size: 'h3', ...FILL }),
        ...(featured ? [b.heading('Mais escolhido', tweak(T.eyebrow, { size: 11 }), PET.ink, { ...FIXED, _css_classes: 'pet-tag' })] : []),
      ], 12, { flex_justify_content: 'space-between', flex_wrap: 'wrap' }),
      b.text(note, T.small, dark ? PET.onInk : PET.body),
      b.row([
        b.heading(price, T.price, dark ? PET.white : PET.ink, FIXED),
        b.heading(period, T.small, dark ? PET.onInk : PET.muted, { ...FIXED, _padding: sides(0, 0, 4, 0) }),
      ], 8, { flex_align_items: 'flex-end', _margin: sides(6, 0, 6, 0) }),
      b.list(items.map((text) => ({ text, icon: 'fas fa-check' })), {
        space_between: px(10), icon_size: px(14), text_indent: px(10),
        icon_color: dark ? PET.caramel : PET.caramelInk, text_color: dark ? PET.white : PET.ink,
        ...typography(T.small, 'icon_typography'), ...FILL,
      }),
      b.button(featured ? 'Quero assinar' : 'Agendar', petWhatsApp(`Olá! Quero saber mais sobre o plano ${name} da Caramelo Pet.`), featured ? 'primary' : 'outline', {
        align: 'justify', _margin: sides(8, 0, 0, 0),
      }),
    ], 14, {
      padding: sides(32, 28), padding_mobile: sides(28, 22),
      ...bg(dark ? PET.ink : PET.white), ...border(dark ? PET.ink : PET.line), border_radius: sides(L.radius.card),
      css_classes: `pet-plan${featured ? ' pet-plan--featured' : ''}`,
      ...reveal(80 * index, 'container'),
    })
  }
  const root = b.root([
    b.sectionHead({
      label: 'Clube do Banho', align: 'center',
      title: 'Banho toda semana, sem precisar lembrar.',
      lede: 'Assine e o horário do seu pet fica reservado. Sem fidelidade: cancele pelo WhatsApp quando quiser.',
    }),
    b.grid(PLANS.map(plan), 'repeat(3, minmax(0,1fr))', [20, 20], { grid_align_items: 'center' }, { tablet: '1fr', mobile: '1fr' }),
    b.text('Valores para cães de porte pequeno. Porte médio, grande e gatos: consulte pelo WhatsApp.', T.small, PET.body, { align: 'center' }),
  ], {
    background: PET.warm, id: 'planos', space: 40,
    css: [
      `selector .pet-plan--featured{box-shadow:${PET_SHADOW}}`,
      '@media(min-width:1025px){selector .pet-plan--featured{padding-block:44px!important}}',
      `selector .pet-tag .elementor-heading-title{display:inline-block;padding:6px 12px;border-radius:999px;background:${PET.caramel}}`,
      'selector .pet-plan .elementor-button{width:100%}',
    ].join(''),
  })
  return b.section('Caramelo Pet · Clube do Banho', 'petshop-planos', root)
}

// ── loja ────────────────────────────────────────────────────────────────────

const CATEGORIES: Array<[string, string]> = [
  ['fas fa-bone', 'Rações'], ['fas fa-cookie-bite', 'Petiscos'], ['fas fa-baseball-ball', 'Brinquedos'],
  ['fas fa-pump-soap', 'Higiene'], ['fas fa-bed', 'Camas e caminhas'], ['fas fa-pills', 'Farmácia'],
]

const makeShop = (): SectionNodeData => {
  const b = createBuilder('ptl')
  const tiles = CATEGORIES.map(([icon, label], index) => b.col([
    b.badge(icon, { background: PET.cream }),
    b.heading(label, tweak(T.card, { size: 18, mobile: 17 }), PET.ink, { header_size: 'h3' }),
  ], 14, {
    padding: sides(22), padding_mobile: sides(18), ...bg(PET.white), border_radius: sides(20),
    ...reveal(50 * index, 'container'),
  }))
  const copy = b.col([
    // o caramelo escuro não passa no azul-piscina: o rótulo fica azul-marinho
    b.sectionHead({
      label: 'Loja', labelColor: PET.ink,
      title: 'A loja do bairro, com entrega em até 2 horas.',
      lede: 'Ração, petisco, areia e remédio sem sair de casa. Pede pelo WhatsApp e paga na entrega, no Pix ou no cartão.',
    }),
    b.list([
      { text: 'Entrega grátis acima de R$ 150 no bairro', icon: 'fas fa-truck' },
      { text: 'Lembrete quando a ração estiver acabando', icon: 'fas fa-bell' },
    ], {
      space_between: px(12), icon_size: px(16), text_indent: px(10), icon_color: PET.ink, text_color: PET.ink,
      ...typography(T.strong, 'icon_typography'),
    }),
    b.button('Fazer um pedido', petWhatsApp('Olá! Quero fazer um pedido na loja da Caramelo Pet.'), 'outline', { icon: 'fab fa-whatsapp', align: 'left', _margin: sides(8, 0, 0, 0) }),
  ], 22)
  const root = b.root([
    b.grid([copy, b.grid(tiles, 'repeat(3, minmax(0,1fr))', [14, 14], {}, { tablet: 'repeat(3, minmax(0,1fr))', mobile: 'repeat(2, minmax(0,1fr))' })],
      'minmax(0,.9fr) minmax(0,1.1fr)', [40, 64], { grid_align_items: 'center' }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: PET.sky, id: 'loja',
    css: pawTrail('rgba(31,42,68,.07)', '100% 100%'),
  })
  return b.section('Caramelo Pet · Loja', 'petshop-loja', root)
}

// ── depoimentos ─────────────────────────────────────────────────────────────

const QUOTES: Array<[string, string, string]> = [
  ['O Paçoca morria de medo de secador. Aqui ele entra abanando o rabo e eu recebo a foto antes de sair do trabalho.', 'Juliana', 'tutora do Paçoca'],
  ['Deixei a Mel e o Tobias no hotel por dez dias. Todo dia chegava vídeo dos dois na piscina. Voltaram mais calmos que eu.', 'Ricardo', 'tutor da Mel e do Tobias'],
  ['Gata não gosta de banho, mas a Nina saiu tranquila e cheirosa. Atendimento sem pressa, dá para ver o cuidado.', 'Fernanda', 'tutora da Nina'],
]

const makeReviews = (): SectionNodeData => {
  const b = createBuilder('ptd')
  const cards = QUOTES.map(([quote, name, pet], index) => b.card([
    b.heading('<span aria-hidden="true">★★★★★</span><span class="elementor-screen-only">Nota 5 de 5</span>', tweak(T.strong, { size: 18 }), PET.caramelInk, { _css_classes: 'pet-stars' }),
    b.text(`“${quote}”`, T.quote, PET.ink, FILL),
    b.col([
      b.heading(name, T.strong, PET.ink),
      b.heading(pet, T.small, PET.muted),
    ], 2, { padding: sides(16, 0, 0, 0), ...border(PET.line, sides(1, 0, 0, 0)) }),
  ], { ...reveal(80 * index, 'container') }))
  const root = b.root([
    b.sectionHead({ label: 'Quem já veio', align: 'center', title: 'Os tutores contam melhor do que a gente.' }),
    b.grid(cards, 'repeat(3, minmax(0,1fr))', [20, 20], {}, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: PET.cream, space: 48,
    css: 'selector .pet-stars .elementor-heading-title{letter-spacing:.12em}selector .elementor-screen-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
  })
  return b.section('Caramelo Pet · Depoimentos', 'petshop-depoimentos', root)
}

// ── dúvidas ─────────────────────────────────────────────────────────────────

const FAQ: Array<[string, string]> = [
  ['Precisa agendar?', 'Sim, todo serviço tem hora marcada: é assim que ninguém fica horas esperando. Agende pelo WhatsApp com um dia de antecedência; se tiver vaga, atendemos no mesmo dia.'],
  ['Vocês atendem gatos?', 'Atendemos. Gatos têm horário próprio, longe dos cães, e a secagem é feita com toalha e secador em baixa potência.'],
  ['Quais vacinas são exigidas na creche e no hotel?', 'V8 ou V10, antirrábica e gripe canina em dia, além de antipulgas recente. Traga a carteirinha na primeira visita.'],
  ['Meu cão tem medo de secador. E agora?', 'Avise no agendamento. A gente começa com toalha e secador em baixa potência, sem pressa, e para se ele ficar estressado.'],
  ['Como funciona o leva e traz?', 'Buscamos e levamos em até 3 km sem custo, com caixa de transporte ou cinto de segurança para cães. Acima disso, a taxa é combinada pelo WhatsApp.'],
  ['Quais as formas de pagamento?', 'Pix, cartão de crédito e débito. Os planos do Clube do Banho são cobrados todo mês no cartão.'],
]

const makeFaq = (): SectionNodeData => {
  const b = createBuilder('ptf')
  const accordion = b.widget('nested-accordion', {
    items: FAQ.map(([question], index) => ({ item_title: question, _id: `ptfq${index + 1}` })),
    default_state: 'all_collapsed',
    max_items_expended: 'multiple',
    n_accordion_animation_duration: { unit: 'ms', size: 300, sizes: [] },
    accordion_item_title_icon: { value: 'fas fa-plus', library: 'fa-solid' },
    accordion_item_title_icon_active: { value: 'fas fa-minus', library: 'fa-solid' },
    accordion_item_title_position_horizontal: 'stretch',
    ...typography(tweak(T.card, { size: 19, mobile: 17, weight: 500, line: 1.35 }), 'title_typography'),
    normal_title_color: PET.ink, hover_title_color: PET.ink, active_title_color: PET.ink,
    normal_icon_color: PET.ink, hover_icon_color: PET.ink, active_icon_color: PET.ink,
    _css_classes: 'pet-faq',
  })
  accordion.elements = FAQ.map(([, answer]) => b.col([
    b.text(answer, T.body, PET.body, maxw(620)),
  ], 0, { padding: sides(0, 24, 22, 24), padding_mobile: sides(0, 18, 18, 18) }))

  const root = b.root([
    b.grid([
      b.sectionHead({
        label: 'Dúvidas',
        title: 'O que os tutores perguntam antes da primeira visita.',
        lede: 'Se a sua pergunta não estiver aqui, chama no WhatsApp.',
      }),
      accordion,
    ], 'minmax(0,.85fr) minmax(0,1.15fr)', [40, 56], { grid_align_items: 'start' }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: PET.white, id: 'duvidas',
    css: [
      `selector .pet-faq .e-n-accordion{display:flex;flex-direction:column;gap:12px}`,
      `selector .pet-faq .e-n-accordion-item{border:1px solid ${PET.line};border-radius:20px;background:${PET.cream};overflow:hidden}`,
      'selector .pet-faq .e-n-accordion-item-title{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 24px;border:0;border-radius:0;background:transparent;cursor:pointer;list-style:none}',
      'selector .pet-faq .e-n-accordion-item-title::-webkit-details-marker{display:none}',
      `selector .pet-faq .e-n-accordion-item-title-icon{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:999px;flex:none;background:${PET.warm};color:${PET.ink};font-size:18px;line-height:1}`,
      'selector .pet-faq .e-n-accordion-item-title-icon i{font-size:12px}',
      `selector .pet-faq .e-n-accordion-item[open] .e-n-accordion-item-title-icon{background:${PET.caramel}}`,
      'selector .pet-faq .e-n-accordion-item>.e-con{border:0}',
      '@media(prefers-reduced-motion:no-preference){selector .pet-faq .e-n-accordion-item[open]>.e-con{animation:petAnswerIn 220ms ease-out}@keyframes petAnswerIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}}',
      '@media(max-width:767px){selector .pet-faq .e-n-accordion-item-title{padding:18px}}',
    ].join(''),
  })
  return b.section('Caramelo Pet · Dúvidas', 'petshop-duvidas', root)
}

// ── contato ─────────────────────────────────────────────────────────────────

const field = (id: string, type: string, label: string, extra: JsonRecord = {}) => ({
  _id: `ptk${id}`.slice(0, 7), custom_id: id, field_type: type, field_label: label, width: '50', width_mobile: '100', ...extra,
})

const contactForm = (b: PetBuilder) => b.widget('form', {
  form_name: 'Agendamento Caramelo Pet',
  form_fields: [
    field('nome', 'text', 'Seu nome', { placeholder: 'Como podemos te chamar', required: 'true' }),
    field('whatsapp', 'tel', 'WhatsApp', { placeholder: '(11) 00000-0000', required: 'true' }),
    field('pet', 'text', 'Nome do pet', { placeholder: 'Ex.: Paçoca', required: 'true' }),
    field('porte', 'select', 'Quem é ele?', { field_options: ['Escolha|', 'Cão pequeno', 'Cão médio', 'Cão grande', 'Gato'].join('\n'), required: 'true' }),
    field('servico', 'select', 'Serviço', { field_options: ['Escolha|', 'Banho', 'Banho e tosa', 'Creche', 'Hotel', 'Clube do Banho', 'Ainda não sei'].join('\n'), width: '100' }),
    field('recado', 'textarea', 'Algo que a gente precisa saber? (opcional)', { placeholder: 'Ex.: tem medo de secador, é alérgico a algum produto', rows: '3', width: '100' }),
  ],
  input_size: 'md', show_labels: 'true', button_size: 'md', button_width: '100', button_align: 'stretch', button_text: 'Pedir horário',
  submit_actions: ['email'],
  email_subject: 'Novo pedido de horário pelo site da Caramelo Pet',
  success_message: 'Recebemos! Respondemos pelo WhatsApp para confirmar o horário.',
  error_message: 'Não foi possível enviar agora. Tente de novo ou chame no WhatsApp.',
  required_field_message: 'Este campo é obrigatório.',
  column_gap: px(14), row_gap: px(16), label_spacing: px(6),
  label_color: PET.ink, ...typography(tweak(T.strong, { size: 14 }), 'label_typography'),
  field_text_color: PET.ink, ...typography(tweak(T.body, { size: 16 }), 'field_typography'),
  field_background_color: PET.white, field_border_color: PET.field, field_border_width: sides(1), field_border_radius: sides(L.radius.field),
  button_background_color: PET.caramel, button_text_color: PET.ink, button_background_hover_color: PET.caramelHover, button_hover_color: PET.ink,
  ...typography({ size: 16, weight: 800, line: 1.2 }, 'button_typography'),
  button_border_radius: sides(L.radius.pill), button_text_padding: sides(16, 24),
  custom_css: [
    'selector .elementor-field-group .elementor-field-textual{padding:12px 14px;min-height:48px;line-height:1.5;border-style:solid}',
    'selector .elementor-field-group textarea.elementor-field-textual{min-height:96px;resize:vertical}',
    'selector .elementor-field-textual::placeholder{color:#857A6C;opacity:1}',
    `selector .elementor-field-textual:hover{border-color:${PET.ink}}`,
    `selector .elementor-field-textual:focus{border-color:${PET.ink};outline:3px solid ${PET.caramel};outline-offset:1px;box-shadow:none}`,
    `selector .elementor-button:focus-visible{outline:3px solid ${PET.ink};outline-offset:3px}`,
    'selector .e-form__buttons{margin-top:6px}',
    '@media(prefers-reduced-motion:no-preference){selector .elementor-field-textual{transition:border-color 180ms ease}selector .elementor-button{transition:background-color 180ms ease,transform 180ms ease}selector .elementor-button:active{transform:scale(.96)}}',
    '@media(max-width:767px){selector .elementor-field-group{width:100%}}',
  ].join(''),
})

const makeContact = (): SectionNodeData => {
  const b = createBuilder('ptk')
  const info = b.col([
    b.sectionHead({
      label: 'Contato',
      title: 'Vamos marcar o primeiro banho?',
      lede: 'Mande os dados do seu pet e a gente responde pelo WhatsApp para confirmar o horário.',
    }),
    b.list([
      { text: `WhatsApp ${K.whatsappLabel}`, url: petWhatsApp(), icon: 'fab fa-whatsapp' },
      { text: K.address, icon: 'fas fa-map-marker-alt' },
      ...K.hours.map((text) => ({ text, icon: 'far fa-clock' })),
    ], {
      space_between: px(14), icon_size: px(18), text_indent: px(12), icon_color: PET.caramelInk,
      text_color: PET.ink, text_color_hover: PET.caramelInk,
      ...typography(tweak(T.body, { weight: 600 }), 'icon_typography'),
    }),
  ], 28)
  const formCard = b.col([contactForm(b)], 0, {
    padding: sides(32), padding_mobile: sides(22), ...bg(PET.white), ...border(PET.line), border_radius: sides(L.radius.surface),
    ...reveal(120, 'container'),
  })
  const root = b.root([
    b.grid([info, formCard], 'minmax(0,.9fr) minmax(0,1.1fr)', [40, 64], { grid_align_items: 'start' }, { tablet: '1fr', mobile: '1fr' }),
  ], { background: PET.cream, id: 'contato', css: 'selector .elementor-icon-list-icon i{width:20px;text-align:center}' })
  return b.section('Caramelo Pet · Contato', 'petshop-contato', root)
}

// ── rodapé ──────────────────────────────────────────────────────────────────

const makeFooter = (): SectionNodeData => {
  const b = createBuilder('ptz')
  const title = (label: string) => b.heading(label, T.eyebrow, PET.caramel, { header_size: 'h3', _margin: sides(0, 0, 14, 0) })
  const links = (items: Array<{ text: string; url?: string; icon?: string }>) => b.list(items, {
    space_between: px(10), icon_size: px(15), text_indent: px(items.some((i) => i.icon) ? 10 : 0), icon_color: PET.caramel,
    text_color: PET.onInk, text_color_hover: PET.white,
    ...typography(T.small, 'icon_typography'),
  })
  const first = b.col([
    brandMark(b, 'dark'),
    b.text('Banho, tosa, creche, hotel e loja para cães e gatos, na Vila Mariana.', T.small, PET.onInk, maxw(320)),
  ], 16)
  const main = b.grid([
    first,
    b.col([title('Serviços'), links(NAV.slice(0, 3).map(([text, url]) => ({ text, url })))]),
    b.col([title('Horários'), links(K.hours.map((text) => ({ text })))]),
    b.col([title('Contato'), links([
      { text: K.whatsappLabel, url: petWhatsApp(), icon: 'fab fa-whatsapp' },
      { text: K.address, icon: 'fas fa-map-marker-alt' },
    ])]),
  ], 'minmax(0,1.3fr) repeat(3, minmax(0,1fr))', [32, 32], {}, { tablet: 'repeat(2, minmax(0,1fr))', mobile: '1fr' })
  const bottom = b.row([
    b.text('© 2026 Caramelo Pet. Todos os direitos reservados.', tweak(T.small, { size: 14 }), PET.onInk),
    b.heading('Voltar ao topo ↑', tweak(T.strong, { size: 14 }), PET.white, { link: link('#topo'), title_hover_color: PET.caramel, ...FIXED }),
  ], 16, { flex_justify_content: 'space-between', flex_wrap: 'wrap', padding: sides(24, 0, 0, 0), ...border('rgba(255,255,255,0.12)', sides(1, 0, 0, 0)) })
  const root = b.root([main, bottom], {
    background: PET.ink, tag: 'footer', space: 40, pad: [64, 56, 48],
    css: `${BRAND_CSS}selector .pet-brand-pet{color:${PET.caramel}}selector .elementor-icon-list-icon i{width:16px;text-align:center}`,
  })
  return b.section('Caramelo Pet · Rodapé', 'petshop-rodape', root)
}

export const createPetshopTemplate = (): LandingTemplate => ({
  id: 'caramelo-pet-home',
  name: 'Petshop · Caramelo Pet',
  description: 'Página de petshop de bairro: serviços, como funciona, Clube do Banho, loja, depoimentos, dúvidas e agendamento pelo WhatsApp.',
  audience: 'Petshop',
  sections: [makeHeader(), makeHero(), makeServices(), makeSteps(), makePlans(), makeShop(), makeReviews(), makeFaq(), makeContact(), makeFooter()],
})
