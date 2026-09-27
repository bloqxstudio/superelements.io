import type { SectionNodeData } from '@/types/space'
import type { LandingTemplate } from './landingTemplates'

// O pack fica fora do git (data/section-express/ no .gitignore). Com glob, um
// clone sem o pack ainda compila: o modelo só aparece onde o pack existe.
const PACK = import.meta.glob<string>('/data/section-express/sections/{c1,c25,c37,c53,c60,c71}.json', { query: '?raw', import: 'default', eager: true })
const packSection = (id: string) => PACK[`/data/section-express/sections/${id}.json`] ?? ''
const c1Raw = packSection('c1')
const c25Raw = packSection('c25')
const c37Raw = packSection('c37')
const c53Raw = packSection('c53')
const c60Raw = packSection('c60')
const c71Raw = packSection('c71')
const PACK_READY = [c1Raw, c25Raw, c37Raw, c53Raw, c60Raw, c71Raw].every(Boolean)

type JsonRecord = Record<string, unknown>
type ElementorNode = {
  id?: string
  elType?: string
  widgetType?: string
  settings?: JsonRecord
  elements?: ElementorNode[]
}

const colors = {
  brand: '#280E5A',
  brandDark: '#1A0940',
  action: '#286EFF',
  actionHover: '#1C5CE6',
  warm: '#FF4B1E',
  page: '#F0EBE2',
  pageAlt: '#FAF5EB',
  card: '#FFFFFF',
  strong: '#280E5A',
  body: '#3B2E55',
  muted: '#6B6080',
  border: '#D9D2C4',
  onBrand: '#FAF5EB',
  paleBlue: '#D6E3FF',
}

const sides = (top: number, right: number, bottom: number, left: number) => ({
  unit: 'px', top: String(top), right: String(right), bottom: String(bottom), left: String(left),
  isLinked: top === right && right === bottom && bottom === left,
})

const imageValue = (url: string, alt: string) => ({ id: 0, url, alt, source: 'url', size: '' })

const fontCss = `
@font-face{font-family:"Iquost";src:url("/pdv-light/assets/fonts/Iquost.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"Roboto";src:url("/pdv-light/assets/fonts/Roboto-Variable.ttf") format("truetype-variations");font-weight:100 900;font-style:normal;font-display:swap}
selector .elementor-heading-title{font-family:"Iquost","Roboto",sans-serif}
selector .elementor-widget-text-editor,selector .elementor-button,selector .elementor-icon-box-title,selector .elementor-icon-box-description{font-family:"Roboto",sans-serif}
selector .elementor-button{border-radius:999px;transition-property:transform,background-color,color,box-shadow;transition-duration:200ms;transition-timing-function:cubic-bezier(.2,.7,.2,1)}
selector .elementor-button:active{transform:scale(.96)}
@media(max-width:767px){
  selector{overflow-x:hidden}
  selector .e-con,selector .elementor-element{min-width:0;max-width:100%}
  selector .elementor-widget-heading{width:100%!important;max-width:100%!important}
  selector .elementor-heading-title{overflow-wrap:break-word}
}
@media(prefers-reduced-motion:reduce){selector *,selector *:before,selector *:after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
`

const parseNodes = (raw: string): ElementorNode[] => {
  const document = JSON.parse(raw) as JsonRecord
  return JSON.parse(JSON.stringify((document.content ?? document.elements ?? []) as ElementorNode[])) as ElementorNode[]
}

const walk = (nodes: ElementorNode[], visit: (node: ElementorNode) => void) => {
  nodes.forEach((node) => {
    visit(node)
    walk(node.elements ?? [], visit)
  })
}

const widgets = (nodes: ElementorNode[], widgetType: string) => {
  const matches: ElementorNode[] = []
  walk(nodes, (node) => { if (node.widgetType === widgetType) matches.push(node) })
  return matches
}

const nodeById = (nodes: ElementorNode[], id: string) => {
  let match: ElementorNode | undefined
  walk(nodes, (node) => { if (!match && node.id === id) match = node })
  return match
}

const mergeSettings = (node: ElementorNode | undefined, settings: JsonRecord) => {
  if (node) node.settings = { ...(node.settings ?? {}), ...settings }
}

const styleTypography = (nodes: ElementorNode[]) => {
  widgets(nodes, 'heading').forEach((node) => mergeSettings(node, { typography_font_family: 'Iquost' }))
  widgets(nodes, 'text-editor').forEach((node) => mergeSettings(node, { typography_font_family: 'Roboto' }))
  widgets(nodes, 'button').forEach((node) => mergeSettings(node, { typography_font_family: 'Roboto' }))
  widgets(nodes, 'icon-box').forEach((node) => mergeSettings(node, {
    title_typography_font_family: 'Roboto',
    description_typography_font_family: 'Roboto',
  }))
}

const section = (raw: string, componentId: string, title: string, customize: (nodes: ElementorNode[]) => void): SectionNodeData => {
  const nodes = parseNodes(raw)
  styleTypography(nodes)
  customize(nodes)
  return {
    title: `${title} · biblioteca ${componentId}`,
    sourceId: `section-express-${componentId}`,
    elementorJson: JSON.stringify(nodes),
  }
}

const assets = () => {
  const root = `${window.location.origin}/pdv-light/assets/images`
  return {
    operation: `${root}/operacao-ifood.png`,
    account: `${root}/jornada-conta.png`,
    precheck: `${root}/precheck-equipamentos.png`,
    delivery: `${root}/configuracao-delivery.jpg`,
  }
}

const makeHero = (): SectionNodeData => section(c1Raw, 'c1', 'Hero PDV Light', (nodes) => {
  const media = assets()
  const root = nodes[0]
  const headings = widgets(nodes, 'heading')
  const images = widgets(nodes, 'image')
  const buttons = widgets(nodes, 'button')

  mergeSettings(root, {
    background_background: 'classic', background_color: colors.brand,
    padding: sides(120, 40, 120, 40), padding_tablet: sides(88, 32, 88, 32), padding_mobile: sides(72, 20, 72, 20),
    css_classes: 'pdv-library pdv-library-hero',
    custom_css: `${fontCss}
selector{min-height:88vh;display:flex;align-items:center;overflow:hidden}
selector:before{content:"";position:absolute;width:520px;height:520px;border:1px solid rgba(124,166,255,.28);border-radius:50%;right:-250px;top:-220px;pointer-events:none}
selector .elementor-widget-image{overflow:hidden;border-radius:28px;box-shadow:0 24px 64px rgba(26,9,64,.34);transition-property:transform,box-shadow;transition-duration:500ms;transition-timing-function:cubic-bezier(.16,1,.3,1)}
selector .elementor-widget-image img{width:100%;height:100%;aspect-ratio:3/5;object-fit:cover;outline:1px solid oklch(1 0 0/.12);outline-offset:-1px;transition-property:transform;transition-duration:700ms;transition-timing-function:cubic-bezier(.16,1,.3,1)}
@media(hover:hover){selector .elementor-widget-image:hover{transform:translateY(-8px);box-shadow:0 32px 74px rgba(26,9,64,.46)}selector .elementor-widget-image:hover img{transform:scale(1.04)}}
`,
  })
  mergeSettings(headings[0], { title: 'PDV LIGHT · ACESSO ANTECIPADO', title_color: colors.paleBlue })
  mergeSettings(headings[1], { title: 'Seu restaurante pronto para o próximo pedido.', title_color: colors.onBrand })
  mergeSettings(headings[2], { title: 'Conecte o cardápio do iFood, receba pedidos e prepare a impressão em uma jornada guiada pela Saipos.', title_color: colors.paleBlue })
  mergeSettings(images[0], { image: imageValue(media.operation, 'Operação de restaurante usando a Saipos e o iFood'), image_custom_dimension: { width: '720', height: '1080' } })
  mergeSettings(images[1], { image: imageValue(media.account, 'Tela inicial da jornada PDV Light'), image_custom_dimension: { width: '720', height: '1080' } })
  mergeSettings(buttons[0], {
    text: 'Quero conhecer o PDV Light', link: { url: '#piloto' },
    background_color: colors.warm, button_background_hover_color: colors.action,
    border_color: colors.warm, button_hover_border_color: colors.action,
    border_radius: sides(999, 999, 999, 999), button_text_color: colors.card,
  })
})

const makeJourney = (): SectionNodeData => section(c25Raw, 'c25', 'Jornada em três marcos', (nodes) => {
  const media = assets()
  const root = nodes[0]
  const headings = widgets(nodes, 'heading')
  const images = widgets(nodes, 'image')
  const iconBoxes = widgets(nodes, 'icon-box')

  mergeSettings(root, {
    background_color: colors.pageAlt, css_classes: 'pdv-library pdv-library-journey',
    custom_css: `${fontCss}
selector .pdv-step-card{position:relative;isolation:isolate;overflow:hidden;border-radius:24px;background:${colors.brand};box-shadow:0 8px 20px rgba(26,9,64,.10);transition-property:transform,box-shadow;transition-duration:500ms;transition-timing-function:cubic-bezier(.16,1,.3,1)}
selector .pdv-step-card:after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(26,9,64,.02) 25%,rgba(26,9,64,.88) 100%)}
selector .pdv-step-card .elementor-widget-image,selector .pdv-step-card .elementor-widget-image .elementor-widget-container{width:100%;height:100%}
selector .pdv-step-card img{width:100%;height:100%;aspect-ratio:4/5;object-fit:cover;outline:1px solid oklch(0 0 0/.1);outline-offset:-1px;transition-property:transform,filter;transition-duration:700ms;transition-timing-function:cubic-bezier(.16,1,.3,1)}
selector .pdv-step-card .elementor-widget-icon-box{z-index:2;transition-property:transform;transition-duration:500ms;transition-timing-function:cubic-bezier(.16,1,.3,1)}
selector .pdv-step-card .elementor-widget-heading{z-index:3}
@media(hover:hover){selector .pdv-step-card:hover{transform:translateY(-10px);box-shadow:0 18px 44px rgba(26,9,64,.18)}selector .pdv-step-card:hover img{transform:scale(1.05);filter:saturate(1.06)}selector .pdv-step-card:hover .elementor-widget-icon-box{transform:translateY(-8px)}}
`,
  })
  mergeSettings(headings[0], { title: 'DO IFOOD AO PAPEL', title_color: colors.muted })
  mergeSettings(headings[1], { title: 'Três marcos. Um caminho visível.', title_color: colors.strong })
  mergeSettings(headings[2], { title: 'A jornada mostra o que já está pronto e o que ainda falta antes de abrir o caixa.', title_color: colors.muted })
  ;[
    ['44b6e3f7', media.account, 'Tela de criação de conta do PDV Light', 'PASSO 1', 'Traga seu cardápio'],
    ['6f449f80', media.delivery, 'Tela de configuração do delivery', 'PASSO 2', 'Conecte os pedidos'],
    ['189c3af', media.precheck, 'Tela de conferência dos equipamentos do caixa', 'PASSO 3', 'Teste a impressão'],
  ].forEach(([containerId, src, alt, eyebrow, title], index) => {
    mergeSettings(nodeById(nodes, containerId), { css_classes: `pdv-step-card pdv-step-card-${index + 1}`, animation_delay: 600 + index * 120 })
    mergeSettings(images[index], { image: imageValue(src, alt), image_custom_dimension: { width: '900', height: '1200' }, image_border_radius: sides(24, 24, 24, 24) })
    mergeSettings(iconBoxes[index], { title_text: eyebrow, description_text: title, title_color: colors.paleBlue, description_color: colors.card })
  })
})

const makeDemo = (): SectionNodeData => section(c37Raw, 'c37', 'Demonstração do produto', (nodes) => {
  const media = assets()
  const root = nodes[0]
  const headings = widgets(nodes, 'heading')
  const images = widgets(nodes, 'image')
  const icons = widgets(nodes, 'icon')
  const texts = widgets(nodes, 'text-editor')
  const buttons = widgets(nodes, 'button')

  mergeSettings(root, {
    background_color: colors.page, css_classes: 'pdv-library pdv-library-demo',
    custom_css: `${fontCss}
selector .elementor-widget-image img{border-radius:24px;outline:1px solid oklch(0 0 0/.1);outline-offset:-1px}
selector .elementor-widget-icon{overflow:hidden;border-radius:24px;box-shadow:0 18px 44px rgba(26,9,64,.14);transition-property:transform,box-shadow;transition-duration:500ms;transition-timing-function:cubic-bezier(.16,1,.3,1)}
selector .elementor-widget-icon .elementor-icon{transition-property:transform,background-color;transition-duration:200ms}
@media(hover:hover){selector .elementor-widget-icon:hover{transform:translateY(-8px);box-shadow:0 26px 56px rgba(26,9,64,.2)}selector .elementor-widget-icon:hover .elementor-icon{transform:scale(1.06);background:${colors.action}}}
`,
  })
  mergeSettings(images[0], { image: imageValue(media.precheck, 'Pré-requisitos de equipamento no fluxo PDV Light') })
  mergeSettings(icons[0], {
    primary_color: colors.action, secondary_color: colors.card, link: { url: '#como-funciona' },
    _background_image: imageValue(media.operation, 'Demonstração da operação Saipos com iFood'),
  })
  mergeSettings(headings[0], { title: 'VEJA A JORNADA', title_color: colors.muted })
  mergeSettings(headings[1], { title: 'A configuração deixa de ser um manual técnico.', title_color: colors.strong })
  mergeSettings(texts[0], { editor: '<p>Orientações claras, progresso visível e conferências antes da operação. Você entende o próximo passo sem precisar decorar o sistema.</p>', text_color: colors.muted })
  mergeSettings(buttons[0], {
    text: 'Explorar a demonstração', link: { url: '#como-funciona' }, background_color: colors.brand,
    button_background_hover_color: colors.action, border_color: colors.brand, button_hover_border_color: colors.action,
    border_radius: sides(999, 999, 999, 999),
  })
})

const makeReadiness = (): SectionNodeData => section(c53Raw, 'c53', 'O essencial para começar', (nodes) => {
  const root = nodes[0]
  const headings = widgets(nodes, 'heading')
  const texts = widgets(nodes, 'text-editor')
  mergeSettings(root, {
    background_color: colors.pageAlt, css_classes: 'pdv-library pdv-library-readiness',
    custom_css: `${fontCss}
selector .elementor-divider-separator{border-color:${colors.paleBlue}}
selector [data-element_type="container"]{transition-property:transform;transition-duration:320ms;transition-timing-function:cubic-bezier(.16,1,.3,1)}
`,
  })
  const headingCopy = [
    ['ANTES DE COMEÇAR', colors.muted],
    ['O essencial para o PDV funcionar na sua loja.', colors.strong],
    ['A gente confirma estes itens logo no início para que você avance com clareza.', colors.muted],
    ['01', colors.action], ['Computador no caixa', colors.strong],
    ['02', colors.action], ['Internet estável', colors.strong],
    ['03', colors.action], ['Impressora térmica', colors.strong],
  ]
  headingCopy.forEach(([title, color], index) => mergeSettings(headings[index], { title, title_color: color }))
  ;[
    'É onde a plataforma e o Saipos Printer vão operar.',
    'Para receber atualizações e pedidos durante a operação.',
    'Ligada ao computador para concluir o teste no papel.',
  ].forEach((copy, index) => mergeSettings(texts[index], { editor: `<p>${copy}</p>`, text_color: colors.muted }))
})

const makePilotFaq = (): SectionNodeData => section(c71Raw, 'c71', 'Piloto e perguntas', (nodes) => {
  const media = assets()
  const root = nodes[0]
  const headings = widgets(nodes, 'heading')
  const counters = widgets(nodes, 'counter')
  const accordions = widgets(nodes, 'nested-accordion')
  const texts = widgets(nodes, 'text-editor')
  const images = widgets(nodes, 'image')

  mergeSettings(root, {
    background_color: colors.page, css_classes: 'pdv-library pdv-library-pilot',
    custom_css: `${fontCss}
selector .e-n-accordion-item-title{transition-property:color,background-color;transition-duration:200ms}
selector .e-n-accordion-item-title:hover{color:${colors.action}}
selector .pdv-pilot-orbit{display:none}
selector .elementor-widget-image:not(.pdv-pilot-orbit){overflow:hidden;border-radius:24px}
selector .elementor-widget-image:not(.pdv-pilot-orbit) img{width:100%;height:100%;object-fit:cover;outline:1px solid rgba(40,14,90,.12);outline-offset:-1px}
`,
  })
  mergeSettings(nodeById(nodes, '37115366'), { background_color: colors.page })
  mergeSettings(nodeById(nodes, '2d2e0dda'), { background_color: colors.brand })
  mergeSettings(nodeById(nodes, '682fb064'), { background_color: colors.action })
  mergeSettings(images[0], { image: imageValue(media.operation, 'Operação do PDV Light integrada ao iFood') })
  mergeSettings(images[1], { css_classes: 'pdv-pilot-orbit' })
  mergeSettings(headings[0], { title: 'BLOCOS DO PILOTO', title_color: colors.paleBlue })
  mergeSettings(headings[1], { title: 'Critério central', title_color: colors.paleBlue })
  mergeSettings(headings[2], { title: 'SETUP · PEDIDOS · IMPRESSÃO', title_color: colors.paleBlue })
  mergeSettings(headings[3], { title: 'SEM ACIONAR ATENDIMENTO', title_color: colors.paleBlue })
  mergeSettings(headings[4], { title: 'EM VALIDAÇÃO', title_color: colors.muted })
  mergeSettings(headings[5], { title: 'O piloto existe para encontrar onde a experiência ainda trava.', title_color: colors.strong })
  mergeSettings(counters[0], { ending_number: 3, suffix: '', number_color: colors.card, typography_number_font_family: 'Iquost' })
  mergeSettings(counters[1], { ending_number: 1, suffix: '', number_color: colors.card, typography_number_font_family: 'Iquost' })
  mergeSettings(accordions[0], {
    items: [
      { item_title: 'O PDV Light já está liberado para qualquer restaurante?', _id: '4232a7d' },
      { item_title: 'Preciso estar no restaurante para fazer tudo?', _id: 'd7a6b44' },
      { item_title: 'O piloto substitui todo o acompanhamento da Saipos?', _id: 'a58d5a6' },
    ],
    accordion_border_normal_color: colors.border, normal_title_color: colors.strong,
    title_typography_font_family: 'Roboto',
  })
  ;[
    'Ainda não. A experiência está em piloto assistido e o acesso depende do perfil da operação.',
    'Não. Parte da jornada pode começar antes. O teste da impressora exige o computador do caixa e o equipamento ligado.',
    'Ainda não. O piloto acompanha cada caso para identificar onde a jornada precisa melhorar antes de ampliar o acesso.',
  ].forEach((copy, index) => mergeSettings(texts[index], { editor: `<p>${copy}</p>`, text_color: colors.muted }))
})

const makeFinalCta = (): SectionNodeData => section(c60Raw, 'c60', 'Próximo passo', (nodes) => {
  const media = assets()
  const root = nodes[0]
  const headings = widgets(nodes, 'heading')
  const texts = widgets(nodes, 'text-editor')
  const iconBoxes = widgets(nodes, 'icon-box')
  const buttons = widgets(nodes, 'button')
  const images = widgets(nodes, 'image')

  mergeSettings(root, {
    background_color: colors.brand, css_classes: 'pdv-library pdv-library-cta',
    custom_css: `${fontCss}
selector .elementor-widget-image{overflow:hidden;border-radius:28px;box-shadow:0 18px 44px rgba(26,9,64,.34)}
selector .elementor-widget-image img{width:100%;aspect-ratio:1/1;object-fit:cover;outline:1px solid oklch(1 0 0/.12);outline-offset:-1px;transition-property:transform;transition-duration:700ms;transition-timing-function:cubic-bezier(.16,1,.3,1)}
@media(hover:hover){selector .elementor-widget-image:hover img{transform:scale(1.04)}}
`,
  })
  mergeSettings(headings[0], { title: 'PRÓXIMO PASSO', title_color: colors.muted })
  mergeSettings(headings[1], { title: 'Quer colocar sua operação no caminho mais curto?', title_color: colors.strong })
  mergeSettings(texts[0], { editor: '<p>Conte um pouco sobre o seu restaurante e acompanhe as próximas rodadas do PDV Light.</p>', text_color: colors.muted })
  mergeSettings(iconBoxes[0], {
    title_text: 'Piloto assistido', description_text: 'Acompanhamento para aprender com a operação real.',
    title_color: colors.strong, description_color: colors.muted, primary_color: colors.action,
  })
  mergeSettings(buttons[0], {
    text: 'Quero conhecer o PDV Light', link: { url: '#piloto' },
    background_color: colors.warm, button_background_hover_color: colors.action,
    border_color: colors.warm, button_hover_border_color: colors.action,
    border_radius: sides(999, 999, 999, 999), button_text_color: colors.card,
  })
  mergeSettings(images[0], { image: imageValue(media.operation, 'Restaurante usando a Saipos para organizar pedidos do iFood') })
})

export const createPdvLightLibraryTemplate = (): LandingTemplate | null => PACK_READY ? ({
  id: 'pdv-light-biblioteca',
  name: 'PDV Light · biblioteca',
  description: 'Landing montada exclusivamente com seis seções reais do pack local, customizadas para a iniciativa PDV Light.',
  audience: 'Teste da biblioteca',
  componentIds: ['c1', 'c25', 'c37', 'c53', 'c71', 'c60'],
  sections: [makeHero(), makeJourney(), makeDemo(), makeReadiness(), makePilotFaq(), makeFinalCta()],
}) : null
