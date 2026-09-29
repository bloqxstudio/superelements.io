import type { LandingTemplate } from './landingTemplates'
import type { SectionNodeData } from '@/types/space'
import {
  bg, border, createBuilder, FIXED, fluid, hl, link, maxw, px, reveal, sides, T, texture, tweak,
  type PBBuilder,
} from '@/features/processbase/elementor'
import { PB, PB_CONTACT, PB_LAYOUT as L, pbWhatsApp } from '@/features/processbase/tokens'

/**
 * Proposta comercial da ProcessBase para a Braga Advocacia.
 * Conteúdo transcrito de "Proposta Braga advocacia.pdf" (28/09/2026).
 * A estrutura é 100% nativa: containers e widgets editáveis no Elementor.
 */

type JsonRecord = Record<string, unknown>

const WHATSAPP_URL = pbWhatsApp('Olá, Gian. Quero conversar sobre a proposta da Braga Advocacia.')
const CONTACT_EMAIL = PB_CONTACT.email

const list = (b: PBBuilder, items: string[], options: JsonRecord = {}) => b.text(
  `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`,
  T.body,
  PB.body,
  { _css_classes: 'pbp-list', ...options },
)

const PROPOSAL_LIST_CSS = [
  'selector .pbp-list ul{list-style:none;margin:0;padding:0}',
  `selector .pbp-list li{position:relative;padding:10px 0 10px 22px;border-bottom:1px solid ${PB.border}}`,
  'selector .pbp-list li:last-child{border-bottom:0}',
  `selector .pbp-list li::before{content:"";position:absolute;left:0;top:calc(10px + .68em);width:9px;height:2px;background:${PB.orange}}`,
].join('')

const makeNav = (): SectionNodeData => {
  const b = createBuilder('pbn')
  const navLink = (label: string, url: string) => b.heading(label, tweak(T.small, { size: 14, weight: 500 }), PB.onNavy, {
    link: link(url), title_hover_color: PB.white, ...FIXED,
  })
  const root = b.root([
    b.row([
      b.image('logo/processbase-logo-reverse.svg', 'ProcessBase', { link_to: 'custom', link: link('#inicio'), _css_classes: 'pbp-nav-logo', ...FIXED }),
      b.heading('Proposta para Braga Advocacia', tweak(T.micro, { size: 10, weight: 600 }), PB.slate, { ...FIXED, _css_classes: 'pbp-client-label' }),
      b.row([
        navLink('Escopo', '#escopo'), navLink('Cronograma', '#cronograma'), navLink('Investimento', '#investimento'),
      ], 24, { margin: sides(0, 0, 0, 'auto' as unknown as number), css_classes: 'pbp-nav-links' }),
      b.button('Falar sobre a proposta', '#investimento', 'outline', 'sm', { ...FIXED, _css_classes: 'pbp-nav-cta' }),
    ], 24, { flex_justify_content: 'space-between', css_classes: 'pbp-nav' }),
  ], {
    background: PB.navy, tag: 'header', pad: false,
    settings: {
      padding: sides(16, L.gutter.desktop), padding_tablet: sides(14, L.gutter.tablet), padding_mobile: sides(13, L.gutter.mobile),
      css_classes: 'pbp-nav-root',
    },
    css: [
      'selector{position:sticky;top:0;z-index:100;border-bottom:1px solid rgba(130,154,175,.18)}',
      'selector .pbp-nav-logo{width:154px}',
      'selector .pbp-nav-logo img{display:block;width:100%;height:auto}',
      'selector .pbp-client-label{padding-left:20px;border-left:1px solid rgba(130,154,175,.28)}',
      '@media(max-width:1024px){selector .pbp-nav-links{display:none}}',
      'selector .pbp-nav-cta .elementor-button{min-height:38px;border-color:rgba(130,154,175,.32);background:rgba(255,255,255,.025);color:rgba(255,255,255,.78)}',
      'selector .pbp-nav-cta .elementor-button:hover{border-color:rgba(255,255,255,.58);background:rgba(255,255,255,.06);color:#fff}',
      '@media(max-width:767px){selector .pbp-client-label{display:none}selector .pbp-nav-logo{width:132px}selector .pbp-nav-cta .elementor-button{font-size:11px;padding:9px 11px;min-height:36px}}',
    ].join(''),
  })
  return b.section('Braga · Navegação da proposta', 'processbase-braga-nav-v1', root)
}

const makeHero = (): SectionNodeData => {
  const b = createBuilder('pbh')
  const metric = (value: string, label: string) => b.col([
    b.heading(value, tweak(T.stat, { size: 34, mobile: 28 }), PB.white),
    b.heading(label, T.micro, PB.slate),
  ], 8, { css_classes: 'pbp-metric' })

  const summary = b.frame([
    b.panelHead('Projeto de estruturação', 'BRAGA ADVOCACIA', 'dark'),
    b.col([
      b.heading('Uma sequência clara para organizar a base.', tweak(T.sub, { size: 32, tablet: 29, mobile: 26 }), PB.white, { header_size: 'h2' }),
      b.text('A proposta reúne cultura, estrutura, responsabilidades, rotina de gestão e um primeiro mapa dos processos do escritório.', T.body, PB.onNavy),
      b.grid([
        metric('06', 'fases'), metric('08', 'semanas'), metric('04', 'profissionais'),
      ], 'repeat(3,minmax(0,1fr))', 0, { padding: sides(24, 0, 0), ...border(PB.line, sides(1, 0, 0, 0)) }, { mobile: 'repeat(3,minmax(0,1fr))' }),
    ], 24, { padding: sides(32), padding_mobile: sides(24, 20) }),
  ], 'dark', {}, { ...reveal(160, 'container', 'fadeIn') })

  const root = b.root([
    b.grid([
      b.col([
        b.eyebrow('Proposta técnica · Braga Advocacia', 'dark', reveal(0)),
        b.heading(`Organizar a base para a Braga avançar ${hl('com clareza.')}`, T.hero, PB.white, { header_size: 'h1', ...maxw(720), ...reveal(80) }),
        b.text('Um projeto de dois meses para tornar visíveis a cultura, a estrutura, as responsabilidades e a rotina de gestão — antes de padronizar os processos.', T.lede, PB.onNavy, { ...maxw(650), ...reveal(160) }),
        b.row([
          b.button('Ver escopo do projeto', '#escopo', 'primary', 'md', reveal(240)),
          b.button('Ir ao investimento', '#investimento', 'outline', 'md', reveal(280)),
        ], 12, { flex_wrap: 'wrap' }),
        b.heading('Conduzido por Gian Bianchin Machado · Engenheiro de produção · CREA RS281315', T.small, PB.slate, { ...maxw(620), ...reveal(320) }),
      ], 26),
      summary,
    ], 'minmax(0,1.15fr) minmax(380px,.85fr)', [36, 72], { grid_align_items: 'center' }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: PB.navy, id: 'inicio', pad: [104, 84, 60],
    css: [
      texture.grid('rgba(130,154,175,.11)', '100% 0%', 48, '62% 75%'),
      texture.glow('rgba(130,154,175,.10)', '8% 100%', '60% 55%'),
      'selector{min-height:calc(100vh - 69px)}',
      'selector .pbp-metric+.pbp-metric{border-left:1px solid rgba(130,154,175,.18);padding-left:20px}',
      '@media(max-width:767px){selector{min-height:0}selector .pbp-metric+.pbp-metric{padding-left:12px}}',
    ].join(''),
  })
  return b.section('Braga · Abertura da proposta', 'processbase-braga-hero-v1', root)
}

const makeContext = (): SectionNodeData => {
  const b = createBuilder('pbc')
  const outcome = (number: string, title: string) => b.row([
    b.heading(number, T.num, PB.orange, FIXED),
    b.heading(title, tweak(T.cardSm, { size: 18 }), PB.ink),
  ], 16, { flex_align_items: 'flex-start', padding: sides(18, 0), ...border(PB.border, sides(1, 0, 0, 0)) })

  const root = b.root([
    b.sectionHead({
      label: 'Contexto e objetivo',
      title: `Antes de documentar processos, é preciso ${hl('organizar a base.', 'light')}`,
      lede: 'A visita inicial mostrou uma oportunidade: dar à direção uma visão comum sobre como o escritório funciona hoje e sobre o que precisa sustentar o próximo ciclo.',
      tone: 'light', width: 900,
    }),
    b.grid([
      b.col([
        b.heading('O ponto de partida', T.card, PB.ink, { header_size: 'h3' }),
        b.text('A Braga Advocacia reúne atividades jurídicas e administrativas que dependem de responsabilidades, decisões e conhecimentos distribuídos entre a equipe. Antes de uma padronização ampla, o projeto organiza esses fundamentos.', T.body, PB.body),
      ], 16, { ...maxw(520), ...reveal(80, 'container') }),
      b.col([
        b.heading('O resultado buscado', T.card, PB.ink, { header_size: 'h3' }),
        b.text('Ao final, a direção terá clareza sobre perfis, cultura, organograma, cargos, rituais de gestão e processos prioritários — uma base consistente para a futura documentação da operação.', T.body, PB.body),
      ], 16, { ...maxw(520), ...reveal(140, 'container') }),
    ], 'repeat(2,minmax(0,1fr))', [28, 72], { padding: sides(48, 0, 20) }, { mobile: '1fr' }),
    b.grid([
      outcome('01', 'Perfis e comunicação da equipe'),
      outcome('02', 'Missão, visão e valores'),
      outcome('03', 'Estrutura e responsabilidades'),
      outcome('04', 'Rituais de gestão'),
      outcome('05', 'Processos e prioridades'),
    ], 'repeat(5,minmax(0,1fr))', 20, { css_classes: 'pbp-outcomes' }, { tablet: 'repeat(3,minmax(0,1fr))', mobile: '1fr' }),
  ], {
    background: PB.white,
    css: 'selector .pbp-outcomes>.e-con:last-child{grid-column:auto}',
  })
  return b.section('Braga · Contexto e objetivo', 'processbase-braga-contexto-v1', root)
}

type Phase = {
  number: string
  title: string
  objective: string
  activities: string[]
  deliverables: string[]
}

const PHASES: Phase[] = [
  {
    number: '01', title: 'Alinhamento e perfis comportamentais',
    objective: 'Compreender a composição da equipe e como os perfis influenciam comunicação, decisão e execução.',
    activities: ['Apresentação do projeto', 'Avaliação dos quatro profissionais', 'Análise individual e do grupo', 'Complementaridades e pontos de conflito', 'Orientações de comunicação'],
    deliverables: ['Relatórios individuais', 'Mapa geral dos perfis', 'Análise do grupo', 'Recomendações iniciais'],
  },
  {
    number: '02', title: 'Construção da cultura organizacional',
    objective: 'Definir os princípios que orientam decisões, comportamentos e relações com clientes e equipe.',
    activities: ['Dinâmica para missão', 'Visão de futuro', 'Valores organizacionais', 'Validação com a direção', 'Treinamento da equipe'],
    deliverables: ['Missão, visão e valores', 'Material de apresentação', 'Treinamento de aplicação prática'],
  },
  {
    number: '03', title: 'Estrutura organizacional e organograma',
    objective: 'Organizar relações de responsabilidade, apoio e tomada de decisão.',
    activities: ['Levantamento da estrutura atual', 'Áreas jurídicas e administrativas', 'Distribuição das atividades', 'Desenho e validação do organograma'],
    deliverables: ['Organograma atual', 'Proposta de estrutura', 'Relações de responsabilidade', 'Organograma final'],
  },
  {
    number: '04', title: 'Definição e validação dos cargos',
    objective: 'Estabelecer responsabilidades, entregas e limites para cada integrante.',
    activities: ['Atividades e responsabilidades atuais', 'Missão de cada cargo', 'Rotinas e entregas esperadas', 'Competências e autonomia', 'Validação com a equipe'],
    deliverables: ['Descrição dos cargos', 'Responsabilidades e entregas', 'Limites de autonomia', 'Documento final validado'],
  },
  {
    number: '05', title: 'Estruturação dos rituais de gestão',
    objective: 'Criar uma rotina de acompanhamento para prioridades, comunicação e controle das ações.',
    activities: ['Necessidades de comunicação', 'Reuniões diária e semanal', 'Pautas, duração e responsáveis', 'Registro das decisões', 'Ferramenta e treinamento'],
    deliverables: ['Padrões das reuniões', 'Pautas estruturadas', 'Modelo de ata', 'Plano de ação', 'Acompanhamento das pendências'],
  },
  {
    number: '06', title: 'Mapeamento inicial dos processos',
    objective: 'Enxergar a operação de forma macro e priorizar o que deverá ser padronizado na próxima etapa.',
    activities: ['Serviços e processos existentes', 'Entrevistas com responsáveis', 'Dependência de conhecimento individual', 'Impacto, risco e prioridade', 'Visão macro da operação'],
    deliverables: ['Lista e mapa macro dos processos', 'Responsáveis identificados', 'Sequência de padronização', 'Base para a próxima proposta'],
  },
]

const makePhaseCard = (b: PBBuilder, phase: Phase, index: number) => b.frame([
  b.panelHead(`Fase ${phase.number}`, `${String(index + 1).padStart(2, '0')} / 06`, 'light'),
  b.col([
    b.heading(phase.title, tweak(T.card, { size: 23 }), PB.ink, { header_size: 'h3' }),
    b.text(phase.objective, T.body, PB.body),
    b.heading('Atividades', T.micro, PB.slateInk, { _margin: sides(8, 0, 0) }),
    list(b, phase.activities),
    b.heading('Entregáveis', T.micro, PB.slateInk, { _margin: sides(8, 0, 0) }),
    list(b, phase.deliverables),
  ], 16, { padding: sides(28, 26, 30), padding_mobile: sides(24, 20) }),
], 'light', {}, { ...reveal(index * 60, 'container') })

const makeScope = (): SectionNodeData => {
  const b = createBuilder('pbs')
  const root = b.root([
    b.sectionHead({
      label: 'Escopo do projeto',
      title: `Um único projeto. ${hl('Seis fases conectadas.', 'light')}`,
      lede: 'Cada fase organiza uma camada da operação e prepara a próxima, mantendo clareza, controle e rastreabilidade das entregas.',
      tone: 'light', width: 820,
    }),
    b.grid(PHASES.map((phase, index) => makePhaseCard(b, phase, index)), 'repeat(2,minmax(0,1fr))', 24, {
      padding: sides(48, 0, 0), css_classes: 'pbp-phase-grid',
    }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: PB.mist, id: 'escopo',
    css: [
      PROPOSAL_LIST_CSS,
      texture.dots('rgba(95,122,145,.16)', '100% 0%', 22, '45% 35%'),
      'selector .pbp-phase-grid>.pb-frame{min-width:0}',
    ].join(''),
  })
  return b.section('Braga · Escopo em seis fases', 'processbase-braga-escopo-v1', root)
}

const WEEKS = [
  ['01', 'Alinhamento e aplicação dos perfis'],
  ['02', 'Análise dos perfis comportamentais'],
  ['03', 'Construção da missão, visão e valores'],
  ['04', 'Treinamento e consolidação da cultura'],
  ['05', 'Construção do organograma'],
  ['06', 'Definição e validação dos cargos'],
  ['07', 'Estruturação das reuniões diária e semanal'],
  ['08', 'Mapeamento inicial e priorização dos processos'],
]

const makeTimeline = (): SectionNodeData => {
  const b = createBuilder('pbt')
  const week = ([number, title]: string[], index: number) => b.col([
    b.row([
      b.heading(number, tweak(T.stat, { size: 24, mobile: 22 }), PB.white, FIXED),
      b.heading(index < 4 ? 'MÊS 01' : 'MÊS 02', tweak(T.micro, { size: 10 }), PB.slate, FIXED),
    ], 12, { flex_justify_content: 'space-between' }),
    b.heading(title, tweak(T.cardSm, { size: 17 }), PB.white, { header_size: 'h3' }),
  ], 18, {
    padding: sides(24), min_height: px(150), flex_justify_content: 'space-between',
    ...bg(index === 0 ? PB.navyRaised : 'rgba(255,255,255,.035)'), ...border(PB.line),
    border_radius: sides(L.radius.card), css_classes: 'pbp-week', ...reveal(index * 45, 'container'),
  })

  const root = b.root([
    b.sectionHead({
      label: 'Cronograma',
      title: `Oito semanas. ${hl('Um avanço por vez.')}`,
      lede: 'Uma reunião semanal de 1 a 1,5 hora mantém a direção e a operação alinhadas durante todo o projeto.',
      tone: 'dark', width: 760,
    }),
    b.grid(WEEKS.map(week), 'repeat(4,minmax(0,1fr))', 16, { padding: sides(48, 0, 0), css_classes: 'pbp-timeline' }, { tablet: 'repeat(2,minmax(0,1fr))', mobile: '1fr' }),
  ], {
    background: PB.navy, id: 'cronograma',
    css: [
      texture.hatch('rgba(130,154,175,.10)', '100% 100%', 14, '45% 55%'),
      `@media(hover:hover){selector .pbp-week:hover{border-color:${PB.slate}}}`,
    ].join(''),
  })
  return b.section('Braga · Cronograma de oito semanas', 'processbase-braga-cronograma-v1', root)
}

const makeResponsibilities = (): SectionNodeData => {
  const b = createBuilder('pbr')
  const client = [
    'Disponibilizar os quatro integrantes para reuniões e avaliações',
    'Compartilhar estrutura, cargos, rotina, documentos e controles',
    'Participar da construção da cultura e dos rituais de gestão',
    'Validar organograma e descrições dos cargos nos prazos acordados',
    'Informar os processos jurídicos e administrativos',
    'Aplicar os padrões construídos durante o projeto',
  ]
  const excluded = [
    'Implantação de sistema de gestão ou software jurídico',
    'Reestruturação financeira, comercial ou tributária',
    'Assessoria jurídica ou análise técnica dos serviços prestados',
    'Recrutamento, seleção ou desligamento de colaboradores',
    'Treinamentos técnicos específicos da área jurídica',
    'Acompanhamento operacional diário ou execução das atividades internas',
    'Demandas adicionais fora do escopo das oito semanas',
  ]
  const card = (label: string, title: string, copy: string, items: string[], tag: string) => b.frame([
    b.panelHead(label, tag, 'light'),
    b.col([
      b.heading(title, T.card, PB.ink, { header_size: 'h3' }),
      b.text(copy, T.body, PB.body),
      list(b, items),
    ], 18, { padding: sides(30, 28), padding_mobile: sides(24, 20) }),
  ], 'light')

  const root = b.root([
    b.sectionHead({
      label: 'Acordos de trabalho',
      title: `Clareza também sobre ${hl('como vamos trabalhar.', 'light')}`,
      lede: 'O resultado depende da disponibilidade da equipe, da transparência das informações e do compromisso da direção com as decisões tomadas.',
      tone: 'light', width: 860,
    }),
    b.grid([
      card('Envolvimento da Braga', 'Participação ativa', 'A equipe participa da construção, validação e implantação das entregas.', client, 'RESPONSABILIDADES'),
      card('Limites do projeto', 'O que não está incluso', 'Estes itens permanecem fora desta proposta para proteger o foco e o prazo do projeto.', excluded, 'FORA DO ESCOPO'),
    ], 'repeat(2,minmax(0,1fr))', 24, { padding: sides(48, 0, 0) }, { tablet: '1fr', mobile: '1fr' }),
  ], { background: PB.white, css: PROPOSAL_LIST_CSS })
  return b.section('Braga · Responsabilidades e limites', 'processbase-braga-acordos-v1', root)
}

const makeInvestment = (): SectionNodeData => {
  const b = createBuilder('pbi')
  const plan = (label: string, price: string, detail: string, tag: string, featured = false) => b.frame([
    b.panelHead(label, tag, 'dark'),
    b.col([
      b.heading(price, tweak(T.h2, { size: 46, tablet: 40, mobile: 36 }), PB.white),
      b.text(detail, T.body, PB.onNavy),
      ...(featured ? [b.heading('Economia de R$ 1.000,00', tweak(T.small, { size: 14, weight: 600 }), PB.orange)] : []),
    ], 22, { padding: sides(34, 30, 36), padding_mobile: sides(28, 22), min_height: px(220), flex_justify_content: 'space-between' }),
  ], 'dark', featured ? { ...border(PB.orange) } : {}, { ...reveal(featured ? 100 : 40, 'container') })

  const root = b.root([
    b.grid([
      b.col([
        b.eyebrow('Investimento no projeto', 'dark'),
        b.heading(`Uma base mais clara para decisões ${hl('mais consistentes.')}`, T.h2, PB.white, { header_size: 'h2', ...maxw(610) }),
        b.text('A condição escolhida cobre as seis fases, as oito semanas de trabalho e os entregáveis descritos nesta proposta.', T.lede, PB.onNavy, maxw(560)),
        b.heading('Pagamento do primeiro mês no início do projeto.', T.small, PB.slate),
      ], 24),
      b.grid([
        plan('Pagamento mensal', '2× R$ 3.500,00', 'Total do projeto: R$ 7.000,00.', 'PARCELADO'),
        plan('Pagamento à vista', 'R$ 6.000,00', 'Pagamento integral no início do projeto.', 'MELHOR CONDIÇÃO', true),
      ], 'repeat(2,minmax(0,1fr))', 18, {}, { mobile: '1fr' }),
    ], 'minmax(0,.85fr) minmax(0,1.15fr)', [40, 72], { grid_align_items: 'center' }, { tablet: '1fr', mobile: '1fr' }),
    b.col([
      b.heading('“Antes de padronizar os processos, é preciso organizar a base que sustenta a operação.”', tweak(T.sub, { size: 34, tablet: 30, mobile: 27 }), PB.white, { align: 'center', ...maxw(880) }),
      b.row([
        b.button('Conversar sobre a proposta', WHATSAPP_URL, 'primary', 'md', { link: link(WHATSAPP_URL, true) }),
        b.button('Enviar um e-mail', `mailto:${CONTACT_EMAIL}`, 'outline', 'md'),
      ], 12, { flex_wrap: 'wrap', flex_justify_content: 'center' }),
    ], 28, { flex_align_items: 'center', padding: sides(72, 0, 0), margin: sides(72, 0, 0), ...border(PB.line, sides(1, 0, 0, 0)) }),
  ], {
    background: PB.navy, id: 'investimento',
    css: [
      texture.grain('rgba(255,255,255,.10)', '0% 100%', '55% 55%'),
      '@media(max-width:767px){selector .elementor-button-wrapper{width:100%}selector .elementor-button{width:100%}}',
    ].join(''),
  })
  return b.section('Braga · Investimento e próximo passo', 'processbase-braga-investimento-v1', root)
}

const makeFooter = (): SectionNodeData => {
  const b = createBuilder('pbf')
  const root = b.root([
    b.row([
      b.image('logo/processbase-logo-reverse.svg', 'ProcessBase', { _css_classes: 'pbp-footer-logo', ...FIXED }),
      b.col([
        b.heading('Base estruturada. Cultura definida. Responsabilidades claras.', tweak(T.cardSm, { size: 17 }), PB.white, { align: 'right' }),
        b.heading('Proposta técnica · Braga Advocacia · 2026', T.small, PB.slate, { align: 'right' }),
      ], 6, { flex_align_items: 'flex-end' }),
    ], 24, { flex_justify_content: 'space-between', flex_wrap: 'wrap' }),
  ], {
    background: PB.navy, tag: 'footer', pad: false,
    settings: { padding: sides(32, L.gutter.desktop), padding_tablet: sides(28, L.gutter.tablet), padding_mobile: sides(26, L.gutter.mobile) },
    css: [
      'selector{border-top:1px solid rgba(130,154,175,.18)}selector .pbp-footer-logo{width:160px}',
      '@media(max-width:767px){selector .pbp-footer-logo{width:140px}selector .elementor-heading-title{text-align:left!important}}',
    ].join(''),
  })
  return b.section('Braga · Rodapé da proposta', 'processbase-braga-footer-v1', root)
}

export const createProcessBaseBragaProposalTemplate = (): LandingTemplate => ({
  id: 'processbase-proposta-braga',
  name: 'ProcessBase · Proposta Braga Advocacia',
  description: 'Proposta técnica em página web para estruturação e diagnóstico organizacional da Braga Advocacia.',
  audience: 'Braga Advocacia',
  sections: [
    makeNav(), makeHero(), makeContext(), makeScope(), makeTimeline(), makeResponsibilities(), makeInvestment(), makeFooter(),
  ],
})
