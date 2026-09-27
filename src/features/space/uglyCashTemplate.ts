import type { SectionNodeData } from '@/types/space'
import type { LandingTemplate } from './landingTemplates'

type JsonRecord = Record<string, unknown>
type ElementorNode = {
  id: string
  elType: 'container' | 'widget'
  isInner: boolean
  widgetType?: string
  settings: JsonRecord
  elements: ElementorNode[]
}

const C = {
  canvas: '#F2F2F2', ink: '#000000', paper: '#FFFFFF', pink: '#FF00E5',
  lime: '#C9FF00', orange: '#FF4B17', sky: '#78BFFF', blue: '#182D86', dark: '#0B0B0B',
}
const DISPLAY = 'Helvetica Now Display Cn'
const BODY = 'Inter'
const px = (size: number) => ({ unit: 'px', size, sizes: [] })
const pct = (size: number) => ({ unit: '%', size, sizes: [] })
const em = (size: number) => ({ unit: 'em', size, sizes: [] })
const gap = (size: number) => ({ unit: 'px', size, row: String(size), column: String(size), isLinked: true })
const sides = (top: number, right: number, bottom: number, left: number) => ({ unit: 'px', top: String(top), right: String(right), bottom: String(bottom), left: String(left), isLinked: top === right && right === bottom && bottom === left })
const media = (url: string, alt: string) => ({ id: '', url, alt, source: 'url', size: '' })
const asset = (name: string) => `${window.location.origin}/uglycash/assets/${name}`

const createBuilder = (prefix: string) => {
  let sequence = 0
  const uid = () => `${prefix}${(++sequence).toString(16).padStart(7 - prefix.length, '0')}`
  const container = (settings: JsonRecord, elements: ElementorNode[] = []): ElementorNode => ({ id: uid(), elType: 'container', isInner: true, settings, elements })
  const widget = (widgetType: string, settings: JsonRecord): ElementorNode => ({ id: uid(), elType: 'widget', isInner: false, widgetType, settings, elements: [] })
  const type = (family: string, size: number, weight: string, line = 1, mobile?: number, tablet?: number) => ({
    typography_typography: 'custom', typography_font_family: family, typography_font_size: px(size),
    typography_font_size_tablet: px(tablet ?? Math.round(size * .72)), typography_font_size_mobile: px(mobile ?? Math.round(size * .48)),
    typography_font_weight: weight, typography_line_height: em(line),
  })
  const heading = (title: string, size: number, color = C.ink, tag = 'h2', options: JsonRecord = {}) => widget('heading', {
    title, header_size: tag, title_color: color, ...type(DISPLAY, size, '700', .92), ...options,
  })
  const text = (copy: string, color = C.ink, size = 16, options: JsonRecord = {}) => widget('text-editor', {
    editor: `<p>${copy}</p>`, text_color: color, ...type(BODY, size, '500', 1.3, Math.min(size, 15)), ...options,
  })
  const image = (file: string, alt: string, options: JsonRecord = {}) => widget('image', {
    image: media(asset(file), alt), image_size: 'full', width: pct(100), ...options,
  })
  const stack = (children: ElementorNode[], size = 16, options: JsonRecord = {}) => container({
    content_width: 'full', flex_direction: 'column', flex_gap: gap(size), padding: sides(0, 0, 0, 0), ...options,
  }, children)
  const grid = (children: ElementorNode[], columns: string, size = 16, options: JsonRecord = {}) => container({
    content_width: 'full', container_type: 'grid', grid_columns_grid: { unit: 'custom', size: columns, sizes: [] },
    grid_columns_grid_tablet: { unit: 'custom', size: columns.includes('repeat(3') ? 'repeat(2,1fr)' : '1fr', sizes: [] },
    grid_columns_grid_mobile: { unit: 'custom', size: '1fr', sizes: [] }, grid_rows_grid: { unit: 'fr', size: 1, sizes: [] },
    grid_gaps: gap(size), padding: sides(0, 0, 0, 0), ...options,
  }, children)
  const root = (children: ElementorNode[], options: JsonRecord = {}) => {
    const node = container({
      content_width: 'boxed', boxed_width: px(1440), flex_direction: 'column', flex_gap: gap(0),
      background_background: 'classic', background_color: C.canvas,
      padding: sides(16, 16, 16, 16), padding_tablet: sides(12, 12, 12, 12), padding_mobile: sides(8, 8, 8, 8),
      ...options,
    }, children)
    node.isInner = false
    return node
  }
  const section = (title: string, sourceId: string, rootNode: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([rootNode]) })
  return { container, widget, heading, text, image, stack, grid, root, section, type }
}

const sectionTitle = (b: ReturnType<typeof createBuilder>, title: string, side?: string) => b.container({
  content_width: 'full', flex_direction: 'row', flex_direction_mobile: 'column', flex_justify_content: 'space-between',
  flex_align_items: 'flex-end', flex_align_items_mobile: 'flex-start', flex_gap: gap(24), padding: sides(0, 0, 38, 0), padding_mobile: sides(0, 0, 24, 0),
}, [
  b.heading(title, 64, C.ink, 'h2', { typography_font_size_mobile: px(48), typography_letter_spacing: px(-1.8) }),
  ...(side ? [b.text(side, C.ink, 18, { _element_width: 'initial', _element_custom_width: pct(32) })] : []),
])

const makeHero = (): SectionNodeData => {
  const b = createBuilder('ugh')
  const nav = b.grid([
    b.heading('UGLYCASH', 28, C.ink, 'p', { _css_classes: 'ug-n-wordmark' }),
    b.heading('●  ◎', 17, C.ink, 'p', { align: 'center', hide_mobile: 'hidden-mobile' }),
    b.container({ content_width: 'full', flex_direction: 'row', flex_justify_content: 'flex-end', flex_align_items: 'center', flex_gap: gap(8), padding: sides(5, 12, 5, 5), border_border: 'solid', border_width: sides(1, 1, 1, 1), border_color: '#B8B8B8', border_radius: sides(14, 14, 14, 14), background_background: 'classic', background_color: C.paper, css_classes: 'ug-n-app' }, [
      b.image('mark.svg', '', { width: px(36), _element_width: 'initial' }),
      b.heading('Get the APP', 14, C.ink, 'p', { typography_font_family: BODY, typography_font_weight: '500' }),
    ]),
  ], '1fr auto 1fr', 12, { css_classes: 'ug-n-nav', grid_align_items: 'center', background_background: 'classic', background_color: '#E8E6E6', border_radius: sides(19, 19, 19, 19), padding: sides(7, 8, 7, 18) })

  const title = b.heading('YOUR BANK<br>WON\'T DO THIS', 164, C.ink, 'h1', {
    align: 'center', typography_font_size_tablet: px(105), typography_font_size_mobile: px(54),
    typography_line_height: em(.85), typography_letter_spacing: px(-5.48), typography_letter_spacing_mobile: px(-1.4),
    _css_classes: 'ug-n-hero-title',
  })
  const video = b.widget('video', {
    video_type: 'hosted', insert_url: 'yes', external_url: { url: asset('hero-phone.mp4') },
    aspect_ratio: '916', autoplay: 'yes', mute: 'yes', loop: 'yes', controls: 'no',
    show_image_overlay: 'yes', image_overlay: media(asset('0cfceaf6b5553f2b.avif'), 'UGLYCASH app'), show_play_icon: '',
    _css_classes: 'ug-n-phone',
  })
  const root = b.root([nav, title, b.stack([video], 0, { css_classes: 'ug-n-phone-stage', flex_align_items: 'center' }), b.heading('The Opportunity App.<br>To manage, move and grow money.', 24, C.ink, 'p', { align: 'center', typography_font_size_mobile: px(17) })], {
    min_height: px(1230), padding: sides(22, 16, 64, 16), padding_mobile: sides(10, 8, 24, 8), flex_gap: gap(34),
    custom_css: `selector .ug-n-nav{max-width:510px;margin:0 auto 14px;position:sticky;top:22px;z-index:20;box-shadow:0 2px 12px rgba(0,0,0,.05)}selector .ug-n-app{box-shadow:0 0 0 3px ${C.pink},0 0 22px rgba(255,0,229,.4)}selector .ug-n-phone{width:398px;max-width:100%;filter:drop-shadow(0 24px 36px rgba(0,0,0,.15))}selector .ug-n-phone .elementor-wrapper{border-radius:66px;overflow:hidden}selector .ug-n-phone-stage{min-height:760px;background:radial-gradient(circle,rgba(255,255,255,1) 0 28%,rgba(255,0,229,.28) 48%,transparent 69%)}@media(max-width:767px){selector{min-height:760px!important}selector .ug-n-nav{top:10px}selector .ug-n-phone{width:243px}selector .ug-n-phone .elementor-wrapper{border-radius:44px}selector .ug-n-phone-stage{min-height:485px}selector .ug-n-hero-title br{display:block}}`,
  })
  return b.section('UGLYCASH · Navegação e hero', 'uglycash-hero-native', root)
}

const makeOpportunity = (): SectionNodeData => {
  const b = createBuilder('ugo')
  const cards = [
    ['#FFDCFA', '01', 'Earn', 'Get paid anywhere.<br>Earn on what you hold.', '0cfceaf6b5553f2b.avif', 'UGLYCASH balance'],
    ['#D8FF90', '02', 'Access', 'Spend locally.<br>Grow globally.', 'c38fac9e45aa9225.avif', 'UGLYCASH card'],
    ['#B7DCFF', '03', 'Trade like the best', 'Learn from how others invest.<br>Track outcomes.', 'a15652292bb6e330.avif', 'UGLYCASH leaderboard'],
  ].map(([bg, index, title, copy, file, alt]) => b.stack([
    b.text(index, C.ink, 12), b.heading(title, 50, C.ink, 'h3', { typography_font_size_mobile: px(38) }), b.text(copy, C.ink, 15),
    b.image(file, alt, { _css_classes: 'ug-n-card-image' }),
  ], 10, { min_height: px(690), min_height_mobile: px(500), background_background: 'classic', background_color: bg, border_radius: sides(26, 26, 26, 26), padding: sides(26, 26, 0, 26), overflow: 'hidden', css_classes: 'ug-n-op-card' }))
  const panel = b.stack([sectionTitle(b, 'How opportunity<br>works on UGLYCASH', 'One app. More ways to earn, access and grow.'), b.grid(cards, 'repeat(3,1fr)', 14)], 0, {
    background_background: 'classic', background_color: C.paper, border_radius: sides(30, 30, 30, 30), padding: sides(72, 72, 80, 72), padding_mobile: sides(42, 22, 42, 22),
  })
  return b.section('UGLYCASH · How opportunity works', 'uglycash-opportunity-native', b.root([panel], { custom_css: 'selector .ug-n-op-card .ug-n-card-image{margin-top:auto}selector .ug-n-op-card img{max-height:500px;object-fit:contain;object-position:center bottom}' }))
}

const capabilityCard = (b: ReturnType<typeof createBuilder>, item: string[]) => {
  const [bg, index, title, copy, file, alt] = item
  return b.grid([
    b.stack([b.text(index, C.ink, 12), b.heading(title, 50, C.ink, 'h3', { typography_font_size_mobile: px(38) }), b.text(copy, C.ink, 16)], 20),
    b.stack([b.image(file, alt, { _css_classes: 'ug-n-cap-image' })], 0, { flex_justify_content: 'flex-end' }),
  ], '.85fr 1.15fr', 12, { min_height: px(580), min_height_mobile: px(520), background_background: 'classic', background_color: bg, border_radius: sides(28, 28, 28, 28), padding: sides(34, 34, 18, 34), overflow: 'hidden', css_classes: 'ug-n-cap-card' })
}

const makeCapabilities = (): SectionNodeData => {
  const b = createBuilder('uge')
  const cards = [
    [C.paper, '01', 'Multiple ways<br>to get paid', 'From US, EU and MEX bank accounts, crypto, and transfers — all in one place.', '4e9554b910b8dc68.avif', 'Ways to add funds'],
    ['#FF6A3A', '02', 'Everyday spending,<br>made simple', 'Cards with up to 6% cashback, and easy bank withdrawals.', 'c38fac9e45aa9225.avif', 'UGLYCASH Visa'],
    ['#A8D8FF', '03', 'Follow traders,<br>see positions in real time', 'Trade any asset on-chain. Learn from transparent positions and outcomes.', '294cb270dece14ed.avif', 'Trader profile'],
    ['#CFFF2E', '04', 'Money that<br>moves freely', 'Bridge between crypto and banks without rebuilding your financial life.', '3be4681a1341356c.avif', 'International transfers'],
  ].map(item => capabilityCard(b, item))
  const content = b.stack([sectionTitle(b, 'What UGLYCASH<br>enables'), b.grid(cards, 'repeat(2,1fr)', 16)], 0, { padding: sides(78, 56, 56, 56), padding_mobile: sides(42, 14, 42, 14) })
  return b.section('UGLYCASH · What the app enables', 'uglycash-enables-native', b.root([content], { custom_css: 'selector .ug-n-cap-image img{max-height:430px;object-fit:contain;object-position:center bottom}@media(max-width:767px){selector .ug-n-cap-card>.e-con-inner,selector .ug-n-cap-card{grid-template-columns:1fr!important}}' }))
}

const makeClarity = (): SectionNodeData => {
  const b = createBuilder('ugc')
  const cards = [
    ['LICENCES', 'A regulated path,<br>built across markets.', '94604ffe20677a6d.avif', 'Made in USA'],
    ['WHERE IS MY MONEY?', 'Your funds remain backed and clearly accounted for.', '452148401df0e7d6.avif', 'US currency'],
    ['IS IT SAFE?', 'Security is designed into every movement.', '14463d7bf2cf82f9.avif', 'Risk sign'],
    ['SELF CUSTODY', 'Your assets. Your keys.<br>Your control.', '35736569864fea10.avif', 'You have the keys'],
  ].map(([label, title, file, alt]) => b.grid([
    b.stack([b.text(label, '#999999', 11), b.heading(title, 22, C.paper, 'h3', { typography_font_family: BODY, typography_font_weight: '700', typography_font_size_mobile: px(20) })], 12),
    b.image(file, alt, { _css_classes: 'ug-n-clarity-image' }),
  ], '1.15fr .85fr', 10, { min_height: px(302), background_background: 'classic', background_color: '#171717', border_border: 'solid', border_width: sides(1, 1, 1, 1), border_color: '#2A2A2A', border_radius: sides(24, 24, 24, 24), padding: sides(26, 20, 10, 26), overflow: 'hidden' }))
  const panel = b.grid([
    b.stack([b.heading('Regulatory<br>clarity', 64, C.paper, 'h2', { typography_font_size_mobile: px(48) }), b.text('Money products should be understandable. Here is how the structure works.', '#AAAAAA', 15)], 25),
    b.grid(cards, 'repeat(2,1fr)', 12),
  ], '.72fr 2.28fr', 40, { background_background: 'classic', background_color: C.dark, border_radius: sides(30, 30, 30, 30), padding: sides(72, 72, 72, 72), padding_mobile: sides(42, 22, 42, 22) })
  return b.section('UGLYCASH · Regulatory clarity', 'uglycash-clarity-native', b.root([panel], { custom_css: 'selector .ug-n-clarity-image{margin-top:auto}selector .ug-n-clarity-image img{max-height:180px;object-fit:contain;object-position:right bottom}' }))
}

const makeProof = (): SectionNodeData => {
  const b = createBuilder('ugp')
  const panel = b.stack([b.heading('USED MONTHLY BY OVER <span>30,000 PEOPLE</span> TO EARN, SPEND, AND GROW MONEY GLOBALLY.', 94, C.ink, 'p', { typography_font_size_tablet: px(75), typography_font_size_mobile: px(52), typography_line_height: em(.86), typography_letter_spacing: px(-2), _css_classes: 'ug-n-proof' })], 0, { min_height: px(522), flex_justify_content: 'center', background_background: 'classic', background_color: C.paper, border_radius: sides(30, 30, 30, 30), padding: sides(45, 72, 45, 72), padding_mobile: sides(38, 22, 38, 22) })
  return b.section('UGLYCASH · Usage proof', 'uglycash-proof-native', b.root([panel], { custom_css: `selector .ug-n-proof span{color:${C.pink}}` }))
}

const makeField = (): SectionNodeData => {
  const b = createBuilder('ugf')
  const cards = [
    ['10b5d22cc461afbf.avif', 'THE OPPORTUNITY APP', ''],
    ['304dcefcc4551827.avif', 'MONEY SHOULD<br>OPEN DOORS.', 'UGLYCASH STORIES'],
    ['4e4f140546d0ac4f.avif', 'OPPORTUNITY LOOKS DIFFERENT EVERYWHERE.', 'FROM THE COMMUNITY'],
  ].map(([file, title, label], index) => b.stack([
    b.image(file, title, { _css_classes: 'ug-n-field-image' }),
    ...(label ? [b.stack([b.text(label, C.paper, 10), b.heading(title, 36, C.paper, 'h3', { typography_font_size_mobile: px(30) })], 8, { css_classes: 'ug-n-field-copy' })] : []),
  ], 0, { min_height: px(650), min_height_mobile: px(440), background_background: 'classic', background_color: C.dark, border_radius: sides(28, 28, 28, 28), overflow: 'hidden', css_classes: `ug-n-field-card ug-n-field-${index + 1}` }))
  const content = b.stack([sectionTitle(b, 'From the field', 'More videos ↗'), b.grid(cards, '1.4fr .8fr .8fr', 14)], 0, { padding: sides(70, 56, 72, 56), padding_mobile: sides(42, 14, 42, 14) })
  return b.section('UGLYCASH · From the field', 'uglycash-field-native', b.root([content], { custom_css: 'selector .ug-n-field-card{position:relative}selector .ug-n-field-image,selector .ug-n-field-image .elementor-widget-container,selector .ug-n-field-image img{width:100%;height:100%}selector .ug-n-field-image img{object-fit:cover}selector .ug-n-field-copy{position:absolute;left:25px;right:25px;bottom:28px;z-index:2}' }))
}

const makeDiscover = (): SectionNodeData => {
  const b = createBuilder('ugd')
  const cards = [
    ['#F5F0E6', C.ink, 'Ridiculously Exclusive ↗', '65da8c7a8d0dcc51.avif', 'Ridiculously Exclusive'],
    [C.dark, C.paper, 'UGLYCASH Business ↗', '0624bb62694970c8.avif', 'UGLYCASH Business'],
    ['#FF3AC8', C.ink, 'Store ↗', 'd5705da50cefe7c7.avif', 'UGLYCASH Store'],
  ].map(([bg, color, title, file, alt]) => b.stack([
    b.heading(title, 18, color, 'h3', { typography_font_family: BODY, typography_font_weight: '700' }),
    b.image(file, alt, { _css_classes: 'ug-n-discover-image' }),
  ], 14, { min_height: px(565), min_height_mobile: px(470), background_background: 'classic', background_color: bg, border_radius: sides(28, 28, 28, 28), padding: sides(25, 0, 0, 0), overflow: 'hidden', css_classes: 'ug-n-discover-card' }))
  const content = b.stack([sectionTitle(b, 'Discover more'), b.grid(cards, 'repeat(3,1fr)', 14)], 0, { padding: sides(70, 56, 72, 56), padding_mobile: sides(42, 14, 42, 14) })
  return b.section('UGLYCASH · Discover more', 'uglycash-discover-native', b.root([content], { custom_css: 'selector .ug-n-discover-card>.e-con-inner>div:first-child,selector .ug-n-discover-card>div:first-child{padding-left:25px;padding-right:25px}selector .ug-n-discover-image{margin-top:auto}selector .ug-n-discover-image img{max-height:480px;object-fit:contain;object-position:center bottom}' }))
}

const makeWorldwide = (): SectionNodeData => {
  const b = createBuilder('ugw')
  const regions = ['North America', 'Central America', 'South America', 'Africa', 'Asia'].map(region => b.heading(region, 24, C.ink, 'p', { typography_font_family: BODY, typography_font_weight: '700', typography_line_height: em(1.13), typography_font_size_mobile: px(20) }))
  const world = b.grid([
    b.stack([b.heading('UGLYCASH was created in San Francisco and is distributed worldwide.', 39, C.ink, 'h2', { typography_font_size_mobile: px(32) }), b.stack(regions, 0)], 36),
    b.image('96f23a1e12555801.avif', 'UGLYCASH suitcase', { _css_classes: 'ug-n-suitcase' }),
  ], '.85fr 1.15fr', 24, { min_height: px(514), background_background: 'classic', background_color: C.paper, border_radius: sides(30, 30, 30, 30), padding: sides(38, 42, 0, 42), padding_mobile: sides(28, 28, 0, 28), overflow: 'hidden' })
  const footer = b.stack([
    b.heading('UGLYCASH', 290, C.ink, 'p', { typography_font_size_tablet: px(200), typography_font_size_mobile: px(84), typography_line_height: em(.78), typography_letter_spacing: px(-8), typography_letter_spacing_mobile: px(-3) }),
    b.container({ content_width: 'full', flex_direction: 'row', flex_direction_mobile: 'column', flex_justify_content: 'space-between', flex_align_items: 'center', flex_align_items_mobile: 'flex-start', flex_gap: gap(22), padding: sides(24, 0, 24, 0) }, [
      b.heading('A <span>Reserve</span> Project', 24, C.ink, 'p', { typography_font_family: BODY, typography_font_weight: '700', _css_classes: 'ug-n-reserve' }),
      b.container({ content_width: 'full', flex_direction: 'row', flex_gap: gap(9), flex_justify_content: 'flex-end', flex_justify_content_mobile: 'flex-start' }, [
        b.heading('Download on the<br><b>App Store</b>', 14, C.paper, 'p', { typography_font_family: BODY, background_background: 'classic', background_color: C.ink, _padding: sides(8, 14, 8, 14), _border_radius: sides(8, 8, 8, 8) }),
        b.heading('GET IT ON<br><b>Google Play</b>', 14, C.paper, 'p', { typography_font_family: BODY, background_background: 'classic', background_color: C.ink, _padding: sides(8, 14, 8, 14), _border_radius: sides(8, 8, 8, 8) }),
      ]),
    ]),
    b.grid([
      b.text('Rewards are funded with UGLYCASH’s own resources. Annual Percentage Yield (APY) is accurate as of 05/01/2025. APY is determined by UGLYCASH and may change at any time. Users funds are not invested and are 100% backed all the time.<br><br>UGLYCASH is a financial services platform, not a bank.<br><br>**Services and features described may vary for users in different countries and/or regions.', C.ink, 13),
      b.stack(['support@ugly.cash', 'UGLYCASH Business', 'Help center', 'Legal'].map(link => b.heading(link, 19, C.ink, 'p', { typography_font_family: BODY, typography_font_weight: '500', align: 'right', align_mobile: 'left' })), 9),
    ], '1fr 1fr', 40),
  ], 0, { background_background: 'classic', background_color: C.paper, border_radius: sides(30, 30, 30, 30), padding: sides(32, 32, 32, 32), padding_mobile: sides(22, 22, 22, 22) })
  return b.section('UGLYCASH · Worldwide e footer', 'uglycash-worldwide-native', b.root([world, footer], { flex_gap: gap(16), custom_css: 'selector .ug-n-suitcase{margin-top:auto}selector .ug-n-suitcase img{max-height:620px;object-fit:contain;object-position:center bottom}selector .ug-n-reserve span{color:#6e6e6e}' }))
}

export const createUglyCashTemplate = (): LandingTemplate => {
  const sections = [makeHero(), makeOpportunity(), makeCapabilities(), makeClarity(), makeProof(), makeField(), makeDiscover(), makeWorldwide()]
  return {
    id: 'uglycash-modelo',
    name: 'UGLYCASH · página completa',
    description: 'Landing editorial fintech em containers e widgets nativos do Elementor, totalmente editável.',
    audience: 'Fintech e consumer finance',
    componentIds: sections.map(section => section.sourceId),
    sections,
  }
}
